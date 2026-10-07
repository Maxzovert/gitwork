"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  signInWithEmail,
  signUpWithEmail,
  type AuthActionState,
} from "@/app/(auth)/actions";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  mode: "sign-in" | "sign-up";
  returnTo: string;
  signedInEmail?: string | null;
  authError?: string | null;
};

function authLoginHref(returnTo: string, extras?: Record<string, string>) {
  const params = new URLSearchParams({
    returnTo,
    prompt: "login",
    ...extras,
  });
  return `/auth/login?${params.toString()}`;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-xl bg-[#141413] text-[#f3f0ee] hover:bg-[#2a2928]"
    >
      {pending ? "Please wait…" : label}
    </Button>
  );
}

export function AuthForm({ mode, returnTo, signedInEmail, authError }: Props) {
  const isSignUp = mode === "sign-up";
  const action = isSignUp ? signUpWithEmail : signInWithEmail;
  const [state, formAction] = useActionState<AuthActionState, FormData>(
    action,
    {},
  );

  if (signedInEmail) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-[#d1cdc7] bg-[#fcfbfa] p-6 shadow-[0_20px_50px_-28px_rgba(20,20,19,0.35)] sm:p-8">
        <p className="text-sm text-[#696969]">
          You&apos;re signed in as{" "}
          <span className="font-medium text-[#141413]">{signedInEmail}</span>.
        </p>
        <Link
          href="/projects"
          className="flex h-11 items-center justify-center rounded-xl bg-[#141413] text-sm font-medium text-[#f3f0ee] transition hover:bg-[#2a2928]"
        >
          Go to workspace
        </Link>
        <SignOutButton className="flex h-11 w-full items-center justify-center rounded-xl border border-[#d1cdc7] bg-white text-sm font-medium text-[#141413] transition hover:bg-[#f3f0ee]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-[#d1cdc7] bg-[#fcfbfa] p-6 shadow-[0_20px_50px_-28px_rgba(20,20,19,0.35)] sm:p-8">
      {authError ? (
        <p className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-[#8a1f11]">
          {authError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <a
          href={authLoginHref(returnTo, { connection: "google-oauth2" })}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#d1cdc7] bg-white text-sm font-medium text-[#141413] transition hover:bg-[#f3f0ee]"
        >
          <GoogleIcon />
          Continue with Google
        </a>
        <a
          href="/api/auth/github?intent=login"
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#d1cdc7] bg-white text-sm font-medium text-[#141413] transition hover:bg-[#f3f0ee]"
        >
          <GithubIcon />
          Continue with GitHub
        </a>
      </div>

      <div className="relative flex items-center gap-3">
        <span className="h-px flex-1 bg-[#d1cdc7]" />
        <span className="text-xs uppercase tracking-wide text-[#696969]">
          or email
        </span>
        <span className="h-px flex-1 bg-[#d1cdc7]" />
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="returnTo" value={returnTo} />

        {isSignUp ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#696969]">Name</span>
            <Input
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Alex Rivera"
              className="h-11 rounded-xl border-[#d1cdc7] bg-white"
            />
          </label>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[#696969]">Email</span>
          <Input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            className="h-11 rounded-xl border-[#d1cdc7] bg-white"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[#696969]">Password</span>
          <Input
            name="password"
            type="password"
            required
            autoComplete={isSignUp ? "new-password" : "current-password"}
            placeholder={isSignUp ? "At least 8 characters" : "Your password"}
            minLength={isSignUp ? 8 : undefined}
            className="h-11 rounded-xl border-[#d1cdc7] bg-white"
          />
        </label>

        {state.error ? (
          <p className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-[#8a1f11]">
            {state.error}
          </p>
        ) : null}

        <SubmitButton label={isSignUp ? "Create account" : "Sign in"} />
      </form>

      <p className="text-center text-sm text-[#696969]">
        {isSignUp ? (
          <>
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="font-medium text-[#141413] underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link
              href="/sign-up"
              className="font-medium text-[#141413] underline-offset-2 hover:underline"
            >
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
