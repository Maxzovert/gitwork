"use client";

import React, { useState } from "react";
import { MessageSquareText } from "lucide-react";

import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import AskQuestionCard, {
  FileReferences,
  MarkdownAnswer,
  type FileReference,
} from "../dashboard/ask-question";

function parseFileReferences(value: unknown): FileReference[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is FileReference =>
        typeof item === "object" &&
        item !== null &&
        "filename" in item &&
        "sourceCode" in item &&
        typeof item.filename === "string" &&
        typeof item.sourceCode === "string",
    )
    .map((item) => ({
      filename: item.filename,
      sourceCode: item.sourceCode,
      summary: typeof item.summary === "string" ? item.summary : "",
    }));
}

function userDisplayName(user: {
  firstName: string | null;
  lastName: string | null;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || "User";
}

const QAPage = () => {
  const { projectId } = useProjects();
  const { data: questions, isLoading } = api.project.getQuestions.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const selectedQuestion = questions?.[questionIndex];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Q&A"
        description="Interrogate the repo and keep the answers that matter."
      />

      <AskQuestionCard />

      <section className="space-y-4">
        <h2 className="font-display text-foreground text-lg font-semibold tracking-tight">
          Saved questions
        </h2>

        <Sheet open={open} onOpenChange={setOpen}>
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : questions?.length ? (
            <div className="flex flex-col gap-2">
              {questions.map((q, index) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setQuestionIndex(index);
                    setOpen(true);
                  }}
                  className="border-border bg-card hover:border-primary/35 group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all hover:shadow-md"
                >
                  {q.user.imageUrl ? (
                    <img
                      src={q.user.imageUrl}
                      alt=""
                      className="size-9 rounded-full ring-2 ring-background"
                      height={36}
                      width={36}
                    />
                  ) : (
                    <div className="bg-muted size-9 rounded-full" />
                  )}
                  <div className="flex min-w-0 flex-col text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-foreground text-sm font-semibold">
                        {userDisplayName(q.user)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {q.createdAt.toLocaleDateString()} ·{" "}
                        {q.createdAt.toLocaleTimeString()}
                      </p>
                    </div>
                    <p className="text-muted-foreground group-hover:text-foreground mt-0.5 line-clamp-2 text-sm transition-colors">
                      {q.question}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={MessageSquareText}
              title="No saved questions yet"
              description="Ask a question above and save the answer to see it here."
            />
          )}

          {selectedQuestion ? (
            <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[82vw]">
              <SheetHeader className="bg-muted/30 shrink-0 border-b px-6 py-5 text-left">
                <SheetTitle className="font-display text-lg leading-snug font-semibold">
                  {selectedQuestion.question}
                </SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <section>
                  <h3 className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-[0.16em] uppercase">
                    Answer
                  </h3>
                  <div className="bg-card rounded-xl border px-4 py-4">
                    <MarkdownAnswer content={selectedQuestion.answer} />
                  </div>
                </section>
                <section>
                  <h3 className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-[0.16em] uppercase">
                    File references
                  </h3>
                  <FileReferences
                    files={parseFileReferences(selectedQuestion.fileReference)}
                  />
                </section>
              </div>
            </SheetContent>
          ) : null}
        </Sheet>
      </section>
    </div>
  );
};

export default QAPage;
