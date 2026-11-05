// Creates the first admin login (or resets an admin's password).
//
//   node src/scripts/createAdmin.js
//   node src/scripts/createAdmin.js "Full Name" owner@example.com "a-strong-password"
//   node src/scripts/createAdmin.js "Full Name" owner@example.com "new-password" --reset
//
// Run it from the project root so the .env file is found.
import readline from "node:readline/promises";
import db from "../config/database.js";
import User from "../models/userModel.js";
import { hashPassword } from "../utils/auth.js";
import { validatePassword } from "../utils/http.js";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const [argName, argEmail, argPassword] = args.filter((a) => a !== "--reset");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = async (label, given) => (given ?? (await rl.question(label))).trim();

try {
  const full_name = await ask("Full name: ", argName);
  const email = (await ask("Email: ", argEmail)).toLowerCase();
  const password = argPassword ?? (await rl.question("Password (min 8 characters): "));

  if (!full_name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a name and a valid email.");
  const pwError = validatePassword(password);
  if (pwError) throw new Error(pwError);

  const existing = await User.findByEmail(email);
  const password_hash = await hashPassword(password);

  if (existing && !reset) {
    throw new Error(`${email} already has an account. Add --reset to change its password.`);
  }
  if (existing) {
    if (existing.role !== "admin") throw new Error(`${email} is a customer account, not an admin.`);
    await User.updatePassword(existing.user_id, password_hash);
    console.log(`Password updated for admin ${email}.`);
  } else {
    await User.createAdmin({ full_name, email, password_hash });
    console.log(`Admin created: ${email}. Log in at /login.html`);
  }
} catch (err) {
  console.error("Could not create the admin:", err.code === "ER_NO_SUCH_TABLE" ? "run database/auth_migration.sql first." : err.message);
  process.exitCode = 1;
} finally {
  rl.close();
  db.end();
}