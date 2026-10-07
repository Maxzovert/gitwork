"use server";

import { getSessionUser } from "@/lib/auth0";
import { ensureDbUser } from "@/lib/ensure-user";
import { ensureGithubConnectionToken } from "@/lib/github-auth";
import { db } from "@/server/db";

export async function completeUserSync() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.userId) {
    return "/sign-in";
  }

  const userId = sessionUser.userId;

  // Fast path: upsert without blocking on a full profile refresh.
  await ensureDbUser();

  if (sessionUser.signedInWithGithub) {
    await ensureGithubConnectionToken(userId);
  }

  const projectCount = await db.userToProject.count({
    where: {
      userId,
      project: { deletedAt: null },
    },
  });

  return projectCount > 0 ? "/projects" : "/create";
}
