const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const ROOT_API_URL = import.meta.env.VITE_ROOT_API_URL || 'http://localhost:5000/api';

/**
 * Universal request wrapper for Express Backend APIs
 */
async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http')
    ? endpoint
    : endpoint.startsWith('/health')
      ? `${ROOT_API_URL}${endpoint}`
      : `${API_BASE_URL}${endpoint}`;

  const token = localStorage.getItem('ub_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, config);
    let data = null;

    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = { message: await res.text() };
    }

    if (!res.ok) {
      if (res.status === 401 && !endpoint.includes('/auth/login')) {
        // Token expired or invalid
        localStorage.removeItem('ub_token');
        localStorage.removeItem('ub_user');
        window.dispatchEvent(new Event('ub_auth_expired'));
      }

      const errorMessage = data?.message || data?.error || `HTTP error ${res.status}`;
      const err = new Error(errorMessage);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (error) {
    throw error;
  }
}

export const api = {
  get: (endpoint, options) => request(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => request(endpoint, { method: 'POST', body, ...options }),
  patch: (endpoint, body, options) => request(endpoint, { method: 'PATCH', body, ...options }),
  put: (endpoint, body, options) => request(endpoint, { method: 'PUT', body, ...options }),
  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options })
};

// Convenience API methods mapped directly to Urban Bites endpoints
export const authApi = {
  login: (identifier, password) => api.post('/auth/login', { identifier, password }),
  getProfile: () => api.get('/auth/me')
};

export const dashboardApi = {
  getHealth: () => request('/health'),
  getInventorySummary: () => api.get('/inventory/summary'),
  getExpiringBatches: (days = 7) => api.get(`/inventory/expiring?days=${days}`),
  getLowStock: () => api.get('/inventory/low-stock'),
  getRecentOrders: (limit = 10) => api.get(`/orders?limit=${limit}`)
};

export const catalogApi = {
  getCategories: () => api.get('/categories'),
  getUnits: () => api.get('/units'),
  getIngredients: (params = '') => api.get(`/ingredients${params}`),
  getMenuItems: (params = '') => api.get(`/menu-items${params}`),
  updateMenuItem: (id, body) => api.patch(`/menu-items/${id}`, body),
  getRecipes: (params = '') => api.get(`/recipes${params}`),
  getRecipeById: (id) => api.get(`/recipes/${id}`),
  updateRecipe: (id, body) => api.patch(`/recipes/${id}`, body)
};

export const inventoryApi = {
  getCurrentStock: (params = '') => api.get(`/inventory${params}`),
  getBatches: (params = '') => api.get(`/inventory/batches${params}`),
  getMovements: (params = '') => api.get(`/inventory/movements${params}`),
  receiveStock: (body) => api.post('/inventory/receipts', body),
  adjustStock: (body) => api.post('/inventory/adjustments', body),
  getWasteRecords: (params = '') => api.get(`/inventory/waste${params}`),
  recordWaste: (body) => api.post('/inventory/waste', body)
};

export const supplierApi = {
  getSuppliers: (params = '') => api.get(`/suppliers${params}`),
  getSupplierById: (id) => api.get(`/suppliers/${id}`),
  getPurchaseOrders: (params = '') => api.get(`/purchase-orders${params}`),
  getPurchaseOrderById: (id) => api.get(`/purchase-orders/${id}`),
  createPurchaseOrder: (body) => api.post('/purchase-orders', body),
  submitPurchaseOrder: (id) => api.post(`/purchase-orders/${id}/submit`),
  cancelPurchaseOrder: (id) => api.post(`/purchase-orders/${id}/cancel`),
  receivePOItems: (receiptData) => api.post('/inventory/receipts', receiptData)
};

export const ordersApi = {
  getOrders: (params = '') => api.get(`/orders${params}`),
  getOrderById: (id) => api.get(`/orders/${id}`),
  createOrder: (body) => api.post('/orders', body),
  confirmOrder: (id) => api.post(`/orders/${id}/confirm`),
  markOrderReady: (id) => api.post(`/orders/${id}/ready`),
  deliverOrder: (id) => api.post(`/orders/${id}/deliver`),
  completeOrder: (id) => api.post(`/orders/${id}/complete`),
  cancelOrder: (id, body = {}) => api.post(`/orders/${id}/cancel`, body),
  recordPayment: (orderId, body) => api.post(`/orders/${orderId}/payments`, body)
};

export const forecastingApi = {
  generateForecasts: (body = { horizon_days: 7 }) => api.post('/forecasting/generate', body),
  getForecasts: (params = '') => api.get(`/forecasting${params}`),
  getAccuracy: () => api.get('/forecasting/accuracy'),
  getIngredientDemand: (params = '') => api.get(`/forecasting/ingredient-demand${params}`)
};

export const procurementApi = {
  getRecommendations: (params = '') => api.get(`/procurement/recommendations${params}`),
  convertToPO: (body) => api.post('/procurement/recommendations/convert-to-po', body)
};

export const staffApi = {
  getStaff: (params = '') => api.get(`/users${params}`),
  createStaff: (body) => api.post('/users', body),
  updateStaff: (id, body) => api.patch(`/users/${id}`, body),
  updateStaffStatus: (id, is_active) => api.patch(`/users/${id}/status`, { is_active })
};
