const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

// Audit logging must never block the action it's logging. A throw inside
// this helper is caught and swallowed (with a server-side console.error so
// it's not silently lost) rather than propagated, so a transient DB hiccup
// on the audit insert can't turn a correct login into a failed one.
async function safeAuditLog(userId, action, module, details) {
  try {
    await pool.query(
      "INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)",
      [userId, action, module, JSON.stringify(details)]
    );
  } catch (err) {
    console.error("Audit log write failed:", action, module, err.message);
  }
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const [rows] = await pool.query(
      "SELECT id, username, password_hash, full_name AS name, role, is_active FROM users WHERE username = ? LIMIT 1",
      [username]
    );

    const user = rows[0];
    if (!user || !user.is_active) {
      // user_id is null here on purpose — the username didn't resolve to a
      // valid, active account, so there's no real user_id to attribute this
      // to. audit_logs.user_id is nullable with ON DELETE SET NULL, so this
      // is a valid, schema-safe row.
      await safeAuditLog(null, "LOGIN_FAILED", "AUTH", {
        username,
        reason: !user ? "unknown_username" : "inactive_account",
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await safeAuditLog(user.id, "LOGIN_FAILED", "AUTH", {
        username,
        reason: "wrong_password",
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Audit log and last_login update both happen, but neither can block
    // the response — the login already succeeded by this point.
    await safeAuditLog(user.id, "LOGIN", "AUTH", { username: user.username });

    try {
      await pool.query("UPDATE users SET last_login = NOW() WHERE id = ?", [user.id]);
    } catch (err) {
      console.error("last_login update failed:", err.message);
    }

    res.json({
      token,
      user: { id: user.id, name: user.name, username: user.username, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const [rows] = await pool.query(
      "SELECT id, username, full_name AS name, role FROM users WHERE id = ?",
      [req.user.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    next(err);
  }
}

module.exports = { login, me };