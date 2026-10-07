"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  KeyRound,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { DeleteProjectDialog } from "@/components/delete-project-dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeSelect } from "@/components/ui/theme-select";
import { GithubTokenGuide } from "@/components/github-token-guide";
import useProjects from "@/hooks/use-projects";
import { cn } from "@/lib/utils";

type NotificationKey =
  | "emailNotifications"
  | "productUpdates"
  | "commitDigest"
  | "meetingAlerts"
  | "indexingAlerts";

const NOTIFICATION_ROWS: {
  key: NotificationKey;
  title: string;
  description: string;
}[] = [
  {
    key: "emailNotifications",
    title: "Email notifications",
    description: "Receive important account and project alerts by email.",
  },
  {
    key: "productUpdates",
    title: "Product updates",
    description: "Occasional notes about new Gitwork features.",
  },
  {
    key: "commitDigest",
    title: "Commit digests",
    description: "Summaries when your linked repos receive new commits.",
  },
  {
    key: "meetingAlerts",
    title: "Meeting alerts",
    description: "Notify when a meeting finishes processing.",
  },
  {
    key: "indexingAlerts",
    title: "Indexing alerts",
    description: "Notify when repo indexing completes or fails.",
  },
];

const PROVIDER_OPTIONS = [
  { value: "GITHUB", label: "GitHub" },
  { value: "GEMINI", label: "Gemini" },
  { value: "ASSEMBLYAI", label: "AssemblyAI" },
  { value: "CUSTOM", label: "Custom" },
];

