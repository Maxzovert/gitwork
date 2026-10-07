"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, FolderGit2, Plus } from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0";

import useProjects from "@/hooks/use-projects";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

export function AppTopBar() {
  const router = useRouter();
  const { project, projects, projectId, setProjectId } = useProjects();
  const { user: auth0User } = useUser();
  const profile = api.settings.getProfile.useQuery(undefined, {
    staleTime: 60_000,
  });
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const user = {
    picture: auth0User?.picture ?? profile.data?.picture ?? null,
    name: auth0User?.name ?? profile.data?.name ?? null,
    email: auth0User?.email ?? profile.data?.email ?? null,
  };

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function openProject(id: string) {
    setProjectId(id);
    setOpen(false);
    router.push("/dashboard");
  }

  return (
    <header className="sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-3 border-b border-[#d1cdc7] bg-[#f3f0ee] px-4 py-2 sm:px-6">
      <SidebarTrigger className="size-8 rounded-lg text-[#141413] hover:bg-white" />

      <div className="relative min-w-0 flex-1" ref={menuRef}>
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-haspopup="listbox"
            className="group inline-flex max-w-full min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-[#cf4500]" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.08em] text-[#696969] uppercase">
                {project ? "Opened project" : "Projects"}
              </p>
              <p className="font-display truncate text-sm tracking-[-0.02em] text-[#141413]">
                {project?.name ?? "Select a project"}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-[#696969] transition group-hover:text-[#141413]",
                open && "rotate-180",
              )}
            />
          </button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            className="h-8 shrink-0 rounded-lg border-[#d1cdc7] bg-white px-2.5 text-xs text-[#141413] hover:bg-[#fcfbfa]"
          >
            <Link href="/create">
              <Plus className="size-3.5" />
              Add
            </Link>
          </Button>
        </div>

        {open ? (
          <div
            role="listbox"
            aria-label="Projects"
            className="absolute top-[calc(100%+0.5rem)] left-0 z-40 w-[min(100%,20rem)] overflow-hidden rounded-xl border border-[#d1cdc7] bg-white shadow-[0_12px_40px_-20px_rgba(20,20,19,0.35)]"
          >
            <div className="border-b border-[#d1cdc7]/80 px-3 py-2">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-[#696969] uppercase">
                All projects
              </p>
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {projects?.length ? (
                projects.map((item) => {
                  const selected = item.id === projectId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => openProject(item.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
                          selected
                            ? "bg-[#cf4500]/10"
                            : "hover:bg-[#f3f0ee]",
                        )}
                      >
                        <FolderGit2 className="size-4 shrink-0 text-[#696969]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[#141413]">
                            {item.name}
                          </span>
                          <span className="block truncate text-xs text-[#696969]">
                            {item.githubUrl.replace(/^https?:\/\//, "")}
                          </span>
                        </span>
                        {selected ? (
                          <Check className="size-4 shrink-0 text-[#cf4500]" />
                        ) : null}
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="px-3 py-4 text-sm text-[#696969]">
                  No projects yet. Add one to get started.
                </li>
              )}
            </ul>
            <div className="border-t border-[#d1cdc7]/80 p-2">
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-full justify-start rounded-lg text-sm text-[#141413] hover:bg-[#f3f0ee]"
                asChild
              >
                <Link href="/create" onClick={() => setOpen(false)}>
                  <Plus className="size-4" />
                  Add project
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
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
