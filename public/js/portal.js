// Customer portal: my orders, send a new request, profile and password.
import { api } from "./api.js";
import { printReceipt, canPrintReceipt } from "./receipt.js";
import {
  formatCurrency,
  formatDate,
  renderOrderStatusBadge,
  renderDeliveryBadge,
  openModal,
  closeModal,
  initNavigation,
  showToast,
  escapeHtml,
  currentUser,
} from "./ui.js";

const AWAITING = "Pending Confirmation";

// What each status means, in the customer's words
const STATUS_TEXT = {
  "Pending Confirmation": "The shop is reviewing your request. You'll see it update here once it's confirmed.",
  Pending: "Confirmed. The shop will weigh your laundry and start on it.",
  Processing: "Your laundry is being washed.",
  Ready: "Your laundry is ready.",
  Completed: "All done. Thank you!",
  Cancelled: "This order was cancelled.",
  Rejected: "The shop couldn't accept this request.",
};

const TITLES = { orders: "My orders", new: "New order", profile: "Profile" };

let orders = [];
let services = [];
let profile = null;
let openOrderId = null;
let openReceiptData = null;
let navReady = false;

const $ = (id) => document.getElementById(id);

// ---------- Views (switched by the #hash so the back button works) ----------
function showView() {
  const view = ["orders", "new", "profile"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "orders";
  document.querySelectorAll(".portal-view").forEach((el) => (el.hidden = el.id !== `view-${view}`));
  $("page-title").textContent = TITLES[view];
  document.title = `${TITLES[view]} | Bubbly Laundry`;
  if (!navReady) {
    initNavigation(view); // also wires up the modal close buttons (once)
    navReady = true;
  } else {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.nav === view));
  }
}

// ---------- My orders ----------
function renderOrders() {
  const tbody = $("orders-tbody");
  $("order-count").textContent = `Total: ${orders.length} order${orders.length === 1 ? "" : "s"}`;

  const waiting = orders.filter((o) => o.status === AWAITING).length;
  const note = $("orders-note");
  note.hidden = waiting === 0;
  if (waiting) {
    note.textContent = `${waiting} request${waiting === 1 ? " is" : "s are"} waiting for the shop to confirm.`;
  }

  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <div class="empty-title">No orders yet</div>
      <div class="empty-text">Send your first laundry request and it will show up here.</div>
      <a class="btn btn-primary" href="#new">New order</a></div></td></tr>`;
    return;
  }

  tbody.innerHTML = orders
    .map((o) => {
      const priced = Number(o.total_amount) > 0;
      return `<tr>
        <td><strong>#${o.order_id}</strong></td>
        <td>${escapeHtml(o.service_name || "Service #" + o.service_id)}</td>
        <td>${renderDeliveryBadge(o.delivery_methods)}</td>
        <td>${renderOrderStatusBadge(o.status)}</td>
        <td>${priced ? `<strong>${formatCurrency(o.total_amount)}</strong>` : '<span style="color: var(--text-muted);">To be weighed</span>'}</td>
        <td>${priced ? formatCurrency(o.balance_remaining) : "-"}</td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${formatDate(o.created_at)}</td>
        <td><button class="btn btn-outline btn-sm btn-view" data-id="${o.order_id}">Details</button></td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll(".btn-view").forEach((btn) => btn.addEventListener("click", () => openOrder(btn.dataset.id)));
}

async function loadOrders() {
  try {
    orders = await api.portal.orders();
    renderOrders();
  } catch (err) {
    showToast("Couldn't load your orders: " + err.message, "error");
  }
}

