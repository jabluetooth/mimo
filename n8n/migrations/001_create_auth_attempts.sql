-- Backs the login/signup rate limiting added to the auth flows.
-- Run this against the Neon database BEFORE importing/activating the
-- updated mimo-workflow.json -- the new "Count/Record ... Attempt(s)"
-- Postgres nodes query this table and will fail if it doesn't exist yet.

CREATE TABLE IF NOT EXISTS auth_attempts (
  id SERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('login', 'signup')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_lookup
  ON auth_attempts (identifier, kind, created_at);

-- Optional cleanup for old rows, since nothing prunes this table automatically.
-- Run manually or on a schedule; rows older than a day are never read by the
-- rate-limit queries (login: 15 min window, signup: 1 hour window).
-- DELETE FROM auth_attempts WHERE created_at < now() - interval '1 day';
