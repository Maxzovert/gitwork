import { SignUp } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function Page() {
  return (
    <AuthShell subtitle="Create your workspace">
      <SignUp
        // fallback only — preserve redirect_url after sign-up when present
        fallbackRedirectUrl="/sync-user"
        signInUrl="/sign-in"
        appearance={clerkAppearance}
      />
    </AuthShell>
  );
}
