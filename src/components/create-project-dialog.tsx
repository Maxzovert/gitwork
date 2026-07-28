"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { GitworkLogo } from "@/components/gitwork-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";

type FormInput = {
  repoUrl: string;
  projectName: string;
  branch?: string;
};

type CreateProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ONBOARDING_STEPS = [
  {
    title: "Welcome",
    description: "See what Gitwork will do after you connect a repository.",
  },
  {
    title: "Repository",
    description: "Add a project name and the GitHub repository you want to connect.",
  },
  {
    title: "Review",
    description: "Choose a branch and confirm the project setup before indexing starts.",
  },
] as const;

function isGithubRepoUrl(value: string) {
  return /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(value.trim());
}

function getFriendlyGitHubError(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("connect your github") ||
    lower.includes("precondition_failed")
  ) {
    return "Connect GitHub on the Create Project page first, then try again.";
  }
  if (lower.includes("bad credentials") || lower.includes("unauthorized")) {
    return "GitHub authorization was rejected. Reconnect GitHub and try again.";
  }
  if (lower.includes("not found")) {
    return "Gitwork could not access that repository. Check the URL and your GitHub access.";
  }
  if (
    lower.includes("resource not accessible") ||
    lower.includes("forbidden") ||
    lower.includes("permission")
  ) {
    return "GitHub needs the repo scope. Reconnect GitHub and approve repository access.";
  }

  return message || "Project creation failed";
}

function StepBadge({
  step,
  currentStep,
}: {
  step: number;
  currentStep: number;
}) {
  const isActive = step === currentStep;
  const isDone = step < currentStep;

  return (
    <div
      className={[
        "flex size-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
        isDone
          ? "border-[#141413] bg-[#141413] text-[#f3f0ee]"
          : isActive
            ? "border-[#141413] bg-white text-[#141413]"
            : "border-[#d1cdc7] bg-[#f8f5f2] text-[#696969]",
      ].join(" ")}
    >
      {isDone ? <CheckCircle2 className="size-4" /> : step}
    </div>
  );
}

