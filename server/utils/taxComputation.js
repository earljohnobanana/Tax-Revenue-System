// server/utils/taxComputation.js
// Tax engine — Sta. Catalina Local Government Revenue Code, Section 2A.02
// Sections: (a) Manufacturer, (b) Wholesaler, (c) Exporter, (d) Retailer,
//           (e) Contractor, (f) Banks, (g) Services

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ── (a) Manufacturer / Assembler / Processor / Brewer / Distiller ──
const MANUFACTURER_BRACKETS = [
  { upTo: 10000, tax: 181.50 },
  { upTo: 15000, tax: 242.00 },
  { upTo: 20000, tax: 332.20 },
  { upTo: 30000, tax: 484.00 },
  { upTo: 40000, tax: 726.00 },
  { upTo: 50000, tax: 907.50 },
  { upTo: 75000, tax: 1452.00 },
  { upTo: 100000, tax: 1815.00 },
  { upTo: 150000, tax: 2420.00 },
  { upTo: 200000, tax: 3025.00 },
  { upTo: 300000, tax: 4235.00 },
  { upTo: 500000, tax: 6050.00 },
  { upTo: 750000, tax: 8800.00 },
  { upTo: 1000000, tax: 11000.00 },
  { upTo: 2000000, tax: 15125.00 },
  { upTo: 3000000, tax: 18150.00 },
  { upTo: 4000000, tax: 21780.00 },
  { upTo: 5000000, tax: 25410.00 },
  { upTo: 6500000, tax: 26812.50 },
];
const MANUFACTURER_RATE_ABOVE = 0.004125; // 41.25% of 1%, >= 6,500,000

function computeManufacturerTax(grossSales) {
  for (const b of MANUFACTURER_BRACKETS) {
    if (grossSales < b.upTo) return b.tax;
  }
  return round2(grossSales * MANUFACTURER_RATE_ABOVE);
}

// ── (b) Wholesaler / Distributor / Dealer ──
const WHOLESALER_BRACKETS = [
  { upTo: 1000, tax: 19.80 },
  { upTo: 2000, tax: 36.30 },
  { upTo: 3000, tax: 55.00 },
  { upTo: 4000, tax: 79.20 },
  { upTo: 5000, tax: 110.00 },
  { upTo: 6000, tax: 133.10 },
  { upTo: 7000, tax: 157.30 },
  { upTo: 8000, tax: 181.15 },
  { upTo: 10000, tax: 205.70 },
  { upTo: 15000, tax: 242.00 },
  { upTo: 20000, tax: 302.50 },
  { upTo: 30000, tax: 363.00 },
  { upTo: 40000, tax: 484.00 },
  { upTo: 50000, tax: 726.00 },
  { upTo: 75000, tax: 1089.00 },
  { upTo: 100000, tax: 1452.00 },
  { upTo: 150000, tax: 2057.00 },
  { upTo: 200000, tax: 2662.00 },
  { upTo: 300000, tax: 3630.00 },
  { upTo: 500000, tax: 4840.00 },
  { upTo: 750000, tax: 7260.00 },
  { upTo: 1000000, tax: 9680.00 },
  { upTo: 2000000, tax: 11000.00 },
];
const WHOLESALER_RATE_ABOVE = 0.0055; // 55% of 1%, >= 2,000,000

function computeWholesalerTax(grossSales) {
  for (const b of WHOLESALER_BRACKETS) {
    if (grossSales < b.upTo) return b.tax;
  }
  return round2(grossSales * WHOLESALER_RATE_ABOVE);
}

// ── (d) Retailer — blended marginal rate ──
function computeRetailerTax(grossSales) {
  if (grossSales <= 400000) return round2(grossSales * 0.02);
  return round2(400000 * 0.02 + (grossSales - 400000) * 0.01);
}

// ── (c) Exporter / Essential-Commodity Dealer — half of (a), (b), or (d) ──
function computeExporterTax(grossSales, baseSection) {
  let baseTax;
  switch (baseSection) {
    case 'a': baseTax = computeManufacturerTax(grossSales); break;
    case 'b': baseTax = computeWholesalerTax(grossSales); break;
    case 'd': baseTax = computeRetailerTax(grossSales); break;
    default:
      throw new Error(`Exporter business_nature requires base section a, b, or d — got "${baseSection}"`);
  }
  return round2(baseTax * 0.5);
}

