"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, type RouterOutputs } from "@/trpc/react";
import { VideoIcon } from "lucide-react";
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
            <DialogTitle>{issue.gist}</DialogTitle>
            <DialogDescription>
              {issue.createdAt.toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-foreground text-lg font-semibold leading-relaxed">
              {issue.headline}
            </p>
            <blockquote className="border-primary bg-muted/40 border-l-4 p-4">
              <span className="text-muted-foreground text-sm">
                {issue.start} – {issue.end}
              </span>
              <p className="text-foreground mt-2 text-sm leading-relaxed">
                {issue.summary}
              </p>
            </blockquote>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="relative">
        <CardHeader>
          <CardTitle className="text-xl">{issue.gist}</CardTitle>
          <div className="border-b" />
          <CardDescription>{issue.headline}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpen(true)} variant="outline" className="w-full">
            View Details
          </Button>
        </CardContent>
      </Card>
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
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 rounded-full p-3">
            <VideoIcon className="text-primary h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{meeting.name}</h1>
            <p className="text-muted-foreground text-sm">
              Meeting on {meeting.createdAt.toLocaleDateString()} ·{" "}
              {meeting.issues.length} issues
            </p>
          </div>
        </div>
        {meeting.status === "PROCESSING" && (
          <span className="rounded-full bg-yellow-500 px-3 py-1 text-xs text-white">
            Processing...
          </span>
        )}
      </div>

      {meeting.issues.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {meeting.status === "PROCESSING"
            ? "Issues will appear here once processing finishes."
            : "No issues found for this meeting."}
        </p>
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
