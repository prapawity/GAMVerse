import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { database } from "../../infra/db.js";
import { recordAuditEvent } from "../../infra/audit.js";
import { tokenHash } from "../../infra/tokenHash.js";

export const PENDING_SIGNUP_TTL_MS = 10 * 60 * 1000;
const PROVIDER = "google";
const UNIQUE_VIOLATION = "23505";

export type IdentityProfile = { subject: string; email: string; displayName: string | null };
export type IdentityUser = { username: string; suspended: boolean; isMaintainer: boolean; nickname: string | null; characterId: string | null };
export type RepositoryResult = { ok: true } | { ok: false; reason: "conflict" | "password_required" | "not_found" | "expired" };

const isUniqueViolation = (error: unknown) => (error as { code?: string }).code === UNIQUE_VIOLATION;

/** Looks an account up by Google `sub` only. The email is never a match key. */
export async function findUserByIdentity(subject: string, pool: Pool | null | undefined = database): Promise<IdentityUser | null> {
  if (!pool) return null;
  const result = await pool.query<{ username: string; suspended_at: Date | null; is_maintainer: boolean; nickname: string | null; character_id: string | null }>(
    `SELECT users.username, users.suspended_at, users.is_maintainer, users.nickname,
       COALESCE('custom-' || users.custom_character_model_id::text, users.character_id) AS character_id
     FROM app_user_identities identities JOIN app_users users USING (username)
     WHERE identities.provider = $1 AND identities.subject = $2`,
    [PROVIDER, subject],
  );
  const row = result.rows[0];
  return row ? { username: row.username, suspended: row.suspended_at !== null, isMaintainer: row.is_maintainer, nickname: row.nickname, characterId: row.character_id } : null;
}

export async function touchIdentity(subject: string, pool: Pool | null | undefined = database) {
  await pool?.query("UPDATE app_user_identities SET last_used_at = now() WHERE provider = $1 AND subject = $2", [PROVIDER, subject]);
}

export async function getLinkedEmail(username: string, pool: Pool | null | undefined = database): Promise<string | null> {
  const result = await pool?.query<{ email: string }>("SELECT email FROM app_user_identities WHERE provider = $1 AND username = $2", [PROVIDER, username]);
  return result?.rows[0]?.email ?? null;
}

/** True when the email belongs to a Google identity of any account. Only identity emails are Google-verified, so only they block a new sign-up. */
export async function emailHeldByIdentity(email: string, pool: Pool | null | undefined = database): Promise<boolean> {
  const result = await pool?.query("SELECT 1 FROM app_user_identities WHERE provider = $1 AND lower(email) = $2", [PROVIDER, email.toLowerCase()]);
  return (result?.rowCount ?? 0) > 0;
}

const SYSTEM_ACTOR = "system:google";

/**
 * A verified Google email outranks an unverified legacy one. Clears the email on any OTHER account that holds it
 * without a Google identity, and audits each change. Emails held by a Google identity are left alone, so they still conflict.
 */
async function clearUnverifiedEmailHolders(client: { query: Pool["query"] }, email: string, exceptUsername: string) {
  const cleared = await client.query<{ username: string }>(
    `UPDATE app_users SET email = NULL
     WHERE lower(email) = $1 AND username <> $2
       AND NOT EXISTS (SELECT 1 FROM app_user_identities identities WHERE identities.username = app_users.username)
     RETURNING username`,
    [email.toLowerCase(), exceptUsername],
  );
  for (const { username } of cleared.rows) {
    await recordAuditEvent(client as never, { actorUsername: SYSTEM_ACTOR, action: "account.email_cleared", targetType: "account", targetId: username });
  }
}

/** Attaches a verified Google identity to an existing, non-suspended account. */
export async function linkIdentity(username: string, profile: IdentityProfile, pool: Pool | null | undefined = database): Promise<RepositoryResult> {
  if (!pool) return { ok: false, reason: "not_found" };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query("SELECT 1 FROM app_users WHERE username = $1 AND suspended_at IS NULL FOR UPDATE", [username]);
    if (!user.rowCount) { await client.query("ROLLBACK"); return { ok: false, reason: "not_found" }; }
    await clearUnverifiedEmailHolders(client, profile.email, username);
    await client.query("INSERT INTO app_user_identities(provider, subject, username, email, last_used_at) VALUES ($1, $2, $3, $4, now())", [PROVIDER, profile.subject, username, profile.email]);
    await client.query("UPDATE app_users SET email = $2 WHERE username = $1", [username, profile.email]);
    await recordAuditEvent(client as never, { actorUsername: username, action: "google.linked", targetType: "account", targetId: username });
    await client.query("COMMIT");
    return { ok: true };
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueViolation(error)) return { ok: false, reason: "conflict" };
    throw error;
  } finally { client.release(); }
}

