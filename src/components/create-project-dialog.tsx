"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
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
  githubToken?: string;
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
    title: "GitHub token",
    description: "Provide access so Gitwork can load code, branches, and sync updates.",
  },
  {
    title: "Get a token",
    description: "Follow the GitHub steps to create the right token with the right permissions.",
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

  if (lower.includes("github token is required")) {
    return "Add a GitHub token in step 3 so Gitwork can read the repository and start indexing.";
  }
  if (lower.includes("bad credentials") || lower.includes("unauthorized")) {
    return "That GitHub token was rejected. Check that you pasted the full token and that it has access to this repository.";
  }
  if (lower.includes("not found")) {
    return "Gitwork could not access that repository. Check the URL and confirm the token can access it.";
  }
  if (
    lower.includes("resource not accessible") ||
    lower.includes("forbidden") ||
    lower.includes("permission")
  ) {
    return "The token does not have enough GitHub permissions. Use a fine-grained token with repository access and contents read permission.";
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
      githubToken: "",
      branch: "",
    },
  });

  const createProject = api.project.createProject.useMutation();
  const { setProjectId } = useProjects();
  const utils = api.useUtils();

  const projectName = watch("projectName");
  const repoUrl = watch("repoUrl");
  const githubToken = watch("githubToken");
  const branch = watch("branch");
  const trimmedRepoUrl = repoUrl?.trim() ?? "";
  const repoUrlValid = isGithubRepoUrl(trimmedRepoUrl);
  const tokenProvided = Boolean(githubToken?.trim());

  const branchesQuery = api.project.getBranches.useQuery(
    {
      githubUrl: trimmedRepoUrl,
      githubToken: githubToken?.trim() || undefined,
    },
    {
      enabled: open && step === 5 && repoUrlValid,
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

    if (step === 3 && !githubToken?.trim()) {
      toast.error(
        "Paste a GitHub token to continue, or set GITHUB_TOKEN on the server if you want to use a shared token.",
      );
      return;
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

    if (!data.githubToken?.trim()) {
      toast.error("Add a GitHub token before creating the project.");
      return;
    }

    createProject.mutate(
      {
        githubUrl: data.repoUrl.trim(),
        name: data.projectName.trim(),
        githubToken: data.githubToken.trim(),
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
                Gitwork needs GitHub access up front because project creation starts indexing and sync work immediately after setup.
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
                  Gitwork will use this repository to load branches, index code, and sync commits.
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
                <h3 className="text-sm font-semibold text-[#141413]">Why Gitwork asks for a token</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[#696969]">
                  <li>Read the repository contents for indexing and file-aware Q&amp;A.</li>
                  <li>Load available branches and pick the default branch automatically.</li>
                  <li>Pull recent commits and optionally register a webhook for future sync.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="create-github-token"
                  className="text-sm font-medium text-[#141413]"
                >
                  GitHub token
                </label>
                <Input
                  id="create-github-token"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  {...register("githubToken")}
                  placeholder="Paste your GitHub personal access token"
                  className="h-11 rounded-xl border-[#d1cdc7] bg-white text-[#141413] placeholder:text-[#696969]"
                />
                <p className="text-xs text-[#696969]">
                  Use a fine-grained personal access token with access to this repository.
                </p>
              </div>

              <div className="rounded-2xl border border-[#e8e2da] bg-[#fff8f4] p-4">
                <p className="text-sm font-medium text-[#141413]">Recommended permissions</p>
                <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[#696969]">
                  <li>`Contents: Read`</li>
                  <li>`Metadata: Read`</li>
                  <li>`Webhooks` or repository admin write access if you want push webhook setup</li>
                </ul>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#d1cdc7] bg-white p-4">
                <h3 className="text-sm font-semibold text-[#141413]">How to get the token from GitHub</h3>
                <ol className="mt-3 space-y-2 pl-5 text-sm leading-6 text-[#696969]">
                  <li>Open GitHub and go to `Settings`.</li>
                  <li>Open `Developer settings`.</li>
                  <li>Select `Personal access tokens` and then `Fine-grained tokens`.</li>
                  <li>Create a new token for the repository you want to connect.</li>
                  <li>Grant `Contents: Read` and metadata access.</li>
                  <li>Add webhook or admin write permission if you want auto sync via webhook.</li>
                  <li>Copy the token and paste it into step 3.</li>
                </ol>
              </div>

              <Link
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#3860be] underline-offset-4 hover:underline"
              >
                Open GitHub token settings
                <ExternalLink className="size-4" />
              </Link>

              <div className="rounded-2xl border border-[#e8e2da] bg-[#fff8f4] p-4 text-sm leading-6 text-[#6b3d26]">
                Keep the token somewhere safe. GitHub may only show the full value once after creation.
              </div>
            </div>
          ) : null}

          {step === 5 ? (
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
                  <div>
                    <dt className="text-[#696969]">GitHub token</dt>
                    <dd className="font-medium text-[#141413]">
                      {tokenProvided ? "Added" : "Missing"}
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
                        : "Add a valid repo and token to load branches"}
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
                  !repoUrlValid ||
                  !githubToken?.trim()
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
