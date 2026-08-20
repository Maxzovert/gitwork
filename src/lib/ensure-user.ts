import { db } from "@/server/db";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function ensureDbUser(options?: { refreshProfile?: boolean }) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }

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

  return userId;
}
