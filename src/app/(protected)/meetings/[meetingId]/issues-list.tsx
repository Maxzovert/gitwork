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
import { api, type RouterOutputs } from "@/trpc/react";
import { ArrowLeft, ListTodo, VideoIcon } from "lucide-react";
import Link from "next/link";
import React from "react";

type Issue = NonNullable<
  RouterOutputs["project"]["getMeetingById"]
>["issues"][number];

function IssueCard({ issue }: { issue: Issue }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{issue.gist}</DialogTitle>
            <DialogDescription>
              {issue.createdAt.toLocaleDateString()}
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
          </div>
        </DialogContent>
      </Dialog>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border bg-card hover:border-primary/40 flex flex-col rounded-xl border p-5 text-left shadow-sm transition-all hover:shadow-md"
      >
        <h3 className="font-display text-foreground text-base font-semibold leading-snug">
          {issue.gist}
        </h3>
        <p className="text-muted-foreground mt-2 line-clamp-3 flex-1 text-sm leading-relaxed">
          {issue.headline}
        </p>
        <span className="text-primary mt-4 text-sm font-medium">
          View details →
        </span>
      </button>
    </>
  );
}

type Props = {
  meetingId: string;
};

const IssueList = ({ meetingId }: Props) => {
  const { data: meeting, isLoading } = api.project.getMeetingById.useQuery(
    { meetingId },
    { refetchInterval: 4000 },
  );

  if (isLoading || !meeting) {
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
          description={`Meeting on ${meeting.createdAt.toLocaleDateString()} · ${meeting.issues.length} issues`}
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
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
};

export default IssueList;
