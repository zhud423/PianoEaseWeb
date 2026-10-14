import { createHash, randomBytes } from "node:crypto";
import { AUTH_COOKIE_NAME, SESSION_TTL_SECONDS, getSessionSecret } from "./config";

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(`${getSessionSecret()}:${token}`).digest("hex");
}

export function getSessionExpiresAt(): Date {
  return new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
}

export const authCookie = {
  name: AUTH_COOKIE_NAME,
  maxAge: SESSION_TTL_SECONDS,
};
