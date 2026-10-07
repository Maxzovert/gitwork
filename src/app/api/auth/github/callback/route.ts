import { NextResponse, type NextRequest } from "next/server";

import {
  APP_OAUTH_STATE_COOKIE,
  appSessionCookieOptions,
  readAppSessionFromRequest,
  setAppSessionCookie,
  verifyOauthStateToken,
} from "@/lib/app-session";
import { auth0 } from "@/lib/auth0";
import {
  exchangeGithubCode,
  fetchGithubProfile,
} from "@/lib/github-oauth";
import { upsertEncryptedGithubToken } from "@/lib/github-oauth-token";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

function appBase() {
  return (
    process.env.APP_BASE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function redirectError(path: string, message: string) {
  const url = new URL(path, appBase());
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

function splitName(name: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

async function resolveAuth0UserId(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    return session?.user?.sub ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    return redirectError(
      "/sign-in",
      request.nextUrl.searchParams.get("error_description") || oauthError,
    );
  }

  if (!code || !state) {
    return redirectError("/sign-in", "Missing GitHub OAuth code or state");
  }

  const stateCookie = request.cookies.get(APP_OAUTH_STATE_COOKIE)?.value;
  if (!stateCookie) {
    return redirectError("/sign-in", "GitHub OAuth state expired. Try again.");
  }

  const oauthState = await verifyOauthStateToken(stateCookie, state);
  if (!oauthState) {
    return redirectError("/sign-in", "Invalid GitHub OAuth state. Try again.");
  }

  try {
    const { accessToken } = await exchangeGithubCode(code);
    const profile = await fetchGithubProfile(accessToken);
    const githubUserId = String(profile.id);
    const { firstName, lastName } = splitName(profile.name);

    let resolvedUserId: string;

    if (oauthState.intent === "connect") {
      const auth0UserId = await resolveAuth0UserId(request);
      const appSession = await readAppSessionFromRequest(request);
      const sessionUserId = auth0UserId || appSession?.userId || null;

      if (!sessionUserId) {
        return redirectError(
          "/sign-in",
          "Sign in first, then connect GitHub.",
        );
      }
      resolvedUserId = sessionUserId;

      const existing = await db.user.findUnique({
        where: { id: resolvedUserId },
        select: { id: true },
      });
      if (!existing) {
        // Auth0 session before sync-user: create the row now.
        let email = profile.email;
        try {
          const session = await auth0.getSession(request);
          email =
            (session?.user?.email as string | undefined)?.trim() || email;
        } catch {
          // use GitHub email
        }
        await db.user.create({
          data: {
            id: resolvedUserId,
            emailAdress: email,
            githubUserId,
            imageUrl: profile.avatarUrl ?? undefined,
            firstName: firstName ?? undefined,
            lastName: lastName ?? undefined,
          },
        });
      } else {
        await db.user.update({
          where: { id: resolvedUserId },
          data: {
            githubUserId,
            imageUrl: profile.avatarUrl ?? undefined,
            firstName: firstName ?? undefined,
            lastName: lastName ?? undefined,
          },
        });
      }
    } else {
      const byGithub = await db.user.findUnique({
        where: { githubUserId },
        select: { id: true },
      });
      const byEmail = byGithub
        ? null
        : await db.user.findUnique({
            where: { emailAdress: profile.email },
            select: { id: true },
          });

      if (byGithub) {
        resolvedUserId = byGithub.id;
        await db.user.update({
          where: { id: resolvedUserId },
          data: {
            emailAdress: profile.email,
            imageUrl: profile.avatarUrl ?? undefined,
            firstName: firstName ?? undefined,
            lastName: lastName ?? undefined,
          },
        });
      } else if (byEmail) {
        resolvedUserId = byEmail.id;
        await db.user.update({
          where: { id: resolvedUserId },
          data: {
            githubUserId,
            imageUrl: profile.avatarUrl ?? undefined,
            firstName: firstName ?? undefined,
            lastName: lastName ?? undefined,
          },
        });
      } else {
        const created = await db.user.create({
          data: {
            emailAdress: profile.email,
            githubUserId,
            imageUrl: profile.avatarUrl ?? undefined,
            firstName: firstName ?? undefined,
            lastName: lastName ?? undefined,
          },
          select: { id: true },
        });
        resolvedUserId = created.id;
      }
    }

    // Encrypt at rest — never persist plaintext access tokens.
    await upsertEncryptedGithubToken(db, resolvedUserId, accessToken);

    const redirectPath =
      oauthState.intent === "connect"
        ? oauthState.returnTo || "/create"
        : "/sync-user";
    const response = NextResponse.redirect(new URL(redirectPath, appBase()));

    response.cookies.set(APP_OAUTH_STATE_COOKIE, "", {
      ...appSessionCookieOptions(0),
      maxAge: 0,
    });

    if (oauthState.intent === "login") {
      await setAppSessionCookie(response, {
        userId: resolvedUserId,
        email: profile.email,
        name: profile.name ?? profile.login,
        picture: profile.avatarUrl,
        signedInWithGithub: true,
      });
    }

    return response;
  } catch (error) {
    console.error("[github-oauth] callback failed:", error);
    const message =
      error instanceof Error ? error.message : "GitHub authorization failed";
    const failPath =
      oauthState.intent === "connect" ? "/create" : "/sign-in";
    const response = redirectError(failPath, message);
    response.cookies.set(APP_OAUTH_STATE_COOKIE, "", {
      ...appSessionCookieOptions(0),
      maxAge: 0,
    });
    return response;
  }
}
