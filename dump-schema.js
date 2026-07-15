const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('server/data/revenue.db', { readonly: true });
const rows = db.prepare(
  "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name"
).all();
const out = rows.map(r => r.sql + ';').join('\n\n');
fs.writeFileSync('schema.sql', out);
console.log('Wrote schema.sql with', rows.length, 'objects');