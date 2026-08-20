import { db } from "@/server/db";
import { createGithubClient } from "@/lib/github-auth";
import { parseGithubUrl } from "@/lib/github-url";

const README_PATHS = ["README.md", "README", "Readme.md", "readme.md"];
const CONTRIBUTING_PATHS = [
  "CONTRIBUTING.md",
  "CONTRIBUTING",
  "docs/CONTRIBUTING.md",
  ".github/CONTRIBUTING.md",
];
const PACKAGE_PATHS = ["package.json", "Makefile", "makefile", "pyproject.toml", "go.mod"];

const MAX_DOC_CHARS = 12_000;
const MAX_SKETCH_FILES = 40;
const MIN_USEFUL_DOC_CHARS = 200;

export type RepoDoc = {
  path: string;
  content: string;
};

export type FolderSketchFile = {
  filename: string;
  summary: string;
  sourcecode: string;
};

export type FolderSketchGroup = {
  name: string;
  files: FolderSketchFile[];
};

export type OverviewFileReference = {
  filename: string;
  sourceCode: string;
  summary: string;
};

export type ProjectOverviewJson = {
  whatItIs: string;
  howToRun: string;
  folders: Array<{ name: string; blurb: string; files: string[] }>;
  howToContribute: string;
  startHere: Array<{ filename: string; why: string }>;
  source: "docs" | "analysis" | "mixed";
};

async function getFileContent(
  githubUrl: string,
  path: string,
  branch: string,
  githubToken?: string,
): Promise<RepoDoc | null> {
  const { owner, repo } = parseGithubUrl(githubUrl);
  const client = createGithubClient(githubToken);

  try {
    const { data } = await client.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if (Array.isArray(data) || data.type !== "file" || !("content" in data) || !data.content) {
      return null;
    }

    const content = Buffer.from(data.content, "base64").toString("utf8");
    if (!content.trim()) return null;

    return {
      path: data.path ?? path,
      content: content.slice(0, MAX_DOC_CHARS),
    };
  } catch {
    return null;
  }
}

async function firstExistingFile(
  githubUrl: string,
  paths: string[],
  branch: string,
  githubToken?: string,
) {
  for (const path of paths) {
    const doc = await getFileContent(githubUrl, path, branch, githubToken);
    if (doc) return doc;
  }
  return null;
}

export async function fetchRepoDocs(
  githubUrl: string,
  branch: string,
  githubToken?: string,
) {
  const [readme, contributing, setupFile] = await Promise.all([
    firstExistingFile(githubUrl, README_PATHS, branch, githubToken),
    firstExistingFile(githubUrl, CONTRIBUTING_PATHS, branch, githubToken),
    firstExistingFile(githubUrl, PACKAGE_PATHS, branch, githubToken),
  ]);

  return { readme, contributing, setupFile };
}

export function isUsefulDoc(doc: RepoDoc | null) {
  return Boolean(doc && doc.content.trim().length >= MIN_USEFUL_DOC_CHARS);
}

function sketchFromRows(
  rows: Array<{ filename: string; summary: string; sourcecode: string }>,
) {
  const groups = new Map<string, FolderSketchFile[]>();
  for (const row of rows) {
    const top = row.filename.split("/")[0] ?? row.filename;
    const list = groups.get(top) ?? [];
    if (list.length < 3) {
      list.push({
        filename: row.filename,
        summary: row.summary,
        sourcecode: row.sourcecode.slice(0, 1500),
      });
      groups.set(top, list);
    }
  }

  const folders: FolderSketchGroup[] = [...groups.entries()].map(([name, files]) => ({
    name,
    files,
  }));

  return { folders, files: rows };
}

export async function buildFolderSketch(projectId: string, branch?: string) {
  const rows = await db.sourceCodeEmbeddings.findMany({
    where: branch ? { projectId, branch } : { projectId },
    select: {
      filename: true,
      summary: true,
      sourcecode: true,
    },
    orderBy: { filename: "asc" },
    take: MAX_SKETCH_FILES,
  });

  if (rows.length || !branch) {
    return sketchFromRows(rows);
  }

  const fallbackRows = await db.sourceCodeEmbeddings.findMany({
    where: { projectId },
    select: {
      filename: true,
      summary: true,
      sourcecode: true,
    },
    orderBy: { filename: "asc" },
    take: MAX_SKETCH_FILES,
  });

  return sketchFromRows(fallbackRows);
}

export function allowedFilenames(params: {
  readme: RepoDoc | null;
  contributing: RepoDoc | null;
  setupFile: RepoDoc | null;
  sketchFiles: FolderSketchFile[];
}) {
  const names = new Set<string>();
  if (params.readme) names.add(params.readme.path);
  if (params.contributing) names.add(params.contributing.path);
  if (params.setupFile) names.add(params.setupFile.path);
  for (const file of params.sketchFiles) names.add(file.filename);
  return names;
}

export function resolveOverviewFileReferences(
  cited: string[],
  allowed: Set<string>,
  docs: RepoDoc[],
  sketchFiles: FolderSketchFile[],
): OverviewFileReference[] {
  const byName = new Map<string, OverviewFileReference>();

  for (const doc of docs) {
    byName.set(doc.path, {
      filename: doc.path,
      sourceCode: doc.content.slice(0, 4000),
      summary: `${doc.path} from the repository.`,
    });
  }

  for (const file of sketchFiles) {
    byName.set(file.filename, {
      filename: file.filename,
      sourceCode: file.sourcecode,
      summary: file.summary,
    });
  }

  const uniqueCited = [...new Set(cited.map((name) => name.trim()).filter(Boolean))];
  const resolved: OverviewFileReference[] = [];

  for (const name of uniqueCited) {
    if (!allowed.has(name)) continue;
    const match = byName.get(name);
    if (match) resolved.push(match);
  }

  if (!resolved.length) {
    return [...byName.values()].slice(0, 6);
  }

  return resolved.slice(0, 12);
}

export function collectCitedFilenames(overview: ProjectOverviewJson) {
  const cited: string[] = [];
  for (const folder of overview.folders) {
    cited.push(...folder.files);
  }
  for (const item of overview.startHere) {
    cited.push(item.filename);
  }
  return cited;
}
