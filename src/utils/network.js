// Decides whether a request comes from a place the superadmin may sign in from.
//
// SUPERADMIN_ALLOWED_IPS in .env: comma-separated IPv4 addresses, IPv4 ranges (CIDR) or IPv6 addresses,
//   e.g.  SUPERADMIN_ALLOWED_IPS=192.168.1.10,192.168.1.11,203.0.113.7
// If it is not set, the server's own computer plus private shop networks are allowed
// (127.x, 10.x, 172.16-31.x, 192.168.x). Listing exact addresses is stricter and recommended.
//
// The check uses the real connection address. Behind a reverse proxy every request looks like it
// comes from the proxy, so with an X-Forwarded-For header the superadmin is refused unless you
// set SUPERADMIN_TRUST_PROXY=true (only do that if your proxy always sets the header itself).
import net from "node:net";

const DEFAULT_RULES = ["127.0.0.0/8", "::1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"];

const ipv4ToInt = (ip) => ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;

const normalize = (ip) => {
  let v = String(ip || "").trim().toLowerCase();
  if (v.startsWith("::ffff:") && net.isIPv4(v.slice(7))) v = v.slice(7); // IPv4 written the IPv6 way
  return v;
};

const parseRule = (rule) => {
  const [addr, bits] = rule.trim().split("/");
  if (net.isIPv4(addr)) {
    const len = bits === undefined ? 32 : Number(bits);
    if (!Number.isInteger(len) || len < 0 || len > 32) return null;
    const mask = len === 0 ? 0 : (~0 << (32 - len)) >>> 0;
    return { v4: true, net: (ipv4ToInt(addr) & mask) >>> 0, mask };
  }
  if (net.isIPv6(addr) && bits === undefined) return { v4: false, addr: addr.toLowerCase() };
  return null;
};

let rules = null;
const getRules = () => {
  if (rules) return rules;
  const configured = (process.env.SUPERADMIN_ALLOWED_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const list = configured.length ? configured : DEFAULT_RULES;
  rules = [];
  for (const entry of list) {
    const parsed = parseRule(entry);
    if (parsed) rules.push(parsed);
    else console.warn(`[auth] Ignoring invalid SUPERADMIN_ALLOWED_IPS entry: "${entry}"`);
  }
  return rules;
};

// The address the request really came from, or null if we can't tell
export const clientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"] || req.headers["forwarded"];
  if (forwarded) {
    if (String(process.env.SUPERADMIN_TRUST_PROXY).toLowerCase() !== "true") return null;
    const last = String(req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean).pop();
    return last ? normalize(last) : null;
  }
  return normalize(req.socket?.remoteAddress);
};

export const isSuperadminIpAllowed = (req) => {
  const ip = clientIp(req);
  if (!ip) return false;
  return getRules().some((r) => (r.v4 ? net.isIPv4(ip) && ((ipv4ToInt(ip) & r.mask) >>> 0) === r.net : ip === r.addr));
};