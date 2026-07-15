const { pool } = require("../config/db");
const { runDelinquencyCheck } = require("./delinquent.controller");

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function getMonthIndex(value) {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return -1;

  const month = Number(dateOnly.slice(5, 7));
  if (!Number.isInteger(month) || month < 1 || month > 12) return -1;

  return month - 1;
}

// Bucket a tax_type string into one of the three chart series.
// Keep this in sync with server/utils/paymentTypes.js VALID_TAX_TYPES.
function bucketFor(taxType) {
  if (taxType === "Mayor's Permit") return "mayorPermit";
  if (taxType === "Regulatory Fees") return "regulatoryFees";
  return "businessTax";
}

async function getDashboard(req, res, next) {
  try {
    const requestedYear = Number(req.query.year);
    const currentYear = new Date().getFullYear();
    const year = Number.isInteger(requestedYear) && requestedYear > 0
      ? requestedYear
      : currentYear;

    // ---- Available years for the Fiscal Year dropdown ----
    const [yearRows] = await pool.query(`
      SELECT DISTINCT CAST(strftime('%Y', date_paid) AS INTEGER) AS yr
      FROM payments
      WHERE date_paid IS NOT NULL
      ORDER BY yr DESC
    `);

    const availableYears = new Set(
      yearRows
        .map((r) => Number(r.yr))
        .filter((yr) => Number.isInteger(yr) && yr > 0)
    );

    availableYears.add(currentYear);

    const years = [...availableYears].sort((a, b) => b - a);

    // ---- Owners / Businesses totals ----
    const [[{ ownerCount }]] = await pool.query(`
      SELECT COUNT(*) AS ownerCount
      FROM owners
    `);

    const [[{ businessCount }]] = await pool.query(`
      SELECT COUNT(*) AS businessCount
      FROM businesses
    `);

    // ---- Pending assessments ----
    const [[{ pendingAssessments }]] = await pool.query(`
      SELECT COUNT(*) AS pendingAssessments
      FROM assessments
      WHERE status NOT IN ('Paid', 'Cancelled')
    `);

    // ---- All payments for the selected year ----
    const [yearPayments] = await pool.query(
      `
      SELECT tax_type, total_paid, date_paid
      FROM payments
      WHERE strftime('%Y', date_paid) = ?
      `,
      [String(year)]
    );

    const monthly = MONTH_LABELS.map((label) => ({
      month: label,
      businessTax: 0,
      mayorPermit: 0,
      regulatoryFees: 0,
    }));

    const quarterly = [1, 2, 3, 4].map((q) => ({
      quarter: `Q${q} ${year}`,
      amount: 0,
    }));

    const pieTotals = {
      businessTax: 0,
      mayorPermit: 0,
      regulatoryFees: 0,
    };

    let yearTotal = 0;

    for (const row of yearPayments) {
      const amount = Number(row.total_paid) || 0;
      const bucket = bucketFor(row.tax_type);
      const monthIndex = getMonthIndex(row.date_paid);

      if (monthIndex < 0 || monthIndex > 11) continue;

      const quarterIndex = Math.floor(monthIndex / 3);

      monthly[monthIndex][bucket] += amount;
      quarterly[quarterIndex].amount += amount;
      pieTotals[bucket] += amount;
      yearTotal += amount;
    }

    // ---- This calendar month's total ----
    const now = new Date();
    const nowYear = String(now.getFullYear());
    const nowMonth = String(now.getMonth() + 1).padStart(2, "0");

    const [[{ monthTotal }]] = await pool.query(
      `
      SELECT COALESCE(SUM(total_paid), 0) AS monthTotal
      FROM payments
      WHERE strftime('%Y', date_paid) = ?
        AND strftime('%m', date_paid) = ?
      `,
      [nowYear, nowMonth]
    );

    // ---- Delinquent count ----
    const { delinquentCount } = await runDelinquencyCheck(new Date());

    // ---- Recent payments ----
    const [recentRows] = await pool.query(`
      SELECT 
        p.*,
        b.name AS business_name,
        o.name AS owner_name
      FROM payments p
      LEFT JOIN businesses b ON b.id = p.business_id
      LEFT JOIN owners o ON o.id = p.owner_id
      ORDER BY p.date_paid DESC, p.created_at DESC
      LIMIT 8
    `);

    const recentPayments = recentRows.map((p) => ({
      id: p.id,
      orNumber: p.or_number,
      datePaid: toDateOnly(p.date_paid),
      businessName: p.business_name,
      ownerName: p.owner_name,
      taxType: p.tax_type,
      periodCovered: p.period_covered,
      paymentMethod: p.payment_method,
      totalPaid: Number(p.total_paid),
      processedBy: p.processed_by,
    }));

    res.json({
      year,
      availableYears: years,
      kpis: {
        ownerCount,
        businessCount,
        pendingAssessments,
        delinquentCount,
        yearTotal: Math.round(yearTotal * 100) / 100,
        monthTotal: Math.round(Number(monthTotal) * 100) / 100,
        regulatoryFeesTotal: Math.round(pieTotals.regulatoryFees * 100) / 100,
      },
      monthly,
      quarterly,
      pie: [
        {
          name: "Business Tax",
          value: Math.round(pieTotals.businessTax * 100) / 100,
        },
        {
          name: "Mayor's Permit",
          value: Math.round(pieTotals.mayorPermit * 100) / 100,
        },
        {
          name: "Reg. Fees",
          value: Math.round(pieTotals.regulatoryFees * 100) / 100,
        },
      ],
      recentPayments,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard };