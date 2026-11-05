import express from "express";
const router = express.Router();

import portalController from "../controllers/portalController.js";

// Mounted at /api/portal for logged-in customers only (server.js applies requireRole("customer")).

/**
 * @openapi
 * /api/portal/profile:
 *   get:
 *     summary: The logged-in customer's details
 *     tags: [Customer portal]
 *     responses:
 *       200: { description: Profile }
 *   put:
 *     summary: Update name, phone and address (email can't be changed)
 *     tags: [Customer portal]
 *     responses:
 *       200: { description: Profile updated }
 *       400: { description: Invalid input }
 */
router.get("/profile", portalController.getProfile);
router.put("/profile", portalController.updateProfile);

/**
 * @openapi
 * /api/portal/orders:
 *   get:
 *     summary: The logged-in customer's own orders
 *     tags: [Customer portal]
 *     responses:
 *       200: { description: Orders with paid amount and balance }
 *   post:
 *     summary: Send an order request. It stays "Pending Confirmation" until an admin confirms it.
 *     tags: [Customer portal]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [service_id]
 *             properties:
 *               service_id: { type: integer }
 *               delivery_methods: { type: string, enum: [Pickup, Delivery] }
 *               customer_notes: { type: string, maxLength: 500 }
 *     responses:
 *       201: { description: Request created }
 *       429: { description: Too many requests already waiting }
 */
router.get("/orders", portalController.listOrders);
router.post("/orders", portalController.createOrder);

/**
 * @openapi
 * /api/portal/orders/{id}:
 *   get:
 *     summary: One of the customer's own orders, with items and payments
 *     tags: [Customer portal]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Order details }
 *       404: { description: Not found, or not this customer's order }
 */
router.get("/orders/:id", portalController.getOrder);

/**
 * @openapi
 * /api/portal/orders/{id}/cancel:
 *   put:
 *     summary: Cancel a request that the shop hasn't confirmed yet
 *     tags: [Customer portal]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Cancelled }
 *       409: { description: The shop already reviewed this order }
 */
router.put("/orders/:id/cancel", portalController.cancelOrder);

export default router;