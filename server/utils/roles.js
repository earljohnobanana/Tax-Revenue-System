// server/utils/roles.js
// Must match users.role ENUM in schema.sql exactly — a mismatch here means
// createUser/updateUser would silently accept a role string that no
// requireRole(...) check anywhere in the app recognizes, locking that user
// out of every protected route with a 403 and no obvious cause.

const VALID_ROLES = [
  "Super Admin",
  "Administrator",
  "Treasurer",
  "BPLO Staff",
  "Accounting Staff",
  "Viewer",
];

module.exports = { VALID_ROLES };