/** Removes the Google identity. Refused unless the account has a password, so one sign-in method always remains. */
export async function unlinkIdentity(username: string, pool: Pool | null | undefined = database, actor: string = username): Promise<RepositoryResult> {
  if (!pool) return { ok: false, reason: "not_found" };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query<{ has_password: boolean }>("SELECT (password_hash IS NOT NULL) AS has_password FROM app_users WHERE username = $1 FOR UPDATE", [username]);
    if (!user.rows[0]) { await client.query("ROLLBACK"); return { ok: false, reason: "not_found" }; }
    if (!user.rows[0].has_password) { await client.query("ROLLBACK"); return { ok: false, reason: "password_required" }; }
    const removed = await client.query("DELETE FROM app_user_identities WHERE provider = $1 AND username = $2", [PROVIDER, username]);
    if (!removed.rowCount) { await client.query("ROLLBACK"); return { ok: false, reason: "not_found" }; }
    await client.query("UPDATE app_users SET email = NULL WHERE username = $1", [username]);
    // A maintainer removing someone else's identity also ends that person's sessions.
    if (actor !== username) await client.query("UPDATE app_sessions SET revoked_at = now() WHERE username = $1 AND revoked_at IS NULL", [username]);
    await recordAuditEvent(client as never, { actorUsername: actor, action: "google.unlinked", targetType: "account", targetId: username });
    await client.query("COMMIT");
    return { ok: true };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

/** Stores a verified profile for 10 minutes and returns the single-use token. Only its hash is kept. */
export async function createPendingSignup(profile: IdentityProfile, pool: Pool | null | undefined = database, now = Date.now()): Promise<string> {
  if (!pool) throw new Error("Database is required for Google sign-up.");
  const token = randomBytes(32).toString("base64url");
  await pool.query("DELETE FROM app_pending_oauth_signups WHERE expires_at <= now()");
  await pool.query(
    "INSERT INTO app_pending_oauth_signups(token_hash, provider, subject, email, display_name, expires_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [tokenHash(token), PROVIDER, profile.subject, profile.email, profile.displayName, new Date(now + PENDING_SIGNUP_TTL_MS)],
  );
  return token;
}

/** Consumes the pending token and creates a passwordless account with its identity in one transaction. */
export async function completePendingSignup(token: string, username: string, pool: Pool | null | undefined = database): Promise<({ ok: true; subject: string } | Exclude<RepositoryResult, { ok: true }>) & { usernameTaken?: boolean }> {
  if (!pool) return { ok: false, reason: "not_found" };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pending = await client.query<{ subject: string; email: string }>(
      "DELETE FROM app_pending_oauth_signups WHERE token_hash = $1 AND provider = $2 AND expires_at > now() RETURNING subject, email",
      [tokenHash(token), PROVIDER],
    );
    const row = pending.rows[0];
    if (!row) { await client.query("ROLLBACK"); return { ok: false, reason: "expired" }; }
    await clearUnverifiedEmailHolders(client, row.email, username);
    try {
      await client.query("INSERT INTO app_users(username, created_at, last_active_at, email, character_id) VALUES ($1, now(), now(), $2, NULL)", [username, row.email]);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Roll back so the pending token survives and the person can pick another username.
      await client.query("ROLLBACK");
      const byEmail = (error as { constraint?: string }).constraint !== "app_users_pkey";
      return { ok: false, reason: "conflict", usernameTaken: !byEmail };
    }
    await client.query("INSERT INTO app_user_identities(provider, subject, username, email, last_used_at) VALUES ($1, $2, $3, $4, now())", [PROVIDER, row.subject, username, row.email]);
    await recordAuditEvent(client as never, { actorUsername: username, action: "google.signup", targetType: "account", targetId: username });
    await client.query("COMMIT");
    return { ok: true, subject: row.subject };
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueViolation(error)) return { ok: false, reason: "conflict" };
    throw error;
  } finally { client.release(); }
}

/** Maintainer fix for an email conflict: clears a stored email that is not backed by a Google identity. */
export async function clearStoredEmail(actor: string, username: string, pool: Pool | null | undefined = database): Promise<RepositoryResult> {
  if (!pool) return { ok: false, reason: "not_found" };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query("SELECT 1 FROM app_users WHERE username = $1 FOR UPDATE", [username]);
    if (!user.rowCount) { await client.query("ROLLBACK"); return { ok: false, reason: "not_found" }; }
    const identity = await client.query("SELECT 1 FROM app_user_identities WHERE username = $1", [username]);
    // The email mirrors the Google identity while one is linked; unlink first.
    if (identity.rowCount) { await client.query("ROLLBACK"); return { ok: false, reason: "conflict" }; }
    await client.query("UPDATE app_users SET email = NULL WHERE username = $1", [username]);
    await recordAuditEvent(client as never, { actorUsername: actor, action: "account.email_cleared", targetType: "account", targetId: username });
    await client.query("COMMIT");
    return { ok: true };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

export type GoogleAccountStatus = { linked: boolean; email: string | null; hasPassword: boolean };

/** Own-account status for the settings page. Callers must pass the session username, never a request value. */
export async function readGoogleAccountStatus(username: string, pool: Pool | null | undefined = database): Promise<GoogleAccountStatus | null> {
  if (!pool) return null;
  const result = await pool.query<{ email: string | null; has_password: boolean }>(
    `SELECT identities.email, (users.password_hash IS NOT NULL) AS has_password
     FROM app_users users LEFT JOIN app_user_identities identities ON identities.username = users.username AND identities.provider = $2
     WHERE users.username = $1`,
    [username, PROVIDER],
  );
  const row = result.rows[0];
  return row ? { linked: row.email !== null, email: row.email, hasPassword: row.has_password } : null;
}
