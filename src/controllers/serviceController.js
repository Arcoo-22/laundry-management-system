import Service from "../models/serviceModel.js";

const serviceController = {
  getAll: async (req, res) => {
    try {
      const services = await Service.getAll();

      return res.status(200).json({
        success: true,
        services: services || [],
        available_services: services || [],
      });
    } catch (error) {
      console.error("Error fetching services:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch services.",
        error: error.message,
      });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Service ID is required",
        });
      }

      const service = await Service.getById(id);

      if (!service) {
        return res.status(404).json({
          success: false,
          message: `No service found with ID: ${id}`,
        });
      }

      return res.status(200).json({
        success: true,
        data: service,
        service: service,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error fetching service by ID",
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
          message: "Service name is required",
        });
      }

      const services = await Service.getByName(name);

      if (!services || services.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No services found matching: ${name}`,
        });
      }

      return res.status(200).json({
        success: true,
        total: services.length,
        results: services,
        services: services,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error searching service by name",
        error: error.message,
      });
    }
  },

  create: async (req, res) => {
    try {
      const { service_name, price_per_kilo, description } = req.body;

      if (!service_name || price_per_kilo === undefined || !description) {
        return res.status(400).json({
          success: false,
          message:
            "All fields (service_name, price_per_kilo, description) are required",
        });
      }

      const parsedPrice = parseFloat(price_per_kilo);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: "price_per_kilo must be a positive number",
        });
      }

      const newService = await Service.create({
        service_name,
        price_per_kilo: parsedPrice,
        description,
      });

      return res.status(201).json({
        success: true,
        message: "Service created successfully",
        service_id: newService.id,
        newService: newService,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { service_name, price_per_kilo, description } = req.body;

      const existingService = await Service.getById(id);
      if (!existingService) {
        return res.status(404).json({
          success: false,
          message: `Service #${id} not found`,
        });
      }

      if (!service_name || price_per_kilo === undefined || !description) {
        return res.status(400).json({
          success: false,
          message: "All fields (service_name, price_per_kilo, description) are required",
        });
      }

      const parsedPrice = parseFloat(price_per_kilo);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: "price_per_kilo must be a positive number",
        });
      }

      await Service.update(id, {
        service_name,
        price_per_kilo: parsedPrice,
        description,
      });

      return res.status(200).json({
        success: true,
        message: `Service #${id} updated successfully.`,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error updating service",
        error: error.message,
      });
    }
  },

  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const existingService = await Service.getById(id);

      if (!existingService) {
        return res.status(404).json({
          success: false,
          message: `Service #${id} not found`,
        });
      }

      await Service.delete(id);
      return res.status(200).json({
        success: true,
        message: `Service #${id} deleted successfully.`,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error deleting service",
        error: error.message,
      });
    }
  },
};

export default serviceController;