// ---------- Order details ----------
async function openOrder(id) {
  try {
    const res = await api.portal.order(id);
    const o = res.order;
    openOrderId = o.order_id;
    openReceiptData = { order: o, items: res.items || [], payments: res.payments || [] };

    $("order-modal-title").textContent = `Order #${o.order_id}`;
    $("order-status-line").innerHTML = `${renderOrderStatusBadge(o.status)} <span style="color: var(--text-muted); font-size: 0.85rem;">Placed ${formatDate(o.created_at)}</span>`;

    const explain = $("order-status-explain");
    const rejected = o.status === "Rejected";
    explain.className = "status-explain" + (rejected ? " is-rejected" : "");
    explain.textContent =
      (STATUS_TEXT[o.status] || "") + (rejected && o.rejection_reason ? ` Reason: ${o.rejection_reason}` : "");

    $("od-service").textContent = o.service_name || `Service #${o.service_id}`;
    $("od-delivery").innerHTML = renderDeliveryBadge(o.delivery_methods);
    $("od-notes-wrap").hidden = !o.customer_notes;
    $("od-notes").textContent = o.customer_notes || "";

    const priced = Number(o.total_amount) > 0;
    $("od-balance").hidden = !priced;
    $("od-total").textContent = formatCurrency(o.total_amount);
    $("od-paid").textContent = formatCurrency(o.total_paid);
    $("od-balance-left").textContent = formatCurrency(o.balance_remaining);

    $("od-items-wrap").hidden = !res.items.length;
    $("od-items").innerHTML = res.items
      .map(
        (i) => `<tr><td>${escapeHtml(i.clothe_type)}</td><td>${parseFloat(i.weight_in_kilo).toFixed(2)} kg</td><td><strong>${formatCurrency(i.subtotal)}</strong></td></tr>`
      )
      .join("");

    $("od-payments-wrap").hidden = !res.payments.length;
    $("od-payments").innerHTML = res.payments
      .map((p) => `<tr><td>${formatDate(p.payment_date)}</td><td>${escapeHtml(p.payment_mode)}</td><td><strong>${formatCurrency(p.amount_paid)}</strong></td></tr>`)
      .join("");

    // Customers can withdraw a request only until the shop has looked at it
    $("btn-cancel-request").style.display = o.status === AWAITING ? "" : "none";
    $("btn-print-receipt").style.display = canPrintReceipt(o) ? "" : "none";

    openModal("modal-order");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function cancelOpenOrder() {
  if (!openOrderId || !confirm(`Cancel order #${openOrderId}? The shop won't see this request anymore.`)) return;
  try {
    const res = await api.portal.cancelOrder(openOrderId);
    showToast(res.message || "Order cancelled", "success");
    closeModal("modal-order");
    await loadOrders();
  } catch (err) {
    showToast(err.message, "error");
    closeModal("modal-order");
    loadOrders(); // the shop may have just confirmed it; show the latest
  }
}

// ---------- New order ----------
function fillServices() {
  const select = $("new-service");
  select.innerHTML =
    `<option value="">Choose a service</option>` +
    services
      .map((s) => `<option value="${s.service_id}">${escapeHtml(s.service_name)} (${formatCurrency(s.price_per_kilo)}/kg)</option>`)
      .join("");
}

function updateNewOrderHints() {
  const service = services.find((s) => String(s.service_id) === $("new-service").value);
  $("new-service-desc").textContent = service?.description || "";

  const delivery = $("new-delivery").value === "Delivery";
  $("new-address-hint").textContent = delivery && profile?.address ? `We'll deliver to: ${profile.address}. Change it under Profile.` : "";
}

// ---------- Profile ----------
function fillProfile() {
  if (!profile) return;
  $("prof-email").value = profile.email || "";
  $("prof-name").value = profile.full_name || "";
  $("prof-contact").value = profile.contact || "";
  $("prof-address").value = profile.address || "";
}

// ---------- Start ----------
document.addEventListener("DOMContentLoaded", async () => {
  showView();
  window.addEventListener("hashchange", showView);

  $("btn-cancel-request").addEventListener("click", cancelOpenOrder);
  $("btn-print-receipt").addEventListener("click", () => {
    if (openReceiptData) printReceipt({ ...openReceiptData, customerName: currentUser?.full_name });
  });
  $("new-service").addEventListener("change", updateNewOrderHints);
  $("new-delivery").addEventListener("change", updateNewOrderHints);

  $("form-new-order").addEventListener("submit", async (e) => {
    e.preventDefault();
    const service_id = parseInt($("new-service").value, 10);
    if (!service_id) return showToast("Choose a service first.", "warning");

    const btn = $("btn-send-request");
    btn.disabled = true;
    try {
      const res = await api.portal.createOrder({
        service_id,
        delivery_methods: $("new-delivery").value,
        customer_notes: $("new-notes").value.trim(),
      });
      showToast(res.message || "Request sent!", "success");
      $("form-new-order").reset();
      updateNewOrderHints();
      await loadOrders();
      location.hash = "#orders";
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      btn.disabled = false;
    }
  });

  $("form-profile").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const res = await api.portal.updateProfile({
        full_name: $("prof-name").value.trim(),
        contact: $("prof-contact").value.trim(),
        address: $("prof-address").value.trim(),
      });
      profile = { ...profile, ...res.profile };
      showToast("Profile saved.", "success");
      updateNewOrderHints();
      document.querySelector(".user-chip-name") && (document.querySelector(".user-chip-name").textContent = profile.full_name);
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  $("form-password").addEventListener("submit", async (e) => {
    e.preventDefault();
    if ($("pw-new").value !== $("pw-confirm").value) return showToast("The new passwords don't match.", "error");
    try {
      await api.auth.changePassword($("pw-current").value, $("pw-new").value);
      showToast("Password changed.", "success");
      $("form-password").reset();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  const [, svc, prof] = await Promise.all([
    loadOrders(),
    api.services.list().catch(() => []),
    api.portal.profile().catch(() => null),
  ]);
  services = svc;
  profile = prof;
  fillServices();
  fillProfile();
  updateNewOrderHints();
});