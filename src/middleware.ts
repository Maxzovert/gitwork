import { NextResponse, type NextRequest } from "next/server";

import { APP_SESSION_COOKIE, verifyAppSessionToken } from "@/lib/app-session";
import { auth0 } from "@/lib/auth0";

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/api/auth/github")) return true;
  if (pathname.startsWith("/api/auth/logout")) return true;
  if (pathname.startsWith("/sign-in")) return true;
  if (pathname.startsWith("/sign-up")) return true;
  if (pathname.startsWith("/api/webhooks")) return true;
  if (pathname.startsWith("/monitoring")) return true;
  return false;
}

async function hasAppSession(request: NextRequest) {
  const token = request.cookies.get(APP_SESSION_COOKIE)?.value;
  if (!token) return false;
  return Boolean(await verifyAppSessionToken(token));
}

export async function middleware(request: NextRequest) {
  const authRes = await auth0.middleware(request);
  const { pathname } = request.nextUrl;

  // Always let Auth0 handle its own routes (/auth/login, callback, logout, …).
  if (pathname.startsWith("/auth")) {
    return authRes;
  }

  // Direct GitHub OAuth + unified logout must not require a prior session.
  if (
    pathname.startsWith("/api/auth/github") ||
    pathname.startsWith("/api/auth/logout")
  ) {
    return authRes;
  }

  const session = await auth0.getSession(request);
  const appOk = session?.user ? false : await hasAppSession(request);
  const signedIn = Boolean(session?.user) || appOk;

  if (!isPublicPath(pathname) && !signedIn) {
    const signInUrl = new URL("/sign-in", request.nextUrl.origin);
    const returnTo = `${pathname}${request.nextUrl.search}`;
    if (returnTo && returnTo !== "/") {
      signInUrl.searchParams.set("redirect_url", returnTo);
    }
    const redirect = NextResponse.redirect(signInUrl);
    authRes.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value);
    });
    return redirect;
  }

  return authRes;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|webm|mov)).*)",
    "/(api|trpc)(.*)",
  ],
};
