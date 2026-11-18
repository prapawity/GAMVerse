# Google login plan

Status: planned. Owner decisions are recorded under **Decisions**. Each phase is one PR and leaves sign-in working.

## Goal

People can sign in either with a **username and password** or with **Google**. A username account can connect Google later and then use either method. Email addresses come only from Google, so every stored email is verified.

## Decisions (agreed with the owner)

1. **Username sign-up has no email field.** Registration takes a username and password only.
2. **Email is only stored for Google identities**, copied from Google's verified `email` claim. `app_users.email` therefore always holds a Google-verified address or `NULL`.
3. **Linking is explicit.** A Google account attaches to an existing username account only when that user, already signed in with a password, presses *Connect Google* in settings. Matching emails never link accounts automatically.
4. **Existing data does not need migrating.** The local and staging databases can be reset, so there is no backfill or legacy-email handling. Migrations stay additive anyway, and applied migrations are never edited.
5. **Free tier only.** Google OAuth sign-in with `openid email profile` scopes has no cost and needs no app verification. No email-sending service is added.
6. **One sign-in method must remain.** A user cannot disconnect Google unless the account has a password.

## Flow

```
Sign-in page
 ├─ username + password ──────────────────────────► POST /auth/login (unchanged)
 └─ Continue with Google ─► GET /auth/google/start?intent=login
                               │  sets short-lived signed cookie {state, nonce, PKCE verifier, intent}
                               ▼
                           accounts.google.com consent
                               ▼
                           GET /auth/google/callback?code&state
                               │  check state cookie → exchange code (PKCE) → verify ID token
                               │  (iss, aud = client id, exp, nonce, email_verified = true)
                               ├─ identity (google, sub) known  → create session → redirect /
                               ├─ intent = link + signed-in user → insert identity → redirect /settings?google=connected
                               └─ unknown identity, intent = login
                                     → store pending sign-up (10 min, hashed token, sub + email + name)
                                     → redirect /signup/google  (pick username, then character)
                                     → POST /auth/google/complete {pendingToken, username} → session
```

The match key is Google's `sub` and never the email. If a new Google identity's email already belongs to another account's Google identity, the request is refused. That can only happen when the same mailbox is attached to two Google accounts.

## Data model (migration `035_google_identities.sql`)

```sql
CREATE TABLE app_user_identities (
  provider     text        NOT NULL CHECK (provider IN ('google')),
  subject      text        NOT NULL,             -- Google `sub`
  username     varchar(24) NOT NULL REFERENCES app_users(username) ON DELETE CASCADE,
  email        varchar(254) NOT NULL,             -- verified email at link/login time
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  PRIMARY KEY (provider, subject),
  UNIQUE (provider, username)                     -- one Google account per user
);

CREATE TABLE app_pending_oauth_signups (
  token_hash  text        PRIMARY KEY,
  provider    text        NOT NULL,
  subject     text        NOT NULL,
  email       varchar(254) NOT NULL,
  display_name text,
  expires_at  timestamptz NOT NULL
);

-- Google-only accounts have no password.
ALTER TABLE app_users ALTER COLUMN password_salt DROP NOT NULL;
ALTER TABLE app_users ALTER COLUMN password_hash DROP NOT NULL;
```

Register the migration in `initializeDatabase()` (`packages/server/src/infra/db.ts`). The `app_users.email` column and its unique index stay. The Google flow writes the verified email there, and `/auth/register` no longer does.

Check before writing the migration: the username column type and length, and whether `app_users` needs an `ON DELETE` path that this cascade conflicts with.

## Configuration

| Variable | Process | Notes |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | api | OAuth client, type "Web application" |
| `GOOGLE_CLIENT_SECRET` | api | secret, `.env` only |
| `GOOGLE_REDIRECT_URI` | api | e.g. `https://localhost:5173/auth/google/callback` in dev, `https://${DOMAIN}/auth/google/callback` in production |

If `GOOGLE_CLIENT_ID` is unset, the routes return 404 and `/auth/config` reports `google: false`. The client then hides the button, so the stack still runs without Google set up.

The owner creates the OAuth client in Google Cloud Console, adds the redirect URIs, and puts the values in `.env` / `.env.production`. Adding them to `compose.production.yaml` needs owner approval (AGENTS.md).

## Phases

### Phase 1 — Server: identities, Google routes, username-only sign-up

Owner: `gamverse-server-dev` / Codex server.

