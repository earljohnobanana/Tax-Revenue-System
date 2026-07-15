// ============================================================
// MOCK DATA — Sta. Catalina BTRF Management System
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

export const mockOwners = [
  { id: "OWN-001", name: "JUAN DELA CRUZ",     address: "Brgy. Poblacion, Sta. Catalina",       contact: "09171234567", email: "juan@email.com",        tin: "123-456-789-000", businessCount: 2, status: "Active",   createdDate: "2020-01-15" },
  { id: "OWN-002", name: "MARIA SANTOS",        address: "Brgy. Calicoan, Sta. Catalina",        contact: "09182345678", email: "maria@email.com",       tin: "234-567-890-000", businessCount: 3, status: "Active",   createdDate: "2019-03-22" },
  { id: "OWN-003", name: "PEDRO REYES",         address: "Brgy. Caticugan, Sta. Catalina",       contact: "09193456789", email: "pedro@email.com",       tin: "345-678-901-000", businessCount: 1, status: "Active",   createdDate: "2021-06-10" },
  { id: "OWN-004", name: "ROSA GARCIA",         address: "Brgy. Casao, Sta. Catalina",           contact: "09204567890", email: "rosa@email.com",        tin: "456-789-012-000", businessCount: 2, status: "Active",   createdDate: "2018-11-05" },
  { id: "OWN-005", name: "ANTONIO LARA",        address: "Brgy. Dobdob, Sta. Catalina",          contact: "09215678901", email: "antonio@email.com",     tin: "567-890-123-000", businessCount: 1, status: "Inactive", createdDate: "2022-02-28" },
  { id: "OWN-006", name: "CARMEN VILLANUEVA",   address: "Brgy. Kabulacan, Sta. Catalina",       contact: "09226789012", email: "carmen@email.com",      tin: "678-901-234-000", businessCount: 4, status: "Active",   createdDate: "2017-08-14" },
  { id: "OWN-007", name: "JOSE MENDOZA",        address: "Brgy. Lungib, Sta. Catalina",          contact: "09237890123", email: "jose@email.com",        tin: "789-012-345-000", businessCount: 2, status: "Active",   createdDate: "2020-05-19" },
  { id: "OWN-008", name: "LOURDES RAMOS",       address: "Brgy. Malabugas, Sta. Catalina",       contact: "09248901234", email: "lourdes@email.com",     tin: "890-123-456-000", businessCount: 1, status: "Active",   createdDate: "2023-01-07" },
  { id: "OWN-009", name: "FRANCISCO TORRES",    address: "Brgy. Nagbo-alao, Sta. Catalina",      contact: "09259012345", email: "francisco@email.com",   tin: "901-234-567-000", businessCount: 3, status: "Active",   createdDate: "2016-09-30" },
  { id: "OWN-010", name: "ELENA FERNANDEZ",     address: "Brgy. Nagtabuan, Sta. Catalina",       contact: "09260123456", email: "elena@email.com",       tin: "012-345-678-000", businessCount: 2, status: "Active",   createdDate: "2021-12-01" },
  { id: "OWN-011", name: "ROBERTO AGUILAR",     address: "Brgy. Owacan, Sta. Catalina",          contact: "09271234567", email: "roberto@email.com",     tin: "111-222-333-000", businessCount: 1, status: "Active",   createdDate: "2019-07-15" },
  { id: "OWN-012", name: "TERESITA BAUTISTA",   address: "Brgy. Pakna-an, Sta. Catalina",        contact: "09282345678", email: "teresita@email.com",    tin: "222-333-444-000", businessCount: 2, status: "Active",   createdDate: "2020-10-20" },
  { id: "OWN-013", name: "MANUEL CASTILLO",     address: "Brgy. Patag, Sta. Catalina",           contact: "09293456789", email: "manuel@email.com",      tin: "333-444-555-000", businessCount: 3, status: "Inactive", createdDate: "2022-04-11" },
  { id: "OWN-014", name: "PILAR DELA TORRE",    address: "Brgy. Poblacion, Sta. Catalina",       contact: "09304567890", email: "pilar@email.com",       tin: "444-555-666-000", businessCount: 1, status: "Active",   createdDate: "2018-02-25" },
  { id: "OWN-015", name: "ANDRES MIRANDA",      address: "Brgy. Sandayong Norte, Sta. Catalina", contact: "09315678901", email: "andres@email.com",      tin: "555-666-777-000", businessCount: 2, status: "Active",   createdDate: "2017-06-08" },
  { id: "OWN-016", name: "LYDIA OCAMPO",        address: "Brgy. Sandayong Sur, Sta. Catalina",   contact: "09326789012", email: "lydia@email.com",       tin: "666-777-888-000", businessCount: 1, status: "Active",   createdDate: "2023-03-15" },
  { id: "OWN-017", name: "MARCELO SALAZAR",     address: "Brgy. Santa Cruz, Sta. Catalina",      contact: "09337890123", email: "marcelo@email.com",     tin: "777-888-999-000", businessCount: 2, status: "Active",   createdDate: "2021-08-22" },
  { id: "OWN-018", name: "VICTORIA SANTOS",     address: "Brgy. Tagpoypoy, Sta. Catalina",       contact: "09348901234", email: "victoria@email.com",    tin: "888-999-000-000", businessCount: 1, status: "Active",   createdDate: "2019-11-30" },
  { id: "OWN-019", name: "ALFREDO DELA PENA",   address: "Brgy. Tilaran, Sta. Catalina",         contact: "09359012345", email: "alfredo@email.com",     tin: "999-000-111-000", businessCount: 3, status: "Active",   createdDate: "2020-07-14" },
  { id: "OWN-020", name: "SOCORRO HERNANDEZ",   address: "Brgy. Tubog, Sta. Catalina",           contact: "09360123456", email: "socorro@email.com",     tin: "000-111-222-000", businessCount: 2, status: "Active",   createdDate: "2022-09-05" },
];

