import assert from "node:assert/strict";
import test from "node:test";
import { setInitialAccountPassword } from "../service.js";

function fakePool(rows: unknown[]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const query = async (sql: string, values: unknown[] = []) => { calls.push({ sql, values }); return { rows: sql.startsWith("UPDATE app_users") ? rows : [], rowCount: rows.length }; };
  return { pool: { connect: async () => ({ query, release() {} }) } as never, calls };
}

test("initial password applies only when password_hash IS NULL, audits and revokes sessions", async () => {
  const { pool, calls } = fakePool([{ isMaintainer: false, characterId: null, nickname: null }]);
  const result = await setInitialAccountPassword("alice", "longenough1", pool);
  assert.ok("sessionToken" in result && typeof result.sessionToken === "string" && "user" in result);
  const order = (text: string) => calls.findIndex((c) => c.sql.includes(text));
  assert.ok(order("UPDATE app_sessions") > -1 && order("UPDATE app_sessions") < calls.findIndex((c) => c.sql === "COMMIT"));
  const update = calls.find((c) => c.sql.startsWith("UPDATE app_users"))!;
  assert.match(update.sql, /password_hash IS NULL/);
  assert.ok(calls.some((c) => c.sql.includes("UPDATE app_sessions")));
  assert.ok(calls.some((c) => c.values.includes("account.password_set")));
  assert.ok(calls.some((c) => c.sql === "COMMIT"));
});

test("initial password is refused when a password exists, and for short passwords", async () => {
  const { pool, calls } = fakePool([]);
  assert.deepEqual(await setInitialAccountPassword("alice", "longenough1", pool), { error: "This account already has a password.", code: "has_password" });
  assert.ok(calls.some((c) => c.sql === "ROLLBACK"));
  assert.equal(calls.some((c) => c.sql.includes("app_sessions")), false);
  assert.ok("error" in await setInitialAccountPassword("alice", "short", pool));
  assert.ok("error" in await setInitialAccountPassword("alice", "longenough1", null));
});

test("suspended passwordless account gets a distinct refusal", async () => {
  const calls: string[] = [];
  const query = async (sql: string) => { calls.push(sql); return { rows: sql.includes("AS suspended") ? [{ suspended: true }] : [], rowCount: 0 }; };
  const result = await setInitialAccountPassword("alice", "longenough1", { connect: async () => ({ query, release() {} }) } as never);
  assert.deepEqual(result, { error: "This account is suspended. Contact a maintainer.", code: "suspended" });
  assert.ok(calls.includes("ROLLBACK"));
});
