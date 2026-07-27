import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { pullCommits } from "@/lib/github";
import { indexGithubRepo } from "@/lib/github-loader";

export const projectRouter = createTRPCRouter({
  createProject: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        githubUrl: z.string(),
        githubToken: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.project.create({
        data: {
          githubUrl: input.githubUrl,
          name: input.name,
          userToProjects: {
            create: {
              userId: ctx.user.userId!,
            },
          },
        },
      });

      // Run AI work in the background so create succeeds even if Gemini quota is hit
      void indexGithubRepo(project.id, input.githubUrl, input.githubToken).catch(
        (error) => console.error("Background repo indexing failed:", error),
      );
      void pullCommits(project.id).catch((error) =>
        console.error("Background commit pull failed:", error),
      );

      return project;
    }),

  /** Wipe + re-index source embeddings for an existing project. */
  reindexProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        githubToken: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.project.findFirst({
        where: {
          id: input.projectId,
          deletedAt: null,
          userToProjects: {
            some: { userId: ctx.user.userId! },
          },
        },
      });
      if (!project) {
        throw new Error("Project not found");
      }

      void indexGithubRepo(
        project.id,
        project.githubUrl,
        input.githubToken,
      ).catch((error) =>
        console.error("Background repo re-indexing failed:", error),
      );

      return { ok: true as const };
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
    });
  }),

  deleteProject: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.project.findFirst({
        where: {
          id: input.projectId,
          deletedAt: null,
          userToProjects: {
            some: { userId: ctx.user.userId! },
          },
        },
      });

      if (!project) {
        throw new Error("Project not found");
      }

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
      await pullCommits(input.projectId).catch(console.error);
      return await ctx.db.commit.findMany({
        where: {
          projectId: input.projectId,
        },
        orderBy: {
          commitDate: "desc",
        },
      });
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
      const project = await ctx.db.project.findFirst({
        where: {
          id: input.projectId,
          deletedAt: null,
          userToProjects: {
            some: { userId: ctx.user.userId! },
          },
        },
      });
      if (!project) {
        throw new Error("Project not found");
      }

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

    getQuestions: protectedProcedure.input(z.object({projectId : z.string()})).query(async ({ctx, input}) => {
      return await ctx.db.question.findMany({
        where: {
          projectId: input.projectId
        },
        include: {
          user: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    }),

    uploadMeeting : protectedProcedure.input(z.object({projectId : z.string(), meetingUrl : z.string(), name :z.string()})).mutation(async ({ctx, input}) => {
      const meeting = await ctx.db.meeting.create({
        data: {
          meetingUrl: input.meetingUrl,
          projectId: input.projectId,
          name: input.name,
          status: "PROCESSING",
        }
      })
      return meeting;
    }),

    getMeetings: protectedProcedure.input(z.object({projectId : z.string()})).query(async ({ctx, input}) => {
      return await ctx.db.meeting.findMany({
        where: {
          projectId: input.projectId,
        },
        include: {issues: true}
      })
    }),

    getMeetingById: protectedProcedure
      .input(z.object({ meetingId: z.string() }))
      .query(async ({ ctx, input }) => {
        const meeting = await ctx.db.meeting.findFirst({
          where: {
            id: input.meetingId,
            project: {
              userToProjects: {
                some: { userId: ctx.user.userId! },
              },
            },
          },
          include: {
            issues: {
              orderBy: { start: "asc" },
            },
          },
        });

        if (!meeting) {
          throw new Error("Meeting not found");
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
              userToProjects: {
                some: { userId: ctx.user.userId! },
              },
            },
          },
        });

        if (!meeting) {
          throw new Error("Meeting not found");
        }

        await ctx.db.issue.deleteMany({
          where: { meetingId: input.meetingId },
        });
        return await ctx.db.meeting.delete({
          where: { id: input.meetingId },
        });
      }),
});