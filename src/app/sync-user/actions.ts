"use server";

import { getSessionUser } from "@/lib/auth0";
import { ensureDbUser } from "@/lib/ensure-user";
import { ensureGithubConnectionToken } from "@/lib/github-auth";
import { db } from "@/server/db";

export type SyncUserResult = {
  redirect: string;
  error?: string;
};

export async function completeUserSync(): Promise<SyncUserResult> {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.userId) {
      return { redirect: "/sign-in", error: "Not signed in" };
    }

    const userId = await ensureDbUser();

    if (sessionUser.signedInWithGithub) {
      await ensureGithubConnectionToken(userId);
    }

    const projectCount = await db.userToProject.count({
      where: {
        userId,
        project: { deletedAt: null },
      },
    });

    return {
      redirect: projectCount > 0 ? "/projects" : "/create",
    };
  } catch (error) {
    console.error("[completeUserSync]", error);
    const message =
      error instanceof Error ? error.message : "Failed to sync your account";
    return { redirect: "/sign-in", error: message };
  }
}
