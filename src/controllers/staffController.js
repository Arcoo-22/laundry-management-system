import Staff from "../models/staffModel.js";
import { hashPassword } from "../utils/auth.js";
import { cleanText, isId, sendError, validatePassword } from "../utils/http.js";

// Superadmin only: manage staff and admin accounts.
// The superadmin role itself can't be created, changed or disabled from here. It is made only from
// the server terminal (src/scripts/createStaff.js), so nobody can promote themselves through the web.
const ASSIGNABLE_ROLES = ["staff", "admin"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicStaff = ({ staff_id, email, full_name, role, is_active, created_at, last_login_at }) => ({
  staff_id,
  email,
  full_name,
  role,
  is_active: !!is_active,
  created_at,
  last_login_at,
});

const protectedAccount = (res) =>
  res.status(403).json({
    success: false,
    message: "Superadmin accounts can only be managed from the server terminal.",
  });

const staffController = {
  list: async (req, res) => {
    try {
      return res.status(200).json({ success: true, staff: (await Staff.list()).map(publicStaff) });
    } catch (error) {
      return sendError(res, error, "Error loading staff accounts");
    }
  },

  create: async (req, res) => {
    try {
      const full_name = cleanText(req.body?.full_name);
      const email = cleanText(req.body?.email)?.toLowerCase();
      const role = req.body?.role;

      if (!full_name || full_name.length > 100) {
        return res.status(400).json({ success: false, message: "Enter the person's full name (up to 100 characters)." });
      }
      if (!email || !EMAIL_RE.test(email) || email.length > 100) {
        return res.status(400).json({ success: false, message: "Enter a valid email address." });
      }
      if (role === "superadmin") return protectedAccount(res);
      if (!ASSIGNABLE_ROLES.includes(role)) {
        return res.status(400).json({ success: false, message: "Role must be staff or admin." });
      }
      const pwError = validatePassword(req.body?.password);
      if (pwError) return res.status(400).json({ success: false, message: pwError });

      const id = await Staff.create({
        full_name,
        email,
        role,
        password_hash: await hashPassword(req.body.password),
        created_by: req.user.id,
      });
      return res.status(201).json({ success: true, message: `${full_name} can now sign in.`, staff_id: id });
    } catch (error) {
      return sendError(res, error, "Error creating the account");
    }
  },

  update: async (req, res) => {
    try {
      if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid account id" });
      const target = await Staff.findById(Number(req.params.id));
      if (!target) return res.status(404).json({ success: false, message: "Account not found." });
      if (target.role === "superadmin") return protectedAccount(res);

      const changes = {};
      if (req.body?.full_name !== undefined) {
        const name = cleanText(req.body.full_name);
        if (!name || name.length > 100) {
          return res.status(400).json({ success: false, message: "Enter the person's full name (up to 100 characters)." });
        }
        changes.full_name = name;
      }
      if (req.body?.role !== undefined) {
        if (req.body.role === "superadmin") return protectedAccount(res);
        if (!ASSIGNABLE_ROLES.includes(req.body.role)) {
          return res.status(400).json({ success: false, message: "Role must be staff or admin." });
        }
        changes.role = req.body.role;
      }
      if (req.body?.is_active !== undefined) changes.is_active = !!req.body.is_active;

      await Staff.update(target.staff_id, changes);
      return res.status(200).json({ success: true, message: "Account updated." });
    } catch (error) {
      return sendError(res, error, "Error updating the account");
    }
  },

  resetPassword: async (req, res) => {
    try {
      if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid account id" });
      const target = await Staff.findById(Number(req.params.id));
      if (!target) return res.status(404).json({ success: false, message: "Account not found." });
      if (target.role === "superadmin") return protectedAccount(res);

      const pwError = validatePassword(req.body?.password);
      if (pwError) return res.status(400).json({ success: false, message: pwError });

      // Also signs that person out everywhere, because their sessions are tied to the old password
      await Staff.updatePassword(target.staff_id, await hashPassword(req.body.password));
      return res.status(200).json({ success: true, message: `New password set for ${target.full_name}.` });
    } catch (error) {
      return sendError(res, error, "Error resetting the password");
    }
  },
};

export default staffController;