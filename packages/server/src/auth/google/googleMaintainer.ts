import { normalizeAccountUsername } from "@gammyverse/shared";
import { clearStoredEmail, unlinkIdentity, type RepositoryResult } from "./identityRepository.js";

type MaintainerSession = { username: string; role: "maintainer" | "user" } | null;
export type GoogleMaintainerDependencies = {
  unlink(username: string, actor: string): Promise<RepositoryResult>;
  clearEmail(actor: string, username: string): Promise<RepositoryResult>;
  /** Closes the user's live realtime connections after their sessions were revoked. */
  disconnectAccount(username: string): Promise<void>;
};
export const createGoogleMaintainerDependencies = (disconnectAccount: (username: string) => Promise<void>): GoogleMaintainerDependencies => ({
  unlink: (username, actor) => unlinkIdentity(username, undefined, actor),
  clearEmail: (actor, username) => clearStoredEmail(actor, username),
  disconnectAccount,
});

type Outcome = { status: number; body: { ok: true } | { error: string } };

async function run(session: MaintainerSession, usernameValue: unknown, action: (username: string, actor: string) => Promise<RepositoryResult>, messages: Record<string, string>): Promise<Outcome> {
  if (!session || session.role !== "maintainer") return { status: 403, body: { error: "Maintainer access required." } };
  const username = normalizeAccountUsername(usernameValue);
  if (!username) return { status: 400, body: { error: "Account not found." } };
  const result = await action(username, session.username);
  if (result.ok) return { status: 200, body: { ok: true } };
  const status = result.reason === "not_found" ? 404 : 409;
  return { status, body: { error: messages[result.reason] ?? "Request could not be completed." } };
}

/** Unlinks a user's Google identity and ends their sessions. Refused when the account has no password (issue a password reset link first). */
export async function maintainerUnlinkGoogle(session: MaintainerSession, usernameValue: unknown, dependencies: GoogleMaintainerDependencies): Promise<Outcome> {
  const outcome = await run(session, usernameValue, dependencies.unlink, {
    not_found: "That account has no connected Google account.",
    password_required: "That account has no password. Issue a password reset link before unlinking Google.",
  });
  const username = normalizeAccountUsername(usernameValue);
  if (outcome.status !== 200 || !session || !username || username === session.username) return outcome;
  try { await dependencies.disconnectAccount(username); }
  catch { return { status: 503, body: { error: "Google was unlinked and sessions were revoked, but active connections could not be closed. Retry after realtime recovers." } }; }
  return outcome;
}

/** Clears a stored email that is not backed by a Google identity. */
export function maintainerClearEmail(session: MaintainerSession, usernameValue: unknown, dependencies: GoogleMaintainerDependencies) {
  return run(session, usernameValue, (username, actor) => dependencies.clearEmail(actor, username), {
    not_found: "Account not found.",
    conflict: "This email belongs to a connected Google account. Unlink Google instead.",
  });
}
