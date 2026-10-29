const BASE = "/api";

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function list(path, key) {
  try {
    const data = await request(path);
    return data[key] ?? [];
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}

const enc = encodeURIComponent;

export const api = {
  // ---------- Customers ----------
  customers: {
    list: async () => {
      const data = await request("/customers");
      return Array.isArray(data) ? data : (data.customers || data.data || []);
    },
    get: (id) => request(`/customers/${id}`),
    searchByName: async (name) => {
      try {
        const data = await request(`/customers/name/${enc(name)}`);
        return data.customers || data.message || [];
      } catch (err) {
        if (err.status === 404) return [];
        throw err;
      }
    },
    create: (body) => request("/customers", { method: "POST", body }),
    update: (id, body) => request(`/customers/${id}`, { method: "PUT", body }),
    delete: (id) => request(`/customers/${id}`, { method: "DELETE" }),
  },

  // ---------- Services ----------
  services: {
    list: async () => {
      const data = await request("/services");
      return data.services || data.available_services || [];
    },
    get: (id) => request(`/services/${id}`),
    searchByName: async (name) => {
      try {
        const data = await request(`/services/name/${enc(name)}`);
        return data.results || data.services || [];
      } catch (err) {
        if (err.status === 404) return [];
        throw err;
      }
    },
    create: (body) => request("/services", { method: "POST", body }),
    update: (id, body) => request(`/services/${id}`, { method: "PUT", body }),
    delete: (id) => request(`/services/${id}`, { method: "DELETE" }),
  },

  // ---------- Orders ----------
  orders: {
    list: () => list("/orders", "orders"),
    get: (id) => request(`/orders/${id}`),
    byStatus: (status) => list(`/orders/status/${enc(status)}`, "orders"),
    byName: (name) => list(`/orders/name/${enc(name)}`, "orders"),
    byDelivery: async (method) => {
      try {
        const data = await request(`/orders/delivery/${enc(method)}`);
        return Array.isArray(data) ? data : (data.orders ?? []);
      } catch (err) {
        if (err.status === 404) return [];
        throw err;
      }
    },
    create: (body) => request("/orders", { method: "POST", body }),
    setStatus: (id, status) =>
      request(`/orders/${id}/status`, { method: "PUT", body: { status } }),
    setDelivery: (id, delivery_methods) =>
      request(`/orders/delivery/${id}`, { method: "PUT", body: { delivery_methods } }),
    delete: (id) => request(`/orders/${id}`, { method: "DELETE" }),
  },

  // ---------- Order items ----------
  orderItems: {
    add: (order_id, items) =>
      request("/order-items", { method: "POST", body: { order_id, items } }),
    update: (item_id, body) =>
      request(`/order-items/${item_id}`, { method: "PUT", body }),
    delete: (item_id) =>
      request(`/order-items/${item_id}`, { method: "DELETE" }),
    byOrder: async (order_id) => {
      const data = await request(`/order-items/order/${order_id}`);
      return data.items || [];
    },
  },

  // ---------- Payments ----------
  payments: {
    list: async () => {
      const data = await request("/payments");
      return data.payments || [];
    },
    get: (id) => request(`/payments/${id}`),
    byOrder: async (orderId) => {
      const data = await request(`/payments/order/${orderId}`);
      return data.payments || [];
    },
    create: (body) => request("/payments", { method: "POST", body }),
    setStatus: (orderId, newStatus) =>
      request(`/payments/${orderId}`, { method: "PUT", body: { newStatus } }),
    complete: (orderId, body) =>
      request(`/payments/complete/${orderId}`, { method: "PUT", body }),
  },
};
