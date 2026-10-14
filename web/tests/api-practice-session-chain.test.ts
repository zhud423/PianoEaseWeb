import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { postStartPracticeSession } from "../src/app/api/practice/session/start/handler";
import { postEndPracticeSession } from "../src/app/api/practice/session/end/handler";
import { closeDbConnections, getDb, schema } from "../src/db/client";
import { endPracticeSession, startPracticeSession } from "../src/db/repositories/practice";
import { getOrCreateUserByUsername } from "../src/db/repositories/users";
import { findSongById, SONGS } from "../src/lib/songs/catalog";

const ENV_KEYS = ["DB_DRIVER", "PGLITE_DATA_DIR", "DATABASE_URL"] as const;

type TestUser = {
  id: string;
  username: string;
};

let tempRoot = "";
let user: TestUser = { id: "", username: "" };
const previousEnv = new Map<string, string | undefined>();

async function migrateLocalDb(dataDir: string) {
  const client = new PGlite(dataDir);
  try {
    const db = drizzlePglite(client);
    await migratePglite(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  } finally {
    await client.close();
  }
}

async function seedBaseData() {
  const db = getDb();
  const song = SONGS[0];
  await db.insert(schema.songs).values(song).onConflictDoNothing();
  const created = await getOrCreateUserByUsername("api-chain-user");
  user = {
    id: created.id,
    username: created.username,
  };
}

before(async () => {
  for (const key of ENV_KEYS) {
    previousEnv.set(key, process.env[key]);
  }

  tempRoot = await mkdtemp(path.join(os.tmpdir(), "pianoease-api-chain-"));
  process.env.DB_DRIVER = "pglite";
  process.env.PGLITE_DATA_DIR = path.join(tempRoot, "pglite");
  delete process.env.DATABASE_URL;

  await migrateLocalDb(process.env.PGLITE_DATA_DIR);
  await closeDbConnections();
  await seedBaseData();
});

beforeEach(async () => {
  const db = getDb();
  await db.delete(schema.practiceMeasureStats);
  await db.delete(schema.practiceSessions);
});

after(async () => {
  await closeDbConnections();

  for (const [key, value] of previousEnv.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("start session returns 401 when unauthenticated", async () => {
  const request = new Request("http://localhost:3000/api/practice/session/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      songId: SONGS[0].id,
      variant: "lv1",
      mode: "game",
    }),
  });

  const response = await postStartPracticeSession(request, {
    getCurrentUser: async () => null,
    startPracticeSession,
    findSongById,
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("start->end session chain writes sanitized metrics and measure stats", async () => {
  const startRequest = new Request("http://localhost:3000/api/practice/session/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      songId: SONGS[0].id,
      variant: "lv2",
      mode: "follow",
    }),
  });

  const startResponse = await postStartPracticeSession(startRequest, {
    getCurrentUser: async () => user,
    startPracticeSession,
    findSongById,
  });
  assert.equal(startResponse.status, 200);

  const startPayload = (await startResponse.json()) as { sessionId: string };
  assert.ok(startPayload.sessionId);

  const endRequest = new Request("http://localhost:3000/api/practice/session/end", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId: startPayload.sessionId,
      score: 89.7,
      midiEventCount: 26.6,
      noteOnCount: -3.2,
      noteOffCount: 18.2,
      rightAccuracyPct: 101.2,
      leftAccuracyPct: -2.4,
      requiredNoteCount: 33.8,
      hitCount: 30.2,
      missCount: -5.9,
      wrongCount: 1.9,
      completionPct: 132.9,
      measureStats: [
        { measureIndex: -1.2, hand: "left", hitCount: 4.8, missCount: 2.3, avgTimingOffsetMs: 11.9 },
        { measureIndex: 2.4, hand: "right", hitCount: 8.2, missCount: 0.1, avgTimingOffsetMs: null },
      ],
    }),
  });

  const endResponse = await postEndPracticeSession(endRequest, {
    getCurrentUser: async () => user,
    endPracticeSession,
  });
  assert.equal(endResponse.status, 200);
  assert.deepEqual(await endResponse.json(), { ok: true, sessionId: startPayload.sessionId });

  const db = getDb();
  const stored = await db.query.practiceSessions.findFirst({
    where: eq(schema.practiceSessions.id, startPayload.sessionId),
    with: {
      measureStats: true,
    },
  });
  assert.ok(stored);
  assert.equal(stored.score, 90);
  assert.equal(stored.midiEventCount, 27);
  assert.equal(stored.noteOnCount, 0);
  assert.equal(stored.noteOffCount, 18);
  assert.equal(stored.rightAccuracyPct, 100);
  assert.equal(stored.leftAccuracyPct, 0);
  assert.equal(stored.requiredNoteCount, 34);
  assert.equal(stored.hitCount, 30);
  assert.equal(stored.missCount, 0);
  assert.equal(stored.wrongCount, 2);
  assert.equal(stored.completionPct, 100);
  assert.ok(stored.endedAt instanceof Date);

  const stats = [...stored.measureStats].sort((a, b) => a.measureIndex - b.measureIndex || a.hand.localeCompare(b.hand));
  assert.equal(stats.length, 2);
  assert.deepEqual(
    stats.map((item) => ({
      measureIndex: item.measureIndex,
      hand: item.hand,
      hitCount: item.hitCount,
      missCount: item.missCount,
      avgTimingOffsetMs: item.avgTimingOffsetMs,
    })),
    [
      { measureIndex: 0, hand: "left", hitCount: 5, missCount: 2, avgTimingOffsetMs: 12 },
      { measureIndex: 2, hand: "right", hitCount: 8, missCount: 0, avgTimingOffsetMs: null },
    ]
  );
});

test("end session returns 404 when session does not exist", async () => {
  const request = new Request("http://localhost:3000/api/practice/session/end", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId: "00000000-0000-0000-0000-000000000000",
      score: 0,
      midiEventCount: 0,
      noteOnCount: 0,
      noteOffCount: 0,
    }),
  });

  const response = await postEndPracticeSession(request, {
    getCurrentUser: async () => user,
    endPracticeSession,
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Session not found" });
});
