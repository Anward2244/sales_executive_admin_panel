import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiX,
  FiSave,
  FiPackage,
  FiEye,
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiDownload,
  FiTag,
  FiLayers,
  FiDollarSign,
  FiImage,
  FiCopy,
  FiCheck,
  FiFilter,
  FiArrowUpRight,
  FiChevronRight,
  FiChevronDown,
  FiFileText,
  FiShoppingBag,
  FiUploadCloud
} from 'react-icons/fi';
import BulkProductImportModal, { downloadProductExcelTemplate } from './BulkProductImportModal';
import { BiRupee } from 'react-icons/bi';
import PageHeader from '@/components/ui/PageHeader';
import Skeleton from '@/components/ui/Skeleton';
import CopyButton from '@/components/ui/CopyButton';
import {
  getProductsApi,
  createProductApi,
  updateProductApi,
  deleteProductApi,
  getCategoryApi
} from '@/api/axios';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import { getImageUrl } from '@/utils/imageUtils';

// Helper to format currency in Indian Rupees (INR)
const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
};

// Initial form state for Add/Edit product
const INITIAL_PRODUCT_FORM = {
  name: '',
  sku: '',
  categoryId: '',
  brand: 'Whatnot',
  unit: 'PCS',
  description: '',
  isActive: true
};

