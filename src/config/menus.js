import { 
  FiHome, FiGrid, FiBriefcase, FiServer, 
  FiBell, FiBox, FiShoppingCart, FiPieChart, FiUsers, FiSettings 
} from 'react-icons/fi';
import { filterAccessibleMenus } from '../utils/rbac';

const PAGES = {
  DASHBOARD: { path: '/', name: 'Dashboard', icon: FiHome },
  USERS: { path: '/users', name: 'Users', icon: FiUsers },
  FIRMS: { path: '/firms', name: 'Firms', icon: FiServer },
  COMPANIES: { path: '/companies', name: 'Companies', icon: FiBriefcase },
  CATEGORIES: { path: '/categories', name: 'Categories', icon: FiGrid },
  PRODUCTS: { path: '/products', name: 'Products', icon: FiBox },
  PURCHASE_ORDERS: { path: '/purchase-orders', name: 'Purchase Orders', icon: FiShoppingCart },
  NOTIFICATIONS: { path: '/notifications', name: 'Notifications', icon: FiBell },
  REPORTS: { path: '/reports', name: 'Reports', icon: FiPieChart },
  SETTINGS: { path: '/settings', name: 'Settings', icon: FiSettings },
};

export const getAccessibleMenus = (userPermissions = [], userRole = '') => {
  const allMenus = [
    PAGES.DASHBOARD,
    PAGES.USERS,
    PAGES.FIRMS,
    PAGES.COMPANIES,
    PAGES.CATEGORIES,
    PAGES.PRODUCTS,
    PAGES.PURCHASE_ORDERS,
    PAGES.NOTIFICATIONS,
    PAGES.REPORTS,
    PAGES.SETTINGS,
  ];

  return filterAccessibleMenus(allMenus, userPermissions, userRole);
};