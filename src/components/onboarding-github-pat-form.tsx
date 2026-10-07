"use client";

import React from "react";
import { ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const CLASSIC_URL = "https://github.com/settings/tokens/new?scopes=repo";
const FINE_GRAINED_URL =
  "https://github.com/settings/personal-access-tokens/new";

type OnboardingGithubPatFormProps = {
  className?: string;
  /** Called after a token is saved and status has been refreshed. */
  onSaved?: () => void;
};

export function OnboardingGithubPatForm({
  className,
  onSaved,
}: OnboardingGithubPatFormProps) {
  const utils = api.useUtils();
  const [tokenValue, setTokenValue] = React.useState("");
  const [open, setOpen] = React.useState(true);

  const addToken = api.settings.addToken.useMutation({
    onSuccess: async () => {
      setTokenValue("");
      toast.success("GitHub token saved");
      await Promise.all([
        utils.project.getGithubStatus.invalidate(),
        utils.project.listGithubRepos.invalidate(),
        utils.settings.listTokens.invalidate(),
      ]);
      onSaved?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save token");
    },
  });

  function saveToken() {
    const token = tokenValue.trim();
    if (token.length < 8) {
      toast.error("Paste a valid GitHub personal access token.");
      return;
    }
    addToken.mutate({
      name: "Onboarding GitHub PAT",
      provider: "GITHUB",
      token,
    });
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-[#d1cdc7] bg-[#fcfbfa] p-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#141413] text-[#f3f0ee]">
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-[#141413]">
              Add a GitHub token
            </p>
            <button
              type="button"
              className="text-xs font-medium text-[#3860be] underline-offset-2 hover:underline"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Hide" : "Show"}
            </button>
          </div>
          <p className="mt-1 text-sm leading-6 text-[#696969]">
            Paste a Personal Access Token with{" "}
            <code className="text-[#141413]">repo</code> access. It is encrypted
            and stored for your account — no need to open Settings.
          </p>
        </div>
      </div>

      {open ? (
        <div className="space-y-3">
          <p className="text-xs leading-5 text-[#696969]">
            Create a{" "}
            <a
              href={CLASSIC_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[#3860be] underline-offset-2 hover:underline"
            >
              classic PAT with repo scope
              <ExternalLink className="size-3" />
            </a>{" "}
            or a{" "}
            <a
              href={FINE_GRAINED_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[#3860be] underline-offset-2 hover:underline"
            >
              fine-grained token
              <ExternalLink className="size-3" />
            </a>
            .
          </p>

          <div className="space-y-2">
            <label
              htmlFor="onboarding-github-pat"
              className="text-xs font-medium text-[#696969]"
            >
              Personal access token
            </label>
            <Input
              id="onboarding-github-pat"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={tokenValue}
              onChange={(event) => setTokenValue(event.target.value)}
              placeholder="ghp_… or github_pat_…"
              className="h-11 rounded-xl border-[#d1cdc7] bg-white font-mono text-sm text-[#141413] placeholder:text-[#696969]"
            />
          </div>

          <Button
            type="button"
            className="h-10 rounded-xl"
            disabled={addToken.isPending || tokenValue.trim().length < 8}
            onClick={saveToken}
          >
            {addToken.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save token & continue"
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
