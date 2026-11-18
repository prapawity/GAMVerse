import { useEffect, useState, type FormEvent } from "react";
import { BrandMark } from "../BrandMark";
import { fetchAuthConfig, type AuthConfig, AUTH_CONFIG_DISABLED } from "./authConfig";
import { readGoogleErrorFromSearch } from "./googleAuthErrors";
import { GoogleSignInButton } from "./GoogleSignInButton";

import type { AuthMode } from "./authMode";
export type { AuthMode };
export type AuthSubmission = { mode: AuthMode; username: string; password: string };

type AuthCardProps = {
  endpoint: string;
  mode: AuthMode;
  onModeChange(mode: AuthMode): void;
  maintainerPortal: boolean;
  invited: boolean;
  busy: boolean;
  error: string | null;
  onClearError(): void;
  /** Resolves true when sign-in succeeded so the card can forget the password. */
  onSubmit(submission: AuthSubmission): Promise<boolean>;
};

export function AuthCard({ endpoint, mode, onModeChange, maintainerPortal, invited, busy, error, onClearError, onSubmit }: AuthCardProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [config, setConfig] = useState<AuthConfig>(AUTH_CONFIG_DISABLED);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchAuthConfig(endpoint).then((value) => { if (active) setConfig(value); });
    return () => { active = false; };
  }, [endpoint]);

  useEffect(() => {
    const { message, cleanedSearch } = readGoogleErrorFromSearch(window.location.search);
    if (message === null) return;
    setGoogleError(message);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${cleanedSearch}${window.location.hash}`);
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGoogleError(null);
    if (await onSubmit({ mode, username, password })) setPassword("");
  };

  const register = mode === "register" && !maintainerPortal;
  return (
    <form className="auth-card" onSubmit={(event) => void submit(event)}>
      <BrandMark />
      <span className="eyebrow">{maintainerPortal ? "PLATFORM OPERATIONS" : register ? "JOIN GAMVERSE" : "YOUR WORKSPACE"}</span>
      <h1>{maintainerPortal ? "Maintainer sign in" : mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p>{invited ? "You’ve been invited to an office. Create an account or sign in to join." : maintainerPortal ? "Sign in to manage GAMVerse and its offices." : register ? "Create your account and meet your team in a shared virtual office." : "Sign in to pick up where your team left off."}</p>
      {googleError && <p className="auth-error auth-google-error" role="alert">{googleError}</p>}
      {config.google && !maintainerPortal && <><GoogleSignInButton endpoint={endpoint} disabled={busy} /><div className="auth-divider" role="separator"><span>or</span></div></>}
      <label>Username<input data-tutorial-target="auth-username" autoComplete="username" required minLength={3} maxLength={24} value={username} onChange={(event) => setUsername(event.target.value)} /></label>
      <label>Password<div className="auth-password-field"><input data-tutorial-target="auth-password" type={passwordVisible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /><button className="password-visibility-toggle" type="button" aria-label={passwordVisible ? "Hide password" : "Show password"} aria-pressed={passwordVisible} onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.8 4.4 10 7-.4.9-1.2 2-2.3 3M6.2 6.3C3.9 7.7 2.5 10 2 12c1.2 0 2-.2 2.9-.5" /></svg>}</button></div></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button data-tutorial-target="auth-submit" className="auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : maintainerPortal || mode === "login" ? "Sign in" : "Create account"}</button>
      {!maintainerPortal && <button className="auth-switch" type="button" onClick={() => { onClearError(); setGoogleError(null); onModeChange(mode === "login" ? "register" : "login"); }}>
        {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>}
      <a className="auth-switch" href={maintainerPortal ? "/" : "/maintainer"}>{maintainerPortal ? "Regular user sign in" : "Maintainer sign in"}</a>
    </form>
  );
}
