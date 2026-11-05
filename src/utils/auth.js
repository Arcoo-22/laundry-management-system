// Login helpers: password hashing, signed session tokens, route guards, and the hidden staff entrance.
// Uses only Node's built-in crypto, so there is nothing extra to install.
//
// Two kinds of accounts, kept in separate tables so they can never be mixed up:
//   customers -> tbl_users   (role is always "customer")
//   staff     -> tbl_staff   (role is "staff", "admin" or "superadmin")
import crypto from "node:crypto";
import { promisify } from "node:util";
import dotenv from "dotenv";
import db from "../config/database.js";
import { isSuperadminIpAllowed } from "./network.js";

dotenv.config({ path: [".env", ".env_local"], quiet: true });

const scrypt = promisify(crypto.scrypt);

export const COOKIE_NAME = "laundry_session";
const STAFF_FLAG_COOKIE = "laundry_staff"; // only says "this browser has used the staff entrance"
const SESSION_SECONDS = 7 * 24 * 60 * 60; // stay logged in for 7 days

export const STAFF_ROLES = ["staff", "admin", "superadmin"];
export const isStaffRole = (role) => STAFF_ROLES.includes(role);

// ---- Secret ----------------------------------------------------------
// Set AUTH_SECRET in .env (any long random string). Without it, a random
// secret is made on each start and everyone has to log in again after a restart.
let secret = null;
const getSecret = () => {
  if (secret) return secret;
  const fromEnv = (process.env.AUTH_SECRET || "").trim();
  if (fromEnv.length >= 16) {
    secret = fromEnv;
  } else {
    secret = crypto.randomBytes(32).toString("hex");
    console.warn(
      "[auth] AUTH_SECRET is missing or shorter than 16 characters in .env. " +
        "Using a temporary secret: all users will be logged out whenever the server restarts, " +
        "and the staff sign-in address will change."
    );
  }
  return secret;
};

// ---- Hidden staff entrance -----------------------------------------------
// Staff, admins and the superadmin sign in at one address that is not linked from anywhere.
// Set STAFF_LOGIN_PATH in .env to choose it (e.g. /shop-door-7q2x); otherwise a stable random
// one is derived from AUTH_SECRET and printed when the server starts.
const RESERVED_PATH = /^\/(api|api-docs|css|js|img|images|fonts)(\/|$)/i;
let staffPath = null;
export const getStaffLoginPath = () => {
  if (staffPath) return staffPath;

  const custom = (process.env.STAFF_LOGIN_PATH || "").trim();
  if (custom) {
    const cleaned = ("/" + custom.replace(/^\/+|\/+$/g, "")).replace(/\/{2,}/g, "/");
    const ok =
      /^\/[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*$/.test(cleaned) && !RESERVED_PATH.test(cleaned) && !/\.html?$/i.test(cleaned);
    if (ok && cleaned.toLowerCase() !== "/login") {
      staffPath = cleaned;
      return staffPath;
    }
    console.warn(`[auth] STAFF_LOGIN_PATH "${custom}" can't be used (letters, numbers, - _ . ~ only, no .html, not /api...). Using a generated one.`);
  }

  const derived = crypto.createHmac("sha256", getSecret()).update("staff-entrance").digest("hex").slice(0, 12);
  staffPath = `/s-${derived}`;
  return staffPath;
};

// ---- Passwords -------------------------------------------------------
export const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
};

export const verifyPassword = async (password, stored) => {
  const [alg, saltHex, hashHex] = String(stored || "").split("$");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const key = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(key, expected);
};

// Lets a login for an unknown email take as long as a real one (no account guessing by timing)
let dummyHash = null;
export const burnPasswordCheck = async (password) => {
  dummyHash ??= await hashPassword("not-a-real-password");
  await verifyPassword(password, dummyHash);
};

// ---- Session token (signed, not encrypted: it holds only ids) ---------
const fingerprint = (passwordHash) =>
  crypto.createHash("sha256").update(String(passwordHash)).digest("hex").slice(0, 16);

