import { and, eq, gt, lte } from "drizzle-orm";
import { getDb, schema } from "../client";

export type CreateSessionInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ip?: string | null;
  userAgent?: string | null;
};

export async function createSession(input: CreateSessionInput) {
  const db = getDb();
  const [created] = await db
    .insert(schema.sessions)
    .values({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    })
    .returning();

  return created;
}

export async function getValidSessionByTokenHash(tokenHash: string) {
  const db = getDb();
  const currentTime = new Date();
  const session = await db.query.sessions.findFirst({
    where: and(eq(schema.sessions.tokenHash, tokenHash), gt(schema.sessions.expiresAt, currentTime)),
    with: {
      user: true,
    },
  });

  return session ?? null;
}

export async function deleteSessionByTokenHash(tokenHash: string) {
  const db = getDb();
  const [deleted] = await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, tokenHash)).returning();
  return deleted ?? null;
}

export async function deleteExpiredSessions() {
  const db = getDb();
  const currentTime = new Date();
  await db.delete(schema.sessions).where(lte(schema.sessions.expiresAt, currentTime));
}
