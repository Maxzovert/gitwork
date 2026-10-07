"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0";

import useProjects from "@/hooks/use-projects";
import { SignOutButton } from "@/components/sign-out-button";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppTopBar() {
  const { project } = useProjects();
  const { user } = useUser();

  return (
    <header className="sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-3 border-b border-[#d1cdc7] bg-[#f3f0ee] px-4 py-2 sm:px-6">
      <SidebarTrigger className="size-8 rounded-lg text-[#141413] hover:bg-white" />

      <div className="min-w-0 flex-1">
        {project ? (
          <Link
            href="/projects"
            title="Switch project"
            className="group inline-flex max-w-full min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-white"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-[#cf4500]" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.08em] text-[#696969] uppercase">
                Opened project
              </p>
              <p className="font-display truncate text-sm tracking-[-0.02em] text-[#141413]">
                {project.name}
              </p>
            </div>
            <ChevronDown className="size-3.5 shrink-0 text-[#696969] transition group-hover:text-[#141413]" />
          </Link>
        ) : (
          <Link
            href="/projects"
            className="truncate text-sm text-[#696969] hover:text-[#141413]"
          >
            Select a project
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2">
        {user?.picture ? (
          <Image
            src={user.picture}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full ring-1 ring-[#d1cdc7]"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full bg-[#141413] text-xs text-[#f3f0ee] ring-1 ring-[#d1cdc7]">
            {(user?.name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <SignOutButton className="rounded-lg px-2 py-1.5 text-xs font-medium text-[#696969] transition hover:bg-white hover:text-[#141413]" />
      </div>
    </header>
  );
}
