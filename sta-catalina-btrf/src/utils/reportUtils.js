const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Builds the same shape the old mock monthlyRevenueData had:
// [{ month: "Jan", businessTax, mayorPermit, regulatoryFees }, ...]
// computed live from real payment rows for the given fiscal year.
export function buildMonthlyRevenueData(payments, year) {
  const buckets = MONTH_LABELS.map((month) => ({
    month,
    businessTax: 0,
    mayorPermit: 0,
    regulatoryFees: 0,
  }));

  payments.forEach((p) => {
    if (!p.datePaid) return;
    const d = new Date(p.datePaid);
    if (d.getFullYear() !== year) return;

    const bucket = buckets[d.getMonth()];
    const amount = Number(p.totalPaid || 0);

    if (p.taxType === "Business Tax") bucket.businessTax += amount;
    else if (p.taxType === "Mayor's Permit") bucket.mayorPermit += amount;
    else if (p.taxType === "Regulatory Fees") bucket.regulatoryFees += amount;
  });

  return buckets;
}

// Filters payments down to a fiscal year by datePaid.
export function filterPaymentsByYear(payments, year) {
  return payments.filter((p) => {
    if (!p.datePaid) return false;
    return new Date(p.datePaid).getFullYear() === year;
  });
}

// Today's date in YYYY-MM-DD, matching the dateStrings:true format
// the backend returns (see config/db.js).
export function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}