import { db } from "@/server/db";
import { auth, clerkClient } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";

export async function ensureDbUser(options?: { refreshProfile?: boolean }) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  try {
    const existing = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (existing && !options?.refreshProfile) {
      return userId;
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) {
      throw new Error("User has no email address");
    }

    try {
      await db.user.upsert({
        where: { id: userId },
        update: {
          emailAdress: email,
          imageUrl: user.imageUrl,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        create: {
          id: userId,
          emailAdress: email,
          imageUrl: user.imageUrl,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      // Same email, different Clerk user id (e.g. switched Clerk instance).
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
            "ensureDbUser: email already linked to another Clerk user id",
            {
              level: "error",
              extra: { clerkUserId: userId, existingUserId: byEmail.id },
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
