"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { WorkspaceLoader } from "@/components/workspace-loader";
import useProjects from "@/hooks/use-projects";

let workspaceBooted = false;

const BOOT_TIMEOUT_MS = 10_000;

const WORKSPACE_ROUTES = [
  "/dashboard",
  "/overview",
  "/qa",
  "/meetings",
  "/pr-digests",
  "/releases",
  "/team",
];

function isWorkspaceRoute(pathname: string) {
  return WORKSPACE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function AppBootGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    projects,
    project,
    projectId,
    projectIdReady,
    isPending,
    isFetched,
    isFetching,
  } = useProjects();
  const [showLoader, setShowLoader] = useState(() => !workspaceBooted);
  const [progress, setProgress] = useState(workspaceBooted ? 100 : 32);
  const [timedOut, setTimedOut] = useState(false);

  const waiting =
    !workspaceBooted && !timedOut && (isPending || !isFetched);

  const hasProjects = Boolean(projects?.length);
  const hasOpenProject = Boolean(project?.id);

  // No projects yet → onboarding (settings stays reachable).
  const needsCreate =
    isFetched &&
    !isFetching &&
    !hasProjects &&
    pathname !== "/settings";

  // Workspace pages require an explicitly opened project.
  // Wait until localStorage has been read — the first render is always "".
  const needsProjectPick =
    projectIdReady &&
    isFetched &&
    !isFetching &&
    hasProjects &&
    !hasOpenProject &&
    isWorkspaceRoute(pathname);

  useEffect(() => {
    if (workspaceBooted) {
      setShowLoader(false);
      return;
    }

    if (sessionStorage.getItem("gitwork-boot") === "1") {
      setProgress(74);
    }

    const timeout = window.setTimeout(() => {
      setTimedOut(true);
    }, BOOT_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (workspaceBooted) return;

    if (!waiting) {
      setProgress(100);
      workspaceBooted = true;
      sessionStorage.removeItem("gitwork-boot");
      const timeout = window.setTimeout(() => setShowLoader(false), 200);
      return () => window.clearTimeout(timeout);
    }

    const tick = window.setInterval(() => {
      setProgress((current) => Math.min(current + 3, 92));
    }, 300);
    return () => window.clearInterval(tick);
  }, [waiting]);

  useEffect(() => {
    if (needsCreate) {
      router.replace("/create");
      return;
    }
    if (needsProjectPick) {
      router.replace("/projects");
    }
  }, [needsCreate, needsProjectPick, router]);

  if (showLoader) {
    return (
      <WorkspaceLoader
        title="Almost there"
        message="Loading your workspace…"
        progress={progress}
      />
    );
  }

  if (needsCreate) {
    return (
      <WorkspaceLoader
        title="Set up a project"
        message="Taking you to create your first project…"
        progress={100}
      />
    );
  }

  if (needsProjectPick) {
    return (
      <WorkspaceLoader
        title="Choose a project"
        message="Opening your projects…"
        progress={100}
      />
    );
  }

  // Avoid flashing wrong project UI while projectId hydrates from localStorage.
  if (isWorkspaceRoute(pathname) && !projectIdReady) {
    return (
      <WorkspaceLoader
        title="Almost there"
        message="Loading your workspace…"
        progress={100}
      />
    );
  }

  if (isWorkspaceRoute(pathname) && !projectId) {
    return (
      <WorkspaceLoader
        title="Choose a project"
        message="Opening your projects…"
        progress={100}
      />
    );
  }

  return <>{children}</>;
}
