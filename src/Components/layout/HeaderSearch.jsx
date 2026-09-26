import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/Context/AuthContext';
import { useTheme } from '@/Context/ThemeContext';
import { 
  FiSearch, FiX, FiLoader, FiFileText, FiPackage, FiGrid, FiUser, FiBriefcase, FiServer, FiShoppingCart
} from 'react-icons/fi';
import { getAccessibleMenus } from '@/config/menus';
import { 
  getProductsApi, 
  getCategoryApi, 
  getUsersApi, 
  getCompaniesApi, 
  getFirmsApi,
  getPurchaseOrdersApi 
} from '@/api/axios';

const extractList = (res, ...possibleKeys) => {
  if (!res?.data) return [];
  const body = res.data;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.data)) return body.data;
  for (const key of possibleKeys) {
    if (Array.isArray(body[key])) return body[key];
    if (body.data && Array.isArray(body.data[key])) return body.data[key];
  }
  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.results)) return body.results;
  return [];
};

const getTypeBadgeClass = (type, isDark) => {
  switch (type) {
    case 'Product':
      return isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800';
    case 'Company':
      return isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-800';
    case 'Firm':
      return isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800';
    case 'Category':
      return isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-800';
    case 'User':
      return isDark ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-100 text-sky-800';
    case 'Order':
      return isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-800';
    case 'Page':
    default:
      return isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-800';
  }
};

const getTypeIcon = (type) => {
  switch (type) {
    case 'Product':
      return FiPackage;
    case 'Company':
      return FiBriefcase;
    case 'Firm':
      return FiServer;
    case 'Category':
      return FiGrid;
    case 'User':
      return FiUser;
    case 'Order':
      return FiShoppingCart;
    case 'Page':
    default:
      return FiFileText;
  }
};

