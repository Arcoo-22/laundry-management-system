import db from "../config/database.js";

const OrderItem = {
  addItems: async (order_id, items) => {
    // 1. Validate order existence and fetch price_per_kilo
    const serviceResult = await new Promise((resolve, reject) => {
      db.query(
        `SELECT s.price_per_kilo 
         FROM tbl_orders o 
         JOIN tbl_services s ON o.service_id = s.service_id 
         WHERE o.order_id = ?`,
        [order_id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        }
      );
    });

    if (!serviceResult || !serviceResult.length) {
      const err = new Error("Order not found or service missing");
      err.status = 404;
      throw err;
    }

    const pricePerKilo = parseFloat(serviceResult[0].price_per_kilo);

    // 2. Validate and insert each item
    for (const item of items) {
      const weight = parseFloat(item.weight_in_kilo);
      if (isNaN(weight) || weight <= 0) {
        const err = new Error("Each item must have a valid positive weight_in_kilo");
        err.status = 400;
        throw err;
      }
      if (!item.clothe_type) {
        const err = new Error("Each item must have a clothe_type");
        err.status = 400;
        throw err;
      }

      const subtotal = weight * pricePerKilo;

      await new Promise((resolve, reject) => {
        db.query(
          "INSERT INTO tbl_order_items (order_id, clothe_type, weight_in_kilo, subtotal) VALUES (?, ?, ?, ?)",
          [order_id, item.clothe_type, weight, subtotal],
          (err, result) => {
            if (err) return reject(err);
            resolve(result);
          }
        );
      });
    }

    // 3. Recalculate totals across ALL items belonging to this order
    const totals = await new Promise((resolve, reject) => {
      db.query(
        `SELECT SUM(weight_in_kilo) AS totalWeight, SUM(subtotal) AS totalAmount
         FROM tbl_order_items
         WHERE order_id = ?`,
        [order_id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results && results.length ? results[0] : { totalWeight: 0, totalAmount: 0 });
        }
      );
    });

    const totalWeight = parseFloat(totals.totalWeight || 0);
    const totalAmount = parseFloat(totals.totalAmount || 0);

    // 4. Update the order's summary fields
    await new Promise((resolve, reject) => {
      db.query(
        "UPDATE tbl_orders SET total_weight = ?, total_amount = ? WHERE order_id = ?",
        [totalWeight, totalAmount, order_id],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    return { totalWeight, totalAmount };
  },

  getByOrder: (order_id) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_order_items WHERE order_id = ?",
        [order_id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results || []);
        }
      );
    });
  },

  updateItem: async (item_id, updatedData) => {
    if (!updatedData.clothe_type || typeof updatedData.weight_in_kilo !== "number" || updatedData.weight_in_kilo <= 0) {
      const err = new Error("clothe_type and a positive weight_in_kilo are required");
      err.status = 400;
      throw err;
    }

    const itemResults = await new Promise((resolve, reject) => {
      db.query(
        `SELECT oi.order_id, s.price_per_kilo
         FROM tbl_order_items oi
         JOIN tbl_orders o ON oi.order_id = o.order_id
         JOIN tbl_services s ON o.service_id = s.service_id
         WHERE oi.item_id = ?`,
        [item_id],
        (err, results) => {
          if (err) return reject(err);
          if (!results || !results.length) {
            const notFound = new Error("Order item not found");
            notFound.status = 404;
            return reject(notFound);
          }
          resolve(results[0]);
        }
      );
    });

    const { order_id, price_per_kilo } = itemResults;
    const subtotal = updatedData.weight_in_kilo * parseFloat(price_per_kilo);

    await new Promise((resolve, reject) => {
      db.query(
        `UPDATE tbl_order_items
         SET clothe_type = ?, weight_in_kilo = ?, subtotal = ?
         WHERE item_id = ?`,
        [updatedData.clothe_type, updatedData.weight_in_kilo, subtotal, item_id],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    const totals = await new Promise((resolve, reject) => {
      db.query(
        `SELECT SUM(weight_in_kilo) AS totalWeight, SUM(subtotal) AS totalAmount
         FROM tbl_order_items
         WHERE order_id = ?`,
        [order_id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results && results.length ? results[0] : { totalWeight: 0, totalAmount: 0 });
        }
      );
    });

    const totalWeight = parseFloat(totals.totalWeight || 0);
    const totalAmount = parseFloat(totals.totalAmount || 0);

    await new Promise((resolve, reject) => {
      db.query(
        `UPDATE tbl_orders
         SET total_weight = ?, total_amount = ?
         WHERE order_id = ?`,
        [totalWeight, totalAmount, order_id],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    return { success: true, totalWeight, totalAmount };
  },

  deleteItem: async (item_id) => {
    const item = await new Promise((resolve, reject) => {
      db.query("SELECT order_id FROM tbl_order_items WHERE item_id = ?", [item_id], (err, rows) => {
        if (err) return reject(err);
        resolve(rows && rows.length ? rows[0] : null);
      });
    });

    if (!item) {
      const notFound = new Error("Order item not found");
      notFound.status = 404;
      throw notFound;
    }

    const order_id = item.order_id;

    await new Promise((resolve, reject) => {
      db.query("DELETE FROM tbl_order_items WHERE item_id = ?", [item_id], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    const totals = await new Promise((resolve, reject) => {
      db.query(
        `SELECT SUM(weight_in_kilo) AS totalWeight, SUM(subtotal) AS totalAmount
         FROM tbl_order_items
         WHERE order_id = ?`,
        [order_id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results && results.length ? results[0] : { totalWeight: 0, totalAmount: 0 });
        }
      );
    });

    const totalWeight = parseFloat(totals.totalWeight || 0);
    const totalAmount = parseFloat(totals.totalAmount || 0);

    await new Promise((resolve, reject) => {
      db.query(
        "UPDATE tbl_orders SET total_weight = ?, total_amount = ? WHERE order_id = ?",
        [totalWeight, totalAmount, order_id],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    return { success: true, order_id, totalWeight, totalAmount };
  },
};

export default OrderItem;
