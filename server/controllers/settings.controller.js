const { pool } = require("../config/db");

function mapMunicipalitySettings(row) {
  return {
    municipalityName: row.municipality_name,
    province: row.province,
    region: row.region,
    postalCode: row.postal_code,
    mayorName: row.mayor_name,
    municipalTreasurer: row.municipal_treasurer,
    bploOfficer: row.bplo_officer,
    municipalAccountant: row.municipal_accountant,
    agency: row.agency || "MTO",           // AGENCY box on Form 51 (DB-driven)
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

// Always reads the single row (id = 1) — see
// migration_add_municipality_settings.sql for why this is a single-row
// table rather than a generic key-value store: there is exactly one
// municipality this system serves.
async function getMunicipalitySettings(req, res, next) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM municipality_settings WHERE id = 1 LIMIT 1"
    );

    if (rows.length === 0) {
      // Should never happen if the migration's seed INSERT ran, but
      // defended anyway rather than returning a confusing empty object
      // the frontend would have to guess how to handle.
      return res.status(404).json({
        message: "Municipality settings have not been initialized. Run the database migration.",
      });
    }

    res.json({ settings: mapMunicipalitySettings(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function updateMunicipalitySettings(req, res, next) {
  try {
    const {
      municipalityName,
      province,
      region,
      postalCode,
      mayorName,
      municipalTreasurer,
      bploOfficer,
      municipalAccountant,
      agency,
    } = req.body;

    // municipalityName/province/region are NOT NULL in the schema —
    // reject blanking them out entirely, the same way other controllers
    // in this codebase reject clearing required fields. Everything else
    // (mayor/treasurer/officer/accountant names, agency) is genuinely
    // optional — a newly-elected official's name might not be on file
    // yet, and that should be allowed to stay blank rather than block
    // the whole save.
    if (municipalityName !== undefined && !String(municipalityName).trim()) {
      return res.status(400).json({ message: "Municipality name cannot be blank." });
    }
    if (province !== undefined && !String(province).trim()) {
      return res.status(400).json({ message: "Province cannot be blank." });
    }
    if (region !== undefined && !String(region).trim()) {
      return res.status(400).json({ message: "Region cannot be blank." });
    }

    await pool.query(
      `UPDATE municipality_settings SET
        municipality_name = COALESCE(?, municipality_name),
        province = COALESCE(?, province),
        region = COALESCE(?, region),
        postal_code = ?,
        mayor_name = ?,
        municipal_treasurer = ?,
        bplo_officer = ?,
        municipal_accountant = ?,
        agency = COALESCE(?, agency),
        updated_by = ?
       WHERE id = 1`,
      [
        municipalityName || null,
        province || null,
        region || null,
        // Plain (non-COALESCE) for the optional fields — staff must be
        // able to actually CLEAR a name (e.g. an officer resigned and
        // the position is vacant), not just always overwrite-or-keep.
        // COALESCE would make it impossible to ever blank these out
        // once set.
        //
        // Empty strings are normalized to NULL too, so "staff cleared
        // this field" is stored consistently as NULL rather than
        // sometimes "" and sometimes NULL depending on which path set it.
        postalCode || null,
        mayorName || null,
        municipalTreasurer || null,
        bploOfficer || null,
        municipalAccountant || null,
        // agency: COALESCE keeps the current value if not sent, but never
        // blanks it — the AGENCY box should always print something.
        (agency && String(agency).trim()) ? String(agency).trim() : null,
        req.user?.name || null,
      ]
    );

    await pool.query(
      "INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, 'UPDATE_SETTINGS', 'SETTINGS', JSON_OBJECT('section', 'municipality'))",
      [req.user.id]
    );

    const [rows] = await pool.query(
      "SELECT * FROM municipality_settings WHERE id = 1 LIMIT 1"
    );

    res.json({ settings: mapMunicipalitySettings(rows[0]) });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/settings/account-codes
// Returns the active tax_type/fee -> account_code lookup used to fill the
// "ACCOUNT CODE" column on Official Receipts. DB-driven, never hardcoded.
// Returned as a flat { match_key: account_code } map for O(1) lookup on the
// receipt, plus the full rows for a future Settings editor.
// ---------------------------------------------------------------------------
async function getAccountCodes(req, res, next) {
  try {
    const [rows] = await pool.query(
      "SELECT match_key, account_code, description, active FROM account_codes WHERE active = 1 ORDER BY match_key"
    );

    const map = {};
    for (const r of rows) map[r.match_key] = r.account_code || "";

    res.json({ accountCodes: rows, map });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMunicipalitySettings,
  updateMunicipalitySettings,
  getAccountCodes,
};