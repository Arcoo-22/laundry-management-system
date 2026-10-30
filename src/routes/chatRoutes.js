import express from "express";
const router = express.Router();

import chatController from "../controllers/chatController.js";

/**
 * @openapi
 * /api/chat:
 *   post:
 *     summary: Chat with Bubbo, the Groq-powered laundry assistant
 *     tags:
 *       - Chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messages]
 *             properties:
 *               messages:
 *                 type: array
 *                 description: Recent conversation, oldest first. The last message must be from the user.
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *     responses:
 *       200:
 *         description: Bubbo's reply
 *       400:
 *         description: No user message supplied
 *       429:
 *         description: Too many messages, or Groq is rate limiting
 *       503:
 *         description: GROQ_API_KEY is not configured on the server
 */
router.post("/", chatController.chat);

export default router;