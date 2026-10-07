import { NextResponse, type NextRequest } from "next/server";

import { clearAppSessionCookie } from "@/lib/app-session";

export const dynamic = "force-dynamic";

/**
 * Clears the GitHub-native app session, then hands off to Auth0 logout
 * so Google/email sessions are cleared too.
 */
export async function GET(request: NextRequest) {
  const origin =
    process.env.APP_BASE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    request.nextUrl.origin;

  const auth0Logout = new URL("/auth/logout", origin);
  auth0Logout.searchParams.set("returnTo", origin.replace(/\/$/, ""));

  const response = NextResponse.redirect(auth0Logout);
  clearAppSessionCookie(response);
  return response;
}
