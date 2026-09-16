"use client";

import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeSelect } from "@/components/ui/theme-select";
import { StatusBadge } from "@/components/status-badge";

export default function IndexingPanel({ className }: { className?: string }) {
  const { project } = useProjects();
  const utils = api.useUtils();

  const membership = api.project.getMyMembership.useQuery(
    { projectId: project?.id ?? "" },
    { enabled: Boolean(project?.id) },
  );
  const indexingStatus = api.project.getIndexingStatus.useQuery(
    { projectId: project?.id ?? "" },
    {
      enabled: Boolean(project?.id),
      refetchInterval: 3000,
    },
  );
  const branches = api.project.getBranches.useQuery(
    { githubUrl: project?.githubUrl ?? "" },
    {
      enabled: Boolean(project?.githubUrl),
      retry: false,
    },
  );

  const [selectedBranch, setSelectedBranch] = useState("");

  useEffect(() => {
    const active = indexingStatus.data?.project?.activeBranch;
    if (active) {
      setSelectedBranch(active);
    } else if (branches.data?.defaultBranch) {
      setSelectedBranch(branches.data.defaultBranch);
    } else {
      setSelectedBranch("");
    }
  }, [
    project?.id,
    branches.data?.defaultBranch,
    indexingStatus.data?.project?.activeBranch,
  ]);

  const startIndexing = api.project.startIndexing.useMutation({
    onSuccess: () => {
      toast.success("Indexing started — progress will update below");
      void indexingStatus.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateActiveBranch = api.project.updateActiveBranch.useMutation({
    onSuccess: () => {
      void indexingStatus.refetch();
      void utils.project.getProjects.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const onBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    if (
      !project?.id ||
      membership.data?.role !== "OWNER" ||
      !branch ||
      branch === indexingStatus.data?.project?.activeBranch
    ) {
      return;
    }
    updateActiveBranch.mutate({ projectId: project.id, branch });
  };

  if (!project) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-dust bg-lifted p-3.5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-ink">Indexing</p>
            <StatusBadge
              status={indexingStatus.data?.job?.status ?? "IDLE"}
            />
          </div>
          <p className="text-xs text-slate">
            Active branch:{" "}
            {indexingStatus.data?.project?.activeBranch ??
              branches.data?.defaultBranch ??
              "Unknown"}
            {indexingStatus.data?.project?.lastIndexedAt
              ? ` · Last indexed ${new Date(
                  indexingStatus.data.project.lastIndexedAt,
                ).toLocaleString()}`
              : ""}
            {" · "}
            Webhook pushes re-index this branch
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ThemeSelect
            aria-label="Branch"
            value={selectedBranch}
            onChange={onBranchChange}
            disabled={
              membership.data?.role !== "OWNER" ||
              !branches.data?.branches?.length ||
              startIndexing.isPending ||
              updateActiveBranch.isPending
            }
            className="min-w-[8.5rem]"
            placeholder={branches.isFetching ? "Loading…" : "No branches"}
            options={(branches.data?.branches ?? []).map((branchName) => ({
              value: branchName,
              label: branchName,
            }))}
          />
          <Button
            type="button"
            variant="outline"
            disabled={
              !project?.id ||
              membership.data?.role !== "OWNER" ||
              !selectedBranch ||
              startIndexing.isPending
            }
            onClick={() => {
              if (!project?.id || !selectedBranch) return;
              startIndexing.mutate({
                projectId: project.id,
                branch: selectedBranch,
              });
            }}
          >
            <RefreshCw
              className={cn(
                "size-4",
                startIndexing.isPending && "animate-spin",
              )}
            />
            {startIndexing.isPending ? "Re-indexing…" : "Re-index repo"}
          </Button>
        </div>
      </div>

      {indexingStatus.data?.job ? (
        <div className="mt-3 space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-ghost">
            <div
              className="h-full bg-ink transition-all"
              style={{
                width: `${
                  indexingStatus.data.job.totalFiles
                    ? Math.max(
                        6,
                        Math.round(
                          (indexingStatus.data.job.processedFiles /
                            indexingStatus.data.job.totalFiles) *
                            100,
                        ),
                      )
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="text-xs text-slate">
            {indexingStatus.data.job.processedFiles}/
            {indexingStatus.data.job.totalFiles || 0} files processed
            {indexingStatus.data.job.failedFiles
              ? ` · ${indexingStatus.data.job.failedFiles} failed`
              : ""}
            {indexingStatus.data.job.branch
              ? ` · Branch ${indexingStatus.data.job.branch}`
              : ""}
          </p>
          {indexingStatus.data.job.errorMessage ? (
            <p className="text-xs text-signal">
              {indexingStatus.data.job.errorMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