function providerLabel(provider: string) {
  return (
    PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ??
    provider
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        checked ? "bg-[#141413]" : "bg-[#d1cdc7]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const utils = api.useUtils();
  const { project, projects, projectId, setProjectId } = useProjects();
  const { data: settings, isLoading: settingsLoading } =
    api.settings.getSettings.useQuery();
  const { data: tokens, isLoading: tokensLoading } =
    api.settings.listTokens.useQuery();
  const { data: membership } = api.project.getMyMembership.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );

  const [draft, setDraft] = useState({
    emailNotifications: true,
    productUpdates: false,
    commitDigest: true,
    meetingAlerts: true,
    indexingAlerts: true,
  });
  const [tokenName, setTokenName] = useState("");
  const [tokenProvider, setTokenProvider] = useState("GITHUB");
  const [tokenValue, setTokenValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isOwner = membership?.role === "OWNER";

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const updateSettings = api.settings.updateSettings.useMutation({
    onSuccess: async () => {
      await utils.settings.getSettings.invalidate();
      toast.success("Notification preferences saved");
    },
    onError: (error) => toast.error(error.message),
  });

  const addToken = api.settings.addToken.useMutation({
    onSuccess: async () => {
      setTokenName("");
      setTokenValue("");
      setTokenProvider("GITHUB");
      await utils.settings.listTokens.invalidate();
      toast.success("Token saved encrypted");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteToken = api.settings.deleteToken.useMutation({
    onSuccess: async () => {
      await utils.settings.listTokens.invalidate();
      toast.success("Token removed");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteProject = api.project.deleteProject.useMutation({
    onSuccess: () => {
      if (!project) return;
      toast.success("Project deleted");
      setDeleteOpen(false);
      const remaining = projects?.filter((p) => p.id !== project.id) ?? [];
      utils.project.getProjects.setData(undefined, remaining);
      setProjectId(remaining[0]?.id ?? "");
      void utils.project.getProjects.invalidate();
      void utils.project.getMeetings.invalidate();
      void utils.project.getCommits.invalidate();
      if (!remaining.length) {
        router.replace("/create");
      }
    },
    onError: (error) => toast.error(error.message || "Failed to delete project"),
  });

  const settingsDirty =
    settings &&
    (draft.emailNotifications !== settings.emailNotifications ||
      draft.productUpdates !== settings.productUpdates ||
      draft.commitDigest !== settings.commitDigest ||
      draft.meetingAlerts !== settings.meetingAlerts ||
      draft.indexingAlerts !== settings.indexingAlerts);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage notifications, encrypted API tokens, and the active project."
      />

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-[#696969]" />
          <h2 className="text-base font-semibold tracking-[-0.02em] text-[#141413]">
            Notifications
          </h2>
        </div>

        <div className="divide-y divide-[#e6e2dc] rounded-2xl border border-[#d1cdc7] bg-white">
          {settingsLoading
            ? Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 p-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-7 w-12 rounded-full" />
                </div>
              ))
            : NOTIFICATION_ROWS.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#141413]">
                      {row.title}
                    </p>
                    <p className="mt-0.5 text-sm text-[#696969]">
                      {row.description}
                    </p>
                  </div>
                  <Toggle
                    checked={draft[row.key]}
                    disabled={updateSettings.isPending}
                    onChange={(next) =>
                      setDraft((prev) => ({ ...prev, [row.key]: next }))
                    }
                  />
                </div>
              ))}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={!settingsDirty || updateSettings.isPending}
            onClick={() => updateSettings.mutate(draft)}
            className="bg-[#141413] text-[#f3f0ee] hover:bg-[#2a2928]"
          >
            {updateSettings.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save notifications"
            )}
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-[#696969]" />
          <h2 className="text-base font-semibold tracking-[-0.02em] text-[#141413]">
            API tokens
          </h2>
        </div>
        <p className="text-sm text-[#696969]">
          Tokens are encrypted with AES-256-GCM before storage. Only the last
          four characters are shown after save. A GitHub token saved here is
          preferred for API calls (over Auth0 GitHub OAuth and server{" "}
          <code className="text-[#141413]">GITHUB_TOKEN</code>).
        </p>

        {tokenProvider === "GITHUB" ? (
          <GithubTokenGuide variant="full" />
        ) : null}

        <form
          className="space-y-3 rounded-2xl border border-[#d1cdc7] bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!tokenName.trim() || !tokenValue.trim()) {
              toast.error("Name and token are required");
              return;
            }
            addToken.mutate({
              name: tokenName.trim(),
              provider: tokenProvider as
                | "GITHUB"
                | "GEMINI"
                | "ASSEMBLYAI"
                | "CUSTOM",
              token: tokenValue.trim(),
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="token-name"
                className="text-xs font-semibold tracking-wide text-[#696969] uppercase"
              >
                Label
              </label>
              <Input
                id="token-name"
                value={tokenName}
                onChange={(event) => setTokenName(event.target.value)}
                placeholder="Personal GitHub PAT"
                className="border-[#d1cdc7] bg-[#f3f0ee]"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="token-provider"
                className="text-xs font-semibold tracking-wide text-[#696969] uppercase"
              >
                Provider
              </label>
              <ThemeSelect
                id="token-provider"
                value={tokenProvider}
                onChange={setTokenProvider}
                options={PROVIDER_OPTIONS}
                aria-label="Token provider"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="token-value"
              className="text-xs font-semibold tracking-wide text-[#696969] uppercase"
            >
              Secret
            </label>
            <Input
              id="token-value"
              type="password"
              autoComplete="off"
              value={tokenValue}
              onChange={(event) => setTokenValue(event.target.value)}
              placeholder={
                tokenProvider === "GITHUB"
                  ? "github_pat_… or ghp_… (with Issues, PRs, Contents write)"
                  : "Paste token — never stored in plaintext"
              }
              className="border-[#d1cdc7] bg-[#f3f0ee] font-mono text-sm"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={addToken.isPending}
              className="bg-[#141413] text-[#f3f0ee] hover:bg-[#2a2928]"
            >
              {addToken.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Encrypting…
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  Add token
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="overflow-hidden rounded-2xl border border-[#d1cdc7] bg-white">
          {tokensLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !tokens?.length ? (
            <p className="p-4 text-sm text-[#696969]">
              No tokens yet. Add a GitHub personal access token (provider:
              GitHub) so write actions — issues, PR reviews, draft releases —
              work reliably. See the guide above when GitHub is selected.
            </p>
          ) : (
            <ul className="divide-y divide-[#e6e2dc]">
              {tokens.map((token) => (
                <li
                  key={token.id}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#141413]">
                      {token.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[#696969]">
                      {providerLabel(token.provider)} · ••••{token.lastFour} ·{" "}
                      {new Date(token.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={deleteToken.isPending}
                    onClick={() =>
                      deleteToken.mutate({ tokenId: token.id })
                    }
                    className="text-[#696969] hover:bg-[#f3f0ee] hover:text-[#cf4500]"
                    aria-label={`Delete ${token.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {project ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-[#cf4500]" />
            <h2 className="text-base font-semibold tracking-[-0.02em] text-[#141413]">
              Danger zone
            </h2>
          </div>
          <p className="text-sm text-[#696969]">
            Irreversible actions for{" "}
            <span className="font-medium text-[#141413]">{project.name}</span>.
            Switch projects from the Projects page to manage a different workspace.
          </p>

          <div className="rounded-2xl border border-[#cf4500]/35 bg-[#cf4500]/5 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#141413]">
                  Delete this project
                </p>
                <p className="mt-0.5 text-sm text-[#696969]">
                  Soft-deletes the project and hides its meetings, commits, and
                  Q&amp;A from your workspace. Only owners can delete.
                </p>
              </div>
              {isOwner ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deleteProject.isPending}
                  onClick={() => setDeleteOpen(true)}
                  className="shrink-0 border-[#cf4500] text-[#cf4500] hover:bg-[#cf4500]/10 hover:text-[#cf4500]"
                >
                  <Trash2 className="size-4" />
                  Delete project
                </Button>
              ) : (
                <p className="shrink-0 text-sm text-[#696969]">
                  Ask an owner to delete this project.
                </p>
              )}
            </div>
          </div>

          <DeleteProjectDialog
            open={deleteOpen}
            projectName={project.name}
            isPending={deleteProject.isPending}
            onOpenChange={(nextOpen) => {
              if (!deleteProject.isPending) {
                setDeleteOpen(nextOpen);
              }
            }}
            onConfirm={() => {
              deleteProject.mutate({ projectId: project.id });
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
