import { Suspense } from "react";
import { redirect } from "next/navigation";

import { CreateProjectOnboarding } from "@/components/create-project-onboarding";
import { WorkspaceLoader } from "@/components/workspace-loader";
import { getSessionUser } from "@/lib/auth0";
import { ensureDbUser } from "@/lib/ensure-user";

export const dynamic = "force-dynamic";

/**
 * First-time users (no projects) always land here after sync-user.
 * Returning users open /create from the Projects page ("Add project").
 */
export default async function CreatePage() {
  const user = await getSessionUser();
  if (!user?.userId) {
    redirect("/sign-in");
  }

  await ensureDbUser();

  return (
    <Suspense
      fallback={
        <WorkspaceLoader
          title="Create project"
          message="Loading onboarding…"
          progress={60}
        />
      }
    >
      <CreateProjectOnboarding />
    </Suspense>
  );
}
