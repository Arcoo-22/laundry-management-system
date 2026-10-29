import { api } from "./api.js";
import { formatCurrency, formatDate, renderOrderStatusBadge, renderDeliveryBadge, openModal, closeModal, initNavigation, showToast, escapeHtml, Icons } from "./ui.js";

let ordersList = [];
let customersList = [];
let servicesList = [];
let currentOrderDetails = null;

async function loadInitialData() {
  initNavigation("orders");

  try {
    const [orders, customers, services] = await Promise.all([
      api.orders.list(),
      api.customers.list().catch(() => []),
      api.services.list().catch(() => []),
    ]);

    ordersList = orders;
    customersList = customers;
    servicesList = services;

    populateDropdowns();
    renderOrders(ordersList);
  } catch (err) {
    console.error("Error loading orders data:", err);
    showToast("Failed to load orders: " + err.message, "error");
  }
}

function populateDropdowns() {
  const custSelect = document.getElementById("new-order-customer");
  if (custSelect) {
    custSelect.innerHTML = `<option value="">-- Choose a Customer --</option>` +
      customersList.map(c => `<option value="${c.customer_id}">${escapeHtml(c.full_name)} (${escapeHtml(c.contact)})</option>`).join("");
  }

  const srvSelect = document.getElementById("new-order-service");
  if (srvSelect) {
    srvSelect.innerHTML = `<option value="">-- Choose a Service --</option>` +
      servicesList.map(s => `<option value="${s.service_id}">${escapeHtml(s.service_name)} — ${formatCurrency(s.price_per_kilo)}/kg</option>`).join("");
  }
}

function renderOrders(list) {
  const tbody = document.getElementById("orders-tbody");
  const countEl = document.getElementById("order-count");
  if (countEl) countEl.textContent = `Total: ${list.length} order${list.length === 1 ? "" : "s"}`;

  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 36px; color: var(--text-muted);">
          No orders found matching the filter criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(o => `
    <tr>
      <td><strong>#${o.order_id}</strong></td>
      <td><strong>${escapeHtml(o.full_name || "Customer #" + o.customer_id)}</strong></td>
      <td>${escapeHtml(o.service_name || "Service #" + o.service_id)}</td>
      <td>${parseFloat(o.total_weight || 0).toFixed(2)} kg</td>
      <td><strong>${formatCurrency(o.total_amount)}</strong></td>
      <td>
        <select class="btn-change-delivery form-select" data-id="${o.order_id}" style="padding: 4px 8px; font-size: 0.8rem; width: auto; display: inline-block;">
          <option value="Pickup" ${(o.delivery_methods === "Pickup") ? "selected" : ""}>Pickup</option>
          <option value="Delivery" ${(o.delivery_methods === "Delivery") ? "selected" : ""}>Delivery</option>
        </select>
      </td>
      <td>
        <span class="btn-open-status" data-id="${o.order_id}" data-status="${o.status}" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Click to update status">
          ${renderOrderStatusBadge(o.status)}
          <span style="color: var(--text-muted); font-size: 0.8rem;">${Icons.edit}</span>
        </span>
      </td>
      <td style="color: var(--text-muted); font-size: 0.85rem;">${formatDate(o.created_at)}</td>
      <td>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-outline btn-sm btn-view-order" data-id="${o.order_id}" style="display:inline-flex;align-items:center;gap:4px;">
            ${Icons.eye} Details
          </button>
          <button class="btn btn-primary btn-sm btn-add-items" data-id="${o.order_id}">
            + Items
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  attachRowListeners();
}

function attachRowListeners() {
  document.querySelectorAll(".btn-view-order").forEach(btn => {
    btn.addEventListener("click", () => openOrderDetailsModal(btn.dataset.id));
  });

  document.querySelectorAll(".btn-add-items").forEach(btn => {
    btn.addEventListener("click", () => openAddItemsModal(btn.dataset.id));
  });

  document.querySelectorAll(".btn-open-status").forEach(badge => {
    badge.addEventListener("click", () => {
      const id = badge.dataset.id;
      const status = badge.dataset.status;
      document.getElementById("status-order-id").value = id;
      document.getElementById("select-new-status").value = status || "Pending";
      openModal("modal-update-status");
    });
  });

  document.querySelectorAll(".btn-change-delivery").forEach(select => {
    select.addEventListener("change", async () => {
      const orderId = select.dataset.id;
      const method = select.value;
      try {
        await api.orders.setDelivery(orderId, method);
        showToast(`Order #${orderId} delivery updated to ${method}`, "success");
        const order = ordersList.find(o => String(o.order_id) === String(orderId));
        if (order) order.delivery_methods = method;
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });
}

