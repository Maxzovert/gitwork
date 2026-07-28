"use client";

import React, { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderGit2,
  GitBranch,
  Github,
  Loader2,
  Workflow,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { GitworkLogo } from "@/components/gitwork-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useProjects from "@/hooks/use-projects";
import { GITHUB_REPO_SCOPES } from "@/lib/github-scopes";
import { api } from "@/trpc/react";

type FormInput = {
  repoUrl: string;
  projectName: string;
  branch?: string;
};

const ONBOARDING_STEPS = [
  {
    title: "Welcome",
    description: "Connect a repository and let Gitwork build your project context.",
  },
  {
    title: "Connect GitHub",
    description: "Authorize once. Add as many repositories as you need after that.",
  },
  {
    title: "Repository",
    description: "Name the project and choose a GitHub repository you can access.",
  },
  {
    title: "Review",
    description: "Pick the branch and confirm the setup before indexing starts.",
  },
] as const;

const DECORATIVE_FLOATS = [
  {
    src: "/decorative/git-branch.svg",
    className: "left-4 top-[18%] rotate-[-8deg] xl:left-6",
    width: 64,
    height: 86,
  },
  {
    src: "/decorative/network-nodes.svg",
    className: "right-6 top-[14%] rotate-[6deg] xl:right-10",
    width: 88,
    height: 74,
  },
  {
    src: "/decorative/code-braces.svg",
    className: "bottom-[18%] right-8 rotate-[-5deg] xl:right-12",
    width: 48,
    height: 48,
  },
] as const;

const LOGO_FLOATS = [
  {
    src: "/onboarding/github-logo.png",
    className: "left-[6%] top-[42%] rotate-[5deg]",
    width: 44,
    height: 44,
  },
  {
    src: "/onboarding/teams-logo.png",
    className: "right-[7%] top-[38%] rotate-[-7deg]",
    width: 46,
    height: 46,
  },
  {
    src: "/onboarding/meet-logo.png",
    className: "left-[8%] bottom-[16%] rotate-[-6deg]",
    width: 46,
    height: 46,
  },
  {
    src: "/onboarding/zoom-logo.png",
    className: "right-[8%] bottom-[22%] rotate-[5deg]",
    width: 64,
    height: 32,
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
    return "Connect GitHub with repository access, then try again.";
  }
  if (lower.includes("bad credentials") || lower.includes("unauthorized")) {
    return "GitHub authorization expired or was rejected. Reconnect GitHub and try again.";
  }
  if (lower.includes("not found")) {
    return "Gitwork could not access that repository. Pick a repo your GitHub account can see.";
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

export function CreateProjectOnboarding() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const { user, isLoaded: userLoaded } = useUser();
  const [step, setStep] = React.useState(1);
  const [connecting, setConnecting] = React.useState(false);
  const [repoFilter, setRepoFilter] = React.useState("");
  const { register, handleSubmit, watch, setValue } = useForm<FormInput>({
    defaultValues: {
      projectName: "",
      repoUrl: "",
      branch: "",
    },
  });

  const createProject = api.project.createProject.useMutation();
  const { projects, setProjectId } = useProjects();
  const utils = api.useUtils();

  const githubStatus = api.project.getGithubStatus.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });

  const projectName = watch("projectName");
  const repoUrl = watch("repoUrl");
  const branch = watch("branch");

  const trimmedRepoUrl = repoUrl?.trim() ?? "";
  const repoUrlValid = isGithubRepoUrl(trimmedRepoUrl);
  const hasExistingProjects = Boolean(projects?.length);
  const githubReady = Boolean(
    githubStatus.data?.connected && githubStatus.data?.hasToken,
  );

  const reposQuery = api.project.listGithubRepos.useQuery(undefined, {
    enabled: githubReady && (step === 3 || step === 4),
    retry: false,
  });

  const branchesQuery = api.project.getBranches.useQuery(
    { githubUrl: trimmedRepoUrl },
    {
      enabled: step === 4 && repoUrlValid && githubReady,
      retry: false,
    },
  );

  React.useEffect(() => {
    if (!branch && branchesQuery.data?.defaultBranch) {
      setValue("branch", branchesQuery.data.defaultBranch);
    }
  }, [branch, branchesQuery.data?.defaultBranch, setValue]);

  React.useEffect(() => {
    if (step === 2 && githubReady) {
      // Already authorized — skip friction on return from OAuth
    }
  }, [githubReady, step]);

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return;

      gsap.set("[data-onboard-aside]", { opacity: 0, x: -20 });
      gsap.set("[data-onboard-main]", { opacity: 0, y: 16 });
      gsap.set("[data-onboard-rail]", { scaleX: 0, transformOrigin: "left center" });
      gsap.set("[data-onboard-float]", { opacity: 0, scale: 0.92 });

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .to("[data-onboard-aside]", { opacity: 1, x: 0, duration: 0.7 })
        .to("[data-onboard-main]", { opacity: 1, y: 0, duration: 0.65 }, "-=0.4")
        .to("[data-onboard-rail]", { scaleX: 1, duration: 0.55 }, "-=0.35")
        .to(
          "[data-onboard-float]",
          { opacity: 1, scale: 1, duration: 0.75, stagger: 0.07 },
          "-=0.45",
        );

      gsap.utils.toArray<HTMLElement>("[data-onboard-float]").forEach((el, i) => {
        gsap.to(el, {
          y: i % 2 === 0 ? -8 : 7,
          x: i % 3 === 0 ? 3 : -3,
          rotation: `+=${i % 2 === 0 ? 1.5 : -1.5}`,
          repeat: -1,
          yoyo: true,
          duration: 3.8 + (i % 4) * 0.4,
          ease: "sine.inOut",
          delay: i * 0.1,
        });
      });
    },
    { scope: root },
  );

  React.useEffect(() => {
    const panel = root.current?.querySelector("[data-onboard-panel]");
    if (!panel) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    gsap.fromTo(
      panel,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.28, ease: "power2.out" },
    );
  }, [step]);

  async function connectGithub() {
    if (!user) {
      toast.error("Sign in first, then connect GitHub.");
      return;
    }

    setConnecting(true);
    try {
      const redirectUrl = `${window.location.origin}/create`;
      const existing = user.externalAccounts.find(
        (account) => account.provider === "github",
      );

      if (existing) {
        const reauth = await existing.reauthorize({
          additionalScopes: [...GITHUB_REPO_SCOPES],
          redirectUrl,
        });
        const url = reauth.verification?.externalVerificationRedirectURL;
        if (url) {
          window.location.href = url.href;
          return;
        }
      } else {
        const external = await user.createExternalAccount({
          strategy: "oauth_github",
          redirectUrl,
          additionalScopes: [...GITHUB_REPO_SCOPES],
        });
        const url = external.verification?.externalVerificationRedirectURL;
        if (url) {
          window.location.href = url.href;
          return;
        }
      }

      await user.reload();
      await utils.project.getGithubStatus.invalidate();
      toast.success("GitHub connected.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start GitHub authorization.";
      toast.error(message);
    } finally {
      setConnecting(false);
    }
  }

  function selectRepo(url: string, nameHint?: string) {
    setValue("repoUrl", url);
    if (!projectName?.trim() && nameHint) {
      setValue("projectName", nameHint);
    }
  }

  function goBack() {
    if (step === 1) {
      router.replace("/dashboard");
      return;
    }
    setStep((current) => Math.max(current - 1, 1));
  }

  function goNext() {
    if (step === 2 && !githubReady) {
      toast.error("Connect GitHub before continuing.");
      return;
    }

    if (step === 3) {
      if (!projectName?.trim()) {
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

  function onSubmit(data: FormInput) {
    if (step < ONBOARDING_STEPS.length) {
      goNext();
      return;
    }

    if (!githubReady) {
      toast.error("Connect GitHub before creating the project.");
      return;
    }
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
          router.replace("/dashboard");
        },
        onError: (error) => {
          toast.error(getFriendlyGitHubError(error.message));
        },
      },
    );
  }

  const branchError = branchesQuery.error
    ? getFriendlyGitHubError(branchesQuery.error.message)
    : null;

  const stepMeta = ONBOARDING_STEPS[step - 1]!;
  const progress = step / ONBOARDING_STEPS.length;
  const filteredRepos =
    reposQuery.data?.filter((repo) => {
      if (!repoFilter.trim()) return true;
      const q = repoFilter.trim().toLowerCase();
      return (
        repo.fullName.toLowerCase().includes(q) ||
        (repo.description?.toLowerCase().includes(q) ?? false)
      );
    }) ?? [];

  return (
    <div
      ref={root}
      className="relative min-h-screen overflow-hidden bg-[#f3f0ee] text-[#141413]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 12% 18%, rgba(207,69,0,0.07), transparent 55%), radial-gradient(ellipse 55% 45% at 88% 82%, rgba(56,96,190,0.06), transparent 50%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[42%] border-r border-[#d1cdc7]/60 lg:block"
        style={{
          background:
            "linear-gradient(165deg, #fcfbfa 0%, #f3f0ee 48%, #ebe6e0 100%)",
        }}
      />

      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {DECORATIVE_FLOATS.map((item) => (
          <div
            key={item.src}
            data-onboard-float
            className={`absolute hidden opacity-30 xl:block ${item.className}`}
          >
            <Image
              src={item.src}
              alt=""
              width={item.width}
              height={item.height}
              className="select-none"
            />
          </div>
        ))}
        {LOGO_FLOATS.map((item) => (
          <div
            key={item.src}
            data-onboard-float
            className={`absolute hidden rounded-xl bg-white/85 p-2 shadow-[0_8px_20px_rgba(20,20,19,0.06)] ring-1 ring-[#d1cdc7]/60 xl:block ${item.className}`}
          >
            <Image
              src={item.src}
              alt=""
              width={item.width}
              height={item.height}
              className="select-none object-contain"
            />
          </div>
        ))}
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <aside
          data-onboard-aside
          className="flex flex-col justify-between px-6 pt-8 pb-6 sm:px-10 lg:px-12 lg:py-12"
        >
          <div>
            <div className="flex items-center justify-between gap-4">
              <Link
                href={hasExistingProjects ? "/dashboard" : "/"}
                className="inline-flex transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <GitworkLogo size={56} withWordmark className="gap-3.5 sm:gap-4" />
              </Link>
              {hasExistingProjects ? (
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="text-sm font-medium text-[#696969] underline-offset-4 hover:text-[#141413] hover:underline"
                >
                  Dashboard
                </button>
              ) : null}
            </div>

            <div className="mt-12 lg:mt-16">
              <p className="text-[11px] font-bold tracking-[0.18em] text-[#696969] uppercase">
                New project
              </p>
              <h1 className="mt-3 max-w-[12ch] font-display text-5xl leading-[1.02] tracking-[-0.045em] text-[#141413] sm:text-6xl lg:text-[4rem]">
                {stepMeta.title}
              </h1>
              <p className="mt-4 max-w-[22rem] text-[15px] leading-7 text-[#696969] sm:text-base">
                {stepMeta.description}
              </p>
            </div>

            <div className="mt-10 lg:mt-14">
              <p className="mb-3 font-display text-sm font-semibold tabular-nums tracking-[-0.02em] text-[#141413]">
                {String(step).padStart(2, "0")}{" "}
                <span className="font-medium text-[#696969]">/</span>{" "}
                <span className="font-medium text-[#696969]">
                  {String(ONBOARDING_STEPS.length).padStart(2, "0")}
                </span>
              </p>
              <div
                data-onboard-rail
                className="h-[3px] w-full max-w-xs overflow-hidden rounded-full bg-[#d1cdc7]/70"
              >
                <div
                  className="h-full rounded-full bg-[#cf4500] transition-[width] duration-300 ease-out"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <nav aria-label="Onboarding steps" className="mt-6 space-y-3">
                {ONBOARDING_STEPS.map((item, index) => {
                  const n = index + 1;
                  const isActive = n === step;
                  const isDone = n < step;
                  return (
                    <div
                      key={item.title}
                      className={[
                        "flex items-baseline gap-3.5 text-[15px] transition-colors",
                        isActive
                          ? "text-[#141413]"
                          : isDone
                            ? "text-[#696969]"
                            : "text-[#c4bfb8]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "w-7 font-semibold tabular-nums tracking-tight",
                          isActive ? "text-[#cf4500]" : "",
                        ].join(" ")}
                      >
                        {String(n).padStart(2, "0")}
                      </span>
                      <span
                        className={[
                          "tracking-[-0.015em]",
                          isActive ? "font-semibold" : "font-medium",
                        ].join(" ")}
                      >
                        {item.title}
                      </span>
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>

          <p className="mt-10 hidden max-w-xs text-xs leading-5 text-[#696969] lg:block">
            Gitwork indexes your branch, syncs commits, and builds shared context for Q&amp;A and meetings.
          </p>
        </aside>

        <main
          data-onboard-main
          className="flex flex-col justify-center px-6 pb-10 sm:px-10 lg:px-14 lg:py-12"
        >
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex min-h-[420px] flex-col justify-between"
          >
            <div data-onboard-panel className="max-w-lg">
              {step === 1 ? (
                <div className="space-y-8">
                  <ul className="space-y-6">
                    <li className="flex gap-4">
                      <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#cf4500]/12 text-[#cf4500]">
                        <FolderGit2 className="size-4" />
                      </span>
                      <div>
                        <p className="font-display text-lg tracking-[-0.02em] text-[#141413]">
                          Shared workspace
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#696969]">
                          Links your repository to a shared project space your team can use.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f37338]/15 text-[#f37338]">
                        <GitBranch className="size-4" />
                      </span>
                      <div>
                        <p className="font-display text-lg tracking-[-0.02em] text-[#141413]">
                          Branch indexing
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#696969]">
                          Loads the selected branch and indexes source files for Q&amp;A.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#3860be]/12 text-[#3860be]">
                        <Workflow className="size-4" />
                      </span>
                      <div>
                        <p className="font-display text-lg tracking-[-0.02em] text-[#141413]">
                          Commit sync
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#696969]">
                          Pulls commits and can register a webhook for future push sync.
                        </p>
                      </div>
                    </li>
                  </ul>
                  <p className="border-l-2 border-[#cf4500]/50 pl-4 text-sm leading-6 text-[#696969]">
                    Authorize GitHub once — then add any repo you can access, without pasting tokens.
                  </p>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-6">
                  {githubReady ? (
                    <div className="rounded-xl border border-[#d1cdc7]/80 bg-[#fcfbfa] p-5">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#2f6b3a]" />
                        <div>
                          <p className="font-medium text-[#141413]">
                            {githubStatus.data?.usingServerFallback
                              ? "Using server GitHub access"
                              : `GitHub connected${
                                  githubStatus.data?.username
                                    ? ` as @${githubStatus.data.username}`
                                    : ""
                                }`}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-[#696969]">
                            {githubStatus.data?.usingServerFallback
                              ? "GITHUB_TOKEN is set on the server. You can still authorize your own GitHub account below."
                              : "You can add repositories without pasting a personal access token."}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <ul className="space-y-2.5 text-sm leading-6 text-[#696969]">
                        <li className="flex gap-2">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-[#cf4500]" />
                          Read repositories you can access for indexing and Q&amp;A.
                        </li>
                        <li className="flex gap-2">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-[#cf4500]" />
                          Load branches, commits, and open pull requests.
                        </li>
                        <li className="flex gap-2">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-[#cf4500]" />
                          Register webhooks so new pushes stay in sync.
                        </li>
                      </ul>
                      <Button
                        type="button"
                        className="h-12 w-full rounded-xl"
                        onClick={() => void connectGithub()}
                        disabled={!userLoaded || connecting}
                      >
                        {connecting ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Connecting…
                          </>
                        ) : (
                          <>
                            <Github className="size-4" />
                            Authorize with GitHub
                          </>
                        )}
                      </Button>
                      <p className="text-xs leading-5 text-[#696969]">
                        Uses Clerk GitHub OAuth with the <code className="text-[#141413]">repo</code>{" "}
                        scope. Enable GitHub SSO + custom credentials in the Clerk dashboard.
                      </p>
                    </div>
                  )}

                  {githubReady ? (
                    <button
                      type="button"
                      onClick={() => void connectGithub()}
                      className="text-sm font-medium text-[#3860be] underline-offset-4 hover:underline"
                      disabled={connecting}
                    >
                      Re-authorize for more scopes
                    </button>
                  ) : null}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-6">
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
                      className="h-12 rounded-xl border-[#d1cdc7] bg-[#fcfbfa] text-[#141413] placeholder:text-[#696969]"
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
                      className="h-12 rounded-xl border-[#d1cdc7] bg-[#fcfbfa] text-[#141413] placeholder:text-[#696969]"
                    />
                    {repoUrl && !repoUrlValid ? (
                      <p className="text-xs text-[#9a3a0a]">
                        Enter a full GitHub URL like `https://github.com/org/repo`.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[#141413]">Your repositories</p>
                      {reposQuery.isFetching ? (
                        <Loader2 className="size-3.5 animate-spin text-[#696969]" />
                      ) : null}
                    </div>
                    <Input
                      value={repoFilter}
                      onChange={(event) => setRepoFilter(event.target.value)}
                      placeholder="Filter repos…"
                      className="h-10 rounded-xl border-[#d1cdc7] bg-[#fcfbfa] text-[#141413] placeholder:text-[#696969]"
                    />
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-[#d1cdc7]/80 bg-[#fcfbfa]">
                      {reposQuery.error ? (
                        <p className="p-3 text-xs text-[#9a3a0a]">
                          {getFriendlyGitHubError(reposQuery.error.message)}
                        </p>
                      ) : filteredRepos.length ? (
                        <ul className="divide-y divide-[#d1cdc7]/70">
                          {filteredRepos.slice(0, 40).map((repo) => {
                            const selected = trimmedRepoUrl === repo.url;
                            return (
                              <li key={repo.fullName}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    selectRepo(repo.url, repo.fullName.split("/")[1])
                                  }
                                  className={[
                                    "flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors",
                                    selected
                                      ? "bg-[#cf4500]/10"
                                      : "hover:bg-[#f3f0ee]",
                                  ].join(" ")}
                                >
                                  <span className="text-sm font-medium text-[#141413]">
                                    {repo.fullName}
                                  </span>
                                  {repo.description ? (
                                    <span className="line-clamp-1 text-xs text-[#696969]">
                                      {repo.description}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="p-3 text-xs text-[#696969]">
                          {reposQuery.isLoading
                            ? "Loading repositories…"
                            : "No repositories found. Paste a URL above instead."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-6">
                  <dl className="space-y-4 border-y border-[#d1cdc7]/80 py-5 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-[#696969]">Project name</dt>
                      <dd className="text-right font-medium text-[#141413]">
                        {projectName || "Not set"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-[#696969]">Repository</dt>
                      <dd className="max-w-[65%] break-all text-right font-medium text-[#141413]">
                        {trimmedRepoUrl || "Not set"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-[#696969]">GitHub</dt>
                      <dd className="font-medium text-[#141413]">
                        {githubReady
                          ? githubStatus.data?.username
                            ? `@${githubStatus.data.username}`
                            : "Connected"
                          : "Not connected"}
                      </dd>
                    </div>
                  </dl>

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
                      className="h-12 w-full rounded-xl border border-[#d1cdc7] bg-[#fcfbfa] px-3 text-sm text-[#141413] disabled:opacity-60"
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
                            : "Select a valid repo to load branches"}
                        </option>
                      )}
                    </select>
                    <p className="text-xs leading-5 text-[#696969]">
                      This branch becomes the first code snapshot for indexing, Q&amp;A, and commit context.
                    </p>
                    {branchError ? (
                      <p className="text-xs text-[#9a3a0a]">{branchError}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-10 flex max-w-lg flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                className="h-11 px-3 text-[#696969] hover:bg-transparent hover:text-[#141413]"
                onClick={goBack}
                disabled={createProject.isPending}
              >
                <ChevronLeft className="size-4" />
                {step === 1 ? "Exit" : "Back"}
              </Button>

              {step < ONBOARDING_STEPS.length ? (
                <Button
                  type="button"
                  className="h-11 min-w-[9.5rem] rounded-xl"
                  onClick={goNext}
                  disabled={
                    createProject.isPending ||
                    (step === 2 && !githubReady)
                  }
                >
                  Continue
                  <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="h-11 min-w-[9.5rem] rounded-xl"
                  disabled={
                    createProject.isPending ||
                    !projectName?.trim() ||
                    !repoUrlValid ||
                    !githubReady
                  }
                >
                  {createProject.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      Create project
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
