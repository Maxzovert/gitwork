import { cn } from "@/lib/utils";

type GitworkLogoProps = {
  className?: string;
  /** Show wordmark next to the mark */
  withWordmark?: boolean;
  /** Mark size in pixels (wordmark scales with it) */
  size?: number;
  /** Light wordmark for dark surfaces (mark stays ink) */
  inverted?: boolean;
};

/**
 * Gitwork mark: ink tile with a git-graph branch (cream + signal orange nodes).
 */
export function GitworkLogo({
  className,
  withWordmark = false,
  size = 32,
  inverted = false,
}: GitworkLogoProps) {
  const wordmark = inverted ? "#F3F0EE" : "#141413";

  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="Gitwork"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect width="40" height="40" rx="10" fill="#141413" />
        <path
          d="M14 10v12.5c0 2.485 2.015 4.5 4.5 4.5H26"
          stroke="#FCFBFA"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.92"
        />
        <path
          d="M14 18h8.5c2.485 0 4.5 2.015 4.5 4.5V30"
          stroke="#CF4500"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="14" cy="10" r="2.75" fill="#FCFBFA" />
        <circle cx="14" cy="18" r="2.75" fill="#CF4500" />
        <circle cx="26" cy="22.5" r="2.75" fill="#FCFBFA" />
        <circle cx="26" cy="30" r="2.75" fill="#CF4500" />
      </svg>
      {withWordmark ? (
        <span
          className="font-display tracking-[-0.02em]"
          style={{
            fontSize: Math.round(size * (size >= 48 ? 0.62 : 0.55)),
            color: wordmark,
            fontWeight: 500,
            lineHeight: 1,
          }}
        >
          Gitwork
        </span>
      ) : null}
    </span>
  );
}
