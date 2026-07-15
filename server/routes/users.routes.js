const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const { getUsers, createUser, updateUser, toggleStatus } = require("../controllers/users.controller");

router.use(verifyToken, requireRole("Administrator"));

router.get("/", getUsers);
router.post("/", createUser);
router.put("/:id", updateUser);
router.patch("/:id/status", toggleStatus);

module.exports = router;