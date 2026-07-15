-- server/data/schema.sql
-- ---------------------------------------------------------------------------
-- SQLite schema for the BPLS revenue database (bpls_db -> revenue.db).
--
-- Faithful translation of the MySQL 8 schema, adjusted for SQLite semantics:
--   * ENUM(...)                 -> TEXT + CHECK (col IN (...))
--   * DECIMAL(p,s)              -> NUMERIC  (see NOTE ON MONEY below)
--   * INT AUTO_INCREMENT        -> INTEGER PRIMARY KEY AUTOINCREMENT
--   * TINYINT(1)                -> INTEGER (0/1)
--   * JSON                      -> TEXT (SQLite json1 functions operate on TEXT)
--   * ON UPDATE CURRENT_TIMESTAMP -> AFTER UPDATE triggers (SQLite has no
--                                    column-level ON UPDATE clause)
--   * Per-table index names made globally unique (SQLite index names are
--     schema-global, MySQL's are per-table). e.g. idx_owner -> idx_businesses_owner.
--
-- Idempotent: safe to run on every server boot. CREATE ... IF NOT EXISTS
-- means an existing populated DB is left untouched.
--
-- NOTE ON MONEY: SQLite has no fixed-point DECIMAL type. NUMERIC affinity
-- stores 5082.00 as the integer 5082 and 90.75 as the REAL 90.75. All money
-- math in this system is already performed server-side in JS with round2(),
-- and mysql2 previously returned DECIMAL as strings that the code wrapped in
-- Number(); better-sqlite3 returns JS numbers directly, so keep applying
-- round2() to any COMPUTED currency value before persisting. Stored values
-- from this migration are exact.
-- ---------------------------------------------------------------------------

PRAGMA foreign_keys = ON;

-- ===========================================================================
-- owners
-- ===========================================================================
CREATE TABLE IF NOT EXISTS owners (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  address      TEXT,
  contact      TEXT,
  email        TEXT,
  tin          TEXT,
  remarks      TEXT,
  status       TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  created_date TEXT NOT NULL,
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================================================
-- businesses
-- ===========================================================================
CREATE TABLE IF NOT EXISTS businesses (
  id                 TEXT PRIMARY KEY,
  owner_id           TEXT NOT NULL,
  name               TEXT NOT NULL,
  type               TEXT NOT NULL,
  business_nature    TEXT CHECK (business_nature IN ('a','b','c_a','c_b','c_d','d','e','f','g')),
  registration_type  TEXT NOT NULL DEFAULT 'New' CHECK (registration_type IN ('New','Renewal')),
  line_of_business   TEXT,
  kind_of_market     TEXT,
  address            TEXT,
  date_registered    TEXT,
  capital_investment NUMERIC DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  tax_due_status     TEXT NOT NULL DEFAULT 'Unpaid' CHECK (tax_due_status IN ('Paid','Unpaid','Partial','Overdue')),
  created_at         TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at         TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES owners (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_businesses_owner  ON businesses (owner_id);
CREATE INDEX IF NOT EXISTS idx_business_nature    ON businesses (business_nature);

-- ===========================================================================
-- assessments
-- ===========================================================================
CREATE TABLE IF NOT EXISTS assessments (
  id                 TEXT PRIMARY KEY,
  business_id        TEXT NOT NULL,
  owner_id           TEXT NOT NULL,
  assessment_year    INTEGER NOT NULL CHECK (assessment_year BETWEEN 2000 AND 2100),
  tax_type           TEXT NOT NULL,
  payment_frequency  TEXT NOT NULL DEFAULT 'Annual' CHECK (payment_frequency IN ('Annual','Quarterly','Semi-Annual')),
  capital_investment NUMERIC NOT NULL DEFAULT 0,
  gross_sales        NUMERIC NOT NULL DEFAULT 0,
  assessment_amount  NUMERIC NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Unpaid','Paid','Overdue','Cancelled')),
  due_date           TEXT,
  remarks            TEXT,
  generated_by       TEXT,
  created_at         TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at         TEXT DEFAULT CURRENT_TIMESTAMP,
  cancelled_by       TEXT,
  cancelled_at       TEXT,
  cancel_reason      TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id)    REFERENCES owners (id)     ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_assessment_year     ON assessments (assessment_year);
CREATE INDEX IF NOT EXISTS idx_assessment_business  ON assessments (business_id);
CREATE INDEX IF NOT EXISTS idx_assessment_owner     ON assessments (owner_id);

-- ===========================================================================
-- payments
-- ===========================================================================
CREATE TABLE IF NOT EXISTS payments (
  id                TEXT PRIMARY KEY,
  owner_id          TEXT,
  business_id       TEXT,
  date_paid         TEXT NOT NULL,
  or_number         TEXT NOT NULL,
  tax_type          TEXT NOT NULL,
  payment_category  TEXT NOT NULL,
  period_covered    TEXT,
  assessment_year   INTEGER,
  base_tax          NUMERIC DEFAULT 0,
  interest          NUMERIC DEFAULT 0,
  penalty           NUMERIC DEFAULT 0,
  regulatory_fees   NUMERIC DEFAULT 0,
  total_paid        NUMERIC NOT NULL,
  processed_by      TEXT,
  payment_method    TEXT,
  installment_no    INTEGER,
  payment_type      TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_type IN ('Cash','Check','Money Order')),
  drawee_bank       TEXT,
  instrument_number TEXT,
  instrument_date   TEXT,
  fee_details       TEXT,
  remarks           TEXT,
  created_at        TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at        TEXT,
  deleted_by        TEXT,
  FOREIGN KEY (owner_id)    REFERENCES owners (id)     ON DELETE SET NULL,
  FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_owner              ON payments (owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_business            ON payments (business_id);
CREATE INDEX IF NOT EXISTS idx_or_number                    ON payments (or_number);
CREATE INDEX IF NOT EXISTS idx_payments_assessment_lookup   ON payments (business_id, tax_type, assessment_year);

-- ===========================================================================
-- regulatory_fees
-- ===========================================================================
CREATE TABLE IF NOT EXISTS regulatory_fees (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  amount      NUMERIC NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive'))
);

-- ===========================================================================
-- users
-- ===========================================================================
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  office        TEXT,
  role          TEXT NOT NULL CHECK (role IN ('Super Admin','Administrator','Treasurer','BPLO Staff','Accounting Staff','Viewer')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  last_login    TEXT DEFAULT NULL
);

-- ===========================================================================
-- notifications
-- ===========================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT DEFAULT 'general',
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read  ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at);

-- ===========================================================================
-- audit_logs  (user_id is a free-form varchar in the source, NOT an FK)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT,
  action     TEXT NOT NULL,
  module     TEXT NOT NULL,
  details    TEXT,               -- JSON stored as TEXT; use json_extract() to query
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_logs (module);

-- ===========================================================================
-- municipality_settings  (single-row table, id must always be 1)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS municipality_settings (
  id                  INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  municipality_name   TEXT NOT NULL DEFAULT 'Municipality of Sta. Catalina',
  province            TEXT NOT NULL DEFAULT 'Negros Oriental',
  region              TEXT NOT NULL DEFAULT 'Region VII (Central Visayas)',
  postal_code         TEXT,
  mayor_name          TEXT,
  municipal_treasurer TEXT,
  bplo_officer        TEXT,
  municipal_accountant TEXT,
  updated_by          TEXT,
  updated_at          TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================================================
-- updated_at maintenance triggers  (replace MySQL ON UPDATE CURRENT_TIMESTAMP)
-- recursive_triggers is OFF by default, so the inner UPDATE will not re-fire.
-- ===========================================================================
CREATE TRIGGER IF NOT EXISTS trg_owners_updated
AFTER UPDATE ON owners FOR EACH ROW BEGIN
  UPDATE owners SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_businesses_updated
AFTER UPDATE ON businesses FOR EACH ROW BEGIN
  UPDATE businesses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_assessments_updated
AFTER UPDATE ON assessments FOR EACH ROW BEGIN
  UPDATE assessments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_users_updated
AFTER UPDATE ON users FOR EACH ROW BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_settings_updated
AFTER UPDATE ON municipality_settings FOR EACH ROW BEGIN
  UPDATE municipality_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;