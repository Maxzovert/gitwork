import { db } from "@/server/db";
import { Octokit } from "octokit";
import axios from "axios";
import { aiSummariesCommits } from "./gemini";

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// const githubUrl = "https://github.com/Maxzovert/thryve";

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
  repo = repo?.replace(/\.git$/, "");
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
  const { project, githubUrl } = await fetchProjectGithubUrl(projectId);
  const commitHashes = await getCommitHashes(githubUrl);
  const unprocessedCommits = await filterUnprocessedCommits(
    projectId,
    commitHashes,
  );
  if (unprocessedCommits.length === 0) {
      return { count: 0, message: "No new commits to process" };
    }
  const summaryResponses = await Promise.allSettled(unprocessedCommits.map(commit => {
    return summariesCommits(githubUrl , commit.commitHash)
  }))

  const summarise = summaryResponses.map((response) => {
    if(response.status === 'fulfilled'){
      return response.value as string
    }
    return "No summary found"
  })
  console.log(summarise , "Summaries")

  const commits = await db.commit.createMany({
    data : summarise.map((summary , index)=> {
      console.log(`Processing commits ${index}`)
      return {
        projectId : projectId,
        commitHash : unprocessedCommits[index]!.commitHash,
        commitMessage : unprocessedCommits[index]!.commitMessage,
        commitAuthorName : unprocessedCommits[index]!.commitAuthorName,
        commitAuthorAvatar : unprocessedCommits[index]!.commitAuthorAvatar,
        commitDate : unprocessedCommits[index]!.commitDate,
        summary
      }
    })
  })
  return commits;
};

export async function summariesCommits(githubUrl: string, commitHash: string) {
  try {
    // Extract owner and repo from GitHub URL
    let [owner, repo] = githubUrl.split("/").slice(-2);
    repo = repo?.replace(/\.git$/, "");
    
    if (!owner || !repo) {
      throw new Error("Invalid github url");
    }

    // Use the GitHub API to get the commit diff
    const { data } = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: commitHash,
    });

    // Get the diff from the commit data
    const diff = data.files?.map(file => 
      `diff --git a/${file.filename} b/${file.filename}\n${file.patch || ''}`
    ).join('\n') || '';

    if (!diff) {
      console.error(`No diff found for commit ${commitHash}`);
      return "No changes found in this commit";
    }

    const summary = await aiSummariesCommits(diff);
    
    if (!summary || typeof summary !== 'string' || summary.trim() === '') {
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
  const unprocessedCommits = commitHashes.filter(
    (commit) =>
      !processedCommits.some(
        (processedCommit) => processedCommit.commitHash === commit.commitHash,
      ),
  );

  return unprocessedCommits;
};

// await pullCommits("cmagvmkr9000399h0zcn6phog").then(console.log)
