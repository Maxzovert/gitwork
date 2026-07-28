"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { GitworkLogo } from "@/components/gitwork-logo";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const services = [
  {
    id: "qa",
    eyebrow: "Q&A",
    title: "Ask your codebase",
    href: "/sign-up",
    tone: "from-[#c4a484] to-[#8b6914]",
    place: "lg:left-[0%] lg:top-[0%]",
  },
  {
    id: "meetings",
    eyebrow: "Meetings",
    title: "Turn audio into issues",
    href: "/sign-up",
    tone: "from-[#9a3a0a] to-[#cf4500]",
    place: "lg:right-[0%] lg:top-[26%]",
  },
  {
    id: "commits",
    eyebrow: "Commits",
    title: "Read history clearly",
    href: "/sign-up",
    tone: "from-[#3860be] to-[#262627]",
    place: "lg:left-[36%] lg:top-[56%]",
  },
];

const storyCards = [
  {
    id: "ask",
    chip: "Q&A",
    title: "Ask like you would ask a teammate",
    body: "Plain-language questions stream answers with the source files Gitwork used — so you can open the path yourself.",
    href: "/sign-up",
  },
  {
    id: "meet",
    chip: "Meetings",
    title: "Upload audio. Walk away with issues.",
    body: "Drop a recording and get headlines, timestamps, and short summaries next to the project that owns them.",
    href: "/sign-up",
  },
  {
    id: "history",
    chip: "Commits",
    title: "Catch up without reading every diff",
    body: "Recent commits arrive with an AI summary. Jump to GitHub for the raw change — stay here for the story.",
    href: "/sign-up",
  },
];

const audience = [
  {
    t: "Founders shipping alone",
    b: "Keep your own history readable. Ask the repo when you forget where something landed last month.",
  },
  {
    t: "Engineers joining a codebase",
    b: "Ramp faster with grounded Q&A and commit summaries instead of pinging people for every file path.",
  },
  {
    t: "Leads running reviews and calls",
    b: "Turn spoken decisions into structured issues and keep them next to the project they affect.",
  },
];

const steps = [
  {
    n: "01",
    title: "Create your workspace",
    body: "Sign up and land in a calm project space ready for your first repository.",
  },
  {
    n: "02",
    title: "Link a GitHub repo",
    body: "Paste the URL, optionally add a token for private repos, and let Gitwork index the code.",
  },
  {
    n: "03",
    title: "Ask, upload, review",
    body: "Query the codebase, drop meeting audio, and skim commit summaries from one dashboard.",
  },
  {
    n: "04",
    title: "Keep what matters",
    body: "Save strong answers, open meeting issues, and switch projects without losing context.",
  },
];

function Eyebrow({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <p
      className={`eyebrow inline-flex items-center gap-2 ${light ? "text-[#d1cdc7]" : "text-[#141413]"}`}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: light ? "#f37338" : "#cf4500" }}
        aria-hidden
      />
      {children}
    </p>
  );
}

function InkButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-[20px] border-[1.5px] border-[#141413] bg-[#141413] px-6 py-1.5 text-base font-medium tracking-[-0.02em] text-[#f3f0ee] transition-transform active:scale-[0.98] ${className}`}
    >
      {children}
    </Link>
  );
}

function OutlineButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-[20px] border-[1.5px] border-[#141413] bg-white px-6 py-1.5 text-base font-[450] text-[#141413] transition-transform active:scale-[0.98] ${className}`}
    >
      {children}
    </Link>
  );
}

