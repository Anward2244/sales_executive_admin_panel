import { 
  FiHome, FiGrid, FiBriefcase, FiServer, 
  FiBell, FiBox, FiShoppingCart, FiPieChart, FiUsers, FiSettings 
} from 'react-icons/fi';
import { filterAccessibleMenus } from '../utils/rbac';

const PAGES = {
  DASHBOARD: { path: '/', name: 'Dashboard', icon: FiHome },
  CATEGORIES: { path: '/categories', name: 'Categories', icon: FiGrid },
  COMPANIES: { path: '/companies', name: 'Companies', icon: FiBriefcase },
  FIRMS: { path: '/firms', name: 'Firms', icon: FiServer },
  NOTIFICATIONS: { path: '/notifications', name: 'Notifications', icon: FiBell },
  PRODUCTS: { path: '/products', name: 'Products', icon: FiBox },
  PURCHASE_ORDERS: { path: '/purchase-orders', name: 'Purchase Orders', icon: FiShoppingCart },
  REPORTS: { path: '/reports', name: 'Reports', icon: FiPieChart },
  USERS: { path: '/users', name: 'Users', icon: FiUsers },
  SETTINGS: { path: '/settings', name: 'Settings', icon: FiSettings },
};

export const getAccessibleMenus = (userPermissions = [], userRole = '') => {
  const allMenus = [
    PAGES.DASHBOARD,
    PAGES.CATEGORIES,
    PAGES.COMPANIES,
    PAGES.FIRMS,
    PAGES.NOTIFICATIONS,
    PAGES.PRODUCTS,
    PAGES.PURCHASE_ORDERS,
    PAGES.REPORTS,
    PAGES.USERS,
    PAGES.SETTINGS,
  ];

  return filterAccessibleMenus(allMenus, userPermissions, userRole);
};