/**
 * server/controllers/assessments.controller.js
 *
 * Adds cancelAssessment (new) and wires notification write-side.
 * All existing functions (getAssessments, getPayableAssessmentsForOwner,
 * previewComputeTax, createAssessment, updateAssessment, deleteAssessment)
 * are preserved exactly as they were — only the notification call is added
 * to createAssessment, and cancelAssessment is added as a new export.
 *
 * Real assessments schema:
 *   id varchar(20), business_id, owner_id, assessment_year, tax_type,
 *   payment_frequency, capital_investment, gross_sales, assessment_amount,
 *   status ENUM('Unpaid','Paid','Overdue','Cancelled'), due_date, remarks,
 *   generated_by, created_at, updated_at,
 *   cancelled_by, cancelled_at, cancel_reason  ← added by migration 004
 *
 * audit_logs: (user_id INT, action, module, details JSON)
 */

const { pool } = require('../config/db');
const { computeTax } = require('../utils/taxComputation');
const { createNotification } = require('../utils/notificationHelper');

function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function computeDisplayStatus(row) {
  const savedStatus = row.status || 'Unpaid';
  if (savedStatus === 'Cancelled') return 'Cancelled';

  const assessmentAmount = Number(row.assessment_amount || 0);
  const paidAmount       = Number(row.paid_amount || 0);
  const dueDate          = toDateOnly(row.due_date);
  const today            = new Date().toISOString().slice(0, 10);

  if (assessmentAmount > 0 && paidAmount >= assessmentAmount) return 'Paid';
  if (dueDate && today > dueDate) return 'Overdue';
  return 'Unpaid';
}

