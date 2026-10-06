import axios from 'axios';

export const BASE_URL = import.meta.env.DEV ? '' : 'http://213.210.36.19:5001';
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
    return await api.patch('/v1/auth/me', data);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.patch('/auth/me', data);
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

// Generic helper to fetch all paginated table data across pages
const fetchAllPages = async (primaryEndpoint, fallbackEndpoint, params = {}) => {
  const requestParams = { limit: 1000, ...params };
  let initialRes;
  let activeEndpoint = primaryEndpoint;

  try {
    initialRes = await api.get(activeEndpoint, { params: requestParams });
  } catch (err) {
    if (fallbackEndpoint && err.response?.status === 404) {
      activeEndpoint = fallbackEndpoint;
      initialRes = await api.get(activeEndpoint, { params: requestParams });
    } else {
      throw err;
    }
  }

  const resData = initialRes?.data;
  const firstPageItems = Array.isArray(resData?.data)
    ? resData.data
    : (Array.isArray(resData) ? resData : []);
  const meta = resData?.meta;

  // If backend returned paginated meta with multiple pages and caller did not restrict to a specific page
  if (meta && meta.totalPages > 1 && (!params.page || params.page === 1)) {
    try {
      const pagePromises = [];
      for (let p = 2; p <= meta.totalPages; p++) {
        pagePromises.push(
          api.get(activeEndpoint, { params: { ...requestParams, page: p } }).catch(() => null)
        );
      }
      const pageResponses = await Promise.all(pagePromises);
      const remainingItems = pageResponses
        .filter(Boolean)
        .flatMap((r) => (Array.isArray(r.data?.data) ? r.data.data : (Array.isArray(r.data) ? r.data : [])));

      const allItems = [...firstPageItems, ...remainingItems];

      return {
        ...initialRes,
        data: Array.isArray(resData)
          ? allItems
          : {
              ...resData,
              data: allItems,
              meta: {
                total: allItems.length,
                page: 1,
                limit: allItems.length,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false
              }
            }
      };
    } catch (e) {
      console.warn(`Failed to fetch all pages for ${activeEndpoint}:`, e);
    }
  }

  return initialRes;
};

export const getCompaniesApi = async (params = {}) => {
  return fetchAllPages('/v1/companies', '/companies', params);
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
  return fetchAllPages('/v1/firms', '/firms', params);
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

export const getFirmOnboardingRequestsApi = async (params = {}) => {
  return fetchAllPages('/firms/onboarding-requests', '/v1/firms/onboarding-requests', params);
};
export const getOnboardingRequestsApi = getFirmOnboardingRequestsApi;

export const onboardFirmApi = async (firmData) => {
  try {
    return await api.post('/firms/onboard', firmData);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.post('/v1/firms/onboard', firmData);
    }
    throw err;
  }
};
export const createFirmOnboardApi = onboardFirmApi;
export const createFirmOnboardingApi = onboardFirmApi;

export const reviewFirmApi = async (id, reviewData) => {
  const payload = typeof reviewData === 'string'
    ? { approvalStatus: reviewData }
    : reviewData;

  try {
    return await api.patch(`/firms/${id}/review`, payload);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.patch(`/v1/firms/${id}/review`, payload);
    }
    throw err;
  }
};
export const reviewFirmOnboardingApi = reviewFirmApi;

export const approveFirmOnboardingApi = async (id, extraData = {}) => {
  return reviewFirmApi(id, { approvalStatus: 'APPROVED', ...extraData });
};

export const rejectFirmOnboardingApi = async (id, rejectionReason = '') => {
  return reviewFirmApi(id, { approvalStatus: 'REJECTED', rejectionReason });
};


export const getUsersApi = async (params = {}) => {
  return fetchAllPages('/v1/users', '/users', params);
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
  return fetchAllPages('/v1/categories', '/categories', params);
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
  return fetchAllPages('/v1/products', '/products', params);
};

export const createProductApi = async (productData) => {
  try {
    return await api.post('/v1/products/brands', productData);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.post('/products/brands', productData);
    }
    throw err;
  }
};

export const bulkCreateProductsApi = async (productsArray) => {
  try {
    return await api.post('/products/brands', { products: productsArray });
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.post('/v1/products/brands', { products: productsArray });
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
    return await api.put(`/v1/products/${id}`, productData);
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 405) {
      try {
        return await api.patch(`/v1/products/${id}`, productData);
      } catch (err2) {
        if (err2.response?.status === 404 || err2.response?.status === 405) {
          return await api.put(`/products/${id}`, productData);
        }
        throw err2;
      }
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
  return fetchAllPages('/v1/purchase-orders', '/purchase-orders', params);
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
  return fetchAllPages('/v1/notifications', '/notifications', params);
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

// Email Notification & Delivery Logs APIs
export const getEmailLogsApi = async (params = {}) => {
  return fetchAllPages('/emails/logs', '/v1/emails/logs', params);
};

export const resendEmailApi = async (id, customRecipients = []) => {
  const payload =
    Array.isArray(customRecipients) && customRecipients.length > 0
      ? { customRecipients }
      : {};
  try {
    return await api.post(`/emails/resend/${id}`, payload);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.post(`/v1/emails/resend/${id}`, payload);
    }
    throw err;
  }
};

export const getEmailRecipientsApi = async () => {
  try {
    return await api.get('/emails/recipients');
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get('/v1/emails/recipients');
    }
    throw err;
  }
};

export const updateEmailRecipientsApi = async (recipients = []) => {
  try {
    return await api.put('/emails/recipients', { recipients });
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.put('/v1/emails/recipients', { recipients });
    }
    throw err;
  }
};



// Brand Routing Matrix APIs
export const getBrandRoutingMatrixApi = async () => {
  try {
    return await api.get('/v1/brand-routings/matrix');
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get('/brand-routings/matrix');
    }
    throw err;
  }
};

export const getBrandRoutingByBrandApi = async (brand) => {
  const enc = encodeURIComponent(brand);
  try {
    return await api.get(`/v1/brand-routings/matrix/${enc}`);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get(`/brand-routings/matrix/${enc}`);
    }
    throw err;
  }
};

export const updateBrandRoutingMatrixApi = async (data) => {
  try {
    return await api.post('/v1/brand-routings/matrix', data);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.post('/brand-routings/matrix', data);
    }
    throw err;
  }
};

export const bulkUpdateBrandRoutingMatrixApi = async (data) => {
  try {
    return await api.post('/v1/brand-routings/bulk-matrix', data);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.post('/brand-routings/bulk-matrix', data);
    }
    throw err;
  }
};

export const resolveBrandRoutingApi = async (brand, state, city) => {
  const params = new URLSearchParams();
  if (brand) params.set('brand', brand);
  if (state) params.set('state', state);
  if (city) params.set('city', city);
  const qStr = params.toString();

  try {
    return await api.get(`/v1/brand-routings/resolve?${qStr}`);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get(`/brand-routings/resolve?${qStr}`);
    }
    throw err;
  }
};

export const deleteBrandRoutingApi = async (id) => {
  const enc = encodeURIComponent(id);
  try {
    return await api.delete(`/v1/brand-routings/${enc}`);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.delete(`/brand-routings/${enc}`);
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