// Order Details Modal
async function openOrderDetailsModal(orderId) {
  try {
    const res = await api.orders.get(orderId);
    const order = res.order;
    const items = res.items || [];
    currentOrderDetails = order;

    document.getElementById("details-order-title").textContent = `Order #${order.order_id} Details`;
    document.getElementById("details-cust-name").textContent = order.full_name || `Customer #${order.customer_id}`;
    document.getElementById("details-service-name").textContent = order.service_name || `Service #${order.service_id}`;
    document.getElementById("details-totals").textContent = `${parseFloat(order.total_weight || 0).toFixed(2)} kg — ${formatCurrency(order.total_amount)}`;
    document.getElementById("details-status-badge").innerHTML = `${renderOrderStatusBadge(order.status)} ${renderDeliveryBadge(order.delivery_methods)}`;

    const tbody = document.getElementById("details-items-tbody");
    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 24px; color: var(--text-muted);">
            No garment items recorded yet for this order. Click "+ Add Items" to add clothes.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = items.map((item, idx) => `
        <tr>
          <td><strong>#${item.item_id || idx + 1}</strong></td>
          <td>${escapeHtml(item.clothe_type)}</td>
          <td>${parseFloat(item.weight_in_kilo).toFixed(2)} kg</td>
          <td><strong>${formatCurrency(item.subtotal)}</strong></td>
        </tr>
      `).join("");
    }

    openModal("modal-order-details");
  } catch (err) {
    showToast("Error fetching order details: " + err.message, "error");
  }
}

// Add Items Modal
function openAddItemsModal(orderId) {
  document.getElementById("add-items-order-id").value = orderId;
  document.getElementById("add-items-modal-title").textContent = `Add Garments to Order #${orderId}`;
  
  const container = document.getElementById("items-rows-container");
  container.innerHTML = `
    <div class="form-row item-input-row" style="margin-bottom: 12px;">
      <div>
        <label class="form-label">Clothe Type *</label>
        <input type="text" class="form-input item-clothe" required placeholder="e.g. Shirts, Pants, Beddings">
      </div>
      <div>
        <label class="form-label">Weight (kg) *</label>
        <input type="number" class="form-input item-weight" required min="0.1" step="0.1" placeholder="e.g. 2.5">
      </div>
    </div>
  `;
  openModal("modal-add-items");
}

