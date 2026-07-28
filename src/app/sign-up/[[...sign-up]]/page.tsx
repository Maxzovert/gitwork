import { SignUp } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function Page() {
  return (
    <AuthShell subtitle="Create your workspace">
      <SignUp
        forceRedirectUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
        signInUrl="/sign-in"
        appearance={clerkAppearance}
      />
    </AuthShell>
  );
}
