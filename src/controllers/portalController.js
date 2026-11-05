import Order from "../models/orderModel.js";
import OrderItem from "../models/orderItemModel.js";
import Payment from "../models/paymentModel.js";
import User from "../models/userModel.js";
import { cleanText, isId, normalizeDelivery, round2, sendError, validateCustomer } from "../utils/http.js";

// Customer-only endpoints. Every query is scoped to req.user.customer_id, so a customer
// can never read or change somebody else's data by guessing ids.
const customerId = (req, res) => {
  if (!req.user.customer_id) {
    res.status(409).json({ success: false, message: "Your account isn't linked to a customer record yet. Please contact the shop." });
    return null;
  }
  return req.user.customer_id;
};

const withBalance = (o) => {
  const total = round2(o.total_amount || 0);
  const paid = round2(o.total_paid || 0);
  return { ...o, total_paid: paid, balance_remaining: Math.max(0, round2(total - paid)) };
};

const portalController = {
  getProfile: async (req, res) => {
    try {
      const id = customerId(req, res);
      if (!id) return;
      const profile = await User.getCustomerProfile(id);
      return res.status(200).json({ success: true, profile });
    } catch (error) {
      return sendError(res, error, "Error loading your profile");
    }
  },

  updateProfile: async (req, res) => {
    try {
      const id = customerId(req, res);
      if (!id) return;

      const current = await User.getCustomerProfile(id);
      // Email is the login, so it stays as is; the rest is validated with the same rules as the admin side
      const { data, error } = validateCustomer({ ...req.body, email: current.email });
      if (error) return res.status(400).json({ success: false, message: error });

      await User.updateProfile(id, req.user.id, data);
      return res.status(200).json({ success: true, message: "Profile updated.", profile: { ...data, customer_id: id } });
    } catch (error) {
      return sendError(res, error, "Error updating your profile");
    }
  },

  listOrders: async (req, res) => {
    try {
      const id = customerId(req, res);
      if (!id) return;
      const orders = (await Order.getByCustomer(id)).map(withBalance);
      return res.status(200).json({ success: true, orders });
    } catch (error) {
      return sendError(res, error, "Error loading your orders");
    }
  },

  getOrder: async (req, res) => {
    try {
      const id = customerId(req, res);
      if (!id) return;
      if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid order id" });

      const order = await Order.getOwnedById(Number(req.params.id), id);
      if (!order) return res.status(404).json({ success: false, message: "Order not found." });

      const [items, payments, totalPaid] = await Promise.all([
        OrderItem.getByOrder(order.order_id),
        Payment.getByOrderId(order.order_id).catch(() => []),
        Payment.getTotalPaid(order.order_id).catch(() => 0),
      ]);

      return res.status(200).json({
        success: true,
        order: withBalance({ ...order, total_paid: totalPaid }),
        items: (items || []).map(({ item_id, clothe_type, weight_in_kilo, subtotal }) => ({
          item_id,
          clothe_type,
          weight_in_kilo,
          subtotal,
        })),
        payments: (payments || []).map(({ payment_id, payment_mode, amount_paid, payment_date }) => ({
          payment_id,
          payment_mode,
          amount_paid,
          payment_date,
        })),
      });
    } catch (error) {
      return sendError(res, error, "Error loading the order");
    }
  },

  createOrder: async (req, res) => {
    try {
      const id = customerId(req, res);
      if (!id) return;

      const { service_id, delivery_methods } = req.body || {};
      if (!isId(service_id)) return res.status(400).json({ success: false, message: "Please choose a service." });

      const delivery = normalizeDelivery(delivery_methods || "Pickup");
      if (!delivery) return res.status(400).json({ success: false, message: "Choose Pickup or Delivery." });

      const notes = cleanText(req.body?.customer_notes);
      if (notes && notes.length > 500) {
        return res.status(400).json({ success: false, message: "Notes must be 500 characters or fewer." });
      }

      const result = await Order.createRequest({
        customer_id: id,
        service_id: Number(service_id),
        delivery_methods: delivery,
        customer_notes: notes,
      });

      return res.status(201).json({
        success: true,
        message: "Request sent! The shop will confirm your order soon.",
        order_id: result.order_id,
        status: result.status,
      });
    } catch (error) {
      return sendError(res, error, "Error placing your order");
    }
  },

  cancelOrder: async (req, res) => {
    try {
      const id = customerId(req, res);
      if (!id) return;
      if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid order id" });

      const result = await Order.cancelRequest(Number(req.params.id), id);
      return res.status(200).json({ success: true, message: `Order #${result.order_id} cancelled.`, status: result.status });
    } catch (error) {
      return sendError(res, error, "Error cancelling the order");
    }
  },
};

export default portalController;