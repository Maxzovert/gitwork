import { db } from "@/server/db";
import { getSessionUser, type SessionUser } from "@/lib/auth0";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";

function splitName(user: SessionUser) {
  const given = user.given_name?.trim() || null;
  const family = user.family_name?.trim() || null;
  if (given || family) {
    return { firstName: given, lastName: family };
  }
  const parts = (user.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: null, lastName: null };
  }
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

export async function ensureDbUser(options?: { refreshProfile?: boolean }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    throw new Error("User not authenticated");
  }

  const { userId } = sessionUser;

  try {
    const existing = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (existing && !options?.refreshProfile) {
      return userId;
    }

    const email = sessionUser.email?.trim();
    if (!email) {
      throw new Error("User has no email address");
    }

    const { firstName, lastName } = splitName(sessionUser);

    try {
      await db.user.upsert({
        where: { id: userId },
        update: {
          emailAdress: email,
          imageUrl: sessionUser.picture,
          firstName,
          lastName,
        },
        create: {
          id: userId,
          emailAdress: email,
          imageUrl: sessionUser.picture,
          firstName,
          lastName,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const byEmail = await db.user.findUnique({
          where: { emailAdress: email },
          select: { id: true },
        });
        if (byEmail && byEmail.id !== userId) {
          Sentry.captureMessage(
            "ensureDbUser: email already linked to another Auth0 user id",
            {
              level: "error",
              extra: { auth0UserId: userId, existingUserId: byEmail.id },
            },
          );
          throw new Error(
            "This email is already linked to another account. Sign in with the original identity or contact support.",
          );
        }
      }
      throw error;
    }

    return userId;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { scope: "ensureDbUser" },
      extra: { userId, refreshProfile: options?.refreshProfile ?? false },
    });
    throw error;
  }
}
