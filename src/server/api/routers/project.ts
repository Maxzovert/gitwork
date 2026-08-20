import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { pullCommits } from "@/lib/github";
import {
  getGithubConnectionStatus,
  listUserGithubRepos,
  requireUserGithubToken,
  resolveProjectGithubToken,
} from "@/lib/github-auth";
import {
  getLatestIndexingJob,
  listGithubBranches,
  startIndexingJob,
} from "@/lib/github-loader";
import { buildPullRequestDigest } from "@/lib/github-prs";
import { generateProjectOverview } from "@/lib/gemini";
import {
  allowedFilenames,
  buildFolderSketch,
  collectCitedFilenames,
  fetchRepoDocs,
  isUsefulDoc,
  resolveOverviewFileReferences,
  type ProjectOverviewJson,
} from "@/lib/github-overview";
import { parseGithubUrl } from "@/lib/github-url";
import {
  deleteProjectWebhook,
  ensureProjectWebhook,
  registerProjectWebhook,
} from "@/lib/github-webhook";
import {
  countOwners,
  isActiveInvite,
  requireProjectMember,
  requireProjectOwner,
} from "../project-access";

function createInviteToken() {
  return randomBytes(24).toString("base64url");
}

export const projectRouter = createTRPCRouter({
  getGithubStatus: protectedProcedure.query(async ({ ctx }) => {
    return await getGithubConnectionStatus(ctx.user.userId!);
  }),

  listGithubRepos: protectedProcedure.query(async ({ ctx }) => {
    const token = await requireUserGithubToken(ctx.user.userId!);
    return await listUserGithubRepos(token);
  }),

  createProject: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        githubUrl: z.string(),
        branch: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const githubToken = await requireUserGithubToken(ctx.user.userId!);

      const project = await ctx.db.project.create({
        data: {
          githubUrl: input.githubUrl,
          name: input.name,
          activeBranch: input.branch,
          defaultBranch: input.branch,
          userToProjects: {
            create: {
              userId: ctx.user.userId!,
              role: "OWNER",
            },
          },
        },
      });

      // Run AI work in the background so create succeeds even if Gemini quota is hit
      void startIndexingJob({
        projectId: project.id,
        githubUrl: input.githubUrl,
        branch: input.branch,
        githubToken,
        triggeredByUserId: ctx.user.userId!,
      }).catch((error) =>
        console.error("Background repo indexing failed:", error),
      );
      void pullCommits(project.id, githubToken).catch((error) =>
        console.error("Background commit pull failed:", error),
      );
      void registerProjectWebhook(project.id, githubToken).catch(
        (error) => console.error("Background webhook registration failed:", error),
      );

      return project;
    }),

  /** Wipe + re-index source embeddings for an existing project. */
  reindexProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        branch: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { project } = await requireProjectOwner(
        ctx.db,
        input.projectId,
        ctx.user.userId!,
      );
      const githubToken = await requireUserGithubToken(ctx.user.userId!);

      return await startIndexingJob({
        projectId: project.id,
        githubUrl: project.githubUrl,
        branch: input.branch ?? project.activeBranch ?? project.defaultBranch ?? undefined,
        githubToken,
        triggeredByUserId: ctx.user.userId!,
      }).catch((error) => {
        console.error("Background repo re-indexing failed:", error);
        throw error;
      });
    }),

  getProjects: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.project.findMany({
      where: {
        userToProjects: {
          some: {
            userId: ctx.user.userId!,
          },
        },
        deletedAt: null,
      },
      omit: {
        overview: true,
        webhookSecret: true,
      },
    });
  }),

  getBranches: protectedProcedure
    .input(
      z.object({
        githubUrl: z.string().url(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const githubToken = await requireUserGithubToken(ctx.user.userId!);
      return await listGithubBranches(input.githubUrl, githubToken);
    }),

  getMyMembership: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const membership = await ctx.db.userToProject.findFirst({
        where: {
          projectId: input.projectId,
          userId: ctx.user.userId!,
          project: { deletedAt: null },
        },
      });
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this project",
        });
      }
      return membership;
    }),

  getIndexingStatus: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireProjectMember(ctx.db, input.projectId, ctx.user.userId!);

      const [project, job] = await Promise.all([
        ctx.db.project.findUnique({
          where: { id: input.projectId },
          select: {
            id: true,
            activeBranch: true,
            defaultBranch: true,
            lastIndexedAt: true,
            lastIndexedCommitSha: true,
          },
        }),
        getLatestIndexingJob(input.projectId),
      ]);

      return {
        project,
        job,
      };
    }),

  getMembers: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireProjectMember(ctx.db, input.projectId, ctx.user.userId!);

      return await ctx.db.userToProject.findMany({
        where: { projectId: input.projectId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              emailAdress: true,
              imageUrl: true,
            },
          },
        },
        orderBy: [{ role: "desc" }, { createdAt: "asc" }],
      });
    }),

  updateActiveBranch: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        branch: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectOwner(ctx.db, input.projectId, ctx.user.userId!);

      return await ctx.db.project.update({
        where: { id: input.projectId },
        data: { activeBranch: input.branch },
      });
    }),

  getActiveInvite: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireProjectOwner(ctx.db, input.projectId, ctx.user.userId!);

      return await ctx.db.projectInvite.findFirst({
        where: {
          projectId: input.projectId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getOrCreateInvite: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectOwner(ctx.db, input.projectId, ctx.user.userId!);

      const existing = await ctx.db.projectInvite.findFirst({
        where: {
          projectId: input.projectId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        return existing;
      }

      return await ctx.db.projectInvite.create({
        data: {
          token: createInviteToken(),
          projectId: input.projectId,
          createdByUserId: ctx.user.userId!,
          role: "MEMBER",
        },
      });
    }),

  regenerateInvite: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectOwner(ctx.db, input.projectId, ctx.user.userId!);

      await ctx.db.projectInvite.updateMany({
        where: {
          projectId: input.projectId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      return await ctx.db.projectInvite.create({
        data: {
          token: createInviteToken(),
          projectId: input.projectId,
          createdByUserId: ctx.user.userId!,
          role: "MEMBER",
        },
      });
    }),

  revokeInvite: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectOwner(ctx.db, input.projectId, ctx.user.userId!);

      await ctx.db.projectInvite.updateMany({
        where: {
          projectId: input.projectId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      return { ok: true as const };
    }),

  getInvitePreview: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const invite = await ctx.db.projectInvite.findUnique({
        where: { token: input.token },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              githubUrl: true,
              deletedAt: true,
            },
          },
          createdBy: {
            select: {
              firstName: true,
              lastName: true,
              imageUrl: true,
              emailAdress: true,
            },
          },
        },
      });

      if (!invite || invite.project.deletedAt || !isActiveInvite(invite)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This invite link is invalid or has expired",
        });
      }

      const existingMembership = await ctx.db.userToProject.findUnique({
        where: {
          userId_projectId: {
            userId: ctx.user.userId!,
            projectId: invite.projectId,
          },
        },
      });

      return {
        project: invite.project,
        role: invite.role,
        createdBy: invite.createdBy,
        alreadyMember: Boolean(existingMembership),
      };
    }),

  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.projectInvite.findUnique({
        where: { token: input.token },
        include: {
          project: true,
        },
      });

      if (!invite || invite.project.deletedAt || !isActiveInvite(invite)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This invite link is invalid or has expired",
        });
      }

      const existing = await ctx.db.userToProject.findUnique({
        where: {
          userId_projectId: {
            userId: ctx.user.userId!,
            projectId: invite.projectId,
          },
        },
      });

      if (existing) {
        return { projectId: invite.projectId, alreadyMember: true as const };
      }

      await ctx.db.userToProject.create({
        data: {
          userId: ctx.user.userId!,
          projectId: invite.projectId,
          role: invite.role,
        },
      });

      return { projectId: invite.projectId, alreadyMember: false as const };
    }),

  updateMemberRole: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        userId: z.string().min(1),
        role: z.enum(["OWNER", "MEMBER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectOwner(ctx.db, input.projectId, ctx.user.userId!);

      const target = await ctx.db.userToProject.findUnique({
        where: {
          userId_projectId: {
            userId: input.userId,
            projectId: input.projectId,
          },
        },
      });

      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      if (target.role === "OWNER" && input.role === "MEMBER") {
        const owners = await countOwners(ctx.db, input.projectId);
        if (owners <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Projects must keep at least one owner",
          });
        }
      }

      return await ctx.db.userToProject.update({
        where: { id: target.id },
        data: { role: input.role },
      });
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectOwner(ctx.db, input.projectId, ctx.user.userId!);

      if (input.userId === ctx.user.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use leave project to remove yourself",
        });
      }

      const target = await ctx.db.userToProject.findUnique({
        where: {
          userId_projectId: {
            userId: input.userId,
            projectId: input.projectId,
          },
        },
      });

      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      if (target.role === "OWNER") {
        const owners = await countOwners(ctx.db, input.projectId);
        if (owners <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Projects must keep at least one owner",
          });
        }
      }

      await ctx.db.userToProject.delete({ where: { id: target.id } });
      return { ok: true as const };
    }),

  leaveProject: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const membership = await requireProjectMember(
        ctx.db,
        input.projectId,
        ctx.user.userId!,
      );

      if (membership.role === "OWNER") {
        const owners = await countOwners(ctx.db, input.projectId);
        if (owners <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "You are the only owner. Promote another member or delete the project.",
          });
        }
      }

      await ctx.db.userToProject.delete({ where: { id: membership.id } });
      return { ok: true as const };
    }),

  deleteProject: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectOwner(ctx.db, input.projectId, ctx.user.userId!);

      void deleteProjectWebhook(input.projectId).catch((error) =>
        console.error("Background webhook deletion failed:", error),
      );

      return await ctx.db.project.update({
        where: { id: input.projectId },
        data: { deletedAt: new Date() },
      });
    }),

  getCommits: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectMember(ctx.db, input.projectId, ctx.user.userId!);

      void ensureProjectWebhook(input.projectId).catch((error) =>
        console.error("Background webhook setup failed:", error),
      );

      return await ctx.db.commit.findMany({
        where: {
          projectId: input.projectId,
        },
        orderBy: {
          commitDate: "desc",
        },
        take: 50,
      });
    }),

  getPullRequestDigest: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const membership = await requireProjectMember(
        ctx.db,
        input.projectId,
        ctx.user.userId!,
      );
      const githubToken = await resolveProjectGithubToken(input.projectId);

      return await buildPullRequestDigest(
        input.projectId,
        membership.project.githubUrl,
        githubToken,
      );
    }),

  getOverview: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const membership = await requireProjectMember(
        ctx.db,
        input.projectId,
        ctx.user.userId!,
      );
      const project = membership.project;

      return {
        overview: (project.overview as (ProjectOverviewJson & {
          fileReferences?: Array<{
            filename: string;
            sourceCode: string;
            summary: string;
          }>;
        }) | null) ?? null,
        overviewGeneratedAt: project.overviewGeneratedAt,
        overviewCommitSha: project.overviewCommitSha,
        lastIndexedCommitSha: project.lastIndexedCommitSha,
        lastIndexedAt: project.lastIndexedAt,
        stale: Boolean(
          project.overview &&
            project.lastIndexedCommitSha &&
            project.overviewCommitSha &&
            project.overviewCommitSha !== project.lastIndexedCommitSha,
        ),
      };
    }),

  generateOverview: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const membership = await requireProjectMember(
        ctx.db,
        input.projectId,
        ctx.user.userId!,
      );
      const project = membership.project;
      const branch =
        project.activeBranch ?? project.defaultBranch ?? "HEAD";

      const githubToken = await resolveProjectGithubToken(input.projectId);
      const sketch = await buildFolderSketch(
        project.id,
        branch === "HEAD" ? undefined : branch,
      );
      const docs = await fetchRepoDocs(project.githubUrl, branch, githubToken);

      if (!sketch.files.length && !isUsefulDoc(docs.readme)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Index the repository first, or add a README.md so Gitwork has something to explain.",
        });
      }

      const recentCommits = await ctx.db.commit.findMany({
        where: { projectId: project.id },
        orderBy: { commitDate: "desc" },
        take: 8,
        select: { commitMessage: true },
      });

      const allowed = allowedFilenames({
        readme: docs.readme,
        contributing: docs.contributing,
        setupFile: docs.setupFile,
        sketchFiles: sketch.files,
      });

      const { cleaned } = parseGithubUrl(project.githubUrl);
      const generated = await generateProjectOverview({
        repo: cleaned,
        hasReadme: isUsefulDoc(docs.readme),
        hasContributing: isUsefulDoc(docs.contributing),
        readme: docs.readme ?? undefined,
        contributing: docs.contributing ?? undefined,
        setupFile: docs.setupFile ?? undefined,
        folders: sketch.folders.map((folder) => ({
          name: folder.name,
          files: folder.files.map((file) => ({
            filename: file.filename,
            summary: file.summary,
          })),
        })),
        recentCommits: recentCommits.map((commit) => commit.commitMessage.split("\n")[0] ?? ""),
        allowedFiles: [...allowed],
      });

      const fileReferences = resolveOverviewFileReferences(
        collectCitedFilenames(generated),
        allowed,
        [docs.readme, docs.contributing, docs.setupFile].filter(
          (doc): doc is NonNullable<typeof doc> => Boolean(doc),
        ),
        sketch.files,
      );

      const overview = { ...generated, fileReferences };

      await ctx.db.project.update({
        where: { id: project.id },
        data: {
          overview,
          overviewGeneratedAt: new Date(),
          overviewCommitSha: project.lastIndexedCommitSha,
        },
      });

      return {
        overview,
        overviewGeneratedAt: new Date(),
        overviewCommitSha: project.lastIndexedCommitSha,
        lastIndexedCommitSha: project.lastIndexedCommitSha,
        stale: false,
      };
    }),

  syncCommits: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectMember(ctx.db, input.projectId, ctx.user.userId!);
      const githubToken = await requireUserGithubToken(ctx.user.userId!);
      return await pullCommits(input.projectId, githubToken);
    }),

  startIndexing: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        branch: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { project } = await requireProjectOwner(
        ctx.db,
        input.projectId,
        ctx.user.userId!,
      );
      const githubToken = await requireUserGithubToken(ctx.user.userId!);

      return await startIndexingJob({
        projectId: project.id,
        githubUrl: project.githubUrl,
        branch: input.branch ?? project.activeBranch ?? project.defaultBranch ?? undefined,
        githubToken,
        triggeredByUserId: ctx.user.userId!,
      });
    }),

  setupCommitWebhook: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectOwner(ctx.db, input.projectId, ctx.user.userId!);
      const githubToken = await requireUserGithubToken(ctx.user.userId!);
      return await registerProjectWebhook(input.projectId, githubToken);
    }),

  saveAnswer: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        question: z.string(),
        fileReference: z.any(),
        answer: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectMember(ctx.db, input.projectId, ctx.user.userId!);

      return await ctx.db.question.create({
        data: {
          question: input.question,
          answer: input.answer,
          fileReference: input.fileReference,
          projectId: input.projectId,
          userId: ctx.user.userId!,
        },
      });
    }),

  getQuestions: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireProjectMember(ctx.db, input.projectId, ctx.user.userId!);

      return await ctx.db.question.findMany({
        where: {
          projectId: input.projectId,
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }),

  uploadMeeting: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        meetingUrl: z.string(),
        name: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectMember(ctx.db, input.projectId, ctx.user.userId!);

      const meeting = await ctx.db.meeting.create({
        data: {
          meetingUrl: input.meetingUrl,
          projectId: input.projectId,
          name: input.name,
          status: "PROCESSING",
          createdByUserId: ctx.user.userId!,
        },
      });
      return meeting;
    }),

  getMeetings: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireProjectMember(ctx.db, input.projectId, ctx.user.userId!);

      return await ctx.db.meeting.findMany({
        where: {
          projectId: input.projectId,
        },
        include: {
          issues: true,
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              imageUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getMeetingById: protectedProcedure
    .input(z.object({ meetingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const meeting = await ctx.db.meeting.findFirst({
        where: {
          id: input.meetingId,
          project: {
            deletedAt: null,
            userToProjects: {
              some: { userId: ctx.user.userId! },
            },
          },
        },
        include: {
          issues: {
            orderBy: { start: "asc" },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              imageUrl: true,
            },
          },
        },
      });

      if (!meeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }

      return meeting;
    }),

  deleteMeeting: protectedProcedure
    .input(z.object({ meetingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.meeting.findFirst({
        where: {
          id: input.meetingId,
          project: {
            deletedAt: null,
            userToProjects: {
              some: { userId: ctx.user.userId! },
            },
          },
        },
        include: {
          project: {
            include: {
              userToProjects: {
                where: { userId: ctx.user.userId! },
              },
            },
          },
        },
      });

      if (!meeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }

      const membership = meeting.project.userToProjects[0];
      const canDelete =
        membership?.role === "OWNER" ||
        meeting.createdByUserId === ctx.user.userId!;

      if (!canDelete) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the uploader or an owner can delete this meeting",
        });
      }

      await ctx.db.issue.deleteMany({
        where: { meetingId: input.meetingId },
      });
      return await ctx.db.meeting.delete({
        where: { id: input.meetingId },
      });
    }),
});
