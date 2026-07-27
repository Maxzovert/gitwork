"use client";

import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";
import Link from "next/link";
import React from "react";
import MeetingCard from "../dashboard/meeting-card";
import { Badge } from "lucide-react";
import { Button } from "@/components/ui/button";

const MeetingsPage = () => {
  const { projectId } = useProjects();
  const { data: meetings, isLoading } = api.project.getMeetings.useQuery(
    { projectId: projectId ?? "" },
    {
      enabled: Boolean(projectId),
      refetchInterval: 4000,
    },
  );

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
                {
                  meeting.status === 'PROCESSING' && (
                    <Badge className="bg-yellow-500 text-white">Processing...</Badge>
                  )
                }
              </div>
              <div className="flex items-center text-xs to-gray-500 gap-x-2">
                <p className="whitespace-nowwrap">
                  {meeting.createdAt.toLocaleDateString()}
                </p>
                <p className="truncate">{meeting.issues.length} issues</p>
              </div>
            </div>

            <div className="flex items-center flex-none gap-x-4">
              <Link href={`/meetings/${meeting.id}`}>
                <Button variant="outline">
                  View Meetings
                </Button>
              </Link>
            </div>

          </li>
        ))}
      </ul>
    </>
  );
};

export default MeetingsPage;
