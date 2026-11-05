import db, { withTransaction } from "../config/database.js";
import { httpError, digitsOnly } from "../utils/http.js";

const q = (sql, params) => db.promise().query(sql, params);

const User = {
  findByEmail: async (email) => {
    const [rows] = await q("SELECT * FROM tbl_users WHERE email = ?", [String(email).trim().toLowerCase()]);
    return rows[0] || null;
  },

  findById: async (id) => {
    const [rows] = await q("SELECT * FROM tbl_users WHERE user_id = ?", [id]);
    return rows[0] || null;
  },

  touchLogin: (id) => q("UPDATE tbl_users SET last_login_at = NOW() WHERE user_id = ?", [id]),

  updatePassword: (id, passwordHash) =>
    q("UPDATE tbl_users SET password_hash = ? WHERE user_id = ?", [passwordHash, id]),

  // Creates the customer account. If the shop already has this customer on file
  // (same email AND same phone number, not yet linked to a login), the account is
  // linked to that record so their past orders show up. Matching on email alone
  // would let anyone read a stranger's order history, so it is never done.
  registerCustomer: ({ full_name, contact, email, address, password_hash }) =>
    withTransaction(async (conn) => {
      const mail = email.trim().toLowerCase();

      const [taken] = await conn.query("SELECT user_id FROM tbl_users WHERE email = ?", [mail]);
      if (taken.length) throw httpError(409, "An account with this email already exists. Try logging in instead.");

      const [onFile] = await conn.query(
        `SELECT c.customer_id, c.contact, u.user_id AS linked_user
         FROM tbl_customers c
         LEFT JOIN tbl_users u ON u.customer_id = c.customer_id
         WHERE LOWER(TRIM(c.email)) = ?
         ORDER BY c.customer_id ASC`,
        [mail]
      );

      let customerId = null;
      let linkedExisting = false;

      if (onFile.length) {
        const match = onFile.find((c) => !c.linked_user && digitsOnly(c.contact) === digitsOnly(contact));
        if (!match) {
          throw httpError(
            409,
            "The shop already has a customer record with this email. To protect your order history, " +
              "sign up with the phone number the shop has on file, or ask the shop to link your account."
          );
        }
        customerId = match.customer_id;
        linkedExisting = true;
      } else {
        const [created] = await conn.query(
          "INSERT INTO tbl_customers (full_name, contact, email, address) VALUES (?, ?, ?, ?)",
          [full_name, contact, mail, address]
        );
        customerId = created.insertId;
      }

      const [user] = await conn.query(
        "INSERT INTO tbl_users (email, password_hash, role, full_name, customer_id) VALUES (?, ?, 'customer', ?, ?)",
        [mail, password_hash, full_name, customerId]
      );

      return { user_id: user.insertId, customer_id: customerId, linked_existing: linkedExisting };
    }),

  // Customer edits their own details (email is the login, so it can't change here)
  updateProfile: (customerId, userId, { full_name, contact, address }) =>
    withTransaction(async (conn) => {
      await conn.query("UPDATE tbl_customers SET full_name = ?, contact = ?, address = ? WHERE customer_id = ?", [
        full_name,
        contact,
        address,
        customerId,
      ]);
      await conn.query("UPDATE tbl_users SET full_name = ? WHERE user_id = ?", [full_name, userId]);
    }),

  getCustomerProfile: async (customerId) => {
    const [rows] = await q("SELECT customer_id, full_name, contact, email, address FROM tbl_customers WHERE customer_id = ?", [
      customerId,
    ]);
    return rows[0] || null;
  },
};

export default User;