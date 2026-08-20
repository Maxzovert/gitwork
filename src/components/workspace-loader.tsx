"use client";

import { GitworkLogo } from "@/components/gitwork-logo";
import { cn } from "@/lib/utils";

export function WorkspaceLoader({
  title = "Getting your workspace ready",
  message,
  progress,
}: {
  title?: string;
  message: string;
  progress: number;
}) {
  const width = Math.max(6, Math.min(100, Math.round(progress)));

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-[#f3f0ee] px-6 text-[#141413]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 12% 18%, rgba(207,69,0,0.08), transparent 55%), radial-gradient(ellipse 55% 45% at 88% 82%, rgba(56,96,190,0.06), transparent 50%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <GitworkLogo size={40} withWordmark className="mb-10" />

        <p className="text-[11px] font-bold tracking-[0.18em] text-[#696969] uppercase">
          Please wait
        </p>
        <h1 className="font-display mt-2 text-3xl tracking-[-0.04em] text-[#141413]">
          {title}
        </h1>
        <p className="mt-3 min-h-[1.5rem] text-sm leading-6 text-[#696969]">
          {message}
        </p>

        <div
          className="mt-8 h-1.5 overflow-hidden rounded-full bg-[#d1cdc7]/80"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={width}
          aria-label={message}
        >
          <div
            className={cn(
              "h-full rounded-full bg-[#cf4500] transition-[width] duration-500 ease-out",
            )}
            style={{ width: `${width}%` }}
          />
        </div>
        <p className="mt-2 text-right text-xs tabular-nums text-[#696969]">
          {width}%
        </p>
      </div>
    </div>
  );
}
