"use client";
import useProjects from "@/hooks/use-projects";
import { useUser } from "@clerk/nextjs";
import { ExternalLink, Github } from "lucide-react";
import Link from "next/link";
import React from "react";
import CommitLog from "./commit-log";

const dashboard = () => {
  const { project } = useProjects();
  return (
    <div>
      {project?.id}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* github link */}
        <div className="w-fitt bg-primary rounded-md px-4 py-3">
          <div className="item-center flex">
            <Github className="size-5 text-white" />
            <div className="ml-2"></div>
            <p className="text-sm font-medium text-white">
              This project is linked to{" "}
              <Link
                href={project?.githubUrl ?? ""}
                className="inline-flex items-center text-white/80 hover:underline"
              >
                {project?.githubUrl}
                <ExternalLink className="ml-1 size-4" />
              </Link>
            </p>
          </div>
        </div>

        <div className="h-4"></div>
        <div className="item-center flex gap-4">
          Team members Invite Button Archived Buttom
        </div>
      </div>
      <div className="mt-4"></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        ASkQuesionCard MeetingCard
      </div>
      <div className="mt-8"></div>
      <CommitLog/>
    </div>
  );
};

export default dashboard;
