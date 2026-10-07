import Link from "next/link";
import { ExternalLink, KeyRound } from "lucide-react";

import { cn } from "@/lib/utils";

const FINE_GRAINED_URL =
  "https://github.com/settings/personal-access-tokens/new";
const CLASSIC_URL = "https://github.com/settings/tokens/new?scopes=repo";
const DOCS_URL =
  "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens";

type GithubTokenGuideProps = {
  className?: string;
  /** Compact for onboarding; full for Settings. */
  variant?: "full" | "compact";
  /** Show a link to in-app Settings (onboarding). */
  showSettingsLink?: boolean;
};

export function GithubTokenGuide({
  className,
  variant = "full",
  showSettingsLink = false,
}: GithubTokenGuideProps) {
  const compact = variant === "compact";

  return (
    <div
      className={cn(
        "rounded-xl border border-[#d1cdc7] bg-[#fcfbfa]",
        compact ? "p-4" : "p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#141413] text-[#f3f0ee]">
          <KeyRound className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-semibold tracking-[-0.02em] text-[#141413]">
              GitHub token permissions
            </p>
            <p className="mt-1 text-sm leading-6 text-[#696969]">
              {compact
                ? "OAuth is enough to read repos. For creating issues, posting PR reviews, and draft releases, add a Personal Access Token in Settings with write access."
                : "A GitHub Personal Access Token (PAT) in Settings is preferred over Auth0 GitHub OAuth and the server env token. Use it for write actions: meeting → issues, PR digest comments, and draft releases."}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.08em] text-[#696969] uppercase">
              Fine-grained PAT (recommended)
            </p>
            <ol className="list-decimal space-y-1.5 pl-4 text-sm leading-6 text-[#696969]">
              <li>
                Open{" "}
                <a
                  href={FINE_GRAINED_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[#3860be] underline-offset-2 hover:underline"
                >
                  GitHub → Fine-grained tokens
                  <ExternalLink className="size-3" />
                </a>
              </li>
              <li>Repository access: select the repos you use in Gitwork</li>
              <li>
                Repository permissions — set{" "}
                <span className="font-medium text-[#141413]">
                  Pull requests
                </span>
                ,{" "}
                <span className="font-medium text-[#141413]">Issues</span>, and{" "}
                <span className="font-medium text-[#141413]">Contents</span> to{" "}
                <span className="font-medium text-[#141413]">Read and write</span>
              </li>
              <li>
                Generate, copy the token, then paste it here with provider{" "}
                <span className="font-medium text-[#141413]">GitHub</span>
              </li>
            </ol>
          </div>

          {!compact ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.08em] text-[#696969] uppercase">
                Classic PAT (alternative)
              </p>
              <p className="text-sm leading-6 text-[#696969]">
                Create a{" "}
                <a
                  href={CLASSIC_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[#3860be] underline-offset-2 hover:underline"
                >
                  classic token with the <code className="text-[#141413]">repo</code>{" "}
                  scope
                  <ExternalLink className="size-3" />
                </a>
                . Your GitHub user must have write access to the linked repository.
              </p>
            </div>
          ) : null}

          <p className="text-xs leading-5 text-[#696969]">
            Without these permissions GitHub returns errors like{" "}
            <span className="font-medium text-[#141413]">
              Resource not accessible by personal access token
            </span>{" "}
            or{" "}
            <span className="font-medium text-[#141413]">Not Found</span> on write
            actions.{" "}
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#3860be] underline-offset-2 hover:underline"
            >
              GitHub PAT docs
            </a>
            {showSettingsLink ? (
              <>
                {" · "}
                <Link
                  href="/settings"
                  className="font-medium text-[#3860be] underline-offset-2 hover:underline"
                >
                  Open Settings
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}