function mapAssessment(row) {
  const assessmentAmount = Number(row.assessment_amount || 0);
  const paidAmount       = Number(row.paid_amount || 0);
  const balanceAmount    = Math.max(assessmentAmount - paidAmount, 0);

  return {
    id: row.id,
    businessId: row.business_id,
    ownerId: row.owner_id,
    businessName: row.business_name,
    ownerName: row.owner_name,
    year: Number(row.assessment_year),
    taxType: row.tax_type,
    paymentFrequency: row.payment_frequency,
    capitalInvestment: Number(row.capital_investment || 0),
    grossSales: Number(row.gross_sales || 0),
    assessmentAmount,
    paidAmount,
    balanceAmount,
    status: computeDisplayStatus(row),
    dueDate: toDateOnly(row.due_date),
    remarks: row.remarks,
    generatedBy: row.generated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const FREQUENCY_TO_METHOD = {
  Annual: 'FULL PAYMENT',
  Quarterly: 'QUARTERLY',
  'Semi-Annual': 'BIANNUAL',
};

function computeNextInstallment(frequency, assessmentAmount, paidAmount) {
  const method = FREQUENCY_TO_METHOD[frequency];
  const amount = Number(assessmentAmount);
  const paid   = Number(paidAmount);

  if (method === 'FULL PAYMENT') {
    if (paid >= amount - 0.01) return null;
    return { method, periodNo: null, periodLabel: 'Full Year', amount: round2(amount) };
  }

  if (method === 'QUARTERLY') {
    const base    = round2(amount / 4);
    const amounts = [base, base, base, round2(amount - base * 3)];
    let cumulative = 0;
    for (let i = 0; i < 4; i++) {
      cumulative = round2(cumulative + amounts[i]);
      if (paid < cumulative - 0.01) {
        return { method, periodNo: i + 1, periodLabel: `Q${i + 1}`, amount: amounts[i] };
      }
    }
    return null;
  }

  if (method === 'BIANNUAL') {
    const base    = round2(amount / 2);
    const amounts = [base, round2(amount - base)];
    let cumulative = 0;
    for (let i = 0; i < 2; i++) {
      cumulative = round2(cumulative + amounts[i]);
      if (paid < cumulative - 0.01) {
        return { method, periodNo: i + 1, periodLabel: `H${i + 1}`, amount: amounts[i] };
      }
    }
    return null;
  }

  return null;
}

// ── existing functions (unchanged) ───────────────────────────────────────────

async function getAssessments(req, res, next) {
  try {
    const { year, businessId, ownerId } = req.query;

    let sql = `
      SELECT
        a.*,
        b.name AS business_name,
        o.name AS owner_name,
        COALESCE((
          SELECT SUM(p.base_tax)
          FROM payments p
          WHERE p.business_id = a.business_id
            AND p.tax_type COLLATE utf8mb4_0900_ai_ci = a.tax_type COLLATE utf8mb4_0900_ai_ci
            AND p.assessment_year = a.assessment_year
            AND p.deleted_at IS NULL
        ), 0) AS paid_amount
      FROM assessments a
      JOIN businesses b ON b.id = a.business_id
      JOIN owners o ON o.id = a.owner_id
    `;

    const where  = [];
    const params = [];

    if (year !== undefined && year !== null && year !== '') {
  const parsedYear = Number(year);
  if (!Number.isFinite(parsedYear)) {
    return res.status(400).json({ message: `Invalid year filter: "${year}"` });
  }
  where.push('a.assessment_year = ?');
  params.push(parsedYear);
}
    if (businessId) { where.push('a.business_id = ?');     params.push(businessId); }
    if (ownerId)    { where.push('a.owner_id = ?');        params.push(ownerId); }

    if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ' ORDER BY a.assessment_year DESC, a.created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ assessments: rows.map(mapAssessment) });
  } catch (err) {
    next(err);
  }
}

async function getPayableAssessmentsForOwner(req, res, next) {
  try {
    const { ownerId } = req.query;
    if (!ownerId) return res.status(400).json({ message: 'ownerId is required' });

    const [rows] = await pool.query(
      `
      SELECT
        a.*,
        b.name AS business_name,
        b.status AS business_status,
        o.name AS owner_name,
        COALESCE((
          SELECT SUM(p.base_tax)
          FROM payments p
          WHERE p.business_id = a.business_id
            AND p.tax_type COLLATE utf8mb4_0900_ai_ci = a.tax_type COLLATE utf8mb4_0900_ai_ci
            AND p.assessment_year = a.assessment_year
            AND p.deleted_at IS NULL
        ), 0) AS paid_amount,
        (
          SELECT COUNT(*) FROM assessments a3
          WHERE a3.business_id = a.business_id
            AND a3.tax_type = a.tax_type
            AND a3.status NOT IN ('Paid', 'Cancelled')
            AND a3.assessment_amount > COALESCE((
              SELECT SUM(p3.base_tax) FROM payments p3
              WHERE p3.business_id = a3.business_id
                AND p3.tax_type COLLATE utf8mb4_0900_ai_ci = a3.tax_type COLLATE utf8mb4_0900_ai_ci
                AND p3.assessment_year = a3.assessment_year
                AND p3.deleted_at IS NULL
            ), 0)
        ) AS outstanding_count
      FROM assessments a
      JOIN businesses b ON b.id = a.business_id
      JOIN owners o ON o.id = a.owner_id
      WHERE a.owner_id = ?
        AND a.status NOT IN ('Paid', 'Cancelled')
        AND a.assessment_amount > COALESCE((
          SELECT SUM(p4.base_tax) FROM payments p4
          WHERE p4.business_id = a.business_id
            AND p4.tax_type COLLATE utf8mb4_0900_ai_ci = a.tax_type COLLATE utf8mb4_0900_ai_ci
            AND p4.assessment_year = a.assessment_year
            AND p4.deleted_at IS NULL
        ), 0)
        AND a.id = (
          SELECT a2.id FROM assessments a2
          WHERE a2.business_id = a.business_id
            AND a2.tax_type = a.tax_type
            AND a2.status NOT IN ('Paid', 'Cancelled')
            AND a2.assessment_amount > COALESCE((
              SELECT SUM(p5.base_tax) FROM payments p5
              WHERE p5.business_id = a2.business_id
                AND p5.tax_type COLLATE utf8mb4_0900_ai_ci = a2.tax_type COLLATE utf8mb4_0900_ai_ci
                AND p5.assessment_year = a2.assessment_year
                AND p5.deleted_at IS NULL
            ), 0)
          ORDER BY a2.assessment_year ASC, a2.created_at ASC
          LIMIT 1
        )
      ORDER BY a.business_id, a.tax_type
      `,
      [ownerId]
    );

    const assessments = rows.map((row) => {
      const assessmentAmount = Number(row.assessment_amount || 0);
      const paidAmount       = Number(row.paid_amount || 0);
      const balanceAmount    = Math.max(round2(assessmentAmount - paidAmount), 0);
      const nextInstallment  = computeNextInstallment(row.payment_frequency, assessmentAmount, paidAmount);

      return {
        id: row.id,
        businessId: row.business_id,
        ownerId: row.owner_id,
        businessName: row.business_name,
        businessStatus: row.business_status,
        ownerName: row.owner_name,
        year: Number(row.assessment_year),
        taxType: row.tax_type,
        paymentFrequency: row.payment_frequency,
        paymentMethod: FREQUENCY_TO_METHOD[row.payment_frequency] || 'FULL PAYMENT',
        assessmentAmount,
        paidAmount,
        balanceAmount,
        status: row.status,
        dueDate: toDateOnly(row.due_date),
        nextInstallment,
        outstandingCount: Number(row.outstanding_count || 1),
      };
    });

    res.json({ assessments });
  } catch (err) {
    next(err);
  }
}

async function previewComputeTax(req, res, next) {
  try {
    const { businessId, grossSales } = req.query;

    if (!businessId || grossSales === undefined) {
      return res.status(400).json({ message: 'businessId and grossSales are required' });
    }

    const grossSalesAmount = Number(grossSales);
    if (Number.isNaN(grossSalesAmount) || grossSalesAmount < 0) {
      return res.status(400).json({ message: 'grossSales must be a valid non-negative number' });
    }

    const [bizRows] = await pool.query(
      'SELECT business_nature FROM businesses WHERE id = ?',
      [businessId]
    );

    if (bizRows.length === 0) return res.status(404).json({ message: 'Business not found' });

    const businessNature = bizRows[0].business_nature;
    if (!businessNature) {
      return res.status(422).json({ message: 'This business has no Business Nature set.' });
    }

    let result;
    try {
      result = computeTax(businessNature, grossSalesAmount);
    } catch (computeErr) {
      return res.status(422).json({ message: computeErr.message });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function createAssessment(req, res, next) {
  try {
    const {
      businessId,
      year,
      taxType,
      paymentFrequency,
      grossSales,
      dueDate,
      remarks,
    } = req.body;

    if (!businessId || !year || !taxType) {
      return res.status(400).json({ message: 'businessId, year, and taxType are required' });
    }

    const resolvedFrequency = paymentFrequency || 'Annual';
    if (!FREQUENCY_TO_METHOD[resolvedFrequency]) {
      return res.status(422).json({
        message: `Invalid paymentFrequency: "${resolvedFrequency}". Must be one of: ${Object.keys(FREQUENCY_TO_METHOD).join(', ')}.`,
      });
    }

    const grossSalesAmount = Number(grossSales || 0);
    if (grossSalesAmount <= 0) {
      return res.status(400).json({ message: 'Gross sales must be greater than zero' });
    }

    const [bizRows] = await pool.query(
      `SELECT b.id, b.owner_id, b.name AS business_name,
              b.capital_investment, b.business_nature, b.date_registered,
              o.name AS owner_name
       FROM businesses b
       JOIN owners o ON o.id = b.owner_id
       WHERE b.id = ?`,
      [businessId]
    );

    if (bizRows.length === 0) return res.status(404).json({ message: 'Business not found' });
    const biz = bizRows[0];

    if (!biz.business_nature) {
      return res.status(422).json({
        message: 'This business has no Business Nature set. Set it on the business profile before generating an assessment.',
      });
    }

    if (biz.date_registered) {
      const registrationYear = new Date(biz.date_registered).getUTCFullYear();
      if (Number(year) <= registrationYear) {
        return res.status(422).json({
          message: `This business registered in ${registrationYear} and owes no Business Tax for its registration year. ` +
                   `The earliest assessable year for this business is ${registrationYear + 1}.`,
        });
      }
    }

    // Replaces the old reliance on the DB's unique_assessment constraint
    // (business_id + assessment_year + tax_type), which was dropped via
    // migration because it had no concept of status — a Cancelled
    // assessment permanently blocked regenerating a fresh one for the
    // same business/year/type. This check does the same job but
    // correctly excludes Cancelled rows, so only a genuinely active
    // (Unpaid/Paid/Overdue) assessment counts as "already exists".
    const [[activeExisting]] = await pool.query(
      `SELECT id, status FROM assessments
       WHERE business_id = ? AND assessment_year = ? AND tax_type = ?
         AND status != 'Cancelled'`,
      [businessId, year, taxType]
    );

    if (activeExisting) {
      return res.status(409).json({
        message: 'Assessment already exists for this business, year, and tax type',
      });
    }

    let taxResult;
    try {
      taxResult = computeTax(biz.business_nature, grossSalesAmount);
    } catch (computeErr) {
      return res.status(422).json({ message: computeErr.message });
    }
    const { tax: assessmentAmount, section } = taxResult;

    const [[{ maxNum: rawMaxNum }]] = await pool.query(
      'SELECT COALESCE(MAX(CAST(SUBSTRING(id, 5) AS UNSIGNED)), 0) AS maxNum FROM assessments'
    );
    const maxNum = Number(rawMaxNum);
    if (maxNum >= 999999) {
      throw new Error(
        `Assessment ID sequence has reached its 6-digit limit (current max: ${maxNum}). ` +
        `Check for a malformed id (SELECT id FROM assessments WHERE LENGTH(id) > 10) before continuing.`
      );
    }
    const id = `ASS-${String(maxNum + 1).padStart(6, '0')}`;

    await pool.query(
      `INSERT INTO assessments
         (id, business_id, owner_id, assessment_year, tax_type, payment_frequency,
          capital_investment, gross_sales, assessment_amount, status, due_date, remarks, generated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Unpaid', ?, ?, ?)`,
      [
        id,
        businessId,
        biz.owner_id,
        Number(year),
        taxType,
        resolvedFrequency,
        Number(biz.capital_investment || 0),
        grossSalesAmount,
        assessmentAmount,
        dueDate  || null,
        remarks  || null,
        req.user?.name || null,
      ]
    );

    await pool.query(
      `UPDATE businesses SET tax_due_status = 'Unpaid' WHERE id = ?`,
      [businessId]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, details)
       VALUES (?, 'CREATE_ASSESSMENT', 'ASSESSMENTS',
         JSON_OBJECT(
           'assessment_id', ?, 'business_id', ?, 'year', ?,
           'tax_type', ?, 'payment_frequency', ?,
           'gross_sales', ?, 'tax_computed', ?, 'section', ?
         ))`,
      [req.user.id, id, businessId, Number(year), taxType, resolvedFrequency, grossSalesAmount, assessmentAmount, section]
    );

    // ── fire-and-forget notification ──
    createNotification({
      title: 'New Assessment Generated',
      message: `New assessment for ${biz.business_name} - ${taxType} ${year}: ${
        'PHP ' + Number(assessmentAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })
      }`,
      type: 'assessment_created',
      targetRoles: ['BPLO Staff', 'Treasurer', 'Administrator', 'Super Admin'],
    });

    const [newRows] = await pool.query(
      `SELECT a.*, b.name AS business_name, o.name AS owner_name, 0 AS paid_amount
       FROM assessments a
       JOIN businesses b ON b.id = a.business_id
       JOIN owners o ON o.id = a.owner_id
       WHERE a.id = ?`,
      [id]
    );

    res.status(201).json({ assessment: mapAssessment(newRows[0]) });
  } catch (err) {
    // Kept as a defensive fallback in case any other constraint still
    // exists on this table — but the specific bug this fixed (a
    // Cancelled assessment blocking a fresh one) is now caught earlier
    // by the explicit activeExisting check above, before this can fire.
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'Assessment already exists for this business, year, and tax type',
      });
    }
    next(err);
  }
}

async function updateAssessment(req, res, next) {
  try {
    const { id } = req.params;
    const { year, taxType, capitalInvestment, assessmentAmount, status, dueDate, remarks } = req.body;

    const [result] = await pool.query(
      `UPDATE assessments SET
         assessment_year    = COALESCE(?, assessment_year),
         tax_type           = COALESCE(?, tax_type),
         capital_investment = COALESCE(?, capital_investment),
         assessment_amount  = COALESCE(?, assessment_amount),
         status             = COALESCE(?, status),
         due_date           = ?,
         remarks            = ?
       WHERE id = ?`,
      [
        year ? Number(year) : null,
        taxType || null,
        capitalInvestment != null ? Number(capitalInvestment || 0) : null,
        assessmentAmount  != null ? Number(assessmentAmount  || 0) : null,
        status  || null,
        dueDate || null,
        remarks || null,
        id,
      ]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Assessment not found' });

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, details)
       VALUES (?, 'UPDATE_ASSESSMENT', 'ASSESSMENTS', JSON_OBJECT('assessment_id', ?))`,
      [req.user.id, id]
    );

    res.json({ message: 'Assessment updated' });
  } catch (err) {
    next(err);
  }
}

async function deleteAssessment(req, res, next) {
  try {
    const { id } = req.params;

    const [result] = await pool.query('DELETE FROM assessments WHERE id = ?', [id]);

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Assessment not found' });

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, details)
       VALUES (?, 'DELETE_ASSESSMENT', 'ASSESSMENTS', JSON_OBJECT('assessment_id', ?))`,
      [req.user.id, id]
    );

    res.json({ message: 'Assessment deleted' });
  } catch (err) {
    next(err);
  }
}

// ── new: cancelAssessment ─────────────────────────────────────────────────────

/**
 * PATCH /api/assessments/:id/cancel
 * Cancels an assessment. Blocked if payments already exist against it.
 */
async function cancelAssessment(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const { reason } = req.body;

    const [[assessment]] = await conn.query(
      `SELECT a.id, a.status, a.tax_type, a.assessment_year, a.assessment_amount,
              b.name AS business_name
       FROM assessments a
       JOIN businesses b ON b.id = a.business_id
       WHERE a.id = ?`,
      [id]
    );

    if (!assessment) {
      await conn.rollback();
      return res.status(404).json({ message: 'Assessment not found.' });
    }

    if (assessment.status === 'Cancelled') {
      await conn.rollback();
      return res.status(409).json({ message: 'Assessment is already cancelled.' });
    }

    // Block cancellation if any non-deleted payments exist against this
    // assessment (matched by business_id + tax_type + assessment_year).
    const [[{ payment_count }]] = await conn.query(
      `SELECT COUNT(*) AS payment_count
       FROM payments
       WHERE business_id = (
           SELECT business_id FROM assessments WHERE id = ?
         )
         AND tax_type COLLATE utf8mb4_0900_ai_ci = ? COLLATE utf8mb4_0900_ai_ci
         AND assessment_year = ?
         AND deleted_at IS NULL`,
      [id, assessment.tax_type, assessment.assessment_year]
    );

    if (Number(payment_count) > 0) {
      await conn.rollback();
      return res.status(422).json({
        message: 'Cannot cancel an assessment that already has payment records.',
      });
    }

    await conn.query(
      `UPDATE assessments
       SET status = 'Cancelled', cancelled_by = ?, cancelled_at = NOW(), cancel_reason = ?
       WHERE id = ?`,
      [String(req.user.id), reason || null, id]
    );

    await conn.query(
      `INSERT INTO audit_logs (user_id, action, module, details)
       VALUES (?, 'CANCEL_ASSESSMENT', 'ASSESSMENTS',
         JSON_OBJECT(
           'assessment_id', ?,
           'tax_type', ?,
           'assessment_year', ?,
           'reason', ?
         ))`,
      [req.user.id, id, assessment.tax_type, assessment.assessment_year, reason || null]
    );

    await conn.commit();

    // ── fire-and-forget notification ──
    createNotification({
      title: 'Assessment Cancelled',
      message: `Assessment cancelled: ${assessment.business_name} ${assessment.tax_type} ${assessment.assessment_year}`,
      type: 'assessment_cancelled',
      targetRoles: ['Treasurer', 'Administrator', 'Super Admin'],
    });

    return res.status(200).json({ message: `Assessment ${id} cancelled.` });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// ── new: listAssessments / getAssessment (for new routes) ────────────────────
// These are thin wrappers so the new assessments.routes.js imports resolve.
// getAssessments already exists above (returns all with filters);
// listAssessments is an alias. getAssessment returns a single record.

const listAssessments = getAssessments;

async function getAssessment(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, b.name AS business_name, o.name AS owner_name,
              COALESCE((
                SELECT SUM(p.base_tax)
                FROM payments p
                WHERE p.business_id = a.business_id
                  AND p.tax_type COLLATE utf8mb4_0900_ai_ci = a.tax_type COLLATE utf8mb4_0900_ai_ci
                  AND p.assessment_year = a.assessment_year
                  AND p.deleted_at IS NULL
              ), 0) AS paid_amount
       FROM assessments a
       JOIN businesses b ON b.id = a.business_id
       JOIN owners o ON o.id = a.owner_id
       WHERE a.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Assessment not found.' });

    res.json({ assessment: mapAssessment(rows[0]) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAssessments,
  getPayableAssessmentsForOwner,
  previewComputeTax,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  // new exports for notification write-side
  cancelAssessment,
  listAssessments,
  getAssessment,
};