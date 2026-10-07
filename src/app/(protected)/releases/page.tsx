"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Tag } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";

export default function ReleasesPage() {
  const { project, projectId } = useProjects();
  const [baseTag, setBaseTag] = useState("");
  const [headTag, setHeadTag] = useState("");
  const [notes, setNotes] = useState("");
  const [releaseName, setReleaseName] = useState("");
  const [releaseTag, setReleaseTag] = useState("");

  const tagsQuery = api.project.listGithubTags.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId), retry: false },
  );

  const generateChangelog = api.project.generateChangelog.useMutation({
    onSuccess: (data) => {
      setNotes(data.notes);
      setReleaseTag(data.head);
      setReleaseName(`Release ${data.head}`);
      toast.success("Changelog generated");
    },
    onError: (err) => toast.error(err.message || "Failed to generate changelog"),
  });

  const createRelease = api.project.createDraftGithubRelease.useMutation({
    onSuccess: (data) => {
      toast.success("Draft release created", {
        action: {
          label: "Open",
          onClick: () => window.open(data.url, "_blank", "noopener,noreferrer"),
        },
      });
    },
    onError: (err) => toast.error(err.message || "Failed to create draft release"),
  });

  const tags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data]);
  const defaultHead =
    project?.activeBranch ?? project?.defaultBranch ?? "HEAD";

  const headOptions = useMemo(() => {
    const names = tags.map((t) => t.name);
    if (defaultHead && !names.includes(defaultHead)) {
      return [defaultHead, ...names];
    }
    return names;
  }, [tags, defaultHead]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Releases"
        description="Generate changelog notes between Git tags and create a draft GitHub Release."
      />

      {!projectId ? (
        <EmptyState
          icon={Tag}
          title="Select a project"
          description="Choose a project from Projects to draft release notes."
        />
      ) : tagsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : tagsQuery.isError ? (
        <EmptyState
          icon={Tag}
          title="Could not load tags"
          description={tagsQuery.error.message}
        />
      ) : (
        <>
          <section className="rounded-xl border border-[#d1cdc7] bg-white p-5">
            <h3 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
              Compare range
            </h3>
            <p className="mt-1 text-sm text-[#696969]">
              Pick a base tag and a head (tag or active branch). Pushes to the
              active branch also re-index the codebase automatically.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-[#141413]">Base tag</span>
                <select
                  className="border-border bg-background w-full rounded-lg border px-3 py-2"
                  value={baseTag}
                  onChange={(e) => setBaseTag(e.target.value)}
                >
                  <option value="">Select base…</option>
                  {tags.map((tag) => (
                    <option key={tag.name} value={tag.name}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-[#141413]">Head</span>
                <select
                  className="border-border bg-background w-full rounded-lg border px-3 py-2"
                  value={headTag}
                  onChange={(e) => setHeadTag(e.target.value)}
                >
                  <option value="">
                    {defaultHead} (active branch)
                  </option>
                  {headOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4">
              <Button
                type="button"
                disabled={!baseTag || generateChangelog.isPending}
                onClick={() => {
                  if (!projectId || !baseTag) return;
                  generateChangelog.mutate({
                    projectId,
                    baseTag,
                    headTag: headTag || undefined,
                  });
                }}
              >
                {generateChangelog.isPending
                  ? "Generating…"
                  : "Generate changelog"}
              </Button>
            </div>

            {!tags.length ? (
              <p className="mt-4 text-sm text-[#696969]">
                No tags found on this repository yet. Create a tag on GitHub
                first, then refresh this page.
              </p>
            ) : null}
          </section>

          {notes ? (
            <section className="space-y-4 rounded-xl border border-[#d1cdc7] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
                  Release notes
                </h3>
                {generateChangelog.data?.compareUrl ? (
                  <a
                    href={generateChangelog.data.compareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[#696969] hover:text-[#141413]"
                  >
                    View compare on GitHub
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </div>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={16}
                className="border-border bg-[#fcfbfa] w-full rounded-lg border px-3 py-3 font-mono text-sm leading-6 text-[#141413]"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-[#141413]">
                    Release title
                  </span>
                  <input
                    className="border-border bg-background w-full rounded-lg border px-3 py-2"
                    value={releaseName}
                    onChange={(e) => setReleaseName(e.target.value)}
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-[#141413]">
                    Tag name
                  </span>
                  <input
                    className="border-border bg-background w-full rounded-lg border px-3 py-2"
                    value={releaseTag}
                    onChange={(e) => setReleaseTag(e.target.value)}
                  />
                </label>
              </div>

              <Button
                type="button"
                disabled={
                  !notes.trim() ||
                  !releaseName.trim() ||
                  !releaseTag.trim() ||
                  createRelease.isPending
                }
                onClick={() => {
                  if (!projectId) return;
                  createRelease.mutate({
                    projectId,
                    tag: releaseTag.trim(),
                    name: releaseName.trim(),
                    body: notes,
                  });
                }}
              >
                {createRelease.isPending
                  ? "Creating draft…"
                  : "Create draft Release on GitHub"}
              </Button>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
