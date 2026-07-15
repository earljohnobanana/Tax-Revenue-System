const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { VALID_ROLES } = require("../utils/roles");

async function getUsers(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT id, username, full_name AS name, office, role,
              is_active, last_login AS lastLogin
       FROM users ORDER BY full_name ASC`
    );
    const users = rows.map((u) => ({
      ...u,
      status: u.is_active ? "Active" : "Inactive",
      lastLogin: u.lastLogin
        ? new Date(u.lastLogin).toLocaleString()
        : "—",
    }));
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const { name, username, password, role, office } = req.body;
    if (!name || !username || !password || !role) {
      return res.status(400).json({ message: "Name, username, password, and role are required" });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(422).json({ message: `Invalid role: "${role}"` });
    }

    const [existing] = await pool.query("SELECT id FROM users WHERE username = ?", [username]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      "INSERT INTO users (username, password_hash, full_name, office, role, is_active) VALUES (?, ?, ?, ?, ?, 1)",
      [username, password_hash, name, office || null, role]
    );

    await pool.query(
      "INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, 'CREATE_USER', 'USER_MANAGEMENT', JSON_OBJECT('created_username', ?, 'created_by', ?))",
      [req.user.id, username, req.user.username]
    );

    res.status(201).json({
      id: result.insertId,
      username, name, office, role,
      status: "Active",
      lastLogin: "—",
    });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { name, role, office } = req.body;
    const { id } = req.params;

    if (role && !VALID_ROLES.includes(role)) {
      return res.status(422).json({ message: `Invalid role: "${role}"` });
    }

    const [result] = await pool.query(
      "UPDATE users SET full_name = COALESCE(?, full_name), role = COALESCE(?, role), office = COALESCE(?, office) WHERE id = ?",
      [name || null, role || null, office || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    await pool.query(
      "INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, 'UPDATE_USER', 'USER_MANAGEMENT', JSON_OBJECT('target_user_id', ?))",
      [req.user.id, id]
    );

    res.json({ message: "User updated" });
  } catch (err) {
    next(err);
  }
}

async function toggleStatus(req, res, next) {
  try {
    const { id } = req.params;

    if (Number(id) === req.user.id) {
      return res.status(400).json({ message: "You cannot deactivate your own account" });
    }

    const [rows] = await pool.query("SELECT is_active FROM users WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    const newStatus = rows[0].is_active ? 0 : 1;
    await pool.query("UPDATE users SET is_active = ? WHERE id = ?", [newStatus, id]);

    await pool.query(
      "INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, ?, 'USER_MANAGEMENT', JSON_OBJECT('target_user_id', ?))",
      [req.user.id, newStatus ? "ACTIVATE_USER" : "DEACTIVATE_USER", id]
    );

    res.json({ message: newStatus ? "User activated" : "User deactivated", status: newStatus ? "Active" : "Inactive" });
  } catch (err) {
    next(err);
  }
}

module.exports = { getUsers, createUser, updateUser, toggleStatus };