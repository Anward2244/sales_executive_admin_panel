import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/Context/AuthContext';
import { useTheme } from '@/Context/ThemeContext';
import { 
  FiSearch, FiX, FiLoader, FiFileText, FiPackage, FiGrid, FiUser, FiBriefcase, FiServer
} from 'react-icons/fi';
import { getAccessibleMenus } from '@/config/menus';
import { getProductsApi, getCategoryApi, getUsersApi, getCompaniesApi, getFirmsApi } from '@/api/axios';

const HeaderSearch = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchData, setSearchData] = useState({ products: [], categories: [], users: [], companies: [], firms: [] });
  const [dataFetched, setDataFetched] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const searchRef = useRef(null);

  // Close suggestions automatically when a route changes
  useEffect(() => {
    setShowSuggestions(false);
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

  const fetchAllData = useCallback(async () => {
    if (dataFetched || isLoadingData) return;
    setIsLoadingData(true);
    try {
      const [prodRes, catRes, userRes, compRes, firmRes] = await Promise.all([
        getProductsApi().catch(() => ({ data: [] })),
        getCategoryApi().catch(() => ({ data: [] })),
        getUsersApi().catch(() => ({ data: [] })),
        getCompaniesApi().catch(() => ({ data: [] })),
        getFirmsApi().catch(() => ({ data: [] }))
      ]);

      const extractList = (res) => {
        if (!res?.data) return [];
        if (Array.isArray(res.data.data)) return res.data.data;
        if (Array.isArray(res.data)) return res.data;
        return [];
      };
      
      setSearchData({
        products: extractList(prodRes),
        categories: extractList(catRes),
        users: extractList(userRes),
        companies: extractList(compRes),
        firms: extractList(firmRes)
      });
      setDataFetched(true);
    } catch (err) {
      console.error('Failed to fetch data for search', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [dataFetched, isLoadingData]);

  // Fetch data on mount so it's ready when user focuses/searches
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Filter based on search query
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
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

      if (user) {
        // 1. Search Menus/Pages
        const userMenus = getAccessibleMenus();
        const flattenMenus = [];
        userMenus.forEach(m => {
          if (!m) return;
          if (m.subMenus) {
            m.subMenus.forEach(s => flattenMenus.push({ ...s, parent: m.name }));
          } else {
            flattenMenus.push(m);
          }
        });
        
        const matchedMenus = flattenMenus.filter(m => 
          terms.every(term => m.name.toLowerCase().includes(term))
        );
        results = results.concat(matchedMenus.map(m => ({
          _id: `menu-${m.path}`,
          title: m.name,
          subtitle: m.parent ? `${m.parent} Menu` : 'Page',
          type: 'Page',
          url: m.path
        })));
      }

      // 2. Search Companies
      const matchedCompanies = searchData.companies.filter(c => {
        const text = `${c.name || ''} ${c.code || ''} ${c.description || ''}`.toLowerCase();
        return terms.every(term => text.includes(term));
      });
      results = results.concat(matchedCompanies.map(c => ({
        _id: `comp-${c._id}`,
        title: c.name,
        subtitle: `Company • Code: ${c.code || 'N/A'}`,
        type: 'Company',
        url: `/companies`
      })));

      // 3. Search Firms
      const matchedFirms = searchData.firms.filter(f => {
        const text = `${f.firmName || ''} ${f.firmCode || ''} ${f.contactPerson || ''} ${f.city || ''} ${f.phone || ''}`.toLowerCase();
        return terms.every(term => text.includes(term));
      });
      results = results.concat(matchedFirms.map(f => ({
        _id: `firm-${f._id}`,
        title: f.firmName,
        subtitle: `Firm • Code: ${f.firmCode || 'N/A'}${f.city ? ` • ${f.city}` : ''}`,
        type: 'Firm',
        url: `/firms`
      })));

      // 4. Search Products (Name, SKU, Brand, Description)
      const matchedProducts = searchData.products.filter(product => {
        const text = `${product.name || ''} ${product.sku || ''} ${product.brand || ''} ${product.description || ''}`.toLowerCase();
        return terms.every(term => text.includes(term));
      });
      results = results.concat(matchedProducts.map(p => ({
        _id: `prod-${p._id}`,
        title: p.name,
        subtitle: `Product • SKU: ${p.sku || 'N/A'}${p.brand ? ` • ${p.brand}` : ''}`,
        type: 'Product',
        url: `/products`
      })));

      // 5. Search Categories
      const matchedCategories = searchData.categories.filter(c => {
        const text = `${c.name || ''} ${c.code || ''} ${c.description || ''}`.toLowerCase();
        return terms.every(term => text.includes(term));
      });
      results = results.concat(matchedCategories.map(c => ({
        _id: `cat-${c._id}`,
        title: c.name,
        subtitle: `Category • Code: ${c.code || 'N/A'}`,
        type: 'Category',
        url: `/categories`
      })));

      // 6. Search Users
      const matchedUsers = searchData.users.filter(u => {
        const text = `${u.name || ''} ${u.firstName || ''} ${u.lastName || ''} ${u.email || ''} ${u.phone || ''} ${u.employeeCode || ''}`.toLowerCase();
        return terms.every(term => text.includes(term));
      });
      results = results.concat(matchedUsers.map(u => ({
        _id: `user-${u._id}`,
        title: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || 'User',
        subtitle: `${u.email || ''}${u.role ? ` • ${u.role}` : ''}`,
        type: 'User',
        url: `/users`
      })));

      setSearchResults(results.slice(0, 10)); // Limit to top 10 results
      setIsSearching(false);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchData, dataFetched, user, fetchAllData]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      navigate(searchResults[0].url, { state: searchResults[0].state });
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
          onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
          placeholder="Search menus, companies, firms, products, categories, users..." 
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
              ? 'bg-linear-to-br from-slate-950 to-blue-950/90 border-white/10 shadow-black/50' 
              : 'bg-white/98 border-slate-200 shadow-slate-900/10'
          }`}>
            {isSearching ? (
              <div className="p-4 text-center text-slate-400 flex items-center justify-center text-sm font-medium">
                <FiLoader className="animate-spin mr-2 text-blue-500 text-lg" /> Searching...
              </div>
            ) : searchResults.length > 0 ? (
              <ul className="max-h-80 overflow-y-auto custom-scrollbar">
                {searchResults.map((item) => {
                  let Icon = FiFileText;
                  if (item.type === 'Product') Icon = FiPackage;
                  else if (item.type === 'Company') Icon = FiBriefcase;
                  else if (item.type === 'Firm') Icon = FiServer;
                  else if (item.type === 'Category') Icon = FiGrid;
                  else if (item.type === 'User') Icon = FiUser;

                  return (
                    <li key={item._id}>
                      <Link
                        to={item.url}
                        state={item.state}
                        onClick={() => {
                          setShowSuggestions(false);
                          setSearchQuery('');
                        }}
                        className={`flex items-center gap-3 p-3 transition-colors border-b last:border-0 ${
                          isDark 
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
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/20 text-blue-600 rounded-md ml-2 shrink-0">{item.type}</span>
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