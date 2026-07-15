// server/utils/installmentCalc.js
//
// Derives the expected amount for ONE installment of an annual tax
// assessment, and validates that a submitted payment's baseTax AND
// interest match what the server independently computes. The annual
// assessments.assessment_amount is the single source of truth — server-
// computed once by computeTax() and never edited by staff. This module
// only slices that fixed annual figure and checks the resulting interest;
// it never independently determines or accepts an amount from the caller.

const { getDueDate } = require("./dueDateCalc");

const TAX_INTEREST_RATE = 0.25; // must match TAX_INTEREST_RATE in src/utils/taxUtils.js

function round2(n) {
  return Math.round(n * 100) / 100;
}

const FREQUENCY_TO_METHOD = {
  Annual: "FULL PAYMENT",
  Quarterly: "QUARTERLY",
  "Semi-Annual": "BIANNUAL",
};

/**
 * @param {number} assessmentAmount - assessments.assessment_amount (annual, fixed)
 * @param {string} method - "FULL PAYMENT" | "QUARTERLY" | "BIANNUAL"
 * @param {number|null} periodNo - quarter (1-4) or half (1-2); ignored for FULL PAYMENT
 * @returns {number} expected amount for this specific installment
 */
function computeInstallmentAmount(assessmentAmount, method, periodNo) {
  const amount = Number(assessmentAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("assessmentAmount must be a positive number");
  }

  if (method === "FULL PAYMENT") {
    return round2(amount);
  }

  if (method === "QUARTERLY") {
    if (![1, 2, 3, 4].includes(Number(periodNo))) {
      throw new Error(`Invalid quarter: ${periodNo}`);
    }
    const base = round2(amount / 4);
    if (Number(periodNo) < 4) return base;
    return round2(amount - base * 3); // Q4 absorbs remainder
  }

  if (method === "BIANNUAL") {
    if (![1, 2].includes(Number(periodNo))) {
      throw new Error(`Invalid half: ${periodNo}`);
    }
    const base = round2(amount / 2);
    if (Number(periodNo) === 1) return base;
    return round2(amount - base); // H2 absorbs remainder
  }

  throw new Error(`Unknown payment method: "${method}"`);
}

/**
 * Mirrors src/utils/taxUtils.js's computeInterest() exactly: flat 25% of
 * the installment amount if paymentDate is strictly after dueDate,
 * otherwise zero. Both dates are "YYYY-MM-DD"; comparison uses Date
 * parsing (UTC midnight for plain date strings), matching the frontend.
 *
 * @param {number} installmentAmount
 * @param {string} dueDate - "YYYY-MM-DD", already banking-day-shifted
 * @param {string} paymentDate - "YYYY-MM-DD"
 * @returns {number} interest amount (0 if on-time)
 */
function computeInterest(installmentAmount, dueDate, paymentDate) {
  if (!paymentDate || !dueDate) return 0;
  if (new Date(paymentDate) <= new Date(dueDate)) return 0;
  return round2(Number(installmentAmount) * TAX_INTEREST_RATE);
}

/**
 * Full validation entry point used by payments.controller.js.
 * Throws a descriptive Error (caller maps it to a 422) if:
 *   - the item's paymentMethod disagrees with the assessment's stored
 *     payment_frequency
 *   - the submitted baseTax doesn't match the derived installment amount
 *   - the submitted interest doesn't match the server-derived due date
 *     and TAX_INTEREST_RATE
 *
 * @param {object} assessmentRow - row from assessments (assessment_amount,
 *   payment_frequency)
 * @param {object} item - one payment line item from the request body
 *   (paymentMethod, quarter/half, baseTax, interest)
 * @param {string} taxYear - the calendar year being paid for (number or string)
 * @param {string} paymentDate - "YYYY-MM-DD", the batch's datePaid
 * @param {number} [tolerance=0.01] - centavo tolerance for float comparison
 * @returns {{ expectedAmount: number, expectedInterest: number, dueDate: string }}
 */
function validateAndComputeInstallment(assessmentRow, item, taxYear, paymentDate, tolerance = 0.01) {
  const assessmentAmount = Number(assessmentRow.assessment_amount);
  const storedFrequency = assessmentRow.payment_frequency;
  const expectedMethod = FREQUENCY_TO_METHOD[storedFrequency];

  if (!expectedMethod) {
    throw new Error(`Assessment has an unrecognized payment_frequency: "${storedFrequency}"`);
  }

  const submittedMethod = item.paymentMethod || "FULL PAYMENT";

  if (submittedMethod !== expectedMethod) {
    throw new Error(
      `Payment method mismatch: this assessment is set to "${storedFrequency}" ` +
      `(expects "${expectedMethod}"), but the payment was submitted as "${submittedMethod}". ` +
      `Refresh the page and try again.`
    );
  }

  const periodNo = submittedMethod === "QUARTERLY" ? item.quarter
                  : submittedMethod === "BIANNUAL" ? item.half
                  : null;

  const expectedAmount = computeInstallmentAmount(assessmentAmount, submittedMethod, periodNo);

  const sentBaseTax = Number(item.baseTax);
  if (Math.abs(sentBaseTax - expectedAmount) > tolerance) {
    throw new Error(
      `Base tax mismatch: expected ${expectedAmount.toFixed(2)} ` +
      `(${submittedMethod}${periodNo ? ` period ${periodNo}` : ""}) but received ${sentBaseTax.toFixed(2)}. ` +
      `The installment amount is derived from the assessment and cannot be manually overridden.`
    );
  }

  // Independent due-date derivation — never trusts a dueDate from the
  // client, only the raw method/quarter/half/year inputs.
  let dueDate;
  try {
    dueDate = getDueDate(submittedMethod, item.quarter, item.half, taxYear);
  } catch (dueDateErr) {
    throw new Error(`Could not determine due date: ${dueDateErr.message}`);
  }

  const expectedInterest = computeInterest(expectedAmount, dueDate, paymentDate);

  const sentInterest = Number(item.interest || 0);
  if (Math.abs(sentInterest - expectedInterest) > tolerance) {
    throw new Error(
      `Interest mismatch: expected ${expectedInterest.toFixed(2)} ` +
      `(due ${dueDate}, paid ${paymentDate}) but received ${sentInterest.toFixed(2)}. ` +
      `Interest is computed server-side based on the due date and cannot be manually overridden.`
    );
  }

  return { expectedAmount, expectedInterest, dueDate };
}

module.exports = {
  computeInstallmentAmount,
  computeInterest,
  validateAndComputeInstallment,
  FREQUENCY_TO_METHOD,
};