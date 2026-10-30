import db, { withTransaction } from "../config/database.js";
import { httpError, round2, normalizePaymentMode as strictMode, normalizePaymentStatus as strictStatus } from "../utils/http.js";

const normalizePaymentMode = (val) => strictMode(val) || "Cash";
const normalizePaymentStatus = (val) => strictStatus(val) || "Unpaid";

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


  // Records a payment atomically: locks the order row, checks the balance, inserts the
  // payment, and moves a Pending order to Processing once it is fully paid.
  createForOrder: ({ order_id, amount_paid, payment_mode }) =>
    withTransaction(async (conn) => {
      const [orders] = await conn.query(
        "SELECT order_id, total_amount, status FROM tbl_orders WHERE order_id = ? FOR UPDATE",
        [order_id]
      );
      if (!orders.length) throw httpError(404, `Order ${order_id} not found.`);

      const order = orders[0];
      if (order.status === "Cancelled") {
        throw httpError(409, "Can't record a payment for a cancelled order.");
      }

      const total = round2(order.total_amount);
      if (total <= 0) {
        throw httpError(400, "Total amount of order is zero or items have not been added yet.");
      }

      const [[paid]] = await conn.query(
        "SELECT COALESCE(SUM(amount_paid), 0) AS totalPaid FROM tbl_payments WHERE order_id = ?",
        [order_id]
      );
      const remaining = round2(total - round2(paid.totalPaid));
      if (remaining <= 0) throw httpError(409, "This order is already fully paid.");

      const amount = round2(amount_paid);
      if (!(amount > 0)) throw httpError(400, "amount_paid must be at least 0.01");
      if (amount > remaining) {
        throw httpError(400, `Amount exceeds the remaining balance of ₱${remaining.toFixed(2)}.`);
      }

      const balance = round2(remaining - amount);
      const status = balance === 0 ? "Fully Paid" : "Partially Paid";
      const mode = normalizePaymentMode(payment_mode);

      const [result] = await conn.query(
        "INSERT INTO tbl_payments (order_id, amount_paid, payment_mode, payment_balance, payment_status) VALUES (?, ?, ?, ?, ?)",
        [order_id, amount, mode, balance, status]
      );

      if (status === "Fully Paid" && order.status === "Pending") {
        await conn.query("UPDATE tbl_orders SET status = 'Processing' WHERE order_id = ?", [order_id]);
      }

      return {
        payment_id: result.insertId,
        id: result.insertId,
        order_id,
        amount_paid: amount,
        payment_mode: mode,
        payment_balance: balance,
        payment_status: status,
      };
    }),

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