export const mockBusinesses = [
  { id: "BUS-001", name: "DELA CRUZ GROCERY",        ownerId: "OWN-001", ownerName: "JUAN DELA CRUZ",     type: "Sole Proprietorship", lineOfBusiness: "Grocery",           kindOfMarket: "General Merchandise",  address: "Brgy. Poblacion, Sta. Catalina",       dateRegistered: "2020-01-20", capitalInvestment: 250000,  status: "Active",   taxDueStatus: "Paid" },
  { id: "BUS-002", name: "DELA CRUZ BAKERY",          ownerId: "OWN-001", ownerName: "JUAN DELA CRUZ",     type: "Sole Proprietorship", lineOfBusiness: "Bakery",            kindOfMarket: "Food & Beverage",       address: "Brgy. Poblacion, Sta. Catalina",       dateRegistered: "2021-02-10", capitalInvestment: 150000,  status: "Active",   taxDueStatus: "Paid" },
  { id: "BUS-003", name: "SANTOS RESTAURANT",         ownerId: "OWN-002", ownerName: "MARIA SANTOS",       type: "Sole Proprietorship", lineOfBusiness: "Restaurant",        kindOfMarket: "Food & Beverage",       address: "Brgy. Calicoan, Sta. Catalina",        dateRegistered: "2019-03-25", capitalInvestment: 500000,  status: "Active",   taxDueStatus: "Unpaid" },
  { id: "BUS-004", name: "SANTOS PHARMACY",           ownerId: "OWN-002", ownerName: "MARIA SANTOS",       type: "Sole Proprietorship", lineOfBusiness: "Pharmacy",          kindOfMarket: "General Merchandise",  address: "Brgy. Calicoan, Sta. Catalina",        dateRegistered: "2019-03-25", capitalInvestment: 800000,  status: "Active",   taxDueStatus: "Paid" },
  { id: "BUS-005", name: "SANTOS SALON",              ownerId: "OWN-002", ownerName: "MARIA SANTOS",       type: "Sole Proprietorship", lineOfBusiness: "Salon",             kindOfMarket: "Services",              address: "Brgy. Calicoan, Sta. Catalina",        dateRegistered: "2022-06-01", capitalInvestment: 80000,   status: "Active",   taxDueStatus: "Paid" },
  { id: "BUS-006", name: "REYES HARDWARE",            ownerId: "OWN-003", ownerName: "PEDRO REYES",        type: "Sole Proprietorship", lineOfBusiness: "Hardware",          kindOfMarket: "General Merchandise",  address: "Brgy. Caticugan, Sta. Catalina",       dateRegistered: "2021-06-15", capitalInvestment: 1200000, status: "Active",   taxDueStatus: "Overdue" },
  { id: "BUS-007", name: "GARCIA SARI-SARI STORE",   ownerId: "OWN-004", ownerName: "ROSA GARCIA",        type: "Sole Proprietorship", lineOfBusiness: "Sari-Sari Store",   kindOfMarket: "General Merchandise",  address: "Brgy. Casao, Sta. Catalina",           dateRegistered: "2018-11-10", capitalInvestment: 50000,   status: "Active",   taxDueStatus: "Paid" },
  { id: "BUS-008", name: "GARCIA WATER REFILLING",   ownerId: "OWN-004", ownerName: "ROSA GARCIA",        type: "Sole Proprietorship", lineOfBusiness: "Water Refilling",   kindOfMarket: "Services",              address: "Brgy. Casao, Sta. Catalina",           dateRegistered: "2020-03-15", capitalInvestment: 200000,  status: "Active",   taxDueStatus: "Partial" },
  { id: "BUS-009", name: "LARA INTERNET CAFE",       ownerId: "OWN-005", ownerName: "ANTONIO LARA",       type: "Sole Proprietorship", lineOfBusiness: "Internet Cafe",     kindOfMarket: "Services",              address: "Brgy. Dobdob, Sta. Catalina",          dateRegistered: "2022-03-01", capitalInvestment: 300000,  status: "Inactive", taxDueStatus: "Unpaid" },
  { id: "BUS-010", name: "VILLANUEVA AGRI SUPPLY",   ownerId: "OWN-006", ownerName: "CARMEN VILLANUEVA",  type: "Sole Proprietorship", lineOfBusiness: "Agricultural Supply",kindOfMarket: "Agricultural Products", address: "Brgy. Kabulacan, Sta. Catalina",       dateRegistered: "2017-08-20", capitalInvestment: 950000,  status: "Active",   taxDueStatus: "Paid" },
  { id: "BUS-011", name: "MENDOZA RICE RETAILER",    ownerId: "OWN-007", ownerName: "JOSE MENDOZA",       type: "Sole Proprietorship", lineOfBusiness: "Rice Retailer",     kindOfMarket: "Agricultural Products", address: "Brgy. Lungib, Sta. Catalina",          dateRegistered: "2020-05-25", capitalInvestment: 400000,  status: "Active",   taxDueStatus: "Paid" },
  { id: "BUS-012", name: "RAMOS CONVENIENCE STORE",  ownerId: "OWN-008", ownerName: "LOURDES RAMOS",      type: "Sole Proprietorship", lineOfBusiness: "Convenience Store", kindOfMarket: "General Merchandise",  address: "Brgy. Malabugas, Sta. Catalina",       dateRegistered: "2023-01-10", capitalInvestment: 180000,  status: "Active",   taxDueStatus: "Paid" },
  { id: "BUS-013", name: "TORRES WHOLESALE",          ownerId: "OWN-009", ownerName: "FRANCISCO TORRES",   type: "Partnership",         lineOfBusiness: "Wholesale Store",   kindOfMarket: "General Merchandise",  address: "Brgy. Nagbo-alao, Sta. Catalina",      dateRegistered: "2016-10-05", capitalInvestment: 2500000, status: "Active",   taxDueStatus: "Paid" },
  { id: "BUS-014", name: "FERNANDEZ RETAIL",          ownerId: "OWN-010", ownerName: "ELENA FERNANDEZ",    type: "Sole Proprietorship", lineOfBusiness: "Retail Store",      kindOfMarket: "General Merchandise",  address: "Brgy. Nagtabuan, Sta. Catalina",       dateRegistered: "2021-12-05", capitalInvestment: 320000,  status: "Active",   taxDueStatus: "Unpaid" },
  { id: "BUS-015", name: "AGUILAR FUNERAL PARLOR",   ownerId: "OWN-011", ownerName: "ROBERTO AGUILAR",    type: "Sole Proprietorship", lineOfBusiness: "Funeral Parlor",    kindOfMarket: "Services",              address: "Brgy. Owacan, Sta. Catalina",          dateRegistered: "2019-07-20", capitalInvestment: 750000,  status: "Active",   taxDueStatus: "Overdue" },
  { id: "BUS-016", name: "BAUTISTA CARENDERIA",       ownerId: "OWN-012", ownerName: "TERESITA BAUTISTA",  type: "Sole Proprietorship", lineOfBusiness: "Carenderia",        kindOfMarket: "Food & Beverage",       address: "Brgy. Pakna-an, Sta. Catalina",        dateRegistered: "2020-10-25", capitalInvestment: 95000,   status: "Active",   taxDueStatus: "Paid" },
  { id: "BUS-017", name: "MIRANDA GAS STATION",       ownerId: "OWN-015", ownerName: "ANDRES MIRANDA",     type: "Sole Proprietorship", lineOfBusiness: "Gas Station",       kindOfMarket: "Services",              address: "Brgy. Sandayong Norte, Sta. Catalina", dateRegistered: "2017-06-15", capitalInvestment: 3500000, status: "Active",   taxDueStatus: "Paid" },
  { id: "BUS-018", name: "SALAZAR PAWNSHOP",          ownerId: "OWN-017", ownerName: "MARCELO SALAZAR",    type: "Sole Proprietorship", lineOfBusiness: "Pawnshop",          kindOfMarket: "Services",              address: "Brgy. Santa Cruz, Sta. Catalina",      dateRegistered: "2021-08-28", capitalInvestment: 1500000, status: "Active",   taxDueStatus: "Paid" },
  { id: "BUS-019", name: "TORRES RICE TRADING",       ownerId: "OWN-009", ownerName: "FRANCISCO TORRES",   type: "Partnership",         lineOfBusiness: "Rice Retailer",     kindOfMarket: "Agricultural Products", address: "Brgy. Nagbo-alao, Sta. Catalina",      dateRegistered: "2018-05-10", capitalInvestment: 850000,  status: "Active",   taxDueStatus: "Paid" },
  { id: "BUS-020", name: "DELA PENA AGRI SUPPLY",     ownerId: "OWN-019", ownerName: "ALFREDO DELA PENA",  type: "Sole Proprietorship", lineOfBusiness: "Agricultural Supply",kindOfMarket: "Agricultural Products", address: "Brgy. Tilaran, Sta. Catalina",         dateRegistered: "2020-07-20", capitalInvestment: 620000,  status: "Active",   taxDueStatus: "Partial" },
];

