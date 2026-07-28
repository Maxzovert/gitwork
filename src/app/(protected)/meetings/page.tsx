"use client";

import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";
import Link from "next/link";
import React from "react";
import { Presentation } from "lucide-react";
import MeetingCard from "../dashboard/meeting-card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const MeetingsPage = () => {
  const { projectId } = useProjects();
  const { data: meetings, isLoading } = api.project.getMeetings.useQuery(
    { projectId: projectId ?? "" },
    {
      enabled: Boolean(projectId),
      refetchInterval: 4000,
    },
  );
  const deleteMeeting = api.project.deleteMeeting.useMutation();
  const utils = api.useUtils();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Meetings"
        description="Upload recordings and review AI-extracted issues. History is shared with your team."
      />

      <MeetingCard className="col-span-full max-w-xl" />

      <section className="space-y-4">
        <h2 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
          All meetings
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : meetings && meetings.length === 0 ? (
          <EmptyState
            icon={Presentation}
            title="No meetings yet"
            description="Upload a meeting recording above to get started."
          />
        ) : (
          <ul className="divide-y divide-[#d1cdc7] overflow-hidden rounded-xl border border-[#d1cdc7] bg-white">
            {meetings?.map((meeting) => (
              <li
                key={meeting.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[#fcfbfa]"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                      href={`/meetings/${meeting.id}`}
                      className="font-display text-sm tracking-[-0.02em] text-[#141413] hover:underline"
                    >
                      {meeting.name}
                    </Link>
                    <StatusBadge status={meeting.status} />
                  </div>
                  <div className="flex items-center gap-x-2 text-xs text-[#696969]">
                    <span className="whitespace-nowrap">
                      {meeting.createdAt.toLocaleDateString()}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="truncate">
                      {meeting.issues.length} issues
                    </span>
                    {meeting.createdBy ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate">
                          {[
                            meeting.createdBy.firstName,
                            meeting.createdBy.lastName,
                          ]
                            .filter(Boolean)
                            .join(" ") || "Teammate"}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-none items-center gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href={`/meetings/${meeting.id}`}>View</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={deleteMeeting.isPending}
                    size="sm"
                    className="text-[#cf4500] hover:bg-[#cf4500]/10 hover:text-[#cf4500]"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (
                        !confirm(
                          `Delete meeting "${meeting.name}"? This cannot be undone.`,
                        )
                      ) {
                        return;
                      }
                      deleteMeeting.mutate(
                        { meetingId: meeting.id },
                        {
                          onSuccess: () => {
                            toast.success("Meeting deleted successfully");
                            void utils.project.getMeetings.invalidate({
                              projectId: projectId ?? "",
                            });
                          },
                          onError: () => {
                            toast.error("Failed to delete meeting");
                          },
                        },
                      );
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default MeetingsPage;
