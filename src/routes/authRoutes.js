import express from "express";
const router = express.Router();

import authController from "../controllers/authController.js";
import { requireAuth } from "../utils/auth.js";

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Create a customer account (also signs the customer in)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [full_name, contact, email, address, password]
 *             properties:
 *               full_name: { type: string }
 *               contact: { type: string }
 *               email: { type: string }
 *               address: { type: string }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       201: { description: Account created }
 *       400: { description: Invalid input }
 *       409: { description: Email already used, or already on file at the shop }
 */
router.post("/register", authController.register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Log in as admin or customer (sets a session cookie)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Logged in. The response includes the user's role and where to go next. }
 *       401: { description: Wrong email or password }
 *       429: { description: Too many failed attempts }
 */
router.post("/login", authController.login);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Log out (clears the session cookie)
 *     tags: [Auth]
 *     responses:
 *       200: { description: Logged out }
 */
router.post("/logout", authController.logout);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Who is logged in right now
 *     tags: [Auth]
 *     responses:
 *       200: { description: The current user and role }
 *       401: { description: Not logged in }
 */
router.get("/me", authController.me);

/**
 * @openapi
 * /api/auth/password:
 *   put:
 *     summary: Change the logged-in user's password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password: { type: string }
 *               new_password: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password changed }
 *       400: { description: Wrong current password or weak new password }
 */
router.put("/password", requireAuth, authController.changePassword);

export default router;