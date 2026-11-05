import express from "express";
const router = express.Router();

import orderApprovalController from "../controllers/orderApprovalController.js";

// Mounted at /api/orders (admin only), before orderRoutes so "/pending-count" isn't read as an order id.

/**
 * @openapi
 * /api/orders/pending-count:
 *   get:
 *     summary: How many customer requests are waiting for confirmation (admin)
 *     tags: [Orders]
 *     responses:
 *       200: { description: "{ success, count }" }
 */
router.get("/pending-count", orderApprovalController.pendingCount);

/**
 * @openapi
 * /api/orders/{id}/confirm:
 *   put:
 *     summary: Confirm a customer's order request (admin). Status becomes Pending.
 *     tags: [Orders]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Order confirmed }
 *       404: { description: Order not found }
 *       409: { description: The order is not waiting for confirmation }
 */
router.put("/:id/confirm", orderApprovalController.confirm);

/**
 * @openapi
 * /api/orders/{id}/reject:
 *   put:
 *     summary: Reject a customer's order request with a reason (admin)
 *     tags: [Orders]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, maxLength: 255 }
 *     responses:
 *       200: { description: Order rejected }
 *       400: { description: Reason missing }
 *       409: { description: The order is not waiting for confirmation }
 */
router.put("/:id/reject", orderApprovalController.reject);

export default router;