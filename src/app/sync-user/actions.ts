"use server";

import { auth } from "@clerk/nextjs/server";

import { ensureDbUser } from "@/lib/ensure-user";
import { db } from "@/server/db";

export async function completeUserSync() {
  const { userId } = await auth();
  if (!userId) {
    return "/sign-in";
  }

  await ensureDbUser({ refreshProfile: true });

  const projectCount = await db.userToProject.count({
    where: {
      userId,
      project: { deletedAt: null },
    },
  });

  return projectCount > 0 ? "/dashboard" : "/create";
}
