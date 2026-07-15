const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAll,
} = require("../controllers/notifications.controller");

router.use(verifyToken);

router.get("/", getNotifications);
router.patch("/:id/read", markAsRead);
router.patch("/read-all", markAllAsRead);
router.delete("/:id", deleteNotification);
router.delete("/", clearAll);

module.exports = router;