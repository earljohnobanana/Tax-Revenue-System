const { pool } = require("../config/db");

function mapFee(f) {
  return {
    id: f.id,
    name: f.name,
    amount: Number(f.amount),
    description: f.description,
    status: f.status,
  };
}

// Read-only catalog endpoint. Only returns Active fees by default since
// Inactive ones shouldn't appear on the public Fee Schedule report — pass
// ?includeInactive=true (e.g. for an admin management screen) to get all.
async function getRegulatoryFees(req, res, next) {
  try {
    const { includeInactive } = req.query;
    const sql = includeInactive === "true"
      ? "SELECT * FROM regulatory_fees ORDER BY name ASC"
      : "SELECT * FROM regulatory_fees WHERE status = 'Active' ORDER BY name ASC";

    const [rows] = await pool.query(sql);
    res.json({ fees: rows.map(mapFee) });
  } catch (err) {
    next(err);
  }
}

module.exports = { getRegulatoryFees };