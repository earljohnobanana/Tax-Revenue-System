const { pool } = require("../config/db");
const { VALID_SECTIONS } = require("../utils/taxComputation");

function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function computeTaxDueStatus(row) {
  const hasAssessment = !!row.latest_assessment_id;

  if (!hasAssessment) return "No Assessment";

  const assessmentAmount = Number(row.latest_assessment_amount || 0);
  const paid = Number(row.latest_assessment_paid || 0);
  const balance = Math.max(assessmentAmount - paid, 0);
  const dueDate = toDateOnly(row.latest_due_date);
  const today = new Date().toISOString().slice(0, 10);
  const todayYear = new Date().getFullYear();
  const latestYear = row.latest_assessment_year ? Number(row.latest_assessment_year) : null;

  if (assessmentAmount > 0 && balance > 0) {
    if (dueDate && today > dueDate) return "Overdue";
    return "Unpaid";
  }

  if (latestYear !== null && latestYear < todayYear) {
    return "Not Yet Renewed";
  }

  if (assessmentAmount > 0 && balance <= 0) return "Paid";
  if (dueDate && today > dueDate) return "Overdue";
  return "Unpaid";
}

function mapBusiness(b) {
  const latestAssessmentAmount = Number(b.latest_assessment_amount || 0);
  const latestPaid = Number(b.latest_assessment_paid || 0);
  const latestBalance = Math.max(latestAssessmentAmount - latestPaid, 0);

  return {
    id: b.id,
    ownerId: b.owner_id,
    ownerName: b.owner_name,
    name: b.name,
    type: b.type,
    businessNature: b.business_nature || null,
    registrationType: b.registration_type || "New",
    lineOfBusiness: b.line_of_business,
    kindOfMarket: b.kind_of_market,
    address: b.address,
    dateRegistered: toDateOnly(b.date_registered),
    capitalInvestment: Number(b.capital_investment || 0),
    status: b.status,
    taxDueStatus: computeTaxDueStatus(b),
    totalPaid: Number(b.totalPaid || 0),
    latestAssessmentId: b.latest_assessment_id || null,
    latestAssessmentYear: b.latest_assessment_year
      ? Number(b.latest_assessment_year)
      : null,
    grossSales: Number(b.latest_gross_sales || 0),
    taxDue: latestAssessmentAmount,
    taxPaid: latestPaid,
    taxBalance: latestBalance,
    taxDueDate: toDateOnly(b.latest_due_date),
  };
}

