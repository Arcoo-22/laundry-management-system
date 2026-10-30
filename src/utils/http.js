// Shared validation helpers and error mapping for controllers / models

export const httpError = (status, message) => Object.assign(new Error(message), { status });

const clean = (v) => String(v ?? "").trim().toLowerCase();
const lookup = (pairs) => {
  const map = new Map(pairs);
  return (v) => map.get(clean(v)) ?? null;
};

// Each returns the canonical value, or null when the input isn't recognised
export const normalizeOrderStatus = lookup([
  ["pending", "Pending"], ["processing", "Processing"], ["ready", "Ready"],
  ["completed", "Completed"], ["cancelled", "Cancelled"], ["canceled", "Cancelled"],
]);
export const normalizeDelivery = lookup([
  ["pickup", "Pickup"], ["pick up", "Pickup"], ["pick-up", "Pickup"],
  ["delivery", "Delivery"], ["drop off", "Delivery"], ["drop-off", "Delivery"], ["dropoff", "Delivery"],
]);
export const normalizePaymentMode = lookup([
  ["cash", "Cash"], ["gcash", "GCash"], ["maya", "Maya"],
  ["bank transfer", "Bank Transfer"], ["bank", "Bank Transfer"], ["transfer", "Bank Transfer"],
]);
export const normalizePaymentStatus = lookup([
  ["unpaid", "Unpaid"], ["partially paid", "Partially Paid"], ["partial", "Partially Paid"],
  ["fully paid", "Fully Paid"], ["paid", "Fully Paid"], ["completed", "Fully Paid"],
]);

export const ORDER_STATUSES = ["Pending", "Processing", "Ready", "Completed", "Cancelled"];
export const DELIVERY_METHODS = ["Pickup", "Delivery"];
export const PAYMENT_MODES = ["Cash", "GCash", "Maya", "Bank Transfer"];
export const PAYMENT_STATUSES = ["Unpaid", "Partially Paid", "Fully Paid"];

// Positive whole number (ids)
export const isId = (v) => /^\d+$/.test(String(v ?? "").trim()) && Number.isSafeInteger(Number(v)) && Number(v) > 0;

// Money / weight rounding to 2 decimals (matches DECIMAL(x,2) columns)
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Trim a string; returns null when it isn't a non-empty string
export const cleanText = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

// Validates customer details. Returns { data } with trimmed values, or { error } for the client.
export const validateCustomer = (body = {}) => {
  const full_name = cleanText(body.full_name);
  const contact = cleanText(body.contact);
  const email = cleanText(body.email);
  const address = cleanText(body.address);

  if (!full_name || !contact || !email || !address) {
    return { error: "All fields (full_name, contact, email, address) are required" };
  }
  if (full_name.length > 100) return { error: "full_name must be 100 characters or fewer" };
  if (!PHONE_RE.test(contact)) return { error: "contact must be a valid phone number (7-20 digits)" };
  if (email.length > 100 || !EMAIL_RE.test(email)) return { error: "email must be a valid email address" };
  if (address.length > 255) return { error: "address must be 255 characters or fewer" };

  return { data: { full_name, contact, email, address } };
};

// Turn thrown errors into a consistent JSON response (no raw SQL leaking to clients)
export function sendError(res, error, fallbackMessage, conflictMessage) {
  if (error?.status) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  switch (error?.errno) {
    case 1451: // row is referenced by another table
      return res.status(409).json({
        success: false,
        message: conflictMessage || "This record is still used by other records and can't be deleted.",
      });
    case 1452: // foreign key target missing
      return res.status(400).json({ success: false, message: "A referenced customer, service or order does not exist." });
    case 1062: // duplicate
      return res.status(409).json({ success: false, message: "A record with these details already exists." });
    case 1406: // data too long
    case 1264: // out of range
    case 1265: // truncated
      return res.status(400).json({ success: false, message: "A value is too long or out of range." });
  }
  console.error(fallbackMessage, error);
  const body = { success: false, message: fallbackMessage };
  if (process.env.NODE_ENV !== "production") body.error = error?.message;
  return res.status(500).json(body);
}