"use client";

import useProjects from "@/hooks/use-projects";
import { ExternalLink, Github, MessageSquareText } from "lucide-react";
import Link from "next/link";
import React from "react";
import CommitLog from "./commit-log";
import AskQuestionCard from "./ask-question";
import IndexingPanel from "./indexing-panel";
import MeetingCard from "./meeting-card";
import { PageHeader } from "@/components/page-header";
import { api } from "@/trpc/react";

const Dashboard = () => {
  const { project, projectId } = useProjects();
  const indexingStatus = api.project.getIndexingStatus.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );
  const { data: questions } = api.project.getQuestions.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );
  const recentQuestions = questions?.slice(0, 4) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={project?.name ?? "Dashboard"}
        description="Ask the codebase, upload meetings, and scan AI commit summaries."
      />

      {project?.githubUrl ? (
        <a
          href={project.githubUrl}
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-3 rounded-xl border border-[#d1cdc7] bg-[#fcfbfa] px-4 py-3 transition-colors hover:border-[#141413]/30"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#141413] text-[#f3f0ee]">
            <Github className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#696969]">
              Connected repository
            </p>
            <p className="truncate text-sm font-medium text-[#141413] group-hover:underline">
              {project.githubUrl.replace(/^https?:\/\//, "")}
            </p>
            <p className="mt-1 text-xs text-[#696969]">
              Branch: {indexingStatus.data?.project?.activeBranch ?? "Unknown"}
              {indexingStatus.data?.project?.lastIndexedAt
                ? ` · Indexed ${new Date(
                    indexingStatus.data.project.lastIndexedAt,
                  ).toLocaleString()}`
                : ""}
              {" · "}
              Pushes to this branch refresh the index
            </p>
          </div>
          <ExternalLink className="size-4 shrink-0 text-[#696969]" />
        </a>
      ) : null}

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-5">
        <div className="col-span-1 flex h-full flex-col gap-4 lg:col-span-3">
          <AskQuestionCard className="flex-1" />
          <IndexingPanel />
        </div>
        <MeetingCard />
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
            Q&amp;A
          </h2>
          <Link
            href="/qa"
            className="text-xs font-medium text-[#696969] hover:text-[#141413]"
          >
            Open full Q&amp;A
          </Link>
        </div>
        {recentQuestions.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {recentQuestions.map((q) => (
              <Link
                key={q.id}
                href="/qa"
                className="group rounded-xl border border-[#d1cdc7] bg-white px-4 py-3 transition-colors hover:border-[#141413]/30"
              >
                <p className="line-clamp-2 text-sm font-medium text-[#141413] group-hover:underline">
                  {q.question}
                </p>
                <p className="mt-1.5 text-xs text-[#696969]">
                  {q.createdAt.toLocaleDateString()} ·{" "}
                  {q.createdAt.toLocaleTimeString()}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-dashed border-[#d1cdc7] bg-[#fcfbfa] px-4 py-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#141413] text-[#f3f0ee]">
              <MessageSquareText className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#141413]">
                No questions yet
              </p>
              <p className="mt-1 text-sm text-[#696969]">
                Ask above — answers are saved here and on the Q&amp;A page.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
            Recent commits
          </h2>
          <span className="text-xs text-[#696969]">Live via GitHub webhooks</span>
        </div>
        <CommitLog />
      </section>
    </div>
  );
};

export default Dashboard;
