import { SignIn } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function Page() {
  return (
    <AuthShell>
      <SignIn
        // fallback only — do NOT use forceRedirectUrl, or Clerk ignores
        // redirect_url (e.g. /meetings/[id]) and always dumps users on /sync-user
        fallbackRedirectUrl="/sync-user"
        signUpUrl="/sign-up"
        appearance={clerkAppearance}
      />
    </AuthShell>
  );
}
