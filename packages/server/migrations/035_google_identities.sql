-- External sign-in identities (Google). The match key is the provider's stable subject, never the email.
CREATE TABLE app_user_identities (
  provider     text         NOT NULL CHECK (provider IN ('google')),
  subject      text         NOT NULL,
  username     varchar(24)  NOT NULL REFERENCES app_users(username) ON DELETE CASCADE,
  email        varchar(254) NOT NULL,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  PRIMARY KEY (provider, subject),
  UNIQUE (provider, username)
);

-- Verified identity waiting for the person to choose a username. Only the token hash is stored.
CREATE TABLE app_pending_oauth_signups (
  token_hash   char(64)     PRIMARY KEY,
  provider     text         NOT NULL CHECK (provider IN ('google')),
  subject      text         NOT NULL,
  email        varchar(254) NOT NULL,
  display_name text,
  expires_at   timestamptz  NOT NULL
);
CREATE INDEX app_pending_oauth_signups_expiry ON app_pending_oauth_signups(expires_at);

-- Google-only accounts have no password.
ALTER TABLE app_users ALTER COLUMN password_salt DROP NOT NULL;
ALTER TABLE app_users ALTER COLUMN password_hash DROP NOT NULL;
