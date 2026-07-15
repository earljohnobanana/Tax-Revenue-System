const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { getRegulatoryFees } = require("../controllers/regulatoryFees.controller");

router.use(verifyToken);
router.get("/", getRegulatoryFees);

module.exports = router;