export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeStory, setActiveStory] = useState(0);

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduce) return;

      gsap.set("[data-hero-el]", { opacity: 0, y: 36 });
      gsap.set("[data-nav]", { opacity: 0, y: -20 });

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .to("[data-nav]", { opacity: 1, y: 0, duration: 0.8 })
        .to(
          "[data-hero-el]",
          { opacity: 1, y: 0, duration: 0.9, stagger: 0.12 },
          "-=0.35",
        );

      /* Continuous scrub — tracks scroll both ways */
      gsap.fromTo(
        "[data-hero-frame]",
        { yPercent: 0 },
        {
          yPercent: 8,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-hero]",
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        },
      );

      /* Reveal sections — play on enter, reverse on leave (both directions) */
      const reveal = (
        targets: gsap.TweenTarget,
        from: gsap.TweenVars,
        trigger: Element | string,
        opts: {
          start?: string;
          stagger?: number | gsap.StaggerVars;
          duration?: number;
          to?: gsap.TweenVars;
        } = {},
      ) => {
        gsap.fromTo(targets, from, {
          y: 0,
          opacity: 1,
          scale: 1,
          ...opts.to,
          duration: opts.duration ?? 0.75,
          ease: "power2.out",
          stagger: opts.stagger,
          immediateRender: true,
          scrollTrigger: {
            trigger,
            start: opts.start ?? "top 82%",
            end: "bottom top",
            toggleActions: "play reverse play reverse",
          },
        });
      };

      gsap.utils.toArray<HTMLElement>("[data-reveal-section]").forEach((s) => {
        reveal(s.querySelectorAll("[data-reveal]"), { y: 48, opacity: 0 }, s, {
          stagger: 0.1,
        });
      });

      const orbitPaths =
        gsap.utils.toArray<SVGPathElement>("[data-orbit-path]");
      orbitPaths.forEach((path) => {
        const len = path.getTotalLength();
        gsap.set(path, {
          strokeDasharray: len,
          strokeDashoffset: len,
        });
      });

      /* Orbit draw — scrub so it undraws when scrolling back */
      gsap.fromTo(
        orbitPaths,
        {
          strokeDashoffset: (_i, el) =>
            (el as SVGPathElement).getTotalLength(),
        },
        {
          strokeDashoffset: 0,
          ease: "none",
          stagger: 0.08,
          scrollTrigger: {
            trigger: "[data-constellation]",
            start: "top 70%",
            end: "center 40%",
            scrub: 1.2,
          },
        },
      );

      reveal(
        "[data-portrait]",
        { scale: 0.84, opacity: 0, y: 48 },
        "[data-stage]",
        { start: "top 80%", stagger: 0.15, duration: 0.85 },
      );

      reveal(
        "[data-svc-head]",
        { y: 28, opacity: 0 },
        "[data-constellation]",
        { start: "top 80%" },
      );

      reveal(
        "[data-story-card]",
        { y: 40, opacity: 0 },
        "[data-story-grid]",
        { stagger: 0.12 },
      );

      reveal(
        "[data-step]",
        { y: 40, opacity: 0 },
        "[data-steps]",
        { start: "top 75%", stagger: 0.12 },
      );

      reveal(
        "[data-audience-card]",
        { y: 36, opacity: 0 },
        "[data-audience]",
        { stagger: 0.12 },
      );

      reveal(
        "[data-cta-block] > *",
        { y: 40, opacity: 0 },
        "[data-cta-block]",
        { stagger: 0.1 },
      );
    },
    { scope: root },
  );

  return (
    <div ref={root} className="bg-[#f3f0ee] text-[#141413]">
      {/* Floating nav pill */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-6">
        <header
          data-nav
          className="pointer-events-auto flex w-full max-w-5xl items-center justify-between gap-4 rounded-full bg-white/95 px-5 py-3 shadow-nav backdrop-blur-md sm:px-8 sm:py-4"
        >
          <Link href="/" className="flex shrink-0 items-center">
            <GitworkLogo size={28} withWordmark />
          </Link>

          <nav className="hidden items-center gap-10 md:flex">
            <a
              href="#services"
              className="text-base font-medium tracking-[-0.03em] text-[#141413]"
            >
              Product
            </a>
            <a
              href="#story"
              className="text-base font-medium tracking-[-0.03em] text-[#141413]"
            >
              Story
            </a>
            <a
              href="#how"
              className="text-base font-medium tracking-[-0.03em] text-[#141413]"
            >
              How it works
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              className="hidden text-base font-medium tracking-[-0.03em] text-[#141413] sm:inline"
            >
              Sign in
            </Link>
            <InkButton href="/sign-up" className="hidden sm:inline-flex">
              Get started
            </InkButton>
            <button
              type="button"
              className="flex size-12 items-center justify-center rounded-full border border-[#141413]/20 md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </header>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 bg-[#f3f0ee] px-6 pt-28 md:hidden">
          <nav className="flex flex-col gap-6 text-2xl font-medium tracking-[-0.02em]">
            <a href="#services" onClick={() => setMenuOpen(false)}>
              Product
            </a>
            <a href="#story" onClick={() => setMenuOpen(false)}>
              Story
            </a>
            <a href="#how" onClick={() => setMenuOpen(false)}>
              How it works
            </a>
            <Link href="/sign-in" onClick={() => setMenuOpen(false)}>
              Sign in
            </Link>
            <InkButton href="/sign-up">Get started</InkButton>
          </nav>
        </div>
      ) : null}

      {/* Hero */}
      <section
        data-hero
        className="relative mx-auto max-w-[1280px] overflow-hidden px-6 pb-16 pt-28 sm:px-10 sm:pt-32 lg:px-12"
      >
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
          <div>
            <Eyebrow>
              <span data-hero-el>For builders</span>
            </Eyebrow>
            <h1
              data-hero-el
              className="font-display mt-4 text-[40px] leading-none tracking-[-0.02em] sm:text-[48px] lg:text-[64px] lg:leading-[64px]"
            >
              Understand your GitHub repos with clarity
            </h1>
          </div>
          <div data-hero-el className="max-w-md">
            <p className="text-base font-[450] leading-[1.4] text-[#141413]">
              Ask the codebase. Capture meetings. Read commit history in plain
              language. All tied to the project you are shipping.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <InkButton href="/sign-up">Get started</InkButton>
              <OutlineButton href="#services">Explore</OutlineButton>
            </div>
          </div>
        </div>

        <div
          data-hero-el
          data-hero-frame
          className="shadow-lift relative z-10 mt-12 overflow-hidden rounded-[40px] bg-[#2b2b2b] will-change-transform"
          style={{ height: "min(62vh, 560px)" }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-80"
            style={{
              background:
                "radial-gradient(ellipse at 30% 40%, #cf450033, transparent 55%), radial-gradient(ellipse at 80% 70%, #3860be44, transparent 50%), linear-gradient(160deg, #262627, #141413)",
            }}
          />
          <div className="relative flex h-full flex-col justify-end p-8 sm:p-12">
            <p className="max-w-sm text-sm font-[450] leading-relaxed text-white/70">
              One workspace for questions, meetings, and commit stories around
              every linked repository.
            </p>
            <div className="mt-6">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-[40px] bg-[#141413] px-10 py-4 text-base font-medium tracking-[-0.02em] text-[#f3f0ee]"
              >
                Discover Gitwork
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section
        data-reveal-section
        className="relative mx-auto max-w-[1280px] px-6 py-24 sm:px-10 lg:px-12 lg:py-32"
      >
        {/* Decorative: small accent dot cluster in left margin */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-32 left-2 hidden gap-2 lg:flex lg:flex-col"
        >
          <span className="size-2 rounded-full bg-[#f37338]/70" />
          <span className="ml-3 size-1.5 rounded-full bg-[#f37338]/40" />
        </div>

        <Eyebrow>
          <span data-reveal>The quiet problem</span>
        </Eyebrow>
        <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-20">
          <h2
            data-reveal
            className="font-display text-[36px] leading-[44px] tracking-[-0.02em]"
          >
            Code moves fast. Context gets lost between GitHub, chat, and calls.
          </h2>
          <div
            data-reveal
            className="space-y-5 text-base font-[450] leading-[1.4] text-[#696969]"
          >
            <p>
              New contributors spend days asking where things live. Seniors
              answer the same questions because the map of the repo only lives
              in people&apos;s heads.
            </p>
            <p>
              Meeting notes scatter across docs. Decisions made on a call never
              find their way back to the project. Commit history stays dense
              when you only need the story.
            </p>
          </div>
        </div>
      </section>

      {/* Constellation services — SVG lives only in the stage, under portraits */}
      <section
        id="services"
        data-constellation
        className="relative scroll-mt-28 overflow-hidden bg-[#fcfbfa] py-28 sm:py-36"
      >
        <div className="relative z-10 mx-auto max-w-[1280px] px-6 sm:px-10 lg:px-12">
          <p
            aria-hidden
            className="pointer-events-none mb-2 font-display text-[64px] leading-none tracking-[-0.02em] text-[#e8e2da] select-none sm:text-[80px] lg:text-[112px]"
          >
            Product
          </p>
          <div data-svc-head className="relative z-20 max-w-xl">
            <Eyebrow>
              <span>What Gitwork offers</span>
            </Eyebrow>
            <h2 className="font-display mt-4 text-[36px] leading-[44px] tracking-[-0.02em]">
              Three ways to stay close to your repository
            </h2>
          </div>

          <div
            data-stage
            className="relative mt-24 flex flex-col items-center gap-28 lg:mt-20 lg:block lg:min-h-[900px]"
          >
            {/* Orbits: z-0 under portraits; drawn on scroll */}
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full lg:block"
              viewBox="0 0 1200 900"
              fill="none"
              preserveAspectRatio="xMidYMid meet"
            >
              <path
                data-orbit-path
                d="M170 160 C 400 30, 740 110, 1000 300"
                stroke="#F37338"
                strokeWidth="1.25"
                strokeLinecap="round"
                opacity="0.85"
              />
              <path
                data-orbit-path
                d="M1000 300 C 1120 420, 760 610, 560 740"
                stroke="#F37338"
                strokeWidth="1"
                strokeLinecap="round"
                opacity="0.5"
              />
            </svg>

            {services.map((service) => (
              <article
                key={service.id}
                data-portrait
                className={`relative z-10 flex w-full max-w-[280px] flex-col items-center text-center will-change-transform lg:absolute lg:max-w-[300px] ${service.place}`}
              >
                <div className="relative">
                  <div
                    className={`size-[240px] overflow-hidden rounded-full bg-gradient-to-br shadow-[rgba(0,0,0,0.08)_0px_24px_48px] sm:size-[280px] lg:size-[300px] ${service.tone}`}
                  >
                    <div className="flex h-full items-end justify-center pb-10">
                      <Image
                        src="/create-page-image.png"
                        alt=""
                        width={200}
                        height={160}
                        className="h-auto w-[68%] opacity-90"
                      />
                    </div>
                  </div>
                  <Link
                    href={service.href}
                    className="absolute -right-1 bottom-3 flex size-14 items-center justify-center rounded-full bg-white transition-transform hover:scale-105 active:scale-95 sm:bottom-4"
                    aria-label={`Explore ${service.title}`}
                  >
                    <ArrowRight className="size-5 text-[#141413]" />
                  </Link>
                </div>
                <div className="mt-7">
                  <Eyebrow>
                    <span>{service.eyebrow}</span>
                  </Eyebrow>
                  <h3 className="font-display mt-2 text-2xl leading-[1.2] tracking-[-0.02em]">
                    {service.title}
                  </h3>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Story — interactive cards */}
      <section
        id="story"
        data-reveal-section
        className="scroll-mt-28 relative mx-auto max-w-[1280px] px-6 py-24 sm:px-10 lg:px-12 lg:py-32"
      >
        <p
          aria-hidden
          className="pointer-events-none mb-2 font-display text-[64px] leading-none tracking-[-0.02em] text-[#e8e2da] select-none sm:text-[80px] lg:text-[112px]"
        >
          Story
        </p>
        <Eyebrow>
          <span data-reveal>The story</span>
        </Eyebrow>
        <h2
          data-reveal
          className="font-display mt-4 max-w-2xl text-[36px] leading-[44px] tracking-[-0.02em]"
        >
          From empty account to a workspace that remembers your repo
        </h2>

        <div
          data-story-grid
          className="mt-16 grid gap-6 md:grid-cols-3 md:gap-8"
        >
          {storyCards.map((card, i) => {
            const active = activeStory === i;
            return (
              <article
                key={card.id}
                data-story-card
                onMouseEnter={() => setActiveStory(i)}
                onFocusCapture={() => setActiveStory(i)}
                className={`group rounded-[40px] border transition-all duration-300 ${
                  active
                    ? "scale-[1.02] border-[#141413] bg-white shadow-[rgba(0,0,0,0.08)_0px_24px_48px]"
                    : "border-transparent bg-[#fcfbfa] hover:border-[#141413]/20"
                }`}
              >
                <div className="flex h-full flex-col p-8 sm:p-9">
                  <span className="inline-flex w-fit rounded-full bg-[#f3f0ee] px-4 py-2 text-sm font-medium tracking-[-0.02em] text-[#141413]">
                    {card.chip}
                  </span>
                  <h3 className="font-display mt-6 text-2xl leading-[1.2] tracking-[-0.02em]">
                    {card.title}
                  </h3>
                  <p className="mt-3 flex-1 text-base font-[450] leading-[1.4] text-[#696969]">
                    {card.body}
                  </p>
                  <Link
                    href={card.href}
                    className="mt-8 inline-flex items-center gap-2 text-base font-medium tracking-[-0.02em] text-[#141413] transition-transform group-hover:translate-x-1"
                  >
                    Try it
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section
        id="how"
        data-steps
        className="scroll-mt-28 relative overflow-hidden bg-[#fcfbfa] px-6 py-24 sm:px-10 lg:px-12 lg:py-32"
      >
        <div className="relative z-10 mx-auto max-w-[1280px]">
          <p
            aria-hidden
            className="pointer-events-none mb-2 font-display text-[64px] leading-none tracking-[-0.02em] text-[#e8e2da] select-none sm:text-[80px] lg:text-[112px]"
          >
            How it works
          </p>
          <Eyebrow>
            <span data-step>Get started</span>
          </Eyebrow>
          <h2
            data-step
            className="font-display mt-4 max-w-2xl text-[36px] leading-[44px] tracking-[-0.02em]"
          >
            Four steps from signup to a useful workspace
          </h2>
          <ol className="mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {steps.map((step) => (
              <li key={step.n} data-step>
                <span className="font-display text-[36px] tracking-[-0.02em] text-[#d1cdc7]">
                  {step.n}
                </span>
                <h3 className="font-display mt-4 text-2xl leading-[1.2] tracking-[-0.02em]">
                  {step.title}
                </h3>
                <p className="mt-3 text-base font-[450] leading-[1.4] text-[#696969]">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Who — interactive audience cards */}
      <section
        data-audience
        className="mx-auto max-w-[1280px] px-6 py-24 sm:px-10 lg:px-12 lg:py-32"
      >
        <p
          aria-hidden
          className="pointer-events-none mb-2 font-display text-[64px] leading-none tracking-[-0.02em] text-[#e8e2da] select-none sm:text-[80px] lg:text-[112px]"
        >
          Who it helps
        </p>
        <Eyebrow>
          <span>Audience</span>
        </Eyebrow>
        <h2 className="font-display mt-4 max-w-2xl text-[36px] leading-[44px] tracking-[-0.02em]">
          Small teams and solo builders who live in GitHub
        </h2>
        <div className="mt-14 grid gap-6 md:grid-cols-3 md:gap-8">
          {audience.map((item) => (
            <Link
              key={item.t}
              href="/sign-up"
              data-audience-card
              className="group rounded-[40px] border border-transparent bg-white p-8 shadow-[rgba(0,0,0,0.04)_0px_4px_24px] transition-all duration-300 hover:-translate-y-1 hover:border-[#141413]/15 hover:shadow-[rgba(0,0,0,0.08)_0px_24px_48px] sm:p-9"
            >
              <h3 className="font-display text-2xl tracking-[-0.02em]">
                {item.t}
              </h3>
              <p className="mt-3 text-base font-[450] leading-[1.4] text-[#696969]">
                {item.b}
              </p>
              <span className="mt-8 inline-flex size-12 items-center justify-center rounded-full bg-[#f3f0ee] transition-transform group-hover:translate-x-1 group-hover:bg-[#141413] group-hover:text-[#f3f0ee]">
                <ArrowRight className="size-5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="px-6 pb-8 sm:px-10 lg:px-12">
        <div
          data-cta-block
          className="shadow-lift mx-auto max-w-[1280px] rounded-[40px] bg-[#141413] px-8 py-16 text-[#f3f0ee] sm:px-14 sm:py-20"
        >
          <h2 className="font-display max-w-xl text-[36px] leading-[44px] tracking-[-0.02em] sm:text-[48px] sm:leading-[1.05]">
            We&apos;re ready when your next repo is
          </h2>
          <p className="mt-5 max-w-lg text-base font-[450] leading-[1.4] text-[#d1cdc7]">
            Create an account, link a GitHub project, and start asking questions
            in a few minutes. No setup tour required.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center rounded-[20px] border-[1.5px] border-[#f3f0ee] bg-[#f3f0ee] px-6 py-1.5 text-base font-medium tracking-[-0.02em] text-[#141413]"
            >
              Get started
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-[20px] border-[1.5px] border-white/40 px-6 py-1.5 text-base font-[450] text-[#f3f0ee]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-8 bg-[#141413] px-6 pt-16 pb-24 text-white sm:px-10 lg:px-12 lg:pb-36">
        <div className="mx-auto max-w-[1280px]">
          <h2 className="font-display max-w-xl text-[36px] leading-[44px] tracking-[-0.02em]">
            We&apos;re always here when you need us
          </h2>

          <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="eyebrow text-[#696969]">Product</p>
              <ul className="mt-4 space-y-3 text-sm font-[450]">
                <li>
                  <a href="#services" className="hover:underline">
                    Q&A
                  </a>
                </li>
                <li>
                  <a href="#services" className="hover:underline">
                    Meetings
                  </a>
                </li>
                <li>
                  <a href="#services" className="hover:underline">
                    Commits
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="eyebrow text-[#696969]">Get started</p>
              <ul className="mt-4 space-y-3 text-sm font-[450]">
                <li>
                  <Link href="/sign-up" className="hover:underline">
                    Create account ↗
                  </Link>
                </li>
                <li>
                  <Link href="/sign-in" className="hover:underline">
                    Sign in ↗
                  </Link>
                </li>
                <li>
                  <a href="#how" className="hover:underline">
                    How it works
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="eyebrow text-[#696969]">Workspace</p>
              <ul className="mt-4 space-y-3 text-sm font-[450]">
                <li>
                  <Link href="/dashboard" className="hover:underline">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/create" className="hover:underline">
                    Create project
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="eyebrow text-[#696969]">Need help?</p>
              <ul className="mt-4 space-y-3 text-sm font-[450]">
                <li>
                  <a href="#story" className="hover:underline">
                    Read the story
                  </a>
                </li>
                <li>
                  <Link href="/sign-up" className="hover:underline">
                    Start free ↗
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-16 flex flex-col gap-4 border-t border-white/30 pt-8 text-sm text-[#d1cdc7] sm:flex-row sm:items-center sm:justify-between">
            <p className="font-[450]">© {new Date().getFullYear()} Gitwork</p>
            <p className="font-[450] text-[#696969]">
              Understand GitHub repositories with clarity
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
