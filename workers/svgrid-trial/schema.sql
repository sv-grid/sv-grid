-- svgrid-trial D1 schema. Apply with:
--   npx wrangler d1 execute svgrid-trials --remote --file schema.sql

-- One row per person who started a trial.
CREATE TABLE IF NOT EXISTS trials (
  email            TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  company          TEXT NOT NULL DEFAULT '',
  source           TEXT NOT NULL DEFAULT '',  -- where on svgrid.com the trial started, e.g. home-hero
  country          TEXT NOT NULL DEFAULT '',  -- Cloudflare's two-letter country code
  user_agent       TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL,             -- first download, ISO 8601
  last_download_at TEXT NOT NULL,
  downloads        INTEGER NOT NULL DEFAULT 1,
  support_until    TEXT NOT NULL              -- YYYY-MM-DD, 30 days after the first download
);

-- Every request, for the hourly limit per address. The IP is stored only as a
-- salted SHA-256 hash.
CREATE TABLE IF NOT EXISTS trial_requests (
  created_at TEXT NOT NULL,
  ip_hash    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS trial_requests_ip ON trial_requests (ip_hash, created_at);
