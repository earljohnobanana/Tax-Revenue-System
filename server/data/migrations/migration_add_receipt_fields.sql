-- server/data/migrations/migration_add_receipt_fields.sql
-- ===========================================================================
-- Adds the data needed to print onto the pre-printed Accountable Form No. 51
-- WITHOUT hardcoding anything in the frontend:
--
--   1. municipality_settings.agency          -> the "AGENCY" box (e.g. 'MTO')
--   2. account_codes (new lookup table)       -> the "ACCOUNT CODE" column,
--                                                keyed by tax_type / fee name
--   3. payments.accountable_form_no           -> stores the pad's pre-printed
--                                                serial so each system record
--                                                reconciles to its physical
--                                                form for COA audit
--
-- Idempotent: safe to run repeatedly and safe to append to schema.sql's
-- bootstrap. SQLite has no "ADD COLUMN IF NOT EXISTS", so the ALTERs are
-- guarded by the app-level runner (run-migrations.js) which checks
-- pragma table_info first. The CREATE TABLE / INSERT here are self-guarding.
-- ===========================================================================

-- 2. Account code lookup -----------------------------------------------------
-- Normalized: one row per collectible. `match_key` is the canonical lookup
-- value (tax_type for taxes/permits, or the exact fee name for regulatory
-- fees). Codes come from the LGU chart of accounts / Revenue Code.
CREATE TABLE IF NOT EXISTS account_codes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  match_key    TEXT NOT NULL UNIQUE,   -- e.g. 'Business Tax', 'Sanitary Permit Fee'
  account_code TEXT NOT NULL,          -- e.g. '4-01-01-010'
  description  TEXT,
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_codes_key ON account_codes (match_key);

CREATE TRIGGER IF NOT EXISTS trg_account_codes_updated
AFTER UPDATE ON account_codes FOR EACH ROW BEGIN
  UPDATE account_codes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Seed with the collectibles this office actually uses. account_code values
-- are placeholders the treasurer must confirm against the municipal Revenue
-- Code — they are editable via Settings, never hardcoded in the app.
INSERT OR IGNORE INTO account_codes (match_key, account_code, description) VALUES
  ('Business Tax',               '', 'Business tax on gross sales/receipts'),
  ('Mayor''s Permit',            '', 'Mayor''s / business permit fee'),
  ('Regulatory Fees',            '', 'Generic regulatory fees (fallback)'),
  ('Certificate of Occupancy Fee','', 'Certificate of occupancy'),
  ('Health Certificate Fee',     '', 'Health certificate'),
  ('Inspection Fee',             '', 'Business inspection'),
  ('PESO Fee',                   '', 'PESO fee'),
  ('Sanitary Permit Fee',        '', 'Sanitary permit'),
  ('Solid Waste Management Fee', '', 'Solid waste management');