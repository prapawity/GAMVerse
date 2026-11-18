import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { clearStoredEmail, completePendingSignup, createPendingSignup, findUserByIdentity, linkIdentity, unlinkIdentity } from "./identityRepository.js";
import { tokenHash } from "../../infra/tokenHash.js";

type Call = { sql: string; values: unknown[] };
function fakePool(respond: (sql: string, values: unknown[]) => { rows?: unknown[]; rowCount?: number } | Error) {
  const calls: Call[] = [];
  const query = async (sql: string, values: unknown[] = []) => {
    calls.push({ sql, values });
    const result = respond(sql, values);
    if (result instanceof Error) throw result;
    return { rows: result.rows ?? [], rowCount: result.rowCount ?? result.rows?.length ?? 0 };
  };
  return { pool: { query, connect: async () => ({ query, release() {} }) } as unknown as Pool, calls };
}
const profile = { subject: "sub-1", email: "a@example.com", displayName: "A" };
const uniqueError = (constraint: string) => Object.assign(new Error("dup"), { code: "23505", constraint });
const ran = (calls: Call[], text: string) => calls.some((call) => call.sql.includes(text));

test("identity lookup is keyed by provider and subject, never email", async () => {
  const { pool, calls } = fakePool(() => ({ rows: [{ username: "alice", suspended_at: new Date(), is_maintainer: false, nickname: null, character_id: null }] }));
  const user = await findUserByIdentity("sub-1", pool);
  assert.equal(user?.suspended, true);
  assert.deepEqual(calls[0]!.values, ["google", "sub-1"]);
  assert.doesNotMatch(calls[0]!.sql, /email/);
});

test("linking audits google.linked and reports a conflict without committing", async () => {
  const ok = fakePool((sql) => (sql.includes("FROM app_users") ? { rowCount: 1 } : {}));
  assert.deepEqual(await linkIdentity("alice", profile, ok.pool), { ok: true });
  assert.ok(ran(ok.calls, "COMMIT"));
  assert.ok(ok.calls.some((call) => call.values.includes("google.linked")));
  const suspended = fakePool(() => ({ rowCount: 0 }));
  assert.deepEqual(await linkIdentity("alice", profile, suspended.pool), { ok: false, reason: "not_found" });
  assert.equal(ran(suspended.calls, "app_user_identities"), false);
  const dup = fakePool((sql) => (sql.includes("FROM app_users") ? { rowCount: 1 } : sql.includes("INSERT INTO app_user_identities") ? uniqueError("x") : {}));
  assert.deepEqual(await linkIdentity("alice", profile, dup.pool), { ok: false, reason: "conflict" });
  assert.ok(ran(dup.calls, "ROLLBACK"));
  assert.equal(ran(dup.calls, "COMMIT"), false);
});

test("unlink is refused for accounts without a password and audits otherwise", async () => {
  const noPassword = fakePool((sql) => (sql.includes("has_password") ? { rows: [{ has_password: false }] } : {}));
  assert.deepEqual(await unlinkIdentity("alice", noPassword.pool), { ok: false, reason: "password_required" });
  assert.equal(ran(noPassword.calls, "DELETE FROM app_user_identities"), false);
  const withPassword = fakePool((sql) => (sql.includes("has_password") ? { rows: [{ has_password: true }] } : { rowCount: 1 }));
  assert.deepEqual(await unlinkIdentity("alice", withPassword.pool), { ok: true });
  assert.ok(withPassword.calls.some((call) => call.values.includes("google.unlinked")));
});

test("pending sign-up stores only the token hash and completion is single use", async () => {
  const created = fakePool(() => ({}));
  const token = await createPendingSignup(profile, created.pool, 1_000);
  const insert = created.calls.find((call) => call.sql.includes("INSERT INTO app_pending_oauth_signups"))!;
  assert.equal(insert.values[0], tokenHash(token));
  assert.equal(insert.values.includes(token), false);

  const expired = fakePool(() => ({ rows: [] }));
  assert.deepEqual(await completePendingSignup(token, "alice", expired.pool), { ok: false, reason: "expired" });
  assert.ok(ran(expired.calls, "expires_at > now()"));
  assert.equal(ran(expired.calls, "INSERT INTO app_users"), false);

  const success = fakePool((sql) => (sql.includes("DELETE FROM app_pending") ? { rows: [{ subject: "sub-1", email: "a@example.com" }] } : {}));
  assert.deepEqual(await completePendingSignup(token, "alice", success.pool), { ok: true, subject: "sub-1" });
  assert.ok(success.calls.some((call) => call.values.includes("google.signup")));
  const insertUser = success.calls.find((call) => call.sql.includes("INSERT INTO app_users"))!;
  assert.doesNotMatch(insertUser.sql, /password/);
});

