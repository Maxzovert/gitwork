import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ensureDbUser } from "@/lib/ensure-user";

/** Legacy post-auth route — always continues to the dashboard. */
const SyncUser = async () => {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  await ensureDbUser();
  redirect("/dashboard");
};

export default SyncUser;
