import axios from 'axios';

export const BASE_URL = import.meta.env.DEV ? '' : 'https://monster-airline-relevant-earn.trycloudflare.com';
// export const BASE_URL_DEV = 'http://192.168.1.4:5046';


const api = axios.create({
  baseURL: `${BASE_URL}/api`
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const refreshAuthToken = async () => {
  const refreshToken = sessionStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
    refreshToken
  });

  const resData = response.data || {};
  const data = resData.data || resData;
  const tokens = data.tokens || data;
  const newAccessToken = tokens.accessToken || data.accessToken || resData.accessToken;
  const newRefreshToken = tokens.refreshToken || data.refreshToken || resData.refreshToken;

  if (newAccessToken) {
    sessionStorage.setItem('accessToken', newAccessToken);
  }
  if (newRefreshToken) {
    sessionStorage.setItem('refreshToken', newRefreshToken);
  }

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

export const logoutApi = async (refreshToken) => {
  const token = refreshToken || sessionStorage.getItem('refreshToken');
  if (!token) return;
  return api.post('/v1/auth/logout', { refreshToken: token });
};

export const registerApi = async (data) => {
  return api.post('/v1/auth/register', data);
};

export const forgotPasswordApi = async (data) => {
  return api.post('/v1/auth/forgot-password', data);
};

export const resetPasswordApi = async (data) => {
  return api.post('/v1/auth/reset-password', data);
};

export const getProfileApi = async () => {
  try {
    return await api.get('/v1/auth/me');
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get('/auth/me');
    }
    throw err;
  }
};

export const updateProfileApi = async (data) => {
  try {
    return await api.put('/v1/auth/me', data);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.put('/auth/me', data);
    }
    throw err;
  }
};

export const getDashboardMetricsApi = async () => {
  try {
    return await api.get('/v1/dashboard');
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get('/dashboard');
    }
    throw err;
  }
};

export const getReportsApi = async (params = {}) => {
  try {
    return await api.get('/v1/reports', { params });
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get('/reports', { params });
    }
    throw err;
  }
};

export const getCompaniesApi = async (params = {}) => {
  try {
    return await api.get('/v1/companies', { params });
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get('/companies', { params });
    }
    throw err;
  }
};

export const createCompanyApi = async (companyData) => {
  try {
    return await api.post('/companies', companyData);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.post('/v1/companies', companyData);
    }
    throw err;
  }
};

export const getCompanyByIdApi = async (id) => {
  try {
    return await api.get(`/v1/companies/${id}`);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get(`/companies/${id}`);
    }
    throw err;
  }
};

export const updateCompanyApi = async (id, companyData) => {
  try {
    return await api.patch(`/v1/companies/${id}`, companyData);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.patch(`/companies/${id}`, companyData);
    }
    throw err;
  }
};

export const deleteCompanyApi = async (id) => {
  try {
    return await api.delete(`/companies/${id}`);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.delete(`/v1/companies/${id}`);
    }
    throw err;
  }
};


export const getFirmsApi = async (params = {}) => {
  try {
    return await api.get('/v1/firms', { params });
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get('/firms', { params });
    }
    throw err;
  }
};

export const getFirmByIdApi = async (id) => {
  try {
    return await api.get(`/v1/firms/${id}`);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get(`/firms/${id}`);
    }
    throw err;
  }
};

export const createFirmApi = async (firmData) => {
  try {
    return await api.post('/v1/firms', firmData);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.post('/firms', firmData);
    }
    throw err;
  }
};

export const updateFirmApi = async (id, firmData) => {
  try {
    return await api.patch(`/v1/firms/${id}`, firmData);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.patch(`/firms/${id}`, firmData);
    }
    throw err;
  }
};

export const deleteFirmApi = async (id) => {
  try {
    return await api.delete(`/v1/firms/${id}`);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.delete(`/firms/${id}`);
    }
    throw err;
  }
};

export const getUsersApi = async (params = {}) => {
  try {
    return await api.get('/v1/users', { params });
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get('/users', { params });
    }
    throw err;
  }
};

export const getUserByIdApi = async (id) => {
  try {
    return await api.get(`/v1/users/${id}`);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get(`/users/${id}`);
    }
    throw err;
  }
};

export const createUserApi = async (userData) => {
  try {
    return await api.post('/v1/users', userData);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.post('/users', userData);
    }
    throw err;
  }
};

export const updateUserApi = async (id, userData) => {
  try {
    return await api.patch(`/v1/users/${id}`, userData);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.patch(`/users/${id}`, userData);
    }
    throw err;
  }
};

export const updateUserStatusApi = async (id, isActive) => {
  try {
    return await api.patch(`/v1/users/${id}/status`, { isActive });
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.patch(`/users/${id}/status`, { isActive });
    }
    throw err;
  }
};

export const getCategoryApi = async (params = {}) => {
  try {
    return await api.get('/v1/categories', { params });
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get('/categories', { params });
    }
    throw err;
  }
};

