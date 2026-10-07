import { NextResponse, type NextRequest } from "next/server";

import {
  APP_OAUTH_STATE_COOKIE,
  appSessionCookieOptions,
  createOauthStateToken,
} from "@/lib/app-session";
import {
  buildGithubAuthorizeUrl,
  createOauthStateValue,
} from "@/lib/github-oauth";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const intentParam = request.nextUrl.searchParams.get("intent");
    const intent = intentParam === "connect" ? "connect" : "login";
    const returnTo = safeReturnTo(
      request.nextUrl.searchParams.get("returnTo"),
      intent === "connect" ? "/create" : "/sync-user",
    );

    const state = createOauthStateValue();
    const stateToken = await createOauthStateToken({
      state,
      intent,
      returnTo,
    });

    const authorizeUrl = buildGithubAuthorizeUrl(state);
    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(APP_OAUTH_STATE_COOKIE, stateToken, {
      ...appSessionCookieOptions(60 * 10),
    });
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "GitHub OAuth is not configured";
    const base =
      process.env.APP_BASE_URL?.trim() ||
      process.env.APP_URL?.trim() ||
      "http://localhost:3000";
    return NextResponse.redirect(
      `${base}/sign-in?error=${encodeURIComponent(message)}`,
    );
  }
}
