import { api } from "./api.js";
import { formatCurrency, formatDate, renderPaymentStatusBadge, openModal, closeModal, initNavigation, showToast, escapeHtml } from "./ui.js";

let paymentsList = [];
let ordersList = [];
let selectedOrderData = null;

async function loadData() {
  initNavigation("payments");

  try {
    const [payments, orders] = await Promise.all([
      api.payments.list(),
      api.orders.list().catch(() => []),
    ]);

    paymentsList = payments;
    ordersList = orders;

    computeSummary();
    populateOrderSelect();
    renderPayments(paymentsList);
  } catch (err) {
    console.error("Error loading payments:", err);
    showToast("Failed to load payments: " + err.message, "error");
  }
}

function computeSummary() {
  const totalPaid = paymentsList.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0);
  const fullyPaidCount = paymentsList.filter(p => p.payment_status === "Fully Paid").length;

  document.getElementById("summary-total-paid").textContent = formatCurrency(totalPaid);
  document.getElementById("summary-total-tx").textContent = paymentsList.length;
  document.getElementById("summary-fully-paid").textContent = fullyPaidCount;
}

function populateOrderSelect() {
  const select = document.getElementById("pay-order-select");
  if (!select) return;

  // Filter orders that have total_amount > 0
  const ordersWithAmount = ordersList.filter(o => parseFloat(o.total_amount || 0) > 0);

  select.innerHTML = `<option value="">-- Choose an Order --</option>` +
    ordersWithAmount.map(o => `
      <option value="${o.order_id}">
        Order #${o.order_id} — ${escapeHtml(o.full_name || "Customer #" + o.customer_id)} (${formatCurrency(o.total_amount)})
      </option>
    `).join("");
}

function renderPayments(list) {
  const tbody = document.getElementById("payments-tbody");
  const countEl = document.getElementById("payment-count");
  if (countEl) countEl.textContent = `Total: ${list.length} transaction${list.length === 1 ? "" : "s"}`;

  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
          No payment transactions found matching the filter criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(p => `
    <tr>
      <td><strong>#${p.payment_id}</strong></td>
      <td><strong>#${p.order_id}</strong></td>
      <td>${escapeHtml(p.full_name || "Customer")}</td>
      <td><span style="color: var(--success); font-weight: 700;">${formatCurrency(p.amount_paid)}</span></td>
      <td><strong style="color: ${parseFloat(p.payment_balance) > 0 ? 'var(--danger)' : 'var(--text-muted)'};">${formatCurrency(p.payment_balance)}</strong></td>
      <td><span class="badge" style="background: #f1f5f9; color: #334155;">${escapeHtml(p.payment_mode)}</span></td>
      <td>${renderPaymentStatusBadge(p.payment_status)}</td>
      <td style="color: var(--text-muted); font-size: 0.85rem;">${formatDate(p.payment_date)}</td>
    </tr>
  `).join("");
}

function handleOrderSelected(orderId) {
  const summaryBox = document.getElementById("pay-order-summary");
  const previewBox = document.getElementById("pay-preview");
  const amountInput = document.getElementById("pay-amount");

  if (!orderId) {
    selectedOrderData = null;
    summaryBox.style.display = "none";
    previewBox.style.display = "none";
    amountInput.value = "";
    return;
  }

  const order = ordersList.find(o => String(o.order_id) === String(orderId));
  if (!order) return;

  const total = parseFloat(order.total_amount || 0);

  // Compute already paid from paymentsList
  const orderPayments = paymentsList.filter(p => String(p.order_id) === String(orderId));
  const alreadyPaid = orderPayments.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0);
  const remaining = Math.max(0, total - alreadyPaid);

  selectedOrderData = {
    order_id: order.order_id,
    total,
    alreadyPaid,
    remaining,
  };

  document.getElementById("summary-order-total").textContent = formatCurrency(total);
  document.getElementById("summary-already-paid").textContent = formatCurrency(alreadyPaid);
  document.getElementById("summary-current-balance").textContent = formatCurrency(remaining);
  summaryBox.style.display = "block";

  // Pre-fill amount with remaining balance if remaining > 0
  if (remaining > 0) {
    amountInput.value = remaining.toFixed(2);
  } else {
    amountInput.value = "0.00";
  }

  updatePreview();
}

