// server/config/db.js
// ---------------------------------------------------------------------------
// SQLite drop-in replacement for the mysql2 pool used across all controllers.
//
// Exports the SAME shape the old MySQL module did — { pool, testConnection } —
// so every `const { pool } = require('../config/db')` keeps working unchanged.
//
// Single Server PC, single Express process => one connection is correct and
// safe. All client PCs talk to this one process over HTTP; only this process
// ever opens revenue.db. SQLite's single-writer model is fully satisfied.
//
// On load it also bootstraps the schema (idempotent CREATE ... IF NOT EXISTS)
// from server/data/schema.sql, so a brand-new device comes up with every
// table, index, and trigger in place before any controller runs a query.
// ---------------------------------------------------------------------------

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// IMPORTANT (packaging): inside a packaged Electron app, __dirname lives in the
// read-only app.asar. The database file must live in a WRITABLE location, so in
// production have Electron main.js set SQLITE_DB_PATH to a writable dir, e.g.
//   process.env.SQLITE_DB_PATH = path.join(app.getPath('userData'), 'revenue.db')
// In dev this falls back to server/data/revenue.db.
const DB_PATH =
  process.env.SQLITE_DB_PATH ||
  path.join(__dirname, '..', 'data', 'revenue.db');

const SCHEMA_PATH =
  process.env.SQLITE_SCHEMA_PATH ||
  path.join(__dirname, '..', 'data', 'schema.sql');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// --- Schema bootstrap ------------------------------------------------------
// Runs on every boot. CREATE ... IF NOT EXISTS means an already-populated DB
// is left untouched; a fresh DB gets fully built. schema.sql is safe to read
// from inside app.asar (read-only reads are supported there).
(function bootstrapSchema() {
  try {
    if (fs.existsSync(SCHEMA_PATH)) {
      sqlite.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    } else {
      console.warn('Schema file not found, skipping bootstrap:', SCHEMA_PATH);
    }
  } catch (err) {
    console.error('Schema bootstrap failed:', err.message);
    throw err; // fail fast: a half-initialized DB is worse than a clear crash
  }
})();

// --- Receipt-fields migration (self-healing, runs on every boot) -----------
// This used to be a one-shot script (server/scripts/run-receipt-migration.js)
// that had to be run manually against a specific DB_PATH. That's a trap on a
// single-machine, no-server install: electron/main.js's prepareServerDatabase()
// only ever copies the bundled starter DB into a machine's AppData folder ONCE
// (the very first launch on that PC) and never again — so any install whose
// AppData database predates this migration would keep missing
// municipality_settings.agency / account_codes forever, since nothing would
// ever re-run that one-shot script against it. Folding the same idempotent
// guards in here, right after bootstrapSchema(), means every boot — dev,
// fresh install, or an existing install upgrading to a newer packaged build —
// self-heals to the same schema, exactly like bootstrapSchema() already does.
(function bootstrapReceiptFields() {
  try {
    const hasColumn = (table, column) =>
      sqlite.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);

    if (!hasColumn('municipality_settings', 'agency')) {
      sqlite.exec("ALTER TABLE municipality_settings ADD COLUMN agency TEXT DEFAULT 'MTO'");
    }
    sqlite
      .prepare("UPDATE municipality_settings SET agency = 'MTO' WHERE id = 1 AND (agency IS NULL OR agency = '')")
      .run();

    if (!hasColumn('payments', 'accountable_form_no')) {
      sqlite.exec('ALTER TABLE payments ADD COLUMN accountable_form_no TEXT');
    }

    const RECEIPT_FIELDS_SQL_PATH = path.join(path.dirname(SCHEMA_PATH), 'migrations', 'migration_add_receipt_fields.sql');
    if (fs.existsSync(RECEIPT_FIELDS_SQL_PATH)) {
      sqlite.exec(fs.readFileSync(RECEIPT_FIELDS_SQL_PATH, 'utf8'));
    } else {
      console.warn('Receipt-fields migration SQL not found, skipping:', RECEIPT_FIELDS_SQL_PATH);
    }
  } catch (err) {
    console.error('Receipt-fields migration failed:', err.message);
    throw err; // same fail-fast posture as bootstrapSchema() above
  }
})();

// --- Value coercion --------------------------------------------------------
function coerceParams(params) {
  if (!Array.isArray(params)) return [];
  return params.map((p) => {
    if (p === undefined) return null;
    if (p instanceof Date) return p.toISOString().slice(0, 19).replace('T', ' ');
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

// --- MySQL -> SQLite rewriting ---------------------------------------------
// Conservative, only what this codebase actually uses. Prefer fixing the
// source query over adding exotic rewrites here.
function rewriteSql(sql) {
  return sql
    // Date functions
    .replace(/\bYEAR\s*\(\s*([^)]+?)\s*\)/gi, "CAST(strftime('%Y', $1) AS INTEGER)")
    .replace(/\bMONTH\s*\(\s*([^)]+?)\s*\)/gi, "CAST(strftime('%m', $1) AS INTEGER)")
    .replace(/\bNOW\s*\(\s*\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bCURDATE\s*\(\s*\)/gi, "date('now','localtime')")
    // MySQL CAST(x AS UNSIGNED) -> SQLite CAST(x AS INTEGER)
    .replace(/\bAS\s+UNSIGNED\b/gi, 'AS INTEGER')
    // MySQL JSON_OBJECT(...) -> SQLite json_object(...)
    .replace(/\bJSON_OBJECT\s*\(/gi, 'json_object(')
    // Strip MySQL-only collation clauses (no equivalent needed in SQLite;
    // its default TEXT comparison is case-sensitive — see note in Step 4)
    .replace(/\bCOLLATE\s+utf8mb4_0900_ai_ci\b/gi, '');
}

function isSelect(sql) {
  return /^\s*(select|pragma|with)\b/i.test(sql);
}

function mapError(err) {
  if (err && typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    if (err.code.includes('UNIQUE') || err.code.includes('PRIMARYKEY')) {
      err.code = 'ER_DUP_ENTRY';
    }
  }
  return err;
}

function run(sql, params) {
  const rewritten = rewriteSql(sql);
  const values = coerceParams(params);
  try {
    const stmt = sqlite.prepare(rewritten);
    if (isSelect(rewritten)) {
      const rows = stmt.all(...values);
      return [rows, undefined];
    }
    const info = stmt.run(...values);
    return [
      {
        insertId: Number(info.lastInsertRowid),
        affectedRows: info.changes,
        changedRows: info.changes,
      },
      undefined,
    ];
  } catch (err) {
    throw mapError(err);
  }
}

function makeConnection() {
  return {
    query: async (sql, params) => run(sql, params),
    execute: async (sql, params) => run(sql, params),
    beginTransaction: async () => { sqlite.exec('BEGIN'); },
    commit: async () => { sqlite.exec('COMMIT'); },
    rollback: async () => { try { sqlite.exec('ROLLBACK'); } catch (_) {} },
    release: () => {},
    destroy: () => {},
  };
}

const pool = {
  query: async (sql, params) => run(sql, params),
  execute: async (sql, params) => run(sql, params),
  getConnection: async () => makeConnection(),
  end: async () => sqlite.close(),
  _sqlite: sqlite,
};

async function testConnection() {
  try {
    sqlite.prepare('SELECT 1').get();
    console.log('SQLite connected:', DB_PATH);
  } catch (err) {
    console.error('SQLite connection failed:', err.message);
  }
}

module.exports = { pool, testConnection };