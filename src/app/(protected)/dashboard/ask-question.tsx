"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useUser } from "@clerk/nextjs";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeSelect } from "@/components/ui/theme-select";
import { GitworkLogo } from "@/components/gitwork-logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { askQuestion } from "./action";
import { readStreamableValue } from "@ai-sdk/rsc";
import {
  FileReferences,
  type FileReference,
} from "@/components/file-references";

export type { FileReference };
export { FileReferences };

export function MarkdownAnswer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-foreground mt-4 mb-2 text-xl font-semibold tracking-tight first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-foreground mt-4 mb-2 text-lg font-semibold tracking-tight">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-foreground mt-3 mb-1.5 text-base font-semibold">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="text-foreground/90 mb-3 text-sm leading-7 last:mb-0">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="text-foreground/90 mb-3 list-disc space-y-1.5 pl-5 text-sm leading-6">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="text-foreground/90 mb-3 list-decimal space-y-1.5 pl-5 text-sm leading-6">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="pl-0.5">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            {children}
          </a>
        ),
        strong: ({ children }) => (
          <strong className="text-foreground font-semibold">{children}</strong>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-primary/40 text-muted-foreground mb-3 border-l-2 pl-3 text-sm italic">
            {children}
          </blockquote>
        ),
        code: ({ className, children, ...props }) => {
          const isBlock = Boolean(className?.includes("language-"));
          if (!isBlock) {
            return (
              <code
                className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[0.8rem]"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code
              className={cn("font-mono text-[0.8rem]", className)}
              {...props}
            >
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="border-border mb-3 overflow-x-auto rounded-lg border bg-zinc-950 p-3 text-[0.8rem] leading-6 text-zinc-100">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="mb-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="bg-muted/60 border-b px-3 py-2 font-medium">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b px-3 py-2 align-top">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

type AskQuestionCardProps = {
  className?: string;
};

const AskQuestionCard = ({ className }: AskQuestionCardProps) => {
  const { user } = useUser();
  const { project, projects, projectId, setProjectId } = useProjects();
  const utils = api.useUtils();

  const [question, setQuestion] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileReferences, setFileReferences] = useState<FileReference[]>([]);
  const [answer, setAnswer] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const [refsOpen, setRefsOpen] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [savedToQa, setSavedToQa] = useState(false);

  const membership = api.project.getMyMembership.useQuery(
    { projectId: project?.id ?? "" },
    { enabled: Boolean(project?.id) },
  );
  const indexingStatus = api.project.getIndexingStatus.useQuery(
    { projectId: project?.id ?? "" },
    {
      enabled: Boolean(project?.id),
      refetchInterval: 3000,
    },
  );
  const branches = api.project.getBranches.useQuery(
    {
      githubUrl: project?.githubUrl ?? "",
    },
    {
      enabled: Boolean(project?.githubUrl),
      retry: false,
    },
  );

  useEffect(() => {
    const active = indexingStatus.data?.project?.activeBranch;
    if (active) {
      setSelectedBranch(active);
    } else if (branches.data?.defaultBranch) {
      setSelectedBranch(branches.data.defaultBranch);
    } else {
      setSelectedBranch("");
    }
  }, [
    projectId,
    branches.data?.defaultBranch,
    indexingStatus.data?.project?.activeBranch,
  ]);

  const updateActiveBranch = api.project.updateActiveBranch.useMutation({
    onSuccess: () => {
      void indexingStatus.refetch();
      void utils.project.getProjects.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const saveAnswer = api.project.saveAnswer.useMutation({
    onSuccess: async () => {
      toast.success("Saved to Q&A");
      await utils.project.getQuestions.invalidate({
        projectId: project?.id ?? "",
      });
    },
    onError: (err) => toast.error(err.message),
  });

  const onBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    if (
      !project?.id ||
      membership.data?.role !== "OWNER" ||
      !branch ||
      branch === indexingStatus.data?.project?.activeBranch
    ) {
      return;
    }
    updateActiveBranch.mutate({ projectId: project.id, branch });
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!project?.id || !question.trim()) return;

    const asked = question.trim();
    setLoading(true);
    setOpen(true);
    setAnswer("");
    setFileReferences([]);
    setAskedQuestion(asked);
    setRefsOpen(true);
    setSavedToQa(false);
    setQuestion("");

    let streamed = "";
    let refs: FileReference[] = [];

    try {
      const { output, fileReferences: rawRefs } = await askQuestion(
        asked,
        project.id,
        selectedBranch || null,
      );
      refs = rawRefs.map((r) => ({
        filename: r.filename,
        sourceCode: r.sourcecode,
        summary: r.summary,
      }));
      setFileReferences(refs);

      for await (const delta of readStreamableValue(output)) {
        if (delta) {
          streamed += delta;
          setAnswer(streamed);
        }
      }

      if (streamed.trim()) {
        await saveAnswer.mutateAsync({
          projectId: project.id,
          question: asked,
          fileReference: refs,
          answer: streamed,
        });
        setSavedToQa(true);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to get an answer. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const repoLabel = (p: { name: string; githubUrl: string }) => {
    try {
      const parts = p.githubUrl.replace(/\.git$/, "").split("/");
      const slug = parts.slice(-2).join("/");
      return slug || p.name;
    } catch {
      return p.name;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[88vh] w-full flex-col gap-0 overflow-hidden border-dust bg-white p-0 shadow-xl sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b border-dust bg-lifted px-5 py-4 pr-14 text-left sm:px-6">
            <div className="flex items-start gap-3">
              <GitworkLogo size={34} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <DialogTitle className="font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">
                  Gitwork Answer
                </DialogTitle>
                <DialogDescription className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate">
                  {askedQuestion || "Your question"}
                </DialogDescription>
              </div>
              {savedToQa ? (
                <span className="shrink-0 rounded-full bg-[#eceae6] px-2.5 py-1 text-xs font-medium text-[#696969]">
                  In Q&A
                </span>
              ) : answer ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 border-dust text-sm"
                  disabled={!project?.id || saveAnswer.isPending}
                  onClick={() => {
                    if (!project?.id) return;
                    saveAnswer.mutate(
                      {
                        projectId: project.id,
                        question: askedQuestion,
                        fileReference: fileReferences,
                        answer: answer,
                      },
                      { onSuccess: () => setSavedToQa(true) },
                    );
                  }}
                >
                  {saveAnswer.isPending ? "Saving…" : "Save"}
                </Button>
              ) : null}
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-canvas/40 px-5 py-5 sm:px-6">
            <section>
              <h3 className="mb-2.5 text-[10px] font-semibold tracking-[0.16em] text-slate uppercase">
                Answer
              </h3>
              {loading && !answer ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-dust bg-lifted px-4 py-7 text-sm text-slate">
                  <Loader2 className="size-4 animate-spin text-signal" />
                  Thinking through your codebase…
                </div>
              ) : answer ? (
                <div className="rounded-xl border border-dust bg-white px-4 py-4 shadow-sm">
                  <MarkdownAnswer content={answer} />
                  {loading ? (
                    <span className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate">
                      <Loader2 className="size-3 animate-spin text-signal" />
                      Streaming…
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate">No answer yet.</p>
              )}
            </section>

            <section>
              <button
                type="button"
                onClick={() => setRefsOpen((v) => !v)}
                className="group mb-2.5 flex w-full items-center justify-between gap-2 text-left"
              >
                <h3 className="text-[10px] font-semibold tracking-[0.16em] text-slate uppercase">
                  File references
                  {fileReferences.length > 0 ? (
                    <span className="ml-1.5 font-mono tracking-normal text-slate/80 normal-case">
                      {fileReferences.length}
                    </span>
                  ) : null}
                </h3>
                {refsOpen ? (
                  <ChevronDown className="size-4 text-slate transition-colors group-hover:text-ink" />
                ) : (
                  <ChevronRight className="size-4 text-slate transition-colors group-hover:text-ink" />
                )}
              </button>
              {refsOpen ? (
                loading && fileReferences.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-dust bg-lifted px-4 py-5 text-sm text-slate">
                    Gathering relevant files…
                  </div>
                ) : (
                  <FileReferences
                    files={fileReferences}
                    githubUrl={project?.githubUrl}
                    branch={
                      selectedBranch ||
                      indexingStatus.data?.project?.activeBranch ||
                      branches.data?.defaultBranch ||
                      null
                    }
                  />
                )
              ) : null}
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <div
        className={cn(
          "relative flex h-full flex-col overflow-visible rounded-[28px] border border-ghost bg-[#f7f3ee] p-6 shadow-[0_18px_50px_-28px_rgba(40,28,18,0.35)]",
          className,
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[28px]"
        >
          <div className="absolute -top-16 -left-10 size-56 rounded-full bg-[#e8c9a8]/45 blur-3xl" />
          <div className="absolute top-10 -right-16 size-64 rounded-full bg-[#d9b89a]/35 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 size-52 rounded-full bg-[#f0e0d0]/70 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-1 flex-col overflow-visible">
          <div className="mx-auto max-w-xl text-center">
            <h3 className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
              Ask the codebase
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate">
              Ask anything about the indexed code, then choose the repository
              and branch.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="relative z-20 mx-auto mt-6 flex w-full max-w-xl flex-col gap-4 overflow-visible"
          >
            <div className="flex items-center gap-3">
              {user?.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 shrink-0 rounded-full border border-white/80 shadow-sm"
                />
              ) : (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-canvas shadow-sm">
                  <GitworkLogo size={22} />
                </div>
              )}
              <div className="relative min-w-0 flex-1">
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Write a question to codebase..."
                  disabled={loading || !project?.id}
                  className="h-12 rounded-full border-dust bg-white pr-24 text-sm text-ink shadow-sm placeholder:text-slate/70"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading || !project?.id || !question.trim()}
                  className="absolute top-1/2 right-1.5 h-9 -translate-y-1/2 rounded-full px-4"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Asking
                    </>
                  ) : (
                    "Ask"
                  )}
                </Button>
              </div>
            </div>

            <div className="relative z-30 flex flex-wrap items-center gap-2 overflow-visible">
              <ThemeSelect
                id="ask-repo"
                aria-label="Repository"
                value={projectId ?? ""}
                onChange={setProjectId}
                disabled={!projects?.length}
                className="min-w-[11rem]"
                placeholder="Select repository"
                options={(projects ?? []).map((p) => ({
                  value: p.id,
                  label: repoLabel(p),
                }))}
              />
              <ThemeSelect
                id="ask-branch"
                aria-label="Branch"
                value={selectedBranch}
                onChange={onBranchChange}
                disabled={
                  !branches.data?.branches?.length ||
                  updateActiveBranch.isPending
                }
                className="min-w-[8.5rem]"
                placeholder={
                  branches.isFetching ? "Loading branches…" : "No branches"
                }
                options={(branches.data?.branches ?? []).map((branchName) => ({
                  value: branchName,
                  label: branchName,
                }))}
              />
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default AskQuestionCard;
