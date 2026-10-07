"use client";

import React from "react";
import Image from "next/image";
import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  ChevronDown,
  ExternalLink,
  GitCommitHorizontal,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { minidenticon } from "minidenticons";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { githubCommitUrl, parseGithubUrl } from "@/lib/github-url";

type ParsedChange = {
  text: string;
  files: string[];
};

function fileBasename(path: string) {
  const cleaned = path.replace(/^\[|\]$/g, "").trim();
  const parts = cleaned.split(/[/\\]/);
  return parts[parts.length - 1] || cleaned;
}

function commitSubject(message: string) {
  return message.split("\n")[0]?.trim() || message;
}

function hasAiCommitSummary(summary: string, commitMessage: string) {
  const raw = summary?.trim() ?? "";
  const subject = commitSubject(commitMessage);
  if (!raw || raw === subject) return false;
  const lower = raw.toLowerCase();
  if (
    lower.includes("quota exceeded") ||
    lower.includes("summary unavailable") ||
    lower.includes("error processing") ||
    lower.includes("no meaningful changes")
  ) {
    return false;
  }
  return true;
}

/** Turn dense AI bullet dumps into short readable change lines. */
function parseCommitSummary(summary: string, commitMessage: string): ParsedChange[] {
  if (!hasAiCommitSummary(summary, commitMessage)) return [];

  const lines = summary
    .trim()
    .split(/\n+/)
    .map((line) => line.replace(/^[\s*•\-–—]+/, "").trim())
    .filter(Boolean);

  const parsed = lines.map((line) => {
    const files = [...line.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]!.trim());
    const text = line
      .replace(/\s*\[[^\]]+\]\s*(,\s*)?/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+,/g, ",")
      .trim();
    return { text, files };
  });

  return parsed.filter((item) => item.text.length > 0).slice(0, 4);
}

