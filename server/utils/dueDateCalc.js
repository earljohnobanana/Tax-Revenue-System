// server/utils/dueDateCalc.js
//
// Server-side mirror of src/utils/taxUtils.js's shiftToBankingDay() +
// getDueDate(). This MUST stay logically identical to the frontend
// version — both apply the same Sta. Catalina Revenue Code rule (due
// dates falling on Sat/Sun move to the next Monday) to the same
// MM-DD constants. If one side changes, the other must change too,
// or client-side due-date display will silently disagree with what
// the server accepts/rejects during payment validation.
//
// This file is the actual ENFORCEMENT point — the frontend's version
// is only ever used for display and the live interest preview. A
// payment request that disagrees with what THIS file computes gets
// rejected by validateAndComputeInterest() in installmentCalc.js.
//
// CORRECTED quarterly/semi-annual due dates: each installment is due
// on the 20th of the month AFTER its period ends — Q1 (Jan-Mar) is due
// Mar 20, Q2 (Apr-Jun) due Jun 20, Q3 (Jul-Sep) due Sep 20, Q4 (Oct-Dec)
// due Dec 20. The PREVIOUS version of this file had these anchored to
// the start of each quarter instead (Jan 20/Apr 20/Jul 20/Oct 20),
// which was wrong — confirmed and corrected against the actual
// ordinance. H1 (Jan-Jun) due Jun 20, H2 (Jul-Dec) due Dec 20, matching
// the same end-of-period rule. FULL/Annual stays at Jan 20 of the
// assessment year itself (e.g. a 2026 Annual assessment is due
// 2026-01-20) — that was already correct and is unaffected by this fix.
const DUE_MONTH_DAY = {
  FULL: "01-20",
  Q1: "03-20",
  Q2: "06-20",
  Q3: "09-20",
  Q4: "12-20",
  H1: "06-20",
  H2: "12-20",
};

// Sta. Catalina Revenue Code banking-day rule: if the statutory due date
// (the 20th) falls on a Saturday or Sunday, the deadline moves to the
// next Monday. This must be the ONLY place this shift happens — both
// getDueDate() (display + interest comparison) and any future caller
// depend on a single shifted value, never re-deriving it independently,
// or display and interest math can silently disagree on what "the due
// date" actually was for a given quarter/year.
//
// Takes/returns "YYYY-MM-DD". Uses Date.UTC throughout so day-of-week
// checks are never affected by the server's local timezone — matches
// the frontend's UTC-based approach exactly.
function shiftToBankingDay(isoDateStr) {
  const [y, m, d] = isoDateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 6 = Saturday

  if (dayOfWeek === 6) {
    date.setUTCDate(date.getUTCDate() + 2); // Sat -> Mon
  } else if (dayOfWeek === 0) {
    date.setUTCDate(date.getUTCDate() + 1); // Sun -> Mon
  }

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * @param {string} paymentMethod - "FULL PAYMENT" | "QUARTERLY" | "BIANNUAL"
 * @param {number|null} quarter - 1-4, required if paymentMethod === "QUARTERLY"
 * @param {number|null} half - 1-2, required if paymentMethod === "BIANNUAL"
 * @param {number} year - the tax year being paid for
 * @returns {string} the banking-day-shifted due date, "YYYY-MM-DD"
 */
function getDueDate(paymentMethod, quarter, half, year) {
  if (!year || !Number.isFinite(Number(year))) {
    throw new Error("year is required to compute a due date");
  }

  let key = "FULL";
  if (paymentMethod === "QUARTERLY") {
    if (![1, 2, 3, 4].includes(Number(quarter))) {
      throw new Error(`Invalid quarter for due date: ${quarter}`);
    }
    key = `Q${quarter}`;
  } else if (paymentMethod === "BIANNUAL") {
    if (![1, 2].includes(Number(half))) {
      throw new Error(`Invalid half for due date: ${half}`);
    }
    key = `H${half}`;
  }

  const rawDueDate = `${year}-${DUE_MONTH_DAY[key]}`;
  return shiftToBankingDay(rawDueDate);
}

module.exports = { getDueDate, shiftToBankingDay };