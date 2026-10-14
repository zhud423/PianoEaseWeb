import { eq } from "drizzle-orm";
import { getDb, schema } from "../client";

export async function getOrCreateUserByUsername(username: string) {
  const db = getDb();
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.username, username),
  });

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(schema.users)
    .values({
      username,
    })
    .returning();

  return created;
}
