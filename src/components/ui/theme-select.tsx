"use client";

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type ThemeSelectOption = {
  value: string;
  label: string;
};

type ThemeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: ThemeSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
};

export function ThemeSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  className,
  id,
  "aria-label": ariaLabel,
}: ThemeSelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    const updatePosition = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 220 && rect.top > spaceBelow;
      const maxHeight = Math.min(224, openUp ? rect.top - 12 : spaceBelow - 12);

      setMenuStyle({
        position: "fixed",
        left: rect.left,
        width: Math.max(rect.width, 140),
        zIndex: 9999,
        maxHeight,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        document.getElementById(listId)?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, listId]);

  const menu = open ? (
    <ul
      id={listId}
      role="listbox"
      aria-label={ariaLabel}
      style={menuStyle}
      className="overflow-auto rounded-xl border border-dust bg-lifted p-1 shadow-[0_16px_40px_-12px_rgba(20,20,19,0.35)]"
    >
      {options.length === 0 ? (
        <li className="px-3 py-2 text-sm text-slate">{placeholder}</li>
      ) : (
        options.map((option) => {
          const isActive = option.value === value;
          return (
            <li key={option.value} role="option" aria-selected={isActive}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  isActive
                    ? "bg-ink text-canvas"
                    : "text-ink hover:bg-ghost/80",
                )}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="truncate">{option.label}</span>
                {isActive ? <Check className="size-3.5 shrink-0" /> : null}
              </button>
            </li>
          );
        })
      )}
    </ul>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative min-w-[8.5rem] flex-1",
        open && "z-[60]",
        className,
      )}
    >
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-dust bg-lifted px-3 text-left text-sm text-ink transition-colors",
          "outline-none hover:border-ink/25 focus-visible:border-ink/30 focus-visible:ring-2 focus-visible:ring-ink/10",
          "disabled:cursor-not-allowed disabled:opacity-60",
          open && "border-ink/30 ring-2 ring-ink/10",
        )}
      >
        <span className={cn("truncate", !selected && "text-slate")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-slate transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