export const createCategoryApi = async (categoryData) => {
  try {
    return await api.post('/v1/categories', categoryData);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.post('/categories', categoryData);
    }
    throw err;
  }
};

export const getCategoryByIdApi = async (id) => {
  try {
    return await api.get(`/v1/categories/${id}`);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get(`/categories/${id}`);
    }
    throw err;
  }
};

export const updateCategoryApi = async (id, categoryData) => {
  try {
    return await api.patch(`/v1/categories/${id}`, categoryData);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.patch(`/categories/${id}`, categoryData);
    }
    throw err;
  }
};

export const deleteCategoryApi = async (id) => {
  try {
    return await api.delete(`/v1/categories/${id}`);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.delete(`/categories/${id}`);
    }
    throw err;
  }
};

export const getProductsApi = async (params = {}) => {
  try {
    return await api.get('/v1/products', { params });
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get('/products', { params });
    }
    throw err;
  }
};

export const createProductApi = async (productData) => {
  try {
    return await api.post('/v1/products', productData);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.post('/products', productData);
    }
    throw err;
  }
};

export const bulkCreateProductsApi = async (productsArray) => {
  try {
    return await api.post('/v1/products/bulk', { products: productsArray });
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.post('/products/bulk', { products: productsArray });
    }
    throw err;
  }
};

export const getProductByIdApi = async (id) => {
  try {
    return await api.get(`/v1/products/${id}`);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get(`/products/${id}`);
    }
    throw err;
  }
};

export const updateProductApi = async (id, productData) => {
  try {
    return await api.patch(`/v1/products/${id}`, productData);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.patch(`/products/${id}`, productData);
    }
    throw err;
  }
};

export const deleteProductApi = async (id) => {
  try {
    return await api.delete(`/v1/products/${id}`);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.delete(`/products/${id}`);
    }
    throw err;
  }
};

// Purchase Orders APIs
export const getPurchaseOrdersApi = async (params = {}) => {
  try {
    return await api.get('/v1/purchase-orders', { params });
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get('/purchase-orders', { params });
    }
    throw err;
  }
};

export const createPurchaseOrderApi = async (orderData) => {
  try {
    return await api.post('/v1/purchase-orders', orderData);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.post('/purchase-orders', orderData);
    }
    throw err;
  }
};

export const getPurchaseOrderByIdApi = async (id) => {
  try {
    return await api.get(`/v1/purchase-orders/${id}`);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get(`/purchase-orders/${id}`);
    }
    throw err;
  }
};

export const approvePurchaseOrderApi = async (id, data = {}) => {
  try {
    return await api.patch(`/v1/purchase-orders/${id}/approve`, data);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.patch(`/purchase-orders/${id}/approve`, data);
    }
    throw err;
  }
};

export const rejectPurchaseOrderApi = async (id, reasonData) => {
  const payload = typeof reasonData === 'string' ? { reason: reasonData } : reasonData;
  try {
    return await api.patch(`/v1/purchase-orders/${id}/reject`, payload);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.patch(`/purchase-orders/${id}/reject`, payload);
    }
    throw err;
  }
};

export const dispatchPurchaseOrderApi = async (id, data = {}) => {
  try {
    return await api.patch(`/v1/purchase-orders/${id}/dispatch`, data);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.patch(`/purchase-orders/${id}/dispatch`, data);
    }
    throw err;
  }
};

// In-App Notification APIs
export const getNotificationsApi = async (params = {}) => {
  try {
    return await api.get('/v1/notifications', { params });
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get('/notifications', { params });
    }
    throw err;
  }
};

export const markNotificationAsReadApi = async (id) => {
  try {
    return await api.patch(`/v1/notifications/${id}/read`);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.patch(`/notifications/${id}/read`);
    }
    throw err;
  }
};

export const markAllNotificationsAsReadApi = async () => {
  try {
    return await api.patch('/v1/notifications/read-all');
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.patch('/notifications/read-all');
    }
    throw err;
  }
};

export const registerDeviceTokenApi = async (tokenData) => {
  try {
    return await api.post('/v1/notifications/device-token', tokenData);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.post('/notifications/device-token', tokenData);
    }
    throw err;
  }
};



api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      // Don't loop if auth endpoints return 401
      const isAuthEndpoint =
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/refresh') ||
        originalRequest.url?.includes('/auth/logout') ||
        originalRequest.url?.includes('/auth/register') ||
        originalRequest.url?.includes('/auth/forgot-password') ||
        originalRequest.url?.includes('/auth/reset-password');
      if (isAuthEndpoint) {
        return Promise.reject(error);
      }

      const storedRefreshToken = sessionStorage.getItem('refreshToken');
      if (!storedRefreshToken) {
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          sessionStorage.removeItem('accessToken');
          sessionStorage.removeItem('refreshToken');
          sessionStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { accessToken } = await refreshAuthToken();
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          sessionStorage.removeItem('accessToken');
          sessionStorage.removeItem('refreshToken');
          sessionStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export { api };