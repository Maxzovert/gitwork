"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ExternalLink,
  FolderGit2,
  Github,
  Plus,
} from "lucide-react";

import useProjects from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, projectId, setProjectId, isPending, isFetched } =
    useProjects();

  const openProject = (id: string) => {
    setProjectId(id);
    router.push("/dashboard");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Choose a workspace to open its dashboard, or add another repository."
        actions={
          <Button
            asChild
            size="sm"
            className="bg-[#141413] text-[#f3f0ee] hover:bg-[#2a2928]"
          >
            <Link href="/create">
              <Plus className="size-4" />
              Add project
            </Link>
          </Button>
        }
      />

      {!isFetched || isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[4.5rem] w-full rounded-2xl" />
          ))}
        </div>
      ) : !projects?.length ? (
        <EmptyState
          icon={FolderGit2}
          title="No projects yet"
          description="Connect a GitHub repository to create your first workspace."
          action={
            <Button
              asChild
              className="bg-[#141413] text-[#f3f0ee] hover:bg-[#2a2928]"
            >
              <Link href="/create">
                <Plus className="size-4" />
                Add project
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => {
            const isOpen = project.id === projectId;
            return (
              <li key={project.id}>
                <div
                  className={cn(
                    "flex flex-col gap-4 rounded-2xl border bg-white p-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
                    isOpen
                      ? "border-[#141413] shadow-sm"
                      : "border-[#d1cdc7] hover:border-[#141413]/30",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openProject(project.id)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                        isOpen
                          ? "bg-[#141413] text-[#f3f0ee]"
                          : "bg-[#f3f0ee] text-[#141413] ring-1 ring-[#d1cdc7]",
                      )}
                    >
                      {project.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-display text-base tracking-[-0.02em] text-[#141413]">
                          {project.name}
                        </p>
                        {isOpen ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#cf4500]/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#cf4500] uppercase">
                            <Check className="size-3" />
                            Last opened
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
                            project.role === "OWNER"
                              ? "bg-[#141413] text-[#f3f0ee]"
                              : "bg-[#eceae6] text-[#696969]",
                          )}
                        >
                          {project.role === "OWNER" ? "Owner" : "Member"}
                        </span>
                      </div>
                      {project.githubUrl ? (
                        <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-[#696969]">
                          <Github className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {project.githubUrl.replace(/^https?:\/\//, "")}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-2 sm:pl-2">
                    {project.githubUrl ? (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="border-[#d1cdc7] text-[#141413] hover:bg-[#f3f0ee]"
                      >
                        <a
                          href={project.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <ExternalLink className="size-4" />
                          Repo
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openProject(project.id)}
                      className="bg-[#141413] text-[#f3f0ee] hover:bg-[#2a2928]"
                    >
                      Open dashboard
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
