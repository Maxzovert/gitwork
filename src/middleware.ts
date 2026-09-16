import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

function safeAppPath(redirectUrl: string | null, origin: string) {
  if (!redirectUrl) return "/dashboard";
  try {
    const url = new URL(redirectUrl);
    if (url.origin !== origin) return "/dashboard";
    const path = `${url.pathname}${url.search}`;
    if (
      path.startsWith("/sign-in") ||
      path.startsWith("/sign-up") ||
      path.startsWith("/sync-user")
    ) {
      return "/dashboard";
    }
    return path || "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Already signed in on auth pages: honor redirect_url (e.g. /meetings/…)
  // instead of always sending people through /sync-user.
  if (userId && isAuthRoute(req)) {
    const dest = safeAppPath(
      req.nextUrl.searchParams.get("redirect_url"),
      req.nextUrl.origin,
    );
    return NextResponse.redirect(new URL(dest, req.url));
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next internals and common static assets (include video for landing hero).
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|webm|mov)).*)",
    "/(api|trpc)(.*)",
  ],
};
