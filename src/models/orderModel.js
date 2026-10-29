import db from "../config/database.js";

const normalizeDelivery = (val) => {
  if (!val) return "Pickup";
  const str = String(val).trim().toLowerCase();
  if (str.includes("delivery") || str.includes("drop")) return "Delivery";
  return "Pickup";
};

const normalizeStatus = (val) => {
  if (!val) return "Pending";
  const str = String(val).trim().toLowerCase();
  const map = {
    pending: "Pending",
    processing: "Processing",
    ready: "Ready",
    completed: "Completed",
    cancelled: "Cancelled",
    canceled: "Cancelled",
  };
  return map[str] || "Pending";
};

const Order = {
  getAll: () => {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT o.*, c.full_name, s.service_name
         FROM tbl_orders o
         LEFT JOIN tbl_customers c ON o.customer_id = c.customer_id
         LEFT JOIN tbl_services s ON o.service_id = s.service_id
         ORDER BY o.order_id DESC`,
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        }
      );
    });
  },

  getById: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT o.*, c.full_name, s.service_name
         FROM tbl_orders o
         LEFT JOIN tbl_customers c ON o.customer_id = c.customer_id
         LEFT JOIN tbl_services s ON o.service_id = s.service_id
         WHERE o.order_id = ?`,
        [id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results && results.length ? results[0] : null);
        }
      );
    });
  },

  create: (orderData) => {
    const { customer_id, service_id, delivery_methods } = orderData;
    const normDelivery = normalizeDelivery(delivery_methods);

    return new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO tbl_orders (customer_id, service_id, delivery_methods) VALUES (?, ?, ?)",
        [customer_id, service_id, normDelivery],
        (err, results) => {
          if (err) return reject(err);
          if (!results || !results.insertId) {
            return resolve(null);
          }
          resolve({ id: results.insertId, order_id: results.insertId, ...orderData, delivery_methods: normDelivery });
        }
      );
    });
  },

  updateStatus: (order_id, newStatus) => {
    const normStatus = normalizeStatus(newStatus);
    return new Promise((resolve, reject) => {
      db.query(
        "UPDATE tbl_orders SET status = ? WHERE order_id = ?",
        [normStatus, order_id],
        (err, results) => {
          if (err) return reject(err);

          if (results.affectedRows === 0) {
            return resolve(null);
          }

          resolve({ success: true, order_id, status: normStatus });
        }
      );
    });
  },

  getByStatus: (status) => {
    const normStatus = normalizeStatus(status);
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT o.*, c.full_name, s.service_name
         FROM tbl_orders o
         LEFT JOIN tbl_customers c ON o.customer_id = c.customer_id
         LEFT JOIN tbl_services s ON o.service_id = s.service_id
         WHERE o.status = ?
         ORDER BY o.order_id DESC`,
        [normStatus],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        }
      );
    });
  },

  getByName: (name) => {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT o.*, c.full_name, s.service_name
         FROM tbl_orders o
         LEFT JOIN tbl_customers c ON o.customer_id = c.customer_id
         LEFT JOIN tbl_services s ON o.service_id = s.service_id
         WHERE LOWER(TRIM(c.full_name)) LIKE LOWER(CONCAT('%', ?, '%'))
         ORDER BY o.order_id DESC`,
        [name],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        }
      );
    });
  },

  getByDeliveryMethod: (deliveryMethod) => {
    const normDelivery = normalizeDelivery(deliveryMethod);
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT o.*, c.full_name, s.service_name
         FROM tbl_orders o
         LEFT JOIN tbl_customers c ON o.customer_id = c.customer_id
         LEFT JOIN tbl_services s ON o.service_id = s.service_id
         WHERE o.delivery_methods = ?
         ORDER BY o.order_id DESC`,
        [normDelivery],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        }
      );
    });
  },

  updateDelivery: (order_id, delivery_methods) => {
    const normDelivery = normalizeDelivery(delivery_methods);
    return new Promise((resolve, reject) => {
      db.query(
        "UPDATE tbl_orders SET delivery_methods = ? WHERE order_id = ?",
        [normDelivery, order_id],
        (err, results) => {
          if (err) return reject(err);

          if (results.affectedRows === 0) {
            return resolve(null);
          }

          resolve({ success: true, order_id, delivery_methods: normDelivery });
        }
      );
    });
  },

  delete: (id) => {
    return new Promise((resolve, reject) => {
      db.query("DELETE FROM tbl_orders WHERE order_id = ?", [id], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
  },
};

export default Order;
