import OrderItem from "../models/orderItemModel.js";
import { isId, sendError } from "../utils/http.js";

const MAX_ITEMS_PER_REQUEST = 100;
const badId = (res, what) => res.status(400).json({ success: false, message: `${what} must be a valid id` });

const orderItemController = {
  addItems: async (req, res) => {
    try {
      const { order_id, items } = req.body || {};

      if (!isId(order_id) || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "A valid order_id and a non-empty array of items are required.",
        });
      }
      if (items.length > MAX_ITEMS_PER_REQUEST) {
        return res.status(400).json({
          success: false,
          message: `You can add at most ${MAX_ITEMS_PER_REQUEST} items at a time.`,
        });
      }

      const result = await OrderItem.addItems(Number(order_id), items);

      return res.status(201).json({
        success: true,
        message: "Items added successfully.",
        ...result,
      });
    } catch (error) {
      return sendError(res, error, "Failed to add items to the order.");
    }
  },

  getByOrder: async (req, res) => {
    try {
      if (!isId(req.params.order_id)) return badId(res, "order_id");

      const items = await OrderItem.getByOrder(req.params.order_id);
      return res.status(200).json({ success: true, items: items || [] });
    } catch (error) {
      return sendError(res, error, "Error fetching order items");
    }
  },

  updateItem: async (req, res) => {
    try {
      if (!isId(req.params.id)) return badId(res, "Item id");

      const result = await OrderItem.updateItem(Number(req.params.id), req.body || {});

      return res.status(200).json({
        success: true,
        message: "Order item updated successfully",
        ...result,
      });
    } catch (error) {
      return sendError(res, error, "Failed to update order item.");
    }
  },

  deleteItem: async (req, res) => {
    try {
      if (!isId(req.params.id)) return badId(res, "Item id");

      const result = await OrderItem.deleteItem(Number(req.params.id));

      return res.status(200).json({
        success: true,
        message: "Order item deleted successfully.",
        ...result,
      });
    } catch (error) {
      return sendError(res, error, "Failed to delete order item.");
    }
  },
};

export default orderItemController;