// Common UI Utilities and Helpers

export const Icons = {
  check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  eye: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
};

export function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  const icon = type === "success" ? Icons.check : type === "error" ? Icons.error : Icons.info;
  toast.innerHTML = `<span style="display:inline-flex;align-items:center;">${icon}</span><span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    const firstInput = modal.querySelector("input:not([type=hidden]), select, textarea");
    if (firstInput) firstInput.focus();
  }
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
  }
}

// Attach outside click & close button handlers
export function setupModalListeners() {
  document.querySelectorAll(".modal-overlay").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
      }
    });

    const closeBtn = modal.querySelector(".modal-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => modal.classList.remove("active"));
    }
  });
}

export function formatCurrency(amount) {
  const num = parseFloat(amount || 0);
  return "₱" + num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function renderOrderStatusBadge(status) {
  const s = (status || "Pending").toLowerCase();
  let badgeClass = "badge-pending";
  if (s === "processing") badgeClass = "badge-processing";
  else if (s === "ready") badgeClass = "badge-ready";
  else if (s === "completed") badgeClass = "badge-completed";
  else if (s === "cancelled") badgeClass = "badge-cancelled";

  return `<span class="badge ${badgeClass}">${escapeHtml(status || "Pending")}</span>`;
}

export function renderPaymentStatusBadge(status) {
  const s = (status || "Unpaid").toLowerCase();
  let badgeClass = "badge-unpaid";
  if (s.includes("fully") || s === "paid" || s === "completed") badgeClass = "badge-paid";
  else if (s.includes("part")) badgeClass = "badge-partial";

  return `<span class="badge ${badgeClass}">${escapeHtml(status || "Unpaid")}</span>`;
}

export function renderDeliveryBadge(method) {
  const m = (method || "Pickup").toLowerCase();
  const isDelivery = m.includes("delivery") || m.includes("drop");
  const badgeClass = isDelivery ? "badge-delivery" : "badge-pickup";
  const label = isDelivery ? "Delivery" : "Pickup";
  return `<span class="badge ${badgeClass}">${label}</span>`;
}

export function escapeHtml(str) {
  if (typeof str !== "string") return str ?? "";
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Highlights current navigation link
export function initNavigation(activeKey) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    if (item.dataset.nav === activeKey) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
  setupModalListeners();
}
