"use server";

import { redirect } from "next/navigation";

const DB_CONNECTION =
  process.env.AUTH0_DB_CONNECTION || "Username-Password-Authentication";

function auth0Domain() {
  const domain = process.env.AUTH0_DOMAIN?.replace(/^https?:\/\//, "").replace(
    /\/$/,
    "",
  );
  if (!domain) throw new Error("AUTH0_DOMAIN is not configured");
  return domain;
}

function clientId() {
  const id = process.env.AUTH0_CLIENT_ID;
  if (!id) throw new Error("AUTH0_CLIENT_ID is not configured");
  return id;
}

function safeReturnTo(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/sync-user";
  }
  if (
    value.startsWith("/sign-in") ||
    value.startsWith("/sign-up") ||
    value.startsWith("/auth")
  ) {
    return "/sync-user";
  }
  return value;
}

export type AuthActionState = {
  error?: string;
  ok?: boolean;
};

export async function signUpWithEmail(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const returnTo = safeReturnTo(formData.get("returnTo"));

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  try {
    const res = await fetch(`https://${auth0Domain()}/dbconnections/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId(),
        email,
        password,
        connection: DB_CONNECTION,
        name: name || undefined,
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        description?: string;
        message?: string;
        code?: string;
      } | null;
      if (body?.code === "user_exists" || /exist/i.test(body?.description ?? "")) {
        return { error: "An account with this email already exists. Sign in instead." };
      }
      return {
        error:
          body?.description ||
          body?.message ||
          "Could not create your account. Check Auth0 Database connection is enabled.",
      };
    }
  } catch {
    return { error: "Could not reach Auth0. Try again in a moment." };
  }

  // Account created — complete login via Auth0 (establishes app session cookie).
  const params = new URLSearchParams({
    returnTo,
    login_hint: email,
    prompt: "login",
    screen_hint: "login",
  });
  redirect(`/auth/login?${params.toString()}`);
}

export async function signInWithEmail(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const returnTo = safeReturnTo(formData.get("returnTo"));

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  // Auth0 Next.js SDK sessions are created via the OAuth callback.
  // Prefill email and force the login screen (no silent Google SSO).
  const params = new URLSearchParams({
    returnTo,
    login_hint: email,
    prompt: "login",
  });
  // Password is not sent to Auth0 via query string — user confirms on Auth0 once,
  // or use Database connection Universal Login with email prefilled.
  void password;
  redirect(`/auth/login?${params.toString()}`);
}
