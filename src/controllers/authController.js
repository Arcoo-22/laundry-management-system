import User from "../models/userModel.js";
import Staff from "../models/staffModel.js";
import {
  hashPassword,
  verifyPassword,
  burnPasswordCheck,
  createToken,
  setSessionCookie,
  clearSessionCookie,
  setStaffFlagCookie,
  homeFor,
} from "../utils/auth.js";
import { isSuperadminIpAllowed, clientIp } from "../utils/network.js";
import { cleanText, sendError, validateCustomer, validatePassword } from "../utils/http.js";

// ---- Slow down password guessing (in memory; resets when the server restarts) ----
// perAccount: failures for one email from one address. perIp: failures from one address.
// perEmail: failures for one email from anywhere (stops guessing spread over many addresses).
const makeLimiter = ({ perAccount, perIp, perEmail = Infinity }) => {
  const WINDOW_MS = 15 * 60_000;
  const fails = new Map();
  const keys = (req, email) => ({
    ip: `ip:${req.ip}`,
    acct: `acct:${req.ip}|${email}`,
    email: `email:${email}`,
  });
  const live = (key) => {
    const e = fails.get(key);
    return e && e.reset > Date.now() ? e : null;
  };
  return {
    isLocked(req, email) {
      const k = keys(req, email);
      return (live(k.ip)?.count ?? 0) >= perIp || (live(k.acct)?.count ?? 0) >= perAccount || (live(k.email)?.count ?? 0) >= perEmail;
    },
    fail(req, email) {
      const now = Date.now();
      if (fails.size > 5000) for (const [key, v] of fails) if (v.reset < now) fails.delete(key);
      const k = keys(req, email);
      for (const key of [k.ip, k.acct, ...(Number.isFinite(perEmail) ? [k.email] : [])]) {
        const e = live(key);
        if (e) e.count += 1;
        else fails.set(key, { count: 1, reset: now + WINDOW_MS });
      }
    },
    clear(req, email) {
      const k = keys(req, email);
      fails.delete(k.acct);
      fails.delete(k.email);
    },
  };
};

const customerLimiter = makeLimiter({ perAccount: 8, perIp: 40 });
const staffLimiter = makeLimiter({ perAccount: 5, perIp: 20, perEmail: 12 });

const publicUser = (u) => ({
  id: u.id,
  full_name: u.full_name,
  email: u.email,
  role: u.role,
  customer_id: u.customer_id ?? null,
});

const customerView = (row) => ({
  id: row.user_id,
  full_name: row.full_name,
  email: row.email,
  role: "customer",
  customer_id: row.customer_id ?? null,
});

const GENERIC_LOGIN_ERROR = "Incorrect email or password.";

