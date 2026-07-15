const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { getOwners, createOwner } = require("../controllers/owners.controller");

router.use(verifyToken);
router.get("/", getOwners);
router.post("/", createOwner);

module.exports = router;