test("a taken username rolls back so the pending token survives", async () => {
  const { pool, calls } = fakePool((sql) => (sql.includes("DELETE FROM app_pending") ? { rows: [{ subject: "s", email: "a@example.com" }] } : sql.includes("INSERT INTO app_users") ? uniqueError("app_users_pkey") : {}));
  assert.deepEqual(await completePendingSignup("t".repeat(43), "alice", pool), { ok: false, reason: "conflict", usernameTaken: true });
  assert.ok(ran(calls, "ROLLBACK"));
  assert.equal(ran(calls, "COMMIT"), false);
});

const clearsLegacy = (sql: string) => sql.includes("UPDATE app_users SET email = NULL") && sql.includes("NOT EXISTS");

test("claiming an email clears other accounts' unverified copies before the insert, with audit, and never touches identity-backed ones", async () => {
  const linkPool = fakePool((sql) => (sql.includes("FROM app_users WHERE username") ? { rowCount: 1 } : clearsLegacy(sql) ? { rows: [{ username: "old-holder" }] } : {}));
  assert.deepEqual(await linkIdentity("alice", profile, linkPool.pool), { ok: true });
  const clearIndex = linkPool.calls.findIndex((call) => clearsLegacy(call.sql));
  const insertIndex = linkPool.calls.findIndex((call) => call.sql.includes("INSERT INTO app_user_identities"));
  assert.ok(clearIndex >= 0 && clearIndex < insertIndex);
  assert.deepEqual(linkPool.calls[clearIndex]!.values, ["a@example.com", "alice"]);
  assert.match(linkPool.calls[clearIndex]!.sql, /NOT EXISTS \(SELECT 1 FROM app_user_identities/);
  assert.ok(linkPool.calls.some((call) => call.values.includes("account.email_cleared") && call.values.includes("system:google") && call.values.includes("old-holder")));

  const signup = fakePool((sql) => (sql.includes("DELETE FROM app_pending") ? { rows: [{ subject: "sub-1", email: "a@example.com" }] } : clearsLegacy(sql) ? { rows: [{ username: "old-holder" }] } : {}));
  assert.deepEqual(await completePendingSignup("t".repeat(43), "alice", signup.pool), { ok: true, subject: "sub-1" });
  assert.ok(signup.calls.findIndex((call) => clearsLegacy(call.sql)) < signup.calls.findIndex((call) => call.sql.includes("INSERT INTO app_users")));
});

test("an email held by another Google identity still conflicts", async () => {
  const { pool, calls } = fakePool((sql) => (sql.includes("FROM app_users WHERE username") ? { rowCount: 1 } : sql.includes("INSERT INTO app_user_identities") ? uniqueError("app_users_email_unique") : {}));
  assert.deepEqual(await linkIdentity("alice", profile, pool), { ok: false, reason: "conflict" });
  assert.equal(ran(calls, "COMMIT"), false);
});

test("maintainer unlink audits the actor and revokes the target's sessions; self-unlink does not", async () => {
  const respond = (sql: string) => (sql.includes("has_password") ? { rows: [{ has_password: true }] } : { rowCount: 1 });
  const byMaintainer = fakePool(respond);
  assert.deepEqual(await unlinkIdentity("bob", byMaintainer.pool, "root"), { ok: true });
  assert.ok(byMaintainer.calls.some((call) => call.sql.includes("UPDATE app_users SET email = NULL")));
  assert.ok(byMaintainer.calls.some((call) => call.sql.includes("UPDATE app_sessions SET revoked_at") && call.values[0] === "bob"));
  assert.ok(byMaintainer.calls.some((call) => call.values.includes("google.unlinked") && call.values[0] === "root" && call.values.includes("bob")));
  const self = fakePool(respond);
  await unlinkIdentity("bob", self.pool);
  assert.equal(ran(self.calls, "UPDATE app_sessions"), false);
});

test("clearStoredEmail refuses when a Google identity exists and audits otherwise", async () => {
  const withIdentity = fakePool((sql) => (sql.includes("FROM app_users") || sql.includes("FROM app_user_identities") ? { rowCount: 1 } : {}));
  assert.deepEqual(await clearStoredEmail("root", "bob", withIdentity.pool), { ok: false, reason: "conflict" });
  assert.equal(ran(withIdentity.calls, "UPDATE app_users SET email = NULL"), false);
  const plain = fakePool((sql) => (sql.includes("FROM app_user_identities") ? { rowCount: 0 } : sql.includes("FROM app_users") ? { rowCount: 1 } : {}));
  assert.deepEqual(await clearStoredEmail("root", "bob", plain.pool), { ok: true });
  assert.ok(plain.calls.some((call) => call.values.includes("account.email_cleared") && call.values[0] === "root"));
  const missing = fakePool(() => ({ rowCount: 0 }));
  assert.deepEqual(await clearStoredEmail("root", "ghost", missing.pool), { ok: false, reason: "not_found" });
});
