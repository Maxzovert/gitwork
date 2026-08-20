"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { WorkspaceLoader } from "@/components/workspace-loader";
import { completeUserSync } from "./actions";

const STEPS = [
  { at: 12, message: "Signing you in…" },
  { at: 38, message: "Syncing your account…" },
  { at: 62, message: "Checking your projects…" },
  { at: 84, message: "Opening your workspace…" },
];

export default function SyncUserPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(8);
  const [message, setMessage] = useState("Signing you in…");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const tick = window.setInterval(() => {
      setProgress((current) => {
        const next = Math.min(current + 4, 88);
        const step = [...STEPS].reverse().find((item) => next >= item.at);
        if (step) setMessage(step.message);
        return next;
      });
    }, 280);

    void completeUserSync()
      .then((href) => {
        window.clearInterval(tick);
        setProgress(96);
        setMessage("Opening your workspace…");
        sessionStorage.setItem("gitwork-boot", "1");
        router.replace(href);
      })
      .catch(() => {
        window.clearInterval(tick);
        setMessage("Something went wrong. Taking you to sign in…");
        router.replace("/sign-in");
      });

    return () => window.clearInterval(tick);
  }, [router]);

  return (
    <WorkspaceLoader
      title="Welcome in"
      message={message}
      progress={progress}
    />
  );
}
