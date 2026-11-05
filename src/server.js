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
import chatRoutes from "./routes/chatRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import portalRoutes from "./routes/portalRoutes.js";
import orderApprovalRoutes from "./routes/orderApprovalRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import authController from "./controllers/authController.js";
import {
  authenticate,
  requireAuth,
  requireRole,
  requireStaff,
  requireAdminUp,
  homeFor,
  hasStaffFlag,
  getStaffLoginPath,
} from "./utils/auth.js";

// Config
dotenv.config({ path: [".env", ".env_local"], quiet: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable("x-powered-by");
const PORT = process.env.PORT ?? 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));

// ---- Hidden staff entrance -------------------------------------------------
// Staff, admins and the superadmin sign in here. The address is not linked from any page and
// both the page and the sign-in request use it, so nothing public points to it.
const STAFF_PATH = getStaffLoginPath();

app.get(STAFF_PATH, authenticate, (req, res) => {
  if (req.user && req.user.role !== "customer") return res.redirect(homeFor(req.user));
  res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
  res.sendFile(path.join(__dirname, "views", "staff-login.html"));
});
app.post(STAFF_PATH, authController.staffLogin);

// ---- Page access: who may open which page (the API is protected separately below) ----
const STAFF_PAGES = new Set(["/", "/index.html", "/orders.html", "/customers.html", "/services.html", "/payments.html"]);
const SUPERADMIN_PAGES = new Set(["/staff.html"]);
const CUSTOMER_PAGES = new Set(["/portal.html"]);
const GUEST_PAGES = new Set(["/login.html", "/register.html"]); // signed-in users are sent home instead

const pageKey = (req) => (req.path.length > 1 ? req.path.replace(/\/+$/, "") : req.path).toLowerCase();
const isPage = (key) => STAFF_PAGES.has(key) || SUPERADMIN_PAGES.has(key) || CUSTOMER_PAGES.has(key) || GUEST_PAGES.has(key);

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const key = pageKey(req);
  // Look the user up only for the pages and the API, not for every css / js / image file
  if (!req.path.startsWith("/api") && !isPage(key)) return next();
  return authenticate(req, res, next);
});

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const key = pageKey(req);

  if (STAFF_PAGES.has(key) || SUPERADMIN_PAGES.has(key)) {
    // Signed-out staff go back to their entrance (this browser has used it before); everyone else to the customer login
    if (!req.user) return res.redirect(hasStaffFlag(req) ? STAFF_PATH : "/login.html");
    if (req.user.role === "customer") return res.redirect(homeFor(req.user));
    if (SUPERADMIN_PAGES.has(key) && req.user.role !== "superadmin") return res.redirect(homeFor(req.user));
  } else if (CUSTOMER_PAGES.has(key)) {
    if (!req.user) return res.redirect("/login.html");
    if (req.user.role !== "customer") return res.redirect(homeFor(req.user));
  } else if (GUEST_PAGES.has(key) && req.user) {
    return res.redirect(homeFor(req.user));
  }
  next();
});

// Frontend (serves public/index.html at "/", and /orders.html, /css/..., /js/...)
app.use(express.static(path.join(__dirname, "../public")));

// API routes. POST/PUT/DELETE requests need the cookie too (the pages above are not enough).
app.use("/api", (req, res, next) => (req.user ? next() : authenticate(req, res, next)));
app.use("/api/auth", authRoutes);

// Customer portal: customers only
app.use("/api/portal", requireRole("customer"), portalRoutes);

// Regular staff can do the daily work but can't delete customers, orders or payments
const noStaffDelete = (req, res, next) =>
  req.method === "DELETE" && req.user.role === "staff"
    ? res.status(403).json({ success: false, code: "FORBIDDEN", message: "Only an admin can delete records." })
    : next();

// Staff, admins and the superadmin: customers, orders, order items, payments
app.use("/api/customers", requireStaff, noStaffDelete, customerRoutes);
app.use("/api/orders", requireStaff, orderApprovalRoutes); // confirm / reject / pending-count
app.use("/api/orders", requireStaff, noStaffDelete, orderRoutes);
app.use("/api/order-items", requireStaff, orderItemRoutes);
app.use("/api/payments", requireStaff, noStaffDelete, paymentRoutes);

// Services: any signed-in user can read the price list; only admins and the superadmin can change it
app.use(
  "/api/services",
  requireAuth,
  (req, res, next) => (req.method === "GET" ? next() : requireAdminUp(req, res, next)),
  serviceRoutes
);

// Staff account management: superadmin only
app.use("/api/staff", requireRole("superadmin"), staffRoutes);

// Bubbo is for customers only (it uses AI credits)
app.use("/api/chat", requireRole("customer"), chatRoutes);

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
      console.log(`Staff sign-in (keep private): http://localhost:${PORT}${STAFF_PATH}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to DB. Server not started:", err);
    process.exit(1);
  });