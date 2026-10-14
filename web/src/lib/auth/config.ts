export const AUTH_COOKIE_NAME = "pianoease_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export type TestLoginCredentials = {
  username: string;
  password: string;
};

export function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SESSION_SECRET must be set in production.");
  }
  return secret ?? "dev-only-change-this-secret";
}

export function getTestLoginCredentials(): TestLoginCredentials {
  return {
    username: process.env.TEST_LOGIN_USERNAME ?? "admin",
    password: process.env.TEST_LOGIN_PASSWORD ?? "changeme123",
  };
}

