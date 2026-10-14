import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth/config";
import { hashSessionToken } from "@/lib/auth/session";
import { deleteSessionByTokenHash } from "@/db/repositories/sessions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (cookieValue) {
    try {
      await deleteSessionByTokenHash(hashSessionToken(cookieValue));
    } catch {
      // Keep logout response behavior stable even if DB cleanup fails.
    }
  }

  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
