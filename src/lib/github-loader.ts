import { createHash } from "crypto";
import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import dotenv from "dotenv";
import { Document } from "@langchain/core/documents";
import { Prisma } from "@prisma/client";
import { summariseCode, generateEmbeddings as embedSummary } from "./gemini";
import { db } from "@/server/db";
import { createGithubClient } from "./github-auth";
import { parseGithubUrl } from "./github-url";

dotenv.config();

const MAX_FILES_TO_INDEX = 150;
const DELAY_BETWEEN_FILES_MS = 500;

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

function getGithubClient(githubToken?: string) {
  return createGithubClient(githubToken);
}

const getDefaultBranch = async (githubUrl: string, githubToken?: string) => {
  const { owner, repo } = parseGithubUrl(githubUrl);
  const client = getGithubClient(githubToken);
  const { data } = await client.rest.repos.get({ owner, repo });
  return data.default_branch;
};

async function getBranchHeadSha(
  githubUrl: string,
  branch: string,
  githubToken?: string,
) {
  const { owner, repo } = parseGithubUrl(githubUrl);
  const client = getGithubClient(githubToken);
  const { data } = await client.rest.repos.getBranch({
    owner,
    repo,
    branch,
  });
  return data.commit.sha;
}

export async function listGithubBranches(
  githubUrl: string,
  githubToken?: string,
) {
  const { owner, repo } = parseGithubUrl(githubUrl);
  const client = getGithubClient(githubToken);
  const [repoData, branches] = await Promise.all([
    client.rest.repos.get({ owner, repo }),
    client.paginate(client.rest.repos.listBranches, {
      owner,
      repo,
      per_page: 100,
    }),
  ]);

  return {
    defaultBranch: repoData.data.default_branch,
    branches: branches.map((branch) => branch.name),
  };
}

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
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { activeBranch: true, defaultBranch: true },
  });
  const branch = project?.activeBranch ?? project?.defaultBranch;

  const nullRows = (await db.$queryRawUnsafe(
    `SELECT id, filename, summary, sourcecode
     FROM "SourceCodeEmbeddings"
     WHERE "projectId" = $1
       AND ($2::text IS NULL OR "branch" = $2)
       AND "summaryEmbeddings" IS NULL`,
    projectId,
    branch ?? null,
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
  branch: string,
  githubToken?: string,
) => {
  const token = githubToken || process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GitHub token is required");

  const { cleaned } = parseGithubUrl(githubUrl);
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

function hashContent(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

async function processFileForIndexing(params: {
  projectId: string;
  branch: string;
  doc: Document;
}) {
  const { projectId, branch, doc } = params;
  const filename = String(doc.metadata.source ?? "unknown");
  const sourcecode = JSON.parse(JSON.stringify(doc.pageContent)) as string;
  const summary = await summariseCode(doc);
  const embedding = await embedForRetrieval(filename, summary, sourcecode);
  const contentHash = hashContent(sourcecode);
  const blobSha =
    typeof doc.metadata.sha === "string"
      ? doc.metadata.sha
      : typeof doc.metadata.oid === "string"
        ? doc.metadata.oid
        : null;

  const row = await db.sourceCodeEmbeddings.upsert({
    where: {
      projectId_branch_filename: {
        projectId,
        branch,
        filename,
      },
    },
    update: {
      summary,
      sourcecode,
      contentHash,
      blobSha,
      indexedAt: new Date(),
    },
    create: {
      projectId,
      branch,
      filename,
      summary,
      sourcecode,
      contentHash,
      blobSha,
    },
  });

  await saveSummaryEmbedding(row.id, embedding);
  return { filename, contentHash };
}

async function updateJobProgress(jobId: string, data: {
  totalFiles?: number;
  processedFiles?: number;
  failedFiles?: number;
  status?: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  errorMessage?: string | null;
  finishedAt?: Date | null;
  commitSha?: string | null;
}) {
  await db.indexingJob.update({
    where: { id: jobId },
    data,
  });
}

export async function runIndexingJob(
  jobId: string,
  projectId: string,
  githubUrl: string,
  branch: string,
  githubToken?: string,
) {
  await updateJobProgress(jobId, {
    status: "PROCESSING",
    errorMessage: null,
  });

  try {
    const [docs, commitSha, existingRows] = await Promise.all([
      loadGithubRepo(githubUrl, branch, githubToken),
      getBranchHeadSha(githubUrl, branch, githubToken),
      db.sourceCodeEmbeddings.findMany({
        where: { projectId, branch },
        select: {
          id: true,
          filename: true,
          contentHash: true,
        },
      }),
    ]);

    const filesToIndex = pickFilesToIndex(docs);
    await updateJobProgress(jobId, {
      totalFiles: filesToIndex.length,
      commitSha,
    });

    const existingByFilename = new Map(
      existingRows.map((row) => [row.filename, row]),
    );
    const selectedFilenames = new Set(
      filesToIndex.map((doc) => String(doc.metadata.source ?? "unknown")),
    );

    let processedFiles = 0;
    let failedFiles = 0;

    for (let index = 0; index < filesToIndex.length; index++) {
      const doc = filesToIndex[index]!;
      const filename = String(doc.metadata.source ?? "unknown");
      const sourcecode = String(doc.pageContent ?? "");
      const contentHash = hashContent(sourcecode);
      const existing = existingByFilename.get(filename);

      try {
        if (existing?.contentHash !== contentHash) {
          await processFileForIndexing({
            projectId,
            branch,
            doc,
          });
        }
      } catch (error) {
        failedFiles++;
        console.error(`Skipping ${filename} due to indexing error:`, error);
      }

      processedFiles++;
      await updateJobProgress(jobId, {
        processedFiles,
        failedFiles,
      });

      if (index < filesToIndex.length - 1) {
        await sleep(DELAY_BETWEEN_FILES_MS);
      }
    }

    const removedFiles = existingRows
      .filter((row) => !selectedFilenames.has(row.filename))
      .map((row) => row.filename);

    if (removedFiles.length) {
      await db.sourceCodeEmbeddings.deleteMany({
        where: {
          projectId,
          branch,
          filename: { in: removedFiles },
        },
      });
    }

    await db.project.update({
      where: { id: projectId },
      data: {
        activeBranch: branch,
        lastIndexedAt: new Date(),
        lastIndexedCommitSha: commitSha,
      },
    });

    await backfillNullEmbeddings(projectId);

    await updateJobProgress(jobId, {
      status: failedFiles > 0 ? "FAILED" : "COMPLETED",
      failedFiles,
      processedFiles,
      finishedAt: new Date(),
      errorMessage:
        failedFiles > 0
          ? `${failedFiles} file(s) failed during indexing`
          : null,
      commitSha,
    });
  } catch (error) {
    console.error("Indexing job failed:", error);
    await updateJobProgress(jobId, {
      status: "FAILED",
      finishedAt: new Date(),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function startIndexingJob(params: {
  projectId: string;
  githubUrl: string;
  branch?: string;
  githubToken?: string;
  triggeredByUserId?: string;
}) {
  const defaultBranch = await getDefaultBranch(
    params.githubUrl,
    params.githubToken,
  );
  const branch = params.branch || defaultBranch;

  await db.project.update({
    where: { id: params.projectId },
    data: {
      defaultBranch,
      activeBranch: branch,
    },
  });

  const job = await db.indexingJob.create({
    data: {
      projectId: params.projectId,
      branch,
      triggeredByUserId: params.triggeredByUserId,
      status: "QUEUED",
    },
  });

  void runIndexingJob(
    job.id,
    params.projectId,
    params.githubUrl,
    branch,
    params.githubToken,
  );

  return job;
}

export async function getLatestIndexingJob(projectId: string) {
  return await db.indexingJob.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}
