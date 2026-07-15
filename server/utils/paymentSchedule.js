const VALID_FREQUENCIES = ['Annual', 'Quarterly', 'Semi-Annual'];

const QUARTERLY_DUE_DATES = ['01-20', '04-20', '07-20', '10-20'];
const SEMI_ANNUAL_DUE_DATES = ['01-20', '07-20'];
const ANNUAL_DUE_DATE = '01-20';

/**
 * Generates installment schedule rows for a finalized tax assessment.
 * @param {number} annualTaxDue - The computed_tax from tax_assessments (FIXED, server-computed)
 * @param {string} frequency - 'Annual' | 'Quarterly' | 'Semi-Annual'
 * @param {number} assessmentYear
 * @returns {Array<{installment_no, installment_amount, due_date}>}
 */
function generateInstallments(annualTaxDue, frequency, assessmentYear) {
  if (!VALID_FREQUENCIES.includes(frequency)) {
    throw new Error(`Invalid payment frequency: ${frequency}`);
  }
  if (typeof annualTaxDue !== 'number' || annualTaxDue <= 0) {
    throw new Error('annualTaxDue must be a positive number');
  }

  let dueDateSuffixes;
  let divisor;

  switch (frequency) {
    case 'Quarterly':
      dueDateSuffixes = QUARTERLY_DUE_DATES;
      divisor = 4;
      break;
    case 'Semi-Annual':
      dueDateSuffixes = SEMI_ANNUAL_DUE_DATES;
      divisor = 2;
      break;
    case 'Annual':
      dueDateSuffixes = [ANNUAL_DUE_DATE];
      divisor = 1;
      break;
  }

  // Compute base installment, then push any rounding remainder into the LAST installment
  // so the sum of installments always equals annualTaxDue exactly (avoids centavo drift).
  const rawInstallment = Math.floor((annualTaxDue / divisor) * 100) / 100;
  const installments = [];
  let runningTotal = 0;

  for (let i = 0; i < divisor; i++) {
    const isLast = i === divisor - 1;
    const amount = isLast
      ? Math.round((annualTaxDue - runningTotal) * 100) / 100
      : rawInstallment;

    runningTotal += amount;

    installments.push({
      installment_no: i + 1,
      installment_amount: amount,
      due_date: `${assessmentYear}-${dueDateSuffixes[i]}`
    });
  }

  return installments;
}

module.exports = { generateInstallments, VALID_FREQUENCIES };