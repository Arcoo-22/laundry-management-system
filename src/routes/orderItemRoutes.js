import express from "express";
const router = express.Router();

import orderItemController from "../controllers/orderItemController.js";

/**
 * @openapi
 * /api/order-items:
 *   post:
 *     summary: Add items to an order
 *     tags:
 *       - Order Items
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - order_id
 *               - items
 *             properties:
 *               order_id:
 *                 type: integer
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - clothe_type
 *                     - weight_in_kilo
 *                   properties:
 *                     clothe_type:
 *                       type: string
 *                     weight_in_kilo:
 *                       type: number
 *     responses:
 *       200:
 *         description: Items added and order totals updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 totalWeight:
 *                   type: number
 *                 totalAmount:
 *                   type: number
 */
router.post("/", orderItemController.addItems);

/**
 * @openapi
 * /api/order-items/order/{order_id}:
 *   get:
 *     summary: Get all items for an order
 *     tags:
 *       - Order Items
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Items list for the order
 */
router.get("/order/:order_id", orderItemController.getByOrder);

/**
 * @openapi
 * /api/order-items/{id}:
 *   put:
 *     summary: Update an existing order item
 *     tags:
 *       - Order Items
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the order item to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clothe_type:
 *                 type: string
 *               weight_in_kilo:
 *                 type: number
 *     responses:
 *       200:
 *         description: Order item updated successfully
 */
router.put("/:id", orderItemController.updateItem);

/**
 * @openapi
 * /api/order-items/{id}:
 *   delete:
 *     summary: Delete an order item and recalculate order totals
 *     tags:
 *       - Order Items
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Item deleted successfully
 *       404:
 *         description: Item not found
 */
router.delete("/:id", orderItemController.deleteItem);

export default router;

/**
 * @openapi
 * components:
 *   schemas:
 *     Order Item:
 *       type: object
 *       properties:
 *         item_id:
 *           type: integer
 *         order_id:
 *           type: integer
 *         clothe_type:
 *           type: string
 *         weight_in_kilo:
 *           type: number
 *         subtotal:
 *           type: number
 */
