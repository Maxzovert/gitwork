"use client";

import React, { useState } from "react";

import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  const { data: questions } = api.project.getQuestions.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const selectedQuestion = questions?.[questionIndex];

  return (
    <div>
      <AskQuestionCard />
      <div className="h-4" />
      <h1 className="text-xl font-semibold">Saved Questions</h1>
      <div className="h-2" />
      <Sheet open={open} onOpenChange={setOpen}>
        <div className="flex flex-col gap-2">
          {questions?.length ? (
            questions.map((q, index) => (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  setQuestionIndex(index);
                  setOpen(true);
                }}
                className="flex w-full items-center gap-4 rounded-lg border bg-white p-4 text-left shadow transition-colors hover:bg-muted/40"
              >
                {q.user.imageUrl ? (
                  <img
                    src={q.user.imageUrl}
                    alt=""
                    className="rounded-full"
                    height={30}
                    width={30}
                  />
                ) : (
                  <div className="bg-muted size-[30px] rounded-full" />
                )}
                <div className="flex min-w-0 flex-col text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {userDisplayName(q.user)}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {q.createdAt.toLocaleDateString()}
                    </p>
                    <span className="text-muted-foreground text-sm">
                      {q.createdAt.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {q.question}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">
              No saved questions yet. Ask one from above and save the answer.
            </p>
          )}
        </div>

        {selectedQuestion ? (
          <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[82vw]">
            <SheetHeader className="shrink-0 border-b px-6 py-4 text-left">
              <SheetTitle className="text-base">
                {selectedQuestion.question}
              </SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <section>
                <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                  Answer
                </h3>
                <div className="bg-card rounded-lg border px-4 py-3">
                  <MarkdownAnswer content={selectedQuestion.answer} />
                </div>
              </section>
              <section>
                <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
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
    </div>
  );
};

export default QAPage;
