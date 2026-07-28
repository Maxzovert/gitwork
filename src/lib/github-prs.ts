import type { Octokit } from "octokit";

import { createGithubClient } from "@/lib/github-auth";
import { parseGithubUrl } from "@/lib/github-url";
import {
  summarisePullRequest,
  summarisePullRequestDigestOverview,
} from "@/lib/gemini";

type GithubClient = ReturnType<typeof createGithubClient>;

type GithubPull = Awaited<
  ReturnType<Octokit["rest"]["pulls"]["list"]>
>["data"][number];

type GithubPullFile = Awaited<
  ReturnType<Octokit["rest"]["pulls"]["listFiles"]>
>["data"][number];

export type PullRequestDigest = {
  generatedAt: string;
  projectId: string;
  window: "rolling_7_days";
  executiveSummary: string;
  riskHighlights: Array<{
    prNumber: number;
    title: string;
    riskLevel: "low" | "medium" | "high";
    reasons: string[];
  }>;
  openPullRequests: Array<{
    number: number;
    title: string;
    author: string;
    url: string;
    isDraft: boolean;
    state: "open";
    createdAt: string;
    updatedAt: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    summary: string;
    reviewerFocus: string[];
    riskLevel: "low" | "medium" | "high";
    riskAreas: string[];
    filenames: string[];
  }>;
  changedSinceLastWeek: {
    opened: number;
    merged: number;
    active: number;
    themes: string[];
  };
};

type RiskResult = {
  riskLevel: "low" | "medium" | "high";
  riskAreas: string[];
};

const RISK_FILE_PATTERNS = [
  { pattern: /(auth|middleware|permission|role|invite)/i, label: "auth and permissions" },
  { pattern: /(prisma|schema|migration|db|database)/i, label: "database changes" },
  { pattern: /(webhook|api|route|trpc|server)/i, label: "backend API surface" },
  { pattern: /(billing|stripe|payment|credit)/i, label: "billing logic" },
  { pattern: /(\.env|config|secret|token)/i, label: "configuration or secrets" },
];

function assessRisk(files: GithubPullFile[], additions: number, deletions: number): RiskResult {
  const changedFiles = files.length;
  const riskAreas = new Set<string>();
  const totalChanges = additions + deletions;

  if (totalChanges >= 700) riskAreas.add("large diff");
  if (changedFiles >= 18) riskAreas.add("many files changed");
  if (files.some((file) => file.patch == null)) {
    riskAreas.add("contains binary or large generated changes");
  }

  for (const file of files) {
    for (const item of RISK_FILE_PATTERNS) {
      if (item.pattern.test(file.filename)) {
        riskAreas.add(item.label);
      }
    }
  }

  if (riskAreas.size >= 4 || totalChanges >= 1200) {
    return { riskLevel: "high", riskAreas: [...riskAreas] };
  }
  if (riskAreas.size >= 2 || totalChanges >= 250 || changedFiles >= 8) {
    return { riskLevel: "medium", riskAreas: [...riskAreas] };
  }
  return { riskLevel: "low", riskAreas: [...riskAreas] };
}

async function listAllPullFiles(
  client: GithubClient,
  owner: string,
  repo: string,
  pullNumber: number,
) {
  return await client.paginate(client.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });
}

async function listOpenPullRequests(
  client: GithubClient,
  owner: string,
  repo: string,
) {
  const { data } = await client.rest.pulls.list({
    owner,
    repo,
    state: "open",
    sort: "updated",
    direction: "desc",
    per_page: 10,
  });
  return data;
}

async function listRecentPullRequests(
  client: GithubClient,
  owner: string,
  repo: string,
) {
  const { data } = await client.rest.pulls.list({
    owner,
    repo,
    state: "all",
    sort: "updated",
    direction: "desc",
    per_page: 30,
  });
  return data;
}

function isWithinLastWeek(dateString: string | null | undefined, since: Date) {
  if (!dateString) return false;
  return new Date(dateString).getTime() >= since.getTime();
}

