import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FiSearch, FiPackage, FiLoader, FiAlertCircle, FiGrid, FiFileText, FiUser, FiBriefcase, FiServer } from 'react-icons/fi';
import { useAuth } from '@/Context/AuthContext';
import { getAccessibleMenus } from '@/config/menus';
import { getProductsApi, getCategoryApi, getUsersApi, getCompaniesApi, getFirmsApi } from '@/api/axios';

const SearchResults = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);

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

        const products = extractList(prodRes);
        const categories = extractList(catRes);
        const users = extractList(userRes);
        const companies = extractList(compRes);
        const firms = extractList(firmRes);

        const terms = query.toLowerCase().trim().split(/\s+/);
        let searchResultsList = [];

        // 1. Search Menus/Pages
        if (user) {
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
          searchResultsList = searchResultsList.concat(matchedMenus.map(m => ({
            _id: `menu-${m.path}`,
            title: m.name,
            subtitle: m.parent ? `${m.parent} Menu` : 'Page',
            type: 'Page',
            url: m.path
          })));
        }

        // 2. Search Companies
        const matchedCompanies = companies.filter(c => {
          const text = `${c.name || ''} ${c.code || ''} ${c.description || ''}`.toLowerCase();
          return terms.every(term => text.includes(term));
        });
        searchResultsList = searchResultsList.concat(matchedCompanies.map(c => ({
          _id: `comp-${c._id}`,
          title: c.name,
          subtitle: `Company • Code: ${c.code || 'N/A'}`,
          type: 'Company',
          url: `/companies`
        })));

        // 3. Search Firms
        const matchedFirms = firms.filter(f => {
          const text = `${f.firmName || ''} ${f.firmCode || ''} ${f.contactPerson || ''} ${f.city || ''} ${f.phone || ''}`.toLowerCase();
          return terms.every(term => text.includes(term));
        });
        searchResultsList = searchResultsList.concat(matchedFirms.map(f => ({
          _id: `firm-${f._id}`,
          title: f.firmName,
          subtitle: `Firm • Code: ${f.firmCode || 'N/A'}${f.city ? ` • ${f.city}` : ''}`,
          type: 'Firm',
          url: `/firms`
        })));

        // 4. Search Products
        const matchedProducts = products.filter(product => {
          const text = `${product.name || ''} ${product.sku || ''} ${product.brand || ''} ${product.description || ''}`.toLowerCase();
          return terms.every(term => text.includes(term));
        });
        searchResultsList = searchResultsList.concat(matchedProducts.map(p => ({
          _id: `prod-${p._id}`,
          title: p.name,
          subtitle: `Product • SKU: ${p.sku || 'N/A'}${p.brand ? ` • ${p.brand}` : ''}`,
          type: 'Product',
          url: `/products`
        })));

        // 5. Search Categories
        const matchedCategories = categories.filter(c => {
          const text = `${c.name || ''} ${c.code || ''} ${c.description || ''}`.toLowerCase();
          return terms.every(term => text.includes(term));
        });
        searchResultsList = searchResultsList.concat(matchedCategories.map(c => ({
          _id: `cat-${c._id}`,
          title: c.name,
          subtitle: `Category • Code: ${c.code || 'N/A'}`,
          type: 'Category',
          url: `/categories`
        })));

        // 6. Search Users
        const matchedUsers = users.filter(u => {
          const text = `${u.name || ''} ${u.firstName || ''} ${u.lastName || ''} ${u.email || ''} ${u.phone || ''} ${u.employeeCode || ''}`.toLowerCase();
          return terms.every(term => text.includes(term));
        });
        searchResultsList = searchResultsList.concat(matchedUsers.map(u => ({
          _id: `user-${u._id}`,
          title: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || 'User',
          subtitle: `${u.email || ''}${u.role ? ` • ${u.role}` : ''}`,
          type: 'User',
          url: `/users`
        })));

        setResults(searchResultsList);
      } catch (err) {
        console.error('Failed to fetch search results', err);
        setError('An error occurred while fetching search results.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, user]);

  return (
    <div className="relative space-y-6 min-h-full z-0">
      {/* Header Section */}
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Search Results</h1>
        <p className="text-slate-400 font-medium">
          Showing results for: <span className="text-blue-500 font-bold">"{query}"</span>
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-20 bg-transparent backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50 rounded-3xl">
          <FiLoader className="animate-spin text-4xl text-blue-600" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex flex-col items-center justify-center py-20 bg-transparent backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50 rounded-3xl text-red-400">
          <FiAlertCircle className="text-4xl mb-4" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Results List */}
      {!loading && !error && (
        <div className="bg-linear-to-br from-slate-950 to-blue-950/65 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50 rounded-3xl p-6">
          {results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {results.map((item) => {
                let Icon = FiFileText;
                if (item.type === 'Product') Icon = FiPackage;
                else if (item.type === 'Company') Icon = FiBriefcase;
                else if (item.type === 'Firm') Icon = FiServer;
                else if (item.type === 'Category') Icon = FiGrid;
                else if (item.type === 'User') Icon = FiUser;

                return (
                  <Link
                    key={item._id}
                    to={item.url}
                    state={item.state}
                    className="flex items-start gap-4 p-4 rounded-2xl border border-white/10 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/20 transition-all bg-black/20 group cursor-pointer"
                  >
                    <div className="w-16 h-16 shrink-0 bg-transparent rounded-xl border border-white/10 flex items-center justify-center overflow-hidden">
                      <Icon className="text-2xl text-slate-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-0.5">
                        <h3 className="font-bold text-white truncate group-hover:text-blue-400 transition-colors">{item.title}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-md shrink-0">{item.type}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-400 mt-1">{item.subtitle}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <FiSearch className="text-5xl text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-1">No results found</h3>
              <p className="text-slate-500">We couldn't find anything matching "{query}". Try adjusting your search.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchResults;