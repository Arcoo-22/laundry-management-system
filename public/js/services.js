import { api } from "./api.js";
import { formatCurrency, openModal, closeModal, initNavigation, showToast, escapeHtml } from "./ui.js";

let servicesList = [];

async function loadServices() {
  initNavigation("services");
  try {
    servicesList = await api.services.list();
    renderServices(servicesList);
  } catch (error) {
    console.error("Error loading services:", error);
    showToast("Failed to load services: " + error.message, "error");
  }
}

function renderServices(list) {
  const container = document.getElementById("services-grid-container");
  const countEl = document.getElementById("service-count");
  if (countEl) countEl.textContent = `Total: ${list.length} service${list.length === 1 ? "" : "s"}`;

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1;" class="empty-state">
        <div class="empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
          </svg>
        </div>
        <div class="empty-title">No services found</div>
        <div class="empty-text">Click "+ Add New Service" above to add your first laundry rate.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(s => `
    <div class="service-card">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h3 class="service-name">${escapeHtml(s.service_name)}</h3>
          <span style="font-size: 0.75rem; color: var(--text-light); font-weight: 600;">#${s.service_id}</span>
        </div>
        <p class="service-desc">${escapeHtml(s.description || "No description provided.")}</p>
      </div>
      <div style="border-top: 1px solid var(--border); margin-top: 16px; padding-top: 12px; display: flex; justify-content: space-between; align-items: baseline;">
        <div class="service-price">
          ${formatCurrency(s.price_per_kilo)} <small>/ kg</small>
        </div>
        <span class="badge badge-completed">Available</span>
      </div>
    </div>
  `).join("");
}

// Search
async function handleSearch(term) {
  const q = term.trim();
  if (!q) {
    renderServices(servicesList);
    return;
  }

  try {
    const results = await api.services.searchByName(q);
    renderServices(results || []);
  } catch {
    const filtered = servicesList.filter(s =>
      s.service_name.toLowerCase().includes(q.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(q.toLowerCase()))
    );
    renderServices(filtered);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadServices();

  // Open modal
  document.getElementById("btn-open-create-service")?.addEventListener("click", () => {
    document.getElementById("form-create-service").reset();
    openModal("modal-create-service");
  });

  // Create submit
  document.getElementById("form-create-service")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const service_name = document.getElementById("new-srv-name").value.trim();
    const price_per_kilo = parseFloat(document.getElementById("new-srv-price").value);
    const description = document.getElementById("new-srv-desc").value.trim();

    try {
      await api.services.create({ service_name, price_per_kilo, description });
      showToast("Service created successfully!", "success");
      closeModal("modal-create-service");
      loadServices();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Search input
  const searchInput = document.getElementById("service-search-input");
  let debounce;
  searchInput?.addEventListener("input", (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => handleSearch(e.target.value), 250);
  });
});