function relativeTime(date: Date | string) {
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(-seconds, "second");
  if (abs < 3600) return rtf.format(-Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(-Math.round(seconds / 3600), "hour");
  if (abs < 604800) return rtf.format(-Math.round(seconds / 86400), "day");
  if (abs < 2629800) return rtf.format(-Math.round(seconds / 604800), "week");
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const CommitLog = () => {
  const { projectId, project } = useProjects();
  const utils = api.useUtils();
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [summarizingHash, setSummarizingHash] = React.useState<string | null>(
    null,
  );

  const { data: commits, isLoading } = api.project.getCommits.useQuery(
    { projectId },
    {
      enabled: !!project && !!projectId.trim(),
      refetchInterval: 15_000,
    },
  );
  const syncCommits = api.project.syncCommits.useMutation({
    onSuccess: (result) => {
      void utils.project.getCommits.invalidate({ projectId });
      if (result.count === 0) {
        toast.message("Already up to date");
      } else {
        toast.success(`Synced ${result.count} new commit(s)`);
      }
    },
    onError: (err) => toast.error(err.message || "Failed to sync commits"),
  });

  const summarizeCommit = api.project.summarizeCommit.useMutation({
    onSuccess: async (result, variables) => {
      await utils.project.getCommits.invalidate({ projectId });
      setExpanded((prev) => ({ ...prev, [variables.commitHash]: true }));
      if (!result.cached) {
        toast.success("Summary ready");
      }
    },
    onError: (err) => toast.error(err.message || "Failed to summarise commit"),
    onSettled: () => setSummarizingHash(null),
  });

  let repoCleaned: string | null = null;
  try {
    if (project?.githubUrl) {
      repoCleaned = parseGithubUrl(project.githubUrl).cleaned;
    }
  } catch {
    repoCleaned = null;
  }

  async function onSummarize(commitHash: string, summary: string, message: string) {
    const already = hasAiCommitSummary(summary, message);
    if (already) {
      setExpanded((prev) => ({
        ...prev,
        [commitHash]: !prev[commitHash],
      }));
      return;
    }
    setSummarizingHash(commitHash);
    summarizeCommit.mutate({ projectId, commitHash });
  }

  if (!project || !projectId.trim()) {
    return (
      <EmptyState
        icon={GitCommitHorizontal}
        title="Select a project"
        description="Choose a project from Projects to view commits."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!commits?.length) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={GitCommitHorizontal}
          title="No commits yet"
          description="Push to your repo or sync once to backfill recent commits. New pushes arrive automatically via GitHub webhooks."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={syncCommits.isPending}
              onClick={() => syncCommits.mutate({ projectId })}
              className="rounded-[20px]"
            >
              <RefreshCw
                className={cn("size-4", syncCommits.isPending && "animate-spin")}
              />
              Sync commits
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={syncCommits.isPending}
          onClick={() => syncCommits.mutate({ projectId })}
          className="text-[#696969] hover:text-[#141413]"
        >
          <RefreshCw
            className={cn("size-4", syncCommits.isPending && "animate-spin")}
          />
          Sync now
        </Button>
      </div>

      <ul className="relative space-y-0">
        {commits.map((commit, commitIdx) => {
          const subject = commitSubject(commit.commitMessage);
          const bodyLines = commit.commitMessage
            .split("\n")
            .slice(1)
            .map((l) => l.trim())
            .filter(Boolean);
          const shortHash = commit.commitHash.slice(0, 7);
          const href = repoCleaned
            ? githubCommitUrl(repoCleaned, commit.commitHash)
            : `${project?.githubUrl}/commit/${commit.commitHash}`;
          const isLast = commitIdx === commits.length - 1;
          const ready = hasAiCommitSummary(commit.summary, commit.commitMessage);
          const isOpen = Boolean(expanded[commit.commitHash]) && ready;
          const changes = isOpen
            ? parseCommitSummary(commit.summary, commit.commitMessage)
            : [];
          const isBusy = summarizingHash === commit.commitHash;

          return (
            <li key={commit.commitHash} className="relative flex gap-4 pb-4">
              <div className="relative flex w-9 shrink-0 flex-col items-center">
                {!isLast ? (
                  <span
                    aria-hidden
                    className="absolute top-9 bottom-0 w-px bg-[#d1cdc7]/80"
                  />
                ) : null}
                {commit.commitAuthorAvatar ? (
                  <Image
                    src={commit.commitAuthorAvatar}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    className="relative z-[1] size-9 rounded-full bg-[#f4f4f4] object-cover ring-2 ring-[#f3f0ee]"
                  />
                ) : (
                  <Image
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(
                      minidenticon(commit.commitAuthorName),
                    )}`}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    className="relative z-[1] size-9 rounded-full bg-[#f4f4f4] object-cover ring-2 ring-[#f3f0ee]"
                  />
                )}
              </div>

              <article className="min-w-0 flex-1 rounded-2xl border border-[#d1cdc7]/80 bg-white p-4 shadow-[0_1px_0_rgba(20,20,19,0.03)] transition-colors hover:border-[#141413]/25">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#696969]">
                  <span className="font-semibold text-[#141413]">
                    {commit.commitAuthorName}
                  </span>
                  <span aria-hidden>·</span>
                  <time dateTime={new Date(commit.commitDate).toISOString()}>
                    {relativeTime(commit.commitDate)}
                  </time>
                  <span aria-hidden>·</span>
                  <Link
                    target="_blank"
                    rel="noreferrer"
                    href={href}
                    className="inline-flex items-center gap-1 rounded-md bg-[#f3f0ee] px-1.5 py-0.5 font-mono text-[11px] text-[#696969] transition-colors hover:bg-[#ebe6e0] hover:text-[#141413]"
                    title={commit.commitHash}
                  >
                    {shortHash}
                    <ExternalLink className="size-3" />
                  </Link>
                </div>

                <h3 className="mt-2 font-display text-[15px] leading-snug tracking-[-0.02em] text-[#141413]">
                  {subject}
                </h3>
                {bodyLines.length > 0 ? (
                  <p className="mt-1 line-clamp-3 text-sm leading-6 text-[#696969]">
                    {bodyLines.join(" ")}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={() =>
                      void onSummarize(
                        commit.commitHash,
                        commit.summary,
                        commit.commitMessage,
                      )
                    }
                    className="h-8 rounded-lg border-[#d1cdc7] text-xs text-[#141413]"
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Summarising…
                      </>
                    ) : isOpen ? (
                      <>
                        <ChevronDown className="size-3.5" />
                        Hide summary
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3.5 text-[#cf4500]" />
                        {ready ? "Show summary" : "Summarize"}
                      </>
                    )}
                  </Button>
                </div>

                {isOpen && changes.length > 0 ? (
                  <div className="mt-3 rounded-xl bg-[#f3f0ee]/70 px-3 py-2.5">
                    <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[#696969] uppercase">
                      <Sparkles className="size-3 text-[#cf4500]" />
                      Summary
                    </p>
                    <ul className="space-y-2">
                      {changes.map((change, idx) => {
                        const visibleFiles = change.files.slice(0, 2);
                        const extra = change.files.length - visibleFiles.length;
                        return (
                          <li
                            key={`${commit.commitHash}-${idx}`}
                            className="flex gap-2"
                          >
                            <span
                              aria-hidden
                              className="mt-2 size-1.5 shrink-0 rounded-full bg-[#cf4500]"
                            />
                            <div className="min-w-0">
                              <p className="text-sm leading-5 text-[#262627]">
                                {change.text}
                              </p>
                              {visibleFiles.length > 0 ? (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {visibleFiles.map((file) => (
                                    <span
                                      key={file}
                                      className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#696969] ring-1 ring-[#d1cdc7]/70"
                                      title={file}
                                    >
                                      {fileBasename(file)}
                                    </span>
                                  ))}
                                  {extra > 0 ? (
                                    <span className="rounded-md px-1.5 py-0.5 text-[10px] text-[#696969]">
                                      +{extra} more
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default CommitLog;
