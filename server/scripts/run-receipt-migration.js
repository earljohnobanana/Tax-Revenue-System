// server/scripts/run-receipt-migration.js
// ---------------------------------------------------------------------------
// One-shot, idempotent migration runner for the receipt-printing fields.
//
// Adds (only if missing):
//   • municipality_settings.agency          TEXT DEFAULT 'MTO'
//   • payments.accountable_form_no          TEXT
//   • account_codes lookup table + seeds    (via migration_add_receipt_fields.sql)
//
// SQLite has no "ADD COLUMN IF NOT EXISTS", so each ALTER is guarded by a
// pragma table_info() check. Safe to run repeatedly.
//
// RUN IT (must use Electron's node ABI, per this project's better-sqlite3 build):
//   set ELECTRON_RUN_AS_NODE=1 && npx electron server/scripts/run-receipt-migration.js
// or in PowerShell:
//   $env:ELECTRON_RUN_AS_NODE=1; npx electron server/scripts/run-receipt-migration.js
// ---------------------------------------------------------------------------

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH =
  process.env.SQLITE_DB_PATH ||
  path.join(__dirname, '..', 'data', 'revenue.db');

const SQL_PATH = path.join(__dirname, '..', 'data', 'migrations', 'migration_add_receipt_fields.sql');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

function columnExists(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

function addColumnIfMissing(table, column, ddl) {
  if (columnExists(table, column)) {
    console.log(`✓ ${table}.${column} already exists — skipped`);
    return;
  }
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl};`);
  console.log(`＋ Added ${table}.${column}`);
}

try {
  console.log('Running receipt-fields migration on', DB_PATH);

  // 1. Guarded column additions
  addColumnIfMissing('municipality_settings', 'agency', "agency TEXT DEFAULT 'MTO'");
  addColumnIfMissing('payments', 'accountable_form_no', 'accountable_form_no TEXT');

  // Backfill agency for the existing single settings row if it came out NULL
  db.prepare(
    "UPDATE municipality_settings SET agency = 'MTO' WHERE id = 1 AND (agency IS NULL OR agency = '')"
  ).run();

  // 2. account_codes table + seeds (self-guarding CREATE/INSERT OR IGNORE)
  if (fs.existsSync(SQL_PATH)) {
    db.exec(fs.readFileSync(SQL_PATH, 'utf8'));
    console.log('✓ account_codes table + seeds applied');
  } else {
    console.warn('WARNING: migration SQL not found at', SQL_PATH);
  }

  console.log('Migration complete.');
} catch (err) {
  console.error('Migration FAILED:', err.message);
  process.exit(1);
} finally {
  db.close();
}