const HeaderSearch = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchData, setSearchData] = useState({ 
    products: [], 
    categories: [], 
    users: [], 
    companies: [], 
    firms: [],
    orders: []
  });
  const [dataFetched, setDataFetched] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const searchRef = useRef(null);
  const lastFetchedRef = useRef(0);

  // Close suggestions automatically when route changes
  useEffect(() => {
    setShowSuggestions(false);
    setSelectedIndex(-1);
  }, [location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAllData = useCallback(async (force = false) => {
    if (!user) return;
    if ((dataFetched && !force) || isLoadingData) return;
    setIsLoadingData(true);
    try {
      const [prodRes, catRes, userRes, compRes, firmRes, orderRes] = await Promise.all([
        getProductsApi().catch(() => ({ data: [] })),
        getCategoryApi().catch(() => ({ data: [] })),
        getUsersApi().catch(() => ({ data: [] })),
        getCompaniesApi().catch(() => ({ data: [] })),
        getFirmsApi().catch(() => ({ data: [] })),
        getPurchaseOrdersApi().catch(() => ({ data: [] }))
      ]);

      setSearchData({
        products: extractList(prodRes, 'products'),
        categories: extractList(catRes, 'categories'),
        users: extractList(userRes, 'users'),
        companies: extractList(compRes, 'companies'),
        firms: extractList(firmRes, 'firms'),
        orders: extractList(orderRes, 'purchaseOrders', 'orders')
      });
      setDataFetched(true);
      lastFetchedRef.current = Date.now();
    } catch (err) {
      console.error('Failed to fetch data for search', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [user, dataFetched, isLoadingData]);

  // Fetch data on mount if user is logged in
  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user, fetchAllData]);

  // Handle input focus: show suggestions if query exists, refresh stale data if needed
  const handleFocus = () => {
    if (searchQuery.trim()) {
      setShowSuggestions(true);
    }
    if (!dataFetched || Date.now() - lastFetchedRef.current > 120000) {
      fetchAllData(true);
    }
  };

  // Filter based on search query
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSelectedIndex(-1);
      setIsSearching(false);
      return;
    }

    if (!dataFetched) {
      setIsSearching(true);
      setShowSuggestions(true);
      fetchAllData();
      return;
    }

    setIsSearching(true);
    setShowSuggestions(true);

    const timeoutId = setTimeout(() => {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      let results = [];

      // 1. Search Menus/Pages (filtered by user permissions & role)
      if (user) {
        const userMenus = getAccessibleMenus(user?.permissions || [], user?.role || '');
        const flattenMenus = [];
        userMenus.forEach((m) => {
          if (!m) return;
          if (m.subMenus) {
            m.subMenus.forEach((s) => flattenMenus.push({ ...s, parent: m.name }));
          } else {
            flattenMenus.push(m);
          }
        });

        // Ensure profile is searchable
        if (!flattenMenus.some((m) => m.path === '/profile')) {
          flattenMenus.push({ path: '/profile', name: 'Profile', parent: null });
        }
        
        const matchedMenus = flattenMenus.filter((m) => 
          terms.every((term) => m.name.toLowerCase().includes(term))
        );
        results = results.concat(matchedMenus.map((m) => ({
          _id: `menu-${m.path}`,
          title: m.name,
          subtitle: m.parent ? `${m.parent} Menu` : 'Page',
          type: 'Page',
          url: m.path
        })));
      }

      // 2. Search Companies
      const matchedCompanies = (searchData.companies || []).filter((c) => {
        const text = `${c.name || ''} ${c.code || ''} ${c.description || ''} ${c.email || ''} ${c.phone || ''} ${c.city || ''} ${c.address || ''}`.toLowerCase();
        return terms.every((term) => text.includes(term));
      });
      results = results.concat(matchedCompanies.map((c) => ({
        _id: `comp-${c._id}`,
        title: c.name || 'Unnamed Company',
        subtitle: `Company • Code: ${c.code || 'N/A'}${c.city ? ` • ${c.city}` : ''}${c.isActive === false ? ' • Inactive' : ''}`,
        type: 'Company',
        url: c._id ? `/companies/${c._id}` : '/companies'
      })));

      // 3. Search Firms
      const matchedFirms = (searchData.firms || []).filter((f) => {
        const text = `${f.firmName || ''} ${f.firmCode || ''} ${f.contactPerson || ''} ${f.city || ''} ${f.phone || ''} ${f.email || ''} ${f.address || ''}`.toLowerCase();
        return terms.every((term) => text.includes(term));
      });
      results = results.concat(matchedFirms.map((f) => ({
        _id: `firm-${f._id}`,
        title: f.firmName || 'Unnamed Firm',
        subtitle: `Firm • Code: ${f.firmCode || 'N/A'}${f.contactPerson ? ` • Contact: ${f.contactPerson}` : ''}${f.city ? ` • ${f.city}` : ''}`,
        type: 'Firm',
        url: f.firmName ? `/firms?search=${encodeURIComponent(f.firmName)}` : '/firms'
      })));

      // 4. Search Products (Name, SKU, Brand, Category, Description, Unit, HSN)
      const matchedProducts = (searchData.products || []).filter((product) => {
        const catName = typeof product.categoryId === 'object' ? (product.categoryId?.name || '') : '';
        const text = `${product.name || ''} ${product.sku || ''} ${product.brand || ''} ${product.description || ''} ${product.hsnCode || ''} ${product.unit || ''} ${product.subCategory || ''} ${catName}`.toLowerCase();
        return terms.every((term) => text.includes(term));
      });
      results = results.concat(matchedProducts.map((p) => {
        const catName = typeof p.categoryId === 'object' ? (p.categoryId?.name || '') : '';
        return {
          _id: `prod-${p._id}`,
          title: p.name || 'Unnamed Product',
          subtitle: `Product • SKU: ${p.sku || 'N/A'}${p.brand ? ` • ${p.brand}` : ''}${catName ? ` • ${catName}` : ''}${p.unit ? ` • ${p.unit}` : ''}`,
          type: 'Product',
          url: `/products`,
          state: { searchQuery: p.name || p.sku }
        };
      }));

      // 5. Search Categories
      const matchedCategories = (searchData.categories || []).filter((c) => {
        const text = `${c.name || ''} ${c.code || ''} ${c.description || ''} ${c._id || ''}`.toLowerCase();
        return terms.every((term) => text.includes(term));
      });
      results = results.concat(matchedCategories.map((c) => ({
        _id: `cat-${c._id}`,
        title: c.name || 'Unnamed Category',
        subtitle: `Category • Code: ${c.code || 'N/A'}${c.description ? ` • ${c.description}` : ''}`,
        type: 'Category',
        url: `/categories`
      })));

      // 6. Search Users
      const matchedUsers = (searchData.users || []).filter((u) => {
        const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || '';
        const text = `${fullName} ${u.firstName || ''} ${u.lastName || ''} ${u.email || ''} ${u.phone || ''} ${u.employeeCode || ''} ${u.designation || ''} ${u.role || ''}`.toLowerCase();
        return terms.every((term) => text.includes(term));
      });
      results = results.concat(matchedUsers.map((u) => {
        const displayName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || 'User';
        const role = (u.role || '').replace(/_/g, ' ');
        return {
          _id: `user-${u._id}`,
          title: displayName,
          subtitle: `${u.email || u.phone || 'User'}${role ? ` • ${role}` : ''}${u.employeeCode ? ` • Emp: ${u.employeeCode}` : ''}`,
          type: 'User',
          url: u._id ? `/users/${u._id}` : `/users?search=${encodeURIComponent(displayName)}`
        };
      }));

      // 7. Search Purchase Orders
      const matchedOrders = (searchData.orders || []).filter((o) => {
        const compName = typeof o.companyId === 'object' ? (o.companyId?.name || '') : '';
        const firmName = typeof o.firmId === 'object' ? (o.firmId?.firmName || '') : '';
        const repName = typeof o.salesExecutiveId === 'object' 
          ? ([o.salesExecutiveId?.firstName, o.salesExecutiveId?.lastName].filter(Boolean).join(' ') || o.salesExecutiveId?.name || '')
          : '';
        const itemsText = Array.isArray(o.items) ? o.items.map((it) => `${it.productNameSnapshot || ''} ${it.skuSnapshot || ''}`).join(' ') : '';
        const text = `${o.poNumber || ''} ${o.orderNumber || ''} ${o._id || ''} ${compName} ${firmName} ${repName} ${o.status || ''} ${itemsText}`.toLowerCase();
        return terms.every((term) => text.includes(term));
      });
      results = results.concat(matchedOrders.map((o) => {
        const compName = typeof o.companyId === 'object' ? (o.companyId?.name || '') : '';
        const firmName = typeof o.firmId === 'object' ? (o.firmId?.firmName || '') : '';
        const poNum = o.poNumber || o.orderNumber || (o._id ? o._id.slice(-8).toUpperCase() : 'N/A');
        const entityLabel = compName || firmName || 'Purchase Order';
        return {
          _id: `order-${o._id}`,
          title: `PO #${poNum}`,
          subtitle: `Order • ${entityLabel} • ${o.status || 'PENDING'}${o.totalAmount ? ` • ₹${Number(o.totalAmount).toLocaleString()}` : ''}`,
          type: 'Order',
          url: `/purchase-orders`,
          state: { orderId: o._id, poNumber: poNum }
        };
      }));

      // Sort results by relevance to query
      results.sort((a, b) => {
        const aTitleLower = a.title.toLowerCase();
        const bTitleLower = b.title.toLowerCase();
        const lowerQuery = query.toLowerCase();

        // Exact match
        if (aTitleLower === lowerQuery && bTitleLower !== lowerQuery) return -1;
        if (bTitleLower === lowerQuery && aTitleLower !== lowerQuery) return 1;

        // Starts with query
        const aStarts = aTitleLower.startsWith(lowerQuery);
        const bStarts = bTitleLower.startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return 0;
      });

      setSearchResults(results.slice(0, 12)); // Limit to top 12 results
      setSelectedIndex(-1);
      setIsSearching(false);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchData, dataFetched, user, fetchAllData]);

  // Keyboard navigation within suggestions dropdown
  const handleKeyDown = (e) => {
    if (!showSuggestions || searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && searchResults[selectedIndex]) {
        e.preventDefault();
        const target = searchResults[selectedIndex];
        navigate(target.url, { state: target.state });
        setShowSuggestions(false);
        setSearchQuery('');
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      const target = selectedIndex >= 0 && searchResults[selectedIndex] ? searchResults[selectedIndex] : searchResults[0];
      navigate(target.url, { state: target.state });
      setShowSuggestions(false);
      setSearchQuery('');
    }
  };

  return (
    <div className="flex-1 max-w-md" ref={searchRef}>
      <form onSubmit={handleSearchSubmit} className="relative group">
        <FiSearch className={`absolute left-3 top-1/2 transform -translate-y-1/2 transition-colors z-10 ${
          isDark ? 'text-slate-400 group-focus-within:text-blue-500' : 'text-slate-400 group-focus-within:text-blue-600'
        }`} />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Search menus, companies, firms, products, categories, users, orders..." 
          className={`w-full pl-10 pr-10 py-2 border rounded-xl focus:outline-none focus:ring-4 transition-all text-sm shadow-xs ${
            isDark 
              ? 'bg-transparent border-white/10 focus:border-blue-500/50 focus:bg-blue-950/10 focus:ring-blue-500/10 text-white placeholder-slate-400' 
              : 'bg-white/70 hover:bg-white/90 border-slate-200/80 focus:border-blue-500 focus:bg-white focus:ring-blue-500/15 text-slate-800 placeholder-slate-400'
          }`}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setShowSuggestions(false); }}
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <FiX />
          </button>
        )}

        {/* Search Suggestions Dropdown */}
        {showSuggestions && searchQuery.trim() && (
          <div className={`absolute top-full left-0 right-0 mt-2 backdrop-blur-xl border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 ${
            isDark 
              ? 'bg-blue-950/50 border-white/10 shadow-black/50' 
              : 'bg-white/40 border-slate-200 shadow-slate-900/10'
          }`}>
            {isSearching ? (
              <div className="p-4 text-center text-slate-400 flex items-center justify-center text-sm font-medium">
                <FiLoader className="animate-spin mr-2 text-blue-500 text-lg" /> Searching...
              </div>
            ) : searchResults.length > 0 ? (
              <ul className="max-h-80 overflow-y-auto custom-scrollbar">
                {searchResults.map((item, index) => {
                  const Icon = getTypeIcon(item.type);
                  const badgeClass = getTypeBadgeClass(item.type, isDark);
                  const isSelected = index === selectedIndex;

                  return (
                    <li key={item._id}>
                      <Link
                        to={item.url}
                        state={item.state}
                        onMouseEnter={() => setSelectedIndex(index)}
                        onClick={() => {
                          setShowSuggestions(false);
                          setSearchQuery('');
                        }}
                        className={`flex items-center gap-3 p-3 transition-colors border-b last:border-0 ${
                          isSelected
                            ? isDark
                              ? 'bg-blue-600/25 border-white/10'
                              : 'bg-blue-50 border-slate-100'
                            : isDark 
                              ? 'hover:bg-blue-950/65 border-white/10' 
                              : 'hover:bg-blue-50/70 border-slate-100'
                        }`}
                      >
                        <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
                          isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <Icon />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.title}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ml-2 shrink-0 ${badgeClass}`}>
                              {item.type}
                            </span>
                          </div>
                          <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.subtitle}</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="p-4 text-center text-slate-400 text-sm font-medium">
                No results found for "{searchQuery}"
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
};

export default HeaderSearch;