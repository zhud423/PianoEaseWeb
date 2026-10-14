import postgres from "postgres";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { ensurePgliteDataDir, resolveDbRuntime } from "./runtime";

async function migrateWithPostgres(connectionString: string) {
  const sql = postgres(connectionString, { max: 1 });
  try {
    const db = drizzlePostgres(sql);
    await migratePostgres(db, { migrationsFolder: "drizzle" });
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function migrateWithPglite(dataDir: string) {
  ensurePgliteDataDir(dataDir);
  const client = new PGlite(dataDir);
  try {
    const db = drizzlePglite(client);
    await migratePglite(db, { migrationsFolder: "drizzle" });
  } finally {
    await client.close();
  }
}

async function main() {
  const runtime = resolveDbRuntime();
  if (runtime.driver === "postgres") {
    await migrateWithPostgres(runtime.connectionString);
    console.log(`Migration completed using postgres at ${runtime.connectionString}`);
    return;
  }

  await migrateWithPglite(runtime.dataDir);
  console.log(`Migration completed using pglite at ${runtime.dataDir}`);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
