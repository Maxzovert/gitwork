import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-[#d1cdc7] bg-[#fcfbfa] px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-[#141413] text-[#f3f0ee]">
          <Icon className="size-5" />
        </div>
      ) : null}
      <p className="font-display text-base tracking-[-0.02em] text-[#141413]">
        {title}
      </p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[#696969]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
