import Customer from "../models/customerModel.js";
import { sendError, validateCustomer } from "../utils/http.js";

const customerController = {
  getAll: async (req, res) => {
    try {
      const customers = await Customer.getAll();
      return res.status(200).json({ success: true, customers: customers || [] });
    } catch (err) {
      return sendError(res, err, "Error fetching customers");
    }
  },

  getById: async (req, res) => {
    try {
      const customer = await Customer.getById(req.params.id);

      if (!customer) {
        return res.status(404).json({ success: false, message: "Customer not found" });
      }

      return res.status(200).json({ success: true, data: customer, customer });
    } catch (err) {
      return sendError(res, err, "Error fetching customer");
    }
  },

  getByName: async (req, res) => {
    try {
      const customerName = (req.params.name || "").trim();

      if (!customerName) {
        return res.status(400).json({ success: false, message: "Customer name is required" });
      }

      const existingCustomers = await Customer.getByName(customerName);

      if (!existingCustomers || existingCustomers.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No customer found with name: ${customerName}`,
        });
      }

      return res.status(200).json({
        success: true,
        customers: existingCustomers,
        message: existingCustomers,
      });
    } catch (error) {
      return sendError(res, error, "Error fetching customer");
    }
  },

  create: async (req, res) => {
    try {
      const { data, error } = validateCustomer(req.body);
      if (error) return res.status(400).json({ success: false, message: error });

      const newCustomer = await Customer.create(data);

      return res.status(201).json({
        success: true,
        message: "Customer added successfully",
        customer_id: newCustomer.id,
      });
    } catch (err) {
      return sendError(res, err, "Error creating customer");
    }
  },

  update: async (req, res) => {
    try {
      const id = req.params.id;

      const existingCustomer = await Customer.getById(id);
      if (!existingCustomer) {
        return res.status(404).json({ success: false, message: "Customer not found" });
      }

      const { data, error } = validateCustomer(req.body);
      if (error) return res.status(400).json({ success: false, message: error });

      await Customer.update(id, data);
      return res.status(200).json({ success: true, message: `Customer ${id} updated.` });
    } catch (error) {
      return sendError(res, error, `Customer ${req.params.id} NOT updated`);
    }
  },

  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const existingCustomer = await Customer.getById(id);

      if (!existingCustomer) {
        return res.status(404).json({ success: false, message: "Customer not found" });
      }

      await Customer.delete(id);
      return res.status(200).json({ success: true, message: `Customer ${id} deleted successfully.` });
    } catch (error) {
      return sendError(
        res,
        error,
        `Customer ${req.params.id} NOT deleted`,
        "This customer has existing orders and can't be deleted."
      );
    }
  },
};

export default customerController;