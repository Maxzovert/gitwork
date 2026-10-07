import { NextResponse, type NextRequest } from "next/server";

import { auth0 } from "@/lib/auth0";

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/sign-in")) return true;
  if (pathname.startsWith("/sign-up")) return true;
  if (pathname.startsWith("/api/webhooks")) return true;
  if (pathname.startsWith("/monitoring")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const authRes = await auth0.middleware(request);
  const { pathname } = request.nextUrl;

  // Always let Auth0 handle its own routes (/auth/login, callback, logout, …).
  if (pathname.startsWith("/auth")) {
    return authRes;
  }

  const session = await auth0.getSession(request);

  // Keep /sign-in and /sign-up visible even when a session exists
  // (page shows “signed in” + Sign out). Do not bounce to dashboard.

  if (!isPublicPath(pathname) && !session?.user) {
    const signInUrl = new URL("/sign-in", request.nextUrl.origin);
    const returnTo = `${pathname}${request.nextUrl.search}`;
    if (returnTo && returnTo !== "/") {
      signInUrl.searchParams.set("redirect_url", returnTo);
    }
    // Preserve Auth0 middleware cookie updates when redirecting.
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
