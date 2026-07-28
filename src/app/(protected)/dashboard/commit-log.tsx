"use client";

import React from "react";
import Image from "next/image";
import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ExternalLink, GitCommitHorizontal, RefreshCw } from "lucide-react";
import { minidenticon } from "minidenticons";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const CommitLog = () => {
  const { projectId, project } = useProjects();
  const utils = api.useUtils();
  const { data: commits, isLoading } = api.project.getCommits.useQuery(
    { projectId },
    {
      enabled: !!project && !!projectId.trim(),
      refetchInterval: 15_000,
    },
  );
  const syncCommits = api.project.syncCommits.useMutation({
    onSuccess: (result) => {
      void utils.project.getCommits.invalidate({ projectId });
      if (result.count === 0) {
        toast.message("Already up to date");
      } else {
        toast.success(`Synced ${result.count} new commit(s)`);
      }
    },
    onError: (err) => toast.error(err.message || "Failed to sync commits"),
  });

  if (!project || !projectId.trim()) {
    return (
      <EmptyState
        icon={GitCommitHorizontal}
        title="Select a project"
        description="Choose a project from the sidebar to view commits."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!commits?.length) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={GitCommitHorizontal}
          title="No commits yet"
          description="Push to your repo or sync once to backfill recent commits. New pushes arrive automatically via GitHub webhooks."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={syncCommits.isPending}
              onClick={() => syncCommits.mutate({ projectId })}
              className="rounded-[20px]"
            >
              <RefreshCw
                className={cn("size-4", syncCommits.isPending && "animate-spin")}
              />
              Sync commits
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={syncCommits.isPending}
          onClick={() => syncCommits.mutate({ projectId })}
          className="text-[#696969] hover:text-[#141413]"
        >
          <RefreshCw
            className={cn("size-4", syncCommits.isPending && "animate-spin")}
          />
          Sync now
        </Button>
      </div>

      <ul className="space-y-3">
        {commits.map((commit, commitIdx) => {
          return (
            <li key={commit.commitHash} className="relative flex gap-x-3">
              <div
                className={cn(
                  commitIdx === commits.length - 1 ? "h-6" : "-bottom-3",
                  "absolute top-0 left-0 flex w-8",
                )}
              >
                <div className="relative mx-auto h-full w-px bg-[#d1cdc7]" />
              </div>

              {commit.commitAuthorAvatar ? (
                <Image
                  src={commit.commitAuthorAvatar}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  className="relative mt-3 size-8 max-h-8 max-w-8 shrink-0 rounded-full bg-[#f4f4f4] object-cover"
                />
              ) : (
                <Image
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(
                    minidenticon(commit.commitAuthorName),
                  )}`}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  className="relative mt-3 size-8 max-h-8 max-w-8 shrink-0 rounded-full bg-[#f4f4f4] object-cover"
                />
              )}

              <div className="min-w-0 flex-auto rounded-xl border border-[#d1cdc7] bg-[#fcfbfa] p-4">
                <Link
                  target="_blank"
                  rel="noreferrer"
                  href={`${project?.githubUrl}/commits/${commit.commitHash}`}
                  className="inline-flex items-center gap-1.5 text-sm text-[#696969] hover:text-[#141413]"
                >
                  <span className="font-semibold text-[#141413]">
                    {commit.commitAuthorName}
                  </span>
                  committed
                  <ExternalLink className="size-3.5" />
                </Link>
                <p className="font-display mt-1.5 text-sm tracking-[-0.02em] text-[#141413]">
                  {commit.commitMessage}
                </p>
                <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#696969]">
                  {commit.summary}
                </pre>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default CommitLog;
