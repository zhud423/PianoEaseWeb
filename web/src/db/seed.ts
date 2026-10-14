import { closeDbConnections, getDb, schema } from "./client";
import { getTestLoginCredentials } from "../lib/auth/config";
import { SONGS } from "../lib/songs/catalog";
import { getOrCreateUserByUsername } from "./repositories/users";

async function seedSongs() {
  const db = getDb();
  for (const song of SONGS) {
    await db
      .insert(schema.songs)
      .values({
        id: song.id,
        title: song.title,
        subtitle: song.subtitle,
        bpm: song.bpm,
        durationLabel: song.durationLabel,
        level: song.level,
      })
      .onConflictDoUpdate({
        target: schema.songs.id,
        set: {
          title: song.title,
          subtitle: song.subtitle,
          bpm: song.bpm,
          durationLabel: song.durationLabel,
          level: song.level,
          updatedAt: new Date(),
        },
      });
  }
}

async function seedTestUser() {
  const creds = getTestLoginCredentials();
  await getOrCreateUserByUsername(creds.username);
}

async function main() {
  await seedSongs();
  await seedTestUser();
  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbConnections();
  });