// ── (e) Contractor / Independent Contractor ──
const CONTRACTOR_BRACKETS = [
  { upTo: 5000, tax: 30.25 },
  { upTo: 10000, tax: 67.76 },
  { upTo: 15000, tax: 114.95 },
  { upTo: 20000, tax: 181.50 },
  { upTo: 30000, tax: 302.50 },
  { upTo: 40000, tax: 423.50 },
  { upTo: 50000, tax: 605.00 },
  { upTo: 75000, tax: 968.00 },
  { upTo: 100000, tax: 1452.00 },
  { upTo: 150000, tax: 2178.00 },
  { upTo: 200000, tax: 2904.00 },
  { upTo: 250000, tax: 3993.00 },
  { upTo: 300000, tax: 5082.00 },
  { upTo: 400000, tax: 6776.00 },
  { upTo: 500000, tax: 9075.00 },
  { upTo: 750000, tax: 10175.00 },
  { upTo: 1000000, tax: 11275.00 },
  { upTo: 2000000, tax: 12650.00 },
];
const CONTRACTOR_RATE_ABOVE = 0.0055; // 55% of 1%, >= 2,000,000

function computeContractorTax(grossSales) {
  for (const b of CONTRACTOR_BRACKETS) {
    if (grossSales < b.upTo) return b.tax;
  }
  return round2(grossSales * CONTRACTOR_RATE_ABOVE);
}

// ── (f) Banks & Financial Institutions — flat rate, NOT bracketed ──
const BANKS_RATE = 0.0055; // 55% of 1% of gross receipts

function computeBanksTax(grossReceipts) {
  return round2(grossReceipts * BANKS_RATE);
}

// ── (g) Services ──
const SERVICES_BRACKETS = [
  { upTo: 5000, tax: 33.27 },
  { upTo: 10000, tax: 74.53 },
  { upTo: 15000, tax: 126.24 },
  { upTo: 20000, tax: 199.65 },
  { upTo: 30000, tax: 332.75 },
  { upTo: 40000, tax: 465.85 },
  { upTo: 50000, tax: 665.50 },
  { upTo: 75000, tax: 1064.80 },
  { upTo: 100000, tax: 1597.20 },
  { upTo: 150000, tax: 2395.80 },
  { upTo: 200000, tax: 3194.40 },
  { upTo: 250000, tax: 4392.30 },
  { upTo: 300000, tax: 5590.20 },
  { upTo: 400000, tax: 7453.60 },
  { upTo: 500000, tax: 9982.25 },
  { upTo: 750000, tax: 11192.50 },
  { upTo: 1000000, tax: 12402.50 },
  { upTo: 2000000, tax: 13195.00 },
];
const SERVICES_RATE_ABOVE = 0.0055; // 55% of 1%, >= 2,000,000
// TODO: ordinance has a minimum-tax floor for the 2,000,000+ tier that was
// cut off in the source photo. Verify against the printed ordinance before
// relying on this tier for a real assessment above ₱2M gross sales.

function computeServicesTax(grossSales) {
  for (const b of SERVICES_BRACKETS) {
    if (grossSales < b.upTo) return b.tax;
  }
  return round2(grossSales * SERVICES_RATE_ABOVE);
}

// ── Dispatcher ──
const VALID_SECTIONS = ['a', 'b', 'c_a', 'c_b', 'c_d', 'd', 'e', 'f', 'g'];

function computeTax(businessNature, grossSales) {
  if (!businessNature) {
    throw new Error('business_nature is not set for this business');
  }
  if (businessNature.startsWith('c_')) {
    const baseSection = businessNature.split('_')[1];
    return { tax: computeExporterTax(grossSales, baseSection), section: businessNature };
  }
  switch (businessNature) {
    case 'a': return { tax: computeManufacturerTax(grossSales), section: 'a' };
    case 'b': return { tax: computeWholesalerTax(grossSales), section: 'b' };
    case 'd': return { tax: computeRetailerTax(grossSales), section: 'd' };
    case 'e': return { tax: computeContractorTax(grossSales), section: 'e' };
    case 'f': return { tax: computeBanksTax(grossSales), section: 'f' };
    case 'g': return { tax: computeServicesTax(grossSales), section: 'g' };
    default:
      throw new Error(`Unknown business_nature: "${businessNature}"`);
  }
}

module.exports = {
  computeTax,
  VALID_SECTIONS,
  computeManufacturerTax,
  computeWholesalerTax,
  computeExporterTax,
  computeRetailerTax,
  computeContractorTax,
  computeBanksTax,
  computeServicesTax,
};