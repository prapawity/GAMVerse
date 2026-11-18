import { useCallback, useEffect, useState, type FormEvent } from "react";
import { errorFromBody, parseGoogleStatus, mapSetPasswordResponse, parseLinkUrl, signInMethodsView, validateNewPassword, type GoogleStatus } from "./signInMethodsView";

type Props = { endpoint: string; notice?: string | null; initialError?: string | null; onReauth?: (message: string) => void; onStatus?: (status: GoogleStatus | null) => void };

async function readBody(response: Response): Promise<unknown> { try { return await response.json(); } catch { return null; } }

/** "Sign-in methods" block for user settings: connect/disconnect Google and set a first password. */
export function SignInMethods({ endpoint, notice = null, initialError = null, onStatus, onReauth }: Props) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(notice);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${endpoint}/auth/google/status`, { credentials: "include", cache: "no-store" });
      const parsed = response.ok ? parseGoogleStatus(await readBody(response)) : null;
      setStatus(parsed); onStatus?.(parsed);
    } catch { setStatus(null); onStatus?.(null); }
  }, [endpoint, onStatus]);
  useEffect(() => { void load(); }, [load]);

  const view = signInMethodsView(status);
  if (!view.visible) return error || info ? <p className={error ? "auth-error" : "settings-intro"} role={error ? "alert" : "status"}>{error ?? info}</p> : null;

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true); setError(null); setInfo(null);
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : fallback); }
    finally { setBusy(false); }
  };
  const connect = () => run(async () => {
    const response = await fetch(`${endpoint}/auth/google/link`, { method: "POST", credentials: "include" });
    const body = await readBody(response);
    const url = response.ok ? parseLinkUrl(body) : null;
    if (!url) throw new Error(errorFromBody(body, "Could not start Google connection."));
    window.location.assign(url);
  }, "Could not start Google connection.");
  const disconnect = () => run(async () => {
    const response = await fetch(`${endpoint}/auth/google`, { method: "DELETE", credentials: "include" });
    if (!response.ok) throw new Error(errorFromBody(await readBody(response), "Could not disconnect Google."));
    setConfirmDisconnect(false); setInfo("Google account disconnected"); await load();
  }, "Could not disconnect Google.");
  const setInitialPassword = (event: FormEvent) => {
    event.preventDefault();
    const invalid = validateNewPassword(password, confirm);
    if (invalid) { setError(invalid); return; }
    void run(async () => {
      const response = await fetch(`${endpoint}/auth/password/set`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: password }) });
      const outcome = mapSetPasswordResponse(response.status, await readBody(response));
      if (outcome.kind === "error") throw new Error(outcome.message);
      setPassword(""); setConfirm("");
      if (outcome.kind === "reauth") { onReauth?.(outcome.message); setInfo(outcome.message); return; }
      setPassword(""); setConfirm(""); setInfo("Password set"); await load();
    }, "Could not set the password.");
  };

  return <section aria-labelledby="sign-in-methods-title" className="sign-in-methods">
    <h3 id="sign-in-methods-title">Sign-in methods</h3>
    {info && <p className="sign-in-methods-notice" role="status">{info}</p>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    <p className="settings-intro">Google: {status?.linked ? <strong>Connected{view.email ? ` (${view.email})` : ""}</strong> : "Not connected"}</p>
    <div className="sign-in-methods-actions">
    {view.canConnect && <button type="button" className="lobby-button" disabled={busy} onClick={() => void connect()}>Connect Google</button>}
    {status?.linked && !confirmDisconnect && <button type="button" className="lobby-button danger" disabled={busy || !view.canDisconnect} onClick={() => setConfirmDisconnect(true)}>Disconnect Google</button>}
    {view.disconnectHint && <small className="maintainer-account-note"> {view.disconnectHint}</small>}
    </div>
    {confirmDisconnect && <div role="group" aria-label="Confirm disconnect"><p>Disconnect Google? You will sign in with your username and password.</p>
      <button type="button" className="lobby-button danger" disabled={busy} onClick={() => void disconnect()}>Yes, disconnect</button>
      <button type="button" className="lobby-button quiet" disabled={busy} onClick={() => setConfirmDisconnect(false)}>Cancel</button></div>}
    {view.showSetPassword && <form className="sign-in-methods-form" onSubmit={setInitialPassword} aria-label="Set a password">
      <label className="sound-device-field">New password<input type="password" autoComplete="new-password" value={password} minLength={8} maxLength={128} onChange={(e) => setPassword(e.target.value)} /></label>
      <label className="sound-device-field">Confirm password<input type="password" autoComplete="new-password" value={confirm} minLength={8} maxLength={128} onChange={(e) => setConfirm(e.target.value)} /></label>
      <button type="submit" className="lobby-button primary" disabled={busy}>Set a password</button>
    </form>}
  </section>;
}
