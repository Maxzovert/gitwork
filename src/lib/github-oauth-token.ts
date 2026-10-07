import type { PrismaClient } from "@prisma/client";

import { encryptSecret, tokenLastFour } from "@/lib/token-crypto";

const OAUTH_TOKEN_NAME = "GitHub OAuth";

/**
 * Persist a GitHub access token encrypted at rest (AES-256-GCM).
 * Never store or return plaintext. Newest GITHUB row wins for reads.
 */
export async function upsertEncryptedGithubToken(
  db: PrismaClient,
  userId: string,
  accessToken: string,
  name: string = OAUTH_TOKEN_NAME,
) {
  const token = accessToken.trim();
  if (token.length < 8) {
    throw new Error("Invalid GitHub access token");
  }

  const encrypted = encryptSecret(token);
  const lastFour = tokenLastFour(token);

  // Replace prior OAuth-named rows so we don't pile up dead tokens.
  await db.userApiToken.deleteMany({
    where: {
      userId,
      provider: "GITHUB",
      name: OAUTH_TOKEN_NAME,
    },
  });

  return await db.userApiToken.create({
    data: {
      userId,
      name,
      provider: "GITHUB",
      lastFour,
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
    },
  });
}
