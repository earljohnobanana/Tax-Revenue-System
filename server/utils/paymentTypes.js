// server/utils/paymentTypes.js
// Single source of truth for tax_type / payment_category strings.
// businesses.controller.js and assessments.controller.js both do
// collation-sensitive string matching against these exact values to
// reconcile payments against assessments — a typo anywhere else
// (frontend, seed data, manual SQL) silently breaks that reconciliation
// with no error, so every write path must validate against this list.

// These exact strings are sent by PaymentsPage.jsx's handleRecord() — do not
// change wording here without also updating the frontend, or every payment
// submitted afterward will fail the 422 check below.
const VALID_TAX_TYPES = [
  "Business Tax",
  "Mayor's Permit",
  "Regulatory Fees",
];

// paymentCategory is a coarse two-bucket grouping used only to split the
// Payments page into its two tabs ("Business Tax & Mayor's Permit" vs
// "Regulatory Fees") — NOT a fine-grained category. A Mayor's Permit line
// item is intentionally tagged paymentCategory: "Business Tax".
const VALID_PAYMENT_CATEGORIES = [
  "Business Tax",
  "Regulatory Fees",
];

// Mirrors PAY_METHODS in PaymentsPage.jsx exactly. This is the installment
// schedule (lump sum vs. quarterly vs. biannual) — NOT how the money was
// physically paid. See VALID_PAYMENT_TYPES below for that.
const VALID_PAYMENT_METHODS = [
  "FULL PAYMENT",
  "QUARTERLY",
  "BIANNUAL",
];

// How the money was physically handed over for the WHOLE batch/receipt —
// one OR = one physical payment, so this is set once per submission in
// PaymentsPage.jsx and shared across every line item in that batch by
// payments.controller.js's createPayments(). Check/Money Order additionally
// require draweeBank + instrumentNumber (+ optional instrumentDate).
const VALID_PAYMENT_TYPES = [
  "Cash",
  "Check",
  "Money Order",
];

module.exports = {
  VALID_TAX_TYPES,
  VALID_PAYMENT_CATEGORIES,
  VALID_PAYMENT_METHODS,
  VALID_PAYMENT_TYPES,
};