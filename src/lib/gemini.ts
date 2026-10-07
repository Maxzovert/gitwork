import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";
import { Document } from "@langchain/core/documents";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Free-tier friendly model (gemini-2.5-flash-lite is closed to new users)
const model = genAI.getGenerativeModel({
  model: "gemini-3.1-flash-lite",
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isDailyQuota =
        message.includes("PerDay") ||
        message.includes("GenerateRequestsPerDay");
      const isModelGone =
        message.includes("404") ||
        message.toLowerCase().includes("no longer available");
      const isRateLimit =
        message.includes("429") ||
        message.toLowerCase().includes("quota") ||
        message.toLowerCase().includes("rate");

      // Daily quota / retired models won't recover with retries — fail fast
      if (
        isDailyQuota ||
        isModelGone ||
        !isRateLimit ||
        attempt === retries - 1
      ) {
        throw error;
      }

      const retryMatch = message.match(/retry in ([\d.]+)s/i);
      const waitMs = retryMatch?.[1]
        ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 500
        : Math.min(30_000, 2000 * 2 ** attempt);

      console.warn(
        `Gemini rate limited, retrying in ${Math.ceil(waitMs / 1000)}s (attempt ${attempt + 1}/${retries})`,
      );
      await sleep(waitMs);
    }
  }
  throw lastError;
}

export const aiSummariesCommits = async (diff: string) => {
  try {
    const response = await withRetry(() =>
      model.generateContent([
        `Summarize this git diff for a busy engineer scanning a timeline.

Rules:
- Write 1–3 short plain-language bullets (max ~14 words each).
- Focus on what changed and why it matters — not every file touched.
- Prefer product/behavior language over implementation detail.
- Optional: append at most 2 key file basenames in brackets, e.g. [auth.ts].
- No intro, no markdown headings, no code fences, no commit hashes.
- Do not copy the commit message; describe the actual diff.

Good:
* Raised recording page size from 10 to 100 [recordings_api.ts]
* Fixed GitHub Action workflow name typo
* Moved Octokit client into its own module [octokit.ts]

Diff:
\`\`\`diff
${diff}
\`\`\`
`,
      ]),
    );

    return response.response.text();
  } catch (error) {
    console.error("Failed to summarise commit:", error);
    return "Summary unavailable (Gemini quota exceeded)";
  }
};

type PullRequestSummaryInput = {
  title: string;
  body: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  filenames: string[];
};

type PullRequestSummaryResult = {
  summary: string;
  reviewerFocus: string[];
};

type PullRequestDigestOverviewInput = {
  repo: string;
  openPullRequests: Array<{
    title: string;
    author: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    riskAreas: string[];
  }>;
  recentActivity: {
    opened: number;
    merged: number;
    active: number;
  };
};

type PullRequestDigestOverviewResult = {
  executiveSummary: string;
  themes: string[];
};

function parseJsonObject<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const json = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export async function summarisePullRequest(
  input: PullRequestSummaryInput,
): Promise<PullRequestSummaryResult> {
  try {
    const response = await withRetry(() =>
      model.generateContent([
        `You are reviewing a GitHub pull request.
Return valid JSON with this exact shape:
{
  "summary": "2-4 sentence summary",
  "reviewerFocus": ["short checklist item", "short checklist item"]
}

Keep reviewerFocus to 2-4 concise bullets.
Focus on reviewer attention points, not generic praise.

Pull request:
Title: ${input.title}
Body: ${input.body || "(empty)"}
Additions: ${input.additions}
Deletions: ${input.deletions}
Changed files: ${input.changedFiles}
Files:
${input.filenames.map((name) => `- ${name}`).join("\n")}
`,
      ]),
    );

    const parsed = parseJsonObject<PullRequestSummaryResult>(
      response.response.text(),
    );
    if (parsed?.summary) {
      return {
        summary: parsed.summary,
        reviewerFocus: Array.isArray(parsed.reviewerFocus)
          ? parsed.reviewerFocus.slice(0, 4)
          : [],
      };
    }
  } catch (error) {
    console.error("Failed to summarise PR:", error);
  }

  return {
    summary:
      "Summary unavailable right now. Review the changed files and PR description directly on GitHub.",
    reviewerFocus: [],
  };
}

