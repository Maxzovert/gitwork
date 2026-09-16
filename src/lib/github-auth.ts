import { clerkClient } from "@clerk/nextjs/server";
import { Octokit } from "octokit";
import { TRPCError } from "@trpc/server";

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

/**
 * Fetch the Clerk-managed GitHub OAuth access token for a user.
 * Requires GitHub SSO in Clerk with the `repo` scope (custom OAuth app).
 */
export async function getUserGithubToken(clerkUserId: string) {
  const client = await clerkClient();

  try {
    const response = await client.users.getUserOauthAccessToken(
      clerkUserId,
      "oauth_github",
    );
    const entry = response.data[0];
    if (entry?.token) {
      return entry.token;
    }
  } catch {
    // Fall through — older Clerk versions may use "github"
  }

  try {
    const response = await client.users.getUserOauthAccessToken(
      clerkUserId,
      "github",
    );
    return response.data[0]?.token ?? null;
  } catch {
    return null;
  }
}

export async function requireUserGithubToken(clerkUserId: string) {
  // Prefer an explicit Settings PAT over Clerk OAuth / env fallback.
  const stored = await getStoredGithubPat(db, clerkUserId);
  if (stored) return stored;

  const token = await getUserGithubToken(clerkUserId);
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

/** Prefer an override, then Settings PAT, then OAuth, then env fallback. */
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

export async function getGithubConnectionStatus(clerkUserId: string) {
  const client = await clerkClient();
  const user = await client.users.getUser(clerkUserId);
  const account = user.externalAccounts.find(
    (item) => item.provider === "github",
  );

  const storedPat = await getStoredGithubPat(db, clerkUserId);
  const oauthToken = storedPat ? null : await getUserGithubToken(clerkUserId);
  const effectiveToken = storedPat ?? oauthToken;
  const envFallback = Boolean(process.env.GITHUB_TOKEN?.trim());
  const approvedScopes = account?.approvedScopes?.split(" ").filter(Boolean) ?? [];
  const hasRepoScope =
    approvedScopes.includes("repo") ||
    approvedScopes.includes("public_repo") ||
    Boolean(storedPat) ||
    envFallback;

  return {
    connected: Boolean(account) || Boolean(storedPat) || envFallback,
    username: account?.username ?? null,
    hasToken: Boolean(effectiveToken) || envFallback,
    hasRepoScope: hasRepoScope || Boolean(effectiveToken) || envFallback,
    approvedScopes,
    usingServerFallback: envFallback && !effectiveToken,
    usingSettingsPat: Boolean(storedPat),
  };
}
