"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FileCode2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GitworkLogo } from "@/components/gitwork-logo";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { askQuestion } from "./action";
import { readStreamableValue } from "@ai-sdk/rsc";

export type FileReference = {
  filename: string;
  sourceCode: string;
  summary: string;
};

function languageFromFilename(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "py":
      return "python";
    case "go":
      return "go";
    case "rs":
      return "rust";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "css":
      return "css";
    case "html":
      return "html";
    default:
      return ext ?? "text";
  }
}

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

function fileBasename(path: string) {
  return path.split(/[/\\]/).pop() ?? path;
}

function fileDir(path: string) {
  const parts = path.split(/[/\\]/);
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

export function FileReferences({ files }: { files: FileReference[] }) {
  const [active, setActive] = useState<string | null>(
    files[0]?.filename ?? null,
  );

  if (!files.length) {
    return (
      <p className="text-slate text-sm">
        No file references were retrieved for this answer.
      </p>
    );
  }

  const selected = files.find((f) => f.filename === active) ?? files[0]!;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(selected.sourceCode);
      toast.success("Copied source to clipboard");
    } catch {
      toast.error("Could not copy source");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-dust bg-lifted">
      {/* Mobile: compact horizontal chips */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-dust px-3 py-2.5 md:hidden">
        {files.map((file) => {
          const isActive = file.filename === selected.filename;
          return (
            <button
              key={file.filename}
              type="button"
              onClick={() => setActive(file.filename)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                isActive
                  ? "bg-ink text-canvas"
                  : "bg-ghost/60 text-slate hover:bg-ghost hover:text-ink",
              )}
              title={file.filename}
            >
              <FileCode2 className="size-3.5 shrink-0 opacity-70" />
              <span className="max-w-[10rem] truncate font-mono">
                {fileBasename(file.filename)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 md:grid md:grid-cols-[minmax(11rem,15rem)_1fr]">
        {/* Desktop: short-name file rail */}
        <div className="hidden max-h-80 overflow-y-auto border-r border-dust md:block">
          <ul className="p-1.5">
            {files.map((file) => {
              const isActive = file.filename === selected.filename;
              const dir = fileDir(file.filename);
              return (
                <li key={file.filename}>
                  <button
                    type="button"
                    onClick={() => setActive(file.filename)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                      isActive
                        ? "bg-ink text-canvas"
                        : "text-slate hover:bg-ghost/70 hover:text-ink",
                    )}
                    title={file.filename}
                  >
                    <FileCode2
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0",
                        isActive ? "text-arc" : "opacity-60",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs font-medium">
                        {fileBasename(file.filename)}
                      </span>
                      {dir ? (
                        <span
                          className={cn(
                            "mt-0.5 block truncate font-mono text-[10px] leading-tight",
                            isActive ? "text-canvas/55" : "text-slate/70",
                          )}
                        >
                          {dir}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Preview pane */}
        <div className="flex min-w-0 flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-dust px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-medium text-ink">
                {fileBasename(selected.filename)}
              </p>
              <p className="mt-0.5 truncate font-mono text-[10px] text-slate">
                {selected.filename}
              </p>
              {selected.summary ? (
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate">
                  {selected.summary}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 text-xs text-slate hover:text-ink"
              onClick={copyCode}
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>
          <pre className="max-h-64 overflow-auto bg-[#1a1918] p-3.5 font-mono text-[0.75rem] leading-5 text-[#f0ebe4]">
            <code
              className={`language-${languageFromFilename(selected.filename)}`}
            >
              {selected.sourceCode}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}

const AskQuestionCard = () => {
  const { project } = useProjects();
  const [question, setQuestion] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileReferences, setFileReferences] = useState<FileReference[]>([]);
  const [answer, setAnswer] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const [refsOpen, setRefsOpen] = useState(true);

  const reindex = api.project.reindexProject.useMutation({
    onSuccess: () =>
      toast.success("Re-indexing started — wait a few minutes, then ask again"),
    onError: (err) => toast.error(err.message),
  });

  const saveAnswer = api.project.saveAnswer.useMutation({
    onSuccess: () => toast.success("Answer saved"),
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!project?.id || !question.trim()) return;

    setLoading(true);
    setOpen(true);
    setAnswer("");
    setFileReferences([]);
    setAskedQuestion(question.trim());
    setRefsOpen(true);

    try {
      const { output, fileReferences: refs } = await askQuestion(
        question.trim(),
        project.id,
      );
      setFileReferences(
        refs.map((r) => ({
          filename: r.filename,
          sourceCode: r.sourcecode,
          summary: r.summary,
        })),
      );
      for await (const delta of readStreamableValue(output)) {
        if (delta) {
          setAnswer((prev) => prev + delta);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to get an answer. Try again.");
    } finally {
      setLoading(false);
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
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 border-dust text-sm"
                disabled={!project?.id || saveAnswer.isPending || !answer}
                onClick={() => {
                  if (!project?.id) return;
                  saveAnswer.mutate({
                    projectId: project.id,
                    question: askedQuestion,
                    fileReference: fileReferences,
                    answer: answer,
                  });
                }}
              >
                {saveAnswer.isPending ? "Saving…" : "Save"}
              </Button>
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
                  <FileReferences files={fileReferences} />
                )
              ) : null}
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative col-span-1 flex h-full flex-col rounded-xl border border-[#d1cdc7] bg-white p-5 lg:col-span-3">
        <div className="mb-4">
          <h3 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
            Ask the codebase
          </h3>
          <p className="mt-1 text-sm text-[#696969]">
            Get grounded answers with file references.
          </p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-1 flex-col space-y-4">
          <Textarea
            placeholder="Which file should I edit to change the home page?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-h-28 flex-1 resize-none rounded-lg border-[#d1cdc7] bg-[#fcfbfa]"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading || !project?.id}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Asking…
                </>
              ) : (
                "Ask Gitwork"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!project?.id || reindex.isPending}
              onClick={() => {
                if (!project?.id) return;
                reindex.mutate({ projectId: project.id });
              }}
            >
              {reindex.isPending ? "Re-indexing…" : "Re-index repo"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
};

export default AskQuestionCard;
