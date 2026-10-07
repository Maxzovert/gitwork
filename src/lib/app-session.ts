import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

export const APP_SESSION_COOKIE = "gitwork_session";
const APP_OAUTH_STATE_COOKIE = "gitwork_gh_oauth";

export type AppSessionPayload = {
  userId: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  /** True when this session was established via direct GitHub OAuth login. */
  signedInWithGithub: boolean;
};

export type GithubOauthState = {
  state: string;
  intent: "login" | "connect";
  returnTo: string;
};

function sessionSecretKey() {
  const raw =
    process.env.APP_SESSION_SECRET?.trim() ||
    process.env.AUTH0_SECRET?.trim() ||
    "";
  if (!raw) {
    throw new Error(
      "APP_SESSION_SECRET or AUTH0_SECRET is required for app sessions",
    );
  }
  return new TextEncoder().encode(raw.padEnd(32, "0").slice(0, 64));
}

export async function createAppSessionToken(
  payload: AppSessionPayload,
): Promise<string> {
  return await new SignJWT({
    email: payload.email,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
    signedInWithGithub: payload.signedInWithGithub,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(sessionSecretKey());
}

export async function verifyAppSessionToken(
  token: string,
): Promise<AppSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecretKey());
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!userId || !email) return null;
    return {
      userId,
      email,
      name: typeof payload.name === "string" ? payload.name : null,
      picture: typeof payload.picture === "string" ? payload.picture : null,
      signedInWithGithub: Boolean(payload.signedInWithGithub),
    };
  } catch {
    return null;
  }
}

export function appSessionCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function setAppSessionCookie(
  response: NextResponse,
  payload: AppSessionPayload,
) {
  const token = await createAppSessionToken(payload);
  response.cookies.set(APP_SESSION_COOKIE, token, appSessionCookieOptions());
}

export function clearAppSessionCookie(response: NextResponse) {
  response.cookies.set(APP_SESSION_COOKIE, "", {
    ...appSessionCookieOptions(0),
    maxAge: 0,
  });
}

export async function readAppSessionFromCookies(): Promise<AppSessionPayload | null> {
  try {
    const jar = await cookies();
    const token = jar.get(APP_SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifyAppSessionToken(token);
  } catch {
    return null;
  }
}

export async function readAppSessionFromRequest(
  request: NextRequest,
): Promise<AppSessionPayload | null> {
  const token = request.cookies.get(APP_SESSION_COOKIE)?.value;
  if (!token) return null;
  return await verifyAppSessionToken(token);
}

export async function createOauthStateToken(
  state: GithubOauthState,
): Promise<string> {
  return await new SignJWT({
    intent: state.intent,
    returnTo: state.returnTo,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(state.state)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(sessionSecretKey());
}

export async function verifyOauthStateToken(
  token: string,
  expectedState: string,
): Promise<GithubOauthState | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecretKey());
    if (payload.sub !== expectedState) return null;
    const intent = payload.intent === "connect" ? "connect" : "login";
    const returnTo =
      typeof payload.returnTo === "string" && payload.returnTo.startsWith("/")
        ? payload.returnTo
        : "/sync-user";
    return { state: expectedState, intent, returnTo };
  } catch {
    return null;
  }
}

export { APP_OAUTH_STATE_COOKIE };
