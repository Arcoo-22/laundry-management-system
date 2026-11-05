import express from "express";
const router = express.Router();

import staffController from "../controllers/staffController.js";

// Mounted at /api/staff for the superadmin only (server.js applies requireRole("superadmin")).

/**
 * @openapi
 * /api/staff:
 *   get:
 *     summary: List staff and admin accounts (superadmin)
 *     tags: [Staff accounts]
 *     responses:
 *       200: { description: Accounts, without passwords }
 *   post:
 *     summary: Create a staff or admin account (superadmin). Superadmin accounts can't be created here.
 *     tags: [Staff accounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [full_name, email, role, password]
 *             properties:
 *               full_name: { type: string }
 *               email: { type: string }
 *               role: { type: string, enum: [staff, admin] }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       201: { description: Account created }
 *       409: { description: Email already used }
 */
router.get("/", staffController.list);
router.post("/", staffController.create);

/**
 * @openapi
 * /api/staff/{id}:
 *   put:
 *     summary: Change a staff member's name, role (staff or admin) or active state (superadmin)
 *     tags: [Staff accounts]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Updated }
 *       403: { description: Target is a superadmin account }
 */
router.put("/:id", staffController.update);

/**
 * @openapi
 * /api/staff/{id}/password:
 *   put:
 *     summary: Set a new password for a staff member and sign them out everywhere (superadmin)
 *     tags: [Staff accounts]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password set }
 */
router.put("/:id/password", staffController.resetPassword);

export default router;