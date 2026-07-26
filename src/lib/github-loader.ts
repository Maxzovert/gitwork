import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import dotenv from "dotenv";
import { Document } from "@langchain/core/documents";
import { Octokit } from "octokit";
import { Prisma } from "@prisma/client";
import { summariseCode, generateEmbeddings as embedSummary } from "./gemini";
import { db } from "@/server/db";
import { octokit } from "./github";

dotenv.config();

const MAX_FILES_TO_INDEX = 50;
const DELAY_BETWEEN_FILES_MS = 2_500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const IGNORE_PATHS = [
  "node_modules",
  "dist",
  "build",
  ".next",
  ".git",
  "coverage",
  "vendor",
  "*.lock",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "*.min.js",
  "*.min.css",
  "*.map",
  "*.svg",
  "*.png",
  "*.jpg",
  "*.jpeg",
  "*.gif",
  "*.webp",
  "*.ico",
  "*.woff",
  "*.woff2",
  "*.ttf",
  "*.eot",
  "*.pdf",
  "*.mp4",
  "*.mp3",
];

const isSourceExtension = (path: string) =>
  /\.(ts|tsx|js|jsx|py|go|rs|java|kt|cs|rb|php|c|cpp|h|hpp|vue|svelte)$/i.test(
    path,
  );

const isNoiseFile = (path: string) => {
  const base = path.split("/").pop() ?? path;
  return (
    /\.config\.(ts|js|mjs|cjs)$/i.test(base) ||
    /^(next\.config|postcss\.config|tailwind\.config|eslint\.config|vitest\.config|vite\.config|jest\.config|prettier\.config|prisma\.config)/i.test(
      base,
    ) ||
    /^(package\.json|tsconfig.*\.json|components\.json|vercel\.json|\.eslintrc.*|\.prettierrc.*|\.gitignore|\.env.*)$/i.test(
      base,
    ) ||
    /\.(md|mdx|txt|yml|yaml|toml|lock)$/i.test(base) ||
    /^(LICENSE|CHANGELOG|AGENTS|CLAUDE|DESIGN)/i.test(base)
  );
};

const isAppPath = (path: string) =>
  /(^|\/)(src|app|lib|components|pages|server|features|modules|api)\//i.test(
    path,
  );

/** Prefer real application source; skip configs/docs that pollute RAG. */
const pickFilesToIndex = (docs: Document[]) => {
  const scored = docs
    .map((doc) => {
      const path = String(doc.metadata.source ?? "");
      let score = 100;
      if (!isSourceExtension(path) || isNoiseFile(path)) score += 1000;
      if (isAppPath(path)) score -= 50;
      if (path.includes("test") || path.includes("spec")) score += 20;
      // Prefer non-empty code
      if ((doc.pageContent?.length ?? 0) < 40) score += 200;
      // Keep export/download helpers in the index — common Q&A targets
      if (
        /\b(csv|export|download|xlsx|spreadsheet)\b/i.test(doc.pageContent) ||
        /export|csv|download/i.test(path)
      ) {
        score -= 40;
      }
      return { doc, path, score };
    })
    .filter(({ score }) => score < 1000)
    .sort((a, b) => a.score - b.score);

  const picked = scored.slice(0, MAX_FILES_TO_INDEX).map((s) => s.doc);
  console.log(
    `Selected ${picked.length} source files (from ${docs.length} loaded). Top:`,
    picked.slice(0, 8).map((d) => d.metadata.source),
  );
  return picked;
};

const parseGithubUrl = (githubUrl: string) => {
  const cleaned = githubUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const [owner, repo] = cleaned.split("/").slice(-2);
  if (!owner || !repo) {
    throw new Error("Invalid github url");
  }
  return { owner, repo, cleaned };
};

const getDefaultBranch = async (githubUrl: string, githubToken?: string) => {
  const { owner, repo } = parseGithubUrl(githubUrl);
  const client = githubToken
    ? new Octokit({ auth: githubToken })
    : octokit;
  const { data } = await client.rest.repos.get({ owner, repo });
  return data.default_branch;
};

/**
 * Prisma parameterized `$1::vector` often fails to cast on Neon/pgvector.
 * Inline a numeric-only vector literal via Prisma.raw, then verify it stuck.
 */
export async function saveSummaryEmbedding(
  id: string,
  embedding: number[],
) {
  if (embedding.length !== 768) {
    throw new Error(
      `Expected 768-dim embedding, got ${embedding.length} for id ${id}`,
    );
  }

  const vectorLiteral = `[${embedding.map(Number).join(",")}]`;

  await db.$executeRaw`
    UPDATE "SourceCodeEmbeddings"
    SET "summaryEmbeddings" = ${Prisma.raw(`'${vectorLiteral}'::vector`)}
    WHERE id = ${id}
  `;

  const check = (await db.$queryRawUnsafe(
    `SELECT ("summaryEmbeddings" IS NOT NULL) AS ok
     FROM "SourceCodeEmbeddings"
     WHERE id = $1`,
    id,
  )) as Array<{ ok: boolean }>;

  if (!check[0]?.ok) {
    throw new Error(`Embedding write did not persist for id ${id}`);
  }
}

