"use client";

import React, { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowRight,
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
import { api } from "@/trpc/react";

const CREATE_STEP_KEY = "gitwork-create-step";
const CREATE_SKIPPED_CONNECT_KEY = "gitwork-create-skipped-connect";
const CREATE_FORCE_CONNECT_KEY = "gitwork-create-force-connect";
const STATUS_POLL_MS = 8_000;

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
    description: "Authorize GitHub so Gitwork can list repos, index code, and sync commits.",
  },
  {
    title: "Repository",
    description: "Name the project and paste a GitHub repository URL you can access.",
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
    src: "/onboarding/teams-logo.png",
    className: "right-[7%] top-[38%] rotate-[-7deg]",
    width: 46,
    height: 46,
  },
  {
    src: "/onboarding/meet-logo.png",
    className: "left-[4%] bottom-[14%] rotate-[-6deg]",
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

const CREATE_GITHUB_RETURN = "/create";

function githubConnectHref() {
  const params = new URLSearchParams({
    returnTo: CREATE_GITHUB_RETURN,
    connection: "github",
    connection_scope: "repo",
    prompt: "consent",
  });
  return `/auth/login?${params.toString()}`;
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

function readSessionFlag(key: string) {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string, value: boolean) {
  try {
    if (value) sessionStorage.setItem(key, "1");
    else sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function CreateProjectOnboarding() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [step, setStep] = React.useState(() => {
    if (typeof window === "undefined") return 1;
    const saved = Number(sessionStorage.getItem(CREATE_STEP_KEY) || "1");
    const n = Number.isFinite(saved) ? saved : 1;
    // Old 3-step sessions: clamp into the new 1–4 range without inventing a blank step.
    return n >= 1 && n <= ONBOARDING_STEPS.length ? n : 1;
  });
  const [repoFilter, setRepoFilter] = React.useState("");
  const [skippedConnect, setSkippedConnect] = React.useState(() =>
    readSessionFlag(CREATE_SKIPPED_CONNECT_KEY),
  );
  const [forceConnectStay, setForceConnectStay] = React.useState(() =>
    readSessionFlag(CREATE_FORCE_CONNECT_KEY),
  );
  const [statusPollTimedOut, setStatusPollTimedOut] = React.useState(false);
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
  const hasUserGithub = Boolean(githubStatus.data?.connected);
  const signedInWithGithub = Boolean(githubStatus.data?.signedInWithGithub);
  const githubReady = Boolean(githubStatus.data?.hasToken);
  const githubStatusLoading = githubStatus.isLoading && !githubStatus.data;
  const githubStatusSettled =
    Boolean(githubStatus.data) || statusPollTimedOut || !githubStatus.isFetching;
  const repoFieldsValid = Boolean(projectName?.trim()) && repoUrlValid;

  const canContinue =
    step === 1 ||
    (step === 2 && (githubReady || skippedConnect || statusPollTimedOut)) ||
    (step === 3 && repoFieldsValid);

  const reposQuery = api.project.listGithubRepos.useQuery(undefined, {
    enabled: githubReady && step === 3,
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
    try {
      sessionStorage.setItem(CREATE_STEP_KEY, String(step));
    } catch {
      // ignore quota / private mode
    }
  }, [step]);

  React.useEffect(() => {
    writeSessionFlag(CREATE_SKIPPED_CONNECT_KEY, skippedConnect);
  }, [skippedConnect]);

  React.useEffect(() => {
    writeSessionFlag(CREATE_FORCE_CONNECT_KEY, forceConnectStay);
  }, [forceConnectStay]);

  // On Connect: poll status until token is ready or timeout (~8s).
  React.useEffect(() => {
    if (step !== 2) {
      setStatusPollTimedOut(false);
      return;
    }
    if (githubReady) {
      setStatusPollTimedOut(false);
      return;
    }

    setStatusPollTimedOut(false);
    const started = Date.now();
    const tick = window.setInterval(() => {
      void utils.project.getGithubStatus.invalidate();
      if (Date.now() - started >= STATUS_POLL_MS) {
        setStatusPollTimedOut(true);
        window.clearInterval(tick);
      }
    }, 1500);

    return () => window.clearInterval(tick);
  }, [step, githubReady, utils.project.getGithubStatus]);

  // Auto-advance Connect → Repository once token is ready (unless user forced stay via Back).
  React.useEffect(() => {
    if (step !== 2) return;
    if (!githubReady || forceConnectStay || skippedConnect) return;
    setStep(3);
  }, [step, githubReady, forceConnectStay, skippedConnect]);

  React.useEffect(() => {
    if (!branch && branchesQuery.data?.defaultBranch) {
      setValue("branch", branchesQuery.data.defaultBranch);
    }
  }, [branch, branchesQuery.data?.defaultBranch, setValue]);

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

  function selectRepo(url: string, nameHint?: string) {
    setValue("repoUrl", url);
    if (!projectName?.trim() && nameHint) {
      setValue("projectName", nameHint);
    }
  }

  function skipConnect() {
    setSkippedConnect(true);
    setForceConnectStay(false);
    setStep(3);
  }

  function goBack() {
    if (step === 1) {
      if (hasExistingProjects) {
        router.replace("/projects");
      }
      return;
    }

    if (step === 3) {
      // Returning to Connect — disable auto-skip until they leave again.
      setForceConnectStay(true);
    }

    setStep((current) => Math.max(current - 1, 1));
  }

  function goNext() {
    if (step === 1) {
      setForceConnectStay(false);
      setStep(2);
      return;
    }

    if (step === 2) {
      if (githubReady) {
        setSkippedConnect(false);
        setForceConnectStay(false);
        setStep(3);
        return;
      }
      if (skippedConnect || statusPollTimedOut) {
        skipConnect();
        return;
      }
      toast.error(
        "Connect GitHub, add a token in Settings, or skip for now to paste a repo URL.",
      );
      return;
    }

    if (step === 3) {
      if (!projectName?.trim()) {
        toast.error("Add a project name to continue.");
        return;
      }
      if (!repoUrlValid) {
        toast.error(
          "Enter a valid GitHub repository URL like https://github.com/org/repo.",
        );
        return;
      }
      setStep(4);
    }
  }

  function onSubmit(data: FormInput) {
    if (step < ONBOARDING_STEPS.length) {
      goNext();
      return;
    }

    if (!githubReady) {
      toast.error(
        "GitHub access is required to create a project. Connect GitHub or add a token in Settings.",
      );
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
          try {
            sessionStorage.removeItem(CREATE_STEP_KEY);
            sessionStorage.removeItem(CREATE_SKIPPED_CONNECT_KEY);
            sessionStorage.removeItem(CREATE_FORCE_CONNECT_KEY);
          } catch {
            // ignore
          }
          if (project?.id) {
            setProjectId(project.id);
            utils.project.getProjects.setData(undefined, (prev) => {
              const list = prev ?? [];
              if (list.some((p) => p.id === project.id)) return list;
              return [{ ...project, role: "OWNER" as const }, ...list];
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

  const connectPolling =
    step === 2 && !githubReady && !statusPollTimedOut && (githubStatusLoading || githubStatus.isFetching || !githubStatusSettled);

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
          className="relative flex flex-col justify-between overflow-hidden px-6 pt-8 pb-6 sm:px-10 lg:px-12 lg:py-12"
        >
          <div>
            <div className="flex items-center gap-4">
              <Link
                href={hasExistingProjects ? "/projects" : "/create"}
                className="inline-flex transition-transform hover:scale-[1.02] active:scale-[0.98]"
                onClick={(e) => {
                  if (!hasExistingProjects) e.preventDefault();
                }}
              >
                <GitworkLogo size={56} withWordmark className="gap-3.5 sm:gap-4" />
              </Link>
            </div>

            <div className="mt-12 lg:mt-16">
              <p className="text-[11px] font-bold tracking-[0.18em] text-[#696969] uppercase">
                New project
              </p>
              <h1 className="mt-3 max-w-[14rem] font-display text-5xl leading-[1.05] tracking-[-0.045em] text-[#141413] sm:max-w-[16rem] sm:text-6xl lg:text-[3.75rem]">
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
            Gitwork indexes your branch, syncs commits, and builds shared
            context for Q&amp;A and meetings.
          </p>
        </aside>

        <main
          data-onboard-main
          className="flex flex-col justify-center px-6 pb-10 sm:px-10 lg:px-14 lg:py-12"
        >
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex w-full max-w-lg flex-col"
          >
            <div data-onboard-panel className="w-full min-w-0">
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
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#141413] text-[#f3f0ee]">
                      <Github className="size-5" />
                    </span>
                    <div>
                      <p className="font-display text-lg tracking-[-0.02em] text-[#141413]">
                        GitHub access
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#696969]">
                        Required to list repositories, load branches, index code, and sync
                        commits. You can skip and paste a URL — create still needs a token.
                      </p>
                    </div>
                  </div>

                  {connectPolling ? (
                    <p className="flex items-center gap-2 border-l-2 border-[#d1cdc7] pl-4 text-sm leading-6 text-[#696969]">
                      <Loader2 className="size-3.5 shrink-0 animate-spin" />
                      Checking GitHub access
                      {signedInWithGithub ? " after your GitHub sign-in" : ""}…
                    </p>
                  ) : githubReady ? (
                    <p className="border-l-2 border-[#3860be]/50 pl-4 text-sm leading-6 text-[#696969]">
                      GitHub access is ready
                      {githubStatus.data?.username
                        ? ` (@${githubStatus.data.username})`
                        : ""}
                      . Continue to pick a repository.
                    </p>
                  ) : (
                    <div className="space-y-3 rounded-xl border border-[#d1cdc7] bg-[#fcfbfa] p-4 text-sm leading-6 text-[#696969]">
                      <p className="font-medium text-[#141413]">
                        {signedInWithGithub
                          ? "Signed in with GitHub, but repo access is not ready"
                          : "Connect GitHub to continue"}
                      </p>
                      <p>
                        {signedInWithGithub
                          ? "Auth0 could not issue a GitHub API token yet (Token Vault / Offline Access). Reconnect with repo scope, add a PAT in Settings, or skip and paste a repository URL."
                          : "Connect your account or add a Personal Access Token in Settings. You can also skip and paste a repo URL for now."}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          type="button"
                          variant="default"
                          className="h-10 rounded-xl"
                          asChild
                        >
                          <a href={githubConnectHref()}>
                            {signedInWithGithub ? "Reconnect GitHub" : "Connect GitHub"}
                          </a>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 rounded-xl border-[#d1cdc7]"
                          asChild
                        >
                          <Link href="/settings">Add token in Settings</Link>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-10 rounded-xl text-[#696969]"
                          onClick={skipConnect}
                        >
                          Skip for now
                        </Button>
                      </div>
                    </div>
                  )}
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

                    {!githubReady ? (
                      <div className="rounded-xl border border-dashed border-[#9a3a0a]/40 bg-[#fcfbfa] p-4 text-sm text-[#696969]">
                        Repo list needs GitHub API access. Paste a URL above to continue, or{" "}
                        <a
                          href={githubConnectHref()}
                          className="font-medium text-[#3860be] underline-offset-4 hover:underline"
                        >
                          reconnect GitHub
                        </a>{" "}
                        / add a token in{" "}
                        <Link
                          href="/settings"
                          className="font-medium text-[#3860be] underline-offset-4 hover:underline"
                        >
                          Settings
                        </Link>
                        .
                      </div>
                    ) : null}

                    {githubReady && reposQuery.error ? (
                      <div className="space-y-2 rounded-xl border border-dashed border-[#9a3a0a]/40 bg-[#fcfbfa] p-4 text-sm text-[#696969]">
                        <p className="text-[#9a3a0a]">
                          {getFriendlyGitHubError(reposQuery.error.message)}
                        </p>
                        <p>Paste a repository URL above to continue, or reconnect.</p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-xl border-[#d1cdc7]"
                            asChild
                          >
                            <a href={githubConnectHref()}>Reconnect GitHub</a>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9 rounded-xl text-[#696969]"
                            onClick={() => void reposQuery.refetch()}
                          >
                            Retry list
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <Input
                      value={repoFilter}
                      onChange={(event) => setRepoFilter(event.target.value)}
                      placeholder="Filter repos…"
                      className="h-10 rounded-xl border-[#d1cdc7] bg-[#fcfbfa] text-[#141413] placeholder:text-[#696969]"
                      disabled={!githubReady || Boolean(reposQuery.error)}
                    />
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-[#d1cdc7]/80 bg-[#fcfbfa]">
                      {!githubReady ? (
                        <p className="p-3 text-xs text-[#696969]">
                          Paste a URL above — browsing unlocks after GitHub access is ready.
                        </p>
                      ) : reposQuery.error ? (
                        <p className="p-3 text-xs text-[#696969]">
                          Could not load repositories. Use the URL field instead.
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
                        {hasUserGithub
                          ? githubStatus.data?.username
                            ? `@${githubStatus.data.username}`
                            : "Connected"
                          : githubStatus.data?.usingServerFallback
                            ? "Server token"
                            : "Not connected"}
                      </dd>
                    </div>
                  </dl>

                  {!githubReady ? (
                    <div className="space-y-3 rounded-xl border border-[#d1cdc7] bg-[#fcfbfa] p-4 text-sm leading-6 text-[#696969]">
                      <p className="font-medium text-[#141413]">
                        Connect GitHub before creating
                      </p>
                      <p>
                        Creating a project needs API access to index the repo and sync commits.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          type="button"
                          variant="default"
                          className="h-10 rounded-xl"
                          asChild
                        >
                          <a href={githubConnectHref()}>Connect GitHub</a>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 rounded-xl border-[#d1cdc7]"
                          asChild
                        >
                          <Link href="/settings">Add token in Settings</Link>
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label
                      htmlFor="create-branch"
                      className="text-sm font-medium text-[#141413]"
                    >
                      Branch
                    </label>
                    {githubReady && branchesQuery.data?.branches?.length ? (
                      <select
                        id="create-branch"
                        {...register("branch")}
                        className="h-12 w-full rounded-xl border border-[#d1cdc7] bg-[#fcfbfa] px-3 text-sm text-[#141413]"
                      >
                        {branchesQuery.data.branches.map((branchName) => (
                          <option key={branchName} value={branchName}>
                            {branchName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id="create-branch"
                        {...register("branch")}
                        placeholder={
                          branchesQuery.isLoading
                            ? "Loading branches…"
                            : "e.g. main (optional — defaults on create)"
                        }
                        disabled={branchesQuery.isLoading}
                        className="h-12 rounded-xl border-[#d1cdc7] bg-[#fcfbfa] text-[#141413] placeholder:text-[#696969]"
                      />
                    )}
                    <p className="text-xs leading-5 text-[#696969]">
                      This branch becomes the first code snapshot for indexing, Q&amp;A, and
                      commit context.
                    </p>
                    {branchError ? (
                      <p className="text-xs text-[#9a3a0a]">{branchError}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-10 flex w-full min-w-0 items-center justify-between gap-3 border-t border-[#d1cdc7]/70 pt-6">
              {step === 1 && !hasExistingProjects ? (
                <span className="h-11" aria-hidden />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 shrink-0 px-3 text-[#696969] hover:bg-transparent hover:text-[#141413]"
                  onClick={goBack}
                  disabled={createProject.isPending}
                >
                  <ChevronLeft className="size-4" />
                  {step === 1 ? "Back to projects" : "Back"}
                </Button>
              )}

              {step < ONBOARDING_STEPS.length ? (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {step === 2 && !githubReady ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl border-[#d1cdc7]"
                      onClick={skipConnect}
                      disabled={createProject.isPending}
                    >
                      Skip for now
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    className="h-11 min-w-[9.5rem] rounded-xl"
                    onClick={goNext}
                    disabled={
                      createProject.isPending ||
                      (step === 2 && !githubReady && !statusPollTimedOut && connectPolling) ||
                      (step === 3 && !repoFieldsValid) ||
                      (step !== 1 && step !== 2 && step !== 3 && !canContinue)
                    }
                  >
                    Continue
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="submit"
                  className="h-11 min-w-[9.5rem] shrink-0 rounded-xl"
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
