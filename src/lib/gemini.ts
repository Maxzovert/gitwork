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
        `You are an expert programmer, and you are trying to summarize a git diff.
Reminders about the git diff format:
For every file, there are a few metadata lines, like (for example):
\`\`\`
diff --git a/lib/index.js b/lib/index.js
index aadf691..bfef603 100644
--- a/lib/index.js
+++ b/lib/index.js
\`\`\`
This means that \`lib/index.js\` was modified in this commit. Note that this is only an example.

Then there is a specifier of the lines that were modified.
A line starting with \`+\` means it was added.
A line that starting with \`-\` means that line was deleted.
A line that starts with neither \`+\` nor \`-\` is code given for context and better understanding.
It is not part of the diff.

[...]
EXAMPLE SUMMARY COMMENTS:
\`\`\`
* Raised the amount of returned recordings from \`10\` to \`100\` [packages/server/recordings_api.ts], [packages/server/constants.ts]
* Fixed a typo in the github action name [.github/workflows/gpt-commit-summarizer.yml]
* Moved the \`octokit\` initialization to a separate file [src/octokit.ts], [src/index.ts]
* Added an OpenAI API for completions [packages/utils/apis/openai.ts]
* Lowered numeric tolerance for test files
\`\`\`

Most commits will have less comments than this examples list.
The last comment does not include the file names,
because there were more than two relevant files in the hypothetical commit.

Do not include parts of the example in your summary.
It is given only as an example of appropriate comments.

Please summarise the following diff file:

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
