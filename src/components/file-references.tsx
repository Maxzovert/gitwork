"use client";

import { useState } from "react";
import { Copy, ExternalLink, FileCode2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { githubBlobUrl, parseGithubUrl } from "@/lib/github-url";

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

function fileBasename(path: string) {
  return path.split(/[/\\]/).pop() ?? path;
}

function fileDir(path: string) {
  const parts = path.split(/[/\\]/);
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

export function FileReferences({
  files,
  githubUrl,
  branch,
}: {
  files: FileReference[];
  githubUrl?: string | null;
  branch?: string | null;
}) {
  const [active, setActive] = useState<string | null>(
    files[0]?.filename ?? null,
  );

  if (!files.length) {
    return (
      <p className="text-sm text-[#696969]">
        No file references were retrieved for this answer.
      </p>
    );
  }

  const selected = files.find((f) => f.filename === active) ?? files[0]!;

  let blobUrl: string | null = null;
  if (githubUrl) {
    try {
      const { cleaned } = parseGithubUrl(githubUrl);
      blobUrl = githubBlobUrl(
        cleaned,
        branch?.trim() || "HEAD",
        selected.filename,
      );
    } catch {
      blobUrl = null;
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(selected.sourceCode);
      toast.success("Copied source to clipboard");
    } catch {
      toast.error("Could not copy source");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#d1cdc7] bg-white">
      <div className="flex gap-1.5 overflow-x-auto border-b border-[#d1cdc7] px-3 py-2.5 md:hidden">
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
                  ? "bg-[#141413] text-[#f3f0ee]"
                  : "bg-[#f3f0ee] text-[#696969] hover:text-[#141413]",
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
        <div className="hidden max-h-80 overflow-y-auto border-r border-[#d1cdc7] md:block">
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
                        ? "bg-[#141413] text-[#f3f0ee]"
                        : "text-[#696969] hover:bg-[#f3f0ee] hover:text-[#141413]",
                    )}
                    title={file.filename}
                  >
                    <FileCode2 className="mt-0.5 size-3.5 shrink-0 opacity-70" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs font-medium">
                        {fileBasename(file.filename)}
                      </span>
                      {dir ? (
                        <span className="mt-0.5 block truncate font-mono text-[10px] leading-tight opacity-70">
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

        <div className="flex min-w-0 flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-[#d1cdc7] px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-medium text-[#141413]">
                {fileBasename(selected.filename)}
              </p>
              <p className="mt-0.5 truncate font-mono text-[10px] text-[#696969]">
                {selected.filename}
              </p>
              {selected.summary ? (
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#696969]">
                  {selected.summary}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {blobUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-[#696969] hover:text-[#141413]"
                  asChild
                >
                  <a href={blobUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" />
                    GitHub
                  </a>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-[#696969] hover:text-[#141413]"
                onClick={copyCode}
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
            </div>
          </div>
          <pre className="max-h-64 overflow-auto bg-[#1a1918] p-3.5 font-mono text-[0.75rem] leading-5 text-[#f0ebe4]">
            <code className={`language-${languageFromFilename(selected.filename)}`}>
              {selected.sourceCode}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