// NOTE: Every payment now has ownerId, paymentCategory, and all required fields
export const mockPayments = [
  {
    id: "PAY-001", ownerId: "OWN-001", businessId: "BUS-001",
    businessName: "DELA CRUZ GROCERY", ownerName: "JUAN DELA CRUZ",
    datePaid: "2025-01-15", orNumber: "2025-00001",
    taxType: "Business Tax", paymentCategory: "Business Tax",
    periodCovered: "2025", baseTax: 2500, interest: 0, penalty: 0,
    regulatoryFees: 0, totalPaid: 2500,
    processedBy: "TREASURER OBAÑANA", paymentMethod: "Full Payment",
  },
  {
    id: "PAY-002", ownerId: "OWN-001", businessId: "BUS-001",
    businessName: "DELA CRUZ GROCERY", ownerName: "JUAN DELA CRUZ",
    datePaid: "2025-01-15", orNumber: "2025-00002",
    taxType: "Mayor's Permit", paymentCategory: "Business Tax",
    periodCovered: "2025", baseTax: 500, interest: 0, penalty: 0,
    regulatoryFees: 0, totalPaid: 500,
    processedBy: "TREASURER OBAÑANA", paymentMethod: "Full Payment",
  },
  {
    id: "PAY-003", ownerId: "OWN-001", businessId: "BUS-002",
    businessName: "DELA CRUZ BAKERY", ownerName: "JUAN DELA CRUZ",
    datePaid: "2025-01-15", orNumber: "2025-00003",
    taxType: "Business Tax", paymentCategory: "Business Tax",
    periodCovered: "2025", baseTax: 1500, interest: 0, penalty: 0,
    regulatoryFees: 0, totalPaid: 1500,
    processedBy: "TREASURER OBAÑANA", paymentMethod: "Full Payment",
  },
  {
    id: "PAY-004", ownerId: "OWN-002", businessId: "BUS-003",
    businessName: "SANTOS RESTAURANT", ownerName: "MARIA SANTOS",
    datePaid: "2025-02-10", orNumber: "2025-00015",
    taxType: "Business Tax", paymentCategory: "Business Tax",
    periodCovered: "2025 Q1", baseTax: 1875, interest: 468.75, penalty: 0,
    regulatoryFees: 0, totalPaid: 2343.75,
    processedBy: "STAFF ALCOBER", paymentMethod: "Quarterly",
  },
  {
    id: "PAY-005", ownerId: "OWN-002", businessId: "BUS-004",
    businessName: "SANTOS PHARMACY", ownerName: "MARIA SANTOS",
    datePaid: "2025-01-18", orNumber: "2025-00016",
    taxType: "Business Tax", paymentCategory: "Business Tax",
    periodCovered: "2025", baseTax: 8000, interest: 0, penalty: 0,
    regulatoryFees: 0, totalPaid: 8000,
    processedBy: "STAFF ALCOBER", paymentMethod: "Full Payment",
  },
  {
    id: "PAY-006", ownerId: "OWN-002", businessId: "BUS-003",
    businessName: "SANTOS RESTAURANT", ownerName: "MARIA SANTOS",
    datePaid: "2025-01-18", orNumber: "2025-00017",
    taxType: "Mayor's Permit", paymentCategory: "Business Tax",
    periodCovered: "2025", baseTax: 500, interest: 0, penalty: 0,
    regulatoryFees: 0, totalPaid: 500,
    processedBy: "STAFF ALCOBER", paymentMethod: "Full Payment",
  },
  {
    id: "PAY-007", ownerId: "OWN-004", businessId: "BUS-007",
    businessName: "GARCIA SARI-SARI STORE", ownerName: "ROSA GARCIA",
    datePaid: "2025-01-18", orNumber: "2025-00008",
    taxType: "Business Tax", paymentCategory: "Business Tax",
    periodCovered: "2025", baseTax: 500, interest: 0, penalty: 0,
    regulatoryFees: 0, totalPaid: 500,
    processedBy: "TREASURER OBAÑANA", paymentMethod: "Full Payment",
  },
  {
    id: "PAY-008", ownerId: "OWN-006", businessId: "BUS-010",
    businessName: "VILLANUEVA AGRI SUPPLY", ownerName: "CARMEN VILLANUEVA",
    datePaid: "2025-01-20", orNumber: "2025-00020",
    taxType: "Business Tax", paymentCategory: "Business Tax",
    periodCovered: "2025", baseTax: 9500, interest: 0, penalty: 0,
    regulatoryFees: 0, totalPaid: 9500,
    processedBy: "STAFF ALCOBER", paymentMethod: "Full Payment",
  },
  {
    id: "PAY-009", ownerId: "OWN-007", businessId: "BUS-011",
    businessName: "MENDOZA RICE RETAILER", ownerName: "JOSE MENDOZA",
    datePaid: "2025-01-19", orNumber: "2025-00021",
    taxType: "Business Tax", paymentCategory: "Business Tax",
    periodCovered: "2025", baseTax: 4000, interest: 0, penalty: 0,
    regulatoryFees: 0, totalPaid: 4000,
    processedBy: "TREASURER OBAÑANA", paymentMethod: "Full Payment",
  },
  {
    id: "PAY-010", ownerId: "OWN-009", businessId: "BUS-013",
    businessName: "TORRES WHOLESALE", ownerName: "FRANCISCO TORRES",
    datePaid: "2025-01-17", orNumber: "2025-00018",
    taxType: "Business Tax", paymentCategory: "Business Tax",
    periodCovered: "2025", baseTax: 25000, interest: 0, penalty: 0,
    regulatoryFees: 0, totalPaid: 25000,
    processedBy: "TREASURER OBAÑANA", paymentMethod: "Full Payment",
  },
  {
    id: "PAY-011", ownerId: "OWN-009", businessId: "BUS-013",
    businessName: "TORRES WHOLESALE", ownerName: "FRANCISCO TORRES",
    datePaid: "2025-01-17", orNumber: "2025-00018",
    taxType: "Mayor's Permit", paymentCategory: "Business Tax",
    periodCovered: "2025", baseTax: 1000, interest: 0, penalty: 0,
    regulatoryFees: 0, totalPaid: 1000,
    processedBy: "TREASURER OBAÑANA", paymentMethod: "Full Payment",
  },
  {
    id: "PAY-012", ownerId: "OWN-012", businessId: "BUS-016",
    businessName: "BAUTISTA CARENDERIA", ownerName: "TERESITA BAUTISTA",
    datePaid: "2025-01-16", orNumber: "2025-00009",
    taxType: "Business Tax", paymentCategory: "Business Tax",
    periodCovered: "2025", baseTax: 950, interest: 0, penalty: 0,
    regulatoryFees: 0, totalPaid: 950,
    processedBy: "STAFF ALCOBER", paymentMethod: "Full Payment",
  },
  {
    id: "PAY-013", ownerId: "OWN-015", businessId: "BUS-017",
    businessName: "MIRANDA GAS STATION", ownerName: "ANDRES MIRANDA",
    datePaid: "2025-01-14", orNumber: "2025-00005",
    taxType: "Business Tax", paymentCategory: "Business Tax",
    periodCovered: "2025", baseTax: 35000, interest: 0, penalty: 0,
    regulatoryFees: 0, totalPaid: 35000,
    processedBy: "TREASURER OBAÑANA", paymentMethod: "Full Payment",
  },
  {
    id: "PAY-014", ownerId: "OWN-017", businessId: "BUS-018",
    businessName: "SALAZAR PAWNSHOP", ownerName: "MARCELO SALAZAR",
    datePaid: "2025-01-20", orNumber: "2025-00022",
    taxType: "Business Tax", paymentCategory: "Business Tax",
    periodCovered: "2025", baseTax: 15000, interest: 0, penalty: 0,
    regulatoryFees: 0, totalPaid: 15000,
    processedBy: "TREASURER OBAÑANA", paymentMethod: "Full Payment",
  },
  // Regulatory Fee payments
  {
    id: "PAY-015", ownerId: "OWN-001", businessId: "BUS-001",
    businessName: "DELA CRUZ GROCERY", ownerName: "JUAN DELA CRUZ",
    datePaid: "2025-01-15", orNumber: "2025-00004",
    taxType: "Regulatory Fees", paymentCategory: "Regulatory Fees",
    periodCovered: "2025", baseTax: 0, interest: 0, penalty: 0,
    regulatoryFees: 450, totalPaid: 450,
    processedBy: "TREASURER OBAÑANA", paymentMethod: "Full Payment",
    feeDetails: "Sanitary Permit Fee (₱200.00), Health Certificate Fee (₱150.00), PESO Fee (₱100.00)",
  },
  {
    id: "PAY-016", ownerId: "OWN-002", businessId: "BUS-003",
    businessName: "SANTOS RESTAURANT", ownerName: "MARIA SANTOS",
    datePaid: "2025-01-18", orNumber: "2025-00019",
    taxType: "Regulatory Fees", paymentCategory: "Regulatory Fees",
    periodCovered: "2025", baseTax: 0, interest: 0, penalty: 0,
    regulatoryFees: 900, totalPaid: 900,
    processedBy: "STAFF ALCOBER", paymentMethod: "Full Payment",
    feeDetails: "Sanitary Permit Fee (₱200.00), Health Certificate Fee (₱150.00), Fire Safety Inspection Fee (₱300.00), Solid Waste Management Fee (₱250.00)",
  },
  {
    id: "PAY-017", ownerId: "OWN-009", businessId: "BUS-013",
    businessName: "TORRES WHOLESALE", ownerName: "FRANCISCO TORRES",
    datePaid: "2025-01-17", orNumber: "2025-00023",
    taxType: "Regulatory Fees", paymentCategory: "Regulatory Fees",
    periodCovered: "2025", baseTax: 0, interest: 0, penalty: 0,
    regulatoryFees: 1250, totalPaid: 1250,
    processedBy: "TREASURER OBAÑANA", paymentMethod: "Full Payment",
    feeDetails: "Sanitary Permit Fee (₱200.00), Fire Safety Inspection Fee (₱300.00), Solid Waste Management Fee (₱250.00), Certificate of Occupancy Fee (₱500.00)",
  },
  {
    id: "PAY-018", ownerId: "OWN-015", businessId: "BUS-017",
    businessName: "MIRANDA GAS STATION", ownerName: "ANDRES MIRANDA",
    datePaid: "2025-01-14", orNumber: "2025-00024",
    taxType: "Regulatory Fees", paymentCategory: "Regulatory Fees",
    periodCovered: "2025", baseTax: 0, interest: 0, penalty: 0,
    regulatoryFees: 1050, totalPaid: 1050,
    processedBy: "TREASURER OBAÑANA", paymentMethod: "Full Payment",
    feeDetails: "Sanitary Permit Fee (₱200.00), Fire Safety Inspection Fee (₱300.00), Zoning Clearance Fee (₱200.00), PESO Fee (₱100.00), Solid Waste Management Fee (₱250.00)",
  },
];

