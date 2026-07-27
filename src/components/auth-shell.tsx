import Link from "next/link";

import { GitworkLogo } from "@/components/gitwork-logo";

type Props = {
  children: React.ReactNode;
};

export function AuthShell({ children }: Props) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#f3f0ee] px-4 py-12">
      <div className="relative z-10 mb-10 flex flex-col items-center gap-3">
        <Link href="/">
          <GitworkLogo size={36} withWordmark />
        </Link>
        <p className="text-sm font-[450] text-[#696969]">
          Sign in to your workspace
        </p>
      </div>
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
