import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";
import { ensurePgliteDataDir, resolveDbRuntime } from "./runtime";

type DbClient = PostgresJsDatabase<typeof schema> | PgliteDatabase<typeof schema>;

declare global {
  var __pianoease_sql__: postgres.Sql | undefined;
  var __pianoease_pglite__: PGlite | undefined;
  var __pianoease_db__: DbClient | undefined;
}

export function getDb(): DbClient {
  if (globalThis.__pianoease_db__) {
    return globalThis.__pianoease_db__;
  }

  const runtime = resolveDbRuntime();

  if (runtime.driver === "postgres") {
    const sql = postgres(runtime.connectionString, {
      prepare: false,
      max: process.env.NODE_ENV === "production" ? 10 : 1,
    });
    const db = drizzle(sql, { schema });
    globalThis.__pianoease_sql__ = sql;
    globalThis.__pianoease_db__ = db;
    return db;
  }

  ensurePgliteDataDir(runtime.dataDir);
  const pglite = new PGlite(runtime.dataDir);
  const db = drizzlePglite(pglite, { schema });
  globalThis.__pianoease_pglite__ = pglite;
  globalThis.__pianoease_db__ = db;
  return db;
}

export { schema };

export async function closeDbConnections() {
  if (globalThis.__pianoease_sql__) {
    await globalThis.__pianoease_sql__.end({ timeout: 1 });
    globalThis.__pianoease_sql__ = undefined;
  }

  if (globalThis.__pianoease_pglite__) {
    await globalThis.__pianoease_pglite__.close();
    globalThis.__pianoease_pglite__ = undefined;
  }

  globalThis.__pianoease_db__ = undefined;
}
