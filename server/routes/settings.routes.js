const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const {
  getMunicipalitySettings,
  updateMunicipalitySettings,
  getAccountCodes,
} = require("../controllers/settings.controller");

// verifyToken applies to every settings route below (all reads/writes here
// require an authenticated user).
router.use(verifyToken);

router.get("/municipality", getMunicipalitySettings);
router.put("/municipality", updateMunicipalitySettings);

// Read-only lookup used to fill the ACCOUNT CODE column on Official Receipts.
// Any authenticated role may read it; editing codes would go through a
// dedicated admin route (not added here — codes are seeded via migration and
// edited directly for now).
router.get("/account-codes", getAccountCodes);

module.exports = router;