const authController = {
  register: async (req, res) => {
    try {
      const { data, error } = validateCustomer(req.body);
      if (error) return res.status(400).json({ success: false, message: error });

      const pwError = validatePassword(req.body?.password);
      if (pwError) return res.status(400).json({ success: false, message: pwError });

      const result = await User.registerCustomer({ ...data, password_hash: await hashPassword(req.body.password) });
      const user = await User.findById(result.user_id);

      setSessionCookie(req, res, createToken(user, "c"));
      return res.status(201).json({
        success: true,
        message: result.linked_existing
          ? "Account created and linked to your existing customer record."
          : "Account created. Welcome!",
        user: customerView(user),
        redirect: "/portal.html",
      });
    } catch (error) {
      return sendError(res, error, "Could not create the account");
    }
  },

  // Customer sign in. Staff emails are not in this table, so they just get the normal "incorrect" message.
  login: async (req, res) => {
    try {
      const email = cleanText(req.body?.email)?.toLowerCase();
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!email || !password) {
        return res.status(400).json({ success: false, message: "Enter your email and password." });
      }

      if (customerLimiter.isLocked(req, email)) {
        return res
          .status(429)
          .json({ success: false, message: "Too many failed attempts. Please wait 15 minutes and try again." });
      }

      const user = await User.findByEmail(email);
      const ok = user ? await verifyPassword(password, user.password_hash) : (await burnPasswordCheck(password), false);
      if (!ok) {
        customerLimiter.fail(req, email);
        return res.status(401).json({ success: false, message: GENERIC_LOGIN_ERROR });
      }
      if (!user.is_active) {
        return res
          .status(403)
          .json({ success: false, message: "This account has been disabled. Please contact the shop." });
      }

      customerLimiter.clear(req, email);
      await User.touchLogin(user.user_id);
      setSessionCookie(req, res, createToken(user, "c"));
      return res.status(200).json({ success: true, user: customerView(user), redirect: "/portal.html" });
    } catch (error) {
      return sendError(res, error, "Could not log in");
    }
  },

  // Staff / admin / superadmin sign in. Reached only through the hidden entrance address (see server.js).
  staffLogin: async (req, res) => {
    try {
      const email = cleanText(req.body?.email)?.toLowerCase();
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!email || !password) {
        return res.status(400).json({ success: false, message: "Enter your email and password." });
      }

      if (staffLimiter.isLocked(req, email)) {
        return res
          .status(429)
          .json({ success: false, message: "Too many failed attempts. Please wait 15 minutes and try again." });
      }

      const staff = await Staff.findByEmail(email);
      let ok = staff ? await verifyPassword(password, staff.password_hash) : (await burnPasswordCheck(password), false);

      // The superadmin may only sign in from the allowed network. Refused with the same message
      // as a wrong password, so nobody can tell that this email belongs to a superadmin.
      if (ok && staff.role === "superadmin" && !isSuperadminIpAllowed(req)) {
        console.warn(`[auth] Superadmin sign-in refused from ${clientIp(req) ?? "an unknown address"} (not in the allowed list)`);
        ok = false;
      }

      if (!ok) {
        staffLimiter.fail(req, email);
        return res.status(401).json({ success: false, message: GENERIC_LOGIN_ERROR });
      }
      if (!staff.is_active) {
        return res
          .status(403)
          .json({ success: false, message: "This account has been disabled. Please contact the shop owner." });
      }

      staffLimiter.clear(req, email);
      await Staff.touchLogin(staff.staff_id);
      setSessionCookie(req, res, createToken(staff, "s"));
      setStaffFlagCookie(req, res);
      return res.status(200).json({
        success: true,
        user: { id: staff.staff_id, full_name: staff.full_name, email: staff.email, role: staff.role },
        redirect: "/index.html",
      });
    } catch (error) {
      return sendError(res, error, "Could not log in");
    }
  },

  logout: (req, res) => {
    clearSessionCookie(req, res);
    return res.status(200).json({ success: true, message: "Logged out" });
  },

  me: (req, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "Please log in to continue." });
    }
    return res.status(200).json({ success: true, user: publicUser(req.user), home: homeFor(req.user) });
  },

  // Works for customers and staff alike
  changePassword: async (req, res) => {
    try {
      const { current_password, new_password } = req.body || {};
      const pwError = validatePassword(new_password);
      if (pwError) return res.status(400).json({ success: false, message: pwError });

      const isStaff = req.user.kind === "s";
      const model = isStaff ? Staff : User;

      const account = await model.findById(req.user.id);
      if (!account || !(await verifyPassword(String(current_password ?? ""), account.password_hash))) {
        return res.status(400).json({ success: false, message: "Your current password is incorrect." });
      }

      await model.updatePassword(req.user.id, await hashPassword(new_password));
      // The old session stops working after a password change, so give this one a fresh session
      const updated = await model.findById(req.user.id);
      setSessionCookie(req, res, createToken(updated, isStaff ? "s" : "c"));
      return res.status(200).json({ success: true, message: "Password changed." });
    } catch (error) {
      return sendError(res, error, "Could not change the password");
    }
  },
};

export default authController;