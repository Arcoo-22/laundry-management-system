// Dependencies
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";

import { dbConnect } from "./config/database.js";
import swaggerSpec from "./config/swagger.js";
import customerRoutes from "./routes/customerRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import orderItemRoutes from "./routes/orderItemRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

// Config
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ?? 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Frontend (serves public/index.html at "/", and /orders.html, /css/..., /js/...)
app.use(express.static(path.join(__dirname, "../public")));

// API routes
app.use("/api/customers", customerRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/order-items", orderItemRoutes);
app.use("/api/payments", paymentRoutes);

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Unknown /api/* path -> JSON 404 (instead of Express's HTML error page)
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Last-resort error handler (bad JSON body, uncaught errors, etc.)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// Make sure the DB is reachable before the server starts
dbConnect()
  .then(() => {
    app.listen(PORT, () => {
      console.log("Server running on port:", PORT);
      console.log(`App:      http://localhost:${PORT}`);
      console.log(`API docs: http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to DB. Server not started:", err);
    process.exit(1);
  });