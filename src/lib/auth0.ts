import { readAppSessionFromCookies } from "@/lib/app-session";
import { auth0 } from "@/lib/auth0-client";
import { db } from "@/server/db";

export { auth0 };

export type SessionUser = {
  userId: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  /** True for GitHub-native app session, or Auth0 sub starting with github|. */
  signedInWithGithub: boolean;
  /** Raw Auth0 `sub` when signed in via Auth0 (before/after DB linking). */
  auth0Sub?: string | null;
};

export function userSignedInWithGithub(sub: string | undefined | null) {
  return typeof sub === "string" && sub.startsWith("github|");
}

/**
 * Map Auth0 `sub` to Prisma User.id (may differ after linking Google to a
 * GitHub-created account via `auth0Sub`).
 */
async function resolveAuth0DbUserId(sub: string): Promise<string> {
  try {
    const row = await db.user.findFirst({
      where: { OR: [{ id: sub }, { auth0Sub: sub }] },
      select: { id: true },
    });
    return row?.id ?? sub;
  } catch {
    return sub;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const session = await auth0.getSession();
    const sub = session?.user?.sub;
    if (sub) {
      const userId = await resolveAuth0DbUserId(sub);
      return {
        userId,
        email: (session.user.email as string | undefined) ?? null,
        name: (session.user.name as string | undefined) ?? null,
        picture: (session.user.picture as string | undefined) ?? null,
        given_name: (session.user.given_name as string | undefined) ?? null,
        family_name: (session.user.family_name as string | undefined) ?? null,
        signedInWithGithub: userSignedInWithGithub(sub),
        auth0Sub: sub,
      };
    }
  } catch {
    // Fall through to app session.
  }

  const app = await readAppSessionFromCookies();
  if (!app) return null;

  return {
    userId: app.userId,
    email: app.email,
    name: app.name,
    picture: app.picture,
    given_name: null,
    family_name: null,
    signedInWithGithub: app.signedInWithGithub,
    auth0Sub: null,
  };
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("User not authenticated");
  }
  return user;
}
