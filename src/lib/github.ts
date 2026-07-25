import { db } from "@/server/db";
import { Octokit } from "octokit";
import { aiSummariesCommits } from "./gemini";

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

type Response = {
  commitHash: string;
  commitMessage: string;
  commitAuthorName: string;
  commitAuthorAvatar: string;
  commitDate: string;
};

export const getCommitHashes = async (
  githubUrl: string,
): Promise<Response[]> => {
  let [owner, repo] = githubUrl.split("/").slice(-2);
  repo = repo?.replace(/\.git$/, "").replace(/\/$/, "");
  if (!owner || !repo) {
    throw new Error("Invalid github url");
  }
  const { data } = await octokit.rest.repos.listCommits({
    owner,
    repo,
  });
  const sortedCommits = data.sort(
    (a: any, b: any) =>
      new Date(b.commit.author.date).getTime() -
      new Date(a.commit.author.date).getTime(),
  ) as any[];
  return sortedCommits.slice(0, 15).map((commit: any) => ({
    commitHash: commit.sha as string,
    commitMessage: commit.commit.message ?? "",
    commitAuthorName: commit.commit?.author?.name ?? "",
    commitAuthorAvatar: commit?.author?.avatar_url ?? "",
    commitDate: commit.commit?.author.date ?? "",
  }));
};

export const pullCommits = async (projectId: string) => {
  const { githubUrl } = await fetchProjectGithubUrl(projectId);
  const commitHashes = await getCommitHashes(githubUrl);
  const unprocessedCommits = await filterUnprocessedCommits(
    projectId,
    commitHashes,
  );
  if (unprocessedCommits.length === 0) {
    return { count: 0, message: "No new commits to process" };
  }

  // Save commits immediately so the UI can render without waiting on Gemini
  const commits = await db.commit.createMany({
    data: unprocessedCommits.map((commit) => ({
      projectId,
      commitHash: commit.commitHash,
      commitMessage: commit.commitMessage,
      commitAuthorName: commit.commitAuthorName,
      commitAuthorAvatar: commit.commitAuthorAvatar,
      commitDate: commit.commitDate,
      summary: commit.commitMessage.split("\n")[0] ?? commit.commitMessage,
    })),
  });

  // Best-effort AI summaries in the background (won't block rendering)
  void enhanceCommitSummaries(projectId, githubUrl, unprocessedCommits).catch(
    (error) => console.error("Failed to enhance commit summaries:", error),
  );

  return commits;
};

async function enhanceCommitSummaries(
  projectId: string,
  githubUrl: string,
  commits: Response[],
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
    let [owner, repo] = githubUrl.split("/").slice(-2);
    repo = repo?.replace(/\.git$/, "").replace(/\/$/, "");

    if (!owner || !repo) {
      throw new Error("Invalid github url");
    }

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
      return "No changes found in this commit";
    }

    const summary = await aiSummariesCommits(diff);

    if (!summary || typeof summary !== "string" || summary.trim() === "") {
      console.error(`Invalid summary returned for commit ${commitHash}`);
      return "No meaningful changes detected";
    }

    console.log(`Generated summary for ${commitHash}:`, summary);
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
  commitHashes: Response[],
) => {
  const processedCommits = await db.commit.findMany({
    where: {
      projectId,
    },
  });
  return commitHashes.filter(
    (commit) =>
      !processedCommits.some(
        (processedCommit) => processedCommit.commitHash === commit.commitHash,
      ),
  );
};
