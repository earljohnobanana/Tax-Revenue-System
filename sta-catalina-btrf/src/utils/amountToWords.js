// sta-catalina-btrf/src/utils/amountToWords.js
// ---------------------------------------------------------------------------
// Converts a numeric peso amount into the words form printed on Accountable
// Form No. 51 (e.g. 100 -> "ONE HUNDRED PESOS ONLY",
// 423.27 -> "FOUR HUNDRED TWENTY-THREE PESOS AND 27/100").
//
// Pure, dependency-free, and reusable anywhere a receipt or voucher needs the
// peso-in-words convention. Handles up to billions.
// ---------------------------------------------------------------------------

const ONES = [
  '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
  'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
const SCALES = ['', ' THOUSAND', ' MILLION', ' BILLION'];

function below1000(x) {
  let s = '';
  if (x >= 100) {
    s += ONES[Math.floor(x / 100)] + ' HUNDRED';
    x %= 100;
    if (x) s += ' ';
  }
  if (x >= 20) {
    s += TENS[Math.floor(x / 10)];
    x %= 10;
    if (x) s += '-' + ONES[x];
  } else if (x > 0) {
    s += ONES[x];
  }
  return s;
}

/** Whole-number to words. 0 -> "ZERO". */
export function numberToWords(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return 'ZERO';
  const parts = [];
  let i = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(below1000(chunk) + SCALES[i]);
    n = Math.floor(n / 1000);
    i += 1;
  }
  return parts.join(' ').trim();
}

/**
 * Peso amount to the Form 51 words convention.
 * @param {number} total e.g. 423.27
 * @returns {string} e.g. "FOUR HUNDRED TWENTY-THREE PESOS AND 27/100"
 */
export function amountInWords(total) {
  const value = Number(total) || 0;
  const pesos = Math.floor(value);
  const centavos = Math.round((value - pesos) * 100);
  let words = numberToWords(pesos) + ' PESO' + (pesos === 1 ? '' : 'S');
  words += centavos ? ` AND ${String(centavos).padStart(2, '0')}/100` : ' ONLY';
  return words;
}

/** Peso number formatter: 1234.5 -> "1,234.50". */
export function formatPeso(n) {
  return Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}