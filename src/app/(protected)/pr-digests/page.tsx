"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ExternalLink,
  GitPullRequestArrow,
  MessageSquarePlus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { githubBlobUrl, parseGithubUrl } from "@/lib/github-url";

function RiskBadge({ level }: { level: "low" | "medium" | "high" }) {
  const styles =
    level === "high"
      ? "bg-red-500/10 text-red-700 ring-red-500/20"
      : level === "medium"
        ? "bg-amber-500/10 text-amber-700 ring-amber-500/20"
        : "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20";

  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        styles,
      )}
    >
      {level} risk
    </span>
  );
}

export default function PullRequestDigestsPage() {
  const { project, projectId } = useProjects();
  const [requested, setRequested] = useState(false);
  const [postingPr, setPostingPr] = useState<number | null>(null);

  const digestQuery = api.project.getPullRequestDigest.useQuery(
    { projectId: projectId ?? "" },
    {
      enabled: requested && Boolean(projectId),
      retry: false,
    },
  );

  const postComment = api.project.postPullRequestDigestComment.useMutation({
    onSuccess: (data, variables) => {
      toast.success(`Posted review comment on #${variables.prNumber}`, {
        action: {
          label: "Open PR",
          onClick: () =>
            window.open(data.prUrl, "_blank", "noopener,noreferrer"),
        },
      });
    },
    onError: (err) => toast.error(err.message || "Failed to post comment"),
    onSettled: () => setPostingPr(null),
  });

  const generateDigest = () => {
    if (!projectId) return;
    setRequested(true);
    void digestQuery.refetch();
  };

  const branch = project?.activeBranch ?? project?.defaultBranch ?? "HEAD";
  let repoCleaned: string | null = null;
  try {
    if (project?.githubUrl) {
      repoCleaned = parseGithubUrl(project.githubUrl).cleaned;
    }
  } catch {
    repoCleaned = null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="PR Digests"
        description="AI summary of open pull requests, risk areas, and what changed in the last 7 days."
        actions={
          <Button
            type="button"
            onClick={generateDigest}
            disabled={!projectId || digestQuery.isFetching}
            className="gap-2"
          >
            <RefreshCw
              className={cn("size-4", digestQuery.isFetching && "animate-spin")}
            />
            {requested ? "Refresh digest" : "Generate digest"}
          </Button>
        }
      />

      {!projectId ? (
        <EmptyState
          icon={GitPullRequestArrow}
          title="Select a project"
          description="Choose a project from Projects to generate a PR digest."
        />
      ) : !requested ? (
        <EmptyState
          icon={GitPullRequestArrow}
          title="Generate a PR digest"
          description="Pull live open PRs from GitHub and get risk-aware review summaries."
          action={
            <Button type="button" onClick={generateDigest}>
              Generate digest
            </Button>
          }
        />
      ) : digestQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : digestQuery.isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Could not generate digest"
          description={digestQuery.error.message}
          action={
            <Button type="button" variant="outline" onClick={generateDigest}>
              Try again
            </Button>
          }
        />
      ) : digestQuery.data ? (
        <>
          <section className="rounded-xl border border-[#d1cdc7] bg-white p-5">
            <h3 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
              Executive summary
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#141413]">
              {digestQuery.data.executiveSummary}
            </p>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#d1cdc7] bg-white p-5">
              <p className="text-xs font-semibold tracking-[0.08em] text-[#696969] uppercase">
                Opened
              </p>
              <p className="mt-2 font-display text-3xl tracking-[-0.02em] text-[#141413]">
                {digestQuery.data.changedSinceLastWeek.opened}
              </p>
              <p className="mt-1 text-sm text-[#696969]">
                PRs opened in the last 7 days
              </p>
            </div>
            <div className="rounded-xl border border-[#d1cdc7] bg-white p-5">
              <p className="text-xs font-semibold tracking-[0.08em] text-[#696969] uppercase">
                Merged
              </p>
              <p className="mt-2 font-display text-3xl tracking-[-0.02em] text-[#141413]">
                {digestQuery.data.changedSinceLastWeek.merged}
              </p>
              <p className="mt-1 text-sm text-[#696969]">
                PRs merged in the last 7 days
              </p>
            </div>
            <div className="rounded-xl border border-[#d1cdc7] bg-white p-5">
              <p className="text-xs font-semibold tracking-[0.08em] text-[#696969] uppercase">
                Active
              </p>
              <p className="mt-2 font-display text-3xl tracking-[-0.02em] text-[#141413]">
                {digestQuery.data.changedSinceLastWeek.active}
              </p>
              <p className="mt-1 text-sm text-[#696969]">
                PRs updated in the last 7 days
              </p>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-xl border border-[#d1cdc7] bg-white p-5">
              <h3 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
                Open pull requests
              </h3>
              {digestQuery.data.openPullRequests.length ? (
                <div className="mt-4 space-y-4">
                  {digestQuery.data.openPullRequests.map((pr) => (
                    <article
                      key={pr.number}
                      className="rounded-xl border border-[#d1cdc7] bg-[#fcfbfa] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={pr.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 font-display text-base tracking-[-0.02em] text-[#141413] hover:underline"
                          >
                            #{pr.number} {pr.title}
                            <ExternalLink className="size-3.5" />
                          </Link>
                          <p className="mt-1 text-sm text-[#696969]">
                            {pr.author} · {pr.changedFiles} files · +
                            {pr.additions}/-{pr.deletions}
                            {pr.isDraft ? " · Draft" : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <RiskBadge level={pr.riskLevel} />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              !projectId ||
                              postComment.isPending ||
                              postingPr === pr.number
                            }
                            onClick={() => {
                              if (!projectId) return;
                              setPostingPr(pr.number);
                              postComment.mutate({
                                projectId,
                                prNumber: pr.number,
                                title: pr.title,
                                summary: pr.summary,
                                riskLevel: pr.riskLevel,
                                riskAreas: pr.riskAreas,
                                reviewerFocus: pr.reviewerFocus,
                              });
                            }}
                          >
                            <MessageSquarePlus className="size-3.5" />
                            {postingPr === pr.number
                              ? "Posting…"
                              : "Post to GitHub"}
                          </Button>
                        </div>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#141413]">
                        {pr.summary}
                      </p>

                      {pr.riskAreas.length ? (
                        <div className="mt-4">
                          <p className="text-xs font-semibold tracking-[0.08em] text-[#696969] uppercase">
                            Risk areas
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {pr.riskAreas.map((risk) => (
                              <span
                                key={risk}
                                className="rounded-full bg-[#eceae6] px-2.5 py-1 text-xs text-[#696969]"
                              >
                                {risk}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {pr.reviewerFocus.length ? (
                        <div className="mt-4">
                          <p className="text-xs font-semibold tracking-[0.08em] text-[#696969] uppercase">
                            Reviewer focus
                          </p>
                          <ul className="mt-2 space-y-1.5 text-sm text-[#141413]">
                            {pr.reviewerFocus.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {pr.riskLevel !== "low" &&
                      pr.filenames.length &&
                      repoCleaned ? (
                        <div className="mt-4">
                          <p className="text-xs font-semibold tracking-[0.08em] text-[#696969] uppercase">
                            Risk files
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {pr.filenames.slice(0, 6).map((filename) => (
                              <a
                                key={filename}
                                href={githubBlobUrl(
                                  repoCleaned,
                                  branch,
                                  filename,
                                )}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-[#eceae6] px-2 py-1 font-mono text-[11px] text-[#696969] hover:text-[#141413]"
                              >
                                {filename.split("/").pop()}
                                <ExternalLink className="size-3" />
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={GitPullRequestArrow}
                  title="No open PRs"
                  description="There are no open pull requests for this repository right now."
                  className="mt-4"
                />
              )}
            </div>

            <div className="space-y-4">
              <section className="rounded-xl border border-[#d1cdc7] bg-white p-5">
                <h3 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
                  Risk highlights
                </h3>
                {digestQuery.data.riskHighlights.length ? (
                  <div className="mt-4 space-y-3">
                    {digestQuery.data.riskHighlights.map((item) => (
                      <div
                        key={item.prNumber}
                        className="rounded-xl border border-[#d1cdc7] bg-[#fcfbfa] p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="min-w-0 truncate text-sm font-medium text-[#141413]">
                            #{item.prNumber} {item.title}
                          </p>
                          <RiskBadge level={item.riskLevel} />
                        </div>
                        <ul className="mt-3 space-y-1.5 text-sm text-[#696969]">
                          {item.reasons.map((reason) => (
                            <li key={reason}>- {reason}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[#696969]">
                    No major risk flags detected across current open PRs.
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-[#d1cdc7] bg-white p-5">
                <h3 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
                  Changed since last week
                </h3>
                {digestQuery.data.changedSinceLastWeek.themes.length ? (
                  <ul className="mt-4 space-y-2 text-sm text-[#141413]">
                    {digestQuery.data.changedSinceLastWeek.themes.map(
                      (theme) => (
                        <li key={theme}>- {theme}</li>
                      ),
                    )}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-[#696969]">
                    No dominant themes were detected from recent PR activity.
                  </p>
                )}
              </section>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
