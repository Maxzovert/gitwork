"use client";

import { UserButton } from "@clerk/nextjs";

import useProjects from "@/hooks/use-projects";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppTopBar() {
  const { project } = useProjects();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-[#d1cdc7] bg-[#f3f0ee] px-4 sm:px-6">
      <SidebarTrigger className="size-8 rounded-lg text-[#141413] hover:bg-white" />

      <div className="min-w-0 flex-1">
        {project ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-[#cf4500]" />
            <p className="font-display truncate text-sm tracking-[-0.02em] text-[#141413]">
              {project.name}
            </p>
          </div>
        ) : (
          <p className="truncate text-sm text-[#696969]">Select a project</p>
        )}
      </div>

      <UserButton
        appearance={{
          elements: {
            avatarBox: "size-8 rounded-full ring-1 ring-[#d1cdc7]",
          },
        }}
        userProfileProps={{
          additionalOAuthScopes: {
            github: ["repo"],
          },
        }}
      />
    </header>
  );
}
