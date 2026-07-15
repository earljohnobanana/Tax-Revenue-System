const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");

const {
  getAuditLogs,
  getAuditLogFilterOptions,
} = require("../controllers/auditLogs.controller");

router.use(verifyToken);

// Named route before the bare GET / — same ordering rule already
// applied elsewhere in this codebase (e.g. assessments.routes.js's
// /compute-tax and /payable before its own bare GET /).
router.get("/filter-options", getAuditLogFilterOptions);
router.get("/", getAuditLogs);

module.exports = router;