import { NextRequest, NextResponse } from "next/server";

import { ingestPushCommits } from "@/lib/github";
import {
  findProjectForPush,
  verifyGithubWebhookSignature,
  type GithubPushPayload,
} from "@/lib/github-webhook";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const event = req.headers.get("x-github-event");

  if (event === "ping") {
    return NextResponse.json({ ok: true, message: "pong" });
  }

  if (event !== "push") {
    return NextResponse.json({ ok: true, message: "ignored" });
  }

  let body: GithubPushPayload;
  try {
    body = JSON.parse(payload) as GithubPushPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const project = await findProjectForPush(body);
  if (!project?.webhookSecret) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (
    !verifyGithubWebhookSignature(payload, signature, project.webhookSecret)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!body.commits?.length) {
    return NextResponse.json({ ok: true, ingested: 0 });
  }

  try {
    const result = await ingestPushCommits(project.id, body.commits);
    return NextResponse.json({
      ok: true,
      ingested: result.count ?? body.commits.length,
    });
  } catch (error) {
    console.error("GitHub webhook ingest failed:", error);
    return NextResponse.json(
      { error: "Failed to ingest commits" },
      { status: 500 },
    );
  }
}