/** Embed filename + summary + code snippet so symbols like csv/export are searchable. */
async function embedForRetrieval(
  filename: string,
  summary: string,
  sourcecode = "",
) {
  const snippet = sourcecode.slice(0, 2500);
  return embedSummary(
    `File: ${filename}\n\nSummary: ${summary}\n\nCode:\n${snippet}`,
  );
}

/** Fill summaryEmbeddings for rows that were stored with NULL vectors. */
export async function backfillNullEmbeddings(projectId: string) {
  const nullRows = (await db.$queryRawUnsafe(
    `SELECT id, filename, summary, sourcecode
     FROM "SourceCodeEmbeddings"
     WHERE "projectId" = $1
       AND "summaryEmbeddings" IS NULL`,
    projectId,
  )) as Array<{
    id: string;
    filename: string;
    summary: string;
    sourcecode: string;
  }>;

  if (!nullRows.length) {
    console.log(`No null embeddings to backfill for project ${projectId}`);
    return 0;
  }

  console.log(
    `Backfilling ${nullRows.length} null embeddings for project ${projectId}`,
  );

  let filled = 0;
  for (let i = 0; i < nullRows.length; i++) {
    const row = nullRows[i]!;
    try {
      const embedding = await embedForRetrieval(
        row.filename,
        row.summary,
        row.sourcecode,
      );
      await saveSummaryEmbedding(row.id, embedding);
      filled++;
      console.log(
        `Backfilled ${i + 1}/${nullRows.length}: ${row.filename}`,
      );
    } catch (error) {
      console.error(`Failed to backfill embedding for ${row.id}:`, error);
    }

    if (i < nullRows.length - 1) {
      await sleep(DELAY_BETWEEN_FILES_MS);
    }
  }

  return filled;
}

export const loadGithubRepo = async (
  githubUrl: string,
  githubToken?: string,
) => {
  const token = githubToken || process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GitHub token is required");

  const { cleaned } = parseGithubUrl(githubUrl);
  const branch = await getDefaultBranch(cleaned, githubToken);
  console.log(`Loading GitHub repo ${cleaned} on branch ${branch}`);

  const loader = new GithubRepoLoader(cleaned, {
    accessToken: token,
    branch,
    ignoreFiles: [
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "bun.lockb",
    ],
    ignorePaths: IGNORE_PATHS,
    recursive: true,
    unknown: "warn",
    maxConcurrency: 5,
  });

  const docs = await loader.load();
  console.log(`GithubRepoLoader returned ${docs.length} documents`);
  return docs;
};

export const indexGithubRepo = async (
  projectId: string,
  githubUrl: string,
  githubToken?: string,
) => {
  // Drop stale/noise rows from earlier broken indexes so RAG isn't polluted
  const deleted = await db.sourceCodeEmbeddings.deleteMany({
    where: { projectId },
  });
  console.log(
    `Cleared ${deleted.count} old embeddings for project ${projectId}`,
  );

  const docs = await loadGithubRepo(githubUrl, githubToken);
  const filesToIndex = pickFilesToIndex(docs);

  if (!filesToIndex.length) {
    console.warn(
      `No source files selected for project ${projectId} (${docs.length} docs loaded). Check repo contents / ignore rules.`,
    );
    return;
  }

  console.log(
    `Indexing ${filesToIndex.length} of ${docs.length} files for project ${projectId}`,
  );

  for (let index = 0; index < filesToIndex.length; index++) {
    const doc = filesToIndex[index]!;
    const filename = String(doc.metadata.source ?? "unknown");
    console.log(`processing ${index + 1} of ${filesToIndex.length}: ${filename}`);

    let createdId: string | null = null;
    try {
      const summary = await summariseCode(doc);
      const embedding = await embedForRetrieval(
        filename,
        summary,
        doc.pageContent,
      );

      const sourceCodeEmbedding = await db.sourceCodeEmbeddings.create({
        data: {
          summary,
          sourcecode: JSON.parse(JSON.stringify(doc.pageContent)),
          filename,
          projectId,
        },
      });
      createdId = sourceCodeEmbedding.id;

      await saveSummaryEmbedding(sourceCodeEmbedding.id, embedding);
    } catch (error) {
      if (createdId) {
        await db.sourceCodeEmbeddings
          .delete({ where: { id: createdId } })
          .catch(() => undefined);
      }
      console.error(`Skipping ${filename} due to indexing error:`, error);
    }

    if (index < filesToIndex.length - 1) {
      await sleep(DELAY_BETWEEN_FILES_MS);
    }
  }

  await backfillNullEmbeddings(projectId);
};
