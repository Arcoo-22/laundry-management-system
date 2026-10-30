import db, { withTransaction } from "../config/database.js";
import { httpError, round2, cleanText } from "../utils/http.js";

// Column limits from the schema: weight DECIMAL(5,2), total_weight DECIMAL(6,2), money DECIMAL(10,2)
const MAX_ITEM_WEIGHT = 999.99;
const MAX_ORDER_WEIGHT = 9999.99;
const MAX_MONEY = 99999999.99;
const LOCKED_STATUSES = ["Cancelled", "Completed"];

// Validates one item payload and returns the cleaned values
const parseItem = (item, pricePerKilo) => {
  const clothe_type = cleanText(item?.clothe_type);
  if (!clothe_type) throw httpError(400, "Each item must have a clothe_type");
  if (clothe_type.length > 50) throw httpError(400, "clothe_type must be 50 characters or fewer");

  const weight = round2(parseFloat(item?.weight_in_kilo));
  if (!Number.isFinite(weight) || weight <= 0) {
    throw httpError(400, "Each item must have a valid positive weight_in_kilo");
  }
  if (weight > MAX_ITEM_WEIGHT) throw httpError(400, `An item can't weigh more than ${MAX_ITEM_WEIGHT} kg`);

  const subtotal = round2(weight * pricePerKilo);
  if (subtotal > MAX_MONEY) throw httpError(400, "Item subtotal is too large");
  return { clothe_type, weight, subtotal };
};

const assertEditable = (status) => {
  if (LOCKED_STATUSES.includes(status)) {
    throw httpError(409, `Items can't be changed on a ${status.toLowerCase()} order.`);
  }
};

// Recalculate the order's totals from ALL of its items (runs inside the caller's transaction)
const recalcTotals = async (conn, order_id) => {
  const [[t]] = await conn.query(
    `SELECT COALESCE(SUM(weight_in_kilo), 0) AS totalWeight, COALESCE(SUM(subtotal), 0) AS totalAmount
     FROM tbl_order_items WHERE order_id = ?`,
    [order_id]
  );
  const totalWeight = round2(t.totalWeight);
  const totalAmount = round2(t.totalAmount);
  if (totalWeight > MAX_ORDER_WEIGHT || totalAmount > MAX_MONEY) {
    throw httpError(400, "Order totals are too large.");
  }
  await conn.query("UPDATE tbl_orders SET total_weight = ?, total_amount = ? WHERE order_id = ?", [
    totalWeight,
    totalAmount,
    order_id,
  ]);
  return { totalWeight, totalAmount };
};

const OrderItem = {
  // All-or-nothing: if any item is invalid, nothing is inserted
  addItems: (order_id, items) =>
    withTransaction(async (conn) => {
      const [rows] = await conn.query(
        `SELECT o.status, s.price_per_kilo
         FROM tbl_orders o
         JOIN tbl_services s ON o.service_id = s.service_id
         WHERE o.order_id = ? FOR UPDATE`,
        [order_id]
      );
      if (!rows.length) throw httpError(404, "Order not found or service missing");
      assertEditable(rows[0].status);

      const price = parseFloat(rows[0].price_per_kilo);
      const parsed = items.map((item) => parseItem(item, price)); // validate everything first

      await conn.query("INSERT INTO tbl_order_items (order_id, clothe_type, weight_in_kilo, subtotal) VALUES ?", [
        parsed.map((i) => [order_id, i.clothe_type, i.weight, i.subtotal]),
      ]);

      return recalcTotals(conn, order_id);
    }),

  getByOrder: (order_id) => {
    return new Promise((resolve, reject) => {
      db.query("SELECT * FROM tbl_order_items WHERE order_id = ?", [order_id], (err, results) => {
        if (err) return reject(err);
        resolve(results || []);
      });
    });
  },

  updateItem: (item_id, updatedData) =>
    withTransaction(async (conn) => {
      const [rows] = await conn.query(
        `SELECT oi.order_id, o.status, s.price_per_kilo
         FROM tbl_order_items oi
         JOIN tbl_orders o ON oi.order_id = o.order_id
         JOIN tbl_services s ON o.service_id = s.service_id
         WHERE oi.item_id = ? FOR UPDATE`,
        [item_id]
      );
      if (!rows.length) throw httpError(404, "Order item not found");
      assertEditable(rows[0].status);

      const { order_id, price_per_kilo } = rows[0];
      const item = parseItem(updatedData, parseFloat(price_per_kilo));

      await conn.query(
        "UPDATE tbl_order_items SET clothe_type = ?, weight_in_kilo = ?, subtotal = ? WHERE item_id = ?",
        [item.clothe_type, item.weight, item.subtotal, item_id]
      );

      const totals = await recalcTotals(conn, order_id);
      return { success: true, ...totals };
    }),

  deleteItem: (item_id) =>
    withTransaction(async (conn) => {
      const [rows] = await conn.query(
        `SELECT oi.order_id, o.status
         FROM tbl_order_items oi
         JOIN tbl_orders o ON oi.order_id = o.order_id
         WHERE oi.item_id = ? FOR UPDATE`,
        [item_id]
      );
      if (!rows.length) throw httpError(404, "Order item not found");
      assertEditable(rows[0].status);

      const { order_id } = rows[0];
      await conn.query("DELETE FROM tbl_order_items WHERE item_id = ?", [item_id]);

      const totals = await recalcTotals(conn, order_id);
      return { success: true, order_id, ...totals };
    }),
};

export default OrderItem;