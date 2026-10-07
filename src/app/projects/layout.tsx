import Link from "next/link";
import { redirect } from "next/navigation";

import { GitworkLogo } from "@/components/gitwork-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { getSessionUser } from "@/lib/auth0";
import { ensureDbUser } from "@/lib/ensure-user";

export const dynamic = "force-dynamic";

type Props = {
  children: React.ReactNode;
};

/**
 * Hub shell for /projects — no workspace sidebar. Opening a project
 * enters the protected layout (dashboard + project-scoped nav).
 */
export default async function ProjectsHubLayout({ children }: Props) {
  const user = await getSessionUser();
  if (!user?.userId) {
    redirect("/sign-in");
  }
  await ensureDbUser();

  return (
    <div className="min-h-svh bg-[#f3f0ee] text-[#141413]">
      <header className="border-b border-[#d1cdc7] bg-[#f3f0ee]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/projects" className="inline-flex">
            <GitworkLogo size={28} withWordmark />
          </Link>
          <SignOutButton className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#696969] transition hover:bg-white hover:text-[#141413]" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
