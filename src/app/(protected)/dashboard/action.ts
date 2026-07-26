"use server";
import { streamText } from "ai";
import { createStreamableValue } from "@ai-sdk/rsc";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateEmbeddings } from "@/lib/gemini";
import { backfillNullEmbeddings } from "@/lib/github-loader";
import { db } from "@/server/db";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

type SourceMatch = {
  filename: string;
  sourcecode: string;
  summary: string;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "as",
  "by",
  "at",
  "from",
  "or",
  "and",
  "how",
  "what",
  "where",
  "when",
  "why",
  "which",
  "who",
  "does",
  "do",
  "did",
  "can",
  "could",
  "should",
  "would",
  "will",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "my",
  "me",
  "we",
  "you",
  "your",
  "our",
  "please",
  "tell",
  "about",
  "working",
  "work",
  "works",
  "functionality",
  "code",
  "file",
  "files",
  "show",
  "find",
  "explain",
]);

/** Pull searchable tokens like "csv", "export" out of the user question. */
function extractSearchTerms(question: string): string[] {
  const tokens = question
    .toLowerCase()
    .replace(/[^a-z0-9_./+\-]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  // Prefer distinctive terms first (csv, export, lead, …)
  const unique = [...new Set(tokens)];
  return unique.slice(0, 6);
}

function mergeUnique(primary: SourceMatch[], secondary: SourceMatch[], limit = 10) {
  const seen = new Set<string>();
  const out: SourceMatch[] = [];
  for (const row of [...primary, ...secondary]) {
    if (seen.has(row.filename)) continue;
    seen.add(row.filename);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

async function searchByKeywords(projectId: string, terms: string[]) {
  if (!terms.length) return [] as SourceMatch[];

  const rows: SourceMatch[] = [];
  for (const term of terms) {
    const pattern = `%${term}%`;
    const hits = (await db.$queryRawUnsafe(
      `
      SELECT "filename", "sourcecode", "summary"
      FROM "SourceCodeEmbeddings"
      WHERE "projectId" = $1
        AND (
          "filename" ILIKE $2
          OR "sourcecode" ILIKE $2
          OR "summary" ILIKE $2
        )
      LIMIT 10
      `,
      projectId,
      pattern,
    )) as SourceMatch[];
    rows.push(...hits);
  }
  return mergeUnique(rows, [], 10);
}

async function searchByVector(projectId: string, vectorQuery: string) {
  return (await db.$queryRawUnsafe(
    `
    SELECT "filename", "sourcecode", "summary"
    FROM "SourceCodeEmbeddings"
    WHERE "projectId" = $1
      AND "summaryEmbeddings" IS NOT NULL
    ORDER BY "summaryEmbeddings" <=> $2::vector
    LIMIT 10
    `,
    projectId,
    vectorQuery,
  )) as SourceMatch[];
}

/** Keyword hits first (exact symbols like csv/export), then vector neighbors. */
async function searchSimilarFiles(
  projectId: string,
  question: string,
  vectorQuery: string,
) {
  const terms = extractSearchTerms(question);
  const [keywordHits, vectorHits] = await Promise.all([
    searchByKeywords(projectId, terms),
    searchByVector(projectId, vectorQuery),
  ]);

  console.log(
    `askQuestion search terms=${JSON.stringify(terms)} keywordHits=${keywordHits.length} vectorHits=${vectorHits.length}`,
  );

  return mergeUnique(keywordHits, vectorHits, 10);
}

export async function askQuestion(question: string, projectId: string) {
  const stream = createStreamableValue<string>("");

  const queryVector = await generateEmbeddings(question);
  const vectorQuery = `[${queryVector.join(",")}]`;

  let result = await searchSimilarFiles(projectId, question, vectorQuery);

  // Existing rows often have NULL vectors from the broken write path — repair once
  if (!result.length) {
    const filled = await backfillNullEmbeddings(projectId);
    if (filled > 0) {
      result = await searchSimilarFiles(projectId, question, vectorQuery);
    }
  }

  let context = "";
  for (const doc of result) {
    context += `source: ${doc.filename}\ncode content: ${doc.sourcecode}\nsummary of file: ${doc.summary}\n\n`;
  }

  if (!context.trim()) {
    console.warn(
      `askQuestion: no embeddings found for project ${projectId}. Re-index the repo.`,
    );
  }

  (async () => {
    const { textStream } = streamText({
      model: google("gemini-3.1-flash-lite-preview"),
      prompt: `You are a ai code assistant who answers questions about the codebase. Your target audience is a technical intern who is looking to understand the codebase.
AI assistant is a brand new, powerful, human-like artificial intelligence.
The traits of AI include expert knowledge, helpfulness, cleverness, and articulateness.
AI is a well-behaved and well-mannered individual.
AI is always friendly, kind, and inspiring, and he is eager to provide vivid and thoughtful responses to the user.
AI has the sum of all knowledge in their brain, and is able to accurately answer nearly any question about any topic in conversation.
If the question is asking about code or a specific file, AI will provide the detailed answer, giving step by step instructions.
START CONTEXT BLOCK
${context}
END OF CONTEXT BLOCK

START QUESTION
${question}
END OF QUESTION
AI assistant will take into account any CONTEXT BLOCK that is provided in a conversation.
If the context does not provide the answer to question, the AI assistant will say, "I'm sorry, but I don't know the answer to that question".
AI assistant will not apologize for previous responses, but instead will indicated new information was gained.
AI assistant will not invent anything that is not drawn directly from the context.
`,
    });

    for await (const delta of textStream) {
      stream.update(delta);
    }

    stream.done();
  })().catch((error) => {
    console.error("askQuestion stream failed:", error);
    stream.error(error);
  });

  return {
    output: stream.value,
    fileReferences: result,
  };
}
