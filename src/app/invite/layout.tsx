import { ensureDbUser } from "@/lib/ensure-user";

export default async function InviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureDbUser();
  return children;
}
