import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { CreateProjectOnboarding } from "@/components/create-project-onboarding";
import { ensureDbUser } from "@/lib/ensure-user";

export default async function CreatePage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  await ensureDbUser();

  return <CreateProjectOnboarding />;
}
