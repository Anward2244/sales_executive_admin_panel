import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FiSearch, FiPackage, FiLoader, FiAlertCircle, FiTag, FiGrid, FiFileText, FiUser, FiSend, FiShoppingBag } from 'react-icons/fi';
import { api, BASE_URL } from '@/api/axios';
import { useAuth } from '@/Context/AuthContext';
import { getAccessibleMenus } from '@/config/menus';

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
        const [prodRes, brandRes, catRes, userRes, campRes, orderRes] = await Promise.all([
          api.get('/products/').catch(() => ({ data: [] })),
          api.get('/brands/admin').catch(() => ({ data: [] })),
          api.get('/categories/admin/all').catch(() => ({ data: [] })),
          api.get('/admin/customers').catch(() => ({ data: [] })),
          api.get('/admin/campaign-stats').catch(() => ({ data: [] })),
          api.get('/orders/all').catch(() => ({ data: [] }))
        ]);

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

        // 2. Search Products (Name, Description, SKU, EAN, ID)
        const productsData = Array.isArray(prodRes.data) ? prodRes.data : [];
        const matchedProducts = productsData.filter(product => {
          const searchableText = `${product._id || ''} ${product.id || ''} ${product.name || ''} ${product.description || ''} ${product.eanNumber || ''} ${(product.variants || []).map(v => `${v.sku || ''} ${v._id || ''}`).join(' ')}`.toLowerCase();
          return terms.every(term => searchableText.includes(term));
        });
        searchResultsList = searchResultsList.concat(matchedProducts.map(p => ({
          _id: `prod-${p._id}`,
          title: p.name,
          subtitle: `SKU: ${p.variants?.[0]?.sku || 'N/A'}${p._id ? ` • ID: ${p._id}` : ''}`,
          type: 'Product',
          url: `/products/list?viewProductId=${p._id}`,
          state: { viewProductId: p._id },
          price: p.variants?.[0]?.price
        })));

        // 3. Search Brands (Name, ID, Description)
        const brandsData = Array.isArray(brandRes.data) ? brandRes.data : [];
        const matchedBrands = brandsData.filter(b => {
          const searchableText = `${b._id || ''} ${b.id || ''} ${b.name || ''} ${b.description || ''}`.toLowerCase();
          return terms.every(term => searchableText.includes(term));
        });
        searchResultsList = searchResultsList.concat(matchedBrands.map(b => ({
          _id: `brand-${b._id}`,
          title: b.name,
          subtitle: `Brand${b._id ? ` • ID: ${b._id}` : ''}`,
          type: 'Brand',
          url: `/products/brands`
        })));

        // 4. Search Categories (Name, ID, Description)
        const categoriesData = Array.isArray(catRes.data) ? catRes.data : [];
        const matchedCategories = categoriesData.filter(c => {
          const searchableText = `${c._id || ''} ${c.id || ''} ${c.name || ''} ${c.description || ''}`.toLowerCase();
          return terms.every(term => searchableText.includes(term));
        });
        searchResultsList = searchResultsList.concat(matchedCategories.map(c => ({
          _id: `cat-${c._id}`,
          title: c.name,
          subtitle: `Category${c._id ? ` • ID: ${c._id}` : ''}`,
          type: 'Category',
          url: `/products/categories`
        })));

        // 5. Search Users (Name, Email, Phone, ID, Company, GST)
        const usersData = Array.isArray(userRes.data) ? userRes.data : [];
        const matchedUsers = usersData.filter(u => {
          const searchableText = `${u._id || ''} ${u.id || ''} ${u.name || ''} ${u.email || ''} ${u.phone || ''} ${u.companyName || ''} ${u.gstNumber || ''}`.toLowerCase();
          return terms.every(term => searchableText.includes(term));
        });
        searchResultsList = searchResultsList.concat(matchedUsers.map(u => ({
          _id: `user-${u._id}`,
          title: u.name || 'No Name',
          subtitle: `${u.email || 'No Email'}${u.phone ? ` • ${u.phone}` : ''}${u._id ? ` • ID: ${u._id}` : ''}`,
          type: 'User',
          url: `/users/list/${u._id}`
        })));

        // 6. Search Campaigns (Title, Message, ID, CampaignID)
        const campaignsData = Array.isArray(campRes.data) ? campRes.data : [];
        const matchedCampaigns = campaignsData.filter(cmp => {
          const searchableText = `${cmp._id || ''} ${cmp.id || ''} ${cmp.campaignId || ''} ${cmp.title || ''} ${cmp.message || ''}`.toLowerCase();
          return terms.every(term => searchableText.includes(term));
        });
        searchResultsList = searchResultsList.concat(matchedCampaigns.map(cmp => ({
          _id: `cmp-${cmp._id || cmp.campaignId}`,
          title: cmp.title || 'Campaign',
          subtitle: `Campaign${cmp.campaignId || cmp._id ? ` • ID: ${cmp.campaignId || cmp._id}` : ''}${cmp.message ? ` • ${cmp.message}` : ''}`,
          type: 'Campaign',
          url: `/campaign-stats/${cmp._id || cmp.campaignId}`
        })));

        // 7. Search Orders (Order ID, _ID, Customer Name, Email, Phone, AWB, Status)
        const ordersData = Array.isArray(orderRes.data) ? orderRes.data : (orderRes.data?.orders || []);
        const matchedOrders = ordersData.filter(o => {
          const searchableText = `${o._id || ''} ${o.id || ''} ${o.orderId || ''} ${o.user?.name || ''} ${o.user?.email || ''} ${o.user?.phone || ''} ${o.shippingAddress?.fullName || ''} ${o.shippingAddress?.phone || ''} ${o.awbNumber || ''} ${o.orderStatus || ''}`.toLowerCase();
          return terms.every(term => searchableText.includes(term));
        });
        searchResultsList = searchResultsList.concat(matchedOrders.map(o => ({
          _id: `order-${o._id}`,
          title: `Order #${o.orderId || (o._id ? o._id.slice(-8).toUpperCase() : 'N/A')}`,
          subtitle: `${o.user?.name || o.shippingAddress?.fullName || 'Customer'} • ₹${o.totalAmount || 0} • ID: ${o._id || o.orderId}`,
          type: 'Order',
          url: `/orders/all?viewOrderId=${o._id}`,
          state: { viewOrderId: o._id }
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
                else if (item.type === 'Brand') Icon = FiTag;
                else if (item.type === 'Category') Icon = FiGrid;
                else if (item.type === 'User') Icon = FiUser;
                else if (item.type === 'Campaign') Icon = FiSend;
                else if (item.type === 'Order') Icon = FiShoppingBag;

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
                      {item.type === 'Product' && item.price !== undefined && (
                        <p className="text-sm font-bold text-emerald-600 mt-2">${item.price}</p>
                      )}
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