import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getTestLoginCredentials } from "@/lib/auth/config";
import { authCookie, createSessionToken, getSessionExpiresAt, hashSessionToken } from "@/lib/auth/session";
import { getOrCreateUserByUsername } from "@/db/repositories/users";
import { createSession } from "@/db/repositories/sessions";

export const runtime = "nodejs";

function safeNextPath(input: string | null): string {
  if (!input) return "/";
  return input.startsWith("/") ? input : "/";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const nextPath = safeNextPath(String(formData.get("next") ?? "/"));
  const expected = getTestLoginCredentials();

  if (username !== expected.username || password !== expected.password) {
    return NextResponse.redirect(new URL("/login?error=invalid_credentials", request.url), 303);
  }

  try {
    const user = await getOrCreateUserByUsername(username);
    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);

    await createSession({
      userId: user.id,
      tokenHash,
      expiresAt: getSessionExpiresAt(),
      ip: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });

    const response = NextResponse.redirect(new URL(nextPath, request.url), 303);
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: authCookie.maxAge,
    });

    return response;
  } catch (error) {
    console.error("[auth/login] session creation failed", error);
    return NextResponse.redirect(new URL("/login?error=session_unavailable", request.url), 303);
  }
}
