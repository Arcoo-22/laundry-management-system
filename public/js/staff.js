// Staff accounts (superadmin only): add people, change their role, disable them, reset passwords.
import { api } from "./api.js";
import { formatDate, openModal, closeModal, initNavigation, showToast, escapeHtml } from "./ui.js";

const ROLE_BADGE = { superadmin: "badge-ready", admin: "badge-processing", staff: "badge-pickup" };
const ROLE_LABEL = { superadmin: "Superadmin", admin: "Admin", staff: "Staff" };

let accounts = [];
const $ = (id) => document.getElementById(id);

function render() {
  $("staff-count").textContent = `Total: ${accounts.length} account${accounts.length === 1 ? "" : "s"}`;
  const tbody = $("staff-tbody");

  if (!accounts.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-title">No accounts yet</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = accounts
    .map((a) => {
      const locked = a.role === "superadmin";
      return `<tr>
        <td><strong>${escapeHtml(a.full_name)}</strong></td>
        <td>${escapeHtml(a.email)}</td>
        <td><span class="badge ${ROLE_BADGE[a.role] || ""}">${ROLE_LABEL[a.role] || escapeHtml(a.role)}</span></td>
        <td><span class="badge ${a.is_active ? "badge-paid" : "badge-cancelled"}">${a.is_active ? "Active" : "Disabled"}</span></td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${a.last_login_at ? formatDate(a.last_login_at) : "Never"}</td>
        <td>${
          locked
            ? `<span style="color: var(--text-muted); font-size: 0.82rem;">Managed from the server</span>`
            : `<div style="display: flex; gap: 6px; flex-wrap: wrap;">
                 <button class="btn btn-outline btn-sm btn-edit" data-id="${a.staff_id}">Edit</button>
                 <button class="btn btn-outline btn-sm btn-reset" data-id="${a.staff_id}">Reset password</button>
                 <button class="btn btn-sm btn-toggle ${a.is_active ? "btn-danger" : "btn-success"}" data-id="${a.staff_id}">${a.is_active ? "Disable" : "Enable"}</button>
               </div>`
        }</td>
      </tr>`;
    })
    .join("");

  const find = (btn) => accounts.find((a) => String(a.staff_id) === btn.dataset.id);

  tbody.querySelectorAll(".btn-edit").forEach((btn) =>
    btn.addEventListener("click", () => {
      const a = find(btn);
      $("edit-staff-id").value = a.staff_id;
      $("edit-staff-name").value = a.full_name;
      $("edit-staff-role").value = a.role;
      openModal("modal-edit-staff");
    })
  );

  tbody.querySelectorAll(".btn-reset").forEach((btn) =>
    btn.addEventListener("click", () => {
      const a = find(btn);
      $("reset-staff-id").value = a.staff_id;
      $("reset-staff-title").textContent = `Reset password: ${a.full_name}`;
      $("reset-staff-password").value = "";
      openModal("modal-reset-staff");
    })
  );

  tbody.querySelectorAll(".btn-toggle").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const a = find(btn);
      const disabling = !!a.is_active;
      if (disabling && !confirm(`Disable ${a.full_name}? They will be signed out and can't sign in until you enable them again.`)) return;
      try {
        await api.staff.update(a.staff_id, { is_active: !disabling });
        showToast(`${a.full_name} ${disabling ? "disabled" : "enabled"}.`, "success");
        await load();
      } catch (err) {
        showToast(err.message, "error");
      }
    })
  );
}

async function load() {
  try {
    accounts = await api.staff.list();
    render();
  } catch (err) {
    showToast("Couldn't load accounts: " + err.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initNavigation("staff");
  load();

  $("btn-open-create-staff").addEventListener("click", () => {
    $("form-create-staff").reset();
    openModal("modal-create-staff");
  });

  $("form-create-staff").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const res = await api.staff.create({
        full_name: $("new-staff-name").value.trim(),
        email: $("new-staff-email").value.trim(),
        role: $("new-staff-role").value,
        password: $("new-staff-password").value,
      });
      showToast(res.message || "Account created.", "success");
      closeModal("modal-create-staff");
      await load();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  $("form-edit-staff").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.staff.update($("edit-staff-id").value, {
        full_name: $("edit-staff-name").value.trim(),
        role: $("edit-staff-role").value,
      });
      showToast("Account updated.", "success");
      closeModal("modal-edit-staff");
      await load();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  $("form-reset-staff").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const res = await api.staff.resetPassword($("reset-staff-id").value, $("reset-staff-password").value);
      showToast(res.message || "Password set.", "success");
      closeModal("modal-reset-staff");
    } catch (err) {
      showToast(err.message, "error");
    }
  });
});