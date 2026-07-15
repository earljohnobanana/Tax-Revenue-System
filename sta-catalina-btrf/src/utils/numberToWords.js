// src/utils/numberToWords.js
// Converts a peso amount into the written-out form used on the physical
// Accountable Form No. 51 receipt's "AMOUNT IN WORDS" line, e.g.
// 9680.00 -> "Nine Thousand Six Hundred Eighty Pesos Only"
// 1250.75 -> "One Thousand Two Hundred Fifty Pesos and 75/100 Only"

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function chunkToWords(n) {
  // n is 0-999
  let words = "";
  if (n >= 100) {
    words += `${ONES[Math.floor(n / 100)]} Hundred`;
    n %= 100;
    if (n > 0) words += " ";
  }
  if (n >= 20) {
    words += TENS[Math.floor(n / 10)];
    if (n % 10 > 0) words += `-${ONES[n % 10]}`;
  } else if (n > 0) {
    words += ONES[n];
  }
  return words;
}

function integerToWords(num) {
  if (num === 0) return "Zero";

  const scales = ["", "Thousand", "Million", "Billion"];
  const chunks = [];
  let remaining = num;

  while (remaining > 0) {
    chunks.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const parts = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    if (chunks[i] === 0) continue;
    const chunkWords = chunkToWords(chunks[i]);
    parts.push(scales[i] ? `${chunkWords} ${scales[i]}` : chunkWords);
  }

  return parts.join(" ");
}

// amount: number (e.g. 9680, 1250.75)
// Returns the full phrase ready to print, including "Pesos" / centavos / "Only".
export function amountToWords(amount) {
  const value = Number(amount) || 0;
  const pesos = Math.floor(value);
  const centavos = Math.round((value - pesos) * 100);

  const pesoWords = integerToWords(pesos);
  const pesoLabel = pesos === 1 ? "Peso" : "Pesos";

  if (centavos > 0) {
    return `${pesoWords} ${pesoLabel} and ${String(centavos).padStart(2, "0")}/100 Only`;
  }
  return `${pesoWords} ${pesoLabel} Only`;
}