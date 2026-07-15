// ============================================================
// src/constants/businessOptions.js
//
// Static reference/config lists derived from the Sta. Catalina Revenue
// Code. These are NOT mock/sample data — they are the real dropdown
// option sets used across Business, Owner, and Assessment forms.
// Moved out of data/mockData.js, which is being retired.
// ============================================================

export const LINES_OF_BUSINESS = [
  "Grocery", "Restaurant", "Hardware", "Bakery", "Rice Retailer",
  "Pharmacy", "Salon", "Internet Cafe", "Agricultural Supply",
  "Convenience Store", "Water Refilling", "Retail Store",
  "Wholesale Store", "Manufacturing", "Sari-Sari Store",
  "Funeral Parlor", "Gas Station", "Pawnshop", "Carenderia", "Other",
];

export const BUSINESS_TYPES = [
  "Sole Proprietorship", "Partnership", "Corporation", "Cooperative",
];

export const KIND_OF_MARKET = [
  "General Merchandise", "Food & Beverage", "Services",
  "Agricultural Products", "Industrial", "Professional Services", "Others",
];

// Section 2A.02 business nature classifications — drives which tax
// bracket table server/utils/taxComputation.js applies via computeTax().
export const BUSINESS_NATURE = [
  { value: 'a', label: 'Manufacturer / Assembler / Processor / Brewer / Distiller' },
  { value: 'b', label: 'Wholesaler / Distributor / Dealer' },
  { value: 'c_a', label: 'Exporter — Manufacturer-based (Essential Commodities)' },
  { value: 'c_b', label: 'Exporter — Wholesaler-based (Essential Commodities)' },
  { value: 'c_d', label: 'Exporter — Retailer-based (Essential Commodities)' },
  { value: 'd', label: 'Retailer' },
  { value: 'e', label: 'Contractor / Independent Contractor' },
  { value: 'f', label: 'Bank / Financial Institution' },
  { value: 'g', label: 'Services (Cafes, Amusement, Real Estate, Travel, Hospitals, etc.)' },
];