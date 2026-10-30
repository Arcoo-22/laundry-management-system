import db, { withTransaction } from "../config/database.js";
import { httpError } from "../utils/http.js";

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

  // Creates the order and, when no customer_id is given, the customer too - all or nothing.
  // A customer with the same email (case-insensitive) is reused instead of duplicated.
  createWithCustomer: ({ customer_id, customer, service_id, delivery_methods }) =>
    withTransaction(async (conn) => {
      const [services] = await conn.query("SELECT service_id FROM tbl_services WHERE service_id = ?", [service_id]);
      if (!services.length) throw httpError(404, `Service ${service_id} not found`);

      let customerId = customer_id;
      let customerCreated = false;

      if (customerId) {
        const [rows] = await conn.query("SELECT customer_id FROM tbl_customers WHERE customer_id = ?", [customerId]);
        if (!rows.length) throw httpError(404, `Customer ${customerId} not found`);
      } else {
        const [existing] = await conn.query(
          "SELECT customer_id FROM tbl_customers WHERE LOWER(TRIM(email)) = LOWER(?) ORDER BY customer_id ASC LIMIT 1",
          [customer.email]
        );
        if (existing.length) {
          customerId = existing[0].customer_id;
        } else {
          const [created] = await conn.query(
            "INSERT INTO tbl_customers (full_name, contact, email, address) VALUES (?, ?, ?, ?)",
            [customer.full_name, customer.contact, customer.email, customer.address]
          );
          customerId = created.insertId;
          customerCreated = true;
        }
      }

      const delivery = normalizeDelivery(delivery_methods);
      const [order] = await conn.query(
        "INSERT INTO tbl_orders (customer_id, service_id, delivery_methods) VALUES (?, ?, ?)",
        [customerId, service_id, delivery]
      );

      return { order_id: order.insertId, customer_id: customerId, customer_created: customerCreated };
    }),

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

  // Deleting an order removes its garment items. Orders with payments are protected.
  delete: (id) =>
    withTransaction(async (conn) => {
      const [orders] = await conn.query("SELECT order_id FROM tbl_orders WHERE order_id = ? FOR UPDATE", [id]);
      if (!orders.length) return { affectedRows: 0 };

      const [[pay]] = await conn.query("SELECT COUNT(*) AS n FROM tbl_payments WHERE order_id = ?", [id]);
      if (pay.n > 0) {
        throw httpError(409, "This order has recorded payments and can't be deleted. Mark it as Cancelled instead.");
      }

      await conn.query("DELETE FROM tbl_order_items WHERE order_id = ?", [id]);
      const [result] = await conn.query("DELETE FROM tbl_orders WHERE order_id = ?", [id]);
      return result;
    }),
};

export default Order;