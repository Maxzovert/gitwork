"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Github,
  ListTodo,
  VideoIcon,
} from "lucide-react";
import Link from "next/link";
import React from "react";
import { toast } from "sonner";

type Issue = NonNullable<
  RouterOutputs["project"]["getMeetingById"]
>["issues"][number];

function IssueCreatedBadge({
  number,
  className,
}: {
  number: number | null | undefined;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-500/20",
        className,
      )}
    >
      <CheckCircle2 className="size-3.5 shrink-0" />
      {number != null ? `Issue #${number}` : "Issue created"}
    </span>
  );
}

function IssueCard({
  issue,
  onCreated,
}: {
  issue: Issue;
  onCreated: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const createIssue = api.project.createGithubIssueFromMeetingIssue.useMutation({
    onSuccess: (data) => {
      if (data.alreadyCreated) {
        toast.message(`Already linked as #${data.number}`);
      } else {
        toast.success(`Created GitHub issue #${data.number}`);
      }
      onCreated();
    },
    onError: (err) => toast.error(err.message || "Failed to create GitHub issue"),
  });

  const linked = Boolean(issue.githubIssueUrl);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{issue.gist}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <span>{issue.createdAt.toLocaleDateString()}</span>
              {linked ? (
                <IssueCreatedBadge number={issue.githubIssueNumber} />
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-foreground text-base font-semibold leading-relaxed">
              {issue.headline}
            </p>
            <blockquote className="border-primary bg-muted/50 rounded-r-lg border-l-4 p-4">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {issue.start} – {issue.end}
              </span>
              <p className="text-foreground mt-2 text-sm leading-relaxed">
                {issue.summary}
              </p>
            </blockquote>
            <div className="flex flex-wrap gap-2">
              {linked ? (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={issue.githubIssueUrl!}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="size-4" />
                    Open on GitHub
                    {issue.githubIssueNumber != null
                      ? ` #${issue.githubIssueNumber}`
                      : ""}
                  </a>
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={createIssue.isPending}
                  onClick={() => createIssue.mutate({ issueId: issue.id })}
                >
                  <Github className="size-4" />
                  {createIssue.isPending
                    ? "Creating…"
                    : "Create GitHub Issue"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "bg-card hover:border-primary/40 flex flex-col rounded-xl border p-5 text-left shadow-sm transition-all hover:shadow-md",
          linked
            ? "border-emerald-500/35 bg-emerald-500/[0.03]"
            : "border-border",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-foreground text-base font-semibold leading-snug">
            {issue.gist}
          </h3>
          {linked ? (
            <IssueCreatedBadge number={issue.githubIssueNumber} />
          ) : null}
        </div>
        <p className="text-muted-foreground mt-2 line-clamp-3 flex-1 text-sm leading-relaxed">
          {issue.headline}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-primary text-sm font-medium">
            View details →
          </span>
          {linked ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <Github className="size-3.5" />
              Created on GitHub
            </span>
          ) : null}
        </div>
      </button>
    </>
  );
}

type Props = {
  meetingId: string;
};

const IssueList = ({ meetingId }: Props) => {
  const utils = api.useUtils();
  const { data: meeting, isLoading, isError, error, refetch, isFetching } =
    api.project.getMeetingById.useQuery(
      { meetingId },
      {
        refetchInterval: (query) =>
          query.state.data?.status === "PROCESSING" ? 4000 : false,
      },
    );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-72" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !meeting) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5" asChild>
          <Link href="/meetings">
            <ArrowLeft className="size-4" />
            Back to meetings
          </Link>
        </Button>
        <EmptyState
          icon={VideoIcon}
          title="Couldn’t open this meeting"
          description={
            error?.message ||
            "The meeting was not found, or you don’t have access."
          }
          action={
            <Button
              type="button"
              variant="outline"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const linkedCount = meeting.issues.filter((issue) =>
    Boolean(issue.githubIssueUrl),
  ).length;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5" asChild>
          <Link href="/meetings">
            <ArrowLeft className="size-4" />
            Back to meetings
          </Link>
        </Button>

        <PageHeader
          title={meeting.name}
          description={`Meeting on ${meeting.createdAt.toLocaleDateString()} · ${meeting.issues.length} issues${
            linkedCount ? ` · ${linkedCount} created on GitHub` : ""
          }`}
          actions={
            <div className="flex items-center gap-3">
              <div className="bg-foreground text-background flex size-10 items-center justify-center rounded-xl">
                <VideoIcon className="size-5" />
              </div>
              <StatusBadge status={meeting.status} />
            </div>
          }
        />
      </div>

      {meeting.issues.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={
            meeting.status === "PROCESSING"
              ? "Still processing"
              : "No issues found"
          }
          description={
            meeting.status === "PROCESSING"
              ? "Issues will appear here once processing finishes."
              : "No issues were extracted for this meeting."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meeting.issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onCreated={() => {
                void utils.project.getMeetingById.invalidate({ meetingId });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default IssueList;
