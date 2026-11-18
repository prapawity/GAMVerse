import { useState, type FormEvent } from "react";
import { BrandMark } from "../BrandMark";
import { completeGoogleSignup } from "./googleSignupRequest";
import { capturePendingToken } from "./pendingSignupToken";

type GoogleSignupPageProps = { endpoint: string; onSignedIn(user: unknown): void };

export function GoogleSignupPage({ endpoint, onSignedIn }: GoogleSignupPageProps) {
  const [token] = useState(() => capturePendingToken(window.location, window.history));
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(token === null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    const result = await completeGoogleSignup(endpoint, token, username);
    setBusy(false);
    if (result.kind === "ok") { onSignedIn(result.user); return; }
    if (result.kind === "expired") setExpired(true);
    else setError(result.message);
  };

  return (
    <>
        {expired ? (
          <section className="auth-card">
            <BrandMark />
            <span className="eyebrow">GOOGLE SIGN-UP</span>
            <h1>Sign-up link expired</h1>
            <p role="alert">This Google sign-up link is invalid or has expired. Go back to sign in and choose Continue with Google to start again.</p>
            <a className="auth-submit auth-link-button" href="/">Back to sign in</a>
          </section>
        ) : (
          <form className="auth-card" onSubmit={(event) => void submit(event)}>
            <BrandMark />
            <span className="eyebrow">GOOGLE SIGN-UP</span>
            <h1>Choose a username</h1>
            <p>Your Google account is verified. Pick the username teammates will see.</p>
            <label>Username<input autoFocus autoComplete="username" required minLength={3} maxLength={24} value={username} onChange={(event) => setUsername(event.target.value)} /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : "Create account"}</button>
            <a className="auth-switch" href="/">Back to sign in</a>
          </form>
        )}
    </>
  );
}
