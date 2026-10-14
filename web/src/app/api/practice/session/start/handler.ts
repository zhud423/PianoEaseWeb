import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import { startPracticeSession } from "@/db/repositories/practice";
import { findSongById } from "@/lib/songs/catalog";

type StartPracticePayload = {
  songId: string;
  variant: "original" | "lv1" | "lv2" | "lv3";
  mode: "game" | "follow";
};

const SONG_ID_PATTERN = /^[a-z0-9-]+$/;

function isStartPayload(value: unknown): value is StartPracticePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.songId === "string" &&
    SONG_ID_PATTERN.test(payload.songId) &&
    ["original", "lv1", "lv2", "lv3"].includes(String(payload.variant)) &&
    ["game", "follow"].includes(String(payload.mode))
  );
}

export type StartPracticeSessionDependencies = {
  getCurrentUser: typeof getCurrentUser;
  startPracticeSession: typeof startPracticeSession;
  findSongById: typeof findSongById;
};

const defaultDependencies: StartPracticeSessionDependencies = {
  getCurrentUser,
  startPracticeSession,
  findSongById,
};

export async function postStartPracticeSession(
  request: Request,
  dependencies: StartPracticeSessionDependencies = defaultDependencies
) {
  const user = await dependencies.getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!isStartPayload(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!dependencies.findSongById(body.songId)) {
    return NextResponse.json({ error: "Unknown songId" }, { status: 400 });
  }

  try {
    const session = await dependencies.startPracticeSession({
      userId: user.id,
      songId: body.songId,
      variant: body.variant,
      mode: body.mode,
    });
    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start practice session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
