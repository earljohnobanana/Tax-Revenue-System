/**
 * server/controllers/delinquent.controller.js
 *
 * Delinquency detection using the REAL schema:
 *   - paid_amount = SUM(payments.base_tax) per (business_id, tax_type, assessment_year)
 *     with deleted_at IS NULL filter
 *   - assessments.status ENUM: 'Unpaid','Paid','Overdue','Cancelled'
 *   - businesses.name (not business_name)
 *   - audit_logs: (user_id INT, action, module, details JSON)
 *   - pool imported directly from config/db
 *   - error handling: next(err) pattern
 *
 * CRITICAL FIX: listDelinquent's response shape now matches what
 * DelinquentPage.jsx / useDelinquentAccounts.js actually expect —
 * { delinquentAccounts: [...], summary: { count, totalBaseTaxDue,
 * totalWithInterest, interestRate } } — not the original { data,
 * pagination } shape, which left frontend `summary` as undefined and
 * crashed the whole page on every `summary.x` read (Uncaught TypeError:
 * Cannot read properties of undefined (reading 'count')). Each
 * delinquent row's field names are also aligned to what the table
 * actually renders: businessName, ownerName, contact, address, taxType,
 * dueDate, daysOverdue, amountDue, interest, totalDue, ownerId,
 * businessId, assessmentId — not the original snake/camel mix from the
 * core scan function.
 *
 * Due date rules (Sta. Catalina Revenue Code):
 *   Quarterly: Jan 20, Apr 20, Jul 20, Oct 20
 *   Saturday → +2 (Monday), Sunday → +1 (Monday)
 *   25% flat surcharge on overdue principal
 */

const { pool } = require('../config/db');
const { createNotification } = require('../utils/notificationHelper');

const INTEREST_RATE = 0.25;

// ── due date helpers ──────────────────────────────────────────────────────────

const QUARTERLY_DUE_DATES = [
  { month: 0, day: 20 },   // Jan 20
  { month: 3, day: 20 },   // Apr 20
  { month: 6, day: 20 },   // Jul 20
  { month: 9, day: 20 },   // Oct 20
];

function computeDueDate(year, quarterIndex) {
  const { month, day } = QUARTERLY_DUE_DATES[quarterIndex];
  const d   = new Date(Date.UTC(year, month, day));
  const dow = d.getUTCDay();
  if (dow === 6) d.setUTCDate(d.getUTCDate() + 2); // Saturday → Monday
  if (dow === 0) d.setUTCDate(d.getUTCDate() + 1); // Sunday  → Monday
  return d;
}

function getPassedDueDates(assessmentYear, asOfDate) {
  const passed = [];
  for (let q = 0; q < 4; q++) {
    const due = computeDueDate(assessmentYear, q);
    if (due < asOfDate) passed.push({ quarter: q + 1, dueDate: due });
  }
  return passed;
}

