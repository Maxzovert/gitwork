import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import dotenv from "dotenv";
import { Document } from "@langchain/core/documents";
import { Octokit } from "octokit";
import { summariseCode, generateEmbeddings as embedSummary } from "./gemini";
import { db } from "@/server/db";
import { octokit } from "./github";

dotenv.config();

const MAX_FILES_TO_INDEX = 30;
const DELAY_BETWEEN_FILES_MS = 4_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    recursive: true,
    unknown: "warn",
    maxConcurrency: 5,
  });

  const docs = await loader.load();
  return docs;
};

export const indexGithubRepo = async (
  projectId: string,
  githubUrl: string,
  githubToken?: string,
) => {
  const docs = await loadGithubRepo(githubUrl, githubToken);
  const filesToIndex = docs.slice(0, MAX_FILES_TO_INDEX);
  console.log(
    `Indexing ${filesToIndex.length} of ${docs.length} files for project ${projectId}`,
  );

  for (let index = 0; index < filesToIndex.length; index++) {
    const doc = filesToIndex[index]!;
    console.log(`processing ${index + 1} of ${filesToIndex.length}`);

    try {
      const summary = await summariseCode(doc);
      const embedding = await embedSummary(summary);

      const sourceCodeEmbedding = await db.sourceCodeEmbeddings.create({
        data: {
          summary,
          sourcecode: JSON.parse(JSON.stringify(doc.pageContent)),
          filename: doc.metadata.source as string,
          projectId,
        },
      });

      await db.$executeRaw`
        UPDATE "SourceCodeEmbeddings"
        SET "summaryEmbeddings" = ${`[${embedding.join(",")}]`}::vector
        WHERE id = ${sourceCodeEmbedding.id}
      `;
    } catch (error) {
      console.error(
        `Skipping ${doc.metadata.source} due to indexing error:`,
        error,
      );
    }

    if (index < filesToIndex.length - 1) {
      await sleep(DELAY_BETWEEN_FILES_MS);
    }
  }
};
