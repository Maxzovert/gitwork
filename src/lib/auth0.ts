import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

import { readAppSessionFromCookies } from "@/lib/app-session";

/**
 * Auth0 App Router client (v4). Middleware mounts /auth/* routes.
 * Env: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET, APP_BASE_URL
 *
 * Hybrid auth:
 * - Google / email → Auth0 Universal Login
 * - GitHub → direct OAuth at /api/auth/github (not Auth0 social)
 */
export const auth0 = new Auth0Client({
  authorizationParameters: {
    scope: "openid profile email offline_access",
  },
  enableConnectAccountEndpoint: true,
  logoutStrategy: "v2",
  signInReturnToPath: "/sync-user",
  async onCallback(error, ctx) {
    if (error) {
      const params = new URLSearchParams({
        error: error.message || "auth_failed",
      });
      const base = ctx.appBaseUrl || process.env.APP_BASE_URL || "http://localhost:3000";
      const returnTo = ctx.returnTo || "";
      if (returnTo.includes("/create")) {
        params.set("github", "error");
        return NextResponse.redirect(
          `${base}/create?${params.toString()}`,
        );
      }
      return NextResponse.redirect(`${base}/sign-in?${params.toString()}`);
    }

    const returnTo = ctx.returnTo || "/sync-user";
    const base = ctx.appBaseUrl || process.env.APP_BASE_URL || "http://localhost:3000";
    return NextResponse.redirect(new URL(returnTo, base));
  },
});

export type SessionUser = {
  userId: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  /** True for GitHub-native app session, or Auth0 sub starting with github|. */
  signedInWithGithub: boolean;
};

export function userSignedInWithGithub(sub: string | undefined | null) {
  return typeof sub === "string" && sub.startsWith("github|");
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const session = await auth0.getSession();
    const sub = session?.user?.sub;
    if (sub) {
      return {
        userId: sub,
        email: (session.user.email as string | undefined) ?? null,
        name: (session.user.name as string | undefined) ?? null,
        picture: (session.user.picture as string | undefined) ?? null,
        given_name: (session.user.given_name as string | undefined) ?? null,
        family_name: (session.user.family_name as string | undefined) ?? null,
        signedInWithGithub: userSignedInWithGithub(sub),
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
  };
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("User not authenticated");
  }
  return user;
}
