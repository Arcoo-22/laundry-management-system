import Order from "../models/orderModel.js";
import { cleanText, isId, sendError } from "../utils/http.js";

// Admin-only: decide on orders that customers placed themselves
const orderApprovalController = {
  pendingCount: async (req, res) => {
    try {
      return res.status(200).json({ success: true, count: await Order.countAwaiting() });
    } catch (error) {
      return sendError(res, error, "Error counting orders waiting for confirmation");
    }
  },

  confirm: async (req, res) => {
    try {
      const { id } = req.params;
      if (!isId(id)) return res.status(400).json({ success: false, message: "Invalid order id" });

      const result = await Order.confirm(Number(id), req.user.id);
      return res.status(200).json({
        success: true,
        message: `Order #${id} confirmed. You can now add its items.`,
        order_id: result.order_id,
        status: result.status,
      });
    } catch (error) {
      return sendError(res, error, `Error confirming order ${req.params.id}`);
    }
  },

  reject: async (req, res) => {
    try {
      const { id } = req.params;
      if (!isId(id)) return res.status(400).json({ success: false, message: "Invalid order id" });

      const reason = cleanText(req.body?.reason);
      if (!reason || reason.length < 3) {
        return res.status(400).json({ success: false, message: "Give the customer a short reason (at least 3 characters)." });
      }
      if (reason.length > 255) {
        return res.status(400).json({ success: false, message: "The reason must be 255 characters or fewer." });
      }

      const result = await Order.reject(Number(id), req.user.id, reason);
      return res.status(200).json({
        success: true,
        message: `Order #${id} rejected.`,
        order_id: result.order_id,
        status: result.status,
      });
    } catch (error) {
      return sendError(res, error, `Error rejecting order ${req.params.id}`);
    }
  },
};

export default orderApprovalController;