export async function summarisePullRequestDigestOverview(
  input: PullRequestDigestOverviewInput,
): Promise<PullRequestDigestOverviewResult> {
  try {
    const response = await withRetry(() =>
      model.generateContent([
        `You are generating a weekly engineering digest for a repository.
Return valid JSON with this exact shape:
{
  "executiveSummary": "3-5 sentence summary",
  "themes": ["short theme", "short theme", "short theme"]
}

Be concrete and prioritize risk, review load, and major themes.

Repository: ${input.repo}
Recent activity: opened=${input.recentActivity.opened}, merged=${input.recentActivity.merged}, active=${input.recentActivity.active}

Open PRs:
${input.openPullRequests
  .map(
    (pr) =>
      `- ${pr.title} by ${pr.author} (+${pr.additions}/-${pr.deletions}, ${pr.changedFiles} files, risks: ${pr.riskAreas.join(", ") || "none"})`,
  )
  .join("\n")}
`,
      ]),
    );

    const parsed = parseJsonObject<PullRequestDigestOverviewResult>(
      response.response.text(),
    );
    if (parsed?.executiveSummary) {
      return {
        executiveSummary: parsed.executiveSummary,
        themes: Array.isArray(parsed.themes) ? parsed.themes.slice(0, 5) : [],
      };
    }
  } catch (error) {
    console.error("Failed to summarise PR digest overview:", error);
  }

  return {
    executiveSummary:
      "This digest is available, but the AI overview could not be generated right now.",
    themes: [],
  };
}

export type ProjectOverviewInput = {
  repo: string;
  hasReadme: boolean;
  hasContributing: boolean;
  readme?: { path: string; content: string };
  contributing?: { path: string; content: string };
  setupFile?: { path: string; content: string };
  folders: Array<{
    name: string;
    files: Array<{ filename: string; summary: string }>;
  }>;
  recentCommits: string[];
  allowedFiles: string[];
};

export type ProjectOverviewResult = {
  whatItIs: string;
  howToRun: string;
  folders: Array<{ name: string; blurb: string; files: string[] }>;
  howToContribute: string;
  startHere: Array<{ filename: string; why: string }>;
  source: "docs" | "analysis" | "mixed";
};

export async function generateProjectOverview(
  input: ProjectOverviewInput,
): Promise<ProjectOverviewResult> {
  const fallback: ProjectOverviewResult = {
    whatItIs: "This repository is a software project. Open the cited files to see how it is structured.",
    howToRun:
      "Look at the README or package/setup file for install and start commands. If those are missing, ask a teammate how they run it locally.",
    folders: input.folders.slice(0, 8).map((folder) => ({
      name: folder.name,
      blurb: `Files under ${folder.name}/ that make up part of the project.`,
      files: folder.files.map((file) => file.filename).slice(0, 3),
    })),
    howToContribute:
      input.hasContributing
        ? "Follow the contributing guide in the repository. Keep changes small and explain them clearly."
        : "Open a small issue or pull request. Keep the change focused, write a short description, and ask for review.",
    startHere: input.folders
      .flatMap((folder) => folder.files)
      .slice(0, 5)
      .map((file) => ({
        filename: file.filename,
        why: file.summary.slice(0, 140) || "A good file to open first.",
      })),
    source: input.hasReadme ? "mixed" : "analysis",
  };

  const allowed = input.allowedFiles.join("\n");

  try {
    const response = await withRetry(() =>
      model.generateContent([
        `You explain a codebase to a beginner intern.
Write short, easy English. 2-5 sentences per text field. If you use a technical word, add a one-line explanation.
Return valid JSON with this exact shape:
{
  "whatItIs": "what the project does",
  "howToRun": "how to install and start it",
  "folders": [{ "name": "folder", "blurb": "what this folder is for", "files": ["path/from/allowed/list"] }],
  "howToContribute": "how a beginner can help",
  "startHere": [{ "filename": "path/from/allowed/list", "why": "why open this first" }],
  "source": "docs" | "analysis" | "mixed"
}

Rules:
- source is "docs" if README/CONTRIBUTING were enough, "analysis" if you mostly used code summaries, "mixed" if both.
- files and filename MUST be copied exactly from the allowed file list. Never invent paths.
- folders should use real top-level names from the context.
- startHere: 3-5 files.
- Do not dump the README. Rewrite it simply.

Repository: ${input.repo}
Allowed files:
${allowed}

README (${input.readme?.path ?? "none"}):
${input.readme?.content || "(missing)"}

CONTRIBUTING (${input.contributing?.path ?? "none"}):
${input.contributing?.content || "(missing)"}

Setup file (${input.setupFile?.path ?? "none"}):
${input.setupFile?.content || "(missing)"}

Folder sketch:
${input.folders
  .map(
    (folder) =>
      `- ${folder.name}\n${folder.files.map((file) => `  - ${file.filename}: ${file.summary}`).join("\n")}`,
  )
  .join("\n")}

Recent commits:
${input.recentCommits.map((line) => `- ${line}`).join("\n") || "(none)"}
`,
      ]),
    );

    const parsed = parseJsonObject<ProjectOverviewResult>(response.response.text());
    if (!parsed?.whatItIs) return fallback;

    const allowedSet = new Set(input.allowedFiles);
    const folders = Array.isArray(parsed.folders)
      ? parsed.folders.slice(0, 10).map((folder) => ({
          name: String(folder.name || "src"),
          blurb: String(folder.blurb || ""),
          files: (folder.files ?? []).filter((file) => allowedSet.has(file)).slice(0, 4),
        }))
      : fallback.folders;

    const startHere = Array.isArray(parsed.startHere)
      ? parsed.startHere
          .filter((item) => allowedSet.has(item.filename))
          .slice(0, 5)
          .map((item) => ({
            filename: item.filename,
            why: String(item.why || ""),
          }))
      : fallback.startHere;

    const source =
      parsed.source === "docs" || parsed.source === "analysis" || parsed.source === "mixed"
        ? parsed.source
        : fallback.source;

    return {
      whatItIs: String(parsed.whatItIs),
      howToRun: String(parsed.howToRun || fallback.howToRun),
      folders: folders.filter((folder) => folder.files.length || folder.blurb),
      howToContribute: String(parsed.howToContribute || fallback.howToContribute),
      startHere: startHere.length ? startHere : fallback.startHere,
      source,
    };
  } catch (error) {
    console.error("Failed to generate project overview:", error);
    return fallback;
  }
}

