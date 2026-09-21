import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FiCheck, FiLoader, FiAlertCircle, FiSearch, FiServer,
  FiRefreshCcw, FiX, FiCopy, FiCalendar, FiClock, FiPhone,
  FiMail, FiEye, FiExternalLink, FiHash, FiBriefcase,
  FiUsers, FiUserCheck, FiUserX, FiMapPin, FiFileText,
  FiPlus, FiUser, FiCheckCircle, FiEdit2, FiTrash2
} from 'react-icons/fi';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import CopyButton from '@/components/ui/CopyButton';
import CustomDropdown from '@/components/ui/CustomDropdown';
import GmailLink from '@/components/ui/GmailLink';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import {
  getFirmsApi,
  createFirmApi,
  updateFirmApi,
  deleteFirmApi,
  getCompaniesApi
} from '@/api/axios';
import { useConfirm } from '@/Context/ConfirmationContext';


const INITIAL_FORM_STATE = {
  companyId: '',
  firmName: '',
  firmCode: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  gstin: '',
  isActive: true
};

const Firms = () => {
  const navigate = useNavigate();
  const { confirm: confirmDialog } = useConfirm() || {};
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Companies loaded from API for dropdowns
  const [availableCompanies, setAvailableCompanies] = useState([]);

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState(INITIAL_FORM_STATE);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createFormError, setCreateFormError] = useState('');

  // Edit Modal State (PATCH /firms/{id})
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [firmToEdit, setFirmToEdit] = useState(null);
  const [editFormData, setEditFormData] = useState(INITIAL_FORM_STATE);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFormError, setEditFormError] = useState('');

  // Global Toast
  const [successToast, setSuccessToast] = useState('');

  // URL Search & Filter Params (matching Users.jsx)
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSearchParam = searchParams.get('search') || searchParams.get('firmId') || '';
  const [searchInput, setSearchInput] = useState(rawSearchParam);
  const lastPushedSearchRef = useRef(rawSearchParam);
  const searchTerm = rawSearchParam;
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const selectedCompany = searchParams.get('company') || '';
  const selectedStatus = searchParams.get('status') || '';
  const sortKey = searchParams.get('sortKey') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const firmTab = searchParams.get('tab') || 'all';

  // Pagination limit
  const [firmsPerPage] = useState(10);

  // Sync local input with URL search param
  useEffect(() => {
    const urlSearch = searchParams.get('search') || searchParams.get('firmId') || '';
    if (urlSearch !== lastPushedSearchRef.current) {
      setSearchInput(urlSearch);
      lastPushedSearchRef.current = urlSearch;
    }
  }, [searchParams]);

  // Debounce search updates to URL (matching Users.jsx)
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      setSearchParams((prev) => {
        const currentSearch = prev.get('search') || '';
        if (searchInput === currentSearch) return prev;

        if (searchInput) {
          prev.set('search', searchInput);
        } else {
          prev.delete('search');
        }
        prev.set('page', '1');
        lastPushedSearchRef.current = searchInput;
        return prev;
      }, { replace: true });
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchInput, setSearchParams]);

  // Set current page helper
  const setCurrentPage = useCallback((pageVal) => {
    setSearchParams((prev) => {
      const current = parseInt(prev.get('page') || '1', 10);
      const pageNum = typeof pageVal === 'function' ? pageVal(current) : pageVal;
      prev.set('page', String(pageNum));
      return prev;
    });
  }, [setSearchParams]);

  // Filter change helper
  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      if (value) {
        prev.set(key, value);
      } else {
        prev.delete(key);
      }
      prev.set('page', '1');
      return prev;
    });
  };

  // 3-state sorting handler (asc -> desc -> default '')
  const handleSortChange = (key) => {
    setSearchParams((prev) => {
      const currentKey = prev.get('sortKey') || '';
      const currentOrder = prev.get('sortOrder') || 'asc';

      if (currentKey === key) {
        if (currentOrder === 'asc') {
          prev.set('sortOrder', 'desc');
        } else {
          prev.delete('sortKey');
          prev.delete('sortOrder');
        }
      } else {
        prev.set('sortKey', key);
        prev.set('sortOrder', 'asc');
      }
      prev.set('page', '1');
      return prev;
    });
  };

  // Tab switcher helper
  const handleTabChange = (tabName) => {
    setSearchParams((prev) => {
      if (tabName === 'all') {
        prev.delete('tab');
      } else {
        prev.set('tab', tabName);
      }
      prev.set('page', '1');
      return prev;
    });
  };

  // Reset filters
  const handleClearFilters = () => {
    setSearchInput('');
    setSearchParams((prev) => {
      prev.delete('search');
      prev.delete('firmId');
      prev.delete('company');
      prev.delete('status');
      prev.delete('sortKey');
      prev.delete('sortOrder');
      prev.delete('tab');
      prev.set('page', '1');
      return prev;
    });
  };

  // Fetch Firms from API
  const fetchFirms = async (isPoll = false) => {
    if (!isPoll) setLoading(true);
    setError('');
    try {
      const response = await getFirmsApi();
      let firmList = [];

      if (response.data) {
        if (Array.isArray(response.data.data)) {
          firmList = response.data.data;
        } else if (Array.isArray(response.data)) {
          firmList = response.data;
        } else if (Array.isArray(response.data.firms)) {
          firmList = response.data.firms;
        }
      }

      setFirms(firmList);
    } catch (err) {
      console.error('Fetch firms error:', err);
      if (!isPoll) {
        setError(err.response?.data?.message || 'Failed to load firms.');
      }
      setFirms([]);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    let ignore = false;
    getFirmsApi()
      .then((response) => {
        if (!ignore) {
          const resData = response.data || {};
          const list = Array.isArray(resData.data)
            ? resData.data
            : Array.isArray(resData)
              ? resData
              : [];

          setFirms(list);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error('Fetch firms error:', err);
          setError(err.response?.data?.message || 'Failed to load firms.');
          setFirms([]);
          setLoading(false);
        }
      });

    // Fetch companies for dropdowns
    getCompaniesApi()
      .then((res) => {
        if (!ignore) {
          const list = Array.isArray(res.data?.data)
            ? res.data.data
            : Array.isArray(res.data)
              ? res.data
              : [];
          if (list.length > 0) {
            setAvailableCompanies(list);
          }
        }
      })
      .catch((err) => {
        console.warn('Company options fetch error:', err);
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Modal ESC Key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isCreateModalOpen && !createSubmitting) {
          setIsCreateModalOpen(false);
        } else if (isEditModalOpen && !editSubmitting) {
          setIsEditModalOpen(false);
        } else if (selectedFirm) {
          setSelectedFirm(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateModalOpen, createSubmitting, isEditModalOpen, editSubmitting, selectedFirm]);

  // Combined Companies list for Select Dropdown
  const allCompanyOptions = useMemo(() => {
    const map = new Map();

    // 1. Add from API response
    availableCompanies.forEach((c) => {
      if (c && c._id) {
        map.set(c._id, {
          id: c._id,
          name: c.name || c.code || 'Company',
          code: c.code || '',
          logo: c.logo || ''
        });
      }
    });

    // 2. Add from firms data
    firms.forEach((f) => {
      if (f.companyId && f.companyId._id && !map.has(f.companyId._id)) {
        map.set(f.companyId._id, {
          id: f.companyId._id,
          name: f.companyId.name || f.companyId.code || 'Company',
          code: f.companyId.code || '',
          logo: f.companyId.logo || ''
        });
      }
    });



    return Array.from(map.values());
  }, [availableCompanies, firms]);

  // Counts for tabs (matching Users.jsx pattern)
  const tabCounts = useMemo(() => {
    let activeCount = 0;
    let inactiveCount = 0;
    const byCompany = {};

    firms.forEach((f) => {
      if (f.isActive) activeCount++;
      else inactiveCount++;

      if (f.companyId?._id) {
        byCompany[f.companyId._id] = (byCompany[f.companyId._id] || 0) + 1;
      }
    });

    return {
      all: firms.length,
      active: activeCount,
      inactive: inactiveCount,
      byCompany
    };
  }, [firms]);

  // Tab Filtering
  const tabFilteredFirms = useMemo(() => {
    switch (firmTab) {
      case 'active':
        return firms.filter((f) => f.isActive === true);
      case 'inactive':
        return firms.filter((f) => f.isActive === false);
      default:
        if (firmTab !== 'all') {
          return firms.filter((f) => f.companyId?._id === firmTab);
        }
        return firms;
    }
  }, [firms, firmTab]);

  // Search & Secondary Filter
  const filteredFirms = useMemo(() => {
    const term = (searchTerm || '').toLowerCase().trim();

    return tabFilteredFirms.filter((firm) => {
      if (selectedCompany && firm.companyId?._id !== selectedCompany) {
        return false;
      }

      if (selectedStatus) {
        const isActiveStr = firm.isActive ? 'active' : 'inactive';
        if (isActiveStr !== selectedStatus.toLowerCase()) {
          return false;
        }
      }

      if (term) {
        const firmName = (firm.firmName || '').toLowerCase();
        const firmCode = (firm.firmCode || '').toLowerCase();
        const contactPerson = (firm.contactPerson || '').toLowerCase();
        const email = (firm.email || '').toLowerCase();
        const phone = (firm.phone || '').toLowerCase();
        const id = (firm._id || '').toLowerCase();
        const city = (firm.city || '').toLowerCase();
        const state = (firm.state || '').toLowerCase();
        const gstin = (firm.gstin || '').toLowerCase();
        const companyName = (firm.companyId?.name || '').toLowerCase();
        const companyCode = (firm.companyId?.code || '').toLowerCase();
        const statusText = firm.isActive ? 'active' : 'inactive';
        const createdAtStr = firm.createdAt ? formatDateDDMMYYYY(firm.createdAt).toLowerCase() : '';

        const matches =
          firmName.includes(term) ||
          firmCode.includes(term) ||
          contactPerson.includes(term) ||
          email.includes(term) ||
          phone.includes(term) ||
          id.includes(term) ||
          city.includes(term) ||
          state.includes(term) ||
          gstin.includes(term) ||
          companyName.includes(term) ||
          companyCode.includes(term) ||
          statusText.includes(term) ||
          createdAtStr.includes(term);

        if (!matches) return false;
      }

      return true;
    });
  }, [tabFilteredFirms, selectedCompany, selectedStatus, searchTerm]);

  // Sorting
  const sortedFirms = useMemo(() => {
    if (!sortKey) return filteredFirms;
    const list = [...filteredFirms];

    list.sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (sortKey === 'firmName') {
        aVal = (a.firmName || '').toLowerCase();
        bVal = (b.firmName || '').toLowerCase();
      } else if (sortKey === 'firmCode') {
        aVal = (a.firmCode || '').toLowerCase();
        bVal = (b.firmCode || '').toLowerCase();
      } else if (sortKey === 'company') {
        aVal = (a.companyId?.name || '').toLowerCase();
        bVal = (b.companyId?.name || '').toLowerCase();
      } else if (sortKey === 'city') {
        aVal = (a.city || '').toLowerCase();
        bVal = (b.city || '').toLowerCase();
      } else if (sortKey === 'createdAt' || sortKey === 'updatedAt') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [filteredFirms, sortKey, sortOrder]);

  // Dropdown options
  const companyFilterOptions = useMemo(() => {
    return [
      { value: '', label: selectedCompany ? `Company: Filtered` : 'All Companies' },
      ...allCompanyOptions.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))
    ];
  }, [allCompanyOptions, selectedCompany]);

  const statusOptions = [
    { value: '', label: selectedStatus ? `Status: ${selectedStatus.toUpperCase()}` : 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  // Pagination logic
  const totalPages = Math.ceil(sortedFirms.length / firmsPerPage) || 1;

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage, setCurrentPage]);

  const indexOfLastFirm = currentPage * firmsPerPage;
  const indexOfFirstFirm = indexOfLastFirm - firmsPerPage;
  const currentFirms = sortedFirms.slice(indexOfFirstFirm, indexOfLastFirm);

  // Submit Handler for POST /firms
  const handleCreateFirm = async (e) => {
    e.preventDefault();
    setCreateFormError('');

    if (!createFormData.companyId) return setCreateFormError('Please select a parent company.');
    if (!createFormData.firmName.trim()) return setCreateFormError('Firm name is required.');
    if (!createFormData.firmCode.trim()) return setCreateFormError('Firm code is required.');
    if (!createFormData.contactPerson.trim()) return setCreateFormError('Contact person is required.');
    if (!createFormData.phone.trim()) return setCreateFormError('Phone number is required.');
    if (!createFormData.email.trim()) return setCreateFormError('Email address is required.');
    if (!createFormData.address.trim()) return setCreateFormError('Premises address is required.');
    if (!createFormData.city.trim()) return setCreateFormError('City is required.');
    if (!createFormData.state.trim()) return setCreateFormError('State is required.');
    if (!createFormData.pincode.trim()) return setCreateFormError('Pincode is required.');
    if (!createFormData.gstin.trim()) return setCreateFormError('GSTIN is required.');

    const payload = {
      companyId: createFormData.companyId,
      firmName: createFormData.firmName.trim(),
      firmCode: createFormData.firmCode.trim().toUpperCase(),
      contactPerson: createFormData.contactPerson.trim(),
      phone: createFormData.phone.trim(),
      email: createFormData.email.trim().toLowerCase(),
      address: createFormData.address.trim(),
      city: createFormData.city.trim(),
      state: createFormData.state.trim(),
      pincode: createFormData.pincode.trim(),
      gstin: createFormData.gstin.trim().toUpperCase(),
      isActive: Boolean(createFormData.isActive)
    };

    setCreateSubmitting(true);
    try {
      const response = await createFirmApi(payload);
      const resData = response.data?.data || response.data || {};
      const matchedComp = allCompanyOptions.find((c) => c.id === payload.companyId);

      const newFirm = {
        _id: resData._id || `firm_${Date.now()}`,
        ...payload,
        companyId: {
          _id: payload.companyId,
          name: matchedComp?.name || 'Company',
          code: matchedComp?.code || '',
          logo: matchedComp?.logo || ''
        },
        createdAt: resData.createdAt || new Date().toISOString(),
        updatedAt: resData.updatedAt || new Date().toISOString()
      };

      setFirms((prev) => [newFirm, ...prev]);
      setSuccessToast(`Firm "${payload.firmName}" created successfully!`);
      setTimeout(() => setSuccessToast(''), 4000);
      setIsCreateModalOpen(false);
      setCreateFormData(INITIAL_FORM_STATE);
      fetchFirms(true);
    } catch (err) {
      console.error('Create firm error:', err);
      setCreateFormError(err.response?.data?.message || err.message || 'Failed to create firm.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Open Edit Modal (prefills form data)
  const handleOpenEditModal = (firm) => {
    setFirmToEdit(firm);
    setEditFormData({
      companyId: firm.companyId?._id || firm.companyId || '',
      firmName: firm.firmName || '',
      firmCode: firm.firmCode || '',
      contactPerson: firm.contactPerson || '',
      phone: firm.phone || '',
      email: firm.email || '',
      address: firm.address || '',
      city: firm.city || '',
      state: firm.state || '',
      pincode: firm.pincode || '',
      gstin: firm.gstin || '',
      isActive: Boolean(firm.isActive)
    });
    setEditFormError('');
    setIsEditModalOpen(true);
  };

  // Submit Handler for PATCH /firms/{id}
  const handleUpdateFirm = async (e) => {
    e.preventDefault();
    if (!firmToEdit) return;
    setEditFormError('');

    if (!editFormData.companyId) return setEditFormError('Please select a parent company.');
    if (!editFormData.firmName.trim()) return setEditFormError('Firm name is required.');
    if (!editFormData.firmCode.trim()) return setEditFormError('Firm code is required.');
    if (!editFormData.contactPerson.trim()) return setEditFormError('Contact person is required.');
    if (!editFormData.phone.trim()) return setEditFormError('Phone number is required.');
    if (!editFormData.email.trim()) return setEditFormError('Email address is required.');
    if (!editFormData.address.trim()) return setEditFormError('Premises address is required.');
    if (!editFormData.city.trim()) return setEditFormError('City is required.');
    if (!editFormData.state.trim()) return setEditFormError('State is required.');
    if (!editFormData.pincode.trim()) return setEditFormError('Pincode is required.');
    if (!editFormData.gstin.trim()) return setEditFormError('GSTIN is required.');

    const payload = {
      companyId: editFormData.companyId,
      firmName: editFormData.firmName.trim(),
      firmCode: editFormData.firmCode.trim().toUpperCase(),
      contactPerson: editFormData.contactPerson.trim(),
      phone: editFormData.phone.trim(),
      email: editFormData.email.trim().toLowerCase(),
      address: editFormData.address.trim(),
      city: editFormData.city.trim(),
      state: editFormData.state.trim(),
      pincode: editFormData.pincode.trim(),
      gstin: editFormData.gstin.trim().toUpperCase(),
      isActive: Boolean(editFormData.isActive)
    };

    setEditSubmitting(true);
    try {
      const response = await updateFirmApi(firmToEdit._id, payload);
      const resData = response.data?.data || response.data || {};
      const matchedComp = allCompanyOptions.find((c) => c.id === payload.companyId);

      const updatedFirm = {
        ...firmToEdit,
        ...payload,
        companyId: {
          _id: payload.companyId,
          name: matchedComp?.name || firmToEdit.companyId?.name || 'Company',
          code: matchedComp?.code || firmToEdit.companyId?.code || '',
          logo: matchedComp?.logo || firmToEdit.companyId?.logo || ''
        },
        updatedAt: resData.updatedAt || new Date().toISOString()
      };

      setFirms((prev) => prev.map((f) => (f._id === firmToEdit._id ? updatedFirm : f)));
      if (selectedFirm?._id === firmToEdit._id) {
        setSelectedFirm(updatedFirm);
      }
      setSuccessToast(`Firm "${payload.firmName}" updated successfully!`);
      setTimeout(() => setSuccessToast(''), 4000);
      setIsEditModalOpen(false);
      setFirmToEdit(null);
    } catch (err) {
      console.error('Update firm error:', err);
      setEditFormError(err.response?.data?.message || err.message || 'Failed to update firm.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handler for DELETE /firms/{id}
  const handleDeleteFirm = async (firm) => {
    if (!firm) return;
    const targetId = firm._id;

    const message = `Are you sure you want to permanently delete firm "${firm.firmName}" (${firm.firmCode})? This action cannot be undone.`;
    let isConfirmed = false;
    if (confirmDialog) {
      isConfirmed = await confirmDialog(message);
    } else {
      isConfirmed = window.confirm(message);
    }
    if (!isConfirmed) return;

    setActionLoadingId(targetId);
    try {
      await deleteFirmApi(targetId);
      setFirms((prev) => prev.filter((f) => f._id !== targetId));
      if (selectedFirm?._id === targetId) {
        setSelectedFirm(null);
      }
      setSuccessToast(`Firm "${firm.firmName}" deleted successfully!`);
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err) {
      console.error('Delete firm error:', err);
      alert(err.response?.data?.message || 'Failed to delete firm.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-[10001] flex items-center gap-2.5 px-4 py-3 bg-emerald-600 text-white text-xs font-bold rounded-2xl shadow-xl shadow-emerald-600/30 animate-in fade-in slide-in-from-bottom-5">
          <FiCheckCircle className="text-base" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Title & Search Bar (matching Users.jsx) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Firms List
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            Manage business firms, regulatory profiles, GST compliance, and entity branches.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400 z-10" />
            <input
              type="text"
              placeholder="Search by name, code, contact, GSTIN, city..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/40 shadow-xs dark:shadow-inner backdrop-blur-md text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium transition-all"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <FiX className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => fetchFirms(false)}
            disabled={loading}
            className="p-2.5 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer shadow-xs shrink-0"
            title="Refresh Firms"
          >
            <FiRefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics & Filter Bar (matching Users.jsx) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-semibold text-slate-600 dark:text-slate-400 px-1 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-full shadow-xs dark:shadow-none text-slate-600 dark:text-slate-400">
            Total Firms: <strong className="text-slate-900 dark:text-white">{firms.length}</strong>
          </span>
          {(searchTerm || selectedCompany || selectedStatus || firmTab !== 'all') && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full">
              Showing: <strong>{sortedFirms.length}</strong>
            </span>
          )}
        </div>

        {/* Dropdown Filters & Actions */}
        <div className="flex items-center gap-2">
          <div className="min-w-[140px]">
            <CustomDropdown
              value=""
              onChange={(val) => handleFilterChange('company', val)}
              options={companyFilterOptions}
              statusColor={`!px-3 !py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-black/20 font-bold ${
                selectedCompany ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
              }`}
            />
          </div>
          <div className="min-w-[120px]">
            <CustomDropdown
              value=""
              onChange={(val) => handleFilterChange('status', val)}
              options={statusOptions}
              statusColor={`!px-3 !py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-black/20 font-bold ${
                selectedStatus ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
              }`}
            />
          </div>
          {(searchTerm || selectedCompany || selectedStatus || firmTab !== 'all') && (
            <button
              onClick={handleClearFilters}
              className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:hover:text-white text-xs font-bold rounded-xl border border-slate-300 dark:border-white/10 transition-all cursor-pointer"
              title="Reset Filters"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setCreateFormError('');
              setCreateFormData(INITIAL_FORM_STATE);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer shrink-0"
          >
            <FiPlus className="w-3.5 h-3.5" />
            <span>Add Firm</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher (matching Users.jsx) */}
      <div className="relative z-20 flex flex-wrap items-center gap-2 p-2 bg-white/40 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-2xl backdrop-blur-xl shadow-md shadow-slate-500/30 dark:shadow-none">
        <button
          onClick={() => handleTabChange('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            firmTab === 'all'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <FiServer className="text-sm shrink-0" />
          <span>All Firms</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold shrink-0 ${
              firmTab === 'all'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
            }`}
          >
            {tabCounts.all}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('active')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            firmTab === 'active'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <FiCheck className="text-sm shrink-0" />
          <span>Active</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold shrink-0 ${
              firmTab === 'active'
                ? 'bg-white/20 text-white'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            }`}
          >
            {tabCounts.active}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('inactive')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            firmTab === 'inactive'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <FiX className="text-sm shrink-0" />
          <span>Inactive</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold shrink-0 ${
              firmTab === 'inactive'
                ? 'bg-white/20 text-white'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
            }`}
          >
            {tabCounts.inactive}
          </span>
        </button>

        {/* Dynamic tabs for parent companies */}
        {allCompanyOptions.map((comp) => (
          <button
            key={comp.id}
            onClick={() => handleTabChange(comp.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              firmTab === comp.id
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <FiBriefcase className="text-sm shrink-0" />
            <span>{comp.name}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold shrink-0 ${
                firmTab === comp.id
                  ? 'bg-white/20 text-white'
                  : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
              }`}
            >
              {tabCounts.byCompany[comp.id] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Content Area (matching Users.jsx) */}
      {loading ? (
        <div className="h-72 flex flex-col justify-center items-center bg-white/40 dark:bg-slate-950/15 border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs dark:shadow-none">
          <FiLoader className="animate-spin text-3xl text-blue-600 dark:text-blue-400 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading firms...</p>
        </div>
      ) : error ? (
        <div className="text-rose-600 dark:text-red-400 bg-rose-50 dark:bg-red-900/20 p-5 rounded-2xl border border-rose-200 dark:border-red-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FiAlertCircle className="text-xl shrink-0" />
            <span className="font-medium text-sm">{error}</span>
          </div>
          <button
            onClick={() => fetchFirms(false)}
            className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="relative z-10 bg-white/20 dark:bg-transparent border border-slate-200/80 dark:border-white/10 shadow-xl dark:shadow-2xl shadow-slate-500/30 dark:shadow-black/50 rounded-3xl overflow-hidden flex flex-col h-full isolate will-change-transform">
          <div className="overflow-auto custom-scrollbar max-h-[70vh]">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-200">
              <thead className="sticky top-0 z-20 bg-white/60 dark:bg-slate-900/80 backdrop-blur-md shadow-xs dark:shadow-md border-b border-slate-200/80 dark:border-white/10">
                <tr className="border-b border-slate-200/80 dark:border-white/10 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <th className="p-3 font-bold text-center w-14">S.No</th>

                  {/* Firm Name Sort */}
                  <th
                    onClick={() => handleSortChange('firmName')}
                    className="p-4 font-bold text-left cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={sortKey === 'firmName' ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>
                        Firm Name
                      </span>
                      {sortKey === 'firmName' ? (
                        sortOrder === 'asc' ? (
                          <span className="text-blue-600 dark:text-blue-400">▲</span>
                        ) : (
                          <span className="text-blue-600 dark:text-blue-400">▼</span>
                        )
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">⇅</span>
                      )}
                    </div>
                  </th>

                  {/* Firm Code Sort */}
                  <th
                    onClick={() => handleSortChange('firmCode')}
                    className="p-4 font-bold text-left cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={sortKey === 'firmCode' ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>
                        Firm Code
                      </span>
                      {sortKey === 'firmCode' ? (
                        sortOrder === 'asc' ? (
                          <span className="text-blue-600 dark:text-blue-400">▲</span>
                        ) : (
                          <span className="text-blue-600 dark:text-blue-400">▼</span>
                        )
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">⇅</span>
                      )}
                    </div>
                  </th>

                  {/* Company Sort */}
                  <th
                    onClick={() => handleSortChange('company')}
                    className="p-4 font-bold text-left cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={sortKey === 'company' ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>
                        Company
                      </span>
                      {sortKey === 'company' ? (
                        sortOrder === 'asc' ? (
                          <span className="text-blue-600 dark:text-blue-400">▲</span>
                        ) : (
                          <span className="text-blue-600 dark:text-blue-400">▼</span>
                        )
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">⇅</span>
                      )}
                    </div>
                  </th>

                  {/* Contact Person */}
                  <th className="p-4 font-bold text-left">Contact</th>

                  {/* Email */}
                  <th className="p-4 font-bold text-left">Email</th>

                  {/* Phone */}
                  <th className="p-4 font-bold text-center">Phone</th>

                  {/* Location (City Sort) */}
                  <th
                    onClick={() => handleSortChange('city')}
                    className="p-4 font-bold text-left cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={sortKey === 'city' ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>
                        Location
                      </span>
                      {sortKey === 'city' ? (
                        sortOrder === 'asc' ? (
                          <span className="text-blue-600 dark:text-blue-400">▲</span>
                        ) : (
                          <span className="text-blue-600 dark:text-blue-400">▼</span>
                        )
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">⇅</span>
                      )}
                    </div>
                  </th>

                  {/* GSTIN */}
                  <th className="p-4 font-bold text-center">GSTIN</th>

                  {/* Status */}
                  <th className="p-4 font-bold text-center">Status</th>

                  {/* Created At Sort */}
                  <th
                    onClick={() => handleSortChange('createdAt')}
                    className="p-4 font-bold text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={sortKey === 'createdAt' ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>
                        Created At
                      </span>
                      {sortKey === 'createdAt' ? (
                        sortOrder === 'asc' ? (
                          <span className="text-blue-600 dark:text-blue-400">▲</span>
                        ) : (
                          <span className="text-blue-600 dark:text-blue-400">▼</span>
                        )
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">⇅</span>
                      )}
                    </div>
                  </th>

                  <th className="p-4 font-bold text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-300/80 dark:divide-white/5">
                {currentFirms.length > 0 ? (
                  currentFirms.map((firm, index) => {
                    const initials = firm.firmName ? firm.firmName.charAt(0).toUpperCase() : 'F';
                    const company = firm.companyId || {};
                    const hasCompanyLogo = company.logo && !imageErrors[company._id];

                    return (
                      <tr
                        key={firm._id}
                        className="hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors group"
                      >
                        {/* S.No */}
                        <td className="p-3 text-sm text-slate-500 dark:text-slate-400 text-center font-medium">
                          {indexOfFirstFirm + index + 1}
                        </td>

                        {/* Firm Name & ID */}
                        <td className="p-4 text-sm text-slate-900 dark:text-white font-medium">
                          <div className="flex items-center gap-3">
                            <div
                              onClick={() => setSelectedFirm(firm)}
                              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 !text-white flex items-center justify-center text-xs font-extrabold shrink-0 shadow-sm cursor-pointer hover:scale-105 transition-transform"
                              title="View firm details"
                            >
                              {initials}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  onClick={() => setSelectedFirm(firm)}
                                  className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                                  title="View firm details"
                                >
                                  {firm.firmName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono font-medium">
                                  {firm._id}
                                </span>
                                <CopyButton text={firm._id} />
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Firm Code */}
                        <td className="p-4 text-sm">
                          {firm.firmCode ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 text-xs font-mono font-bold">
                              <FiHash className="text-[10px] text-slate-400" />
                              {firm.firmCode}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs font-mono">-</span>
                          )}
                        </td>

                        {/* Associated Company */}
                        <td className="p-4 text-sm text-slate-700 dark:text-slate-300">
                          {company.name ? (
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 shrink-0 flex items-center justify-center">
                                {hasCompanyLogo ? (
                                  <img
                                    src={company.logo}
                                    alt={company.name}
                                    onError={() => setImageErrors((prev) => ({ ...prev, [company._id]: true }))}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-500">
                                    {company.name.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div>
                                <div
                                  onClick={() => navigate(`/companies/${company._id}`)}
                                  className="font-semibold text-xs text-slate-900 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
                                  title="View company"
                                >
                                  {company.name}
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                                  {company.code}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Not Assigned</span>
                          )}
                        </td>

                        {/* Contact Person */}
                        <td className="p-4 text-sm text-slate-700 dark:text-slate-300">
                          <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-200 text-xs">
                            <FiUser className="text-slate-400 text-xs shrink-0" />
                            <span>{firm.contactPerson || '-'}</span>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="p-4 text-sm text-slate-700 dark:text-slate-300">
                          <GmailLink email={firm.email} />
                        </td>

                        {/* Phone */}
                        <td className="p-4 text-sm text-center text-slate-700 dark:text-slate-300 font-mono">
                          {firm.phone ? (
                            <a
                              href={`tel:${firm.phone}`}
                              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              {firm.phone}
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>

                        {/* Location */}
                        <td className="p-4 text-sm text-slate-700 dark:text-slate-300">
                          <div className="flex items-center gap-1 text-xs font-medium text-slate-800 dark:text-slate-200">
                            <FiMapPin className="text-rose-500 text-xs shrink-0" />
                            <span>{firm.city}, {firm.state}</span>
                            {firm.pincode && (
                              <span className="text-[10px] font-mono text-slate-400">({firm.pincode})</span>
                            )}
                          </div>
                        </td>

                        {/* GSTIN */}
                        <td className="p-4 text-sm text-center">
                          {firm.gstin ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-mono font-bold">
                              {firm.gstin}
                              <CopyButton text={firm.gstin} />
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>

                        {/* Status Toggle / Pill */}
                        <td className="p-4 text-sm text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                              firm.isActive
                                ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                firm.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                              }`}
                            />
                            <span>{firm.isActive ? 'Active' : 'Inactive'}</span>
                          </span>
                        </td>

                        {/* Created At */}
                        <td className="p-4 text-sm text-center font-medium">
                          {firm.createdAt ? (
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                <FiCalendar className="text-blue-600 dark:text-blue-400 text-[11px]" />
                                {formatDateDDMMYYYY(firm.createdAt)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {formatDateTimeDDMMYYYY(firm.createdAt).split(', ')[1]}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs font-mono">-</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* View Details */}
                            <button
                              type="button"
                              onClick={() => setSelectedFirm(firm)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                              title="View firm details"
                            >
                              <FiEye className="text-base" />
                            </button>

                            {/* Edit Firm (PATCH /firms/{id}) */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(firm)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Edit firm details"
                            >
                              <FiEdit2 className="text-base" />
                            </button>

                            {/* Delete Firm (DELETE /firms/{id}) */}
                            <button
                              type="button"
                              onClick={() => handleDeleteFirm(firm)}
                              disabled={actionLoadingId === firm._id}
                              className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                              title="Delete firm"
                            >
                              {actionLoadingId === firm._id ? (
                                <FiLoader className="text-base animate-spin text-rose-500" />
                              ) : (
                                <FiTrash2 className="text-base" />
                              )}
                            </button>

                            {/* Copy ID */}
                            <CopyButton text={firm._id} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="12" className="p-12 text-center text-slate-500 dark:text-slate-400">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-3 text-slate-400">
                        <FiServer className="text-xl" />
                      </div>
                      <p className="text-sm font-semibold">No matching firms found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Try refining your search keyword or clearing filters.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls (matching Users.jsx) */}
          {sortedFirms.length > 0 && (
            <div className="p-4 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-white/[0.02] backdrop-blur-md">
              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left">
                Showing <span className="font-bold text-slate-800 dark:text-white">{indexOfFirstFirm + 1}</span> to{' '}
                <span className="font-bold text-slate-800 dark:text-white">
                  {Math.min(indexOfLastFirm, sortedFirms.length)}
                </span>{' '}
                of <span className="font-bold text-slate-800 dark:text-white">{sortedFirms.length}</span> firms
              </span>

              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 sm:px-4 py-2 bg-white dark:bg-slate-950/20 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs sm:text-sm font-bold border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-none transform-gpu cursor-pointer"
                >
                  &larr;
                </button>

                <div className="flex gap-1 mx-1 sm:mx-2 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 items-center">
                  {(() => {
                    const pageNumbers = [];
                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
                    } else {
                      if (currentPage <= 4) {
                        for (let i = 1; i <= 5; i++) pageNumbers.push(i);
                        pageNumbers.push('...');
                        pageNumbers.push(totalPages);
                      } else if (currentPage >= totalPages - 3) {
                        pageNumbers.push(1);
                        pageNumbers.push('...');
                        for (let i = totalPages - 4; i <= totalPages; i++) pageNumbers.push(i);
                      } else {
                        pageNumbers.push(1);
                        pageNumbers.push('...');
                        for (let i = currentPage - 1; i <= currentPage + 1; i++) pageNumbers.push(i);
                        pageNumbers.push('...');
                        pageNumbers.push(totalPages);
                      }
                    }
                    return pageNumbers.map((page, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          if (page !== '...') setCurrentPage(page);
                        }}
                        disabled={page === '...'}
                        className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-lg text-xs sm:text-sm font-medium border transition-colors shrink-0 transform-gpu ${
                          page === currentPage
                            ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                            : page === '...'
                              ? 'bg-transparent text-slate-400 dark:text-slate-500 border-transparent cursor-default'
                              : 'bg-white dark:bg-slate-950/20 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white cursor-pointer'
                        }`}
                      >
                        {page}
                      </button>
                    ));
                  })()}
                </div>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="px-3 sm:px-4 py-2 bg-white dark:bg-slate-950/20 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs sm:text-sm font-bold border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-none transform-gpu cursor-pointer"
                >
                  &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE FIRM MODAL (POST /firms) */}
      {isCreateModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 dark:bg-slate-950/50 backdrop-blur-lg transition-opacity"
              onClick={() => !createSubmitting && setIsCreateModalOpen(false)}
            />

            {/* Modal Dialog */}
            <div className="relative w-full max-w-2xl bg-white/20 dark:bg-slate-950/25 border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
              {/* Header */}
              <div className="p-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg font-black shrink-0">
                    <FiServer />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Register New Firm Entity
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Fill in the entity registration details and assign a parent company.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={createSubmitting}
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                  title="Close modal (Esc)"
                >
                  <FiX className="text-xl" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleCreateFirm} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1">
                  {/* Error Notification */}
                  {createFormError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                      <FiAlertCircle className="text-base shrink-0" />
                      <span>{createFormError}</span>
                    </div>
                  )}

                  {/* 1. Parent Company Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Parent Company <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        name="companyId"
                        value={createFormData.companyId}
                        onChange={(e) =>
                          setCreateFormData((prev) => ({ ...prev, companyId: e.target.value }))
                        }
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                      >
                        <option value="" disabled>
                          -- Select Parent Enterprise --
                        </option>
                        {allCompanyOptions.map((comp) => (
                          <option key={comp.id} value={comp.id}>
                            {comp.name} {comp.code ? `(${comp.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      The firm entity will be linked under this parent company's catalog and billing umbrella.
                    </p>
                  </div>

                  {/* 2. Firm Name & Firm Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Firm Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="firmName"
                        value={createFormData.firmName}
                        onChange={(e) =>
                          setCreateFormData((prev) => ({ ...prev, firmName: e.target.value }))
                        }
                        placeholder="e.g. Metro Telecom & Gadgets"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Firm Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="firmCode"
                        value={createFormData.firmCode}
                        onChange={(e) =>
                          setCreateFormData((prev) => ({ ...prev, firmCode: e.target.value }))
                        }
                        placeholder="e.g. METRO-DEL"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 uppercase"
                      />
                    </div>
                  </div>

                  {/* 3. Contact Person & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Contact Person <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="contactPerson"
                        value={createFormData.contactPerson}
                        onChange={(e) =>
                          setCreateFormData((prev) => ({ ...prev, contactPerson: e.target.value }))
                        }
                        placeholder="e.g. Suresh Singhania"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={createFormData.phone}
                        onChange={(e) =>
                          setCreateFormData((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        placeholder="e.g. +919811001122"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-mono font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>
                  </div>

                  {/* 4. Email & GSTIN */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Official Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={createFormData.email}
                        onChange={(e) =>
                          setCreateFormData((prev) => ({ ...prev, email: e.target.value }))
                        }
                        placeholder="e.g. orders@metrotelecom.in"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        GSTIN Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="gstin"
                        value={createFormData.gstin}
                        onChange={(e) =>
                          setCreateFormData((prev) => ({ ...prev, gstin: e.target.value }))
                        }
                        placeholder="e.g. 07AAAAA1111A1Z1"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 uppercase"
                      />
                    </div>
                  </div>

                  {/* 5. Premises Address */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Premises Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={createFormData.address}
                      onChange={(e) =>
                        setCreateFormData((prev) => ({ ...prev, address: e.target.value }))
                      }
                      placeholder="e.g. Shop 104, Nehru Place Market"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>

                  {/* 6. City, State, Pincode */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        City <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="city"
                        value={createFormData.city}
                        onChange={(e) =>
                          setCreateFormData((prev) => ({ ...prev, city: e.target.value }))
                        }
                        placeholder="e.g. New Delhi"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        State <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="state"
                        value={createFormData.state}
                        onChange={(e) =>
                          setCreateFormData((prev) => ({ ...prev, state: e.target.value }))
                        }
                        placeholder="e.g. Delhi"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Pincode <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="pincode"
                        value={createFormData.pincode}
                        onChange={(e) =>
                          setCreateFormData((prev) => ({ ...prev, pincode: e.target.value }))
                        }
                        placeholder="e.g. 110019"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-mono font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>
                  </div>

                  {/* 7. Active Status Toggle */}
                  <div className="pt-2">
                    <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={createFormData.isActive}
                        onChange={(e) =>
                          setCreateFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                        }
                        className="w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          Enable as Active Operational Branch
                        </p>
                        <p className="text-[11px] text-slate-400">
                          When checked, this firm will immediately be accessible for inventory dispatch and purchase orders.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={createSubmitting}
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createSubmitting}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-600/25 cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    {createSubmitting && <FiLoader className="animate-spin text-sm" />}
                    <span>{createSubmitting ? 'Creating Firm...' : 'Create Firm'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* EDIT FIRM MODAL (PATCH /firms/{id}) */}
      {isEditModalOpen &&
        firmToEdit &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 dark:bg-slate-950/50 backdrop-blur-lg transition-opacity"
              onClick={() => !editSubmitting && setIsEditModalOpen(false)}
            />

            {/* Modal Dialog */}
            <div className="relative w-full max-w-2xl bg-white/20 dark:bg-slate-950/25 border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
              {/* Header */}
              <div className="p-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg font-black shrink-0">
                    <FiEdit2 />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Edit Firm Profile
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Update details for <span className="font-semibold text-slate-700 dark:text-slate-200">{firmToEdit.firmName}</span> ({firmToEdit.firmCode})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={editSubmitting}
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                  title="Close modal (Esc)"
                >
                  <FiX className="text-xl" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleUpdateFirm} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1">
                  {/* Error Notification */}
                  {editFormError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                      <FiAlertCircle className="text-base shrink-0" />
                      <span>{editFormError}</span>
                    </div>
                  )}

                  {/* 1. Parent Company Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Parent Company <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        name="companyId"
                        value={editFormData.companyId}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, companyId: e.target.value }))
                        }
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                      >
                        <option value="" disabled>
                          -- Select Parent Enterprise --
                        </option>
                        {allCompanyOptions.map((comp) => (
                          <option key={comp.id} value={comp.id}>
                            {comp.name} {comp.code ? `(${comp.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 2. Firm Name & Firm Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Firm Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="firmName"
                        value={editFormData.firmName}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, firmName: e.target.value }))
                        }
                        placeholder="e.g. Metro Telecom & Gadgets"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Firm Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="firmCode"
                        value={editFormData.firmCode}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, firmCode: e.target.value }))
                        }
                        placeholder="e.g. METRO-DEL"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 uppercase"
                      />
                    </div>
                  </div>

                  {/* 3. Contact Person & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Contact Person <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="contactPerson"
                        value={editFormData.contactPerson}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, contactPerson: e.target.value }))
                        }
                        placeholder="e.g. Suresh Singhania"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={editFormData.phone}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        placeholder="e.g. +919811001122"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-mono font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>
                  </div>

                  {/* 4. Email & GSTIN */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Official Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={editFormData.email}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, email: e.target.value }))
                        }
                        placeholder="e.g. orders@metrotelecom.in"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        GSTIN Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="gstin"
                        value={editFormData.gstin}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, gstin: e.target.value }))
                        }
                        placeholder="e.g. 07AAAAA1111A1Z1"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 uppercase"
                      />
                    </div>
                  </div>

                  {/* 5. Premises Address */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Premises Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={editFormData.address}
                      onChange={(e) =>
                        setEditFormData((prev) => ({ ...prev, address: e.target.value }))
                      }
                      placeholder="e.g. Shop 104, Nehru Place Market"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>

                  {/* 6. City, State, Pincode */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        City <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="city"
                        value={editFormData.city}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, city: e.target.value }))
                        }
                        placeholder="e.g. New Delhi"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        State <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="state"
                        value={editFormData.state}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, state: e.target.value }))
                        }
                        placeholder="e.g. Delhi"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Pincode <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="pincode"
                        value={editFormData.pincode}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, pincode: e.target.value }))
                        }
                        placeholder="e.g. 110019"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-mono font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>
                  </div>

                  {/* 7. Active Status Toggle */}
                  <div className="pt-2">
                    <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={editFormData.isActive}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                        }
                        className="w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          Active Operational Branch
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Toggle whether this firm entity is active in procurement and inventory allocations.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={editSubmitting}
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-600/25 cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    {editSubmitting && <FiLoader className="animate-spin text-sm" />}
                    <span>{editSubmitting ? 'Saving Changes...' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* QUICK VIEW FIRM DETAILS MODAL (Portal) */}
      {selectedFirm &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Frosted Backdrop */}
            <div
              className="fixed inset-0 dark:bg-slate-950/50 backdrop-blur-lg transition-opacity"
              onClick={() => setSelectedFirm(null)}
            />

            {/* Modal Box */}
            <div className="relative w-full max-w-2xl bg-white/20 dark:bg-slate-950/25 border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-lg font-black shrink-0 shadow-sm">
                    {selectedFirm.firmName ? selectedFirm.firmName.charAt(0).toUpperCase() : 'F'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {selectedFirm.firmName}
                      </h3>
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-xs font-bold border border-blue-500/20">
                        {selectedFirm.firmCode}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-slate-400 font-mono">ID: {selectedFirm._id}</span>
                      <CopyButton text={selectedFirm._id} />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedFirm(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  title="Close modal (Esc)"
                >
                  <FiX className="text-xl" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                {/* Status & Parent Company Banner */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0">
                      {selectedFirm.companyId?.logo ? (
                        <img
                          src={selectedFirm.companyId.logo}
                          alt={selectedFirm.companyId.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FiBriefcase className="text-slate-400 text-lg" />
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                        Parent Company
                      </p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {selectedFirm.companyId?.name || 'Not Attached'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                      selectedFirm.isActive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedFirm.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                      }`}
                    />
                    {selectedFirm.isActive ? 'Active Operational Entity' : 'Inactive'}
                  </span>
                </div>

                {/* Grid Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Contact Representative */}
                  <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <FiUser className="text-blue-500" />
                      <span>Contact Representative</span>
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedFirm.contactPerson || '-'}
                    </p>
                    <div className="mt-2 space-y-1 text-xs">
                      {selectedFirm.phone && (
                        <div className="flex items-center gap-2">
                          <FiPhone className="text-slate-400" />
                          <a
                            href={`tel:${selectedFirm.phone}`}
                            className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {selectedFirm.phone}
                          </a>
                        </div>
                      )}
                      {selectedFirm.email && (
                        <div className="flex items-center gap-2">
                          <FiMail className="text-slate-400" />
                          <GmailLink email={selectedFirm.email} label={selectedFirm.email} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Premises & Location */}
                  <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <FiMapPin className="text-rose-500" />
                      <span>Premises & Location</span>
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {selectedFirm.address || '-'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {selectedFirm.city}, {selectedFirm.state} - {selectedFirm.pincode}
                    </p>
                  </div>

                  {/* Tax Identification (GSTIN) */}
                  <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <FiFileText className="text-amber-500" />
                      <span>Tax Identification (GSTIN)</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-white/10">
                        {selectedFirm.gstin || 'Not Provided'}
                      </span>
                      {selectedFirm.gstin && <CopyButton text={selectedFirm.gstin} />}
                    </div>
                  </div>

                  {/* Registration Timestamps */}
                  <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <FiCalendar className="text-indigo-500" />
                      <span>Registration Timestamps</span>
                    </p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Created:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {formatDateTimeDDMMYYYY(selectedFirm.createdAt)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Last Modified:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {formatDateTimeDDMMYYYY(selectedFirm.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleDeleteFirm(selectedFirm)}
                  disabled={actionLoadingId === selectedFirm._id}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  <FiTrash2 className="text-sm" />
                  <span>Delete Firm</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const firm = selectedFirm;
                      setSelectedFirm(null);
                      handleOpenEditModal(firm);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer active:scale-95"
                  >
                    <FiEdit2 className="text-sm" />
                    <span>Edit Firm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFirm(null)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default Firms;
