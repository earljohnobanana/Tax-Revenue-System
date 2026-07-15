export const TAX_INTEREST_RATE = 0.25;

// Month/day only — the year is supplied at call time by getDueDate(), never
// hardcoded here. An earlier version of this file hardcoded full dates
// like "2025-01-20", which meant every payment recorded for 2026 or later
// was silently compared against a due date that had already passed a year
// (or more) ago, making computeInterest() apply the 25% penalty even to
// payments made exactly on time. These are MM-DD only; getDueDate() below
// prepends the correct year before any date comparison happens.
//
// CORRECTED quarterly/semi-annual due dates: each installment is due on
// the 20th of the month AFTER its period ends — Q1 (Jan-Mar) due Mar 20,
// Q2 (Apr-Jun) due Jun 20, Q3 (Jul-Sep) due Sep 20, Q4 (Oct-Dec) due
// Dec 20. A PREVIOUS version of this file had these anchored to the
// start of each quarter instead (Jan 20/Apr 20/Jul 20/Oct 20), which was
// wrong — confirmed and corrected against the actual ordinance. H1
// (Jan-Jun) due Jun 20, H2 (Jul-Dec) due Dec 20, same end-of-period
// rule. FULL/Annual stays at Jan 20 of the assessment year itself (e.g.
// a 2026 Annual assessment is due 2026-01-20) — unaffected by this fix.
//
// MUST stay identical to server/utils/dueDateCalc.js's DUE_MONTH_DAY —
// that file is the actual enforcement point for payment validation; this
// one drives display and the live interest preview only. If one changes
// without the other, client-shown due dates will silently disagree with
// what the server accepts/rejects.
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
// Takes and returns a "YYYY-MM-DD" string. Parses as UTC (matching how
// computeInterest() below parses both dueDate and paymentDate via
// new Date("YYYY-MM-DD"), which is also UTC midnight) so the day-of-week
// check is never off by one due to local-timezone rollover.
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

export function computeBaseTax(capitalInvestment) {
  const amt = Number(capitalInvestment) || 0;
  if (amt <= 50000) return amt * 0.01;
  if (amt <= 200000) return 500 + (amt - 50000) * 0.0075;
  if (amt <= 500000) return 1625 + (amt - 200000) * 0.005;
  if (amt <= 1000000) return 3125 + (amt - 500000) * 0.004;
  if (amt <= 2000000) return 5125 + (amt - 1000000) * 0.003;
  return 8125 + (amt - 2000000) * 0.002;
}

export function computeInterest(baseTax, dueDate, paymentDate) {
  if (!paymentDate || !dueDate) return 0;
  if (new Date(paymentDate) <= new Date(dueDate)) return 0;
  return baseTax * TAX_INTEREST_RATE;
}

// year is REQUIRED — pass the tax year being paid for (e.g. the calendar
// year selected in the Payments modal), not necessarily the same as the
// current real-world year. Falls back to the current year only if no year
// is supplied, so existing call sites that haven't been updated yet don't
// crash outright while still no longer silently defaulting to "2025".
//
// Always returns the BANKING-DAY-SHIFTED date — i.e. if the statutory
// 20th falls on a weekend, this returns the following Monday instead.
// Every caller (display text, computeInterest comparisons) gets the
// shifted date automatically since this is the single source of it.
export function getDueDate(paymentMethod, quarter, half, year) {
  const y = year || new Date().getFullYear();
  let key = "FULL";
  if (paymentMethod === "QUARTERLY") key = DUE_MONTH_DAY[`Q${quarter}`] ? `Q${quarter}` : "Q1";
  if (paymentMethod === "BIANNUAL") key = DUE_MONTH_DAY[`H${half}`] ? `H${half}` : "H1";
  const rawDueDate = `${y}-${DUE_MONTH_DAY[key]}`;
  return shiftToBankingDay(rawDueDate);
}

export function getPeriodLabel(paymentMethod, year, quarter, half) {
  if (paymentMethod === "QUARTERLY") return `${year} Q${quarter}`;
  if (paymentMethod === "BIANNUAL") return half === 1 ? `${year} Jan-Jun` : `${year} Jul-Dec`;
  return String(year);
}

export function formatPeso(amount) {
  const num = Number(amount) || 0;
  const formatted = num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return "PHP " + formatted;
}

export function generateORNumber(year) {
  const seq = Math.floor(Math.random() * 90000) + 10000;
  return `${year}-${seq}`;
}