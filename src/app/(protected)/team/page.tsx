"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Check,
  Copy,
  Link2,
  RefreshCw,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import useProjects from "@/hooks/use-projects";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function displayName(user: {
  firstName: string | null;
  lastName: string | null;
  emailAdress: string;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.emailAdress;
}

function RoleBadge({ role }: { role: "OWNER" | "MEMBER" }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        role === "OWNER"
          ? "bg-[#141413] text-[#f3f0ee]"
          : "bg-[#eceae6] text-[#696969]",
      )}
    >
      {role === "OWNER" ? "Owner" : "Member"}
    </span>
  );
}

function inviteLinkFromToken(token: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/invite/${token}`;
}

export default function TeamPage() {
  const { project, projectId, projects, setProjectId } = useProjects();
  const utils = api.useUtils();
  const [copied, setCopied] = useState(false);

  const { data: membership, isLoading: membershipLoading } =
    api.project.getMyMembership.useQuery(
      { projectId: projectId ?? "" },
      { enabled: Boolean(projectId) },
    );

  const { data: members, isLoading: membersLoading } =
    api.project.getMembers.useQuery(
      { projectId: projectId ?? "" },
      { enabled: Boolean(projectId) },
    );

  const isOwner = membership?.role === "OWNER";

  const { data: activeInvite, isLoading: inviteLoading } =
    api.project.getActiveInvite.useQuery(
      { projectId: projectId ?? "" },
      { enabled: Boolean(projectId) && isOwner },
    );

  const inviteUrl = useMemo(
    () => (activeInvite ? inviteLinkFromToken(activeInvite.token) : ""),
    [activeInvite],
  );

  const getOrCreateInvite = api.project.getOrCreateInvite.useMutation({
    onSuccess: () => {
      void utils.project.getActiveInvite.invalidate({
        projectId: projectId ?? "",
      });
      toast.success("Invite link ready");
    },
    onError: (err) => toast.error(err.message || "Failed to create invite"),
  });

  const regenerateInvite = api.project.regenerateInvite.useMutation({
    onSuccess: () => {
      void utils.project.getActiveInvite.invalidate({
        projectId: projectId ?? "",
      });
      toast.success("Invite link regenerated");
    },
    onError: (err) => toast.error(err.message || "Failed to regenerate"),
  });

  const revokeInvite = api.project.revokeInvite.useMutation({
    onSuccess: () => {
      void utils.project.getActiveInvite.invalidate({
        projectId: projectId ?? "",
      });
      toast.success("Invite link revoked");
    },
    onError: (err) => toast.error(err.message || "Failed to revoke"),
  });

  const updateRole = api.project.updateMemberRole.useMutation({
    onSuccess: () => {
      void utils.project.getMembers.invalidate({ projectId: projectId ?? "" });
      void utils.project.getMyMembership.invalidate({
        projectId: projectId ?? "",
      });
      toast.success("Role updated");
    },
    onError: (err) => toast.error(err.message || "Failed to update role"),
  });

  const removeMember = api.project.removeMember.useMutation({
    onSuccess: () => {
      void utils.project.getMembers.invalidate({ projectId: projectId ?? "" });
      toast.success("Member removed");
    },
    onError: (err) => toast.error(err.message || "Failed to remove member"),
  });

  const leaveProject = api.project.leaveProject.useMutation({
    onSuccess: () => {
      toast.success("Left project");
      const remaining = projects?.filter((p) => p.id !== projectId) ?? [];
      void utils.project.getProjects.invalidate();
      setProjectId(remaining[0]?.id ?? "");
    },
    onError: (err) => toast.error(err.message || "Failed to leave project"),
  });

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  }

  if (!projectId) {
    return (
      <EmptyState
        icon={Users}
        title="Select a project"
        description="Choose a project from the sidebar to manage its team."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Team"
        description={`Invite collaborators to ${project?.name ?? "this project"}. Everyone shares Q&A and meeting history.`}
      />

      {membershipLoading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : isOwner ? (
        <section className="space-y-4 rounded-xl border border-[#d1cdc7] bg-[#fcfbfa] p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#141413] text-[#f3f0ee]">
              <Link2 className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
                Invite link
              </h2>
              <p className="mt-1 text-sm text-[#696969]">
                Anyone with this link can join as a member and see shared Q&A and
                meetings.
              </p>
            </div>
          </div>

          {inviteLoading ? (
            <Skeleton className="h-11 w-full rounded-xl" />
          ) : inviteUrl ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={inviteUrl}
                className="h-11 rounded-xl border-[#d1cdc7] bg-white font-mono text-xs text-[#141413] sm:text-sm"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-11 flex-1 rounded-[20px] sm:flex-none"
                  onClick={() => void copyInvite()}
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 rounded-[20px]"
                  disabled={regenerateInvite.isPending}
                  onClick={() => {
                    if (
                      !confirm(
                        "Regenerate the invite link? The current link will stop working.",
                      )
                    ) {
                      return;
                    }
                    regenerateInvite.mutate({ projectId });
                  }}
                >
                  <RefreshCw className="size-4" />
                  Regenerate
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11 rounded-[20px] text-[#cf4500] hover:bg-[#cf4500]/10 hover:text-[#cf4500]"
                  disabled={revokeInvite.isPending}
                  onClick={() => {
                    if (!confirm("Revoke the invite link?")) return;
                    revokeInvite.mutate({ projectId });
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              className="h-11 rounded-[20px]"
              disabled={getOrCreateInvite.isPending}
              onClick={() => getOrCreateInvite.mutate({ projectId })}
            >
              <Link2 className="size-4" />
              {getOrCreateInvite.isPending
                ? "Creating…"
                : "Create invite link"}
            </Button>
          )}
        </section>
      ) : (
        <p className="rounded-xl border border-[#d1cdc7] bg-[#fcfbfa] px-5 py-4 text-sm text-[#696969]">
          You are a member of this project. Only owners can manage invite links
          and roles.
        </p>
      )}

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg tracking-[-0.02em] text-[#141413]">
            Members
          </h2>
          <span className="text-xs text-[#696969]">
            {members?.length ?? 0} total
          </span>
        </div>

        {membersLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-[#d1cdc7] overflow-hidden rounded-xl border border-[#d1cdc7] bg-white">
            {members?.map((member) => {
              const isSelf = member.userId === membership?.userId;
              return (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {member.user.imageUrl ? (
                      <Image
                        src={member.user.imageUrl}
                        alt=""
                        className="size-9 rounded-full"
                        width={36}
                        height={36}
                      />
                    ) : (
                      <div className="flex size-9 items-center justify-center rounded-full bg-[#eceae6] text-xs font-bold text-[#141413]">
                        {displayName(member.user)[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-[#141413]">
                          {displayName(member.user)}
                          {isSelf ? (
                            <span className="text-[#696969]"> (you)</span>
                          ) : null}
                        </p>
                        <RoleBadge role={member.role} />
                      </div>
                      <p className="truncate text-xs text-[#696969]">
                        {member.user.emailAdress}
                      </p>
                    </div>
                  </div>

                  {isOwner && !isSelf ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={updateRole.isPending}
                        onClick={() =>
                          updateRole.mutate({
                            projectId,
                            userId: member.userId,
                            role:
                              member.role === "OWNER" ? "MEMBER" : "OWNER",
                          })
                        }
                      >
                        Make {member.role === "OWNER" ? "member" : "owner"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-[#cf4500] hover:bg-[#cf4500]/10 hover:text-[#cf4500]"
                        disabled={removeMember.isPending}
                        onClick={() => {
                          if (
                            !confirm(
                              `Remove ${displayName(member.user)} from this project?`,
                            )
                          ) {
                            return;
                          }
                          removeMember.mutate({
                            projectId,
                            userId: member.userId,
                          });
                        }}
                      >
                        <UserMinus className="size-4" />
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="border-t border-[#d1cdc7] pt-6">
        <Button
          type="button"
          variant="outline"
          className="border-[#d1cdc7] text-[#cf4500] hover:bg-[#cf4500]/10 hover:text-[#cf4500]"
          disabled={leaveProject.isPending}
          onClick={() => {
            if (
              !confirm(
                `Leave "${project?.name}"? You will lose access to its Q&A and meetings until invited again.`,
              )
            ) {
              return;
            }
            leaveProject.mutate({ projectId });
          }}
        >
          Leave project
        </Button>
      </section>
    </div>
  );
}
