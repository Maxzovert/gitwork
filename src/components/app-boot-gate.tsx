"use client";

import { useEffect, useState } from "react";

import { WorkspaceLoader } from "@/components/workspace-loader";
import useProjects from "@/hooks/use-projects";

let workspaceBooted = false;

export function AppBootGate({ children }: { children: React.ReactNode }) {
  const { isPending, isFetched } = useProjects();
  const [showLoader, setShowLoader] = useState(() => !workspaceBooted);
  const [progress, setProgress] = useState(workspaceBooted ? 100 : 32);

  const waiting = !workspaceBooted && (isPending || !isFetched);

  useEffect(() => {
    if (workspaceBooted) {
      setShowLoader(false);
      return;
    }

    if (sessionStorage.getItem("gitwork-boot") === "1") {
      setProgress(74);
    }
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

  if (showLoader) {
    return (
      <WorkspaceLoader
        title="Almost there"
        message="Loading your dashboard…"
        progress={progress}
      />
    );
  }

  return <>{children}</>;
}
