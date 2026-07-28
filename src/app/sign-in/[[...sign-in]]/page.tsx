import { SignIn } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function Page() {
  return (
    <AuthShell>
      <SignIn
        forceRedirectUrl="/sync-user"
        fallbackRedirectUrl="/sync-user"
        signUpUrl="/sign-up"
        appearance={clerkAppearance}
      />
    </AuthShell>
  );
}
