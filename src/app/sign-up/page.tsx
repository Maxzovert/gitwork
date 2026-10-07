import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getSessionUser } from "@/lib/auth0";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function safeReturnTo(redirectUrl: string | undefined) {
  if (!redirectUrl) return "/sync-user";
  if (!redirectUrl.startsWith("/") || redirectUrl.startsWith("//")) {
    return "/sync-user";
  }
  if (
    redirectUrl.startsWith("/sign-in") ||
    redirectUrl.startsWith("/sign-up") ||
    redirectUrl.startsWith("/auth")
  ) {
    return "/sync-user";
  }
  return redirectUrl;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(firstParam(params.redirect_url));
  const session = await getSessionUser();

  return (
    <AuthShell subtitle="Create your workspace">
      <AuthForm
        mode="sign-up"
        returnTo={returnTo}
        signedInEmail={session?.email}
      />
    </AuthShell>
  );
}
