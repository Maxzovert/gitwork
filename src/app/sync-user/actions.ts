"use server";

import { auth } from "@clerk/nextjs/server";

import { ensureDbUser } from "@/lib/ensure-user";
import { db } from "@/server/db";

export async function completeUserSync() {
  const { userId } = await auth();
  if (!userId) {
    return "/sign-in";
  }

  // Fast path: upsert without blocking on a full Clerk profile refresh.
  await ensureDbUser();

  const projectCount = await db.userToProject.count({
    where: {
      userId,
      project: { deletedAt: null },
    },
  });

  return projectCount > 0 ? "/dashboard" : "/create";
}
