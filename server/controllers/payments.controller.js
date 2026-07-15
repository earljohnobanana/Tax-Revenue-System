/**
 * server/controllers/payments.controller.js
 *
 * CRITICAL FIX: recordPayment was rewritten to accept the REAL request
 * contract the frontend actually sends — a BATCH submission, not a
 * single flat payment:
 *
 *   POST /api/payments
 *   { ownerId, datePaid, items: [
 *       { businessId, taxType, paymentCategory, periodCovered, baseTax,
 *         interest, penalty, regulatoryFees, totalPaid, paymentMethod,
 *         orNumber, feeDetails },
 *       ... one entry per Business Tax / Mayor's Permit / Regulatory
 *       Fees line item the staff checked in the Record Payment modal ...
 *   ]}
 *
 * The previous version expected a flat single-item body (businessId,
 * taxType, baseTax directly on req.body) — a shape that was guessed,
 * never verified against OwnersPage.jsx's actual handleRecordPayment/
 * PaymentModal code. Every real submission from the UI hit the
 * validation guard and failed with "ownerId, businessId, datePaid,
 * taxType, and paymentCategory are required." even though the request
 * DID contain ownerId/datePaid — just nested inside an items array the
 * old code never looked at.
 *
 * Per this project's own documented learning ("OR number generation:
 * Sequential per calendar year; ONE SHARED OR NUMBER per batch
 * submission"), this batch correctly generates exactly ONE or_number
 * for the whole submission and reuses it across every inserted payment
 * row — matching how the Print Receipt logic (PaymentsPage.jsx/
 * ReceiptsPage.jsx handlePrint) already groups rows by shared orNumber.
 * Each items[] entry may optionally override with its own orNumber
 * (e.g. the modal's "BT OR Number" / "MP OR Number" fields) — if every
 * item explicitly supplies the same value, that's honored instead of
 * generating a new one.
 *
 * MAYOR'S PERMIT — ONE-TIME-PER-YEAR RULE (added):
 * Unlike Business Tax, Mayor's Permit is NOT computed from an ordinance
 * formula and does NOT go through the assessment engine — the amount is
 * manually entered by staff, per explicit decision. It also does not
 * accrue interest and does not follow the quarterly/biannual installment
 * split. The one rule that DOES apply: a business may only be charged
 * Mayor's Permit ONCE per tax year, whether that payment is submitted
 * standalone or bundled alongside a Business Tax installment (FULL,
 * any quarter, or any half — whichever happens to be the business's
 * first payment of the year). Once paid, it must not be payable again
 * for that business+year on any later installment.
 *
 * This is enforced HERE, not just in the UI, because the UI's "already
 * paid" disabled-checkbox state can be bypassed by a stale form, a
 * retried request, or a direct API call — this check is what actually
 * protects the data. See the pre-check block near the top of
 * recordPayment() below.
 *
 * Real payments schema:
 *   id, owner_id, business_id, date_paid, or_number, tax_type,
 *   payment_category, period_covered, assessment_year, base_tax,
 *   interest, penalty, regulatory_fees, total_paid, processed_by,
 *   payment_method, installment_no, payment_type, drawee_bank,
 *   instrument_number, instrument_date, fee_details, remarks,
 *   created_at, deleted_at, deleted_by
 *
 * listPayments/getPayment return camelCase-mapped rows via
 * mapPaymentRow() — see that function for why this matters (a separate
 * bug fixed earlier in this same session: OwnerProfile's payment
 * filters read p.ownerId/p.totalPaid/p.taxType, which were undefined
 * on every row when the API returned raw snake_case columns).
 */

const { pool } = require('../config/db');
const { createNotification } = require('../utils/notificationHelper');

// ── helpers ──────────────────────────────────────────────────────────────────

function formatPhp(amount) {
  return `PHP ${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Maps a raw payments row (snake_case, as returned by SELECT p.*) into
 * the camelCase shape every frontend consumer expects.
 */
function mapPaymentRow(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    businessId: row.business_id,
    datePaid: row.date_paid,
    orNumber: row.or_number,
    taxType: row.tax_type,
    paymentCategory: row.payment_category,
    periodCovered: row.period_covered,
    assessmentYear: row.assessment_year,
    baseTax: Number(row.base_tax || 0),
    interest: Number(row.interest || 0),
    penalty: Number(row.penalty || 0),
    regulatoryFees: Number(row.regulatory_fees || 0),
    totalPaid: Number(row.total_paid || 0),
    processedBy: row.processed_by,
    paymentMethod: row.payment_method,
    installmentNo: row.installment_no,
    paymentType: row.payment_type,
    draweeBank: row.drawee_bank,
    instrumentNumber: row.instrument_number,
    instrumentDate: row.instrument_date,
    feeDetails: row.fee_details,
    remarks: row.remarks,
    createdAt: row.created_at,
    businessName: row.business_name,
    ownerName: row.owner_name,
  };
}

/**
 * Generate next OR number: OR-YYYY-NNNNNN (sequential per calendar year).
 */
async function generateOrNumber(conn) {
  const year = new Date().getFullYear();
  const prefix = `OR-${year}-`;

  const [[row]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(or_number, 9) AS UNSIGNED)), 0) AS last_seq
     FROM payments
     WHERE or_number LIKE ?`,
    [`${prefix}%`]
  );

  const nextSeq = (Number(row.last_seq) + 1).toString().padStart(6, '0');

  if (nextSeq.length > 6) {
    throw new Error('OR number sequence overflow — manual intervention required.');
  }

  return `${prefix}${nextSeq}`;
}

