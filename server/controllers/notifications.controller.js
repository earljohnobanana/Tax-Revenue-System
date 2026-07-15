const { pool } = require("../config/db");

async function getNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      `SELECT id, title, message, type, is_read AS \`read\`, created_at AS time
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?",
      [userId]
    );

    const [[{ unread }]] = await pool.query(
      "SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0",
      [userId]
    );

    res.json({
      notifications: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      unreadCount: unread,
    });
  } catch (err) {
    next(err);
  }
}

async function markAsRead(req, res, next) {
  try {
    await pool.query(
      "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );
    res.json({ message: "Notification marked as read" });
  } catch (err) {
    next(err);
  }
}

async function markAllAsRead(req, res, next) {
  try {
    await pool.query(
      "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
      [req.user.id]
    );
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
}

async function deleteNotification(req, res, next) {
  try {
    await pool.query(
      "DELETE FROM notifications WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );
    res.json({ message: "Notification deleted" });
  } catch (err) {
    next(err);
  }
}

async function clearAll(req, res, next) {
  try {
    await pool.query("DELETE FROM notifications WHERE user_id = ?", [req.user.id]);
    res.json({ message: "All notifications cleared" });
  } catch (err) {
    next(err);
  }
}

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification, clearAll };