// Filtering
function applyFilters() {
  const statusFilter = document.getElementById("filter-order-status").value;
  const deliveryFilter = document.getElementById("filter-order-delivery").value;
  const nameQuery = document.getElementById("order-search-name").value.trim().toLowerCase();

  let filtered = [...ordersList];

  if (statusFilter) {
    filtered = filtered.filter(o => o.status === statusFilter);
  }
  if (deliveryFilter) {
    filtered = filtered.filter(o => o.delivery_methods === deliveryFilter);
  }
  if (nameQuery) {
    filtered = filtered.filter(o => 
      (o.full_name && o.full_name.toLowerCase().includes(nameQuery)) ||
      String(o.order_id).includes(nameQuery)
    );
  }

  renderOrders(filtered);
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  loadInitialData();

  // Create Order Modal
  document.getElementById("btn-open-create-order")?.addEventListener("click", () => {
    document.getElementById("form-create-order").reset();
    openModal("modal-create-order");
  });

  // Create Order Submit
  document.getElementById("form-create-order")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const customer_id = parseInt(document.getElementById("new-order-customer").value, 10);
    const service_id = parseInt(document.getElementById("new-order-service").value, 10);
    const delivery_methods = document.getElementById("new-order-delivery").value;

    try {
      const res = await api.orders.create({ customer_id, service_id, delivery_methods });
      showToast("Order created successfully! Now add items.", "success");
      closeModal("modal-create-order");
      await loadInitialData();
      
      if (res.order_id) {
        openAddItemsModal(res.order_id);
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Add Another Row in Add Items
  document.getElementById("btn-add-another-item-row")?.addEventListener("click", () => {
    const container = document.getElementById("items-rows-container");
    const newRow = document.createElement("div");
    newRow.className = "form-row item-input-row";
    newRow.style.marginBottom = "12px";
    newRow.innerHTML = `
      <div>
        <label class="form-label">Clothe Type *</label>
        <input type="text" class="form-input item-clothe" required placeholder="e.g. Blankets, Towels">
      </div>
      <div>
        <label class="form-label">Weight (kg) *</label>
        <div style="display: flex; gap: 8px;">
          <input type="number" class="form-input item-weight" required min="0.1" step="0.1" placeholder="e.g. 1.8">
          <button type="button" class="btn btn-outline btn-sm" style="color: var(--danger); padding: 4px 10px;" onclick="this.closest('.item-input-row').remove()">Remove</button>
        </div>
      </div>
    `;
    container.appendChild(newRow);
  });

  // Save Items Submit
  document.getElementById("form-add-items")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const order_id = parseInt(document.getElementById("add-items-order-id").value, 10);
    const rows = document.querySelectorAll("#items-rows-container .item-input-row");
    const items = [];

    rows.forEach(row => {
      const clothe_type = row.querySelector(".item-clothe").value.trim();
      const weight_in_kilo = parseFloat(row.querySelector(".item-weight").value);
      if (clothe_type && !isNaN(weight_in_kilo) && weight_in_kilo > 0) {
        items.push({ clothe_type, weight_in_kilo });
      }
    });

    if (items.length === 0) {
      showToast("Please enter at least one valid item.", "warning");
      return;
    }

    try {
      const res = await api.orderItems.add(order_id, items);
      showToast(`Added ${items.length} item(s)! Order Total: ${formatCurrency(res.totalAmount)}`, "success");
      closeModal("modal-add-items");
      if (document.getElementById("modal-order-details").classList.contains("active")) {
        openOrderDetailsModal(order_id);
      }
      loadInitialData();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Update Status Submit
  document.getElementById("form-update-status")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const orderId = document.getElementById("status-order-id").value;
    const status = document.getElementById("select-new-status").value;

    try {
      await api.orders.setStatus(orderId, status);
      showToast(`Order #${orderId} status updated to ${status}!`, "success");
      closeModal("modal-update-status");
      loadInitialData();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Add items from inside details modal
  document.getElementById("btn-open-add-items-from-details")?.addEventListener("click", () => {
    if (currentOrderDetails) {
      openAddItemsModal(currentOrderDetails.order_id);
    }
  });

  // Filter Listeners
  document.getElementById("filter-order-status")?.addEventListener("change", applyFilters);
  document.getElementById("filter-order-delivery")?.addEventListener("change", applyFilters);
  
  let searchTimer;
  document.getElementById("order-search-name")?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 250);
  });

  document.getElementById("btn-reset-filters")?.addEventListener("click", () => {
    document.getElementById("filter-order-status").value = "";
    document.getElementById("filter-order-delivery").value = "";
    document.getElementById("order-search-name").value = "";
    renderOrders(ordersList);
  });
});