function daysBetween(earlier, later) {
  const ms = later.getTime() - earlier.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

// ── core logic (called from HTTP handler and optionally from cron) ─────────────

/**
 * @param {Date} [asOfDate=new Date()]
 * @returns {Promise<{ delinquentCount: number, delinquentBusinesses: object[] }>}
 */
async function runDelinquencyCheck(asOfDate = new Date()) {
  const currentYear = asOfDate.getFullYear();

const [assessments] = await pool.query(
    `SELECT * FROM (
      SELECT
        a.id AS assessment_id,
        a.business_id,
        b.name AS business_name,
        b.address AS business_address,
        o.name AS owner_name,
        o.contact AS owner_contact,
        o.id AS owner_id,
        a.tax_type,
        a.assessment_year,
        a.payment_frequency,
        a.assessment_amount,
        COALESCE((
          SELECT SUM(p.base_tax)
          FROM payments p
          WHERE p.business_id = a.business_id
            AND p.tax_type = a.tax_type
            AND p.assessment_year = a.assessment_year
            AND p.deleted_at IS NULL
        ), 0) AS total_paid
      FROM assessments a
      JOIN businesses b ON b.id = a.business_id
      JOIN owners o ON o.id = a.owner_id
      WHERE a.assessment_year = ?
        AND a.status NOT IN ('Cancelled', 'Paid')
    )
    WHERE total_paid < assessment_amount`,
    [currentYear]
  );

  const passedDueDates = getPassedDueDates(currentYear, asOfDate);

  if (passedDueDates.length === 0) {
    return { delinquentCount: 0, delinquentBusinesses: [] };
  }

  const delinquentBusinesses = [];
  const lastDueDate = passedDueDates[passedDueDates.length - 1].dueDate;

  for (const a of assessments) {
    const totalPaid = parseFloat(a.total_paid);
    const totalDue  = parseFloat(a.assessment_amount);

    const installmentAmount = totalDue / 4;
    const expectedPaidByNow = passedDueDates.length * installmentAmount;
    const overdueAmount = Math.max(0, expectedPaidByNow - totalPaid);

    if (overdueAmount <= 0.009) continue; // not overdue (float tolerance)

    const interest = parseFloat((overdueAmount * INTEREST_RATE).toFixed(2));
    const totalWithInterest = parseFloat((overdueAmount + interest).toFixed(2));

    delinquentBusinesses.push({
      assessmentId:    a.assessment_id,
      businessId:      a.business_id,
      businessName:    a.business_name,
      ownerId:         a.owner_id,
      ownerName:       a.owner_name,
      contact:         a.owner_contact,
      address:         a.business_address,
      taxType:         a.tax_type,
      dueDate:         lastDueDate.toISOString().split('T')[0],
      daysOverdue:     daysBetween(lastDueDate, asOfDate),
      amountDue:       parseFloat(overdueAmount.toFixed(2)),
      interest,
      totalDue:        totalWithInterest,
      assessmentYear:  a.assessment_year,
      paymentFrequency: a.payment_frequency,
      overdueQuarters: passedDueDates.length,
    });
  }

  return { delinquentCount: delinquentBusinesses.length, delinquentBusinesses };
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

/**
 * GET /api/delinquent/check
 * On-demand scan. Fires notification if overdue accounts found.
 */
async function checkDelinquency(req, res, next) {
  try {
    const asOfDate = req.query.as_of ? new Date(req.query.as_of) : new Date();

    if (isNaN(asOfDate.getTime())) {
      return res.status(400).json({ message: 'Invalid as_of date parameter.' });
    }

    const { delinquentCount, delinquentBusinesses } = await runDelinquencyCheck(asOfDate);

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, details)
       VALUES (?, 'DELINQUENCY_CHECK', 'DELINQUENT',
         JSON_OBJECT('as_of', ?, 'delinquent_count', ?))`,
      [req.user.id, asOfDate.toISOString().split('T')[0], delinquentCount]
    );

    if (delinquentCount > 0) {
      const dateLabel = asOfDate.toISOString().split('T')[0];
      createNotification({
        title: 'Delinquent Accounts Detected',
        message: `${delinquentCount} account${delinquentCount !== 1 ? 's are' : ' is'} overdue as of ${dateLabel}`,
        type: 'delinquency_detected',
        targetRoles: ['Treasurer', 'Administrator', 'Super Admin'],
      });
    }

    return res.json({
      as_of: asOfDate.toISOString().split('T')[0],
      delinquent_count: delinquentCount,
      data: delinquentBusinesses,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/delinquent
 * Returns the shape DelinquentPage.jsx actually expects:
 *   { delinquentAccounts: [...], summary: { count, totalBaseTaxDue, totalWithInterest, interestRate } }
 */
async function listDelinquent(req, res, next) {
  try {
    const { tax_type } = req.query;
    const asOfDate = new Date();

    const { delinquentBusinesses } = await runDelinquencyCheck(asOfDate);

    const delinquentAccounts = tax_type
      ? delinquentBusinesses.filter((d) => d.taxType === tax_type)
      : delinquentBusinesses;

    const summary = {
      count: delinquentAccounts.length,
      totalBaseTaxDue: parseFloat(
        delinquentAccounts.reduce((sum, d) => sum + d.amountDue, 0).toFixed(2)
      ),
      totalWithInterest: parseFloat(
        delinquentAccounts.reduce((sum, d) => sum + d.totalDue, 0).toFixed(2)
      ),
      interestRate: INTEREST_RATE,
    };

    return res.json({ delinquentAccounts, summary });
  } catch (err) {
    next(err);
  }
}

module.exports = { checkDelinquency, listDelinquent, runDelinquencyCheck };