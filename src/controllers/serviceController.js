import Service from "../models/serviceModel.js";
import { cleanText, round2, sendError } from "../utils/http.js";

const MAX_PRICE = 99999999.99; // DECIMAL(10,2)

// Returns { data } with cleaned values, or { error } for the client.
// description is optional (the UI shows "No description provided." when empty).
const validateService = (body = {}) => {
  const service_name = cleanText(body.service_name);
  if (!service_name || body.price_per_kilo === undefined || body.price_per_kilo === null || body.price_per_kilo === "") {
    return { error: "Fields service_name and price_per_kilo are required" };
  }
  if (service_name.length > 100) return { error: "service_name must be 100 characters or fewer" };

  const price = parseFloat(body.price_per_kilo);
  if (!Number.isFinite(price) || price <= 0) return { error: "price_per_kilo must be a positive number" };
  if (price > MAX_PRICE) return { error: "price_per_kilo is too large" };

  if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
    return { error: "description must be text" };
  }

  return {
    data: {
      service_name,
      price_per_kilo: round2(price),
      description: (body.description || "").trim(),
    },
  };
};

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
      return sendError(res, error, "Failed to fetch services.");
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const service = await Service.getById(id);

      if (!service) {
        return res.status(404).json({ success: false, message: `No service found with ID: ${id}` });
      }

      return res.status(200).json({ success: true, data: service, service });
    } catch (error) {
      return sendError(res, error, "Error fetching service by ID");
    }
  },

  getByName: async (req, res) => {
    try {
      const name = (req.params.name || "").trim();

      if (!name) {
        return res.status(400).json({ success: false, message: "Service name is required" });
      }

      const services = await Service.getByName(name);

      if (!services || services.length === 0) {
        return res.status(404).json({ success: false, message: `No services found matching: ${name}` });
      }

      return res.status(200).json({
        success: true,
        total: services.length,
        results: services,
        services,
      });
    } catch (error) {
      return sendError(res, error, "Error searching service by name");
    }
  },

  create: async (req, res) => {
    try {
      const { data, error } = validateService(req.body);
      if (error) return res.status(400).json({ success: false, message: error });

      const newService = await Service.create(data);

      return res.status(201).json({
        success: true,
        message: "Service created successfully",
        service_id: newService.id,
        newService,
      });
    } catch (error) {
      return sendError(res, error, "Internal server error");
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;

      const existingService = await Service.getById(id);
      if (!existingService) {
        return res.status(404).json({ success: false, message: `Service #${id} not found` });
      }

      const { data, error } = validateService(req.body);
      if (error) return res.status(400).json({ success: false, message: error });

      await Service.update(id, data);
      return res.status(200).json({ success: true, message: `Service #${id} updated successfully.` });
    } catch (error) {
      return sendError(res, error, "Error updating service");
    }
  },

  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const existingService = await Service.getById(id);

      if (!existingService) {
        return res.status(404).json({ success: false, message: `Service #${id} not found` });
      }

      await Service.delete(id);
      return res.status(200).json({ success: true, message: `Service #${id} deleted successfully.` });
    } catch (error) {
      return sendError(res, error, "Error deleting service", "This service is used by existing orders and can't be deleted.");
    }
  },
};

export default serviceController;