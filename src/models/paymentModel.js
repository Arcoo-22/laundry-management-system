import db from "../config/database.js";

const normalizePaymentMode = (val) => {
  if (!val) return "Cash";
  const str = String(val).trim().toLowerCase();
  if (str.includes("gcash")) return "GCash";
  if (str.includes("maya")) return "Maya";
  if (str.includes("bank") || str.includes("transfer")) return "Bank Transfer";
  return "Cash";
};

const normalizePaymentStatus = (val) => {
  if (!val) return "Unpaid";
  const str = String(val).trim().toLowerCase();
  if (str.includes("full") || str === "completed" || str === "paid") return "Fully Paid";
  if (str.includes("part")) return "Partially Paid";
  return "Unpaid";
};

const Payment = {
  getAll: () => {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT p.*, o.order_id, c.full_name 
         FROM tbl_payments p
         LEFT JOIN tbl_orders o ON p.order_id = o.order_id
         LEFT JOIN tbl_customers c ON o.customer_id = c.customer_id
         ORDER BY p.payment_id DESC`,
        (err, results) => {
          if (err) return reject(err);
          resolve(results || []);
        }
      );
    });
  },

  getById: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT p.*, o.order_id, c.full_name 
         FROM tbl_payments p
         LEFT JOIN tbl_orders o ON p.order_id = o.order_id
         LEFT JOIN tbl_customers c ON o.customer_id = c.customer_id
         WHERE p.payment_id = ?`,
        [id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results && results.length ? results[0] : null);
        }
      );
    });
  },

  getByOrderId: (orderId) => {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT p.*, o.order_id, c.full_name 
         FROM tbl_payments p
         LEFT JOIN tbl_orders o ON p.order_id = o.order_id
         LEFT JOIN tbl_customers c ON o.customer_id = c.customer_id
         WHERE p.order_id = ?
         ORDER BY p.payment_id DESC`,
        [orderId],
        (err, results) => {
          if (err) return reject(err);
          resolve(results || []);
        }
      );
    });
  },
  
  getTotalPaid: (orderId) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT SUM(amount_paid) AS totalPaid FROM tbl_payments WHERE order_id = ?",
        [orderId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows && rows[0] && rows[0].totalPaid ? parseFloat(rows[0].totalPaid) : 0);
        }
      );
    });
  },

  create: (paymentData) => {
    const { order_id, amount_paid, payment_mode, payment_balance, payment_status } = paymentData;
    const mode = normalizePaymentMode(payment_mode);
    const status = normalizePaymentStatus(payment_status);

    return new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO tbl_payments (order_id, amount_paid, payment_mode, payment_balance, payment_status) VALUES (?, ?, ?, ?, ?)",
        [order_id, amount_paid, mode, payment_balance, status],
        (err, results) => {
          if (err) return reject(err);
          if (!results) {
            return reject(new Error("No result returned from database"));
          }
          resolve({
            payment_id: results.insertId,
            id: results.insertId,
            order_id,
            amount_paid,
            payment_mode: mode,
            payment_balance,
            payment_status: status,
          });
        }
      );
    });
  },

  updatePaymentStatus: (orderId, newStatus) => {
    const status = normalizePaymentStatus(newStatus);
    return new Promise((resolve, reject) => {
      db.query(
        `UPDATE tbl_payments 
         SET payment_status = ? 
         WHERE order_id = ?
         ORDER BY payment_id DESC LIMIT 1`, 
        [status, orderId],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        }
      );
    });
  },
};

export default Payment;