export async function summariseCode(doc: Document) {
  console.log("getting summary for", doc.metadata.source);
  const code = doc.pageContent.slice(0, 10000);

  try {
    const response = await withRetry(() =>
      model.generateContent([
        `You are an intelligent senior softwere engineer who speacialises in onboarding junior softwere developers onto projects.
    You are onboarding a junior softwere engineer and explaining to them the purpose of the ${doc.metadata.source}.file
    Here is the
    ---
    ${code}
    ---
    Give a summary of no more than 100 words of the code above`,
      ]),
    );

    return response.response.text();
  } catch (error) {
    console.error(`Failed to summarise ${doc.metadata.source}:`, error);
    return `File ${doc.metadata.source}: ${code.slice(0, 200)}`;
  }
}

const EMBEDDING_DIMS = 768;

/** Truncate + L2-normalize — required when using gemini-embedding-001 below 3072 dims. */
function truncateAndNormalize(values: number[], dims = EMBEDDING_DIMS) {
  const truncated = values.slice(0, dims);
  const norm = Math.sqrt(truncated.reduce((sum, v) => sum + v * v, 0));
  if (!norm) return truncated;
  return truncated.map((v) => v / norm);
}

export async function generateEmbeddings(summary: string) {
  const embeddingModel = genAI.getGenerativeModel({
    model: "gemini-embedding-001",
  });
  const result = await withRetry(() => embeddingModel.embedContent(summary));
  // Default output is 3072; schema column is vector(768)
  return truncateAndNormalize(result.embedding.values);
}

export async function summariseChangelog(input: {
  repo: string;
  base: string;
  head: string;
  commits: Array<{ sha: string; message: string; author: string }>;
  pulls: Array<{ number: number; title: string }>;
}): Promise<string> {
  try {
    const response = await withRetry(() =>
      model.generateContent([
        `You write GitHub release notes in markdown.
Return ONLY markdown (no JSON, no code fences).
Use sections like ## Highlights, ## Changes, ## Fixes when useful.
Be concrete; do not invent features not implied by commits/PRs.
Keep it concise (under ~400 words).

Repository: ${input.repo}
Range: ${input.base}...${input.head}

Merged / referenced PRs:
${input.pulls.map((pr) => `- #${pr.number} ${pr.title}`).join("\n") || "(none detected)"}

Commits:
${input.commits.map((c) => `- ${c.sha} ${c.message} (${c.author})`).join("\n")}
`,
      ]),
    );

    const text = response.response.text().trim();
    if (text) return text;
  } catch (error) {
    console.error("Failed to summarise changelog:", error);
  }

  const fallbackLines = [
    `## Changes`,
    "",
    `Changes between \`${input.base}\` and \`${input.head}\`.`,
    "",
  ];

  for (const pr of input.pulls.slice(0, 20)) {
    fallbackLines.push(`- #${pr.number} ${pr.title}`);
  }

  if (!input.pulls.length) {
    for (const commit of input.commits.slice(-20)) {
      fallbackLines.push(`- ${commit.message} (${commit.sha})`);
    }
  }

  return fallbackLines.join("\n");
}
