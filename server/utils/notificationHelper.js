/**
 * server/utils/notificationHelper.js
 *
 * Shared fire-and-forget notification utility.
 * NEVER throws. NEVER blocks the calling operation.
 * Caller must NOT await this function.
 *
 * Real schema (from notifications table):
 *   id          INT AUTO_INCREMENT PK
 *   user_id     INT NOT NULL  FK -> users(id)  (users.id is INT)
 *   title       VARCHAR(150)  NOT NULL
 *   message     TEXT          NOT NULL
 *   type        VARCHAR(50)   DEFAULT 'general'
 *   is_read     TINYINT(1)    DEFAULT 0
 *   created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
 *
 * Real schema (from users table):
 *   id    INT AUTO_INCREMENT PK
 *   role  ENUM('Super Admin','Administrator','Treasurer','BPLO Staff','Accounting Staff','Viewer')
 */

const { pool } = require('../config/db');

/**
 * @param {object} opts
 * @param {string} opts.title        - Short title shown in the bell dropdown header
 * @param {string} opts.message      - Full message body
 * @param {string} opts.type         - Notification type key (e.g. 'payment_received')
 * @param {string[]} opts.targetRoles - Role names matching users.role ENUM values
 */
async function createNotification({ title, message, type = 'general', targetRoles }) {
  try {
    if (!title || !message || !Array.isArray(targetRoles) || targetRoles.length === 0) {
      console.error('[NotificationHelper] Invalid arguments — skipping.', { title, type, targetRoles });
      return;
    }

    // Resolve all active user IDs that match the target roles.
    // users.role is an ENUM — values must match exactly (case-sensitive).
    const placeholders = targetRoles.map(() => '?').join(', ');
    const [users] = await pool.query(
      `SELECT id FROM users WHERE role IN (${placeholders}) AND is_active = 1`,
      targetRoles
    );

    if (!users || users.length === 0) return;

    // Bulk INSERT — one row per matching user, single round-trip.
    const rows = users.map((u) => [u.id, title, message, type, 0]);

    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read)
       VALUES ?`,
      [rows]
    );
  } catch (err) {
    // Log only — never re-throw. The caller's operation must not be affected.
    console.error('[NotificationHelper] Failed to insert notification:', err.message, { title, type, targetRoles });
  }
}

module.exports = { createNotification };