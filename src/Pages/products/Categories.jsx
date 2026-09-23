import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FiGrid, FiPlus, FiEdit2, FiTrash2, FiSave, FiX,
  FiAlertCircle, FiCheckCircle, FiTag, FiLoader,
  FiSearch, FiRefreshCcw, FiInfo, FiLayers, FiCheck
} from 'react-icons/fi';
import {
  api,
  getCategoryApi,
  createCategoryApi,
  getCategoryByIdApi,
  updateCategoryApi,
  deleteCategoryApi
} from '@/api/axios';
import { formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import CopyButton from '@/components/ui/CopyButton';
import PageHeader from '@/components/ui/PageHeader';
import { useDisplayPreferences } from '@/utils/displayPreferences';

const INITIAL_FORM_STATE = {
  name: '',
  code: '',
  description: '',
  isActive: true
};

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [paginationMeta, setPaginationMeta] = useState(null);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState(false);

  // Filter & Pagination State
  const { preferences: displayPrefs } = useDisplayPreferences();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = displayPrefs.rowsPerPage || 10;

  // Feedback & Modal States
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: '' }
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [typedConfirmName, setTypedConfirmName] = useState('');

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Fetch Categories & Product counts
  const fetchCategories = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [categoryResponse, productsResponse] = await Promise.all([
        getCategoryApi(),
        api.get('/products/').catch(() => ({ data: [] }))
      ]);

      const resData = categoryResponse?.data || {};
      const list = Array.isArray(resData.data)
        ? resData.data
        : Array.isArray(resData)
          ? resData
          : [];

      setCategories(list);
      if (resData.meta) {
        setPaginationMeta(resData.meta);
      }

      // Map product counts per category
      const rawProducts = Array.isArray(productsResponse?.data?.data)
        ? productsResponse.data.data
        : Array.isArray(productsResponse?.data)
          ? productsResponse.data
          : [];

      const counts = {};
      rawProducts.forEach((prod) => {
        const catId = prod?.category?._id || prod?.category || prod?.categoryId;
        if (catId) {
          counts[catId] = (counts[catId] || 0) + 1;
        }
      });
      setCategoryCounts(counts);
    } catch (err) {
      console.error('Failed to load categories:', err);
      showToast('error', err.response?.data?.message || 'Failed to load categories.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Handle auto code suggestion while typing category name in Add mode
  const handleNameChange = (e) => {
    const val = e.target.value;
    if (!editingId && !isCodeManuallyEdited) {
      const autoCode = val
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      setFormData((prev) => ({ ...prev, name: val, code: autoCode }));
    } else {
      setFormData((prev) => ({ ...prev, name: val }));
    }
    if (formError) setFormError('');
  };

  const handleCodeChange = (e) => {
    setIsCodeManuallyEdited(true);
    setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s+/g, '_') }));
    if (formError) setFormError('');
  };

  // Start editing a category
  const handleEdit = async (category) => {
    setEditingId(category._id);
    setFormError('');
    setIsCodeManuallyEdited(true);

    // Initial prefill from row data
    setFormData({
      name: category.name || '',
      code: category.code || '',
      description: category.description || '',
      isActive: category.isActive !== false
    });

    // Fetch freshest single-record data from GET /categories/{id}
    try {
      const response = await getCategoryByIdApi(category._id);
      const catData = response?.data?.data || response?.data;
      if (catData) {
        setFormData({
          name: catData.name || '',
          code: catData.code || '',
          description: catData.description || '',
          isActive: catData.isActive !== false
        });
      }
    } catch (err) {
      console.warn('GET /categories/:id note, using row data:', err);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM_STATE);
    setFormError('');
    setIsCodeManuallyEdited(false);
  };

  // Submit Category (POST create / PATCH update)
  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedName = formData.name.trim();
    const trimmedCode = (formData.code || '').trim().toUpperCase();
    const trimmedDesc = (formData.description || '').trim();

    if (!trimmedName) {
      setFormError('Category name is required.');
      return;
    }
    if (!trimmedCode) {
      setFormError('Category code is required (e.g. SPEAKERS, CHARGERS).');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const payload = {
      name: trimmedName,
      code: trimmedCode,
      description: trimmedDesc,
      isActive: Boolean(formData.isActive)
    };

    try {
      if (editingId) {
        await updateCategoryApi(editingId, payload);
        showToast('success', `Category "${trimmedName}" updated successfully.`);
      } else {
        await createCategoryApi(payload);
        showToast('success', `Category "${trimmedName}" created successfully.`);
      }
      cancelEdit();
      await fetchCategories(true);
    } catch (err) {
      console.error('Failed to save category:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to save category.';
      setFormError(msg);
      showToast('error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Category (DELETE /categories/{id})
  const handleDelete = async (id) => {
    setActionLoadingId(id);
    try {
      await deleteCategoryApi(id);
      setCategories((prev) => prev.filter((c) => c._id !== id));
      showToast('success', 'Category deleted successfully.');
      if (editingId === id) {
        cancelEdit();
      }
    } catch (err) {
      console.error('Failed to delete category:', err);
      showToast('error', err.response?.data?.message || 'Failed to delete category.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter categories by search keyword and status
  const filteredCategories = useMemo(() => {
    return categories.filter((category) => {
      const matchSearch =
        searchTerm === '' ||
        (category.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (category.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (category.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (category._id || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && category.isActive !== false) ||
        (statusFilter === 'inactive' && category.isActive === false);

      return matchSearch && matchStatus;
    });
  }, [categories, searchTerm, statusFilter]);

  // Tab counts
  const countsByTab = useMemo(() => {
    let active = 0;
    let inactive = 0;
    categories.forEach((c) => {
      if (c.isActive !== false) active++;
      else inactive++;
    });
    return { all: categories.length, active, inactive };
  }, [categories]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCategories = filteredCategories.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all animate-in fade-in slide-in-from-top-4 ${
            toast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <FiCheckCircle className="text-xl text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <FiAlertCircle className="text-xl text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span className="text-sm font-bold">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <FiX size={16} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Category Management"
        subtitle="Create, edit, and organize product categories with unique SKU codes."
        badgeText={`${categories.length} Categories`}
        badgeIcon={FiGrid}
        actions={
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="text"
                placeholder="Search category name, code, ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-9 py-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white placeholder-slate-400 font-medium shadow-xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <FiX size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => fetchCategories(true)}
              disabled={refreshing || loading}
              className="p-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:border-blue-500/40 transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
              title="Refresh categories"
            >
              <FiRefreshCcw className={`text-base ${refreshing ? 'animate-spin text-blue-500' : ''}`} />
            </button>
          </div>
        }
      />

      {/* Main Grid: Form (Left) & Categories List (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Create / Edit Form Card */}
        <div className="lg:col-span-4">
          <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-xl rounded-3xl p-6 transition-all">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                    editingId
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                  }`}
                >
                  {editingId ? <FiEdit2 /> : <FiPlus />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingId ? 'Edit Category' : 'Add New Category'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingId ? 'Modify category properties' : 'Register a new product classification'}
                  </p>
                </div>
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Form Error Alert */}
            {formError && (
              <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2.5">
                <FiAlertCircle className="text-base shrink-0 mt-0.5 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleNameChange}
                  placeholder="e.g. Bluetooth Speakers, Power Banks"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm font-medium placeholder-slate-400 transition-all"
                />
              </div>

              {/* Category Code */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Category Code <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">UPPERCASE</span>
                </div>
                <div className="relative">
                  <FiTag className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={handleCodeChange}
                    placeholder="e.g. SPEAKERS, POWERBANKS"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono text-sm uppercase placeholder-slate-400 transition-all font-bold"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Unique short identifier used for grouping & SKUs.</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief details regarding items in this category..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm placeholder-slate-400 transition-all resize-none"
                />
              </div>

              {/* Active Toggle */}
              <div className="pt-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Status
                </label>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-white block">
                      {formData.isActive ? 'Active Category' : 'Inactive Category'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formData.isActive
                        ? 'Available for products and catalog queries'
                        : 'Hidden from active product assignments'}
                    </span>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <div className="relative w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex gap-2.5">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                >
                  {isSubmitting ? (
                    <FiLoader className="animate-spin text-base" />
                  ) : editingId ? (
                    <FiSave className="text-base" />
                  ) : (
                    <FiPlus className="text-base" />
                  )}
                  <span>{isSubmitting ? 'Saving...' : editingId ? 'Update Category' : 'Add Category'}</span>
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isSubmitting}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all text-sm cursor-pointer"
                    title="Cancel Edit"
                  >
                    <FiX size={16} />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Categories List & Filter Table */}
        <div className="lg:col-span-8 space-y-4">
          {/* Action and Filter Toolbar */}
          <div className="flex items-center justify-between bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: 'All', count: countsByTab.all },
                { id: 'active', label: 'Active', count: countsByTab.active },
                { id: 'inactive', label: 'Inactive', count: countsByTab.inactive }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-slate-100/40 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/10">
                    <th className="px-4 py-3.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider w-12 text-center">
                      S.No.
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Category & Code
                    </th>
                    <th className="px-4 py-3.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-3 py-3.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-center">
                      Products
                    </th>
                    <th className="px-4 py-3.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-center">
                      Status
                    </th>
                    <th className="px-4 py-3.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Timestamps
                    </th>
                    <th className="px-4 py-3.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-white/5 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-14 text-center text-slate-500 dark:text-slate-400 font-medium">
                        <FiLoader className="animate-spin text-3xl mx-auto mb-3 text-blue-500 dark:text-blue-400" />
                        <span>Loading category data...</span>
                      </td>
                    </tr>
                  ) : currentCategories.length > 0 ? (
                    currentCategories.map((category, index) => {
                      const isRowEditing = editingId === category._id;
                      const productCount = categoryCounts[category._id] || 0;

                      return (
                        <tr
                          key={category._id || index}
                          className={`hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors ${
                            isRowEditing ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                          }`}
                        >
                          {/* S.No */}
                          <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400 font-mono font-medium">
                            {indexOfFirstItem + index + 1}
                          </td>

                          {/* Category Name & Code */}
                          <td className="px-5 py-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                  {category.name}
                                </span>
                                {category.code && (
                                  <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                                    {category.code}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                                <span>{category._id}</span>
                                <CopyButton text={category._id} />
                              </div>
                            </div>
                          </td>

                          {/* Description */}
                          <td className="px-4 py-3 max-w-xs">
                            <p className="text-xs text-slate-600 dark:text-slate-300 truncate" title={category.description}>
                              {category.description || '—'}
                            </p>
                          </td>

                          {/* Products Count */}
                          <td className="px-3 py-3 text-center">
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
                              <FiLayers className="text-blue-500 text-[11px]" />
                              <span>{productCount}</span>
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                category.isActive !== false
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                                  : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  category.isActive !== false ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              <span>{category.isActive !== false ? 'ACTIVE' : 'INACTIVE'}</span>
                            </span>
                          </td>

                          {/* Timestamps */}
                          <td className="px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400">
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Created:</span>{' '}
                              {formatDateTimeDDMMYYYY(category.createdAt)}
                            </div>
                            {category.updatedAt && category.updatedAt !== category.createdAt && (
                              <div className="text-[10px] text-slate-400">
                                <span className="font-semibold">Updated:</span>{' '}
                                {formatDateTimeDDMMYYYY(category.updatedAt)}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => handleEdit(category)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isRowEditing
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10'
                                }`}
                                title="Edit Category"
                              >
                                <FiEdit2 className="text-sm" />
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                disabled={actionLoadingId === category._id}
                                onClick={() => {
                                  setCategoryToDelete(category);
                                  setTypedConfirmName('');
                                  setDeleteConfirmOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                                title="Delete Category"
                              >
                                {actionLoadingId === category._id ? (
                                  <FiLoader className="text-sm animate-spin text-rose-500" />
                                ) : (
                                  <FiTrash2 className="text-sm" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-14 text-center text-slate-500 dark:text-slate-400">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-3 text-slate-400">
                          <FiGrid className="text-xl" />
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">No categories found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {searchTerm || statusFilter !== 'all'
                            ? 'No categories match your filter criteria. Try clearing your search.'
                            : 'No product categories have been added yet. Use the form on the left to add one.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {!loading && filteredCategories.length > 0 && (
              <div className="p-4 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/50 dark:bg-white/[0.01]">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Showing <strong className="text-slate-800 dark:text-white">{indexOfFirstItem + 1}</strong> to{' '}
                  <strong className="text-slate-800 dark:text-white">
                    {Math.min(indexOfLastItem, filteredCategories.length)}
                  </strong>{' '}
                  of <strong className="text-slate-800 dark:text-white">{filteredCategories.length}</strong> categories
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-8 h-8 px-2 rounded-xl text-xs font-bold transition-all ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && categoryToDelete && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 dark:bg-slate-950/50 backdrop-blur-lg animate-fade-in"
            onClick={() => {
              setDeleteConfirmOpen(false);
              setCategoryToDelete(null);
              setTypedConfirmName('');
            }}
          />
          <div className="relative bg-white/40 dark:bg-slate-950 border border-red-200 dark:border-red-500/20 rounded-3xl p-6 shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
              <FiTrash2 className="text-xl" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">
              Confirm Category Deletion
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              This action will permanently delete{' '}
              <strong className="text-slate-800 dark:text-white">"{categoryToDelete.name}"</strong> (
              <span className="font-mono text-blue-600 dark:text-blue-400">{categoryToDelete.code}</span>). To confirm, please type the category name below:
            </p>

            <input
              type="text"
              placeholder={`Type "${categoryToDelete.name}" to confirm`}
              value={typedConfirmName}
              onChange={(e) => setTypedConfirmName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/30 text-sm font-medium mb-5 placeholder-slate-400"
            />

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setCategoryToDelete(null);
                  setTypedConfirmName('');
                }}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={typedConfirmName !== categoryToDelete.name || actionLoadingId === categoryToDelete._id}
                onClick={() => {
                  const targetId = categoryToDelete._id;
                  setDeleteConfirmOpen(false);
                  setCategoryToDelete(null);
                  setTypedConfirmName('');
                  handleDelete(targetId);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-rose-600/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {actionLoadingId === categoryToDelete._id ? (
                  <FiLoader className="animate-spin text-base" />
                ) : (
                  <FiTrash2 className="text-base" />
                )}
                <span>Delete Category</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Categories;