/**
 * Generate next payment ID: PAY-YYYY-NNNNNN (sequential per year, 6-digit pad).
 * Called once per item in the batch — each line item gets its own row/id,
 * even though they may share one OR number.
 */
async function generatePaymentId(conn) {
  const year = new Date().getFullYear();
  const prefix = `PAY-${year}-`;

  const [[row]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id, 10) AS UNSIGNED)), 0) AS last_seq
     FROM payments
     WHERE id LIKE ?`,
    [`${prefix}%`]
  );

  const maxNum = Number(row.last_seq);

  if (maxNum >= 999999) {
    throw new Error(
      `Payment ID sequence has reached its 6-digit limit (current max: ${maxNum}). ` +
      `Check for a malformed id before continuing.`
    );
  }

  return `${prefix}${String(maxNum + 1).padStart(6, '0')}`;
}

/**
 * Resolves the tax year a Mayor's Permit item should be checked/stored
 * against. Prefers an explicit assessmentYear from the request; falls
 * back to the year of the batch's datePaid if not supplied (keeps this
 * working even before the frontend is updated to send it explicitly).
 */
function resolveMayorsPermitYear(item, datePaid) {
  if (item.assessmentYear) return Number(item.assessmentYear);
  const d = new Date(datePaid);
  return Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
}

// ── controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/payments
 * Records a BATCH of payment line items for one owner, sharing one OR
 * number across the whole submission (unless every item explicitly
 * supplies its own matching orNumber override).
 */
async function recordPayment(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { ownerId, datePaid, items, processedBy: processedByOverride } = req.body;

    // ── validation ──
    if (!ownerId || !datePaid || !Array.isArray(items) || items.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        message: 'ownerId, datePaid, and at least one item are required.',
      });
    }

    for (const item of items) {
      if (!item.businessId || !item.taxType || !item.paymentCategory) {
        await conn.rollback();
        return res.status(400).json({
          message: 'Each item requires businessId, taxType, and paymentCategory.',
        });
      }
    }

    // ── Mayor's Permit: at most one per business per tax year, ever ──
    // Applies regardless of whether it's submitted standalone or bundled
    // with a Business Tax installment, and regardless of which period
    // (FULL/Q1-Q4/H1-H2) that installment happens to be. See file header.
    const mpItems = items.filter((item) => item.taxType === "Mayor's Permit");

    if (mpItems.length > 0) {
      const seenInThisBatch = new Set();

      for (const item of mpItems) {
        const mpYear = resolveMayorsPermitYear(item, datePaid);
        const batchKey = `${item.businessId}:${mpYear}`;

        if (seenInThisBatch.has(batchKey)) {
          await conn.rollback();
          return res.status(422).json({
            message:
              `This submission includes two Mayor's Permit entries for the same ` +
              `business and year (${mpYear}). Only one is allowed.`,
          });
        }
        seenInThisBatch.add(batchKey);

        const [[existingMp]] = await conn.query(
          `SELECT id, or_number, date_paid
           FROM payments
           WHERE business_id = ?
             AND tax_type = ?
             AND deleted_at IS NULL
             AND COALESCE(assessment_year, YEAR(date_paid)) = ?`,
          [item.businessId, item.taxType, mpYear]
        );

        if (existingMp) {
          await conn.rollback();
          return res.status(422).json({
            message:
              `Mayor's Permit for ${mpYear} has already been paid for this business ` +
              `(OR#${existingMp.or_number}, ${existingMp.date_paid}). It can only be paid once per year.`,
          });
        }
      }
    }

    // ── verify owner exists ──
    const [[owner]] = await conn.query(
      `SELECT id, name FROM owners WHERE id = ?`,
      [ownerId]
    );

    if (!owner) {
      await conn.rollback();
      return res.status(404).json({ message: 'Owner not found.' });
    }

    // ── generate ONE shared OR number for the whole batch, unless every
    //    item already supplies the same explicit override ──
    const explicitOrNumbers = items.map((i) => i.orNumber).filter(Boolean);
    const allSameExplicit =
      explicitOrNumbers.length === items.length &&
      explicitOrNumbers.every((n) => n === explicitOrNumbers[0]);

    const sharedOrNumber = allSameExplicit
      ? explicitOrNumbers[0]
      : await generateOrNumber(conn);

    const processedBy = processedByOverride || req.user?.name || null;
    const savedPayments = [];
    const businessNamesSeen = new Set();
    let grandTotal = 0;

    for (const item of items) {
      const baseTax        = Number(item.baseTax        || 0);
      const interest        = Number(item.interest        || 0);
      const penalty          = Number(item.penalty          || 0);
      const regulatoryFees   = Number(item.regulatoryFees   || 0);
      const totalPaid =
        item.totalPaid != null
          ? Number(item.totalPaid)
          : Math.round((baseTax + interest + penalty + regulatoryFees) * 100) / 100;

      if (totalPaid <= 0) continue; // skip zero-amount line items silently

      // ── verify business exists ──
      const [[business]] = await conn.query(
        `SELECT b.id, b.name, b.owner_id
         FROM businesses b
         WHERE b.id = ?`,
        [item.businessId]
      );

      if (!business) {
        await conn.rollback();
        return res.status(404).json({ message: `Business not found: ${item.businessId}` });
      }

      businessNamesSeen.add(business.name);

      const id = await generatePaymentId(conn);
      // Per-item OR number override (e.g. modal's separate BT/MP OR fields)
      // takes priority over the shared batch OR number, when supplied.
      const or_number = item.orNumber || sharedOrNumber;

      // Mayor's Permit always gets a real assessment_year stored — even
      // though it has no assessment record — so the one-per-year check
      // above (and any future reporting) has a reliable column to key
      // off of instead of relying on parsing period_covered or date_paid.
      const assessmentYearToStore =
        item.taxType === "Mayor's Permit"
          ? resolveMayorsPermitYear(item, datePaid)
          : (item.assessmentYear ? Number(item.assessmentYear) : null);

      await conn.query(
        `INSERT INTO payments
           (id, owner_id, business_id, date_paid, or_number, tax_type,
            payment_category, period_covered, assessment_year, base_tax,
            interest, penalty, regulatory_fees, total_paid, processed_by,
            payment_method, installment_no, payment_type, drawee_bank,
            instrument_number, instrument_date, fee_details, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ownerId,
          item.businessId,
          datePaid,
          or_number,
          item.taxType,
          item.paymentCategory,
          item.periodCovered  || null,
          assessmentYearToStore,
          baseTax,
          interest,
          penalty,
          regulatoryFees,
          totalPaid,
          processedBy,
          item.paymentMethod  || null,
          item.installmentNo  ? Number(item.installmentNo) : null,
          item.paymentType    || 'Cash',
          item.draweeBank     || null,
          item.instrumentNumber || null,
          item.instrumentDate || null,
          item.feeDetails     || null,
          item.remarks        || null,
        ]
      );

      // ── sync assessment status if assessmentYear + taxType provided ──
      // (Mayor's Permit has no assessment record, so this naturally
      // no-ops for it — the UPDATE simply matches zero rows.)
      if (item.assessmentYear && item.taxType) {
        await conn.query(
          `UPDATE assessments
           SET status = CASE
             WHEN assessment_amount <= (
               SELECT COALESCE(SUM(p.base_tax), 0)
               FROM payments p
               WHERE p.business_id = assessments.business_id
                 AND p.tax_type = assessments.tax_type
                 AND p.assessment_year = assessments.assessment_year
                 AND p.deleted_at IS NULL
             ) THEN 'Paid'
             ELSE status
           END
           WHERE business_id = ?
             AND tax_type = ?
             AND assessment_year = ?
             AND status NOT IN ('Cancelled')`,
          [item.businessId, item.taxType, Number(item.assessmentYear)]
        );
      }

      grandTotal += totalPaid;

      savedPayments.push({
        id,
        ownerId,
        businessId: item.businessId,
        businessName: business.name,
        ownerName: owner.name,
        datePaid,
        orNumber: or_number,
        taxType: item.taxType,
        paymentCategory: item.paymentCategory,
        periodCovered: item.periodCovered || null,
        assessmentYear: assessmentYearToStore,
        baseTax,
        interest,
        penalty,
        regulatoryFees,
        totalPaid,
        processedBy,
        paymentMethod: item.paymentMethod || null,
        feeDetails: item.feeDetails || null,
      });
    }

    if (savedPayments.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'No payment amounts greater than zero were submitted.' });
    }

    // ── one audit log entry for the whole batch ──
    await conn.query(
      `INSERT INTO audit_logs (user_id, action, module, details)
       VALUES (?, 'RECORD_PAYMENT', 'PAYMENTS',
         JSON_OBJECT(
           'or_number', ?,
           'owner_id', ?,
           'item_count', ?,
           'grand_total', ?
         ))`,
      [req.user.id, sharedOrNumber, ownerId, savedPayments.length, grandTotal]
    );

    await conn.commit();

    // ── fire-and-forget notification (after commit, one per batch) ──
    const businessLabel =
      businessNamesSeen.size === 1
        ? [...businessNamesSeen][0]
        : `${businessNamesSeen.size} businesses`;

    createNotification({
      title: 'Payment Received',
      message: `Payment received: ${owner.name} (${businessLabel}) - OR#${sharedOrNumber} - ${formatPhp(grandTotal)}`,
      type: 'payment_received',
      targetRoles: ['Treasurer', 'Administrator', 'Super Admin'],
    });

    return res.status(201).json({
      orNumber: sharedOrNumber,
      grandTotal,
      payments: savedPayments,
      message: `Payment recorded. OR#${sharedOrNumber}`,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

/**
 * DELETE /api/payments/:id
 * Soft-delete a payment. Restricted to Administrator/Super Admin.
 */
async function deletePayment(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;

    const [[payment]] = await conn.query(
      `SELECT p.id, p.or_number, p.total_paid, p.tax_type, p.assessment_year,
              b.name AS business_name, p.business_id
       FROM payments p
       JOIN businesses b ON b.id = p.business_id
       WHERE p.id = ? AND p.deleted_at IS NULL`,
      [id]
    );

    if (!payment) {
      await conn.rollback();
      return res.status(404).json({ message: 'Payment not found or already deleted.' });
    }

    await conn.query(
      `UPDATE payments SET deleted_at = NOW(), deleted_by = ? WHERE id = ?`,
      [String(req.user.id), id]
    );

    if (payment.assessment_year && payment.tax_type) {
      await conn.query(
        `UPDATE assessments
         SET status = CASE
           WHEN status = 'Paid' THEN 'Unpaid'
           ELSE status
         END
         WHERE business_id = ?
           AND tax_type = ?
           AND assessment_year = ?
           AND status NOT IN ('Cancelled')`,
        [payment.business_id, payment.tax_type, payment.assessment_year]
      );
    }

    await conn.query(
      `INSERT INTO audit_logs (user_id, action, module, details)
       VALUES (?, 'DELETE_PAYMENT', 'PAYMENTS',
         JSON_OBJECT('payment_id', ?, 'or_number', ?, 'total_paid', ?))`,
      [req.user.id, id, payment.or_number, payment.total_paid]
    );

    await conn.commit();

    createNotification({
      title: 'Payment Deleted',
      message: `Payment deleted: OR#${payment.or_number} (${payment.business_name}) - ${formatPhp(payment.total_paid)}`,
      type: 'payment_deleted',
      targetRoles: ['Administrator', 'Super Admin'],
    });

    return res.status(200).json({ message: `Payment OR#${payment.or_number} deleted.` });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

/**
 * GET /api/payments
 */
async function listPayments(req, res, next) {
  try {
    const { business_id, owner_id, tax_type, assessment_year, page = 1, limit = 20 } = req.query;

    const conditions = ['p.deleted_at IS NULL'];
    const params = [];

    if (business_id)     { conditions.push('p.business_id = ?');     params.push(business_id); }
    if (owner_id)        { conditions.push('p.owner_id = ?');         params.push(owner_id); }
    if (tax_type)        { conditions.push('p.tax_type = ?');         params.push(tax_type); }
    if (assessment_year) { conditions.push('p.assessment_year = ?');  params.push(Number(assessment_year)); }

    const where  = `WHERE ${conditions.join(' AND ')}`;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM payments p ${where}`, params
    );

    const [rows] = await pool.query(
      `SELECT p.*, b.name AS business_name, o.name AS owner_name
       FROM payments p
       JOIN businesses b ON b.id = p.business_id
       JOIN owners o ON o.id = p.owner_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    return res.json({
      payments: rows.map(mapPaymentRow),
      pagination: {
        total: parseInt(total),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(parseInt(total) / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/payments/:id
 */
async function getPayment(req, res, next) {
  try {
    const [[payment]] = await pool.query(
      `SELECT p.*, b.name AS business_name, o.name AS owner_name
       FROM payments p
       JOIN businesses b ON b.id = p.business_id
       JOIN owners o ON o.id = p.owner_id
       WHERE p.id = ? AND p.deleted_at IS NULL`,
      [req.params.id]
    );

    if (!payment) return res.status(404).json({ message: 'Payment not found.' });

    return res.json({ payment: mapPaymentRow(payment) });
  } catch (err) {
    next(err);
  }
}

module.exports = { recordPayment, deletePayment, listPayments, getPayment };