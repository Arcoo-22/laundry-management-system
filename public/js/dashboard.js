import { api } from "./api.js";
import { formatCurrency, formatDate, renderOrderStatusBadge, renderDeliveryBadge, initNavigation, showToast } from "./ui.js";

async function loadDashboard() {
  initNavigation("dashboard");

  try {
    const [orders, customers, payments] = await Promise.all([
      api.orders.list().catch(() => []),
      api.customers.list().catch(() => []),
      api.payments.list().catch(() => []),
    ]);

    // Compute stats
    const totalRevenue = payments.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0);
    const activeOrders = orders.filter(o => o.status === "Pending" || o.status === "Processing" || o.status === "Ready").length;
    const completedOrders = orders.filter(o => o.status === "Completed").length;

    // Update UI Cards
    document.getElementById("stat-revenue").textContent = formatCurrency(totalRevenue);
    document.getElementById("stat-active-orders").textContent = activeOrders;
    document.getElementById("stat-customers").textContent = customers.length;
    document.getElementById("stat-completed-orders").textContent = completedOrders;

    // Render Recent Orders (up to 8)
    const recentOrders = orders.slice(0, 8);
    const tbody = document.getElementById("recent-orders-tbody");

    if (recentOrders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
            No orders found yet. <a href="/orders.html" style="color: var(--primary); font-weight: 600;">Create one now!</a>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = recentOrders.map(order => `
      <tr>
        <td><strong>#${order.order_id}</strong></td>
        <td>${order.full_name || "Customer #" + order.customer_id}</td>
        <td>${order.service_name || "Service #" + order.service_id}</td>
        <td>${parseFloat(order.total_weight || 0).toFixed(2)} kg</td>
        <td><strong>${formatCurrency(order.total_amount)}</strong></td>
        <td>${renderDeliveryBadge(order.delivery_methods)}</td>
        <td>${renderOrderStatusBadge(order.status)}</td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${formatDate(order.created_at)}</td>
      </tr>
    `).join("");

  } catch (error) {
    console.error("Dashboard error:", error);
    showToast("Failed to load dashboard data: " + error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", loadDashboard);
