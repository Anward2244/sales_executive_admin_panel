import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FiCheck, FiLoader, FiAlertCircle, FiSearch, FiServer,
  FiRefreshCcw, FiX, FiCopy, FiCalendar, FiClock, FiPhone,
  FiMail, FiEye, FiExternalLink, FiHash, FiBriefcase,
  FiUsers, FiUserCheck, FiUserX, FiMapPin, FiFileText,
  FiPlus, FiUser, FiCheckCircle, FiEdit2, FiTrash2,
  FiLayers, FiDownload, FiCreditCard, FiChevronLeft, FiChevronRight,
  FiShield, FiAward, FiGlobe, FiMaximize2
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import CopyButton from '@/components/ui/CopyButton';
import CustomDropdown from '@/components/ui/CustomDropdown';
import GmailLink from '@/components/ui/GmailLink';
import { useDisplayPreferences } from '@/utils/displayPreferences';
import { TableRowSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import PageHeader from '@/components/ui/PageHeader';
import { BulkActionBar, BatchProgressModal } from '@/components/ui';
import {
  getFirmsApi,
  createFirmApi,
  updateFirmApi,
  deleteFirmApi,
  getCompaniesApi
} from '@/api/axios';
import { useConfirm } from '@/Context/ConfirmationContext';
import { formatEntityCode, formatPhone, formatGSTIN, formatPincode } from '@/utils/formatters';
import { validateEntityCode, validatePhone, validateEmail, validateGSTIN, validatePincode } from '@/utils/validators';


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

  // Pagination metadata from API response
  const [apiMeta, setApiMeta] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  });

  // Lightbox Document Preview Modal (for PAN, TAN, GST, Cheque, Stamp Proofs)
  const [docPreviewModal, setDocPreviewModal] = useState({
    isOpen: false,
    title: '',
    url: ''
  });

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

  // Bulk Operations State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedFirmIds, setSelectedFirmIds] = useState([]);
  const [isBulkCompanyModalOpen, setIsBulkCompanyModalOpen] = useState(false);
  const [bulkTargetCompanyId, setBulkTargetCompanyId] = useState('');
  const [batchProgress, setBatchProgress] = useState(null);
  const abortBatchRef = useRef(false);

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
  const { preferences: displayPrefs } = useDisplayPreferences();
  const firmsPerPage = displayPrefs.rowsPerPage || 10;

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

        if (response.data.meta) {
          setApiMeta(response.data.meta);
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

          if (resData.meta) {
            setApiMeta(resData.meta);
          }

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
        if (docPreviewModal.isOpen) {
          setDocPreviewModal({ isOpen: false, title: '', url: '' });
          return;
        }
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
  }, [docPreviewModal.isOpen, isCreateModalOpen, createSubmitting, isEditModalOpen, editSubmitting, selectedFirm]);

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

  // Counts for tabs (dynamic based on selected company)
  const tabCounts = useMemo(() => {
    let activeCount = 0;
    let inactiveCount = 0;
    let approvedCount = 0;
    let pendingCount = 0;

    const baseList = selectedCompany
      ? firms.filter((f) => f.companyId?._id === selectedCompany)
      : firms;

    baseList.forEach((f) => {
      if (f.isActive) activeCount++;
      else inactiveCount++;

      const appStatus = (f.approvalStatus || 'APPROVED').toUpperCase();
      if (appStatus === 'PENDING') pendingCount++;
      else if (appStatus === 'APPROVED') approvedCount++;
    });

    return {
      all: baseList.length,
      active: activeCount,
      inactive: inactiveCount,
      approved: approvedCount,
      pending: pendingCount
    };
  }, [firms, selectedCompany]);

  // Tab Filtering
  const tabFilteredFirms = useMemo(() => {
    switch (firmTab) {
      case 'active':
        return firms.filter((f) => f.isActive === true);
      case 'inactive':
        return firms.filter((f) => f.isActive === false);
      case 'approved':
        return firms.filter((f) => (f.approvalStatus || 'APPROVED').toUpperCase() === 'APPROVED');
      case 'pending':
        return firms.filter((f) => (f.approvalStatus || '').toUpperCase() === 'PENDING');
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
        const approvalText = (firm.approvalStatus || 'APPROVED').toLowerCase();
        const submitterEmail = (firm.submittedBy?.email || '').toLowerCase();
        const creditLimitStr = firm.creditLimit ? String(firm.creditLimit) : '';
        const createdAtStr = firm.createdAt ? formatDateDDMMYYYY(firm.createdAt).toLowerCase() : '';

        const panNumber = (firm.panNumber || '').toLowerCase();
        const tanNumber = (firm.tanNumber || '').toLowerCase();
        const bankName = (firm.bankName || '').toLowerCase();
        const businessType = (firm.businessType || '').toLowerCase();
        const designation = (firm.designation || '').toLowerCase();
        const signatory = (firm.authorizedSignatoryName || '').toLowerCase();
        const alternatePhone = (firm.alternatePhone || '').toLowerCase();

        const matches =
          firmName.includes(term) ||
          firmCode.includes(term) ||
          contactPerson.includes(term) ||
          designation.includes(term) ||
          signatory.includes(term) ||
          businessType.includes(term) ||
          email.includes(term) ||
          phone.includes(term) ||
          alternatePhone.includes(term) ||
          id.includes(term) ||
          city.includes(term) ||
          state.includes(term) ||
          gstin.includes(term) ||
          panNumber.includes(term) ||
          tanNumber.includes(term) ||
          bankName.includes(term) ||
          companyName.includes(term) ||
          companyCode.includes(term) ||
          statusText.includes(term) ||
          approvalText.includes(term) ||
          submitterEmail.includes(term) ||
          creditLimitStr.includes(term) ||
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
      } else if (sortKey === 'creditLimit') {
        aVal = a.creditLimit ?? 0;
        bVal = b.creditLimit ?? 0;
      } else if (sortKey === 'approvalStatus') {
        aVal = (a.approvalStatus || 'APPROVED').toLowerCase();
        bVal = (b.approvalStatus || 'APPROVED').toLowerCase();
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

  // Slide-Over Detail Drawer navigation for Firms
  const selectedFirmIndex = useMemo(() => {
    if (!selectedFirm) return -1;
    return sortedFirms.findIndex((f) => f._id === selectedFirm._id);
  }, [selectedFirm, sortedFirms]);

  const canGoPrevFirm = selectedFirmIndex > 0;
  const canGoNextFirm = selectedFirmIndex >= 0 && selectedFirmIndex < sortedFirms.length - 1;

  const handlePrevFirm = useCallback(() => {
    if (selectedFirmIndex > 0) {
      setSelectedFirm(sortedFirms[selectedFirmIndex - 1]);
    }
  }, [selectedFirmIndex, sortedFirms]);

  const handleNextFirm = useCallback(() => {
    if (selectedFirmIndex >= 0 && selectedFirmIndex < sortedFirms.length - 1) {
      setSelectedFirm(sortedFirms[selectedFirmIndex + 1]);
    }
  }, [selectedFirmIndex, sortedFirms]);

  // Drawer keyboard navigation & body scroll lock
  useEffect(() => {
    if (!selectedFirm) return;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      if (e.key === 'Escape') {
        if (docPreviewModal.isOpen) {
          setDocPreviewModal({ isOpen: false, title: '', url: '' });
          return;
        }
        setSelectedFirm(null);
      } else if (e.key === 'ArrowLeft') {
        if (canGoPrevFirm) handlePrevFirm();
      } else if (e.key === 'ArrowRight') {
        if (canGoNextFirm) handleNextFirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFirm, canGoPrevFirm, canGoNextFirm, handlePrevFirm, handleNextFirm, docPreviewModal.isOpen]);

  useEffect(() => {
    if (selectedFirm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedFirm]);

  // Dropdown options
  const companyFilterOptions = useMemo(() => {
    return [
      { value: '', label: 'All Companies' },
      ...allCompanyOptions.map((c) => ({
        value: c.id,
        label: `${c.name}${c.code ? ` (${c.code})` : ''}`
      }))
    ];
  }, [allCompanyOptions]);

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

    // Real-time Format Validation Checks
    const codeVal = validateEntityCode(createFormData.firmCode);
    if (!codeVal.isValid) return setCreateFormError(codeVal.error);

    const phoneVal = validatePhone(createFormData.phone);
    if (!phoneVal.isValid) return setCreateFormError(phoneVal.error);

    const emailVal = validateEmail(createFormData.email);
    if (!emailVal.isValid) return setCreateFormError(emailVal.error);

    const gstinVal = validateGSTIN(createFormData.gstin);
    if (!gstinVal.isValid) return setCreateFormError(gstinVal.error);

    const pinVal = validatePincode(createFormData.pincode);
    if (!pinVal.isValid) return setCreateFormError(pinVal.error);

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
        creditDays: resData.creditDays ?? 30,
        creditLimit: resData.creditLimit ?? 0,
        approvalStatus: resData.approvalStatus || 'APPROVED',
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

    // Real-time Format Validation Checks
    const editCodeVal = validateEntityCode(editFormData.firmCode);
    if (!editCodeVal.isValid) return setEditFormError(editCodeVal.error);

    const editPhoneVal = validatePhone(editFormData.phone);
    if (!editPhoneVal.isValid) return setEditFormError(editPhoneVal.error);

    const editEmailVal = validateEmail(editFormData.email);
    if (!editEmailVal.isValid) return setEditFormError(editEmailVal.error);

    const editGstinVal = validateGSTIN(editFormData.gstin);
    if (!editGstinVal.isValid) return setEditFormError(editGstinVal.error);

    const editPinVal = validatePincode(editFormData.pincode);
    if (!editPinVal.isValid) return setEditFormError(editPinVal.error);

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

  // Toggle single firm active status
  const handleToggleFirmStatus = async (firm) => {
    if (!firm) return;
    const targetId = firm._id;
    const nextActive = !firm.isActive;
    setActionLoadingId(targetId);
    try {
      const res = await updateFirmApi(targetId, { isActive: nextActive });
      const updated = res.data?.data || res.data || { ...firm, isActive: nextActive };
      setFirms((prev) =>
        prev.map((f) => (f._id === targetId ? { ...f, ...updated, isActive: nextActive } : f))
      );
      if (selectedFirm?._id === targetId) {
        setSelectedFirm((prev) => ({ ...prev, ...updated, isActive: nextActive }));
      }
      setSuccessToast(`Firm "${firm.firmName}" marked as ${nextActive ? 'Active' : 'Inactive'}!`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      console.error('Failed to toggle firm status:', err);
      alert(err.response?.data?.message || 'Failed to update firm status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Bulk Selection Helpers
  const toggleSelectFirm = (firmId) => {
    setSelectedFirmIds((prev) =>
      prev.includes(firmId) ? prev.filter((id) => id !== firmId) : [...prev, firmId]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedFirmIds.length === filteredFirms.length) {
      setSelectedFirmIds([]);
    } else {
      setSelectedFirmIds(filteredFirms.map((f) => f._id));
    }
  };

  const handleBulkStatusChange = async (targetActive) => {
    if (selectedFirmIds.length === 0) return;
    const actionLabel = targetActive ? 'Activating' : 'Deactivating';
    abortBatchRef.current = false;
    setBatchProgress({
      isOpen: true,
      title: `Bulk ${targetActive ? 'Activate' : 'Deactivate'} Firms`,
      current: 0,
      total: selectedFirmIds.length,
      percentage: 0,
      status: 'processing',
      logs: [`Starting bulk ${actionLabel.toLowerCase()} for ${selectedFirmIds.length} firms...`]
    });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedFirmIds.length; i++) {
      if (abortBatchRef.current) {
        setBatchProgress((prev) => ({
          ...prev,
          status: 'error',
          logs: [...prev.logs, 'Batch execution aborted by user.']
        }));
        break;
      }

      const fId = selectedFirmIds[i];
      const firm = firms.find((f) => f._id === fId);
      const name = firm ? firm.firmName : fId;

      try {
        await updateFirmApi(fId, { isActive: targetActive });
        successCount++;
        setBatchProgress((prev) => {
          const current = i + 1;
          return {
            ...prev,
            current,
            percentage: Math.round((current / prev.total) * 100),
            logs: [...prev.logs, `✓ Firm "${name}" set to ${targetActive ? 'Active' : 'Inactive'}`]
          };
        });
      } catch (err) {
        failCount++;
        setBatchProgress((prev) => {
          const current = i + 1;
          return {
            ...prev,
            current,
            percentage: Math.round((current / prev.total) * 100),
            logs: [...prev.logs, `✗ Failed to update "${name}": ${err?.response?.data?.message || err.message}`]
          };
        });
      }
    }

    setBatchProgress((prev) => ({
      ...prev,
      status: prev.status === 'error' ? 'error' : 'completed',
      logs: [
        ...prev.logs,
        `Finished! Success: ${successCount}, Failed: ${failCount}`
      ]
    }));

    await fetchFirms(true);
    setSuccessToast(`Bulk status updated: ${successCount} succeeded, ${failCount} failed`);
    setTimeout(() => setSuccessToast(''), 4000);
  };

  const handleBulkReassignCompany = async () => {
    if (!bulkTargetCompanyId || selectedFirmIds.length === 0) return;
    const targetComp = allCompanyOptions.find((c) => c.id === bulkTargetCompanyId);
    const compName = targetComp ? targetComp.name : 'Selected Company';

    setIsBulkCompanyModalOpen(false);
    abortBatchRef.current = false;
    setBatchProgress({
      isOpen: true,
      title: `Bulk Reassign Firms to "${compName}"`,
      current: 0,
      total: selectedFirmIds.length,
      percentage: 0,
      status: 'processing',
      logs: [`Starting company reassignment to "${compName}" for ${selectedFirmIds.length} firms...`]
    });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedFirmIds.length; i++) {
      if (abortBatchRef.current) {
        setBatchProgress((prev) => ({
          ...prev,
          status: 'error',
          logs: [...prev.logs, 'Batch execution aborted by user.']
        }));
        break;
      }

      const fId = selectedFirmIds[i];
      const firm = firms.find((f) => f._id === fId);
      const name = firm ? firm.firmName : fId;

      try {
        await updateFirmApi(fId, { companyId: bulkTargetCompanyId });
        successCount++;
        setBatchProgress((prev) => {
          const current = i + 1;
          return {
            ...prev,
            current,
            percentage: Math.round((current / prev.total) * 100),
            logs: [...prev.logs, `✓ Firm "${name}" moved to "${compName}"`]
          };
        });
      } catch (err) {
        failCount++;
        setBatchProgress((prev) => {
          const current = i + 1;
          return {
            ...prev,
            current,
            percentage: Math.round((current / prev.total) * 100),
            logs: [...prev.logs, `✗ Failed to reassign "${name}": ${err?.response?.data?.message || err.message}`]
          };
        });
      }
    }

    setBatchProgress((prev) => ({
      ...prev,
      status: prev.status === 'error' ? 'error' : 'completed',
      logs: [
        ...prev.logs,
        `Finished! Success: ${successCount}, Failed: ${failCount}`
      ]
    }));

    await fetchFirms(true);
    setSuccessToast(`Reassigned ${successCount} firms to ${compName}`);
    setTimeout(() => setSuccessToast(''), 4000);
  };

  const handleBulkExportFirms = () => {
    const selectedFirmsList = firms.filter((f) => selectedFirmIds.includes(f._id));
    if (selectedFirmsList.length === 0) return;

    const exportRows = selectedFirmsList.map((f, idx) => {
      const compName = f.companyId?.name || f.companyId?.code || 'N/A';
      return {
        'S.No.': idx + 1,
        'Firm Name': f.firmName || '',
        'Firm Code': f.firmCode || '',
        'Parent Company': compName,
        'Approval Status': f.approvalStatus || 'APPROVED',
        'Credit Limit (₹)': f.creditLimit ?? 0,
        'Credit Days': f.creditDays ?? 30,
        'Contact Person': f.contactPerson || '',
        'Phone': f.phone || '',
        'Email': f.email || '',
        'Address': f.address || '',
        'City': f.city || '',
        'State': f.state || '',
        'Pincode': f.pincode || '',
        'GSTIN': f.gstin || '',
        'Submitted By': f.submittedBy?.email || f.submittedBy?.phone || '',
        'Status': f.isActive ? 'Active' : 'Inactive',
        'Created At': f.createdAt ? formatDateDDMMYYYY(f.createdAt) : ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Firms');
    XLSX.writeFile(workbook, `Firms_Bulk_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setSuccessToast(`Exported ${selectedFirmsList.length} firms to Excel.`);
    setTimeout(() => setSuccessToast(''), 4000);
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

      {/* Top Title & Header Search */}
      <PageHeader
        title="Firms List"
        icon={FiServer}
        description="Manage business firms, regulatory profiles, GST compliance, and entity branches."
        action={
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="text"
                placeholder="Search by name, code, contact, GSTIN, city..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all shadow-xs"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => fetchFirms(false)}
              disabled={loading}
              className="p-2.5 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer shadow-xs shrink-0 disabled:opacity-50"
              title="Refresh Firms"
            >
              <FiRefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        }
      />

      {/* Unified Action & Filter Bar */}
      <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-md flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Left: Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setCreateFormError('');
              setCreateFormData(INITIAL_FORM_STATE);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer shrink-0 active:scale-95"
          >
            <FiPlus className="w-3.5 h-3.5" />
            <span>Add Firm</span>
          </button>

          {/* Bulk Operations Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setIsBulkMode((prev) => !prev);
              if (isBulkMode) setSelectedFirmIds([]);
            }}
            className={`flex items-center gap-2 px-3.5 py-2.5 border text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer active:scale-95 shrink-0 ${
              isBulkMode
                ? 'bg-blue-600 border-blue-600 text-white shadow-blue-500/20 shadow-md'
                : 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-white/10 hover:border-blue-500/40 text-slate-700 dark:text-slate-200'
            }`}
          >
            <FiLayers className={`text-sm ${isBulkMode ? 'text-white' : 'text-blue-500'}`} />
            <span>Bulk Operations</span>
            {selectedFirmIds.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-blue-700 text-white text-[10px] rounded-full font-bold">
                {selectedFirmIds.length}
              </span>
            )}
          </button>
        </div>

        {/* Right: Segmented Status Tabs + Company Selector + Reset */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between lg:justify-end">
          {/* Status Segmented Tabs */}
          <div className="flex items-center p-1 bg-slate-100/80 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => handleTabChange('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                firmTab === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <span>All</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-extrabold ${
                  firmTab === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                }`}
              >
                {tabCounts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('approved')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                firmTab === 'approved'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <span>Approved</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-extrabold ${
                  firmTab === 'approved'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {tabCounts.approved}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('pending')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                firmTab === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <span>Pending</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-extrabold ${
                  firmTab === 'pending'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}
              >
                {tabCounts.pending}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('active')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                firmTab === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <span>Active</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-extrabold ${
                  firmTab === 'active'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {tabCounts.active}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('inactive')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                firmTab === 'inactive'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <span>Inactive</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-extrabold ${
                  firmTab === 'inactive'
                    ? 'bg-white/20 text-white'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}
              >
                {tabCounts.inactive}
              </span>
            </button>
          </div>

          {/* Parent Company Dropdown */}
          <div className="w-full sm:w-auto min-w-[170px] sm:min-w-[190px]">
            <CustomDropdown
              value={selectedCompany}
              onChange={(val) => handleFilterChange('company', val)}
              options={companyFilterOptions}
              defaultLabel="All Companies"
              statusColor={`!px-3 !py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-black/20 font-bold ${
                selectedCompany ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
              }`}
            />
          </div>

          {/* Reset Filters */}
          {(searchTerm || selectedCompany || selectedStatus || firmTab !== 'all') && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:hover:text-white text-xs font-bold rounded-xl border border-slate-300 dark:border-white/10 transition-all cursor-pointer shrink-0"
              title="Reset Filters"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Info Strip */}
      {(searchTerm || selectedCompany || selectedStatus || firmTab !== 'all') && (
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 -mt-2">
          <span>
            Showing <strong className="text-slate-900 dark:text-white">{sortedFirms.length}</strong> of{' '}
            <strong className="text-slate-900 dark:text-white">{firms.length}</strong> firms
          </span>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer text-xs"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Content Area (matching Users.jsx) */}
      {loading ? (
        <TableSkeleton columns={8} rows={8} />
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
        <div className="relative z-10 bg-white/40 dark:bg-transparent border border-slate-200/80 dark:border-white/10 shadow-xl dark:shadow-2xl shadow-slate-500/30 dark:shadow-black/50 rounded-3xl overflow-hidden flex flex-col h-full isolate will-change-transform">
          <div className="overflow-auto custom-scrollbar max-h-[70vh]">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-200">
              <thead className="sticky top-0 z-20 bg-white/60 dark:bg-slate-900/80 backdrop-blur-md shadow-xs dark:shadow-md border-b border-slate-200/80 dark:border-white/10">
                <tr className="border-b border-slate-200/80 dark:border-white/10 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  {isBulkMode && (
                    <th className="p-3 text-center w-12">
                      <input
                        type="checkbox"
                        checked={filteredFirms.length > 0 && selectedFirmIds.length === filteredFirms.length}
                        onChange={handleSelectAllFiltered}
                        className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                    </th>
                  )}
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

                  {/* Credit Terms Sort */}
                  <th
                    onClick={() => handleSortChange('creditLimit')}
                    className="p-4 font-bold text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={sortKey === 'creditLimit' ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>
                        Credit Terms
                      </span>
                      {sortKey === 'creditLimit' ? (
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

                  {/* Status & Approval */}
                  <th
                    onClick={() => handleSortChange('approvalStatus')}
                    className="p-4 font-bold text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={sortKey === 'approvalStatus' ? 'text-blue-600 dark:text-blue-400 font-extrabold' : ''}>
                        Status & Approval
                      </span>
                      {sortKey === 'approvalStatus' ? (
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

                    const isSelected = selectedFirmIds.includes(firm._id);

                    return (
                      <tr
                        key={firm._id}
                        className={`hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors group ${
                          isBulkMode && isSelected
                            ? 'bg-blue-50/60 dark:bg-blue-900/10'
                            : ''
                        }`}
                      >
                        {isBulkMode && (
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectFirm(firm._id)}
                              className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            />
                          </td>
                        )}
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
                                {firm.businessType && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-white/10">
                                    {firm.businessType}
                                  </span>
                                )}
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
                          <div>
                            <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-200 text-xs">
                              <FiUser className="text-slate-400 text-xs shrink-0" />
                              <span>{firm.contactPerson || '-'}</span>
                            </div>
                            {firm.designation && (
                              <span className="text-[10px] text-slate-400 block font-normal ml-4">
                                {firm.designation}
                              </span>
                            )}
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
                          <div className="flex flex-col items-center gap-1">
                            {firm.gstin ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/80 dark:bg-amber-500/10 text-white dark:text-amber-600 border border-amber-500/20 text-xs font-mono font-bold">
                                {firm.gstin}
                                <CopyButton text={firm.gstin} />
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                            {(firm.panCardUrl || firm.tanCertificateUrl || firm.gstCertificateUrl || firm.cancelledChequeUrl || firm.companySealOrSignatureUrl) && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20"
                                title="Statutory documents attached"
                              >
                                <FiFileText size={9} /> KYC Docs
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Credit Terms */}
                        <td className="p-4 text-sm text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              ₹{(firm.creditLimit ?? 0).toLocaleString('en-IN')}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {firm.creditDays ?? 30} days
                            </span>
                          </div>
                        </td>

                        {/* Status & Approval */}
                        <td className="p-4 text-sm text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            {(() => {
                              const appStatus = (firm.approvalStatus || 'APPROVED').toUpperCase();
                              if (appStatus === 'PENDING') {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    PENDING
                                  </span>
                                );
                              }
                              if (appStatus === 'REJECTED') {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                                    <FiUserX size={11} />
                                    REJECTED
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                  <FiCheckCircle size={11} />
                                  APPROVED
                                </span>
                              );
                            })()}
                            <span
                              onClick={() => handleToggleFirmStatus(firm)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                                firm.isActive
                                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/30'
                                  : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-300'
                              }`}
                              title={`Click to ${firm.isActive ? 'deactivate' : 'activate'}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${firm.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              <span>{firm.isActive ? 'Active' : 'Inactive'}</span>
                            </span>
                          </div>
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
                              className="inline-flex items-center gap-1.5 px-1.5 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 border border-blue-200/60 dark:border-blue-500/20 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                              title="View firm details"
                            >
                              <FiEye className="text-base" />
                            </button>

                            {/* Edit Firm (PATCH /firms/{id}) */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(firm)}
                              className="inline-flex items-center gap-1.5 px-1.5 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 border border-amber-200/60 dark:border-amber-500/20 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                              title="Edit firm details"
                            >
                              <FiEdit2 className="text-base" />
                            </button>

                            {/* Delete Firm (DELETE /firms/{id}) */}
                            <button
                              type="button"
                              onClick={() => handleDeleteFirm(firm)}
                              disabled={actionLoadingId === firm._id}
                              className="inline-flex items-center gap-1.5 px-1.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-200/60 dark:border-rose-500/20 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                              title="Delete firm"
                            >
                              {actionLoadingId === firm._id ? (
                                <FiLoader className="text-base animate-spin text-rose-500" />
                              ) : (
                                <FiTrash2 className="text-base" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isBulkMode ? 14 : 13} className="p-12 text-center text-slate-500 dark:text-slate-400">
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
                      <CustomDropdown
                        value={createFormData.companyId}
                        onChange={(val) =>
                          setCreateFormData((prev) => ({ ...prev, companyId: val }))
                        }
                        defaultLabel="-- Select Parent Enterprise --"
                        options={[
                          { value: '', label: '-- Select Parent Enterprise --' },
                          ...allCompanyOptions.map((comp) => ({
                            value: comp.id,
                            label: `${comp.name} ${comp.code ? `(${comp.code})` : ''}`
                          }))
                        ]}
                        statusColor="!px-3.5 !py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white"
                      />
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
                          setCreateFormData((prev) => ({ ...prev, firmCode: formatEntityCode(e.target.value) }))
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
                          setCreateFormData((prev) => ({ ...prev, phone: formatPhone(e.target.value) }))
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
                          setCreateFormData((prev) => ({ ...prev, gstin: formatGSTIN(e.target.value) }))
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
                          setCreateFormData((prev) => ({ ...prev, pincode: formatPincode(e.target.value) }))
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
                      <CustomDropdown
                        value={editFormData.companyId}
                        onChange={(val) =>
                          setEditFormData((prev) => ({ ...prev, companyId: val }))
                        }
                        defaultLabel="-- Select Parent Enterprise --"
                        options={[
                          { value: '', label: '-- Select Parent Enterprise --' },
                          ...allCompanyOptions.map((comp) => ({
                            value: comp.id,
                            label: `${comp.name} ${comp.code ? `(${comp.code})` : ''}`
                          }))
                        ]}
                        statusColor="!px-3.5 !py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white"
                      />
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
                          setEditFormData((prev) => ({ ...prev, firmCode: formatEntityCode(e.target.value) }))
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
                          setEditFormData((prev) => ({ ...prev, phone: formatPhone(e.target.value) }))
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
                          setEditFormData((prev) => ({ ...prev, gstin: formatGSTIN(e.target.value) }))
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
                          setEditFormData((prev) => ({ ...prev, pincode: formatPincode(e.target.value) }))
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

      {/* QUICK VIEW FIRM DETAILS SLIDE-OVER DRAWER (Portal) */}
      {selectedFirm &&
        createPortal(
          <div className="fixed inset-0 z-[10000] overflow-hidden">
            {/* Backdrop Blur Overlay */}
            <div
              className="fixed inset-0 dark:bg-slate-950/60 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
              onClick={() => setSelectedFirm(null)}
            />

            {/* Slide-Over Drawer Container (Pinned to Right) */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-6 md:pl-10">
              <div className="w-screen max-w-full sm:max-w-2xl md:max-w-3xl bg-white/40 dark:bg-slate-950/25 border-l border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 z-10 backdrop-blur-2xl">
                {/* 1. Sticky Drawer Header */}
                <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md gap-2 sm:gap-4">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-base sm:text-lg font-black shrink-0 shadow-sm">
                      {selectedFirm.firmName ? selectedFirm.firmName.charAt(0).toUpperCase() : 'F'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                          {selectedFirm.firmName}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[10px] sm:text-xs font-bold border border-blue-500/20">
                          {selectedFirm.firmCode}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] sm:text-xs text-slate-400 font-mono">ID: {selectedFirm._id}</span>
                        <CopyButton text={selectedFirm._id} />
                      </div>
                    </div>
                  </div>

                  {/* Header Actions: Stepping & Close */}
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    {selectedFirmIndex >= 0 && (
                      <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl p-0.5 sm:p-1 text-xs">
                        <button
                          type="button"
                          onClick={handlePrevFirm}
                          disabled={!canGoPrevFirm}
                          title="Previous Firm (Left Arrow)"
                          className="p-1 sm:p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <FiChevronLeft size={15} />
                        </button>
                        <span className="px-1.5 font-mono text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-semibold select-none">
                          {selectedFirmIndex + 1} of {sortedFirms.length}
                        </span>
                        <button
                          type="button"
                          onClick={handleNextFirm}
                          disabled={!canGoNextFirm}
                          title="Next Firm (Right Arrow)"
                          className="p-1 sm:p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <FiChevronRight size={15} />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedFirm(null)}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                      title="Close drawer (Esc)"
                    >
                      <FiX size={18} />
                    </button>
                  </div>
                </div>

                {/* 2. Scrollable Drawer Body */}
                <div className="flex-1 p-4 sm:p-7 overflow-y-auto custom-scrollbar space-y-5 sm:space-y-6">
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

                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const appStatus = (selectedFirm.approvalStatus || 'APPROVED').toUpperCase();
                      if (appStatus === 'PENDING') {
                        return (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              Approval: PENDING
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFirm(null);
                                navigate('/firms/onboarding');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer"
                              title="Go to customer onboarding requests"
                            >
                              <FiExternalLink className="text-xs" />
                              <span>Review</span>
                            </button>
                          </div>
                        );
                      }
                      if (appStatus === 'REJECTED') {
                        return (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                            <FiUserX className="text-xs" />
                            Approval: REJECTED
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                          <FiCheckCircle className="text-xs" />
                          Approval: APPROVED
                        </span>
                      );
                    })()}

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
                      {selectedFirm.isActive ? 'Active Operational' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Grid 1: Business Profile & Contact Rep */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Business Profile & Entity Type */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-3">
                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <FiBriefcase className="text-blue-500" />
                      Business & Establishment
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Business Type</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-200/60 dark:bg-white/10 px-2 py-0.5 rounded text-[11px]">
                          {selectedFirm.businessType || 'Proprietorship'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Established Date</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">
                          {selectedFirm.dateOfEstablishment ? formatDateDDMMYYYY(selectedFirm.dateOfEstablishment) : '-'}
                        </span>
                      </div>
                      {selectedFirm.website && (
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-400">Website</span>
                          <a
                            href={selectedFirm.website.startsWith('http') ? selectedFirm.website : `https://${selectedFirm.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate max-w-[170px]"
                          >
                            <FiGlobe size={11} />
                            <span className="truncate">{selectedFirm.website}</span>
                          </a>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Cash Discount</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                          {selectedFirm.cashDiscount !== undefined && selectedFirm.cashDiscount !== null ? `${selectedFirm.cashDiscount}%` : '0%'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Representative */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-3">
                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <FiUser className="text-indigo-500" />
                      Contact Representative
                    </p>
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] text-slate-400">Name & Designation</span>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedFirm.contactPerson || '-'}
                          {selectedFirm.designation && (
                            <span className="text-slate-400 text-[11px] font-normal block">
                              {selectedFirm.designation}
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Primary Phone</span>
                        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200 font-semibold font-mono">
                          <span>{selectedFirm.phone || '-'}</span>
                          {selectedFirm.phone && <CopyButton text={selectedFirm.phone} />}
                        </div>
                      </div>
                      {selectedFirm.alternatePhone && (
                        <div>
                          <span className="text-[10px] text-slate-400">Alternate Phone</span>
                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-mono">
                            <span>{selectedFirm.alternatePhone}</span>
                            <CopyButton text={selectedFirm.alternatePhone} />
                          </div>
                        </div>
                      )}
                      {selectedFirm.email && (
                        <div>
                          <span className="text-[10px] text-slate-400">Email Address</span>
                          <div className="mt-0.5">
                            <GmailLink email={selectedFirm.email} label={selectedFirm.email} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Grid 2: Premises & Financial Terms */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Premises & Operating Address */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-3">
                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <FiMapPin className="text-rose-500" />
                      Premises & Address
                    </p>
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] text-slate-400">Registered Address</span>
                        <p className="font-semibold text-slate-700 dark:text-slate-200 leading-snug">
                          {selectedFirm.address || '-'}
                        </p>
                      </div>
                      {selectedFirm.branchAddress && (
                        <div>
                          <span className="text-[10px] text-slate-400">Branch Address</span>
                          <p className="font-medium text-slate-600 dark:text-slate-300 leading-snug">
                            {selectedFirm.branchAddress}
                          </p>
                        </div>
                      )}
                      <div className="pt-1 border-t border-slate-200/60 dark:border-white/5 flex justify-between">
                        <span className="text-[10px] text-slate-400">City, State, PIN</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {[selectedFirm.city, selectedFirm.state, selectedFirm.pincode].filter(Boolean).join(', ') || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial & Credit Terms */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-3">
                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <FiCreditCard className="text-emerald-500" />
                      Credit & Terms
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-slate-400">Approved Credit Limit</span>
                        <span className="font-bold text-base text-slate-900 dark:text-white font-mono">
                          ₹{(selectedFirm.creditLimit ?? 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-slate-400">Credit Days Window</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">
                          {selectedFirm.creditDays ?? 30} Days
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-slate-400">Cash Discount</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {selectedFirm.cashDiscount ?? 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Statutory Tax & Document Proofs (PAN, TAN, GSTIN, MSME) */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <FiFileText className="text-amber-500" />
                      Statutory KYC & Tax Proofs
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono">Click documents to preview</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {/* PAN Card Proof */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">PAN Card</span>
                        {selectedFirm.panCardUrl ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded">
                            Uploaded
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400">Not Uploaded</span>
                        )}
                      </div>
                      <div className="font-mono text-xs font-bold text-slate-800 dark:text-white">
                        {selectedFirm.panNumber || 'Not Provided'}
                      </div>
                      {selectedFirm.panCardUrl && (
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setDocPreviewModal({
                                isOpen: true,
                                title: `PAN Card (${selectedFirm.panNumber || selectedFirm.firmName})`,
                                url: selectedFirm.panCardUrl
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-[11px] font-bold transition-all cursor-pointer"
                          >
                            <FiEye size={12} />
                            <span>Preview</span>
                          </button>
                          <a
                            href={selectedFirm.panCardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-slate-600 p-1"
                            title="Open direct image"
                          >
                            <FiExternalLink size={12} />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* TAN Certificate Proof */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">TAN Certificate</span>
                        {selectedFirm.tanCertificateUrl ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded">
                            Uploaded
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400">Not Uploaded</span>
                        )}
                      </div>
                      <div className="font-mono text-xs font-bold text-slate-800 dark:text-white">
                        {selectedFirm.tanNumber || 'Not Provided'}
                      </div>
                      {selectedFirm.tanCertificateUrl && (
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setDocPreviewModal({
                                isOpen: true,
                                title: `TAN Certificate (${selectedFirm.tanNumber || selectedFirm.firmName})`,
                                url: selectedFirm.tanCertificateUrl
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-[11px] font-bold transition-all cursor-pointer"
                          >
                            <FiEye size={12} />
                            <span>Preview</span>
                          </button>
                          <a
                            href={selectedFirm.tanCertificateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-slate-600 p-1"
                            title="Open direct image"
                          >
                            <FiExternalLink size={12} />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* GSTIN & Certificate */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">GSTIN</span>
                        {selectedFirm.gstCertificateUrl ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded">
                            Proof Attached
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400">Self Declared</span>
                        )}
                      </div>
                      <div className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {selectedFirm.gstin || 'Not Provided'}
                      </div>
                      {selectedFirm.gstCertificateUrl && (
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setDocPreviewModal({
                                isOpen: true,
                                title: `GST Certificate (${selectedFirm.gstin || selectedFirm.firmName})`,
                                url: selectedFirm.gstCertificateUrl
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-[11px] font-bold transition-all cursor-pointer"
                          >
                            <FiEye size={12} />
                            <span>Preview</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Additional Certificates if uploaded */}
                  {(selectedFirm.msmeNumber || selectedFirm.msmeCertificateUrl || selectedFirm.incorporationCertificateUrl || selectedFirm.otherLicensesUrl) && (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex flex-wrap gap-2 text-[11px]">
                      {selectedFirm.msmeNumber && (
                        <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 font-mono">
                          MSME: <strong>{selectedFirm.msmeNumber}</strong>
                        </span>
                      )}
                      {selectedFirm.msmeCertificateUrl && (
                        <button
                          type="button"
                          onClick={() => setDocPreviewModal({ isOpen: true, title: 'MSME Certificate', url: selectedFirm.msmeCertificateUrl })}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-500/20 flex items-center gap-1 cursor-pointer"
                        >
                          <FiEye size={11} /> MSME Certificate
                        </button>
                      )}
                      {selectedFirm.incorporationCertificateUrl && (
                        <button
                          type="button"
                          onClick={() => setDocPreviewModal({ isOpen: true, title: 'Incorporation Certificate', url: selectedFirm.incorporationCertificateUrl })}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-500/20 flex items-center gap-1 cursor-pointer"
                        >
                          <FiEye size={11} /> Incorporation Doc
                        </button>
                      )}
                      {selectedFirm.otherLicensesUrl && (
                        <button
                          type="button"
                          onClick={() => setDocPreviewModal({ isOpen: true, title: 'Trade / Business License', url: selectedFirm.otherLicensesUrl })}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-500/20 flex items-center gap-1 cursor-pointer"
                        >
                          <FiEye size={11} /> Other Licenses
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 4: Banking & Signatory Stamp */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Banking Details */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-3">
                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <FiCreditCard className="text-purple-500" />
                      Banking Credentials
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Bank Name</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedFirm.bankName || 'Not Provided'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Account Number</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {selectedFirm.accountNumber || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">IFSC Code</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {selectedFirm.ifscCode || '-'}
                        </span>
                      </div>
                      {selectedFirm.cancelledChequeUrl && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Cancelled Cheque</span>
                          <button
                            type="button"
                            onClick={() =>
                              setDocPreviewModal({
                                isOpen: true,
                                title: `Cancelled Cheque Proof (${selectedFirm.bankName || selectedFirm.firmName})`,
                                url: selectedFirm.cancelledChequeUrl
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[11px] font-bold hover:bg-purple-100 transition-all cursor-pointer"
                          >
                            <FiEye size={12} />
                            <span>View Cheque</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Declaration & Signatory Stamp */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-3">
                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <FiShield className="text-emerald-500" />
                      Signatory & Authorization
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Signatory</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedFirm.authorizedSignatoryName || selectedFirm.contactPerson || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Designation</span>
                        <span className="text-slate-600 dark:text-slate-300">
                          {selectedFirm.signatoryDesignation || selectedFirm.designation || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Declaration</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${selectedFirm.declarationAgreed ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 text-slate-600'}`}>
                          <FiCheck size={10} />
                          {selectedFirm.declarationAgreed ? 'Agreed & Signed' : 'Self Declared'}
                        </span>
                      </div>
                      {selectedFirm.companySealOrSignatureUrl && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Stamp / Signature Proof</span>
                          <button
                            type="button"
                            onClick={() =>
                              setDocPreviewModal({
                                isOpen: true,
                                title: `Official Stamp / Signature (${selectedFirm.firmName})`,
                                url: selectedFirm.companySealOrSignatureUrl
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold hover:bg-emerald-100 transition-all cursor-pointer"
                          >
                            <FiEye size={12} />
                            <span>View Stamp Proof</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Audit & Submitter Metadata */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Submitted By</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                      {selectedFirm.submittedBy?.email || selectedFirm.submittedBy?.phone || 'Sales Executive / Admin'}
                    </p>
                    {selectedFirm.submittedBy?.role && (
                      <span className="inline-block mt-1 text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded">
                        {selectedFirm.submittedBy.role}
                      </span>
                    )}
                    <p className="text-slate-400 text-[10px] mt-1">
                      Registered on: {selectedFirm.createdAt ? formatDateTimeDDMMYYYY(selectedFirm.createdAt) : '-'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Reviewed / Updated</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                      {selectedFirm.reviewedBy?.email || 'Operations / Admin'}
                    </p>
                    <p className="text-slate-400 text-[10px] mt-1">
                      Last modified: {selectedFirm.updatedAt ? formatDateTimeDDMMYYYY(selectedFirm.updatedAt) : '-'}
                    </p>
                  </div>
                </div>
              </div>

                {/* 3. Sticky Drawer Footer */}
                <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
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
                      Close Drawer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Floating Bulk Action Bar */}
      {isBulkMode && (
        <BulkActionBar
          selectedCount={selectedFirmIds.length}
          totalCount={filteredFirms.length}
          onClearSelection={() => setSelectedFirmIds([])}
          onSelectAll={handleSelectAllFiltered}
          isAllSelected={selectedFirmIds.length > 0 && selectedFirmIds.length === filteredFirms.length}
          onExitBulkMode={() => {
            setIsBulkMode(false);
            setSelectedFirmIds([]);
          }}
          actions={[
            {
              id: 'activate',
              label: 'Activate',
              icon: FiUserCheck,
              variant: 'primary',
              disabled: selectedFirmIds.length === 0,
              onClick: () => handleBulkStatusChange(true)
            },
            {
              id: 'deactivate',
              label: 'Deactivate',
              icon: FiUserX,
              variant: 'danger',
              disabled: selectedFirmIds.length === 0,
              onClick: () => handleBulkStatusChange(false)
            },
            {
              id: 'reassign-company',
              label: 'Reassign Company',
              icon: FiBriefcase,
              variant: 'warning',
              disabled: selectedFirmIds.length === 0,
              onClick: () => {
                setBulkTargetCompanyId(allCompanyOptions[0]?.id || '');
                setIsBulkCompanyModalOpen(true);
              }
            },
            {
              id: 'export',
              label: 'Export Excel',
              icon: FiDownload,
              variant: 'secondary',
              disabled: selectedFirmIds.length === 0,
              onClick: handleBulkExportFirms
            }
          ]}
        />
      )}

      {/* Bulk Company Reassignment Modal */}
      {isBulkCompanyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-2xl mb-4">
              <FiBriefcase />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Reassign Parent Company</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Reassign <span className="font-bold text-slate-800 dark:text-slate-200">{selectedFirmIds.length}</span> selected firms to the following parent company:
            </p>

            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                Target Company
              </label>
              <select
                value={bulkTargetCompanyId}
                onChange={(e) => setBulkTargetCompanyId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                {allCompanyOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBulkCompanyModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkReassignCompany}
                disabled={!bulkTargetCompanyId}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-amber-600/25 cursor-pointer disabled:opacity-50"
              >
                Apply Reassignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Document Preview Modal (Portal) */}
      {docPreviewModal.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-3 sm:p-5 dark:bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div
              className="fixed inset-0"
              onClick={() => setDocPreviewModal({ isOpen: false, title: '', url: '' })}
            />
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-base shrink-0">
                    <FiFileText />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {docPreviewModal.title || 'Document Preview'}
                    </h4>
                    <p className="text-[11px] font-mono text-slate-400 truncate max-w-sm sm:max-w-md">
                      {docPreviewModal.url}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={docPreviewModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-xs font-bold transition-all"
                  >
                    <FiExternalLink size={13} />
                    <span className="hidden sm:inline">Open in New Tab</span>
                  </a>
                  <CopyButton text={docPreviewModal.url} />
                  <button
                    type="button"
                    onClick={() => setDocPreviewModal({ isOpen: false, title: '', url: '' })}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <FiX size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Image/Doc Content */}
              <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-slate-100/50 dark:bg-black/40 min-h-[320px]">
                {docPreviewModal.url?.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={docPreviewModal.url}
                    title={docPreviewModal.title}
                    className="w-full h-[65vh] rounded-xl border border-slate-200 dark:border-white/10"
                  />
                ) : (
                  <img
                    src={docPreviewModal.url}
                    alt={docPreviewModal.title}
                    className="max-h-[65vh] max-w-full object-contain rounded-xl shadow-lg border border-slate-200/60 dark:border-white/10"
                  />
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Batch Progress Modal */}
      {batchProgress && (
        <BatchProgressModal
          isOpen={batchProgress.isOpen}
          title={batchProgress.title}
          current={batchProgress.current}
          total={batchProgress.total}
          percentage={batchProgress.percentage}
          status={batchProgress.status}
          logs={batchProgress.logs}
          onAbort={() => { abortBatchRef.current = true; }}
          onClose={() => setBatchProgress(null)}
        />
      )}
    </div>
  );
};

export default Firms;
