import { createGithubClient } from "@/lib/github-auth";
import { parseGithubUrl } from "@/lib/github-url";

export type RepoTag = {
  name: string;
  commitSha: string;
};

export type ChangelogCommit = {
  sha: string;
  message: string;
  author: string;
};

export type ChangelogPull = {
  number: number;
  title: string;
  url: string;
};

export type ChangelogDraft = {
  base: string;
  head: string;
  compareUrl: string;
  commits: ChangelogCommit[];
  pulls: ChangelogPull[];
  notes: string;
};

export async function listRepoTags(
  token: string,
  githubUrl: string,
): Promise<RepoTag[]> {
  const { owner, repo } = parseGithubUrl(githubUrl);
  const octokit = createGithubClient(token);

  const { data } = await octokit.rest.repos.listTags({
    owner,
    repo,
    per_page: 50,
  });

  return data.map((tag) => ({
    name: tag.name,
    commitSha: tag.commit.sha,
  }));
}

export async function buildChangelogBetweenRefs(params: {
  token: string;
  githubUrl: string;
  base: string;
  head: string;
}): Promise<Omit<ChangelogDraft, "notes">> {
  const { owner, repo, cleaned } = parseGithubUrl(params.githubUrl);
  const octokit = createGithubClient(params.token);

  const { data: comparison } = await octokit.rest.repos.compareCommits({
    owner,
    repo,
    base: params.base,
    head: params.head,
  });

  const commits: ChangelogCommit[] = (comparison.commits ?? [])
    .slice(-80)
    .map((commit) => ({
      sha: commit.sha.slice(0, 7),
      message: commit.commit.message.split("\n")[0] ?? commit.sha,
      author:
        commit.commit.author?.name ??
        commit.author?.login ??
        "unknown",
    }));

  const pulls: ChangelogPull[] = [];
  const seen = new Set<number>();

  for (const commit of comparison.commits ?? []) {
    const match = /\(#(\d+)\)/.exec(commit.commit.message);
    if (!match?.[1]) continue;
    const number = Number(match[1]);
    if (seen.has(number)) continue;
    seen.add(number);
    pulls.push({
      number,
      title: commit.commit.message.split("\n")[0] ?? `#${number}`,
      url: `${cleaned}/pull/${number}`,
    });
    if (pulls.length >= 40) break;
  }

  return {
    base: params.base,
    head: params.head,
    compareUrl: comparison.html_url,
    commits,
    pulls,
  };
}

export async function createDraftRelease(params: {
  token: string;
  githubUrl: string;
  tag: string;
  name: string;
  body: string;
}) {
  const { owner, repo } = parseGithubUrl(params.githubUrl);
  const octokit = createGithubClient(params.token);

  const { data } = await octokit.rest.repos.createRelease({
    owner,
    repo,
    tag_name: params.tag,
    name: params.name,
    body: params.body,
    draft: true,
    generate_release_notes: false,
  });

  return {
    id: data.id,
    url: data.html_url,
    tagName: data.tag_name,
  };
}
