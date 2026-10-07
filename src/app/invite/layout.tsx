import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth0";
import { ensureDbUser } from "@/lib/ensure-user";

export const dynamic = "force-dynamic";

export default async function InviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user?.userId) {
    redirect("/sign-in");
  }
  await ensureDbUser();
  return children;
}
