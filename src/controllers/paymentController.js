import Payment from "../models/paymentModel.js";
import {
  isId,
  normalizePaymentMode,
  normalizePaymentStatus,
  sendError,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
} from "../utils/http.js";

// Shared validation for POST /payments and PUT /payments/complete/:orderId
const parsePaymentInput = (order_id, body = {}) => {
  if (!isId(order_id)) return { error: "order_id must be a valid id" };

  const { amount_paid, payment_mode } = body;
  if (amount_paid === undefined || amount_paid === null || amount_paid === "" || !payment_mode) {
    return { error: "Fields 'amount_paid' and 'payment_mode' are required" };
  }

  const amount = Number(amount_paid);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "amount_paid must be a positive number" };

  const mode = normalizePaymentMode(payment_mode);
  if (!mode) return { error: `payment_mode must be one of: ${PAYMENT_MODES.join(", ")}` };

  return { data: { order_id: Number(order_id), amount_paid: amount, payment_mode: mode } };
};

const paymentController = {
  getAll: async (req, res) => {
    try {
      const payments = await Payment.getAll();
      return res.status(200).json({ success: true, payments: payments || [] });
    } catch (err) {
      return sendError(res, err, "Error fetching payments");
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const payment = await Payment.getById(id);

      if (!payment) {
        return res.status(404).json({ success: false, message: `Payment #${id} not found.` });
      }

      return res.status(200).json({ success: true, payment, data: payment });
    } catch (error) {
      return sendError(res, error, "Error fetching payment");
    }
  },

  getByOrder: async (req, res) => {
    try {
      const payments = await Payment.getByOrderId(req.params.orderId);
      return res.status(200).json({ success: true, payments: payments || [] });
    } catch (error) {
      return sendError(res, error, "Error fetching order payments");
    }
  },

  // Balance checks, the insert and the Pending -> Processing move all happen in one transaction
  create: async (req, res) => {
    try {
      const { data, error } = parsePaymentInput(req.body?.order_id, req.body);
      if (error) return res.status(400).json({ success: false, message: error });

      const newPayment = await Payment.createForOrder(data);

      return res.status(201).json({
        success: true,
        message: "Payment recorded successfully.",
        payment: newPayment,
        balance_remaining: newPayment.payment_balance,
        payment_status: newPayment.payment_status,
      });
    } catch (error) {
      return sendError(res, error, "Error creating payment");
    }
  },

  updatePaymentStatus: async (req, res) => {
    try {
      const orderId = req.params.orderId;

      if (!req.body?.newStatus) {
        return res.status(400).json({
          success: false,
          message: "The 'newStatus' field is required for update.",
        });
      }

      // Reject unknown values instead of silently saving "Unpaid"
      const status = normalizePaymentStatus(req.body.newStatus);
      if (!status) {
        return res.status(400).json({
          success: false,
          message: `newStatus must be one of: ${PAYMENT_STATUSES.join(", ")}`,
        });
      }

      const result = await Payment.updatePaymentStatus(orderId, status);

      if (!result || result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: `Payment record for Order ID ${orderId} not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        message: `Payment status for Order ID ${orderId} updated to '${status}'.`,
        order_id: orderId,
        payment_status: status,
      });
    } catch (error) {
      return sendError(res, error, "Error updating payment status.");
    }
  },

  completePayment: async (req, res) => {
    try {
      const { data, error } = parsePaymentInput(req.params.orderId, req.body);
      if (error) return res.status(400).json({ success: false, message: error });

      const newPayment = await Payment.createForOrder(data);

      return res.status(200).json({
        success: true,
        message: "Payment applied successfully.",
        payment: newPayment,
        balance_remaining: newPayment.payment_balance,
        payment_status: newPayment.payment_status,
      });
    } catch (error) {
      return sendError(res, error, "Error applying payment.");
    }
  },
};

export default paymentController;