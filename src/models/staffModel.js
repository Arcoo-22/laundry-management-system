import db from "../config/database.js";
import { httpError } from "../utils/http.js";

const q = (sql, params) => db.promise().query(sql, params);

const PUBLIC_COLUMNS = "staff_id, email, full_name, role, is_active, created_at, last_login_at";

const Staff = {
  findByEmail: async (email) => {
    const [rows] = await q("SELECT * FROM tbl_staff WHERE email = ?", [String(email).trim().toLowerCase()]);
    return rows[0] || null;
  },

  findById: async (id) => {
    const [rows] = await q("SELECT * FROM tbl_staff WHERE staff_id = ?", [id]);
    return rows[0] || null;
  },

  list: async () => {
    const [rows] = await q(
      `SELECT ${PUBLIC_COLUMNS} FROM tbl_staff ORDER BY FIELD(role, 'superadmin', 'admin', 'staff'), full_name`
    );
    return rows;
  },

  touchLogin: (id) => q("UPDATE tbl_staff SET last_login_at = NOW() WHERE staff_id = ?", [id]),

  updatePassword: (id, passwordHash) => q("UPDATE tbl_staff SET password_hash = ? WHERE staff_id = ?", [passwordHash, id]),

  create: async ({ full_name, email, password_hash, role, created_by = null }) => {
    try {
      const [result] = await q(
        "INSERT INTO tbl_staff (email, password_hash, role, full_name, created_by) VALUES (?, ?, ?, ?, ?)",
        [email.trim().toLowerCase(), password_hash, role, full_name, created_by]
      );
      return result.insertId;
    } catch (err) {
      if (err?.errno === 1062) throw httpError(409, "A staff account with this email already exists.");
      throw err;
    }
  },

  // Only the fields passed in are changed
  update: async (id, { full_name, role, is_active }) => {
    const sets = [];
    const params = [];
    if (full_name !== undefined) (sets.push("full_name = ?"), params.push(full_name));
    if (role !== undefined) (sets.push("role = ?"), params.push(role));
    if (is_active !== undefined) (sets.push("is_active = ?"), params.push(is_active ? 1 : 0));
    if (!sets.length) return;
    await q(`UPDATE tbl_staff SET ${sets.join(", ")} WHERE staff_id = ?`, [...params, id]);
  },
};

export default Staff;