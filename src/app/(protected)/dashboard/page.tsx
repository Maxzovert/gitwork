"use client";

import useProjects from "@/hooks/use-projects";
import { ExternalLink, Github, Trash2 } from "lucide-react";
import React from "react";
import CommitLog from "./commit-log";
import AskQuestionCard from "./ask-question";
import MeetingCard from "./meeting-card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { api } from "@/trpc/react";
import { toast } from "sonner";

const Dashboard = () => {
  const { project, projects, projectId, setProjectId } = useProjects();
  const utils = api.useUtils();
  const deleteProject = api.project.deleteProject.useMutation();
  const indexingStatus = api.project.getIndexingStatus.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );
  const { data: membership } = api.project.getMyMembership.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );
  const isOwner = membership?.role === "OWNER";

  const handleDelete = () => {
    if (!project) return;
    if (
      !confirm(
        `Delete project "${project.name}"? Its meetings will no longer appear in the list. This cannot be undone.`,
      )
    ) {
      return;
    }

    deleteProject.mutate(
      { projectId: project.id },
      {
        onSuccess: () => {
          toast.success("Project deleted successfully");
          const remaining =
            projects?.filter((p) => p.id !== project.id) ?? [];
          utils.project.getProjects.setData(undefined, remaining);
          setProjectId(remaining[0]?.id ?? "");
          void utils.project.getProjects.invalidate();
          void utils.project.getMeetings.invalidate();
          void utils.project.getCommits.invalidate();
        },
        onError: (err) => {
          toast.error(err.message || "Failed to delete project");
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={project?.name ?? "Dashboard"}
        description="Ask the codebase, upload meetings, and scan AI commit summaries."
        actions={
          project && isOwner ? (
            <Button
              variant="outline"
              size="sm"
              disabled={deleteProject.isPending}
              onClick={handleDelete}
              className="border-[#d1cdc7] text-[#cf4500] hover:bg-[#cf4500]/10 hover:text-[#cf4500]"
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          ) : null
        }
      />

      {project?.githubUrl ? (
        <a
          href={project.githubUrl}
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-3 rounded-xl border border-[#d1cdc7] bg-[#fcfbfa] px-4 py-3 transition-colors hover:border-[#141413]/30"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#141413] text-[#f3f0ee]">
            <Github className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#696969]">
              Connected repository
            </p>
            <p className="truncate text-sm font-medium text-[#141413] group-hover:underline">
              {project.githubUrl.replace(/^https?:\/\//, "")}
            </p>
            <p className="mt-1 text-xs text-[#696969]">
              Branch: {indexingStatus.data?.project?.activeBranch ?? "Unknown"}
              {indexingStatus.data?.project?.lastIndexedAt
                ? ` · Indexed ${new Date(
                    indexingStatus.data.project.lastIndexedAt,
                  ).toLocaleString()}`
                : ""}
            </p>
          </div>
          <ExternalLink className="size-4 shrink-0 text-[#696969]" />
        </a>
      ) : null}

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-5">
        <AskQuestionCard />
        <MeetingCard />
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
            Recent commits
          </h2>
          <span className="text-xs text-[#696969]">Live via GitHub webhooks</span>
        </div>
        <CommitLog />
      </section>
    </div>
  );
};

export default Dashboard;
