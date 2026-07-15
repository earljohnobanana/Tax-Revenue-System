const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { getDashboard } = require("../controllers/dashboard.controller");

router.use(verifyToken);
router.get("/", getDashboard);

module.exports = router;