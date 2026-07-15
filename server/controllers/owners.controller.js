const { pool } = require("../config/db");

async function getOwners(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT o.*,
        (SELECT COUNT(*) FROM businesses b WHERE b.owner_id = o.id) AS businessCount,
        (SELECT COALESCE(SUM(p.total_paid),0) FROM payments p WHERE p.owner_id = o.id) AS totalPaid
      FROM owners o
      ORDER BY o.name ASC
    `);
    res.json({
      owners: rows.map((o) => ({
        id: o.id, name: o.name, address: o.address, contact: o.contact,
        email: o.email, tin: o.tin, remarks: o.remarks, status: o.status,
        createdDate: o.created_date, businessCount: o.businessCount, totalPaid: o.totalPaid,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function createOwner(req, res, next) {
  try {
    const { name, address, contact, email, tin, remarks } = req.body;
    if (!name) return res.status(400).json({ message: "Owner name is required" });

    const [[{ maxNum }]] = await pool.query(
      "SELECT COALESCE(MAX(CAST(SUBSTRING(id, 5) AS UNSIGNED)), 0) AS maxNum FROM owners"
    );
    const id = `OWN-${String(maxNum + 1).padStart(3, "0")}`;
    const createdDate = new Date().toISOString().split("T")[0];

    await pool.query(
      "INSERT INTO owners (id, name, address, contact, email, tin, remarks, status, created_date) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?)",
      [id, name, address || null, contact || null, email || null, tin || null, remarks || null, createdDate]
    );

    await pool.query(
      "INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, 'CREATE_OWNER', 'OWNERS', JSON_OBJECT('owner_id', ?, 'name', ?))",
      [req.user.id, id, name]
    );

    res.status(201).json({
      id, name, address, contact, email, tin, remarks,
      status: "Active", createdDate, businessCount: 0, totalPaid: 0,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getOwners, createOwner };