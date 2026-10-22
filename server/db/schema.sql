-- CreatorFriendly.AI schema. Plans themselves live in src/data/pricing.js
-- (shared with the pricing page); the database only stores which plan a user is on.

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- At most one row per user; no row means no plan (there is no free tier).
-- Credits = seconds of finished 768p video (480p costs 0.6 per second).
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id              uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_id              text NOT NULL,
  status               text NOT NULL DEFAULT 'active',  -- active | canceled | past_due
  credits_remaining    integer NOT NULL DEFAULT 0,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end   timestamptz NOT NULL DEFAULT now() + interval '30 days',
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Fixed-window counters: key is e.g. 'login:<ip>' or 'ideas:<user_id>'
CREATE TABLE IF NOT EXISTS rate_limits (
  key          text NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

CREATE TABLE IF NOT EXISTS bots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  niche_id   text NOT NULL,
  settings   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bots_user_idx ON bots(user_id);

-- A run is one video request: research -> ideas -> (approval) -> render.
CREATE TABLE IF NOT EXISTS runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id           uuid NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'researching',
  duration_sec     integer NOT NULL,
  resolution       text NOT NULL DEFAULT '768p',
  topic_hint       text,
  research         jsonb,
  ideas            jsonb,
  chosen_idea      jsonb,
  script           jsonb,
  progress         jsonb NOT NULL DEFAULT '{}',
  video_url        text,
  error            text,
  credits_reserved integer NOT NULL DEFAULT 0,
  credits_charged  integer NOT NULL DEFAULT 0,
  cost_cents       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS runs_bot_idx ON runs(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS runs_user_status_idx ON runs(user_id, status);

-- v2: real-money spend caps (provider cost, in cents) and per-bot channel branding.
-- Idempotent so the server can re-apply this file on every start.
ALTER TABLE users ADD COLUMN IF NOT EXISTS spend_cap_cents integer;          -- NULL = uncapped
ALTER TABLE users ADD COLUMN IF NOT EXISTS spent_cents integer NOT NULL DEFAULT 0;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS brand jsonb;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS brand_status text NOT NULL DEFAULT 'pending'; -- pending | generating | ready | failed
ALTER TABLE bots ADD COLUMN IF NOT EXISTS brand_error text;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS pitches integer NOT NULL DEFAULT 0;  -- idea rounds, counted against the plan
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS purchased_credits integer NOT NULL DEFAULT 0; -- top-ups, never reset
ALTER TABLE runs ADD COLUMN IF NOT EXISTS credits_from_purchased integer NOT NULL DEFAULT 0;  -- part of the reservation taken from top-ups

-- v3: finished videos live in the database (one row per completed run).
-- STORAGE EXTERNAL skips compression (MP4 is already compressed) and lets
-- substring() read just the byte range a video player asks for.
CREATE TABLE IF NOT EXISTS videos (
  run_id     uuid PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime       text NOT NULL DEFAULT 'video/mp4',
  size_bytes integer NOT NULL,
  data       bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE videos ALTER COLUMN data SET STORAGE EXTERNAL;
