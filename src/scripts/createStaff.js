// Creates a staff, admin or superadmin account from the server terminal (or resets a password).
// This is the ONLY way to create a superadmin; the website can't.
//
//   node src/scripts/createStaff.js                       (asks for everything)
//   node src/scripts/createStaff.js --role superadmin     (role: staff | admin | superadmin)
//   node src/scripts/createStaff.js --role admin "Full Name" owner@example.com "a-strong-password"
//   node src/scripts/createStaff.js --reset owner@example.com "new-password"   (change an existing password)
//
// Run it from the project root so the .env file is found.
import readline from "node:readline/promises";
import db from "../config/database.js";
import Staff from "../models/staffModel.js";
import { hashPassword, getStaffLoginPath } from "../utils/auth.js";
import { validatePassword } from "../utils/http.js";

const ROLES = ["staff", "admin", "superadmin"];
const args = process.argv.slice(2);

const take = (flag) => {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  return args.splice(i, i + 2 > args.length ? 1 : 2)[1];
};
const reset = args.includes("--reset") && (args.splice(args.indexOf("--reset"), 1), true);
const roleArg = take("--role");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = async (label, given) => (given ?? (await rl.question(label))).trim();

try {
  if (reset) {
    const email = (await ask("Email of the account: ", args[0])).toLowerCase();
    const password = args[1] ?? (await rl.question("New password (min 8 characters): "));
    const pwError = validatePassword(password);
    if (pwError) throw new Error(pwError);
    const existing = await Staff.findByEmail(email);
    if (!existing) throw new Error(`No staff account uses ${email}.`);
    await Staff.updatePassword(existing.staff_id, await hashPassword(password));
    console.log(`Password updated for ${email}.`);
  } else {
    const asked = roleArg ?? (await rl.question("Role (staff / admin / superadmin) [admin]: "));
    const role = (asked.trim() || "admin").toLowerCase();
    if (!ROLES.includes(role)) throw new Error("Role must be staff, admin or superadmin.");

    const full_name = await ask("Full name: ", args[0]);
    const email = (await ask("Email: ", args[1])).toLowerCase();
    const password = args[2] ?? (await rl.question("Password (min 8 characters): "));

    if (!full_name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a name and a valid email.");
    const pwError = validatePassword(password);
    if (pwError) throw new Error(pwError);

    await Staff.create({ full_name, email, role, password_hash: await hashPassword(password) });
    console.log(`\nCreated ${role}: ${email}`);
    console.log(`Staff sign-in address (keep it private): http://localhost:${process.env.PORT ?? 3000}${getStaffLoginPath()}`);
    if (role === "superadmin") {
      console.log("The superadmin can sign in only from the server computer / shop network (see SUPERADMIN_ALLOWED_IPS in the README).");
    }
  }
} catch (err) {
  const hint = err.code === "ER_NO_SUCH_TABLE" ? "run database/staff_migration.sql first." : err.message;
  console.error("Could not complete:", hint);
  process.exitCode = 1;
} finally {
  rl.close();
  db.end();
}