export const mockRegulatoryFees = [
  { id: "REG-001", name: "Sanitary Permit Fee",          amount: 200,  description: "Annual sanitary permit issued by the Municipal Health Office", status: "Active" },
  { id: "REG-002", name: "Health Certificate Fee",       amount: 150,  description: "Health certificate for food business owners and handlers",     status: "Active" },
  { id: "REG-003", name: "PESO Fee",                     amount: 100,  description: "Public Employment Service Office registration fee",            status: "Active" },
  { id: "REG-004", name: "Solid Waste Management Fee",   amount: 250,  description: "Annual solid waste management collection fee",                 status: "Active" },
  { id: "REG-005", name: "Inspection Fee",               amount: 300,  description: "Annual business inspection",                                   status: "Active" },
  { id: "REG-006", name: "Certificate of Occupancy Fee", amount: 500,  description: "Certificate of occupancy for commercial establishments",       status: "Active" },
];

export const mockAssessments = [
  { id: "ASS-001", businessId: "BUS-001", businessName: "DELA CRUZ GROCERY",       ownerName: "JUAN DELA CRUZ",     year: 2025, assessmentAmount: 2500,  taxType: "Business Tax", capitalInvestment: 250000,  status: "Paid" },
  { id: "ASS-002", businessId: "BUS-003", businessName: "SANTOS RESTAURANT",       ownerName: "MARIA SANTOS",       year: 2025, assessmentAmount: 7500,  taxType: "Business Tax", capitalInvestment: 500000,  status: "Partial" },
  { id: "ASS-003", businessId: "BUS-006", businessName: "REYES HARDWARE",          ownerName: "PEDRO REYES",        year: 2025, assessmentAmount: 18000, taxType: "Business Tax", capitalInvestment: 1200000, status: "Overdue" },
  { id: "ASS-004", businessId: "BUS-010", businessName: "VILLANUEVA AGRI SUPPLY",  ownerName: "CARMEN VILLANUEVA",  year: 2025, assessmentAmount: 9500,  taxType: "Business Tax", capitalInvestment: 950000,  status: "Paid" },
  { id: "ASS-005", businessId: "BUS-013", businessName: "TORRES WHOLESALE",        ownerName: "FRANCISCO TORRES",   year: 2025, assessmentAmount: 25000, taxType: "Business Tax", capitalInvestment: 2500000, status: "Paid" },
  { id: "ASS-006", businessId: "BUS-014", businessName: "FERNANDEZ RETAIL",        ownerName: "ELENA FERNANDEZ",    year: 2025, assessmentAmount: 3200,  taxType: "Business Tax", capitalInvestment: 320000,  status: "Unpaid" },
  { id: "ASS-007", businessId: "BUS-015", businessName: "AGUILAR FUNERAL PARLOR",  ownerName: "ROBERTO AGUILAR",    year: 2025, assessmentAmount: 11250, taxType: "Business Tax", capitalInvestment: 750000,  status: "Overdue" },
  { id: "ASS-008", businessId: "BUS-017", businessName: "MIRANDA GAS STATION",     ownerName: "ANDRES MIRANDA",     year: 2025, assessmentAmount: 35000, taxType: "Business Tax", capitalInvestment: 3500000, status: "Paid" },
];

