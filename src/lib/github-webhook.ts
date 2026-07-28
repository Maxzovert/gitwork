import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Octokit } from "octokit";

import { db } from "@/server/db";
import { getAppUrl, parseGithubUrl, repoUrlsMatch } from "@/lib/github-url";
import { octokit } from "@/lib/github";

function createWebhookSecret() {
  return randomBytes(32).toString("hex");
}

function getOctokit(githubToken?: string) {
  if (githubToken) {
    return new Octokit({ auth: githubToken });
  }
  return octokit;
}

export function verifyGithubWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string,
) {
  if (!signature?.startsWith("sha256=")) {
    return false;
  }

  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  const expected = `sha256=${digest}`;
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, expectedBuffer);
}

export async function registerProjectWebhook(
  projectId: string,
  githubToken?: string,
) {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      githubUrl: true,
      webhookSecret: true,
      githubWebhookId: true,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.githubWebhookId) {
    return { ok: true as const, alreadyRegistered: true };
  }

  const { owner, repo } = parseGithubUrl(project.githubUrl);
  const client = getOctokit(githubToken);
  const webhookSecret = project.webhookSecret ?? createWebhookSecret();
  const webhookUrl = `${getAppUrl()}/api/webhooks/github`;

  const { data: hook } = await client.rest.repos.createWebhook({
    owner,
    repo,
    config: {
      url: webhookUrl,
      content_type: "json",
      secret: webhookSecret,
      insecure_ssl: process.env.NODE_ENV === "development" ? "1" : "0",
    },
    events: ["push"],
    active: true,
  });

  await db.project.update({
    where: { id: projectId },
    data: {
      webhookSecret,
      githubWebhookId: hook.id,
    },
  });

  return { ok: true as const, alreadyRegistered: false, hookId: hook.id };
}

export async function deleteProjectWebhook(
  projectId: string,
  githubToken?: string,
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      githubUrl: true,
      githubWebhookId: true,
    },
  });

  if (!project?.githubWebhookId) {
    return;
  }

  try {
    const { owner, repo } = parseGithubUrl(project.githubUrl);
    const client = getOctokit(githubToken);
    await client.rest.repos.deleteWebhook({
      owner,
      repo,
      hook_id: project.githubWebhookId,
    });
  } catch (error) {
    console.error(`Failed to delete GitHub webhook for project ${projectId}:`, error);
  }

  await db.project.update({
    where: { id: projectId },
    data: {
      githubWebhookId: null,
      webhookSecret: null,
    },
  });
}

export async function ensureProjectWebhook(
  projectId: string,
  githubToken?: string,
) {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { githubWebhookId: true },
  });

  if (!project || project.githubWebhookId) {
    return;
  }

  await registerProjectWebhook(projectId, githubToken);
}

export type GithubPushCommit = {
  id: string;
  message: string;
  timestamp: string;
  author: {
    name: string;
    email?: string;
    username?: string;
  };
};

export type GithubPushPayload = {
  ref: string;
  repository: {
    html_url: string;
    full_name: string;
    default_branch?: string;
  };
  commits: GithubPushCommit[];
};

export async function findProjectForPush(payload: GithubPushPayload) {
  const projects = await db.project.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      githubUrl: true,
      webhookSecret: true,
    },
  });

  return (
    projects.find(
      (project) =>
        repoUrlsMatch(project.githubUrl, payload.repository.html_url) ||
        project.githubUrl
          .toLowerCase()
          .includes(payload.repository.full_name.toLowerCase()),
    ) ?? null
  );
}
