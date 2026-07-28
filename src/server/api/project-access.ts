import { TRPCError } from "@trpc/server";
import type { ProjectRole } from "@prisma/client";
import type { db as Db } from "@/server/db";

type DbClient = typeof Db;

export async function requireProjectMember(
  db: DbClient,
  projectId: string,
  userId: string,
) {
  const membership = await db.userToProject.findFirst({
    where: {
      projectId,
      userId,
      project: { deletedAt: null },
    },
    include: {
      project: true,
    },
  });

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this project",
    });
  }

  return membership;
}

export async function requireProjectOwner(
  db: DbClient,
  projectId: string,
  userId: string,
) {
  const membership = await requireProjectMember(db, projectId, userId);

  if (membership.role !== "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only project owners can do this",
    });
  }

  return membership;
}

export function isActiveInvite(invite: {
  revokedAt: Date | null;
  expiresAt: Date | null;
}) {
  if (invite.revokedAt) return false;
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return false;
  return true;
}

export async function countOwners(
  db: DbClient,
  projectId: string,
): Promise<number> {
  return db.userToProject.count({
    where: { projectId, role: "OWNER" },
  });
}

export type MembershipRole = ProjectRole;
