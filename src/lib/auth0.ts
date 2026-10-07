import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

/**
 * Auth0 App Router client (v4). Middleware mounts /auth/* routes.
 * Env: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET, APP_BASE_URL
 *
 * GitHub social login requires:
 * - Auth0 → Authentication → Social → GitHub enabled for this app
 * - GitHub OAuth App "Authorization callback URL" =
 *     https://YOUR_AUTH0_DOMAIN/login/callback
 *   (NOT http://localhost:3000/auth/callback — that is the Auth0→app callback)
 * - Auth0 Application Allowed Callback URLs include:
 *     http://localhost:3000/auth/callback
 */
export const auth0 = new Auth0Client({
  authorizationParameters: {
    scope: "openid profile email offline_access",
  },
  // Mount /auth/connect for linking GitHub while already signed in.
  enableConnectAccountEndpoint: true,
  // Use Auth0 /v2/logout — skips the hosted OIDC "Are you sure?" page.
  // Confirmation lives in our SignOutButton UI instead.
  logoutStrategy: "v2",
  signInReturnToPath: "/sync-user",
  async onCallback(error, ctx) {
    if (error) {
      const params = new URLSearchParams({
        error: error.message || "auth_failed",
      });
      const base = ctx.appBaseUrl || process.env.APP_BASE_URL || "http://localhost:3000";
      // Prefer returning to create flow when GitHub connect fails mid-onboarding.
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
  /** True when Auth0 `sub` is a GitHub social login (primary or linked). */
  signedInWithGithub: boolean;
};

export function userSignedInWithGithub(sub: string | undefined | null) {
  return typeof sub === "string" && sub.startsWith("github|");
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const session = await auth0.getSession();
    const sub = session?.user?.sub;
    if (!sub) return null;

    return {
      userId: sub,
      email: (session.user.email as string | undefined) ?? null,
      name: (session.user.name as string | undefined) ?? null,
      picture: (session.user.picture as string | undefined) ?? null,
      given_name: (session.user.given_name as string | undefined) ?? null,
      family_name: (session.user.family_name as string | undefined) ?? null,
      signedInWithGithub: userSignedInWithGithub(sub),
    };
  } catch {
    // Misconfigured Auth0 must not blank public auth pages.
    return null;
  }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("User not authenticated");
  }
  return user;
}