function updatePreview() {
  if (!selectedOrderData) return;
  const payVal = parseFloat(document.getElementById("pay-amount").value) || 0;
  const newBal = Math.max(0, selectedOrderData.remaining - payVal);

  const previewBox = document.getElementById("pay-preview");
  previewBox.style.display = "block";
  document.getElementById("preview-new-balance").textContent = formatCurrency(newBal);

  let statusText = "Fully Paid";
  if (newBal > 0) {
    statusText = "Partially Paid";
  }
  document.getElementById("preview-new-status").textContent = statusText;
}

// Filtering
function applyFilters() {
  const statusFilter = document.getElementById("filter-payment-status").value;
  const modeFilter = document.getElementById("filter-payment-mode").value;
  const query = document.getElementById("payment-search").value.trim().toLowerCase();

  let filtered = [...paymentsList];

  if (statusFilter) {
    filtered = filtered.filter(p => p.payment_status === statusFilter);
  }
  if (modeFilter) {
    filtered = filtered.filter(p => p.payment_mode === modeFilter);
  }
  if (query) {
    filtered = filtered.filter(p => 
      String(p.order_id).includes(query) ||
      String(p.payment_id).includes(query) ||
      (p.full_name && p.full_name.toLowerCase().includes(query))
    );
  }

  renderPayments(filtered);
}

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  // Open modal
  document.getElementById("btn-open-create-payment")?.addEventListener("click", () => {
    document.getElementById("form-create-payment").reset();
    selectedOrderData = null;
    document.getElementById("pay-order-summary").style.display = "none";
    document.getElementById("pay-preview").style.display = "none";
    openModal("modal-create-payment");
  });

  // Select order change
  document.getElementById("pay-order-select")?.addEventListener("change", (e) => {
    handleOrderSelected(e.target.value);
  });

  // Pay in full button
  document.getElementById("btn-pay-full")?.addEventListener("click", () => {
    if (selectedOrderData && selectedOrderData.remaining > 0) {
      document.getElementById("pay-amount").value = selectedOrderData.remaining.toFixed(2);
      updatePreview();
    }
  });

  // Amount input preview change
  document.getElementById("pay-amount")?.addEventListener("input", updatePreview);

  // Submit payment
  document.getElementById("form-create-payment")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const order_id = parseInt(document.getElementById("pay-order-select").value, 10);
    const amount_paid = parseFloat(document.getElementById("pay-amount").value);
    const payment_mode = document.getElementById("pay-mode").value;

    if (!order_id || isNaN(amount_paid) || amount_paid <= 0) {
      showToast("Please enter a valid payment amount.", "warning");
      return;
    }

    try {
      const res = await api.payments.create({ order_id, amount_paid, payment_mode });
      showToast(`Payment recorded! Remaining Balance: ${formatCurrency(res.balance_remaining)} (${res.payment_status})`, "success");
      closeModal("modal-create-payment");
      loadData();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Filters
  document.getElementById("filter-payment-status")?.addEventListener("change", applyFilters);
  document.getElementById("filter-payment-mode")?.addEventListener("change", applyFilters);
  
  let timer;
  document.getElementById("payment-search")?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(applyFilters, 250);
  });

  document.getElementById("btn-reset-payment-filters")?.addEventListener("click", () => {
    document.getElementById("filter-payment-status").value = "";
    document.getElementById("filter-payment-mode").value = "";
    document.getElementById("payment-search").value = "";
    renderPayments(paymentsList);
  });
});