async function getBusinesses(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT
        b.*,
        o.name AS owner_name,

        COALESCE((
          SELECT SUM(p.total_paid)
          FROM payments p
          WHERE p.business_id = b.id
        ), 0) AS totalPaid,

        la.id AS latest_assessment_id,
        la.assessment_year AS latest_assessment_year,
        la.gross_sales AS latest_gross_sales,
        la.assessment_amount AS latest_assessment_amount,
        la.due_date AS latest_due_date,

        COALESCE((
          SELECT SUM(p.base_tax)
          FROM payments p
          WHERE p.business_id = b.id
            AND p.tax_type COLLATE utf8mb4_0900_ai_ci = la.tax_type COLLATE utf8mb4_0900_ai_ci
            AND la.assessment_year IS NOT NULL
            AND p.assessment_year = la.assessment_year
        ), 0) AS latest_assessment_paid

      FROM businesses b
      JOIN owners o ON o.id = b.owner_id

      LEFT JOIN assessments la
        ON la.id = (
          SELECT a2.id
          FROM assessments a2
          WHERE a2.business_id = b.id
            AND a2.tax_type COLLATE utf8mb4_0900_ai_ci = 'Business Tax' COLLATE utf8mb4_0900_ai_ci
            AND a2.status <> 'Cancelled'
          ORDER BY a2.assessment_year DESC, a2.created_at DESC
          LIMIT 1
        )

      ORDER BY b.name ASC
    `);

    res.json({
      businesses: rows.map(mapBusiness),
    });
  } catch (err) {
    next(err);
  }
}

async function createBusiness(req, res, next) {
  try {
    const {
      name,
      ownerId,
      type,
      businessNature,
      registrationType = "New",
      lineOfBusiness,
      kindOfMarket,
      address,
      dateRegistered,
      capitalInvestment,
    } = req.body;

    if (!name || !ownerId || !type) {
      return res.status(400).json({
        message: "Business name, owner, and type are required",
      });
    }

    if (!businessNature) {
      return res.status(400).json({
        message: "Business nature is required",
      });
    }

    if (!VALID_SECTIONS.includes(businessNature)) {
      return res.status(422).json({
        message: `Invalid business nature: "${businessNature}"`,
      });
    }

    if (!["New", "Renewal"].includes(registrationType)) {
      return res.status(422).json({
        message: `Invalid registration type: "${registrationType}"`,
      });
    }

    const [ownerRows] = await pool.query(
      "SELECT name FROM owners WHERE id = ?",
      [ownerId]
    );

    if (ownerRows.length === 0) {
      return res.status(404).json({
        message: "Selected owner does not exist",
      });
    }

    const [[{ maxNum: rawMaxNum }]] = await pool.query(
      "SELECT COALESCE(MAX(CAST(SUBSTRING(id, 5) AS UNSIGNED)), 0) AS maxNum FROM businesses"
    );

    // CRITICAL FIX — force maxNum to a real JS number immediately.
    // mysql2 can return CAST(... AS UNSIGNED) as a JS string instead of
    // a number. When that happens, `maxNum + 1` silently becomes string
    // concatenation ("111" + 1 = "1111") instead of arithmetic (112).
    // That corrupted id then compounds on every subsequent insert until
    // it trips the ceiling guard below. Number() is unconditional — a
    // no-op if already a number, the fix if it's a string. Confirmed
    // root cause of the PAY- ID corruption incident in
    // payments.controller.js (same driver, same query pattern).
    const maxNum = Number(rawMaxNum);

    // Same defensive ceiling as payments.controller.js's ID generator —
    // padStart(3, "0") pads but never truncates, so a single malformed
    // id here would otherwise let every subsequent business ID silently
    // grow by a digit per insert.
    if (maxNum >= 999) {
      throw new Error(
        `Business ID sequence has reached its 3-digit limit (current max: ${maxNum}). ` +
        `Check for a malformed id (SELECT id FROM businesses WHERE LENGTH(id) > 7) before continuing.`
      );
    }

    const id = `BUS-${String(maxNum + 1).padStart(3, "0")}`;

    await pool.query(
      `
      INSERT INTO businesses
        (id, owner_id, name, type, business_nature, registration_type,
         line_of_business, kind_of_market, address, date_registered,
         capital_investment, status, tax_due_status)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 'Unpaid')
      `,
      [
        id,
        ownerId,
        name,
        type,
        businessNature,
        registrationType,
        lineOfBusiness || null,
        kindOfMarket || null,
        address || null,
        dateRegistered || null,
        parseFloat(capitalInvestment) || 0,
      ]
    );

    await pool.query(
      `
      INSERT INTO audit_logs
        (user_id, action, module, details)
      VALUES
        (?, 'CREATE_BUSINESS', 'BUSINESSES',
         JSON_OBJECT('business_id', ?, 'name', ?, 'registration_type', ?))
      `,
      [req.user.id, id, name, registrationType]
    );

    res.status(201).json({
      id,
      ownerId,
      ownerName: ownerRows[0].name,
      name,
      type,
      businessNature,
      registrationType,
      lineOfBusiness,
      kindOfMarket,
      address,
      dateRegistered,
      capitalInvestment: parseFloat(capitalInvestment) || 0,
      status: "Active",
      taxDueStatus: "No Assessment",
      totalPaid: 0,
      latestAssessmentId: null,
      latestAssessmentYear: null,
      grossSales: 0,
      taxDue: 0,
      taxPaid: 0,
      taxBalance: 0,
      taxDueDate: null,
    });
  } catch (err) {
    next(err);
  }
}

async function updateBusiness(req, res, next) {
  try {
    const { id } = req.params;

    const {
      name,
      ownerId,
      type,
      businessNature,
      registrationType,
      lineOfBusiness,
      kindOfMarket,
      address,
      dateRegistered,
      capitalInvestment,
      status,
    } = req.body;

    if (businessNature && !VALID_SECTIONS.includes(businessNature)) {
      return res.status(422).json({
        message: `Invalid business nature: "${businessNature}"`,
      });
    }

    if (registrationType && !["New", "Renewal"].includes(registrationType)) {
      return res.status(422).json({
        message: `Invalid registration type: "${registrationType}"`,
      });
    }

    const [result] = await pool.query(
      `
      UPDATE businesses SET
        name = COALESCE(?, name),
        owner_id = COALESCE(?, owner_id),
        type = COALESCE(?, type),
        business_nature = COALESCE(?, business_nature),
        registration_type = COALESCE(?, registration_type),
        line_of_business = COALESCE(?, line_of_business),
        kind_of_market = COALESCE(?, kind_of_market),
        address = COALESCE(?, address),
        date_registered = COALESCE(?, date_registered),
        capital_investment = COALESCE(?, capital_investment),
        status = COALESCE(?, status)
      WHERE id = ?
      `,
      [
        name || null,
        ownerId || null,
        type || null,
        businessNature || null,
        registrationType || null,
        lineOfBusiness || null,
        kindOfMarket || null,
        address || null,
        dateRegistered || null,
        capitalInvestment != null ? parseFloat(capitalInvestment) : null,
        status || null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Business not found",
      });
    }

    await pool.query(
      `
      INSERT INTO audit_logs
        (user_id, action, module, details)
      VALUES
        (?, 'UPDATE_BUSINESS', 'BUSINESSES',
         JSON_OBJECT('business_id', ?))
      `,
      [req.user.id, id]
    );

    res.json({
      message: "Business updated",
    });
  } catch (err) {
    next(err);
  }
}

async function deleteBusiness(req, res, next) {
  try {
    const { id } = req.params;

    const [result] = await pool.query("DELETE FROM businesses WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Business not found",
      });
    }

    await pool.query(
      `
      INSERT INTO audit_logs
        (user_id, action, module, details)
      VALUES
        (?, 'DELETE_BUSINESS', 'BUSINESSES',
         JSON_OBJECT('business_id', ?))
      `,
      [req.user.id, id]
    );

    res.json({
      message: "Business deleted",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBusinesses,
  createBusiness,
  updateBusiness,
  deleteBusiness,
};