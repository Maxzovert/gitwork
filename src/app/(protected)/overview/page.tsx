"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BookOpen, Map as MapIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import {
  FileReferences,
  type FileReference,
} from "@/components/file-references";

function sourceLabel(source?: "docs" | "analysis" | "mixed") {
  if (source === "docs") return "From README";
  if (source === "analysis") return "From code analysis";
  if (source === "mixed") return "From README + code";
  return "Saved overview";
}

export default function ProjectOverviewPage() {
  const { project, projectId } = useProjects();
  const [activeFiles, setActiveFiles] = useState<FileReference[] | null>(null);

  const utils = api.useUtils();

  const overviewQuery = api.project.getOverview.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );

  const generateOverview = api.project.generateOverview.useMutation({
    onSuccess: async () => {
      toast.success("Overview ready");
      await utils.project.getOverview.invalidate({ projectId: projectId ?? "" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate overview");
    },
  });

  const overview = overviewQuery.data?.overview;
  const fileMap = useMemo(() => {
    const map = new Map<string, FileReference>();
    for (const file of overview?.fileReferences ?? []) {
      map.set(file.filename, {
        filename: file.filename,
        sourceCode: file.sourceCode,
        summary: file.summary,
      });
    }
    return map;
  }, [overview?.fileReferences]);

  const openFiles = (names: string[]) => {
    const files = names
      .map((name) => fileMap.get(name))
      .filter((file): file is FileReference => Boolean(file));
    setActiveFiles(files.length ? files : null);
  };

  if (!projectId || !project) {
    return (
      <EmptyState
        icon={MapIcon}
        title="Select a project"
        description="Choose a project from the sidebar to see a beginner overview."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="A short, plain-language briefing of this repo, with the files a beginner should open first."
        actions={
          <Button
            type="button"
            disabled={generateOverview.isPending}
            onClick={() => generateOverview.mutate({ projectId })}
            className="rounded-[20px]"
          >
            <RefreshCw
              className={cn("size-4", generateOverview.isPending && "animate-spin")}
            />
            {overview ? "Refresh overview" : "Generate overview"}
          </Button>
        }
      />

      {overviewQuery.data?.stale ? (
        <p className="rounded-xl border border-[#d1cdc7] bg-[#fff8f4] px-4 py-3 text-sm text-[#6b3d26]">
          The repo was re-indexed after this overview. Refresh to update it.
        </p>
      ) : null}

      {overviewQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : overviewQuery.error ? (
        <EmptyState
          icon={AlertTriangle}
          title="Overview unavailable"
          description={overviewQuery.error.message}
        />
      ) : !overview ? (
        <EmptyState
          icon={BookOpen}
          title="Generate an overview"
          description={`Gitwork will read README and CONTRIBUTING for ${project.name} first. If those are missing, it explains the indexed folders in simple language.`}
          action={
            <Button
              type="button"
              disabled={generateOverview.isPending}
              onClick={() => generateOverview.mutate({ projectId })}
              className="rounded-[20px]"
            >
              {generateOverview.isPending ? "Generating…" : "Generate overview"}
            </Button>
          }
        />
      ) : (
        <>
          <section className="rounded-xl border border-[#d1cdc7] bg-[#fcfbfa] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full bg-[#eceae6] px-2.5 py-1 text-xs font-medium text-[#696969]">
                {sourceLabel(overview.source)}
              </span>
              {overviewQuery.data?.overviewGeneratedAt ? (
                <span className="text-xs text-[#696969]">
                  Generated{" "}
                  {new Date(overviewQuery.data.overviewGeneratedAt).toLocaleString()}
                </span>
              ) : null}
            </div>
            <h2 className="font-display mt-3 text-lg tracking-[-0.02em] text-[#141413]">
              What this project is
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#141413]">
              {overview.whatItIs}
            </p>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-[#d1cdc7] bg-white p-5">
              <h3 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
                How to run it
              </h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#141413]">
                {overview.howToRun}
              </p>
            </article>
            <article className="rounded-xl border border-[#d1cdc7] bg-white p-5">
              <h3 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
                How to contribute
              </h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#141413]">
                {overview.howToContribute}
              </p>
            </article>
          </section>

          <section className="rounded-xl border border-[#d1cdc7] bg-white p-5">
            <h3 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
              How the folders work
            </h3>
            <div className="mt-4 space-y-3">
              {(overview.folders ?? []).map((folder) => (
                <div
                  key={folder.name}
                  className="rounded-xl border border-[#d1cdc7] bg-[#fcfbfa] p-4"
                >
                  <p className="font-medium text-[#141413]">{folder.name}</p>
                  <p className="mt-1 text-sm leading-6 text-[#696969]">{folder.blurb}</p>
                  {folder.files.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {folder.files.map((file) => (
                        <button
                          key={file}
                          type="button"
                          onClick={() => openFiles(folder.files)}
                          className="rounded-full bg-[#eceae6] px-2.5 py-1 text-xs text-[#141413] hover:bg-[#d1cdc7]"
                        >
                          {file}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[#d1cdc7] bg-white p-5">
            <h3 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
              Where to start
            </h3>
            <ol className="mt-4 space-y-3">
              {(overview.startHere ?? []).map((item, index) => (
                <li key={item.filename} className="rounded-xl border border-[#d1cdc7] bg-[#fcfbfa] p-4">
                  <button
                    type="button"
                    onClick={() => openFiles([item.filename])}
                    className="text-left"
                  >
                    <p className="text-sm font-medium text-[#141413]">
                      {index + 1}. {item.filename}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#696969]">{item.why}</p>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          {activeFiles?.length ? (
            <section className="space-y-3">
              <h3 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
                File references
              </h3>
              <FileReferences files={activeFiles} />
            </section>
          ) : overview.fileReferences?.length ? (
            <section className="space-y-3">
              <h3 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
                File references
              </h3>
              <FileReferences
                files={overview.fileReferences.map((file) => ({
                  filename: file.filename,
                  sourceCode: file.sourceCode,
                  summary: file.summary,
                }))}
              />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
