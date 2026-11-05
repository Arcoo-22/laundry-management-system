// Printable receipt for one order. Used by the staff Orders page and the customer portal.
// Builds a small self-contained page, loads it in a hidden frame and opens the print dialog,
// so nothing on the website itself changes and no pop-up window is needed.

// Shown at the top of every receipt. Fill in what you want printed; empty lines are skipped.
export const SHOP = {
  name: "Bubbly Laundry",
  address: "",
  contact: "",
};

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const money = (n) => "₱" + (parseFloat(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kg = (n) => (parseFloat(n) || 0).toFixed(2) + " kg";

const when = (d) => {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// Orders the shop hasn't accepted (or has declined) have nothing to bill
export const canPrintReceipt = (order) => !!order && order.status !== "Pending Confirmation" && order.status !== "Rejected";

export function buildReceiptHtml({ order, items = [], payments = [], customerName } = {}) {
  const total = parseFloat(order.total_amount) || 0;
  const paid = payments.length
    ? payments.reduce((sum, p) => sum + (parseFloat(p.amount_paid) || 0), 0)
    : parseFloat(order.total_paid) || 0;
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  const weight = items.length ? items.reduce((sum, i) => sum + (parseFloat(i.weight_in_kilo) || 0), 0) : parseFloat(order.total_weight) || 0;

  let paymentStatus = "Unpaid";
  if (total > 0 && paid >= total) paymentStatus = "Fully Paid";
  else if (paid > 0) paymentStatus = "Partially Paid";

  const no = String(order.order_id).padStart(5, "0");
  const name = customerName || order.full_name || "";

  const itemRows = items.length
    ? items
        .map((i) => `<tr><td>${esc(i.clothe_type)}</td><td class="r">${kg(i.weight_in_kilo)}</td><td class="r">${money(i.subtotal)}</td></tr>`)
        .join("")
    : `<tr><td colspan="3" class="muted">No items recorded yet.</td></tr>`;

  const paymentRows = payments.length
    ? payments
        .map((p) => `<tr><td>${esc(when(p.payment_date))}</td><td>${esc(p.payment_mode)}</td><td class="r">${money(p.amount_paid)}</td></tr>`)
        .join("")
    : `<tr><td colspan="3" class="muted">No payments yet.</td></tr>`;

  const head = [SHOP.address, SHOP.contact].filter(Boolean).map((l) => `<div class="small">${esc(l)}</div>`).join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Receipt #${no}</title>
<style>
  @page { margin: 6mm; }
  * { box-sizing: border-box; }
  body { font-family: "Courier New", Courier, monospace; font-size: 12px; line-height: 1.4; color: #000; margin: 0 auto; max-width: 80mm; }
  h1 { font-size: 16px; text-align: center; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
  .center { text-align: center; }
  .small { font-size: 11px; text-align: center; }
  .muted { color: #555; text-align: center; padding: 4px 0; }
  .rule { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
  h2 { font-size: 12px; margin: 8px 0 4px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 2px 0; vertical-align: top; }
  th { text-align: left; border-bottom: 1px solid #000; font-size: 11px; }
  th.r, td.r { text-align: right; white-space: nowrap; padding-left: 6px; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .row span:last-child { text-align: right; }
  .big { font-weight: bold; font-size: 14px; }
  .note { margin-top: 6px; font-size: 11px; }
</style></head>
<body>
  <h1>${esc(SHOP.name)}</h1>
  ${head}
  <div class="center" style="margin-top:4px;">RECEIPT</div>
  <hr class="rule">
  <div class="row"><span>Order no.</span><span>#${no}</span></div>
  <div class="row"><span>Date</span><span>${esc(when(order.created_at))}</span></div>
  ${name ? `<div class="row"><span>Customer</span><span>${esc(name)}</span></div>` : ""}
  <div class="row"><span>Service</span><span>${esc(order.service_name || "Service #" + order.service_id)}</span></div>
  <div class="row"><span>Delivery</span><span>${esc(order.delivery_methods || "Pickup")}</span></div>
  <div class="row"><span>Status</span><span>${esc(order.status)}</span></div>
  <hr class="rule">
  <h2>Items</h2>
  <table>
    <thead><tr><th>Item</th><th class="r">Weight</th><th class="r">Amount</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <hr class="rule">
  <div class="row"><span>Total weight</span><span>${kg(weight)}</span></div>
  <div class="row big"><span>TOTAL</span><span>${money(total)}</span></div>
  <hr class="rule">
  <h2>Payments</h2>
  <table>
    <thead><tr><th>Date</th><th>Mode</th><th class="r">Amount</th></tr></thead>
    <tbody>${paymentRows}</tbody>
  </table>
  <hr class="rule">
  <div class="row"><span>Paid</span><span>${money(paid)}</span></div>
  <div class="row big"><span>BALANCE</span><span>${money(balance)}</span></div>
  <div class="row"><span>Payment status</span><span>${paymentStatus}</span></div>
  ${total <= 0 ? `<div class="note center">Amounts will appear once the laundry has been weighed.</div>` : ""}
  <hr class="rule">
  <div class="center">Thank you for choosing ${esc(SHOP.name)}!</div>
  <div class="small" style="margin-top:4px;">Printed ${esc(when(new Date()))}</div>
</body></html>`;
}

// Opens the print dialog for the receipt. Returns false when the order has nothing to bill yet.
export function printReceipt(data) {
  if (!canPrintReceipt(data?.order)) return false;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(frame);

  const cleanup = () => setTimeout(() => frame.remove(), 500);
  frame.addEventListener("load", () => {
    const win = frame.contentWindow;
    win.addEventListener("afterprint", cleanup);
    win.focus();
    win.print();
    setTimeout(cleanup, 60000); // fallback for browsers that never fire afterprint
  });
  frame.srcdoc = buildReceiptHtml(data);
  return true;
}