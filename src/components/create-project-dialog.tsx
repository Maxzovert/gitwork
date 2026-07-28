"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GitworkLogo } from "@/components/gitwork-logo";
import useRefresh from "@/hooks/use-refresh";
import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";

type FormInput = {
  repoUrl: string;
  projectName: string;
  githubToken?: string;
  branch?: string;
};

type CreateProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateProjectDialog({
  open,
  onOpenChange,
}: CreateProjectDialogProps) {
  const router = useRouter();
  const { register, handleSubmit, reset, watch, setValue } = useForm<FormInput>();
  const createProject = api.project.createProject.useMutation();
  const refetch = useRefresh();
  const { setProjectId } = useProjects();
  const utils = api.useUtils();
  const repoUrl = watch("repoUrl");
  const githubToken = watch("githubToken");
  const branch = watch("branch");

  const branchesQuery = api.project.getBranches.useQuery(
    {
      githubUrl: repoUrl ?? "",
      githubToken,
    },
    {
      enabled: open && /^https:\/\/github\.com\/.+\/.+/.test(repoUrl ?? ""),
      retry: false,
    },
  );

  React.useEffect(() => {
    if (!branch && branchesQuery.data?.defaultBranch) {
      setValue("branch", branchesQuery.data.defaultBranch);
    }
  }, [branch, branchesQuery.data?.defaultBranch, setValue]);

  function onSubmit(data: FormInput) {
    createProject.mutate(
      {
        githubUrl: data.repoUrl,
        name: data.projectName,
        githubToken: data.githubToken,
        branch: data.branch,
      },
      {
        onSuccess: async (project) => {
          toast.success("Project created successfully");
          reset();
          onOpenChange(false);
          await utils.project.getProjects.invalidate();
          await refetch();
          if (project?.id) {
            setProjectId(project.id);
          }
          router.push("/dashboard");
        },
        onError: (error) => {
          toast.error(error.message || "Project creation failed");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-[#d1cdc7] bg-[#fcfbfa] p-0 sm:max-w-md">
        <DialogHeader className="border-b border-[#d1cdc7] px-6 py-5 text-left">
          <div className="flex items-center gap-3">
            <GitworkLogo size={36} />
            <div>
              <DialogTitle className="font-display text-xl tracking-[-0.02em] text-[#141413]">
                Create project
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-[#696969]">
                Link a GitHub repository to your workspace.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 px-6 py-5"
        >
          <div className="space-y-2">
            <label
              htmlFor="create-project-name"
              className="text-sm font-medium text-[#141413]"
            >
              Project name
            </label>
            <Input
              id="create-project-name"
              {...register("projectName", { required: true })}
              placeholder="e.g. Placement"
              required
              className="h-11 rounded-xl border-[#d1cdc7] bg-white text-[#141413] placeholder:text-[#696969]"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="create-repo-url"
              className="text-sm font-medium text-[#141413]"
            >
              GitHub repository URL
            </label>
            <Input
              id="create-repo-url"
              {...register("repoUrl", { required: true })}
              placeholder="https://github.com/org/repo"
              type="url"
              required
              className="h-11 rounded-xl border-[#d1cdc7] bg-white text-[#141413] placeholder:text-[#696969]"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="create-github-token"
              className="text-sm font-medium text-[#141413]"
            >
              GitHub token{" "}
              <span className="font-normal text-[#696969]">(optional)</span>
            </label>
            <Input
              id="create-github-token"
              {...register("githubToken")}
              placeholder="Needed for private repositories"
              className="h-11 rounded-xl border-[#d1cdc7] bg-white text-[#141413] placeholder:text-[#696969]"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="create-branch"
              className="text-sm font-medium text-[#141413]"
            >
              Branch
            </label>
            <select
              id="create-branch"
              {...register("branch")}
              disabled={branchesQuery.isLoading || !branchesQuery.data?.branches.length}
              className="h-11 w-full rounded-xl border border-[#d1cdc7] bg-white px-3 text-sm text-[#141413] disabled:opacity-60"
            >
              {branchesQuery.data?.branches?.length ? (
                branchesQuery.data.branches.map((branchName) => (
                  <option key={branchName} value={branchName}>
                    {branchName}
                  </option>
                ))
              ) : (
                <option value="">
                  {branchesQuery.isLoading
                    ? "Loading branches…"
                    : "Enter repo URL to load branches"}
                </option>
              )}
            </select>
            <p className="text-xs text-[#696969]">
              This branch becomes the initial codebase snapshot for Q&A and indexing.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-[20px]"
              onClick={() => onOpenChange(false)}
              disabled={createProject.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProject.isPending}
              className="h-11 flex-1 rounded-[20px]"
            >
              {createProject.isPending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
