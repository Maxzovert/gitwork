import { Octokit } from "octokit";
import { TRPCError } from "@trpc/server";

import { getSessionUser } from "@/lib/auth0";
import { db } from "@/server/db";
import { GITHUB_REPO_SCOPES } from "@/lib/github-scopes";
import { getStoredGithubPat } from "@/server/api/routers/settings";

export { GITHUB_REPO_SCOPES };

/** Shared fallback when no user OAuth token is available (local/dev). */
export const fallbackOctokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export function createGithubClient(githubToken?: string | null) {
  const token = githubToken?.trim() || process.env.GITHUB_TOKEN;
  if (!token || token === process.env.GITHUB_TOKEN) {
    return fallbackOctokit;
  }
  return new Octokit({ auth: token });
}

async function probeGithubUsername(token: string): Promise<string | null> {
  try {
    const client = createGithubClient(token);
    const { data } = await client.rest.users.getAuthenticated();
    return data.login;
  } catch {
    return null;
  }
}

/**
 * Prefer encrypted UserApiToken (direct GitHub OAuth or PAT).
 * Auth0 federated connection tokens are no longer used.
 */
export async function getUserGithubToken(userId: string) {
  return await getStoredGithubPat(db, userId);
}

/** After login/connect, token is already encrypted in DB — probe to warm status. */
export async function ensureGithubConnectionToken(userId: string) {
  return await getStoredGithubPat(db, userId);
}

export async function requireUserGithubToken(userId: string) {
  const stored = await getStoredGithubPat(db, userId);
  if (stored) return stored;

  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "Connect your GitHub account or add a GitHub token to continue.",
  });
}

/**
 * Prefer override → owner encrypted GitHub token → env fallback.
 */
export async function resolveProjectGithubToken(
  projectId: string,
  overrideToken?: string | null,
) {
  if (overrideToken?.trim()) {
    return overrideToken.trim();
  }

  const owner = await db.userToProject.findFirst({
    where: { projectId, role: "OWNER" },
    select: { userId: true },
  });

  if (owner?.userId) {
    const stored = await getStoredGithubPat(db, owner.userId);
    if (stored) return stored;
  }

  return process.env.GITHUB_TOKEN || undefined;
}

export type GithubRepoListItem = {
  fullName: string;
  url: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
};

export async function listUserGithubRepos(
  githubToken: string,
): Promise<GithubRepoListItem[]> {
  const client = createGithubClient(githubToken);
  const repos = await client.paginate(client.rest.repos.listForAuthenticatedUser, {
    sort: "updated",
    direction: "desc",
    per_page: 100,
    affiliation: "owner,collaborator,organization_member",
  });

  return repos.map((repo) => ({
    fullName: repo.full_name,
    url: repo.html_url,
    private: repo.private,
    defaultBranch: repo.default_branch,
    description: repo.description,
  }));
}

export async function getGithubConnectionStatus(userId: string) {
  const session = await getSessionUser();
  const signedInWithGithub = Boolean(session?.signedInWithGithub);

  const storedPat = await getStoredGithubPat(db, userId);
  const effectiveToken = storedPat;

  let username: string | null = null;
  let userTokenValid = false;

  if (effectiveToken) {
    username = await probeGithubUsername(effectiveToken);
    userTokenValid = Boolean(username);
  }

  let usingServerFallback = false;
  if (!userTokenValid && process.env.GITHUB_TOKEN?.trim()) {
    const envUser = await probeGithubUsername(process.env.GITHUB_TOKEN);
    if (envUser) {
      usingServerFallback = true;
      username = envUser;
    }
  }

  return {
    connected: userTokenValid,
    username,
    hasToken: userTokenValid || usingServerFallback,
    hasRepoScope: userTokenValid || usingServerFallback,
    approvedScopes:
      userTokenValid || usingServerFallback ? [...GITHUB_REPO_SCOPES] : [],
    usingServerFallback,
    usingSettingsPat: Boolean(storedPat) && userTokenValid,
    signedInWithGithub,
  };
}
