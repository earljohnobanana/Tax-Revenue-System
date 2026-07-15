CREATE INDEX idx_account_codes_key ON account_codes (match_key);

CREATE INDEX idx_assessment_business  ON assessments (business_id);

CREATE INDEX idx_assessment_owner     ON assessments (owner_id);

CREATE INDEX idx_assessment_year     ON assessments (assessment_year);

CREATE INDEX idx_audit_module ON audit_logs (module);

CREATE INDEX idx_audit_user   ON audit_logs (user_id);

CREATE INDEX idx_business_nature    ON businesses (business_nature);

CREATE INDEX idx_businesses_owner  ON businesses (owner_id);

CREATE INDEX idx_notifications_created_at ON notifications (created_at);

CREATE INDEX idx_notifications_user_read  ON notifications (user_id, is_read);

CREATE INDEX idx_or_number                    ON payments (or_number);

CREATE INDEX idx_payments_assessment_lookup   ON payments (business_id, tax_type, assessment_year);

CREATE INDEX idx_payments_business            ON payments (business_id);

CREATE INDEX idx_payments_owner              ON payments (owner_id);

CREATE TABLE account_codes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  match_key    TEXT NOT NULL UNIQUE,   -- e.g. 'Business Tax', 'Sanitary Permit Fee'
  account_code TEXT NOT NULL,          -- e.g. '4-01-01-010'
  description  TEXT,
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assessments (
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

CREATE TABLE audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT,
  action     TEXT NOT NULL,
  module     TEXT NOT NULL,
  details    TEXT,               -- JSON stored as TEXT; use json_extract() to query
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE businesses (
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

CREATE TABLE municipality_settings (
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
, agency TEXT DEFAULT 'MTO');

CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT DEFAULT 'general',
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE owners (
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

CREATE TABLE payments (
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
  deleted_by        TEXT, accountable_form_no TEXT,
  FOREIGN KEY (owner_id)    REFERENCES owners (id)     ON DELETE SET NULL,
  FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE SET NULL
);

CREATE TABLE regulatory_fees (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  amount      NUMERIC NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive'))
);

CREATE TABLE sqlite_sequence(name,seq);

CREATE TABLE users (
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

CREATE TRIGGER trg_account_codes_updated
AFTER UPDATE ON account_codes FOR EACH ROW BEGIN
  UPDATE account_codes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_assessments_updated
AFTER UPDATE ON assessments FOR EACH ROW BEGIN
  UPDATE assessments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_businesses_updated
AFTER UPDATE ON businesses FOR EACH ROW BEGIN
  UPDATE businesses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_owners_updated
AFTER UPDATE ON owners FOR EACH ROW BEGIN
  UPDATE owners SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_settings_updated
AFTER UPDATE ON municipality_settings FOR EACH ROW BEGIN
  UPDATE municipality_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_users_updated
AFTER UPDATE ON users FOR EACH ROW BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;