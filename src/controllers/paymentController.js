import Payment from "../models/paymentModel.js";
import Order from "../models/orderModel.js";

const paymentController = {
  getAll: async (req, res) => {
    try {
      const payments = await Payment.getAll();
      return res.status(200).json({
        success: true,
        payments: payments || [],
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Error fetching payments",
        error: err.message,
      });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const payment = await Payment.getById(id);

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: `Payment #${id} not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        payment: payment,
        data: payment,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error fetching payment",
        error: error.message,
      });
    }
  },

  getByOrder: async (req, res) => {
    try {
      const { orderId } = req.params;
      const payments = await Payment.getByOrderId(orderId);
      return res.status(200).json({
        success: true,
        payments: payments || [],
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error fetching order payments",
        error: error.message,
      });
    }
  },

  create: async (req, res) => {
    try {
      const { order_id, amount_paid, payment_mode } = req.body;

      if (!order_id || amount_paid === undefined || !payment_mode) {
        return res.status(400).json({
          success: false,
          message: "All fields (order_id, amount_paid, payment_mode) are required",
        });
      }

      const parsedAmount = parseFloat(amount_paid);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: "amount_paid must be a positive number",
        });
      }

      const order = await Order.getById(order_id);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: `Order ${order_id} not found.`,
        });
      }

      const total = parseFloat(order.total_amount || 0);
      if (total <= 0) {
        return res.status(400).json({
          success: false,
          message: "Total amount of order is zero or items have not been added yet.",
        });
      }

      const previousPayments = await Payment.getTotalPaid(order_id);
      const totalPaid = previousPayments + parsedAmount;
      const newBalance = total - totalPaid;
      const balanceForDB = newBalance > 0 ? newBalance : 0;

      let paymentStatus;
      if (newBalance <= 0) {
        paymentStatus = "Fully Paid";
      } else if (totalPaid > 0) {
        paymentStatus = "Partially Paid";
      } else {
        paymentStatus = "Unpaid";
      }

      const newPayment = await Payment.create({
        order_id,
        amount_paid: parsedAmount,
        payment_mode,
        payment_balance: balanceForDB,
        payment_status: paymentStatus,
      });

      if (paymentStatus === "Fully Paid") {
        await Order.updateStatus(order_id, "Processing");
      }

      return res.status(201).json({
        success: true,
        message: "Payment recorded successfully.",
        payment: newPayment,
        balance_remaining: balanceForDB,
        payment_status: paymentStatus,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error creating payment",
        error: error.message,
      });
    }
  },

  updatePaymentStatus: async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const { newStatus } = req.body;

      if (!newStatus) {
        return res.status(400).json({
          success: false,
          message: "The 'newStatus' field is required for update.",
        });
      }

      const result = await Payment.updatePaymentStatus(orderId, newStatus);

      if (!result || result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: `Payment record for Order ID ${orderId} not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        message: `Payment status for Order ID ${orderId} updated to '${newStatus}'.`,
        order_id: orderId,
        payment_status: newStatus,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error updating payment status.",
        error: error.message,
      });
    }
  },

  completePayment: async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const { amount_paid, payment_mode } = req.body;

      if (amount_paid === undefined || !payment_mode) {
        return res.status(400).json({
          success: false,
          message: "Fields 'amount_paid' and 'payment_mode' are required.",
        });
      }

      const parsedAmount = parseFloat(amount_paid);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: "amount_paid must be a positive number",
        });
      }

      const order = await Order.getById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: `Order ${orderId} not found.`,
        });
      }

      const total = parseFloat(order.total_amount || 0);
      const prevPaid = await Payment.getTotalPaid(orderId);
      const totalPaid = parseFloat(prevPaid || 0) + parsedAmount;
      const newBalance = total - totalPaid;
      const balanceForDB = newBalance > 0 ? newBalance : 0;

      let paymentStatus;
      if (newBalance <= 0) paymentStatus = "Fully Paid";
      else if (totalPaid > 0) paymentStatus = "Partially Paid";
      else paymentStatus = "Unpaid";

      const newPayment = await Payment.create({
        order_id: orderId,
        amount_paid: parsedAmount,
        payment_mode,
        payment_balance: balanceForDB,
        payment_status: paymentStatus,
      });

      if (paymentStatus === "Fully Paid") {
        await Order.updateStatus(orderId, "Processing");
      }

      return res.status(200).json({
        success: true,
        message: "Payment applied successfully.",
        payment: newPayment,
        balance_remaining: balanceForDB,
        payment_status: paymentStatus,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error applying payment.",
        error: error.message,
      });
    }
  },
};

export default paymentController;
