import db from "../config/database.js";

const Customer = {
  getAll: () => {
    return new Promise((resolve, reject) => {
      db.query("SELECT * FROM tbl_customers ORDER BY customer_id ASC", (err, results) => {
        if (err) return reject(err);
        resolve(results || []);
      });
    });
  },

  getById: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_customers WHERE customer_id = ?",
        [id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results && results.length ? results[0] : null);
        }
      );
    });
  },

  getByName: (customerName) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_customers WHERE LOWER(TRIM(full_name)) LIKE LOWER(CONCAT('%', ?, '%')) ORDER BY customer_id ASC",
        [customerName],
        (err, results) => {
          if (err) return reject(err);
          resolve(results || []);
        }
      );
    });
  },

  create: (customerData) => {
    const { full_name, contact, email, address } = customerData;
    return new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO tbl_customers (full_name, contact, email, address) VALUES (?, ?, ?, ?)",
        [full_name, contact, email, address],
        (err, results) => {
          if (err) return reject(err);
          resolve({ id: results.insertId, ...customerData });
        }
      );
    });
  },

  update: (id, customerData) => {
    const { full_name, contact, email, address } = customerData;
    return new Promise((resolve, reject) => {
      db.query(
        "UPDATE tbl_customers SET full_name = ?, contact = ?, email = ?, address = ? WHERE customer_id = ?",
        [full_name, contact, email, address, id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        }
      );
    });
  },

  delete: (id) => {
    return new Promise((resolve, reject) => {
      db.query("DELETE FROM tbl_customers WHERE customer_id = ?", [id], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
  },
};

export default Customer;
