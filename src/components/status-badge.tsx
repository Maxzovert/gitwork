import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: "PROCESSING" | "COMPLETED" | "FAILED" | string;
  className?: string;
};

const statusStyles: Record<string, string> = {
  PROCESSING:
    "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-400",
  COMPLETED:
    "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-400",
  FAILED: "bg-destructive/15 text-destructive ring-destructive/30",
};

const statusLabels: Record<string, string> = {
  PROCESSING: "Processing",
  COMPLETED: "Ready",
  FAILED: "Failed",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style =
    statusStyles[status] ??
    "bg-muted text-muted-foreground ring-border";
  const label = statusLabels[status] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        style,
        className,
      )}
    >
      {label}
      {status === "PROCESSING" ? "…" : ""}
    </span>
  );
}