function fallbackOverview(openPrs: PullRequestDigest["openPullRequests"]) {
  if (!openPrs.length) {
    return "There are no open pull requests right now. Use this view to monitor new review work as it appears.";
  }

  const highRisk = openPrs.filter((pr) => pr.riskLevel === "high").length;
  const mediumRisk = openPrs.filter((pr) => pr.riskLevel === "medium").length;

  return `There are ${openPrs.length} open pull requests. ${highRisk} are high risk and ${mediumRisk} are medium risk based on diff size and sensitive files. Start review with the largest or most security-sensitive changes first.`;
}

export async function buildPullRequestDigest(
  projectId: string,
  githubUrl: string,
  githubToken?: string,
): Promise<PullRequestDigest> {
  const { owner, repo, cleaned } = parseGithubUrl(githubUrl);
  const client = createGithubClient(githubToken);
  const generatedAt = new Date();
  const since = new Date(generatedAt.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [openPulls, recentPulls] = await Promise.all([
    listOpenPullRequests(client, owner, repo),
    listRecentPullRequests(client, owner, repo),
  ]);

  const openPullRequests = await Promise.all(
    openPulls.map(async (pull: GithubPull) => {
      const files = await listAllPullFiles(client, owner, repo, pull.number);
      const filenames = files.map((file) => file.filename);
      const additions = files.reduce((sum, file) => sum + (file.additions ?? 0), 0);
      const deletions = files.reduce((sum, file) => sum + (file.deletions ?? 0), 0);
      const risk = assessRisk(files, additions, deletions);
      const ai = await summarisePullRequest({
        title: pull.title,
        body: pull.body ?? "",
        additions,
        deletions,
        changedFiles: files.length,
        filenames: filenames.slice(0, 25),
      });

      return {
        number: pull.number,
        title: pull.title,
        author: pull.user?.login ?? "unknown",
        url: pull.html_url,
        isDraft: Boolean(pull.draft),
        state: "open" as const,
        createdAt: pull.created_at,
        updatedAt: pull.updated_at,
        additions,
        deletions,
        changedFiles: files.length,
        summary: ai.summary,
        reviewerFocus: ai.reviewerFocus,
        riskLevel: risk.riskLevel,
        riskAreas: risk.riskAreas,
        filenames,
      };
    }),
  );

  const changedSinceLastWeek = {
    opened: recentPulls.filter((pull) => isWithinLastWeek(pull.created_at, since)).length,
    merged: recentPulls.filter((pull) => isWithinLastWeek(pull.merged_at, since)).length,
    active: recentPulls.filter((pull) => isWithinLastWeek(pull.updated_at, since)).length,
    themes: [] as string[],
  };

  const overview = await summarisePullRequestDigestOverview({
    repo: cleaned,
    openPullRequests: openPullRequests.map((pr) => ({
      title: pr.title,
      author: pr.author,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
      riskAreas: pr.riskAreas,
    })),
    recentActivity: {
      opened: changedSinceLastWeek.opened,
      merged: changedSinceLastWeek.merged,
      active: changedSinceLastWeek.active,
    },
  });

  changedSinceLastWeek.themes = overview.themes;

  return {
    generatedAt: generatedAt.toISOString(),
    projectId,
    window: "rolling_7_days",
    executiveSummary: overview.executiveSummary || fallbackOverview(openPullRequests),
    riskHighlights: openPullRequests
      .filter((pr) => pr.riskLevel !== "low")
      .sort((a, b) => {
        const order = { high: 2, medium: 1, low: 0 };
        return order[b.riskLevel] - order[a.riskLevel];
      })
      .slice(0, 5)
      .map((pr) => ({
        prNumber: pr.number,
        title: pr.title,
        riskLevel: pr.riskLevel,
        reasons: pr.riskAreas,
      })),
    openPullRequests,
    changedSinceLastWeek,
  };
}
