import Order from "../models/orderModel.js";
import OrderItem from "../models/orderItemModel.js";
import Payment from "../models/paymentModel.js";

const orderController = {
  getAll: async (req, res) => {
    try {
      const orders = await Order.getAll();
      return res.status(200).json({
        success: true,
        orders: orders || [],
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Error fetching orders",
        error: err.message,
      });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const order = await Order.getById(id);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
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
      return res.status(500).json({
        success: false,
        message: `Error fetching order ${req.params.id}`,
        error: error.message,
      });
    }
  },

  getByStatus: async (req, res) => {
    try {
      const { status } = req.params;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: "Status parameter is required",
        });
      }

      const orders = await Order.getByStatus(status);

      return res.status(200).json({
        success: true,
        status: status,
        total: orders ? orders.length : 0,
        orders: orders || [],
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error fetching orders by status",
        error: error.message,
      });
    }
  },

  getByName: async (req, res) => {
    try {
      const { name } = req.params;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Customer name is required",
        });
      }

      const orders = await Order.getByName(name);

      return res.status(200).json({
        success: true,
        name: name,
        total: orders ? orders.length : 0,
        orders: orders || [],
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error fetching orders by name",
        error: error.message,
      });
    }
  },

  create: async (req, res) => {
    try {
      const { customer_id, service_id, delivery_methods } = req.body;

      if (!customer_id || !service_id) {
        return res.status(400).json({
          success: false,
          message: "All fields (customer_id, service_id) are required",
        });
      }

      const newOrder = await Order.create({
        customer_id,
        service_id,
        delivery_methods,
      });

      return res.status(201).json({
        success: true,
        message: "Order created successfully",
        order_id: newOrder.id,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error creating order",
        error: error.message,
      });
    }
  },

  updateStatus: async (req, res) => {
    try {
      const { status } = req.body;
      const id = req.params.id;

      const existingOrder = await Order.getById(id);

      if (!existingOrder) {
        return res.status(404).json({
          success: false,
          message: `Order with id ${id} not found`,
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: "Field {status} is required",
        });
      }

      await Order.updateStatus(id, status);

      return res.status(200).json({
        success: true,
        message: "Status updated",
        order_id: id,
        status,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Error updating the status of order ${req.params.id}`,
        error: error.message,
      });
    }
  },

  getOrdersByDeliveryMethod: async (req, res) => {
    try {
      const delivery_methods = req.params.delivery_methods;

      const orders = await Order.getByDeliveryMethod(delivery_methods);

      return res.status(200).json({
        success: true,
        orders: orders || [],
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  },

  updateDelivery: async (req, res) => {
    try {
      const { delivery_methods } = req.body;
      const id = req.params.id;

      const existingOrder = await Order.getById(id);

      if (!existingOrder) {
        return res.status(404).json({
          success: false,
          message: `Order with ID ${id} not found`,
        });
      }

      if (!delivery_methods) {
        return res.status(400).json({
          success: false,
          message: "Field {delivery_methods} is required",
        });
      }

      await Order.updateDelivery(id, delivery_methods);

      return res.status(200).json({
        success: true,
        message: "Delivery method updated successfully",
        order_id: id,
        delivery_methods,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Error updating delivery method for order ${req.params.id}`,
        error: error.message,
      });
    }
  },

  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const existingOrder = await Order.getById(id);

      if (!existingOrder) {
        return res.status(404).json({
          success: false,
          message: `Order #${id} not found`,
        });
      }

      await Order.delete(id);
      return res.status(200).json({
        success: true,
        message: `Order #${id} deleted successfully.`,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Error deleting order #${req.params.id}`,
        error: error.message,
      });
    }
  },
};

export default orderController;
