import Order from "../models/orderModel.js";
import OrderItem from "../models/orderItemModel.js";
import Payment from "../models/paymentModel.js";
import {
  isId,
  normalizeDelivery,
  normalizeOrderStatus,
  sendError,
  validateCustomer,
  ORDER_STATUSES,
  DELIVERY_METHODS,
} from "../utils/http.js";

const badStatus = (res) =>
  res.status(400).json({
    success: false,
    message: `Invalid status. Allowed values: ${ORDER_STATUSES.join(", ")}`,
  });

const badDelivery = (res) =>
  res.status(400).json({
    success: false,
    message: `Invalid delivery method. Allowed values: ${DELIVERY_METHODS.join(", ")}`,
  });

const orderController = {
  getAll: async (req, res) => {
    try {
      const orders = await Order.getAll();
      return res.status(200).json({ success: true, orders: orders || [] });
    } catch (err) {
      return sendError(res, err, "Error fetching orders");
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const order = await Order.getById(id);

      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      const [items, payments, totalPaid] = await Promise.all([
        OrderItem.getByOrder(id),
        Payment.getByOrderId(id).catch(() => []),
        Payment.getTotalPaid(id).catch(() => 0),
      ]);

      const totalAmount = parseFloat(order.total_amount || 0);
      const balance = Math.max(0, totalAmount - totalPaid);
      let paymentStatus = "Unpaid";
      if (totalPaid >= totalAmount && totalAmount > 0) {
        paymentStatus = "Fully Paid";
      } else if (totalPaid > 0) {
        paymentStatus = "Partially Paid";
      }

      const enrichedOrder = {
        ...order,
        total_paid: totalPaid,
        balance_remaining: balance,
        payment_status: paymentStatus,
      };

      return res.status(200).json({
        success: true,
        order: enrichedOrder,
        data: enrichedOrder,
        items: items || [],
        payments: payments || [],
      });
    } catch (error) {
      return sendError(res, error, `Error fetching order ${req.params.id}`);
    }
  },

  getByStatus: async (req, res) => {
    try {
      const status = normalizeOrderStatus(req.params.status);
      if (!status) return badStatus(res);

      const orders = await Order.getByStatus(status);

      return res.status(200).json({
        success: true,
        status,
        total: orders ? orders.length : 0,
        orders: orders || [],
      });
    } catch (error) {
      return sendError(res, error, "Error fetching orders by status");
    }
  },

  getByName: async (req, res) => {
    try {
      const name = (req.params.name || "").trim();

      if (!name) {
        return res.status(400).json({ success: false, message: "Customer name is required" });
      }

      const orders = await Order.getByName(name);

      return res.status(200).json({
        success: true,
        name,
        total: orders ? orders.length : 0,
        orders: orders || [],
      });
    } catch (error) {
      return sendError(res, error, "Error fetching orders by name");
    }
  },

  // Accepts EITHER an existing customer_id OR new customer details
  // ({ customer: { full_name, contact, email, address } }, or those fields at the top level).
  create: async (req, res) => {
    try {
      const body = req.body || {};
      const { customer_id, service_id, delivery_methods } = body;

      if (!isId(service_id)) {
        return res.status(400).json({ success: false, message: "service_id is required and must be a valid id" });
      }

      let delivery = "Pickup";
      if (delivery_methods !== undefined && delivery_methods !== null && String(delivery_methods).trim() !== "") {
        delivery = normalizeDelivery(delivery_methods);
        if (!delivery) return badDelivery(res);
      }

      const hasCustomerId = customer_id !== undefined && customer_id !== null && String(customer_id).trim() !== "";
      let customer = null;

      if (hasCustomerId) {
        if (!isId(customer_id)) {
          return res.status(400).json({ success: false, message: "customer_id must be a valid id" });
        }
      } else {
        const source = body.customer && typeof body.customer === "object" ? body.customer : body;
        const { data, error } = validateCustomer(source);
        if (error) return res.status(400).json({ success: false, message: error });
        customer = data;
      }

      const result = await Order.createWithCustomer({
        customer_id: hasCustomerId ? Number(customer_id) : null,
        customer,
        service_id: Number(service_id),
        delivery_methods: delivery,
      });

      return res.status(201).json({
        success: true,
        message: "Order created successfully",
        order_id: result.order_id,
        customer_id: result.customer_id,
        customer_created: result.customer_created,
      });
    } catch (error) {
      return sendError(res, error, "Error creating order");
    }
  },

  updateStatus: async (req, res) => {
    try {
      const id = req.params.id;

      const existingOrder = await Order.getById(id);
      if (!existingOrder) {
        return res.status(404).json({ success: false, message: `Order with id ${id} not found` });
      }

      const rawStatus = req.body?.status;
      if (!rawStatus) {
        return res.status(400).json({ success: false, message: "Field {status} is required" });
      }

      // Reject unknown values instead of silently turning them into "Pending"
      const status = normalizeOrderStatus(rawStatus);
      if (!status) return badStatus(res);

      await Order.updateStatus(id, status);

      return res.status(200).json({
        success: true,
        message: "Status updated",
        order_id: id,
        status,
      });
    } catch (error) {
      return sendError(res, error, `Error updating the status of order ${req.params.id}`);
    }
  },

  getOrdersByDeliveryMethod: async (req, res) => {
    try {
      const delivery = normalizeDelivery(req.params.delivery_methods);
      if (!delivery) return badDelivery(res);

      const orders = await Order.getByDeliveryMethod(delivery);

      return res.status(200).json({ success: true, orders: orders || [] });
    } catch (error) {
      return sendError(res, error, "Server error");
    }
  },

  updateDelivery: async (req, res) => {
    try {
      const id = req.params.id;

      const existingOrder = await Order.getById(id);
      if (!existingOrder) {
        return res.status(404).json({ success: false, message: `Order with ID ${id} not found` });
      }

      const rawDelivery = req.body?.delivery_methods;
      if (!rawDelivery) {
        return res.status(400).json({ success: false, message: "Field {delivery_methods} is required" });
      }

      const delivery = normalizeDelivery(rawDelivery);
      if (!delivery) return badDelivery(res);

      await Order.updateDelivery(id, delivery);

      return res.status(200).json({
        success: true,
        message: "Delivery method updated successfully",
        order_id: id,
        delivery_methods: delivery,
      });
    } catch (error) {
      return sendError(res, error, `Error updating delivery method for order ${req.params.id}`);
    }
  },

  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const existingOrder = await Order.getById(id);

      if (!existingOrder) {
        return res.status(404).json({ success: false, message: `Order #${id} not found` });
      }

      await Order.delete(id);
      return res.status(200).json({ success: true, message: `Order #${id} deleted successfully.` });
    } catch (error) {
      return sendError(res, error, `Error deleting order #${req.params.id}`);
    }
  },
};

export default orderController;