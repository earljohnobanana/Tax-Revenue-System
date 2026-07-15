const { pool } = require("../config/db");

function mapAuditLog(row) {
  return {
    id: row.id,
    userId: row.user_id,
    // u.full_name can be NULL if the user account was later deleted —
    // audit_logs.user_id has no FK constraint forcing the row to stay
    // valid (and shouldn't: a deleted user's history must still be
    // visible). Falls back to a clear placeholder rather than showing
    // a blank cell that looks like a bug.
    user: row.user_full_name || (row.user_id ? `User #${row.user_id}` : "System"),
    action: row.action,
    module: row.module,
    // details is stored as JSON; mysql2 already parses JSON columns
    // into real JS objects/arrays automatically, so this is passed
    // through as-is rather than re-parsed.
    details: row.details,
    createdAt: row.created_at,
  };
}

// Pagination + filtering — audit logs grow unbounded over time (every
// payment, assessment, login, edit, and delete across this whole
// system writes one), so this can never be a flat unfiltered dump; the
// same server-side-processing principle already applied to every other
// list page (Payments, Assessments, etc.) in this project.
async function getAuditLogs(req, res, next) {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      module: moduleFilter, // `module` shadows the Node module-system word if destructured directly
      userId,
      dateFrom,
      dateTo,
      search,
    } = req.query;

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 50, 1), 200); // hard ceiling so a bad query string can't request an unbounded page size
    const offset = (pageNum - 1) * limitNum;

    const where = [];
    const params = [];

    if (action) {
      where.push("al.action = ?");
      params.push(action);
    }
    if (moduleFilter) {
      where.push("al.module = ?");
      params.push(moduleFilter);
    }
    if (userId) {
      where.push("al.user_id = ?");
      params.push(Number(userId));
    }
    if (dateFrom) {
      where.push("al.created_at >= ?");
      params.push(`${dateFrom} 00:00:00`);
    }
    if (dateTo) {
      where.push("al.created_at <= ?");
      params.push(`${dateTo} 23:59:59`);
    }
    if (search) {
      // Matches against user name, action, or module — NOT against
      // `details` (a JSON column), since LIKE on a JSON column's raw
      // serialized text is unreliable across MySQL versions and would
      // give misleading partial matches. Free-text search inside
      // `details` would need a dedicated approach (JSON_SEARCH or a
      // generated column) if that's ever actually needed.
      where.push("(u.full_name LIKE ? OR al.action LIKE ? OR al.module LIKE ?)");
      const likeTerm = `%${search}%`;
      params.push(likeTerm, likeTerm, likeTerm);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT al.*, u.full_name AS user_full_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({
      logs: rows.map(mapAuditLog),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}

// Powers the filter dropdowns (Action, Module) with real distinct
// values that actually exist in the data, instead of a hardcoded list
// that could drift out of sync with whatever action/module strings
// controllers actually write (e.g. if a new action type gets added to
// some controller later, this picks it up automatically with no
// frontend change needed).
async function getAuditLogFilterOptions(req, res, next) {
  try {
    const [actionRows] = await pool.query(
      "SELECT DISTINCT action FROM audit_logs ORDER BY action ASC"
    );
    const [moduleRows] = await pool.query(
      "SELECT DISTINCT module FROM audit_logs ORDER BY module ASC"
    );

    res.json({
      actions: actionRows.map((r) => r.action),
      modules: moduleRows.map((r) => r.module),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAuditLogs, getAuditLogFilterOptions };