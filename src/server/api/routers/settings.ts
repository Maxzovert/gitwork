import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  decryptSecret,
  encryptSecret,
  tokenLastFour,
} from "@/lib/token-crypto";

const notificationSchema = z.object({
  emailNotifications: z.boolean(),
  productUpdates: z.boolean(),
  commitDigest: z.boolean(),
  meetingAlerts: z.boolean(),
  indexingAlerts: z.boolean(),
});

const tokenProviderSchema = z.enum([
  "GITHUB",
  "GEMINI",
  "ASSEMBLYAI",
  "CUSTOM",
]);

const defaultSettings = {
  emailNotifications: true,
  productUpdates: false,
  commitDigest: true,
  meetingAlerts: true,
  indexingAlerts: true,
};

export const settingsRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.userId!;
    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailAdress: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        githubUserId: true,
      },
    });
    if (!user) return null;
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
    return {
      id: user.id,
      email: user.emailAdress,
      name,
      picture: user.imageUrl,
      githubUserId: user.githubUserId,
    };
  }),

  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.userId!;
    const existing = await ctx.db.userSettings.findUnique({
      where: { userId },
    });
    if (existing) {
      return {
        emailNotifications: existing.emailNotifications,
        productUpdates: existing.productUpdates,
        commitDigest: existing.commitDigest,
        meetingAlerts: existing.meetingAlerts,
        indexingAlerts: existing.indexingAlerts,
      };
    }
    return defaultSettings;
  }),

  updateSettings: protectedProcedure
    .input(notificationSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.userId!;
      return await ctx.db.userSettings.upsert({
        where: { userId },
        create: { userId, ...input },
        update: input,
      });
    }),

  listTokens: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.userApiToken.findMany({
      where: { userId: ctx.user.userId! },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        provider: true,
        lastFour: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }),

  addToken: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(80),
        provider: tokenProviderSchema,
        token: z.string().trim().min(8).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.userId!;
      let encrypted;
      try {
        encrypted = encryptSecret(input.token);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to encrypt token. Check TOKEN_ENCRYPTION_KEY.",
        });
      }

      return await ctx.db.userApiToken.create({
        data: {
          userId,
          name: input.name,
          provider: input.provider,
          lastFour: tokenLastFour(input.token),
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
        },
        select: {
          id: true,
          name: true,
          provider: true,
          lastFour: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }),

  deleteToken: protectedProcedure
    .input(z.object({ tokenId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.userId!;
      const existing = await ctx.db.userApiToken.findFirst({
        where: { id: input.tokenId, userId },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Token not found",
        });
      }
      await ctx.db.userApiToken.delete({ where: { id: existing.id } });
      return { ok: true as const };
    }),
});

/** Decrypt the newest GitHub PAT stored for a user (server-side only). */
export async function getStoredGithubPat(
  db: PrismaClient,
  userId: string,
) {
  const row = await db.userApiToken.findFirst({
    where: { userId, provider: "GITHUB" },
    orderBy: { updatedAt: "desc" },
    select: { ciphertext: true, iv: true, authTag: true },
  });
  if (!row) return null;
  try {
    return decryptSecret({
      ciphertext: row.ciphertext,
      iv: row.iv,
      authTag: row.authTag,
    });
  } catch {
    return null;
  }
}