export const mockDelinquent = [
  { id: "DEL-001", businessId: "BUS-006", businessName: "REYES HARDWARE",          ownerName: "PEDRO REYES",       contact: "09193456789", address: "Brgy. Caticugan",  dueDate: "2025-01-20", daysOverdue: 146, taxType: "Business Tax",    amountDue: 18000,  interest: 4500,   penalty: 0, totalDue: 22500 },
  { id: "DEL-002", businessId: "BUS-015", businessName: "AGUILAR FUNERAL PARLOR",  ownerName: "ROBERTO AGUILAR",   contact: "09271234567", address: "Brgy. Owacan",     dueDate: "2025-01-20", daysOverdue: 146, taxType: "Business Tax",    amountDue: 11250,  interest: 2812.50, penalty: 0, totalDue: 14062.50 },
  { id: "DEL-003", businessId: "BUS-003", businessName: "SANTOS RESTAURANT",       ownerName: "MARIA SANTOS",      contact: "09182345678", address: "Brgy. Calicoan",   dueDate: "2025-04-20", daysOverdue: 56,  taxType: "Business Tax Q2", amountDue: 1875,   interest: 468.75, penalty: 0, totalDue: 2343.75 },
  { id: "DEL-004", businessId: "BUS-009", businessName: "LARA INTERNET CAFE",      ownerName: "ANTONIO LARA",      contact: "09215678901", address: "Brgy. Dobdob",     dueDate: "2025-01-20", daysOverdue: 146, taxType: "Business Tax",    amountDue: 3000,   interest: 750,    penalty: 0, totalDue: 3750 },
  { id: "DEL-005", businessId: "BUS-014", businessName: "FERNANDEZ RETAIL",        ownerName: "ELENA FERNANDEZ",   contact: "09260123456", address: "Brgy. Nagtabuan",  dueDate: "2025-01-20", daysOverdue: 146, taxType: "Business Tax",    amountDue: 3200,   interest: 800,    penalty: 0, totalDue: 4000 },
];

