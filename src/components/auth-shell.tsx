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
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduce) return;

      gsap.set("[data-auth-brand]", { opacity: 0, y: 28, scale: 0.92 });
      gsap.set("[data-auth-sub]", { opacity: 0, y: 18 });
      gsap.set("[data-auth-form]", { opacity: 0, y: 32 });

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .to("[data-auth-brand]", {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.9,
        })
        .to(
          "[data-auth-sub]",
          { opacity: 1, y: 0, duration: 0.7 },
          "-=0.5",
        )
        .to(
          "[data-auth-form]",
          { opacity: 1, y: 0, duration: 0.8 },
          "-=0.4",
        );
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f3f0ee] px-4 py-12"
    >
      <div className="relative z-10 mb-12 flex flex-col items-center gap-5 sm:mb-14 sm:gap-6">
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
