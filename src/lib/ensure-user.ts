import { Prisma } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";

import { getSessionUser, type SessionUser } from "@/lib/auth0";
import { db } from "@/server/db";

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

  // Prefer raw Auth0 sub for linking; fall back to resolved userId.
  const auth0Sub = sessionUser.auth0Sub ?? null;
  const sessionKey = auth0Sub ?? sessionUser.userId;

  try {
    // Already linked: id matches session, or auth0Sub column matches.
    const existing = await db.user.findFirst({
      where: {
        OR: [
          { id: sessionUser.userId },
          ...(auth0Sub
            ? [{ auth0Sub }, { id: auth0Sub }]
            : [{ id: sessionKey }]),
        ],
      },
      select: { id: true, auth0Sub: true },
    });

    if (existing && !options?.refreshProfile) {
      if (auth0Sub && existing.auth0Sub !== auth0Sub) {
        await db.user.update({
          where: { id: existing.id },
          data: { auth0Sub },
        });
      }
      return existing.id;
    }

    const email = sessionUser.email?.trim();
    if (!email) {
      throw new Error(
        "Your Google account did not share an email. Allow email access and try again.",
      );
    }

    const { firstName, lastName } = splitName(sessionUser);
    const profile = {
      emailAdress: email,
      imageUrl: sessionUser.picture,
      firstName,
      lastName,
    };

    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          ...profile,
          ...(auth0Sub ? { auth0Sub } : {}),
        },
      });
      return existing.id;
    }

    // Same email already used (often after GitHub login) — link Auth0 to that row.
    const byEmail = await db.user.findUnique({
      where: { emailAdress: email },
      select: { id: true, auth0Sub: true },
    });

    if (byEmail) {
      if (
        byEmail.auth0Sub &&
        auth0Sub &&
        byEmail.auth0Sub !== auth0Sub &&
        byEmail.id !== auth0Sub
      ) {
        throw new Error(
          "This email is already linked to another account. Sign in with GitHub or the original method.",
        );
      }
      await db.user.update({
        where: { id: byEmail.id },
        data: {
          ...profile,
          ...(auth0Sub ? { auth0Sub } : {}),
        },
      });
      return byEmail.id;
    }

    const createId = auth0Sub ?? sessionUser.userId;

    try {
      await db.user.create({
        data: {
          id: createId,
          ...profile,
          ...(auth0Sub ? { auth0Sub } : {}),
        },
      });
      return createId;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const again = await db.user.findUnique({
          where: { emailAdress: email },
          select: { id: true },
        });
        if (again) {
          await db.user.update({
            where: { id: again.id },
            data: {
              ...profile,
              ...(auth0Sub ? { auth0Sub } : {}),
            },
          });
          return again.id;
        }
      }
      throw error;
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { scope: "ensureDbUser" },
      extra: {
        sessionKey,
        auth0Sub,
        refreshProfile: options?.refreshProfile ?? false,
      },
    });
    throw error;
  }
}