const sign = (body) => crypto.createHmac("sha256", getSecret()).update(body).digest();

// kind: "c" = customer account (tbl_users), "s" = staff account (tbl_staff)
export const createToken = (account, kind = "c") => {
  const payload = {
    k: kind,
    uid: kind === "s" ? account.staff_id : account.user_id,
    pw: fingerprint(account.password_hash), // changing the password signs out old sessions
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body).toString("base64url")}`;
};

const readToken = (token) => {
  if (typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};

// ---- Cookies -----------------------------------------------------------
export const parseCookies = (header = "") => {
  const out = {};
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* ignore a malformed cookie */
    }
  }
  return out;
};

const isHttps = (req) => req.secure || req.headers["x-forwarded-proto"] === "https";

// Adds a Set-Cookie header without wiping one that is already there
const addCookie = (res, value) => {
  const existing = typeof res.getHeader === "function" ? res.getHeader("Set-Cookie") : undefined;
  res.setHeader("Set-Cookie", existing ? [].concat(existing, value) : value);
};

const cookieFlags = (req, maxAge) => {
  const flags = ["HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${maxAge}`];
  if (isHttps(req)) flags.push("Secure");
  return flags.join("; ");
};

export const setSessionCookie = (req, res, token) =>
  addCookie(res, `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieFlags(req, SESSION_SECONDS)}`);

export const clearSessionCookie = (req, res) => addCookie(res, `${COOKIE_NAME}=; ${cookieFlags(req, 0)}`);

// Remembers that this browser used the staff entrance, so a signed-out staff member who opens an
// admin page is sent back to it. Other visitors never learn where the entrance is.
export const setStaffFlagCookie = (req, res) =>
  addCookie(res, `${STAFF_FLAG_COOKIE}=1; ${cookieFlags(req, 365 * 24 * 60 * 60)}`);

export const hasStaffFlag = (req) => parseCookies(req.headers.cookie)[STAFF_FLAG_COOKIE] === "1";

// ---- Middleware ----------------------------------------------------------
// Reads the cookie (or an "Authorization: Bearer <token>" header for API tools) and
// sets req.user. It never blocks: use requireAuth / requireRole for that.
//   req.user = { id, kind, email, full_name, role, customer_id }
export const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    const token = bearer || parseCookies(req.headers.cookie)[COOKIE_NAME];

    const payload = readToken(token);
    if (!payload) return next();

    const kind = payload.k === "s" ? "s" : "c";
    const sql =
      kind === "s"
        ? "SELECT staff_id AS id, email, full_name, role, is_active, password_hash FROM tbl_staff WHERE staff_id = ?"
        : "SELECT user_id AS id, email, full_name, customer_id, is_active, password_hash FROM tbl_users WHERE user_id = ?";

    // Checked against the DB on every request so a disabled account stops working immediately
    const [rows] = await db.promise().query(sql, [payload.uid]);
    const u = rows[0];
    if (!u || !u.is_active || fingerprint(u.password_hash) !== payload.pw) return next();

    // A stolen superadmin session is useless away from the allowed network
    if (kind === "s" && u.role === "superadmin" && !isSuperadminIpAllowed(req)) return next();

    req.user = {
      id: u.id,
      kind,
      email: u.email,
      full_name: u.full_name,
      role: kind === "s" ? u.role : "customer", // a customer row can never carry a staff role
      customer_id: kind === "c" ? u.customer_id ?? null : null,
    };
    next();
  } catch (err) {
    next(err);
  }
};

const deny401 = (res) =>
  res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "Please log in to continue." });

export const requireAuth = (req, res, next) => {
  if (!req.user) return deny401(res);
  next();
};

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return deny401(res);
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, code: "FORBIDDEN", message: "You don't have access to this." });
    }
    next();
  };

export const requireStaff = requireRole(...STAFF_ROLES); // staff, admin, superadmin
export const requireAdminUp = requireRole("admin", "superadmin"); // not regular staff

export const homeFor = (user) => (user?.role === "customer" ? "/portal.html" : "/index.html");