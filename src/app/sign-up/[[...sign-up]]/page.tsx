import { SignUp } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function Page() {
  return (
    <AuthShell subtitle="Create your workspace">
      <SignUp
        forceRedirectUrl="/sync-user"
        fallbackRedirectUrl="/sync-user"
        signInUrl="/sign-in"
        appearance={clerkAppearance}
      />
    </AuthShell>
  );
}
