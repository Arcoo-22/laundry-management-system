import Customer from "../models/customerModel.js";

const customerController = {
  getAll: async (req, res) => {
    try {
      const customers = await Customer.getAll();

      return res.status(200).json({
        success: true,
        customers: customers || [],
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Error fetching customers",
        error: err.message,
      });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const customer = await Customer.getById(id);

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: customer,
        customer: customer,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Error fetching customer",
        error: err.message,
      });
    }
  },

  getByName: async (req, res) => {
    try {
      const customerName = req.params.name;

      if (!customerName) {
        return res.status(400).json({
          success: false,
          message: "Customer name is required",
        });
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
      return res.status(500).json({
        success: false,
        message: "Error fetching customer",
        error: error.message,
      });
    }
  },

  create: async (req, res) => {
    try {
      const { full_name, contact, email, address } = req.body;

      if (!full_name || !contact || !email || !address) {
        return res.status(400).json({
          success: false,
          message:
            "All fields (full_name, contact, email, address) are required",
        });
      }

      const newCustomer = await Customer.create({
        full_name,
        contact,
        email,
        address,
      });

      return res.status(201).json({
        success: true,
        message: "Customer added successfully",
        customer_id: newCustomer.id,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Error creating customer",
        error: err.message,
      });
    }
  },

  update: async (req, res) => {
    try {
      const { full_name, contact, email, address } = req.body;
      const id = req.params.id;

      const existingCustomer = await Customer.getById(id);

      if (!existingCustomer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      if (!full_name || !contact || !email || !address) {
        return res.status(400).json({
          success: false,
          message:
            "All fields (full_name, contact, email, address) are required",
        });
      }

      await Customer.update(id, { full_name, contact, email, address });
      return res.status(200).json({
        success: true,
        message: `Customer ${id} updated.`,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Customer ${req.params.id} NOT updated`,
        error: error.message,
      });
    }
  },

  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const existingCustomer = await Customer.getById(id);

      if (!existingCustomer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      await Customer.delete(id);
      return res.status(200).json({
        success: true,
        message: `Customer ${id} deleted successfully.`,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Customer ${req.params.id} NOT deleted`,
        error: error.message,
      });
    }
  },
};

export default customerController;
