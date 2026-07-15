// server/scripts/reset-data.js
// Clears mock/transactional data while PRESERVING users, municipality_settings,
// and regulatory_fees. Dry-run by default; pass --confirm to actually delete.
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH =
  process.env.SQLITE_DB_PATH ||
  path.join(__dirname, '..', 'data', 'revenue.db');

const CONFIRM = process.argv.includes('--confirm');

const WIPE = ['notifications', 'audit_logs', 'payments', 'assessments', 'businesses', 'owners'];
const KEEP = ['users', 'municipality_settings', 'regulatory_fees'];
const RESET_SEQ = ['notifications', 'audit_logs'];

if (!fs.existsSync(DB_PATH)) {
  console.error('Database not found at:', DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const countOf = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;

console.log('Target DB:', DB_PATH);
console.log('\nCurrent row counts:');
[...WIPE, ...KEEP].forEach((t) => {
  const tag = WIPE.includes(t) ? 'DELETE' : 'KEEP  ';
  console.log(`  [${tag}] ${t.padEnd(22)} ${countOf(t)}`);
});

if (!CONFIRM) {
  console.log('\nDRY RUN — nothing deleted. Re-run with --confirm to proceed.');
  db.close();
  process.exit(0);
}

const wipeAll = db.transaction(() => {
  for (const t of WIPE) db.prepare(`DELETE FROM ${t}`).run();
  const seq = db.prepare('DELETE FROM sqlite_sequence WHERE name = ?');
  for (const t of RESET_SEQ) seq.run(t);
});

wipeAll();
db.pragma('wal_checkpoint(TRUNCATE)');
db.exec('VACUUM');

console.log('\nDone. Post-reset counts:');
[...WIPE, ...KEEP].forEach((t) => console.log(`  ${t.padEnd(22)} ${countOf(t)}`));
console.log('\nPreserved logins:');
db.prepare('SELECT id, username, role, is_active FROM users ORDER BY id')
  .all()
  .forEach((u) => console.log(`  #${u.id} ${u.username} (${u.role}) active=${u.is_active}`));

db.close();
