"use client";
import React from "react";
import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { minidenticon } from "minidenticons";

const CommitLog = () => {
  const { projectId, project } = useProjects();
  const { data: commits } = api.project.getCommits.useQuery({ projectId });
  return (
    <>
      <ul className="space-y-6">
        {commits?.map((commit, commitIdx) => {
          return (
            <li key={commitIdx} className="relative flex gap-x-4">
              <div
                className={cn(
                  commitIdx === commits.length - 1
                    ? "h-6"
                    : "absolute top-0 -bottom-6",
                  "absolute top-0 left-0 flex w-6",
                )}
              >
                <div className="relative mx-auto h-full w-px bg-gray-200"></div>
              </div>

              <>
                {commit.commitAuthorAvatar ? (
                  <img
                    src={commit.commitAuthorAvatar}
                    alt={`${commit.commitAuthorName}'s avatar`}
                    className="relative mt-3 size-6 flex-none rounded-full bg-gray-50"
                  />
                ) : (
                  <img
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(
                      minidenticon(commit.commitAuthorName),
                    )}`}
                    alt={`${commit.commitAuthorName}'s minidenticon`}
                    className="relative mt-3 size-6 flex-none rounded-full bg-gray-50"
                  />
                )}

                <div className="flex-auto rounded-md bg-white p-3 ring-1 ring-gray-200 ring-inset">
                  <div className="flex justify-between gap-x-4">
                    <Link
                      target="_blank"
                      href={`${project?.githubUrl}/commits/${commit.commitHash}`}
                      className="py-0.5 text-sm leading-5 text-gray-500"
                    >
                      <span className="font-bold text-gray-900">
                        {commit.commitAuthorName}
                      </span>{" "}
                      <span className="inline-flex items-center">
                        commited
                        <ExternalLink className="m-1 size-4" />
                      </span>
                    </Link>
                  </div>
                  <span className="font-semibold">{commit.commitMessage}</span>
                  <pre className="mt-2 text-sm leading-6 whitespace-pre-wrap text-gray-500">
                    {commit.summary}
                  </pre>
                </div>
              </>
            </li>
          );
        })}
      </ul>
    </>
  );
};

export default CommitLog;
