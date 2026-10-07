"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  children?: React.ReactNode;
};

/**
 * Clears GitHub app session then Auth0 session.
 * Auth0 Allowed Logout URLs must include the app origin.
 */
function logoutHref() {
  return "/api/auth/logout";
}

export function SignOutButton({
  className,
  children = "Sign out",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(className)}
      >
        {children}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm border-[#d1cdc7] bg-[#fcfbfa] sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-[-0.02em] text-[#141413]">
              Sign out?
            </DialogTitle>
            <DialogDescription className="text-[#696969]">
              You&apos;ll need to sign in again to open your Gitwork workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-[#d1cdc7] bg-white text-[#141413] hover:bg-[#2a2928]/5 hover:text-[#141413]"
            >
              Stay signed in
            </Button>
            <Button
              type="button"
              asChild
              className="bg-[#141413] text-[#f3f0ee] hover:bg-[#2a2928]"
            >
              <a href={logoutHref()}>Yes, sign out</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
