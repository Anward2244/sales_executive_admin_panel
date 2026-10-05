import { 
  FiHome, FiGrid, FiBriefcase, FiServer, 
  FiBell, FiBox, FiShoppingCart, FiPieChart, FiUsers, FiSettings,
  FiUserCheck, FiList, FiMail, FiGitBranch
} from 'react-icons/fi';
import { filterAccessibleMenus } from '../utils/rbac';

const PAGES = {
  DASHBOARD: { path: '/', name: 'Dashboard', icon: FiHome },
  USERS: { path: '/users', name: 'Users', icon: FiUsers },
  FIRMS: {
    path: '/firms',
    name: 'Firms',
    icon: FiServer,
    subMenus: [
      { path: '/firms', name: 'All Firms', icon: FiList },
      { path: '/firms/onboarding', name: 'Onboarding Requests', icon: FiUserCheck },
    ]
  },
  COMPANIES: { path: '/companies', name: 'Companies', icon: FiBriefcase },
  CATEGORIES: { path: '/categories', name: 'Categories', icon: FiGrid },
  PRODUCTS: { path: '/products', name: 'Products', icon: FiBox },
  BRAND_ROUTINGS: { path: '/brand-routings', name: 'Brand Routings', icon: FiGitBranch },
  PURCHASE_ORDERS: { path: '/purchase-orders', name: 'Purchase Orders', icon: FiShoppingCart },
  NOTIFICATIONS: {
    path: '/notifications',
    name: 'Notifications',
    icon: FiBell,
    subMenus: [
      { path: '/notifications', name: 'In-App Alerts', icon: FiBell },
      { path: '/notifications/emails', name: 'Email Delivery Logs', icon: FiMail },
    ]
  },
  REPORTS: { path: '/reports', name: 'Reports', icon: FiPieChart },
  SETTINGS: { path: '/settings', name: 'Settings', icon: FiSettings },
};

export const getAccessibleMenus = (userPermissions = [], userRole = '') => {
  const allMenus = [
    PAGES.DASHBOARD,
    PAGES.USERS,
    PAGES.FIRMS,
    PAGES.COMPANIES,
    PAGES.BRAND_ROUTINGS,
    PAGES.CATEGORIES,
    PAGES.PRODUCTS,
    PAGES.PURCHASE_ORDERS,
    PAGES.NOTIFICATIONS,
    PAGES.REPORTS,
    PAGES.SETTINGS,
  ];

  return filterAccessibleMenus(allMenus, userPermissions, userRole);
};