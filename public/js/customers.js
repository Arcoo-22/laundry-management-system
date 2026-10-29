import { api } from "./api.js";
import { formatDate, openModal, closeModal, initNavigation, showToast, escapeHtml, Icons } from "./ui.js";

let customersList = [];

async function loadCustomers() {
  initNavigation("customers");
  try {
    customersList = await api.customers.list();
    renderCustomers(customersList);
  } catch (error) {
    console.error("Error loading customers:", error);
    showToast("Failed to load customers: " + error.message, "error");
  }
}

function renderCustomers(list) {
  const tbody = document.getElementById("customers-tbody");
  const countEl = document.getElementById("customer-count");
  if (countEl) countEl.textContent = `Total: ${list.length} customer${list.length === 1 ? "" : "s"}`;

  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 36px; color: var(--text-muted);">
          No customers found. Click <strong>"+ Add Customer"</strong> to create one.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>
      <td><strong>#${c.customer_id}</strong></td>
      <td><strong>${escapeHtml(c.full_name)}</strong></td>
      <td>${escapeHtml(c.contact)}</td>
      <td><a href="mailto:${escapeHtml(c.email)}" style="color: var(--primary); text-decoration: none;">${escapeHtml(c.email)}</a></td>
      <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(c.address)}">
        ${escapeHtml(c.address)}
      </td>
      <td style="color: var(--text-muted); font-size: 0.85rem;">${formatDate(c.created_at)}</td>
      <td>
        <button class="btn btn-outline btn-sm btn-edit-customer" data-id="${c.customer_id}" style="display:inline-flex;align-items:center;gap:6px;">
          ${Icons.edit} Edit
        </button>
      </td>
    </tr>
  `).join("");

  // Attach Edit Click Handlers
  document.querySelectorAll(".btn-edit-customer").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const customer = customersList.find(c => String(c.customer_id) === String(id));
      if (customer) {
        document.getElementById("edit-cust-id").value = customer.customer_id;
        document.getElementById("edit-cust-name").value = customer.full_name;
        document.getElementById("edit-cust-contact").value = customer.contact;
        document.getElementById("edit-cust-email").value = customer.email;
        document.getElementById("edit-cust-address").value = customer.address;
        openModal("modal-edit-customer");
      }
    });
  });
}

// Search functionality
async function handleSearch(searchTerm) {
  const term = searchTerm.trim();
  if (!term) {
    renderCustomers(customersList);
    return;
  }

  try {
    const results = await api.customers.searchByName(term);
    renderCustomers(results || []);
  } catch (err) {
    const filtered = customersList.filter(c => 
      c.full_name.toLowerCase().includes(term.toLowerCase())
    );
    renderCustomers(filtered);
  }
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  loadCustomers();

  // Create Modal Open
  document.getElementById("btn-open-create-customer")?.addEventListener("click", () => {
    document.getElementById("form-create-customer").reset();
    openModal("modal-create-customer");
  });

  // Create Form Submit
  document.getElementById("form-create-customer")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const full_name = document.getElementById("new-cust-name").value.trim();
    const contact = document.getElementById("new-cust-contact").value.trim();
    const email = document.getElementById("new-cust-email").value.trim();
    const address = document.getElementById("new-cust-address").value.trim();

    try {
      await api.customers.create({ full_name, contact, email, address });
      showToast("Customer created successfully!", "success");
      closeModal("modal-create-customer");
      loadCustomers();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Edit Form Submit
  document.getElementById("form-edit-customer")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("edit-cust-id").value;
    const full_name = document.getElementById("edit-cust-name").value.trim();
    const contact = document.getElementById("edit-cust-contact").value.trim();
    const email = document.getElementById("edit-cust-email").value.trim();
    const address = document.getElementById("edit-cust-address").value.trim();

    try {
      await api.customers.update(id, { full_name, contact, email, address });
      showToast("Customer updated successfully!", "success");
      closeModal("modal-edit-customer");
      loadCustomers();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Search input debounce
  const searchInput = document.getElementById("customer-search-input");
  let debounceTimer;
  searchInput?.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => handleSearch(e.target.value), 250);
  });

  document.getElementById("btn-clear-search")?.addEventListener("click", () => {
    if (searchInput) {
      searchInput.value = "";
      renderCustomers(customersList);
    }
  });
});
