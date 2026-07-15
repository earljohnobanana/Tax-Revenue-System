/**
 * server/scheduler/delinquency.cron.js
 *
 * Nightly delinquency check — runs at 7:00 AM PHT (UTC+8) every weekday.
 * Requires: npm install node-cron
 *
 * Register in server/index.js:
 *   const { startDelinquencyCron } = require('./scheduler/delinquency.cron');
 *   startDelinquencyCron(db);
 *
 * The cron job calls runDelinquencyCheck() directly (same core logic as the
 * HTTP /api/delinquent/check endpoint) and fires a notification if overdue
 * accounts are found — no HTTP round-trip, no auth middleware needed.
 */

const cron = require('node-cron');
const { runDelinquencyCheck } = require('../controllers/delinquent.controller');
const { createNotification } = require('../utils/notificationHelper');

/**
 * @param {import('mysql2/promise').Pool} db
 */
function startDelinquencyCron(db) {
  // '0 23 * * 1-5' = 23:00 UTC = 07:00 PHT (UTC+8), Monday–Friday
  cron.schedule('0 23 * * 1-5', async () => {
    const asOfDate = new Date();
    console.log(`[DelinquencyCron] Running scheduled check at ${asOfDate.toISOString()}`);

    try {
      const { delinquentCount, delinquentBusinesses } = await runDelinquencyCheck(db, asOfDate);

      console.log(`[DelinquencyCron] Found ${delinquentCount} delinquent account(s).`);

      if (delinquentCount > 0) {
        const dateLabel = asOfDate.toISOString().split('T')[0];
        const notifMessage = `${delinquentCount} account${delinquentCount !== 1 ? 's are' : ' is'} overdue as of ${dateLabel}`;

        // Fire-and-forget — cron failure must not crash the process
        createNotification(db, {
          type: 'delinquency_detected',
          message: notifMessage,
          targetRoles: ['treasurer', 'administrator', 'super_admin'],
        });

        // Optionally log to audit_logs with a system user ID (adjust ID as needed)
        try {
          await db.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
             VALUES (NULL, 'DELINQUENCY_CHECK_SCHEDULED', 'system', NULL, ?, NOW())`,
            [JSON.stringify({ as_of: dateLabel, delinquent_count: delinquentCount })]
          );
        } catch (auditErr) {
          console.error('[DelinquencyCron] Audit log insert failed:', auditErr.message);
        }
      }
    } catch (err) {
      console.error('[DelinquencyCron] Scheduled check failed:', err.message);
      // Do NOT re-throw — cron must keep running
    }
  });

  console.log('[DelinquencyCron] Scheduled: weekdays at 07:00 PHT');
}

module.exports = { startDelinquencyCron };