export function CreateProjectDialog({
  open,
  onOpenChange,
}: CreateProjectDialogProps) {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const { register, handleSubmit, reset, watch, setValue } = useForm<FormInput>({
    defaultValues: {
      projectName: "",
      repoUrl: "",
      branch: "",
    },
  });

  const createProject = api.project.createProject.useMutation();
  const { setProjectId } = useProjects();
  const utils = api.useUtils();

  const projectName = watch("projectName");
  const repoUrl = watch("repoUrl");
  const branch = watch("branch");
  const trimmedRepoUrl = repoUrl?.trim() ?? "";
  const repoUrlValid = isGithubRepoUrl(trimmedRepoUrl);

  const branchesQuery = api.project.getBranches.useQuery(
    {
      githubUrl: trimmedRepoUrl,
    },
    {
      enabled: open && step === 3 && repoUrlValid,
      retry: false,
    },
  );

  React.useEffect(() => {
    if (!open) {
      setStep(1);
      reset();
      return;
    }
  }, [open, reset]);

  React.useEffect(() => {
    if (!branch && branchesQuery.data?.defaultBranch) {
      setValue("branch", branchesQuery.data.defaultBranch);
    }
  }, [branch, branchesQuery.data?.defaultBranch, setValue]);

  const branchError = branchesQuery.error
    ? getFriendlyGitHubError(branchesQuery.error.message)
    : null;

  function closeDialog(nextOpen: boolean) {
    if (!nextOpen) {
      setStep(1);
      reset();
    }
    onOpenChange(nextOpen);
  }

  function goNext() {
    if (step === 2) {
      if (!projectName.trim()) {
        toast.error("Add a project name to continue.");
        return;
      }
      if (!repoUrlValid) {
        toast.error("Enter a valid GitHub repository URL like https://github.com/org/repo.");
        return;
      }
    }

    setStep((current) => Math.min(current + 1, ONBOARDING_STEPS.length));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 1));
  }

  function onSubmit(data: FormInput) {
    if (!data.projectName.trim()) {
      toast.error("Add a project name before creating the project.");
      return;
    }

    if (!isGithubRepoUrl(data.repoUrl)) {
      toast.error("Enter a valid GitHub repository URL.");
      return;
    }

    createProject.mutate(
      {
        githubUrl: data.repoUrl.trim(),
        name: data.projectName.trim(),
        branch: data.branch?.trim() || undefined,
      },
      {
        onSuccess: (project) => {
          toast.success("Project created successfully");
          if (project?.id) {
            setProjectId(project.id);
            utils.project.getProjects.setData(undefined, (prev) => {
              const list = prev ?? [];
              if (list.some((p) => p.id === project.id)) return list;
              return [project, ...list];
            });
          }
          void utils.project.getProjects.invalidate();
          reset();
          setStep(1);
          onOpenChange(false);
          router.replace("/dashboard");
        },
        onError: (error) => {
          toast.error(getFriendlyGitHubError(error.message));
        },
      },
    );
  }

  const stepMeta = ONBOARDING_STEPS[step - 1]!;
  const canContinueFromRepository = Boolean(projectName.trim()) && repoUrlValid;

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-[#d1cdc7] bg-[#fcfbfa] p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-[#d1cdc7] bg-[#f8f5f2] px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <GitworkLogo size={36} />
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-display text-xl tracking-[-0.02em] text-[#141413]">
                Create project
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-[#696969]">
                Step {step} of {ONBOARDING_STEPS.length}: {stepMeta.title}
              </DialogDescription>
              <p className="mt-2 text-sm leading-6 text-[#141413]">
                {stepMeta.description}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            {ONBOARDING_STEPS.map((item, index) => (
              <React.Fragment key={item.title}>
                <StepBadge step={index + 1} currentStep={step} />
                {index < ONBOARDING_STEPS.length - 1 ? (
                  <div className="h-px flex-1 bg-[#d1cdc7]" />
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-6 py-6">
          {step === 1 ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#d1cdc7] bg-white p-4">
                <h3 className="text-sm font-semibold text-[#141413]">What Gitwork does next</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[#696969]">
                  <li>Connects your GitHub repository to a shared project workspace.</li>
                  <li>Loads the selected branch and indexes source files for codebase Q&amp;A.</li>
                  <li>Imports recent commits and keeps project activity in one place.</li>
                  <li>Can register a webhook so new pushes sync automatically.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-[#e8e2da] bg-[#fff8f4] p-4 text-sm leading-6 text-[#6b3d26]">
                Authorize GitHub once on the Create page — then add repos without pasting tokens.
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
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
                  className="h-11 rounded-xl border-[#d1cdc7] bg-white text-[#141413] placeholder:text-[#696969]"
                />
                <p className="text-xs text-[#696969]">
                  Uses your connected GitHub account to load branches, index code, and sync commits.
                </p>
                {repoUrl && !repoUrlValid ? (
                  <p className="text-xs text-[#9a3a0a]">
                    Enter a full GitHub URL like `https://github.com/org/repo`.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#d1cdc7] bg-white p-4">
                <h3 className="text-sm font-semibold text-[#141413]">Review project setup</h3>
                <dl className="mt-3 space-y-3 text-sm">
                  <div>
                    <dt className="text-[#696969]">Project name</dt>
                    <dd className="font-medium text-[#141413]">{projectName || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-[#696969]">Repository</dt>
                    <dd className="break-all font-medium text-[#141413]">
                      {trimmedRepoUrl || "Not set"}
                    </dd>
                  </div>
                </dl>
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
                        : "Connect GitHub and add a valid repo to load branches"}
                    </option>
                  )}
                </select>
                <p className="text-xs text-[#696969]">
                  This branch becomes the first code snapshot for indexing, Q&amp;A, and commit context.
                </p>
                {branchError ? (
                  <p className="text-xs text-[#9a3a0a]">{branchError}</p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-[#d1cdc7] bg-[#f8f5f2] p-4 text-sm leading-6 text-[#696969]">
                When you click create, Gitwork will save the project, start indexing the selected branch, pull commits, and try to set up push syncing.
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2 border-t border-[#e8e2da] pt-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-[20px]"
              onClick={step === 1 ? () => closeDialog(false) : goBack}
              disabled={createProject.isPending}
            >
              {step === 1 ? "Cancel" : (
                <>
                  <ChevronLeft className="size-4" />
                  Back
                </>
              )}
            </Button>

            {step < ONBOARDING_STEPS.length ? (
              <Button
                type="button"
                className="h-11 rounded-[20px]"
                onClick={goNext}
                disabled={
                  createProject.isPending ||
                  (step === 2 && !canContinueFromRepository)
                }
              >
                Continue
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={
                  createProject.isPending ||
                  !projectName.trim() ||
                  !repoUrlValid
                }
                className="h-11 rounded-[20px]"
              >
                {createProject.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create project"
                )}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
