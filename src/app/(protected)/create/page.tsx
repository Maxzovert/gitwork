"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { CreateProjectDialog } from "@/components/create-project-dialog";

/** Legacy /create route — opens the create dialog, then returns to the dashboard. */
export default function CreatePage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) {
      router.replace("/dashboard");
    }
  }, [open, router]);

  return (
    <CreateProjectDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) router.replace("/dashboard");
      }}
    />
  );
}
