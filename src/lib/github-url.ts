export function parseGithubUrl(githubUrl: string) {
  const cleaned = githubUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const [owner, repo] = cleaned.split("/").slice(-2);
  if (!owner || !repo) {
    throw new Error("Invalid github url");
  }
  return { owner, repo, cleaned };
}

export function normalizeGithubRepoUrl(githubUrl: string) {
  const { cleaned } = parseGithubUrl(githubUrl);
  return cleaned.toLowerCase();
}

export function repoUrlsMatch(a: string, b: string) {
  try {
    return normalizeGithubRepoUrl(a) === normalizeGithubRepoUrl(b);
  } catch {
    return false;
  }
}

export function getAppUrl() {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

function encodePathSegments(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function githubBlobUrl(
  cleanedRepoUrl: string,
  branch: string,
  path: string,
) {
  const ref = encodeURIComponent(branch || "HEAD");
  const filePath = encodePathSegments(path);
  return `${cleanedRepoUrl}/blob/${ref}/${filePath}`;
}

export function githubCommitUrl(cleanedRepoUrl: string, sha: string) {
  return `${cleanedRepoUrl}/commit/${encodeURIComponent(sha)}`;
}

export function githubCompareUrl(
  cleanedRepoUrl: string,
  base: string,
  head: string,
) {
  return `${cleanedRepoUrl}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;
}

export function githubPullUrl(cleanedRepoUrl: string, number: number) {
  return `${cleanedRepoUrl}/pull/${number}`;
}

export function githubNewIssueUrl(
  cleanedRepoUrl: string,
  params?: { title?: string; body?: string },
) {
  const search = new URLSearchParams();
  if (params?.title) search.set("title", params.title);
  if (params?.body) search.set("body", params.body);
  const query = search.toString();
  return `${cleanedRepoUrl}/issues/new${query ? `?${query}` : ""}`;
}

export function branchFromPushRef(ref: string) {
  if (ref.startsWith("refs/heads/")) {
    return ref.slice("refs/heads/".length);
  }
  return null;
}