const Products = () => {
  // Data States
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'name-asc'

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Modal & Dropdown States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const actionsDropdownRef = useRef(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(INITIAL_PRODUCT_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Details Modal & Delete Confirm Modal
  const [detailsProduct, setDetailsProduct] = useState(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Toast State
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleImportComplete = (count) => {
    fetchData(true);
    showToast(`Successfully imported ${count} products into catalog!`);
  };

  // Close Actions Dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(e.target)) {
        setIsActionsOpen(false);
      }
    };
    if (isActionsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isActionsOpen]);

  // Fetch products & categories
  const fetchData = useCallback(async (isSilent = false) => {
    if (isSilent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [prodRes, catRes] = await Promise.all([
        getProductsApi(),
        getCategoryApi().catch(() => ({ data: [] }))
      ]);

      const prodData = prodRes?.data?.data || (Array.isArray(prodRes?.data) ? prodRes?.data : []);
      const prodMeta = prodRes?.data?.meta || null;
      const catData = catRes?.data?.data || (Array.isArray(catRes?.data) ? catRes?.data : []);

      setProducts(prodData);
      setMeta(prodMeta);
      setCategories(catData);
    } catch (err) {
      console.error('Failed to load products:', err);
      setError(err.response?.data?.message || 'Failed to fetch catalog products. Please check network connectivity.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive unique brands
  const uniqueBrands = useMemo(() => {
    const brandsSet = new Set();
    products.forEach((p) => {
      if (p.brand && typeof p.brand === 'string') {
        brandsSet.add(p.brand.trim());
      }
    });
    return Array.from(brandsSet).sort();
  }, [products]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        // Status Filter
        if (selectedStatusFilter === 'ACTIVE' && !product.isActive) return false;
        if (selectedStatusFilter === 'INACTIVE' && product.isActive) return false;

        // Category Filter
        if (selectedCategoryFilter !== 'ALL') {
          const pCatId = typeof product.categoryId === 'object' ? product.categoryId?._id : product.categoryId;
          if (pCatId !== selectedCategoryFilter) return false;
        }

        // Brand Filter
        if (selectedBrandFilter !== 'ALL') {
          if (product.brand !== selectedBrandFilter) return false;
        }

        // Search Query (name, sku, brand, description, category name)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const name = String(product.name || '').toLowerCase();
          const sku = String(product.sku || '').toLowerCase();
          const brand = String(product.brand || '').toLowerCase();
          const desc = String(product.description || '').toLowerCase();
          const catName = typeof product.categoryId === 'object' ? String(product.categoryId?.name || '').toLowerCase() : '';
          return name.includes(q) || sku.includes(q) || brand.includes(q) || desc.includes(q) || catName.includes(q);
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name-asc') return String(a.name || '').localeCompare(String(b.name || ''));
        if (sortBy === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        // Default: newest
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [products, searchQuery, selectedCategoryFilter, selectedBrandFilter, selectedStatusFilter, sortBy]);

  // Product count statistics
  const { activeCount, inactiveCount } = useMemo(() => {
    let active = 0;
    let inactive = 0;
    products.forEach((p) => {
      if (p.isActive) active++;
      else inactive++;
    });
    return { activeCount: active, inactiveCount: inactive };
  }, [products]);

  // Reset pagination on filter, search, or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategoryFilter, selectedBrandFilter, selectedStatusFilter, sortBy, itemsPerPage]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(indexOfFirstItem, indexOfLastItem);
  }, [filteredProducts, indexOfFirstItem, indexOfLastItem]);

  const paginationPages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }, [totalPages, currentPage]);

  // Open Modal for Add
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      ...INITIAL_PRODUCT_FORM,
      categoryId: categories.length > 0 ? categories[0]._id : ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (product, e) => {
    if (e) e.stopPropagation();
    setEditingProduct(product);
    const catId = typeof product.categoryId === 'object' ? product.categoryId?._id : (product.categoryId || '');
    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      categoryId: catId,
      brand: product.brand || 'Whatnot',
      unit: product.unit || 'PCS',
      description: product.description || '',
      isActive: product.isActive !== undefined ? Boolean(product.isActive) : true
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Auto-generate SKU from name
  const handleNameChange = (nameVal) => {
    const updated = { ...formData, name: nameVal };
    if (!editingProduct && !formData.skuManual) {
      // Auto slugify SKU: e.g. "Whatnot NitroCharge 65W" -> "WNOT-NITRO-001"
      const prefix = (formData.brand || 'WNOT').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      const namePart = nameVal
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .join('-');
      if (namePart) {
        updated.sku = `${prefix}-${namePart}`.slice(0, 15);
      }
    }
    setFormData(updated);
  };

  // Save Product (Create or Update)
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Product name is required.');
      return;
    }
    if (!formData.sku.trim()) {
      setFormError('Product SKU code is required.');
      return;
    }
    if (!formData.categoryId) {
      setFormError('Please select a category.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim().toUpperCase(),
        categoryId: formData.categoryId,
        description: formData.description.trim(),
        brand: formData.brand.trim() || 'Whatnot',
        unit: formData.unit.trim() || 'PCS',
        isActive: Boolean(formData.isActive)
      };

      if (editingProduct) {
        const res = await updateProductApi(editingProduct._id, payload);
        const updated = res.data?.data || res.data || { ...editingProduct, ...payload };
        setProducts((prev) =>
          prev.map((p) => (p._id === editingProduct._id ? { ...p, ...updated } : p))
        );
        showToast(`Product "${payload.name}" updated successfully!`);
      } else {
        const res = await createProductApi(payload);
        const created = res.data?.data || res.data;
        if (created) {
          setProducts((prev) => [created, ...prev]);
        } else {
          await fetchData(true);
        }
        showToast(`Product "${payload.name}" created successfully!`);
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save product:', err);
      setFormError(err.response?.data?.message || 'Failed to save product. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  // Delete Product
  const handleDeleteProduct = async () => {
    if (!deleteConfirmProduct) return;
    setDeleting(true);
    try {
      await deleteProductApi(deleteConfirmProduct._id);
      setProducts((prev) => prev.filter((p) => p._id !== deleteConfirmProduct._id));
      showToast(`Product "${deleteConfirmProduct.name}" removed from catalog.`);
      setDeleteConfirmProduct(null);
      if (detailsProduct?._id === deleteConfirmProduct._id) {
        setDetailsProduct(null);
      }
    } catch (err) {
      console.error('Failed to delete product:', err);
      alert(err.response?.data?.message || 'Failed to delete product.');
    } finally {
      setDeleting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredProducts.length) return;
    const headers = ['Product Name', 'SKU', 'Brand', 'Category', 'Unit', 'Status', 'Date Added'];
    const rows = [headers];
    filteredProducts.forEach((p) => {
      const catName = typeof p.categoryId === 'object' ? p.categoryId?.name : '';
      rows.push([
        p.name || '',
        p.sku || '',
        p.brand || '',
        catName || '',
        p.unit || 'PCS',
        p.isActive ? 'Active' : 'Inactive',
        p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : ''
      ]);
    });

    const processRow = (row) =>
      row
        .map((val) => {
          let str = val === null || val === undefined ? '' : String(val);
          str = str.replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',');

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(processRow).join('\r\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `products_catalog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xl border border-slate-700/50 dark:border-slate-200 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <FiCheckCircle className="text-emerald-500 text-lg shrink-0" />
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Products Catalog"
        subtitle="Manage hardware inventory, pricing tiers, SKU configurations, and brand collections."
        badgeText={`${products.length} Products`}
        badgeIcon={FiPackage}
        actions={
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, SKU, or brand..."
                className="w-full pl-9 pr-8 py-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <FiX size={12} />
                </button>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={loading || refreshing}
              title="Refresh Products"
              className="p-2.5 bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:border-blue-500/40 transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
            >
              <FiRefreshCw className={`text-base ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        }
      />

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FiAlertCircle className="text-xl shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Actions & Filters Bar */}
      <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-4 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {/* Actions Dropdown */}
          <div className="relative" ref={actionsDropdownRef}>
            <button
              type="button"
              onClick={() => setIsActionsOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-white/10 hover:border-blue-500/40 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer active:scale-95"
            >
              <span>Actions</span>
              <FiChevronDown className={`text-xs transition-transform duration-200 ${isActionsOpen ? 'rotate-180' : ''}`} />
            </button>

            {isActionsOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Option 1: Import Products via Excel */}
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsOpen(false);
                    setIsImportModalOpen(true);
                  }}
                  className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 text-left transition-colors cursor-pointer group"
                >
                  <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors shrink-0">
                    <FiUploadCloud className="text-base" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      Import Products
                    </div>
                    <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                      Bulk import via Excel or CSV
                    </div>
                  </div>
                </button>

                {/* Option 2: Download Sample File */}
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsOpen(false);
                    downloadProductExcelTemplate(categories);
                    showToast('Sample Excel template downloaded.');
                  }}
                  className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-blue-50/80 dark:hover:bg-blue-950/30 text-left transition-colors cursor-pointer group"
                >
                  <span className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                    <FiFileText className="text-base" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Download Sample File
                    </div>
                    <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                      Pre-formatted .xlsx with categories
                    </div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-white/5" />

                {/* Option 3: Export Catalog CSV */}
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsOpen(false);
                    handleExportCSV();
                  }}
                  disabled={products.length === 0}
                  className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-left transition-colors cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 group-hover:bg-slate-700 group-hover:text-white transition-colors shrink-0">
                    <FiDownload className="text-base" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Export Catalog CSV
                    </div>
                    <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                      Download current inventory list
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Add Product Button */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/25 cursor-pointer active:scale-95"
          >
            <FiPlus className="text-base" />
            <span>Add Product</span>
          </button>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          {/* Category Filter */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Brand Filter */}
          {uniqueBrands.length > 0 && (
            <select
              value={selectedBrandFilter}
              onChange={(e) => setSelectedBrandFilter(e.target.value)}
              className="px-3 py-2 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Brands</option>
              {uniqueBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
          >
            <option value="newest">Newest Added</option>
            <option value="oldest">Oldest First</option>
            <option value="name-asc">Name: A to Z</option>
          </select>

          {/* Reset Filters */}
          {(searchQuery || selectedCategoryFilter !== 'ALL' || selectedBrandFilter !== 'ALL' || selectedStatusFilter !== 'ALL' || sortBy !== 'newest') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategoryFilter('ALL');
                setSelectedBrandFilter('ALL');
                setSelectedStatusFilter('ALL');
                setSortBy('newest');
              }}
              className="px-2.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Product Counts & Summary Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-800 dark:text-slate-200">
            Total: {products.length} products
          </span>
          <span className="inline-block w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {activeCount} Active
          </span>
          <span className="inline-block w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
          <span className="text-slate-500 font-semibold">
            {inactiveCount} Inactive
          </span>
          {filteredProducts.length !== products.length && (
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-bold">
              {filteredProducts.length} filtered
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white/40 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-200/80 dark:border-white/10 space-y-3">
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4 rounded-lg" />
              <Skeleton className="h-3 w-1/2 rounded-lg" />
              <Skeleton className="h-6 w-1/3 rounded-lg" />
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-20 text-center bg-white/60 dark:bg-slate-900/40 rounded-3xl border border-slate-200/80 dark:border-white/10 p-8">
          <FiPackage className="text-4xl text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No products found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery || selectedCategoryFilter !== 'ALL' || selectedBrandFilter !== 'ALL' || selectedStatusFilter !== 'ALL'
              ? 'No products match your current search filters. Try clearing some filters.'
              : 'There are currently no products registered in your catalog.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-600/25"
            >
              <FiUploadCloud />
              <span>Import via Excel</span>
            </button>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-600/25"
            >
              <FiPlus />
              <span>Add First Product</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white/20 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-200/60 dark:border-white/5">
                <tr>
                  <th className="py-3 px-4 text-center w-16">S.No.</th>
                  <th className="py-3 px-4">Product Details</th>
                  <th className="py-3 px-4">Brand</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Unit</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                {paginatedProducts.map((product, idx) => {
                  const catName = typeof product.categoryId === 'object' ? product.categoryId?.name : '';
                  const serialNumber = indexOfFirstItem + idx + 1;

                  return (
                    <tr
                      key={product._id}
                      onClick={() => setDetailsProduct(product)}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      {/* S.No. */}
                      <td className="py-3.5 px-4 text-center font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {serialNumber}
                      </td>

                      {/* Product Name & SKU */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                            <FiPackage className="text-base" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-xs max-w-sm line-clamp-1">
                              {product.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5" onClick={(e) => e.stopPropagation()}>
                              <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                {product.sku}
                              </span>
                              <CopyButton text={product.sku} />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Brand */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                          {product.brand || 'N/A'}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {catName || 'Unassigned'}
                        </span>
                      </td>

                      {/* Unit */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                          {product.unit || 'PCS'}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {product.description || '—'}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            product.isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                          }`}
                        >
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEdit(product, e)}
                            className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <FiEdit2 className="text-sm" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmProduct(product);
                            }}
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <FiTrash2 className="text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= PAGINATION CONTROLS ================= */}
      {!loading && filteredProducts.length > 0 && (
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl p-4 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            Showing <strong className="text-slate-900 dark:text-white font-bold">{indexOfFirstItem + 1}</strong> to{' '}
            <strong className="text-slate-900 dark:text-white font-bold">{Math.min(indexOfLastItem, filteredProducts.length)}</strong> of{' '}
            <strong className="text-slate-900 dark:text-white font-bold">{filteredProducts.length}</strong> products
            {filteredProducts.length !== products.length && (
              <span className="ml-1 text-slate-400">(Filtered from {products.length} total)</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              Previous
            </button>

            <div className="flex gap-1 items-center">
              {paginationPages.map((page, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    if (page !== '...') setCurrentPage(page);
                  }}
                  disabled={page === '...'}
                  className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-xl text-xs font-bold transition-all ${
                    page === currentPage
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                      : page === '...'
                      ? 'bg-transparent text-slate-400 dark:text-slate-500 cursor-default'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white cursor-pointer border border-transparent hover:border-slate-200/80 dark:hover:border-white/10'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ================= ADD / EDIT PRODUCT MODAL ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 dark:bg-slate-950/50 backdrop-blur-lg animate-in fade-in duration-200">
          <div className="bg-white/60 dark:bg-slate-950/25 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                  {editingProduct ? <FiEdit2 className="text-xl" /> : <FiPlus className="text-xl" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingProduct ? 'Edit Catalog Product' : 'Add New Product'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingProduct ? 'Update product specifications and pricing.' : 'Register a new hardware item into the catalog.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2">
                  <FiAlertCircle className="text-base shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Auric BoomBox IPX7 Waterproof Portable Speaker"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
                  required
                />
              </div>

              {/* SKU & Brand Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value, skuManual: true })}
                    placeholder="e.g. AURIC-SPK-010"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Brand Name *
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g. Auric or Whatnot"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
                    required
                  />
                </div>
              </div>

              {/* Category & Unit Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} {c.code ? `(${c.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Unit of Measure *
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g. PCS, BOX, SET"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden uppercase"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Product Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Ultra-compact 65W GaN adapter"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden resize-none"
                />
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Catalog Active Status</div>
                  <div className="text-[11px] text-slate-400">
                    Active products appear in company sales executive order forms.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    formData.isActive ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      formData.isActive ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-600/25 cursor-pointer disabled:opacity-50"
                >
                  <FiSave className="text-sm" />
                  <span>{submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= PRODUCT DETAILS MODAL ================= */}
      {detailsProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 dark:bg-slate-950/50 backdrop-blur-lg animate-in fade-in duration-200">
          <div className="bg-white/60 dark:bg-slate-950/25 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                  <FiPackage className="text-xl" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">
                    {detailsProduct.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs text-slate-400">{detailsProduct.sku}</span>
                    <CopyButton text={detailsProduct.sku} />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailsProduct(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Grid Specifications */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-white/5">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Brand</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {detailsProduct.brand || 'Whatnot'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Category</span>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {typeof detailsProduct.categoryId === 'object'
                      ? detailsProduct.categoryId?.name
                      : 'Unassigned'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unit</span>
                  <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">
                    {detailsProduct.unit || 'PCS'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold mt-0.5 ${
                      detailsProduct.isActive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {detailsProduct.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200/60 dark:border-white/5">
                  {detailsProduct.description || 'No detailed description provided for this catalog product.'}
                </p>
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-200 dark:border-white/10">
                <span>Added: {formatDateTimeDDMMYYYY(detailsProduct.createdAt)}</span>
                <span>Last Updated: {formatDateTimeDDMMYYYY(detailsProduct.updatedAt)}</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const toDelete = detailsProduct;
                  setDetailsProduct(null);
                  setDeleteConfirmProduct(toDelete);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                <FiTrash2 />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailsProduct(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = detailsProduct;
                    setDetailsProduct(null);
                    handleOpenEdit(toEdit);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-600/25 cursor-pointer"
                >
                  <FiEdit2 />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRM MODAL ================= */}
      {deleteConfirmProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 dark:bg-slate-950/50 backdrop-blur-lg animate-in fade-in duration-200">
          <div className="bg-white/40 dark:bg-slate-950/25 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center text-2xl mb-4">
              <FiTrash2 />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Catalog Product?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-slate-200">"{deleteConfirmProduct.name}"</span>? This will permanently remove the product from the catalog.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmProduct(null)}
                disabled={deleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-rose-600/25 cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= BULK EXCEL IMPORT MODAL ================= */}
      <BulkProductImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        categories={categories}
        existingProducts={products}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
};

export default Products;