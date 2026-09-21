import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { api, refreshAuthToken } from '../api/axios';
import { DEFAULT_ROLE_PERMISSIONS } from '../utils/rbac';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = sessionStorage.getItem('accessToken');
      const refreshToken = sessionStorage.getItem('refreshToken');

      if (token) {
        try {
          const decoded = jwtDecode(token);
          if (decoded.exp * 1000 < Date.now()) {
            if (refreshToken) {
              try {
                const { accessToken } = await refreshAuthToken();
                const savedUser = sessionStorage.getItem('user');
                if (savedUser) {
                  setUser({ ...JSON.parse(savedUser), token: accessToken });
                }
              } catch {
                logout();
              }
            } else {
              logout();
            }
          } else {
            const savedUser = sessionStorage.getItem('user');
            if (savedUser) {
              setUser({ ...JSON.parse(savedUser), token });
            } else {
              const role = (decoded.role || 'ADMIN').toLowerCase();
              const name = `${decoded.firstName || ''} ${decoded.lastName || ''}`.trim() || decoded.email;
              setUser({ id: decoded.id, _id: decoded.id, role, name, email: decoded.email, token });
            }
          }
        } catch {
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  useEffect(() => {
    const loadPermissions = async () => {
      if (!user) {
        setUserPermissions([]);
        return;
      }
      const userRole = (user.role || '').toLowerCase();
      if (userRole === 'admin') {
        setUserPermissions(DEFAULT_ROLE_PERMISSIONS.admin);
        return;
      }
      try {
        const token = sessionStorage.getItem('accessToken') || user.token;
        const res = await api.get('/admin/permissions', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = res.data || {};
        const mappings = data.mappings || data.roleMappings || data.logs || [];
        const userRoleMapping = mappings.find(m => (m.role || '').toLowerCase() === userRole);
        if (userRoleMapping) {
          setUserPermissions(userRoleMapping.permissions || []);
        } else {
          setUserPermissions(DEFAULT_ROLE_PERMISSIONS[userRole] || []);
        }
      } catch (err) {
        console.error('Failed to fetch user permissions, using fallback:', err);
        setUserPermissions(DEFAULT_ROLE_PERMISSIONS[userRole] || []);
      }
    };

    loadPermissions();
  }, [user]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/v1/auth/login', { email, password });

      const resData = response.data || {};
      const payload = resData.data || resData;
      const userObj = payload.user || payload;
      const tokens = payload.tokens || {};
      const token = tokens.accessToken || resData.token || payload.token;
      const refreshToken = tokens.refreshToken || resData.refreshToken || payload.refreshToken;

      if (token) {
        sessionStorage.setItem('accessToken', token);
      }
      if (refreshToken) {
        sessionStorage.setItem('refreshToken', refreshToken);
      }

      const role = (userObj.role || 'ADMIN').toLowerCase();
      const name = userObj.name || `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim() || userObj.email;

      const userData = {
        ...userObj,
        _id: userObj._id || userObj.id,
        role,
        rawRole: userObj.role,
        name,
        email: userObj.email,
        token
      };

      sessionStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return resData;
    } catch (err) {
      throw err;
    }
  };

  const register = async (registrationData) => {
    try {
      const response = await api.post('/v1/auth/register', registrationData);

      const resData = response.data || {};
      const payload = resData.data || resData;
      const userObj = payload.user || payload;
      const tokens = payload.tokens || {};
      const token = tokens.accessToken || resData.token || payload.token;
      const refreshToken = tokens.refreshToken || resData.refreshToken || payload.refreshToken;

      if (token) {
        sessionStorage.setItem('accessToken', token);
      }
      if (refreshToken) {
        sessionStorage.setItem('refreshToken', refreshToken);
      }

      const role = (userObj.role || 'SALES_EXECUTIVE').toLowerCase();
      const name = userObj.name || `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim() || userObj.email;

      const userData = {
        ...userObj,
        _id: userObj._id || userObj.id,
        role,
        rawRole: userObj.role,
        name,
        email: userObj.email,
        token
      };

      sessionStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return resData;
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    const refreshToken = sessionStorage.getItem('refreshToken');
    try {
      if (refreshToken) {
        await api.post('/v1/auth/logout', { refreshToken });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('user');
      setUser(null);
      setUserPermissions([]);
    }
  };

  const forgotPassword = async (email) => {
    try {
      const response = await api.post('/v1/auth/forgot-password', { email });
      return response.data;
    } catch (err) {
      throw err;
    }
  };

  const resetPassword = async ({ email, resetToken, newPassword }) => {
    try {
      const response = await api.post('/v1/auth/reset-password', {
        email,
        resetToken,
        newPassword
      });
      return response.data;
    } catch (err) {
      throw err;
    }
  };

  const updateUser = (updatedData) => {
    setUser((prev) => {
      const merged = { ...(prev || {}), ...updatedData };
      sessionStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
  };

  return (
    <AuthContext.Provider value={{ user, setUser, updateUser, login, logout, register, forgotPassword, resetPassword, refreshAuthToken, loading, userPermissions }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);