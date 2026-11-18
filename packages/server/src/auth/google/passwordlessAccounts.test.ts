import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";

const testDirectory = await mkdtemp(join(process.cwd(), ".test-gammyverse-passwordless-"));
process.env.AUTH_USERS_FILE = join(testDirectory, "users.json");
await mkdir(testDirectory, { recursive: true });
await writeFile(process.env.AUTH_USERS_FILE, JSON.stringify([{ username: "google-only", salt: null, passwordHash: null, createdAt: new Date().toISOString() }]));
const { loginAccount, changeAccountPassword } = await import("../service.js");

after(async () => {
  await rm(testDirectory, { recursive: true, force: true });
  delete process.env.AUTH_USERS_FILE;
});

test("passwordless Google accounts are rejected by password login and password change", async () => {
  for (const attempt of ["", "anything-at-all", "null"]) {
    const login = await loginAccount("google-only", attempt || "12345678");
    assert.ok("error" in login);
  }
  const changed = await changeAccountPassword("google-only", "12345678", "another-long-password");
  assert.ok("error" in changed);
});
