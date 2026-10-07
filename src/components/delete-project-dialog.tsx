"use client";

import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type DeleteProjectDialogProps = {
  open: boolean;
  projectName: string;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function DeleteProjectDialog({
  open,
  projectName,
  isPending = false,
  onOpenChange,
  onConfirm,
}: DeleteProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={!isPending}
        className="gap-0 overflow-hidden rounded-2xl border-[#d1cdc7] bg-[#fcfbfa] p-0 sm:max-w-md"
      >
        <DialogHeader className="border-b border-[#d1cdc7] bg-[#f8f5f2] px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#cf4500]/10 text-[#cf4500]">
              <Trash2 className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="font-display text-xl tracking-[-0.02em] text-[#141413]">
                Delete project?
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-sm leading-relaxed text-[#696969]">
                <span className="font-medium text-[#141413]">
                  {projectName}
                </span>{" "}
                and its meetings will be removed from your workspace. This
                cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="gap-2 px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
            className="border-[#d1cdc7] text-[#141413] hover:bg-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={onConfirm}
            className="border-[#cf4500] bg-[#cf4500] text-white hover:bg-[#b33c00]"
          >
            {isPending ? "Deleting…" : "Delete project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