export const mockAuditLogs = [
  { id: "LOG-001", timestamp: "2025-06-15 08:32:11", user: "TREASURER OBAÑANA", action: "LOGIN",   module: "System",         details: "Successful login",                                                         ip: "192.168.1.5" },
  { id: "LOG-002", timestamp: "2025-06-15 09:14:22", user: "TREASURER OBAÑANA", action: "PAYMENT", module: "Payments",       details: "Recorded BT OR# 2025-00018 — Torres Wholesale ₱25,000.00",               ip: "192.168.1.5" },
  { id: "LOG-003", timestamp: "2025-06-15 09:45:10", user: "STAFF ALCOBER",     action: "LOGIN",   module: "System",         details: "Successful login",                                                         ip: "192.168.1.12" },
  { id: "LOG-004", timestamp: "2025-06-15 10:05:44", user: "STAFF ALCOBER",     action: "ADD",     module: "Businesses",     details: "Added new business: SANTOS PHARMACY (BUS-004)",                           ip: "192.168.1.12" },
  { id: "LOG-005", timestamp: "2025-06-15 10:30:18", user: "STAFF ALCOBER",     action: "EDIT",    module: "Owners",         details: "Edited owner OWN-003: PEDRO REYES — updated contact number",              ip: "192.168.1.12" },
  { id: "LOG-006", timestamp: "2025-06-15 11:00:55", user: "TREASURER OBAÑANA", action: "PAYMENT", module: "Payments",       details: "Recorded Mayor's Permit OR# 2025-00022 — Salazar Pawnshop",               ip: "192.168.1.5" },
  { id: "LOG-007", timestamp: "2025-06-15 11:22:33", user: "ADMIN USER",        action: "LOGIN",   module: "System",         details: "Successful login",                                                         ip: "192.168.1.2" },
  { id: "LOG-008", timestamp: "2025-06-15 11:45:09", user: "ADMIN USER",        action: "ADD",     module: "User Management",details: "Added new user: STAFF CABALLES (Accounting Staff)",                       ip: "192.168.1.2" },
  { id: "LOG-009", timestamp: "2025-06-15 13:10:22", user: "TREASURER OBAÑANA", action: "PAYMENT", module: "Payments",       details: "Recorded Reg. Fees OR# 2025-00023 — Torres Wholesale ₱1,250.00",          ip: "192.168.1.5" },
  { id: "LOG-010", timestamp: "2025-06-15 14:05:00", user: "STAFF ALCOBER",     action: "DELETE",  module: "Payments",       details: "Deleted payment PAY-003 (duplicate entry)",                                ip: "192.168.1.12" },
];

