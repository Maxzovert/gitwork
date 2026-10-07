"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Link from "next/link";
import { useRef } from "react";

import { GitworkLogo } from "@/components/gitwork-logo";

type Props = {
  children: React.ReactNode;
  subtitle?: string;
};

export function AuthShell({
  children,
  subtitle = "Sign in to your workspace",
}: Props) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const brand = root.current?.querySelector<HTMLElement>("[data-auth-brand]");
      const sub = root.current?.querySelector<HTMLElement>("[data-auth-sub]");
      const form = root.current?.querySelector<HTMLElement>("[data-auth-form]");
      if (!brand || !sub || !form) return;

      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      // Always end visible — never leave the form stuck at opacity 0.
      if (reduce) {
        gsap.set([brand, sub, form], { clearProps: "all", opacity: 1, y: 0, scale: 1 });
        return;
      }

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .fromTo(
          brand,
          { opacity: 0, y: 20, scale: 0.96 },
          { opacity: 1, y: 0, scale: 1, duration: 0.7 },
        )
        .fromTo(
          sub,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.55 },
          "-=0.4",
        )
        .fromTo(
          form,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.65 },
          "-=0.35",
        );
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f3f0ee] px-4 py-12"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(207,69,0,0.08),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(20,20,19,0.04),_transparent_50%)]"
      />
      <div className="relative z-10 mb-10 flex flex-col items-center gap-5 sm:mb-12 sm:gap-6">
        <Link
          href="/"
          data-auth-brand
          className="transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <GitworkLogo size={64} withWordmark className="gap-3.5 sm:gap-4" />
        </Link>
        <p
          data-auth-sub
          className="text-center text-base font-[450] tracking-[-0.01em] text-[#696969] sm:text-lg"
        >
          {subtitle}
        </p>
      </div>
      <div data-auth-form className="relative z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
