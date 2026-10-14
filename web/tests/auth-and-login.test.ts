import assert from "node:assert/strict";
import test from "node:test";
import { POST as loginPost } from "../src/app/api/auth/login/route";
import { SESSION_TTL_SECONDS, getSessionSecret, getTestLoginCredentials } from "../src/lib/auth/config";
import { getSessionExpiresAt, hashSessionToken } from "../src/lib/auth/session";

async function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void> | void
): Promise<void> {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("test login credentials fallback to defaults", async () => {
  await withEnv(
    {
      TEST_LOGIN_USERNAME: undefined,
      TEST_LOGIN_PASSWORD: undefined,
    },
    () => {
      const credentials = getTestLoginCredentials();
      assert.equal(credentials.username, "admin");
      assert.equal(credentials.password, "changeme123");
    }
  );
});

test("session hash uses AUTH_SESSION_SECRET", async () => {
  await withEnv({ AUTH_SESSION_SECRET: "secret-a" }, () => {
    assert.equal(getSessionSecret(), "secret-a");
    const hashA = hashSessionToken("token");
    assert.equal(hashA.length, 64);

    process.env.AUTH_SESSION_SECRET = "secret-b";
    const hashB = hashSessionToken("token");
    assert.notEqual(hashA, hashB);
  });
});

test("session expires at expected ttl", () => {
  const now = Date.now();
  const expiresAt = getSessionExpiresAt().getTime();
  const expectedDelta = SESSION_TTL_SECONDS * 1000;
  const toleranceMs = 2000;
  const delta = expiresAt - now;

  assert.ok(delta >= expectedDelta - toleranceMs, `delta too small: ${delta}`);
  assert.ok(delta <= expectedDelta + toleranceMs, `delta too large: ${delta}`);
});

test("login rejects invalid credentials with redirect", async () => {
  await withEnv(
    {
      TEST_LOGIN_USERNAME: "qa-user",
      TEST_LOGIN_PASSWORD: "qa-pass",
    },
    async () => {
      const formData = new FormData();
      formData.set("username", "qa-user");
      formData.set("password", "wrong-pass");
      formData.set("next", "/practice/friendship-years");

      const request = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: formData,
      });

      const response = await loginPost(request);
      assert.equal(response.status, 303);

      const location = response.headers.get("location");
      assert.ok(location);

      const url = new URL(location, "http://localhost:3000");
      assert.equal(url.pathname, "/login");
      assert.equal(url.searchParams.get("error"), "invalid_credentials");
    }
  );
});
