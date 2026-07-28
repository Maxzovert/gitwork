"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import useProjects from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { GitworkLogo } from "@/components/gitwork-logo";
import { Skeleton } from "@/components/ui/skeleton";

function inviterName(user: {
  firstName: string | null;
  lastName: string | null;
  emailAdress: string;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.emailAdress;
}

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const { setProjectId } = useProjects();
  const utils = api.useUtils();

  const preview = api.project.getInvitePreview.useQuery(
    { token },
    { enabled: Boolean(token), retry: false },
  );

  const accept = api.project.acceptInvite.useMutation({
    onSuccess: async (result) => {
      await utils.project.getProjects.invalidate();
      setProjectId(result.projectId);
      toast.success(
        result.alreadyMember
          ? "You are already a member"
          : "Joined the project",
      );
      router.push("/dashboard");
    },
    onError: (err) => toast.error(err.message || "Failed to join"),
  });

  useEffect(() => {
    if (preview.data?.alreadyMember) {
      setProjectId(preview.data.project.id);
    }
  }, [preview.data, setProjectId]);

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-[#f3f0ee] px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(207,69,0,0.08), transparent 40%), radial-gradient(circle at 80% 0%, rgba(20,20,19,0.06), transparent 35%)",
        }}
      />

      <div className="relative w-full max-w-md space-y-6 rounded-2xl border border-[#d1cdc7] bg-[#fcfbfa] p-8 shadow-sm">
        <GitworkLogo size={36} withWordmark />

        {preview.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-11 w-full rounded-[20px]" />
          </div>
        ) : preview.error ? (
          <div className="space-y-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#141413] text-[#f3f0ee]">
              <Users className="size-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl tracking-[-0.02em] text-[#141413]">
                Invite unavailable
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#696969]">
                {preview.error.message ||
                  "This invite link is invalid or has expired."}
              </p>
            </div>
            <Button
              type="button"
              className="h-11 w-full rounded-[20px]"
              onClick={() => router.push("/dashboard")}
            >
              Go to dashboard
            </Button>
          </div>
        ) : preview.data ? (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-[#696969] uppercase">
                Project invite
              </p>
              <h1 className="font-display mt-2 text-2xl tracking-[-0.02em] text-[#141413]">
                {preview.data.project.name}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#696969]">
                {inviterName(preview.data.createdBy)} invited you to join as a{" "}
                {preview.data.role === "OWNER" ? "owner" : "member"}. You will
                share Q&A answers and meeting history with the team.
              </p>
            </div>

            {preview.data.alreadyMember ? (
              <Button
                type="button"
                className="h-11 w-full rounded-[20px]"
                onClick={() => {
                  setProjectId(preview.data.project.id);
                  router.push("/dashboard");
                }}
              >
                Open project
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11 w-full rounded-[20px]"
                disabled={accept.isPending}
                onClick={() => accept.mutate({ token })}
              >
                {accept.isPending ? "Joining…" : "Accept invite"}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
