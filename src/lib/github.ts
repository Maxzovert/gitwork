import { db } from "@/server/db";
import { Octokit } from "octokit";
import { aiSummariesCommits } from "./gemini";
import { parseGithubUrl } from "./github-url";
import type { GithubPushCommit } from "./github-webhook";

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export type CommitInput = {
  commitHash: string;
  commitMessage: string;
  commitAuthorName: string;
  commitAuthorAvatar: string;
  commitDate: string | Date;
};

export const getCommitHashes = async (
  githubUrl: string,
): Promise<CommitInput[]> => {
  const { owner, repo } = parseGithubUrl(githubUrl);
  const { data } = await octokit.rest.repos.listCommits({
    owner,
    repo,
    per_page: 15,
  });
  const sortedCommits = data.sort(
    (a, b) =>
      new Date(b.commit.author?.date ?? 0).getTime() -
      new Date(a.commit.author?.date ?? 0).getTime(),
  );
  return sortedCommits.slice(0, 15).map((commit) => ({
    commitHash: commit.sha,
    commitMessage: commit.commit.message ?? "",
    commitAuthorName: commit.commit.author?.name ?? "",
    commitAuthorAvatar: commit.author?.avatar_url ?? "",
    commitDate: commit.commit.author?.date ?? new Date().toISOString(),
  }));
};

export async function ingestCommits(
  projectId: string,
  commits: CommitInput[],
) {
  const { githubUrl } = await fetchProjectGithubUrl(projectId);
  const unprocessedCommits = await filterUnprocessedCommits(
    projectId,
    commits,
  );
  if (unprocessedCommits.length === 0) {
    return { count: 0, message: "No new commits to process" };
  }

  const result = await db.commit.createMany({
    data: unprocessedCommits.map((commit) => ({
      projectId,
      commitHash: commit.commitHash,
      commitMessage: commit.commitMessage,
      commitAuthorName: commit.commitAuthorName,
      commitAuthorAvatar: commit.commitAuthorAvatar,
      commitDate: new Date(commit.commitDate),
      summary: commit.commitMessage.split("\n")[0] ?? commit.commitMessage,
    })),
    skipDuplicates: true,
  });

  void enhanceCommitSummaries(projectId, githubUrl, unprocessedCommits).catch(
    (error) => console.error("Failed to enhance commit summaries:", error),
  );

  return result;
}

export function mapPushCommits(commits: GithubPushCommit[]): CommitInput[] {
  return commits.map((commit) => ({
    commitHash: commit.id,
    commitMessage: commit.message,
    commitAuthorName: commit.author.name,
    commitAuthorAvatar: "",
    commitDate: commit.timestamp,
  }));
}

export async function ingestPushCommits(
  projectId: string,
  commits: GithubPushCommit[],
) {
  return ingestCommits(projectId, mapPushCommits(commits));
}

/** One-time backfill when a project is created. */
export const pullCommits = async (projectId: string) => {
  const { githubUrl } = await fetchProjectGithubUrl(projectId);
  const commitHashes = await getCommitHashes(githubUrl);
  return ingestCommits(projectId, commitHashes);
};

async function enhanceCommitSummaries(
  projectId: string,
  githubUrl: string,
  commits: CommitInput[],
) {
  for (const commit of commits) {
    try {
      const summary = await summariesCommits(githubUrl, commit.commitHash);
      if (
        !summary ||
        summary.includes("quota exceeded") ||
        summary === "Error processing commit changes"
      ) {
        continue;
      }

      await db.commit.updateMany({
        where: {
          projectId,
          commitHash: commit.commitHash,
        },
        data: { summary },
      });
    } catch (error) {
      console.error(`Skipping AI summary for ${commit.commitHash}:`, error);
    }
  }
}

export async function summariesCommits(githubUrl: string, commitHash: string) {
  try {
    const { owner, repo } = parseGithubUrl(githubUrl);

    const { data } = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: commitHash,
    });

    const diff =
      data.files
        ?.map(
          (file) =>
            `diff --git a/${file.filename} b/${file.filename}\n${file.patch || ""}`,
        )
        .join("\n") || "";

    if (!diff) {
      console.error(`No diff found for commit ${commitHash}`);
      return "No meaningful changes detected";
    }

    const summary = await aiSummariesCommits(diff);

    if (!summary || typeof summary !== "string" || summary.trim() === "") {
      console.error(`Invalid summary returned for commit ${commitHash}`);
      return "No meaningful changes detected";
    }

    return summary;
  } catch (error) {
    console.error(`Error processing commit ${commitHash}:`, error);
    return "Error processing commit changes";
  }
}

const fetchProjectGithubUrl = async (projectId: string) => {
  const project = await db.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      githubUrl: true,
    },
  });

  if (!project?.githubUrl) {
    throw new Error("Project has no github url");
  }
  return { project, githubUrl: project.githubUrl };
};

const filterUnprocessedCommits = async (
  projectId: string,
  commitHashes: CommitInput[],
) => {
  const processedCommits = await db.commit.findMany({
    where: {
      projectId,
    },
    select: {
      commitHash: true,
    },
  });
  const processed = new Set(processedCommits.map((commit) => commit.commitHash));
  return commitHashes.filter((commit) => !processed.has(commit.commitHash));
};