- Migration 035 and its `initializeDatabase()` entry.
- New module `packages/server/src/auth/google/` (do not grow `service.ts`):
  - `googleConfig.ts`: reads env and exposes `isGoogleLoginEnabled()`.
  - `oauthState.ts`: pure functions that create and verify the signed state cookie, holding state, nonce, PKCE verifier, intent and expiry, HMAC'd with a server secret. TTL is 10 min. The cookie is `httpOnly`, `secure`, `sameSite=lax` and scoped to `/auth/google`.
  - `googleTokens.ts`: code exchange and ID-token verification against Google's JWKS. Use `jose` (one new dependency) or `google-auth-library`, and pin the exact version. Require `email_verified === true`, the issuer `https://accounts.google.com` or `accounts.google.com`, `aud === GOOGLE_CLIENT_ID`, and a matching nonce.
  - `identityRepository.ts`: find by `(provider, subject)`, link, unlink, and create and consume pending sign-ups (hashed token, single use, expiry).
- Routes in `entrypoints/api.ts`, kept thin by delegating to the module:
  - `GET /auth/config` → `{ google: boolean }`
  - `GET /auth/google/start?intent=login|link`. `link` requires a session.
  - `GET /auth/google/callback`
  - `POST /auth/google/complete` with `{ pendingToken, username }`. It validates the username with the existing `normalizeUsername`, creates a passwordless user and identity, sets the verified email and creates a session.
  - `DELETE /auth/google`. It unlinks, and refuses when the account has no password.
- `/auth/register` stops reading `email`. Passwordless accounts are rejected by `/auth/login` and by password change until a password is set.
- Apply the existing auth rate limit to `/auth/google/*`.
- Audit events `google.linked`, `google.unlinked` and `google.signup`, through the existing `recordAuditEvent`.
- Tests: `oauthState.test.ts`, `googleTokens.test.ts` (signed test JWKS; wrong `aud`, wrong nonce, `email_verified: false` and expired tokens rejected) and `identityRepository.test.ts` if the DB harness allows. Register them in the server `test` script.

### Phase 2 — Client: Google button, Google sign-up, no email field

Owner: `gamverse-client-dev` / Codex client.

- Remove the email input from the register form in `OfficeApp.tsx`. Extract the auth form into `ui/auth/` while touching it, because `OfficeApp.tsx` is a god-file.
- `ui/auth/GoogleSignInButton.tsx` is shown when `/auth/config` says `google: true`. It navigates to `/auth/google/start?intent=login` with a full-page redirect, not a popup.
- Route `/signup/google` asks for a username, then continues to the existing character picker.
- Error surfaces: `?error=google_denied|google_failed|google_conflict` on the sign-in page, with plain messages.
- Browser check: sign up with Google, sign out, sign in with Google, and sign in with username and password on a separate account.

### Phase 3 — Settings: connect and disconnect Google

Owner: `gamverse-client-dev` + small server additions if needed.

- In user settings, *Connect Google* (`/auth/google/start?intent=link`) and *Disconnect* (`DELETE /auth/google`). The settings show the connected Google email to the owner only.
- A Google-only user can set a password from settings, which enables Disconnect.
- The maintainer account view shows the email and a "Google" badge. No other office member sees emails.
- Browser check: username account → connect Google → sign out → sign in with Google lands in the same account. Disconnect is blocked for a Google-only account until a password is set.

### Phase 4 — Docs and production wiring

- README: Google sign-in setup (Cloud Console steps, redirect URIs, env vars) and the fact that email comes only from Google.
- `PROJECT_DOCS.md` current section: the identity model and the linking rule (explicit only, keyed by `sub`).
- `compose.production.yaml` and `Caddyfile`, if `/auth/google/*` needs routing to `api`. These need **owner approval**.

## Security checklist (reviewer)

- State, nonce and PKCE are all verified. The state cookie is signed, single use and short-lived.
- The ID token signature is checked against Google JWKS, along with `iss`, `aud`, `exp` and `email_verified`.
- Accounts are looked up by `sub` only. No route links accounts by email.
- `intent=link` requires an existing session, and the callback re-checks that the session is still valid and not suspended.
- Pending sign-up tokens are stored hashed, used once and expire.
- Suspended users cannot sign in through Google.
- Redirects after the callback go only to fixed same-origin paths, so there is no open redirect through a `next=` parameter.
- The client secret is never sent to the client or written to logs.

## Out of scope

- Other providers (GitHub, Microsoft). The `provider` column leaves room for them.
- Email verification or password reset by email.
- Automatic linking by email.
