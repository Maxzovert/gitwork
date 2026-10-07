"use client";

import { useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { useRouter } from "next/navigation";

import { WorkspaceLoader } from "@/components/workspace-loader";
import { completeUserSync } from "./actions";

const STEPS = [
  { at: 12, message: "Signing you in…" },
  { at: 38, message: "Syncing your account…" },
  { at: 62, message: "Checking your projects…" },
  { at: 84, message: "Opening your workspace…" },
];

const SYNC_TIMEOUT_MS = 12_000;

export default function SyncUserPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [progress, setProgress] = useState(8);
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace("/sign-in");
      return;
    }

    let cancelled = false;

    const tick = window.setInterval(() => {
      setProgress((current) => {
        const next = Math.min(current + 4, 88);
        const step = [...STEPS].reverse().find((item) => next >= item.at);
        if (step) setMessage(step.message);
        return next;
      });
    }, 280);

    const finish = (href: string) => {
      if (cancelled) return;
      window.clearInterval(tick);
      window.clearTimeout(timeout);
      setProgress(96);
      setMessage("Opening your workspace…");
      sessionStorage.setItem("gitwork-boot", "1");
      router.replace(href);
    };

    const timeout = window.setTimeout(() => {
      console.warn("completeUserSync timed out — continuing to projects");
      finish("/projects");
    }, SYNC_TIMEOUT_MS);

    void completeUserSync()
      .then((href) => {
        finish(href === "/sign-in" ? "/projects" : href);
      })
      .catch((error) => {
        console.error("completeUserSync failed:", error);
        finish("/projects");
      });

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      window.clearTimeout(timeout);
    };
  }, [isLoading, user, router]);

  return (
    <WorkspaceLoader
      title="Welcome in"
      message={message}
      progress={progress}
    />
  );
}
