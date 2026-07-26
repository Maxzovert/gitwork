"use client";

import Image from "next/image";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type FileReference = {
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

function MarkdownAnswer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mt-4 mb-2 text-xl font-semibold tracking-tight text-foreground first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-4 mb-2 text-lg font-semibold tracking-tight text-foreground">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-3 mb-1.5 text-base font-semibold text-foreground">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="mb-3 text-sm leading-7 text-foreground/90 last:mb-0">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-foreground/90">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-foreground/90">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="pl-0.5">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {children}
          </a>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-3 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        code: ({ className, children, ...props }) => {
          const isBlock = Boolean(className?.includes("language-"));
          if (!isBlock) {
            return (
              <code
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8rem] text-foreground"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code className={cn("font-mono text-[0.8rem]", className)} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-3 overflow-x-auto rounded-lg border border-border bg-zinc-950 p-3 text-[0.8rem] leading-6 text-zinc-100">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="mb-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b bg-muted/60 px-3 py-2 font-medium">
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

function FileReferences({ files }: { files: FileReference[] }) {
  const [active, setActive] = useState<string | null>(files[0]?.filename ?? null);

  if (!files.length) {
    return (
      <p className="text-sm text-muted-foreground">
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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {files.map((file) => {
          const isActive = file.filename === selected.filename;
          return (
            <button
              key={file.filename}
              type="button"
              onClick={() => setActive(file.filename)}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              title={file.filename}
            >
              <FileCode2 className="size-3.5 shrink-0" />
              <span className="truncate font-mono">{file.filename}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs font-medium text-foreground">
              {selected.filename}
            </p>
            {selected.summary ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {selected.summary}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={copyCode}
          >
            <Copy className="size-3.5" />
            Copy
          </Button>
        </div>
        <pre className="max-h-64 overflow-auto bg-zinc-950 p-3 font-mono text-[0.75rem] leading-5 text-zinc-100">
          <code className={`language-${languageFromFilename(selected.filename)}`}>
            {selected.sourceCode}
          </code>
        </pre>
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
        <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <div className="flex items-start gap-3">
              <Image
                src="/logo.png"
                alt="Gitwork"
                width={36}
                height={36}
                className="mt-0.5 rounded-md"
              />
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base">Gitwork Answer</DialogTitle>
                <DialogDescription className="mt-1 line-clamp-2 text-sm">
                  {askedQuestion || "Your question"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <section>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Answer
              </h3>
              {loading && !answer ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Thinking through your codebase…
                </div>
              ) : answer ? (
                <div className="rounded-lg border bg-card px-4 py-3">
                  <MarkdownAnswer content={answer} />
                  {loading ? (
                    <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      Streaming…
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No answer yet.</p>
              )}
            </section>

            <section>
              <button
                type="button"
                onClick={() => setRefsOpen((v) => !v)}
                className="mb-2 flex w-full items-center justify-between gap-2 text-left"
              >
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  File references
                  {fileReferences.length > 0
                    ? ` (${fileReferences.length})`
                    : ""}
                </h3>
                {refsOpen ? (
                  <ChevronDown className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground" />
                )}
              </button>
              {refsOpen ? (
                loading && fileReferences.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
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

      <Card className="relative col-span-3">
        <CardHeader>
          <CardTitle>Ask a Question</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <Textarea
              placeholder="Which file should I edit to change the home page?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-24"
            />
            <div className="mt-4 flex flex-wrap gap-2">
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
        </CardContent>
      </Card>
    </>
  );
};

export default AskQuestionCard;
