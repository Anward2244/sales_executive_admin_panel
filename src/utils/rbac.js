export const DEFAULT_ROLE_PERMISSIONS = {
  admin: [
    'orders_view', 'orders_manage', 'customers_view', 'customers_manage',
    'ledgers_manage', 'invoices_upload', 'banners_manage', 'notifications_send',
    'chat_view', 'chat_respond', 'campaigns_view', 'campaigns_manage',
    'products_view', 'products_manage'
  ],
  sales_head: [
    'orders_view', 'customers_view', 'chat_view', 'products_view'
  ],
  tsm: [
    'orders_view', 'customers_view'
  ],
  billing: [
    'orders_view', 'orders_manage', 'customers_view', 'ledgers_manage', 'invoices_upload'
  ],
  warehouse: [
    'orders_view'
  ]
};

export const isAllowed = (item, userPermissions = [], userRole = '') => {
  if (userRole === 'admin') return true;
  if (item.role && item.role !== userRole) return false;
  if (item.permission && !userPermissions.includes(item.permission)) return false;
  return true;
};

export const filterAccessibleMenus = (allMenus = [], userPermissions = [], userRole = '') => {
  return allMenus
    .map(menu => {
      if (!isAllowed(menu, userPermissions, userRole)) return null;
      if (menu.subMenus) {
        const filteredSubs = menu.subMenus.filter(sub => isAllowed(sub, userPermissions, userRole));
        if (filteredSubs.length === 0) return null;
        return { ...menu, subMenus: filteredSubs };
      }
      return menu;
    })
    .filter(Boolean);
};

export const isRouteAllowed = (path, userMenus = [], userRole = '') => {
  if (userRole === 'admin') return true;
  if (path === '/' || path === '/profile' || path === '/settings') return true;

  let checkPath = path;
  if (path.startsWith('/users/list/') || path.startsWith('/users/')) {
    checkPath = '/users';
  } else if (path.startsWith('/companies/')) {
    checkPath = '/companies';
  } else if (path.startsWith('/campaign-stats/')) {
    checkPath = '/campaign-stats';
  } else if (path.startsWith('/products/variants/')) {
    checkPath = '/products/list';
  } else if (path.startsWith('/dashboard/details/')) {
    checkPath = '/';
  }

  return userMenus.some(menu => {
    if (menu.path === checkPath) return true;
    if (menu.subMenus) {
      return menu.subMenus.some(sub => sub.path === checkPath);
    }
    return false;
  });
};
