"use client";

import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";
import Link from "next/link";
import React from "react";
import MeetingCard from "../dashboard/meeting-card";
import { Button } from "@/components/ui/button";
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
    <>
      <MeetingCard />
      <div className="h-6" />
      <h1 className="text-xl font-semibold">Meetings</h1>
      {meetings && meetings.length === 0 && <div>No meetings found</div>}
      {isLoading && <div>Loading...</div>}
      <ul className="divide-y divide-gray-200">
        {meetings?.map((meeting) => (
          <li
            key={meeting.id}
            className="flex items-center justify-between gap-x-6 py-5"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href={`/meetings/${meeting.id}`}
                  className="text-sm font-semibold"
                >
                  {meeting.name}
                </Link>
                {meeting.status === "PROCESSING" && (
                  <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-xs text-white">
                    Processing...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-x-2 text-xs text-gray-500">
                <p className="whitespace-nowrap">
                  {meeting.createdAt.toLocaleDateString()}
                </p>
                <p className="truncate">{meeting.issues.length} issues</p>
              </div>
            </div>

            <div className="flex flex-none items-center gap-x-4">
              <Link href={`/meetings/${meeting.id}`}>
                <Button type="button" variant="outline">
                  View Meeting
                </Button>
              </Link>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteMeeting.isPending}
                size="sm"
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
    </>
  );
};

export default MeetingsPage;
