import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

/**
 * Auth0 App Router client (v4). Safe for middleware (no Prisma).
 * Env: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET, APP_BASE_URL
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
