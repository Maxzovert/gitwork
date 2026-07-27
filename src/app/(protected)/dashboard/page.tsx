"use client";
import useProjects from "@/hooks/use-projects";
import { ExternalLink, Github, Trash2 } from "lucide-react";
import Link from "next/link";
import React from "react";
import CommitLog from "./commit-log";
import AskQuestionCard from "./ask-question";
import MeetingCard from "./meeting-card";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { toast } from "sonner";

const dashboard = () => {
  const { project, projects, projectId, setProjectId } = useProjects();
  const utils = api.useUtils();
  const deleteProject = api.project.deleteProject.useMutation();

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
          const remaining = projects?.filter((p) => p.id !== project.id) ?? [];
          setProjectId(remaining[0]?.id ?? "");
          void utils.project.getProjects.invalidate();
          void utils.project.getMeetings.invalidate();
        },
        onError: () => {
          toast.error("Failed to delete project");
        },
      },
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* github link */}
        <div className="bg-primary w-fit rounded-md px-4 py-3">
          <div className="flex items-center">
            <Github className="size-5 text-white" />
            <div className="ml-2"></div>
            <p className="text-sm font-medium text-white">
              This project is linked to{" "}
              <Link
                href={project?.githubUrl ?? ""}
                className="inline-flex items-center text-white/80 hover:underline"
              >
                {project?.githubUrl}
                <ExternalLink className="ml-1 size-4" />
              </Link>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {projectId && (
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteProject.isPending}
              onClick={handleDelete}
            >
              <Trash2 className="size-4" />
              Delete Project
            </Button>
          )}
        </div>
      </div>
      <div className="mt-4"></div>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
        <AskQuestionCard />
        <MeetingCard />
      </div>
      <div className="mt-8"></div>
      <CommitLog />
    </div>
  );
};

export default dashboard;