export const mockUsers = [
  { id: 1, username: "admin",      name: "ADMIN USER",          role: "Administrator",    office: "Municipal Administrator",          status: "Active",   lastLogin: "2025-06-15 11:22:33" },
  { id: 2, username: "treasurer",  name: "BERNADETTE OBAÑANA",  role: "Treasurer",        office: "Municipal Treasurer's Office",      status: "Active",   lastLogin: "2025-06-15 08:32:11" },
  { id: 3, username: "bplo",       name: "JOHN ALCOBER",        role: "BPLO Staff",       office: "Business Permit & Licensing Office", status: "Active",   lastLogin: "2025-06-15 09:45:10" },
  { id: 4, username: "accounting", name: "MARY JOY CABALLES",   role: "Accounting Staff", office: "Accounting Office",                 status: "Active",   lastLogin: "2025-06-14 13:20:00" },
  { id: 5, username: "viewer",     name: "JOSE DELOS REYES",    role: "Viewer",           office: "Municipal Administrator",           status: "Inactive", lastLogin: "2025-05-30 09:00:00" },
];

export const monthlyRevenueData = [
  { month: "Jan", businessTax: 125000, mayorPermit: 45000, regulatoryFees: 28000 },
  { month: "Feb", businessTax: 85000,  mayorPermit: 22000, regulatoryFees: 18000 },
  { month: "Mar", businessTax: 45000,  mayorPermit: 12000, regulatoryFees: 9000  },
  { month: "Apr", businessTax: 62000,  mayorPermit: 15000, regulatoryFees: 11000 },
  { month: "May", businessTax: 38000,  mayorPermit: 9000,  regulatoryFees: 7500  },
  { month: "Jun", businessTax: 95000,  mayorPermit: 28000, regulatoryFees: 15000 },
  { month: "Jul", businessTax: 72000,  mayorPermit: 18000, regulatoryFees: 12000 },
  { month: "Aug", businessTax: 41000,  mayorPermit: 11000, regulatoryFees: 8000  },
  { month: "Sep", businessTax: 35000,  mayorPermit: 8500,  regulatoryFees: 6500  },
  { month: "Oct", businessTax: 58000,  mayorPermit: 14000, regulatoryFees: 10500 },
  { month: "Nov", businessTax: 29000,  mayorPermit: 7200,  regulatoryFees: 5500  },
  { month: "Dec", businessTax: 22000,  mayorPermit: 5500,  regulatoryFees: 4200  },
];

export const quarterlyData = [
  { quarter: "Q1 2025", amount: 385000 },
  { quarter: "Q2 2025", amount: 285000 },
  { quarter: "Q3 2025", amount: 248000 },
  { quarter: "Q4 2025", amount: 109200 },
];

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