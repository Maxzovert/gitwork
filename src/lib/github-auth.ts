import { Octokit } from "octokit";
import { TRPCError } from "@trpc/server";

import { auth0, getSessionUser } from "@/lib/auth0";
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
 * Auth0 GitHub connection token for the **current** session user only.
 * Other users' tokens require Settings PAT (or Management API — not wired yet).
 */
export async function getUserGithubToken(userId: string) {
  const session = await getSessionUser();
  if (!session?.userId || session.userId !== userId) {
    return null;
  }

  try {
    const result = await auth0.getAccessTokenForConnection({
      connection: "github",
    });
    return result.token ?? null;
  } catch (error) {
    console.warn(
      "[github-auth] getAccessTokenForConnection(github) failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function requireUserGithubToken(userId: string) {
  // Prefer an explicit Settings PAT over Auth0 GitHub / env fallback.
  const stored = await getStoredGithubPat(db, userId);
  if (stored) return stored;

  const token = await getUserGithubToken(userId);
  if (token) return token;

  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "Connect your GitHub account or add a GitHub token in Settings to continue.",
  });
}

/**
 * Prefer override → owner Settings PAT → current-user Auth0 GitHub token when
 * the caller is the owner → env fallback.
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

    const token = await getUserGithubToken(owner.userId);
    if (token) return token;
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
  const storedPat = await getStoredGithubPat(db, userId);
  const oauthToken = storedPat ? null : await getUserGithubToken(userId);
  const effectiveToken = storedPat ?? oauthToken;

  let username: string | null = null;
  let userTokenValid = false;

  if (effectiveToken) {
    username = await probeGithubUsername(effectiveToken);
    // Only treat as connected when GitHub accepts the token.
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
    // User-linked credentials only (not the shared server GITHUB_TOKEN).
    connected: userTokenValid,
    username,
    hasToken: userTokenValid || usingServerFallback,
    hasRepoScope: userTokenValid || usingServerFallback,
    approvedScopes:
      userTokenValid || usingServerFallback ? [...GITHUB_REPO_SCOPES] : [],
    usingServerFallback,
    usingSettingsPat: Boolean(storedPat) && userTokenValid,
  };
}
