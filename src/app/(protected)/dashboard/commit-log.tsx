"use client";

import React from "react";
import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ExternalLink, GitCommitHorizontal } from "lucide-react";
import { minidenticon } from "minidenticons";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

const CommitLog = () => {
  const { projectId, project } = useProjects();
  const { data: commits, isLoading } = api.project.getCommits.useQuery(
    { projectId },
    { enabled: !!project && !!projectId.trim() },
  );

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
      <EmptyState
        icon={GitCommitHorizontal}
        title="No commits yet"
        description="Commits will appear here once the repository is indexed."
      />
    );
  }

  return (
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
              <img
                src={commit.commitAuthorAvatar}
                alt=""
                width={32}
                height={32}
                className="relative mt-3 size-8 max-h-8 max-w-8 shrink-0 rounded-full bg-[#f4f4f4] object-cover"
              />
            ) : (
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(
                  minidenticon(commit.commitAuthorName),
                )}`}
                alt=""
                width={32}
                height={32}
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
  );
};

export default CommitLog;
