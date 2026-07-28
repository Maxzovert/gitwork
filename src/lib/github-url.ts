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
