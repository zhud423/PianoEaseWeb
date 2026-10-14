import path from "node:path";
import fs from "node:fs";

export const DEFAULT_POSTGRES_URL = "postgres://postgres:postgres@localhost:5432/pianoease";
export const DEFAULT_PGLITE_DATA_DIR = path.join(process.cwd(), ".localdb", "pglite");
export const DEFAULT_DB_DRIVER = "pglite";

type DbRuntime =
  | {
      driver: "postgres";
      connectionString: string;
    }
  | {
      driver: "pglite";
      dataDir: string;
    };

function looksLikePostgresUrl(value: string): boolean {
  return value.startsWith("postgres://") || value.startsWith("postgresql://");
}

export function resolveDbRuntime(): DbRuntime {
  const selectedDriver = process.env.DB_DRIVER?.trim().toLowerCase();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const pgliteDataDir = process.env.PGLITE_DATA_DIR?.trim() || DEFAULT_PGLITE_DATA_DIR;

  if (selectedDriver === "pglite" || (!selectedDriver && DEFAULT_DB_DRIVER === "pglite" && !databaseUrl)) {
    return {
      driver: "pglite",
      dataDir: pgliteDataDir,
    };
  }

  if (selectedDriver === "postgres") {
    if (!databaseUrl || !looksLikePostgresUrl(databaseUrl)) {
      throw new Error("DB_DRIVER=postgres 时必须提供有效的 DATABASE_URL。");
    }
    return {
      driver: "postgres",
      connectionString: databaseUrl,
    };
  }

  if (databaseUrl && looksLikePostgresUrl(databaseUrl)) {
    return {
      driver: "postgres",
      connectionString: databaseUrl,
    };
  }

  return {
    driver: "pglite",
    dataDir: pgliteDataDir,
  };
}

export function ensurePgliteDataDir(dataDir: string) {
  fs.mkdirSync(dataDir, { recursive: true });
}
