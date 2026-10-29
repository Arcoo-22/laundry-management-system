import OrderItem from "../models/orderItemModel.js";

const orderItemController = {
  addItems: async (req, res) => {
    try {
      const { order_id, items } = req.body;

      if (!order_id || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Order ID and a non-empty array of items are required.",
        });
      }

      const result = await OrderItem.addItems(order_id, items);

      return res.status(201).json({
        success: true,
        message: "Items added successfully.",
        ...result,
      });
    } catch (error) {
      console.error("Error adding items:", error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to add items to the order.",
      });
    }
  },

  getByOrder: async (req, res) => {
    try {
      const { order_id } = req.params;
      const items = await OrderItem.getByOrder(order_id);
      return res.status(200).json({
        success: true,
        items: items || [],
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error fetching order items",
        error: error.message,
      });
    }
  },

  updateItem: async (req, res) => {
    const item_id = req.params.id;
    const updatedData = req.body;

    try {
      const result = await OrderItem.updateItem(item_id, updatedData);

      return res.status(200).json({
        success: true,
        message: "Order item updated successfully",
        ...result,
      });
    } catch (error) {
      console.error("Error updating item:", error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to update order item.",
      });
    }
  },

  deleteItem: async (req, res) => {
    try {
      const item_id = req.params.id;
      const result = await OrderItem.deleteItem(item_id);

      return res.status(200).json({
        success: true,
        message: "Order item deleted successfully.",
        ...result,
      });
    } catch (error) {
      console.error("Error deleting item:", error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to delete order item.",
      });
    }
  },
};

export default orderItemController;
