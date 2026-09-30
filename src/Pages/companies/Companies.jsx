import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  FiBriefcase,
  FiPlus,
  FiSearch,
  FiRefreshCcw,
  FiCheckCircle,
  FiXCircle,
  FiCalendar,
  FiAlertCircle,
  FiTag,
  FiLoader,
  FiX,
  FiImage,
  FiEye,
  FiTrash2,
  FiEdit2,
  FiClock,
  FiExternalLink
} from 'react-icons/fi';
import {
  getCompaniesApi,
  createCompanyApi,
  deleteCompanyApi,
  updateCompanyApi,
  getCompanyByIdApi
} from '@/api/axios';
import { useDisplayPreferences } from '@/utils/displayPreferences';
import { useConfirm } from '@/Context/ConfirmationContext';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import PageHeader from '@/components/ui/PageHeader';
import CopyButton from '@/components/ui/CopyButton';
import { useDebounce } from '@/hooks/useDebounce';
import { formatEntityCode } from '@/utils/formatters';
import { validateEntityCode } from '@/utils/validators';

const INITIAL_FORM = {
  name: '',
  code: '',
  description: '',
  logo: '',
  isActive: true
};

const Companies = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeCompanyId } = useParams();
  const { confirm: confirmDialog, showAlert } = useConfirm() || {};

  const [companies, setCompanies] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [imageErrorMap, setImageErrorMap] = useState({});

  // Action / Delete State
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Slide-Over Drawer State (Details & Edits)
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [drawerMode, setDrawerMode] = useState('details'); // 'details' | 'edit'
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [editFormData, setEditFormData] = useState(INITIAL_FORM);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  useEffect(() => {
    if (location.state?.toastMessage) {
      setSuccessToast(location.state.toastMessage);
      window.history.replaceState({}, document.title);
      const timer = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  const handleDeleteCompany = async (company) => {
    if (!company) return;
    const targetId = company._id;
    const message = `Are you sure you want to permanently delete company "${company.name}" (${company.code || targetId})? This action cannot be undone.`;

    let isConfirmed = false;
    if (confirmDialog) {
      isConfirmed = await confirmDialog(message);
    } else {
      isConfirmed = window.confirm(message);
    }
    if (!isConfirmed) return;

    setActionLoadingId(targetId);
    try {
      await deleteCompanyApi(targetId);
      setCompanies((prev) => prev.filter((c) => c._id !== targetId));
      if (selectedCompany?._id === targetId) {
        setIsDrawerOpen(false);
        setSelectedCompany(null);
        if (routeCompanyId) {
          navigate('/companies', { replace: true });
        }
      }
      setSuccessToast(`Company "${company.name}" deleted successfully!`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error('Delete company error:', err);
      const errMessage = err.response?.data?.message || err.message || 'Failed to delete company.';
      if (showAlert) {
        showAlert(errMessage, 'error');
      } else {
        alert(errMessage);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenDrawer = (company, mode = 'details') => {
    setSelectedCompany(company);
    setDrawerMode(mode);
    setEditFormData({
      name: company.name || '',
      code: company.code || '',
      description: company.description || '',
      logo: company.logo || '',
      isActive: Boolean(company.isActive)
    });
    setEditError(null);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    if (editSubmitting) return;
    setIsDrawerOpen(false);
    setEditError(null);
    if (routeCompanyId) {
      navigate('/companies', { replace: true });
    }
  };

  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'code' ? formatEntityCode(value) : value)
    }));
    if (editError) setEditError(null);
  };

  const handleUpdateCompany = async (e) => {
    if (e) e.preventDefault();
    if (!selectedCompany?._id) return;

    if (!editFormData.name.trim()) {
      setEditError('Company name is required.');
      return;
    }
    const codeValidation = validateEntityCode(editFormData.code);
    if (!codeValidation.isValid) {
      setEditError(codeValidation.error);
      return;
    }

    setEditSubmitting(true);
    setEditError(null);

    try {
      const payload = {
        name: editFormData.name.trim(),
        code: editFormData.code.trim().toUpperCase(),
        description: editFormData.description?.trim() || '',
        logo: editFormData.logo?.trim() || '',
        isActive: Boolean(editFormData.isActive)
      };

      const response = await updateCompanyApi(selectedCompany._id, payload);
      const updated = response.data?.data || response.data || { ...selectedCompany, ...payload };

      setCompanies((prev) =>
        prev.map((c) => (c._id === selectedCompany._id ? { ...c, ...updated } : c))
      );
      setSelectedCompany((prev) => ({ ...prev, ...updated }));
      setSuccessToast(`Company "${payload.name}" updated successfully!`);
      setTimeout(() => setSuccessToast(null), 4000);
      setDrawerMode('details');
    } catch (err) {
      console.error('Error updating company:', err);
      setEditError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to update company. Please check your inputs.'
      );
    } finally {
      setEditSubmitting(false);
    }
  };

  const fetchCompanies = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await getCompaniesApi();
      const resData = response.data || {};
      const companyList = Array.isArray(resData.data)
        ? resData.data
        : Array.isArray(resData)
          ? resData
          : [];
      setCompanies(companyList);
      setMeta(resData.meta || null);
    } catch (err) {
      console.error('Error fetching companies:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load companies.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    getCompaniesApi()
      .then((response) => {
        if (!ignore) {
          const resData = response.data || {};
          const companyList = Array.isArray(resData.data)
            ? resData.data
            : Array.isArray(resData)
              ? resData
              : [];
          setCompanies(companyList);
          setMeta(resData.meta || null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error('Error fetching companies:', err);
          setError(err.response?.data?.message || err.message || 'Failed to load companies.');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Sync Route Param :id with Drawer
  useEffect(() => {
    if (routeCompanyId) {
      const found = companies.find((c) => c._id === routeCompanyId);
      if (found) {
        handleOpenDrawer(found, 'details');
      } else if (!loading) {
        setDrawerLoading(true);
        getCompanyByIdApi(routeCompanyId)
          .then((res) => {
            const data = res.data?.data || res.data;
            if (data) {
              handleOpenDrawer(data, 'details');
            }
          })
          .catch((err) => {
            console.error('Error loading company details for route ID:', routeCompanyId, err);
          })
          .finally(() => {
            setDrawerLoading(false);
          });
      }
    }
  }, [routeCompanyId, companies, loading]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isCreateModalOpen && !submitting) {
          setIsCreateModalOpen(false);
        } else if (isDrawerOpen && !editSubmitting) {
          handleCloseDrawer();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateModalOpen, submitting, isDrawerOpen, editSubmitting, routeCompanyId]);

  // Derived filtered companies (debounced)
  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const matchesSearch =
        !debouncedSearchTerm ||
        company.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        company.code?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        company.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && company.isActive) ||
        (statusFilter === 'inactive' && !company.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [companies, debouncedSearchTerm, statusFilter]);

  // Sorting & Pagination State (with 3-state sorting: asc -> desc -> default)
  const { preferences: displayPrefs } = useDisplayPreferences();
  const [sortKey, setSortKey] = useState('');
  const [sortOrder, setSortOrder] = useState(''); // '' (default) | 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = displayPrefs.rowsPerPage || 10;

  const handleSortChange = (key) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else if (sortOrder === 'desc') {
        // Third click resets to default unsorted state
        setSortKey('');
        setSortOrder('');
      } else {
        setSortOrder('asc');
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };


  const sortedCompanies = useMemo(() => {
    const list = [...filteredCompanies];
    if (!sortKey || !sortOrder) return list;
    return list.sort((a, b) => {
      let aVal = a[sortKey] ?? '';
      let bVal = b[sortKey] ?? '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCompanies, sortKey, sortOrder]);

  const totalPages = Math.ceil(sortedCompanies.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCompanies = sortedCompanies.slice(indexOfFirstItem, indexOfLastItem);

  // Statistics
  const totalCount = meta?.total !== undefined ? meta.total : companies.length;
  const activeCount = companies.filter((c) => c.isActive).length;
  const inactiveCount = companies.filter((c) => !c.isActive).length;

  const handleImageError = (id) => {
    setImageErrorMap((prev) => ({ ...prev, [id]: true }));
  };

  const handleOpenModal = () => {
    setFormData(INITIAL_FORM);
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseModal = () => {
    if (submitting) return;
    setIsCreateModalOpen(false);
    setFormError(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'code' ? formatEntityCode(value) : value)
    }));
    if (formError) setFormError(null);
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Company name is required.');
      return;
    }
    const codeValidation = validateEntityCode(formData.code);
    if (!codeValidation.isValid) {
      setFormError(codeValidation.error);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description?.trim() || '',
        logo: formData.logo?.trim() || '',
        isActive: Boolean(formData.isActive)
      };

      await createCompanyApi(payload);
      setIsCreateModalOpen(false);
      setFormData(INITIAL_FORM);
      setSuccessToast(`Company "${payload.name}" created successfully!`);
      setTimeout(() => setSuccessToast(null), 4000);
      fetchCompanies(true);
    } catch (err) {
      console.error('Error creating company:', err);
      setFormError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to create company. Please check your network and inputs.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Floating Success Toast */}
      {successToast && (
        <div className="fixed top-6 right-6 z-[10001] animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-xl bg-emerald-600/95 text-white border-emerald-400/30 shadow-emerald-500/20">
            <FiCheckCircle className="text-lg shrink-0" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide">{successToast}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Companies"
        icon={FiBriefcase}
        description="Manage and organize partner companies, brand entities, and operational organizations."
        action={
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="text"
                placeholder="Search by company name, code, or description..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white placeholder-slate-400 shadow-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => fetchCompanies(true)}
              disabled={loading || refreshing}
              className="p-2.5 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl transition-all border border-slate-200/80 dark:border-white/10 cursor-pointer disabled:opacity-50 shadow-xs shrink-0"
              title="Refresh companies list"
            >
              <FiRefreshCcw className={`text-base ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        }
      />

      {/* Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white/40 dark:bg-slate-900/60 backdrop-blur-none p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-md">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/25 cursor-pointer active:scale-95"
          >
            <FiPlus className="text-base" />
            <span>Add Company</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10 w-full sm:w-auto justify-center">
          {[
            { id: 'all', label: 'All', count: totalCount },
            { id: 'active', label: 'Active', count: activeCount },
            { id: 'inactive', label: 'Inactive', count: inactiveCount }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatusFilter(tab.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${statusFilter === tab.id
                ? 'bg-white dark:bg-white/15 text-blue-600 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${statusFilter === tab.id
                ? 'bg-blue-50 dark:bg-white/20 text-blue-600 dark:text-white'
                : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-rose-700 dark:text-rose-300 text-sm">
          <div className="flex items-center gap-2.5">
            <FiAlertCircle className="text-lg shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchCompanies()}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Companies Table (styled matching Users.jsx) */}
      <div className="relative z-10 bg-white/40 dark:bg-transparent border border-slate-200/80 dark:border-white/10 shadow-xl dark:shadow-2xl shadow-slate-500/30 dark:shadow-black/50 rounded-3xl overflow-hidden flex flex-col h-full isolate will-change-transform">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center">
            <FiLoader className="text-3xl text-blue-600 animate-spin" />
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-3">
              Loading companies...
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-auto custom-scrollbar max-h-[70vh]">
              <table className="w-full text-left border-collapse whitespace-nowrap min-w-200">
                <thead className="sticky top-0 z-20 bg-white/60 dark:bg-slate-900/80 backdrop-blur-md shadow-xs dark:shadow-md border-b border-slate-200/80 dark:border-white/10">
                  <tr className="border-b border-slate-200/80 dark:border-white/10 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    <th className="p-3 font-bold text-center w-14">S.No</th>

                    {/* Company Name */}
                    <th
                      onClick={() => handleSortChange('name')}
                      title={sortKey === 'name' ? (sortOrder === 'asc' ? 'Sorted Ascending. Click for Descending.' : 'Sorted Descending. Click to reset to Default.') : 'Click to sort Ascending.'}
                      className="p-4 font-bold text-left cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={sortKey === 'name' && sortOrder ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>Company</span>
                        {sortKey === 'name' && sortOrder === 'asc' && <span className="text-blue-600 dark:text-blue-400">▲</span>}
                        {sortKey === 'name' && sortOrder === 'desc' && <span className="text-blue-600 dark:text-blue-400">▼</span>}
                        {(!sortKey || sortKey !== 'name' || !sortOrder) && (
                          <span className="text-slate-400 dark:text-slate-500">⇅</span>
                        )}
                      </div>
                    </th>

                    {/* Code */}
                    <th
                      onClick={() => handleSortChange('code')}
                      title={sortKey === 'code' ? (sortOrder === 'asc' ? 'Sorted Ascending. Click for Descending.' : 'Sorted Descending. Click to reset to Default.') : 'Click to sort Ascending.'}
                      className="p-4 font-bold text-left cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={sortKey === 'code' && sortOrder ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>Code</span>
                        {sortKey === 'code' && sortOrder === 'asc' && <span className="text-blue-600 dark:text-blue-400">▲</span>}
                        {sortKey === 'code' && sortOrder === 'desc' && <span className="text-blue-600 dark:text-blue-400">▼</span>}
                        {(!sortKey || sortKey !== 'code' || !sortOrder) && (
                          <span className="text-slate-400 dark:text-slate-500">⇅</span>
                        )}
                      </div>
                    </th>

                    {/* Description */}
                    <th className="p-4 font-bold text-left">Description</th>

                    {/* Status */}
                    <th className="p-4 font-bold text-center">Status</th>

                    {/* Created Date */}
                    <th
                      onClick={() => handleSortChange('createdAt')}
                      title={sortKey === 'createdAt' ? (sortOrder === 'asc' ? 'Sorted Ascending. Click for Descending.' : 'Sorted Descending. Click to reset to Default.') : 'Click to sort Ascending.'}
                      className="p-4 font-bold text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={sortKey === 'createdAt' && sortOrder ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>Created Date</span>
                        {sortKey === 'createdAt' && sortOrder === 'asc' && <span className="text-blue-600 dark:text-blue-400">▲</span>}
                        {sortKey === 'createdAt' && sortOrder === 'desc' && <span className="text-blue-600 dark:text-blue-400">▼</span>}
                        {(!sortKey || sortKey !== 'createdAt' || !sortOrder) && (
                          <span className="text-slate-400 dark:text-slate-500">⇅</span>
                        )}
                      </div>
                    </th>

                    {/* Actions */}
                    <th className="p-4 font-bold text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-300/80 dark:divide-white/5">
                  {currentCompanies.length > 0 ? (
                    currentCompanies.map((company, index) => {
                      const hasCustomLogo = company.logo && !imageErrorMap[company._id];
                      const initial = company.name ? company.name.charAt(0).toUpperCase() : 'C';

                      return (
                        <tr
                          key={company._id}
                          className="hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors group"
                        >
                          <td className="p-3 text-sm text-slate-500 dark:text-slate-400 text-center font-medium">
                            {indexOfFirstItem + index + 1}
                          </td>

                          {/* Logo + Name + ID */}
                          <td className="p-4 text-sm text-slate-900 dark:text-white font-medium">
                            <div className="flex items-center gap-3">
                              <div
                                onClick={() => handleOpenDrawer(company, 'details')}
                                className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-center shrink-0 shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-500/30 transition-all"
                                title="View company details"
                              >
                                {hasCustomLogo ? (
                                  <img
                                    src={company.logo}
                                    alt={company.name}
                                    onError={() => handleImageError(company._id)}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 !text-white flex items-center justify-center text-xs font-extrabold shadow-sm">
                                    {initial}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span
                                    onClick={() => handleOpenDrawer(company, 'details')}
                                    className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                                    title="View company details"
                                  >
                                    {company.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono font-medium">
                                    {company._id}
                                  </span>
                                  <CopyButton text={company._id} />
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Code Badge */}
                          <td className="p-4 text-sm">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 text-xs font-mono font-bold">
                              <FiTag className="text-[10px] text-slate-400" />
                              {company.code || 'N/A'}
                            </span>
                          </td>

                          {/* Description */}
                          <td className="p-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs whitespace-normal">
                            <p
                              className="line-clamp-2 leading-relaxed"
                              title={company.description}
                            >
                              {company.description || 'No description provided.'}
                            </p>
                          </td>

                          {/* Status */}
                          <td className="p-4 text-sm text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${company.isActive
                                ? 'bg-emerald-500/50 dark:bg-emerald-500/10 text-white dark:text-emerald-600 border-emerald-500/25'
                                : 'bg-rose-500/50 dark:bg-rose-500/10 text-white dark:text-rose-600 border-rose-500/20'
                                }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${company.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                                  }`}
                              />
                              <span>{company.isActive ? 'Active' : 'Inactive'}</span>
                            </span>
                          </td>

                          {/* Created Date */}
                          <td className="p-4 text-sm text-center font-medium">
                            {company.createdAt ? (
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 font-mono">
                                  <FiCalendar className="text-blue-600 dark:text-blue-400 text-[11px]" />
                                  {formatDateDDMMYYYY(company.createdAt)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {formatDateTimeDDMMYYYY(company.createdAt).split(', ')[1] || ''}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs font-mono">-</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenDrawer(company, 'details')}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 border border-blue-200/60 dark:border-blue-500/20 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                                title="View Company Details"
                              >
                                <FiEye size={13} />
                                <span>View</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDrawer(company, 'edit')}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 border border-amber-200/60 dark:border-amber-500/20 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                                title="Edit Company"
                              >
                                <FiEdit2 size={13} />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCompany(company)}
                                disabled={actionLoadingId === company._id}
                                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl border border-transparent hover:border-rose-200/60 dark:hover:border-rose-500/20 transition-all cursor-pointer disabled:opacity-40"
                                title="Delete Company"
                              >
                                {actionLoadingId === company._id ? (
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
                      <td colSpan={7} className="p-12 text-center text-slate-500 dark:text-slate-400 italic">
                        {searchTerm || statusFilter !== 'all'
                          ? 'No matching companies found for current filters.'
                          : 'No companies found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {!loading && !error && sortedCompanies.length > 0 && (
              <div className="p-4 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-white/[0.02] backdrop-blur-md">
                <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left">
                  Showing <span className="font-bold text-slate-800 dark:text-white">{indexOfFirstItem + 1}</span> to <span className="font-bold text-slate-800 dark:text-white">{Math.min(indexOfLastItem, sortedCompanies.length)}</span> of <span className="font-bold text-slate-800 dark:text-white">{sortedCompanies.length}</span> companies
                </span>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 sm:px-4 py-2 bg-white dark:bg-slate-950/20 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs sm:text-sm font-bold border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-none transform-gpu cursor-pointer"
                  >
                    &larr;
                  </button>
                  <div className="flex gap-1 mx-1 sm:mx-2 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 items-center">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                            : 'bg-white dark:bg-slate-950/20 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 sm:px-4 py-2 bg-white dark:bg-slate-950/20 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs sm:text-sm font-bold border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-none transform-gpu cursor-pointer"
                  >
                    &rarr;
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Company Modal */}
      {isCreateModalOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 dark:bg-slate-950/50 backdrop-blur-lg animate-fade-in"
            onClick={handleCloseModal}
          />

          {/* Modal Box */}
          <div className="relative bg-white/20 dark:bg-slate-950/25 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 z-10 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/10 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FiBriefcase className="text-xl" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    Create New Company
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Register a partner company or brand organization.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={handleCloseModal}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                title="Close"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="p-3.5 mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-150">
                <FiAlertCircle className="shrink-0 text-base" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateCompany} className="space-y-4">
              {/* Company Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  disabled={submitting}
                  placeholder="e.g. Auric Lifestyle Private Limited"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white placeholder-slate-400"
                />
              </div>

              {/* Company Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Company Code <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <FiTag className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                  <input
                    type="text"
                    name="code"
                    required
                    disabled={submitting}
                    placeholder="e.g. AURIC"
                    value={formData.code}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white placeholder-slate-400"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Unique uppercase code identifier.</p>
              </div>

              {/* Logo URL + Live Preview */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Logo URL
                </label>
                <div className="flex gap-2.5 items-center">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                    {formData.logo ? (
                      <img
                        src={formData.logo}
                        alt="Logo preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <FiImage className="text-slate-400 text-lg" />
                    )}
                  </div>
                  <input
                    type="url"
                    name="logo"
                    disabled={submitting}
                    placeholder="https://example.com/auric-logo.png"
                    value={formData.logo}
                    onChange={handleInputChange}
                    className="flex-1 px-3.5 py-2.5 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white placeholder-slate-400 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  disabled={submitting}
                  placeholder="e.g. Consumer electronics and accessories"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white placeholder-slate-400 resize-none"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                <div>
                  <label htmlFor="createCompanyIsActive" className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer block">
                    Active Status
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Enable this company for catalogs and inventory listings immediately.
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="createCompanyIsActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  className="w-5 h-5 rounded-md text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-slate-200/80 dark:border-white/10">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
                >
                  {submitting && <FiLoader className="animate-spin text-xs" />}
                  <span>{submitting ? 'Creating...' : 'Create Company'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Slide-Over Drawer for Company Details & Edits */}
      {isDrawerOpen && createPortal(
        <div className="fixed inset-0 z-[10000] overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 dark:bg-slate-950/50 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
            onClick={handleCloseDrawer}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-white/30 dark:bg-slate-950/25 border-l border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out animate-in slide-in-from-right duration-300">
              
              {/* Drawer Top Header */}
              <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-slate-950/40 backdrop-blur-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-xs">
                      <FiBriefcase className="text-xl" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                        {selectedCompany ? selectedCompany.name : 'Company Details'}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        {selectedCompany?.code && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-white/10 text-slate-800 dark:text-slate-200 font-mono text-[11px] font-bold">
                            <FiTag className="text-[10px] text-slate-400" />
                            {selectedCompany.code}
                          </span>
                        )}
                        {selectedCompany?._id && (
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                              {selectedCompany._id}
                            </span>
                            <CopyButton text={selectedCompany._id} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={editSubmitting}
                    onClick={handleCloseDrawer}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0 disabled:opacity-40"
                    title="Close drawer (Esc)"
                  >
                    <FiX size={20} />
                  </button>
                </div>

                {/* Tab Switcher: View Details vs. Edit Company */}
                <div className="flex items-center gap-1.5 p-1 mt-4 bg-slate-200/60 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerMode('details');
                      setEditError(null);
                    }}
                    className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      drawerMode === 'details'
                        ? 'bg-white dark:bg-white/15 text-blue-600 dark:text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <FiEye className="text-sm" />
                    <span>Overview & Details</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerMode('edit');
                      setEditError(null);
                      if (selectedCompany) {
                        setEditFormData({
                          name: selectedCompany.name || '',
                          code: selectedCompany.code || '',
                          description: selectedCompany.description || '',
                          logo: selectedCompany.logo || '',
                          isActive: Boolean(selectedCompany.isActive)
                        });
                      }
                    }}
                    className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      drawerMode === 'edit'
                        ? 'bg-white dark:bg-white/15 text-blue-600 dark:text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <FiEdit2 className="text-sm" />
                    <span>Edit Company</span>
                  </button>
                </div>
              </div>

              {/* Drawer Body Area */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-6">
                {drawerLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center">
                    <FiLoader className="text-3xl text-blue-600 animate-spin mb-3" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Loading Company Details...
                    </p>
                  </div>
                ) : !selectedCompany ? (
                  <div className="py-20 text-center text-slate-500 dark:text-slate-400">
                    <FiAlertCircle className="text-3xl mx-auto mb-2 text-slate-400" />
                    <p className="text-sm font-semibold">No company found.</p>
                  </div>
                ) : drawerMode === 'details' ? (
                  /* ================= DETAILS VIEW ================= */
                  <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Hero Card */}
                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                      <div className="w-20 h-20 rounded-2xl bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-center shrink-0 overflow-hidden shadow-md">
                        {selectedCompany.logo ? (
                          <img
                            src={selectedCompany.logo}
                            alt={selectedCompany.name}
                            className="w-full h-full object-contain p-2"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 !text-white flex items-center justify-center text-2xl font-black">
                            {selectedCompany.name?.charAt(0)?.toUpperCase() || 'C'}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                          <h3 className="text-lg font-black text-slate-900 dark:text-white">
                            {selectedCompany.name}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              selectedCompany.isActive
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                selectedCompany.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                              }`}
                            />
                            <span>{selectedCompany.isActive ? 'Active Entity' : 'Inactive Entity'}</span>
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Billing Code:{' '}
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {selectedCompany.code || 'N/A'}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <FiTag className="text-blue-500 text-sm" />
                          <span>Code Identifier</span>
                        </div>
                        <p className="mt-2 text-sm font-mono font-black text-slate-900 dark:text-white">
                          {selectedCompany.code || 'N/A'}
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <FiCheckCircle className="text-emerald-500 text-sm" />
                          <span>Operational Status</span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                          {selectedCompany.isActive ? 'Available for Routing' : 'Deactivated'}
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <FiCalendar className="text-blue-500 text-sm" />
                          <span>Created Date</span>
                        </div>
                        <p className="mt-2 text-sm font-mono font-medium text-slate-900 dark:text-white">
                          {selectedCompany.createdAt ? formatDateDDMMYYYY(selectedCompany.createdAt) : '-'}
                        </p>
                        {selectedCompany.createdAt && (
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {formatDateTimeDDMMYYYY(selectedCompany.createdAt).split(', ')[1] || ''}
                          </p>
                        )}
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <FiClock className="text-indigo-500 text-sm" />
                          <span>Last Updated</span>
                        </div>
                        <p className="mt-2 text-sm font-mono font-medium text-slate-900 dark:text-white">
                          {selectedCompany.updatedAt ? formatDateDDMMYYYY(selectedCompany.updatedAt) : '-'}
                        </p>
                        {selectedCompany.updatedAt && (
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {formatDateTimeDDMMYYYY(selectedCompany.updatedAt).split(', ')[1] || ''}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Description Box */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Description & Notes
                      </h4>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {selectedCompany.description || 'No description provided for this company.'}
                      </p>
                    </div>

                    {/* Logo Source Preview if URL provided */}
                    {selectedCompany.logo && (
                      <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Logo Asset Source
                          </h4>
                          <a
                            href={selectedCompany.logo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                          >
                            <span>Open URL</span>
                            <FiExternalLink size={12} />
                          </a>
                        </div>
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate bg-white dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-200/60 dark:border-white/5">
                          {selectedCompany.logo}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ================= EDIT VIEW ================= */
                  <form id="drawerEditCompanyForm" onSubmit={handleUpdateCompany} className="space-y-4 animate-in fade-in duration-200">
                    {editError && (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-150">
                        <FiAlertCircle className="shrink-0 text-base" />
                        <span>{editError}</span>
                      </div>
                    )}

                    {/* Company Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Company Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        required
                        disabled={editSubmitting}
                        placeholder="e.g. Whatnot India Private Limited"
                        value={editFormData.name}
                        onChange={handleEditInputChange}
                        className="w-full px-3.5 py-2.5 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white placeholder-slate-400 font-medium"
                      />
                    </div>

                    {/* Company Code */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Company Code <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <FiTag className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                        <input
                          type="text"
                          name="code"
                          required
                          disabled={editSubmitting}
                          placeholder="e.g. WHATNOT"
                          value={editFormData.code}
                          onChange={handleEditInputChange}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white placeholder-slate-400"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">Unique uppercase code identifier for billing and orders.</p>
                    </div>

                    {/* Logo URL + Live Preview */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Logo URL
                      </label>
                      <div className="flex gap-2.5 items-center">
                        <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                          {editFormData.logo ? (
                            <img
                              src={editFormData.logo}
                              alt="Logo preview"
                              className="w-full h-full object-contain p-1"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <FiImage className="text-slate-400 text-lg" />
                          )}
                        </div>
                        <input
                          type="url"
                          name="logo"
                          disabled={editSubmitting}
                          placeholder="https://example.com/logo.png"
                          value={editFormData.logo}
                          onChange={handleEditInputChange}
                          className="flex-1 px-3.5 py-2.5 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white placeholder-slate-400 font-mono text-xs"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Description
                      </label>
                      <textarea
                        name="description"
                        rows={4}
                        disabled={editSubmitting}
                        placeholder="Company summary, corporate crossover, or distribution details..."
                        value={editFormData.description}
                        onChange={handleEditInputChange}
                        className="w-full px-3.5 py-2.5 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white placeholder-slate-400 resize-none leading-relaxed"
                      />
                    </div>

                    {/* Active Toggle */}
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                      <div>
                        <label htmlFor="editCompanyIsActiveDrawer" className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer block">
                          Active Status
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Enable this company for catalogs and inventory listings.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        id="editCompanyIsActiveDrawer"
                        name="isActive"
                        checked={editFormData.isActive}
                        onChange={handleEditInputChange}
                        className="w-5 h-5 rounded-md text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                      />
                    </div>
                  </form>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-slate-950/40 backdrop-blur-md flex items-center justify-between gap-3">
                {drawerMode === 'details' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDeleteCompany(selectedCompany)}
                      disabled={actionLoadingId === selectedCompany?._id}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl border border-rose-200/60 dark:border-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {actionLoadingId === selectedCompany?._id ? (
                        <FiLoader className="animate-spin text-sm" />
                      ) : (
                        <FiTrash2 className="text-sm" />
                      )}
                      <span>Delete Company</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCloseDrawer}
                        className="px-4 py-2.5 bg-slate-200/60 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={editSubmitting}
                      onClick={() => {
                        setDrawerMode('details');
                        setEditError(null);
                      }}
                      className="px-4 py-2.5 bg-slate-200/60 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      form="drawerEditCompanyForm"
                      disabled={editSubmitting}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-blue-600/25 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      {editSubmitting && <FiLoader className="animate-spin text-xs" />}
                      <span>{editSubmitting ? 'Saving Changes...' : 'Save Changes'}</span>
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Companies;
