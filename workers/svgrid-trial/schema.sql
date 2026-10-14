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

-- Founding-customer claims (svgrid.com/founding/). One row per email. A claim
-- holds a place while its status is 'pending' or 'approved'; set it to
-- 'rejected' to give the place back. A 'company' claim gives a logo and a
-- testimonial or case study; a 'freelancer' claim gives a testimonial only.
CREATE TABLE IF NOT EXISTS founding_claims (
  email       TEXT PRIMARY KEY,
  kind        TEXT NOT NULL DEFAULT 'company',  -- company | freelancer
  name        TEXT NOT NULL,
  company     TEXT NOT NULL DEFAULT '',
  company_url TEXT NOT NULL DEFAULT '',
  building    TEXT NOT NULL,
  developers  INTEGER NOT NULL,
  logo_url    TEXT NOT NULL DEFAULT '',
  country     TEXT NOT NULL DEFAULT '',
  user_agent  TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'  -- pending | approved | rejected
);

-- Testimonials sent from svgrid.com/founding/testimonial/, once a team has shipped.
CREATE TABLE IF NOT EXISTS founding_testimonials (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  email      TEXT NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT '',
  company    TEXT NOT NULL DEFAULT '',
  quote      TEXT NOT NULL,
  logo_url   TEXT NOT NULL DEFAULT '',
  case_study INTEGER NOT NULL DEFAULT 0
);
