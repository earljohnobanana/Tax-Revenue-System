const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { getBusinesses, createBusiness, updateBusiness, deleteBusiness } = require("../controllers/businesses.controller");

router.use(verifyToken);
router.get("/", getBusinesses);
router.post("/", createBusiness);
router.put("/:id", updateBusiness);
router.delete("/:id", deleteBusiness);

module.exports = router;