import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FiCheck, FiLoader, FiAlertCircle, FiSearch, FiServer,
  FiRefreshCcw, FiX, FiClock, FiPhone, FiEye, FiBriefcase,
  FiUserCheck, FiUserX, FiMapPin, FiPlus, FiUser,
  FiCheckCircle, FiLayers, FiDownload, FiDollarSign,
  FiAlertTriangle
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import CopyButton from '@/components/ui/CopyButton';
import CustomDropdown from '@/components/ui/CustomDropdown';
import GmailLink from '@/components/ui/GmailLink';
import { useDisplayPreferences } from '@/utils/displayPreferences';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import PageHeader from '@/components/ui/PageHeader';
import {
  getFirmOnboardingRequestsApi,
  onboardFirmApi,
  reviewFirmApi,
  getCompaniesApi
} from '@/api/axios';
import { formatEntityCode, formatPhone, formatGSTIN, formatPincode } from '@/utils/formatters';
import { validateEntityCode, validatePhone, validateEmail, validateGSTIN, validatePincode } from '@/utils/validators';

const INITIAL_ONBOARD_FORM = {
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
  creditDays: 30,
  creditLimit: 500000
};

const PRESET_REJECTION_REASONS = [
  'Invalid GSTIN or duplicate business entity',
  'KYC documentation incomplete or mismatched',
  'Credit limit requested exceeds permissible threshold',
  'Contact person details unverified',
  'Address or business premises verification failed',
  'Operational conflict with existing regional distributor'
];

const FirmOnboarding = () => {
  const navigate = useNavigate();

  // Requests state
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Companies loaded for dropdown
  const [availableCompanies, setAvailableCompanies] = useState([]);

  // Submit New Onboarding Request Modal State
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [onboardFormData, setOnboardFormData] = useState(INITIAL_ONBOARD_FORM);
  const [onboardSubmitting, setOnboardSubmitting] = useState(false);
  const [onboardFormError, setOnboardFormError] = useState('');

  // Review Modal State (Approve / Reject)
  const [reviewModalState, setReviewModalState] = useState({
    isOpen: false,
    item: null,
    action: 'APPROVED', // 'APPROVED' | 'REJECTED'
    rejectionReason: '',
    customReason: '',
    submitting: false,
    error: ''
  });

  // Global Toast
  const [successToast, setSuccessToast] = useState('');

  // URL Search & Filter Params
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSearchParam = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(rawSearchParam);
  const lastPushedSearchRef = useRef(rawSearchParam);
  const searchTerm = rawSearchParam;
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const selectedCompany = searchParams.get('company') || '';
  const selectedStatus = searchParams.get('status') || 'ALL';

  // Display Preferences
  const { preferences: displayPrefs } = useDisplayPreferences();
  const rowsPerPage = displayPrefs.rowsPerPage || 10;

  // Sync local input with URL
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch !== lastPushedSearchRef.current) {
      setSearchInput(urlSearch);
      lastPushedSearchRef.current = urlSearch;
    }
  }, [searchParams]);

  // Debounce search
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
        return prev;
      });
      lastPushedSearchRef.current = searchInput;
    }, 350);

    return () => clearTimeout(delayDebounce);
  }, [searchInput, setSearchParams]);

  // Fetch Onboarding Requests
  const fetchRequests = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError('');
    try {
      const response = await getFirmOnboardingRequestsApi();
      let list = [];
      if (response && response.data) {
        if (Array.isArray(response.data.data)) {
          list = response.data.data;
        } else if (Array.isArray(response.data)) {
          list = response.data;
        } else if (Array.isArray(response.data.requests)) {
          list = response.data.requests;
        }
      }
      setRequests(list);
    } catch (err) {
      console.error('Fetch firm onboarding requests error:', err);
      if (!isSilent) {
        setError(err.response?.data?.message || 'Failed to load firm onboarding requests.');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Load Companies
  useEffect(() => {
    let ignore = false;
    getCompaniesApi({ page: 1, limit: 100 })
      .then((res) => {
        if (!ignore && res?.data) {
          const list = Array.isArray(res.data.data)
            ? res.data.data
            : Array.isArray(res.data)
              ? res.data
              : Array.isArray(res.data.companies)
                ? res.data.companies
                : [];
          if (list.length > 0) {
            setAvailableCompanies(list);
          }
        }
      })
      .catch((err) => {
        console.warn('Company options fetch warning:', err);
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Modal ESC Key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isOnboardModalOpen && !onboardSubmitting) {
          setIsOnboardModalOpen(false);
        } else if (reviewModalState.isOpen && !reviewModalState.submitting) {
          setReviewModalState((prev) => ({ ...prev, isOpen: false }));
        } else if (selectedRequest) {
          setSelectedRequest(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOnboardModalOpen, onboardSubmitting, reviewModalState, selectedRequest]);

  // All distinct companies for filtering
  const allCompanyOptions = useMemo(() => {
    const map = new Map();
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

    requests.forEach((r) => {
      if (r.companyId && r.companyId._id && !map.has(r.companyId._id)) {
        map.set(r.companyId._id, {
          id: r.companyId._id,
          name: r.companyId.name || r.companyId.code || 'Company',
          code: r.companyId.code || '',
          logo: r.companyId.logo || ''
        });
      }
    });

    return Array.from(map.values());
  }, [availableCompanies, requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((item) => {
      // Company Filter
      if (selectedCompany) {
        const itemCompId = item.companyId?._id || item.companyId;
        if (itemCompId !== selectedCompany) return false;
      }

      // Status Tab / Filter
      if (selectedStatus && selectedStatus !== 'ALL') {
        const status = (item.approvalStatus || 'PENDING').toUpperCase();
        if (status !== selectedStatus.toUpperCase()) return false;
      }

      // Search Term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const firmName = (item.firmName || '').toLowerCase();
        const firmCode = (item.firmCode || '').toLowerCase();
        const contactPerson = (item.contactPerson || '').toLowerCase();
        const phone = (item.phone || '').toLowerCase();
        const email = (item.email || '').toLowerCase();
        const city = (item.city || '').toLowerCase();
        const state = (item.state || '').toLowerCase();
        const gstin = (item.gstin || '').toLowerCase();
        const compName = (item.companyId?.name || '').toLowerCase();
        const submitter = (item.submittedBy?.email || '').toLowerCase();

        return (
          firmName.includes(term) ||
          firmCode.includes(term) ||
          contactPerson.includes(term) ||
          phone.includes(term) ||
          email.includes(term) ||
          city.includes(term) ||
          state.includes(term) ||
          gstin.includes(term) ||
          compName.includes(term) ||
          submitter.includes(term)
        );
      }

      return true;
    });
  }, [requests, selectedCompany, selectedStatus, searchTerm]);

  // Default sorting: Newest requests first
  const sortedRequests = useMemo(() => {
    const list = [...filteredRequests];
    list.sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
    return list;
  }, [filteredRequests]);

  // Pagination
  const totalPages = Math.ceil(sortedRequests.length / rowsPerPage) || 1;
  const indexOfLastItem = currentPage * rowsPerPage;
  const indexOfFirstItem = indexOfLastItem - rowsPerPage;
  const currentRequests = sortedRequests.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setSearchParams((prev) => {
      prev.set('page', page.toString());
      return prev;
    });
  };

  const handleStatusFilter = (status) => {
    setSearchParams((prev) => {
      if (status === 'ALL') {
        prev.delete('status');
      } else {
        prev.set('status', status);
      }
      prev.set('page', '1');
      return prev;
    });
  };

  const handleCompanyFilter = (companyId) => {
    setSearchParams((prev) => {
      if (companyId) {
        prev.set('company', companyId);
      } else {
        prev.delete('company');
      }
      prev.set('page', '1');
      return prev;
    });
  };

  // KPIs
  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let totalCredit = 0;

    requests.forEach((r) => {
      const status = (r.approvalStatus || 'PENDING').toUpperCase();
      if (status === 'APPROVED') approved++;
      else if (status === 'REJECTED') rejected++;
      else pending++;

      if (typeof r.creditLimit === 'number') {
        totalCredit += r.creditLimit;
      }
    });

    return {
      total: requests.length,
      pending,
      approved,
      rejected,
      totalCredit
    };
  }, [requests]);

  // Open Submit Onboarding Request Modal
  const handleOpenOnboardModal = () => {
    setOnboardFormData({
      ...INITIAL_ONBOARD_FORM,
      companyId: selectedCompany || (allCompanyOptions[0]?.id || '')
    });
    setOnboardFormError('');
    setIsOnboardModalOpen(true);
  };

  // Submit New Onboarding Request (POST /firms/onboard)
  const handleSubmitOnboard = async (e) => {
    e.preventDefault();
    setOnboardFormError('');

    if (!onboardFormData.companyId) return setOnboardFormError('Please select a company.');
    if (!onboardFormData.firmName.trim()) return setOnboardFormError('Firm name is required.');
    if (!onboardFormData.firmCode.trim()) return setOnboardFormError('Firm code is required.');
    if (!onboardFormData.contactPerson.trim()) return setOnboardFormError('Contact person is required.');
    if (!onboardFormData.phone.trim()) return setOnboardFormError('Phone number is required.');
    if (!onboardFormData.email.trim()) return setOnboardFormError('Email address is required.');
    if (!onboardFormData.address.trim()) return setOnboardFormError('Address is required.');
    if (!onboardFormData.city.trim()) return setOnboardFormError('City is required.');
    if (!onboardFormData.state.trim()) return setOnboardFormError('State is required.');
    if (!onboardFormData.pincode.trim()) return setOnboardFormError('Pincode is required.');
    if (!onboardFormData.gstin.trim()) return setOnboardFormError('GSTIN is required.');

    const codeVal = validateEntityCode(onboardFormData.firmCode);
    if (!codeVal.isValid) return setOnboardFormError(codeVal.error);

    const phoneVal = validatePhone(onboardFormData.phone);
    if (!phoneVal.isValid) return setOnboardFormError(phoneVal.error);

    const emailVal = validateEmail(onboardFormData.email);
    if (!emailVal.isValid) return setOnboardFormError(emailVal.error);

    const gstinVal = validateGSTIN(onboardFormData.gstin);
    if (!gstinVal.isValid) return setOnboardFormError(gstinVal.error);

    const pinVal = validatePincode(onboardFormData.pincode);
    if (!pinVal.isValid) return setOnboardFormError(pinVal.error);

    const payload = {
      companyId: onboardFormData.companyId,
      firmName: onboardFormData.firmName.trim(),
      firmCode: onboardFormData.firmCode.trim().toUpperCase(),
      contactPerson: onboardFormData.contactPerson.trim(),
      phone: onboardFormData.phone.trim(),
      email: onboardFormData.email.trim().toLowerCase(),
      address: onboardFormData.address.trim(),
      city: onboardFormData.city.trim(),
      state: onboardFormData.state.trim(),
      pincode: onboardFormData.pincode.trim(),
      gstin: onboardFormData.gstin.trim().toUpperCase(),
      creditDays: Number(onboardFormData.creditDays) || 30,
      creditLimit: Number(onboardFormData.creditLimit) || 0
    };

    setOnboardSubmitting(true);
    try {
      const response = await onboardFirmApi(payload);
      const resData = response.data?.data || response.data || {};
      const matchedComp = allCompanyOptions.find((c) => c.id === payload.companyId);

      const newItem = {
        _id: resData._id || `onboard_${Date.now()}`,
        ...payload,
        approvalStatus: resData.approvalStatus || 'PENDING',
        isActive: Boolean(resData.isActive),
        companyId: {
          _id: payload.companyId,
          name: matchedComp?.name || 'Company',
          code: matchedComp?.code || '',
          logo: matchedComp?.logo || ''
        },
        createdAt: resData.createdAt || new Date().toISOString(),
        updatedAt: resData.updatedAt || new Date().toISOString()
      };

      setRequests((prev) => [newItem, ...prev]);
      setSuccessToast(`Onboarding request for "${payload.firmName}" submitted successfully!`);
      setTimeout(() => setSuccessToast(''), 4500);
      setIsOnboardModalOpen(false);
      setOnboardFormData(INITIAL_ONBOARD_FORM);
      fetchRequests(true);
    } catch (err) {
      console.error('Onboard firm error:', err);
      setOnboardFormError(err.response?.data?.message || err.message || 'Failed to submit onboarding request.');
    } finally {
      setOnboardSubmitting(false);
    }
  };

  // Open Review Dialog (Approve or Reject)
  const handleOpenReviewModal = (item, action) => {
    setReviewModalState({
      isOpen: true,
      item,
      action,
      rejectionReason: action === 'REJECTED' ? PRESET_REJECTION_REASONS[0] : '',
      customReason: '',
      submitting: false,
      error: ''
    });
  };

  // Submit Review (PATCH /firms/{id}/review)
  const handleSubmitReview = async () => {
    const { item, action, rejectionReason, customReason } = reviewModalState;
    if (!item || !item._id) return;

    let finalRejectionReason = rejectionReason;
    if (action === 'REJECTED') {
      if (rejectionReason === 'OTHER' || !rejectionReason) {
        if (!customReason.trim()) {
          setReviewModalState((prev) => ({
            ...prev,
            error: 'Please enter a custom rejection reason.'
          }));
          return;
        }
        finalRejectionReason = customReason.trim();
      } else if (customReason.trim()) {
        finalRejectionReason = `${rejectionReason} - ${customReason.trim()}`;
      }
    }

    setReviewModalState((prev) => ({ ...prev, submitting: true, error: '' }));
    setActionLoadingId(item._id);

    try {
      const payload = {
        approvalStatus: action,
        ...(action === 'REJECTED' ? { rejectionReason: finalRejectionReason } : {})
      };

      await reviewFirmApi(item._id, payload);

      setRequests((prev) =>
        prev.map((r) =>
          r._id === item._id
            ? {
                ...r,
                approvalStatus: action,
                ...(action === 'APPROVED' ? { isActive: true } : {}),
                ...(action === 'REJECTED' ? { rejectionReason: finalRejectionReason } : {}),
                updatedAt: new Date().toISOString()
              }
            : r
        )
      );

      if (selectedRequest && selectedRequest._id === item._id) {
        setSelectedRequest((prev) => ({
          ...prev,
          approvalStatus: action,
          ...(action === 'APPROVED' ? { isActive: true } : {}),
          ...(action === 'REJECTED' ? { rejectionReason: finalRejectionReason } : {}),
          updatedAt: new Date().toISOString()
        }));
      }

      setSuccessToast(
        action === 'APPROVED'
          ? `Firm "${item.firmName}" has been successfully APPROVED!`
          : `Onboarding request for "${item.firmName}" has been REJECTED.`
      );
      setTimeout(() => setSuccessToast(''), 4500);

      setReviewModalState((prev) => ({ ...prev, isOpen: false }));
      fetchRequests(true);
    } catch (err) {
      console.error('Review firm error:', err);
      setReviewModalState((prev) => ({
        ...prev,
        error: err.response?.data?.message || err.message || 'Failed to update review status.'
      }));
    } finally {
      setReviewModalState((prev) => ({ ...prev, submitting: false }));
      setActionLoadingId(null);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (sortedRequests.length === 0) return;

    const dataToExport = sortedRequests.map((r, index) => ({
      'S.No': index + 1,
      'Firm Name': r.firmName || '-',
      'Firm Code': r.firmCode || '-',
      'Company': r.companyId?.name || r.companyId?.code || '-',
      'Approval Status': r.approvalStatus || 'PENDING',
      'Contact Person': r.contactPerson || '-',
      'Phone': r.phone || '-',
      'Email': r.email || '-',
      'GSTIN': r.gstin || '-',
      'Address': r.address || '-',
      'City': r.city || '-',
      'State': r.state || '-',
      'Pincode': r.pincode || '-',
      'Credit Days': r.creditDays ?? 30,
      'Credit Limit (₹)': r.creditLimit ?? 0,
      'Submitted By': r.submittedBy?.email || r.submittedBy?.phone || '-',
      'Submitter Role': r.submittedBy?.role || '-',
      'Reviewed By': r.reviewedBy?.email || '-',
      'Rejection Reason': r.rejectionReason || '-',
      'Submitted Date': r.createdAt ? formatDateTimeDDMMYYYY(r.createdAt) : '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Onboarding Requests');
    XLSX.writeFile(
      workbook,
      `Firm_Onboarding_Requests_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const getStatusBadge = (status) => {
    const s = (status || 'PENDING').toUpperCase();
    if (s === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
          <FiCheckCircle size={13} className="shrink-0" />
          APPROVED
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-xs">
          <FiUserX size={13} className="shrink-0" />
          REJECTED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        PENDING
      </span>
    );
  };

  return (
    <div className="space-y-5 pb-12 w-full">
      {/* Toast */}
      {successToast && (
        <div className="fixed top-5 right-5 z-[9999] flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-2xl animate-in slide-in-from-top-4 fade-in">
          <FiCheckCircle className="text-xl shrink-0" />
          <p className="text-sm font-semibold">{successToast}</p>
          <button
            onClick={() => setSuccessToast('')}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors ml-2 cursor-pointer"
          >
            <FiX size={16} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Customer / Firm Onboarding"
        icon={FiUserCheck}
        badgeIcon={FiUserCheck}
        badgeText={`${sortedRequests.length} Requests`}
        subtitle="Review, approve, and initiate customer onboarding requests across enterprise companies"
        actions={
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => fetchRequests(false)}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              title="Refresh onboarding requests"
            >
              <FiRefreshCcw className={`text-sm ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={sortedRequests.length === 0}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              title="Export filtered list to Excel"
            >
              <FiDownload className="text-sm text-emerald-500" />
              <span>Export</span>
            </button>

            <button
              onClick={handleOpenOnboardModal}
              className="px-4 py-2 text-xs font-bold text-white rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <FiPlus className="text-base" />
              <span>New Onboard Request</span>
            </button>
          </div>
        }
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-400">Total Requests</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <FiLayers size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-blue-600">{stats.total}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">All customer submissions</p>
        </div>

        <div
          className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-amber-500/30 shadow-xs hover:border-amber-500/60 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Pending Review
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <FiClock size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-amber-600 dark:text-amber-400">{stats.pending}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Requires admin / sales approval</p>
        </div>

        <div
          className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-emerald-500/30 shadow-xs hover:border-emerald-500/60 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Approved Firms</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <FiUserCheck size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">{stats.approved}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Ready for order placement</p>
        </div>

        <div
          className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-rose-500/30 shadow-xs hover:border-rose-500/60 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Rejected Requests</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
              <FiUserX size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-rose-600 dark:text-rose-400">{stats.rejected}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Declined or duplicate</p>
        </div>

        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-400">Credit Demand</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <FiDollarSign size={18} />
            </div>
          </div>
          <p className="text-xl font-bold mt-2 text-indigo-600 truncate">
            ₹{stats.totalCredit.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Total requested credit</p>
        </div>
      </div>

      {/* Clean, Non-Clumsy Filter Bar */}
      <div className="p-2.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Status Segmented Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-white/5 rounded-xl border border-slate-200/60 dark:border-white/10 overflow-x-auto self-start lg:self-auto">
          {[
            {
              id: 'ALL',
              label: 'All Requests',
              count: stats.total,
              badgeClass: 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'
            },
            {
              id: 'PENDING',
              label: 'Pending',
              count: stats.pending,
              badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            },
            {
              id: 'APPROVED',
              label: 'Approved',
              count: stats.approved,
              badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            },
            {
              id: 'REJECTED',
              label: 'Rejected',
              count: stats.rejected,
              badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
            }
          ].map((tab) => {
            const isActive = (selectedStatus || 'ALL').toUpperCase() === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleStatusFilter(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-blue-600 text-white' : tab.badgeClass
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Company Dropdown, Search Input, and Reset */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-end">
          {/* Company Filter Dropdown */}
          <div className="w-full sm:w-auto min-w-[170px] sm:min-w-[190px]">
            <CustomDropdown
              value={selectedCompany}
              onChange={handleCompanyFilter}
              options={[
                { value: '', label: 'All Companies' },
                ...allCompanyOptions.map((c) => ({
                  value: c.id,
                  label: c.name || c.code || 'Company'
                }))
              ]}
              defaultLabel="All Companies"
              statusColor={`!px-3 !py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-black/20 font-bold ${
                selectedCompany ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
              }`}
            />
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64 shrink-0">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search firm, GSTIN, phone..."
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
              >
                <FiX size={14} />
              </button>
            )}
          </div>

          {/* Reset Filters button */}
          {(searchTerm || selectedCompany || (selectedStatus && selectedStatus !== 'ALL')) && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearchParams({});
              }}
              className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Reset all filters"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiAlertTriangle className="text-base shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchRequests(false)}
            className="underline font-bold hover:text-rose-700 dark:hover:text-rose-300 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Clean Table (No sorting noise, spacious columns) */}
      <div className="rounded-2xl bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[1350px] text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-50/80 dark:bg-white/[0.03] border-b border-slate-200/80 dark:border-white/10 select-none">
              <tr className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-4 whitespace-nowrap">Firm & Code</th>
                <th className="px-5 py-4 whitespace-nowrap">Company</th>
                <th className="px-5 py-4 whitespace-nowrap">Contact Person</th>
                <th className="px-5 py-4 whitespace-nowrap">Location & GSTIN</th>
                <th className="px-5 py-4 whitespace-nowrap">Credit Terms</th>
                <th className="px-5 py-4 whitespace-nowrap">Submitted By</th>
                <th className="px-5 py-4 whitespace-nowrap text-center">Status</th>
                <th className="px-5 py-4 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-white/5 text-xs">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRowSkeleton key={idx} cols={8} />
                ))
              ) : currentRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-2xl text-slate-400 mb-3">
                        <FiUserCheck size={28} />
                      </div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        No onboarding requests found
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        {searchTerm || selectedCompany || selectedStatus !== 'ALL'
                          ? 'Try adjusting your search criteria or resetting filters.'
                          : 'No onboarding requests have been submitted yet. Click "New Onboard Request" to create one.'}
                      </p>
                      {(searchTerm || selectedCompany || selectedStatus !== 'ALL') && (
                        <button
                          onClick={() => {
                            setSearchInput('');
                            setSearchParams({});
                          }}
                          className="mt-3 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                currentRequests.map((item) => {
                  const status = (item.approvalStatus || 'PENDING').toUpperCase();
                  const isPending = status === 'PENDING';
                  const isProcessing = actionLoadingId === item._id;

                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Firm & Code */}
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                            {(item.firmName || 'F').charAt(0).toUpperCase()}
                          </div>
                          <div className="space-y-1">
                            <p className="font-bold text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {item.firmName}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 px-2 py-0.5 rounded-md whitespace-nowrap">
                                {item.firmCode || '-'}
                              </span>
                              {item.firmCode && <CopyButton text={item.firmCode} />}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-2.5">
                          {item.companyId?.logo && !imageErrors[item.companyId._id] ? (
                            <img
                              src={item.companyId.logo}
                              alt={item.companyId.name}
                              onError={() =>
                                setImageErrors((prev) => ({
                                  ...prev,
                                  [item.companyId._id]: true
                                }))
                              }
                              className="w-8 h-8 rounded-xl object-contain bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 p-1 shrink-0 shadow-xs"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-500/20">
                              {(item.companyId?.name || item.companyId?.code || 'C').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p
                              className="font-semibold text-slate-800 dark:text-slate-200 text-xs"
                              title={item.companyId?.name}
                            >
                              {item.companyId?.name || item.companyId?.code || '-'}
                            </p>
                            {item.companyId?.code && (
                              <span className="text-[10px] text-slate-400 font-mono tracking-wider">
                                {item.companyId.code}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact Person */}
                      <td className="px-5 py-4 align-middle">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                            {item.contactPerson || '-'}
                          </p>
                          {item.phone && (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                              <FiPhone size={11} className="text-slate-400 shrink-0" />
                              <span>{item.phone}</span>
                              <CopyButton text={item.phone} />
                            </div>
                          )}
                          {item.email && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap">
                              <GmailLink email={item.email} />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Location & GSTIN */}
                      <td className="px-5 py-4 align-middle">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            <FiMapPin size={12} className="text-slate-400 shrink-0" />
                            <span>
                              {[item.city, item.state].filter(Boolean).join(', ') || '-'}
                            </span>
                          </div>
                          {item.gstin && (
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md whitespace-nowrap">
                                {item.gstin}
                              </span>
                              <CopyButton text={item.gstin} />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Credit Terms */}
                      <td className="px-5 py-4 align-middle whitespace-nowrap">
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">
                            ₹{(item.creditLimit ?? 0).toLocaleString('en-IN')}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                            {item.creditDays ?? 30} days credit
                          </p>
                        </div>
                      </td>

                      {/* Submitted By */}
                      <td className="px-5 py-4 align-middle">
                        <div className="space-y-1">
                          <p
                            className="font-medium text-slate-700 dark:text-slate-300 text-xs"
                            title={item.submittedBy?.email || item.submittedBy?.phone}
                          >
                            {item.submittedBy?.email || item.submittedBy?.phone || 'Sales Team'}
                          </p>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            {item.submittedBy?.role && (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded">
                                {item.submittedBy.role}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 whitespace-nowrap">
                              {item.createdAt ? formatDateDDMMYYYY(item.createdAt) : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 align-middle text-center whitespace-nowrap">
                        {getStatusBadge(item.approvalStatus)}
                        {item.rejectionReason && status === 'REJECTED' && (
                          <p
                            className="text-[10px] text-rose-500 mt-1 max-w-xs whitespace-normal mx-auto leading-tight"
                            title={item.rejectionReason}
                          >
                            {item.rejectionReason}
                          </p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 align-middle text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isPending ? (
                            <>
                              <button
                                onClick={() => handleOpenReviewModal(item, 'APPROVED')}
                                disabled={isProcessing}
                                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                title="Approve Request"
                              >
                                <FiCheck size={14} />
                                <span>Approve</span>
                              </button>

                              <button
                                onClick={() => handleOpenReviewModal(item, 'REJECTED')}
                                disabled={isProcessing}
                                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                title="Reject Request"
                              >
                                <FiX size={14} />
                                <span>Reject</span>
                              </button>

                              <button
                                onClick={() => setSelectedRequest(item)}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                title="View Full Details"
                              >
                                <FiEye size={16} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setSelectedRequest(item)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                              title="View Details"
                            >
                              <FiEye size={14} />
                              <span>Details</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, sortedRequests.length)} of{' '}
              {sortedRequests.length} requests
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-semibold"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => {
                if (
                  pg === 1 ||
                  pg === totalPages ||
                  (pg >= currentPage - 1 && pg <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pg}
                      onClick={() => handlePageChange(pg)}
                      className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        currentPage === pg
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                    >
                      {pg}
                    </button>
                  );
                }
                if (pg === currentPage - 2 || pg === currentPage + 2) {
                  return <span key={pg} className="px-1 text-slate-400">...</span>;
                }
                return null;
              })}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-semibold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL MODAL / SLIDE-OVER */}
      {selectedRequest &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 dark:bg-slate-950/50 backdrop-blur-lg animate-in fade-in overflow-y-auto">
            <div className="relative w-full max-w-2xl bg-white/40 dark:bg-slate-950/25 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto animate-in zoom-in-95">
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-gradient-to-r from-blue-600/40 to-indigo-600/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                    <FiServer size={20} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      {selectedRequest.firmName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs text-slate-900 dark:text-slate-300 bg-white/20 dark:bg-white/10 px-2 py-0.5 rounded backdrop-blur-xs font-semibold">
                        {selectedRequest.firmCode || '-'}
                      </span>
                      {getStatusBadge(selectedRequest.approvalStatus)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-2 text-white hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <FiX size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs text-slate-600 dark:text-slate-300 custom-scrollbar">
                {/* Rejection Alert if Rejected */}
                {(selectedRequest.approvalStatus || '').toUpperCase() === 'REJECTED' &&
                  selectedRequest.rejectionReason && (
                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-2.5">
                      <FiAlertCircle size={18} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Rejection Reason</p>
                        <p className="text-xs mt-0.5 leading-relaxed">
                          {selectedRequest.rejectionReason}
                        </p>
                      </div>
                    </div>
                  )}

                {/* Parent Company Profile */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {selectedRequest.companyId?.logo ? (
                      <img
                        src={selectedRequest.companyId.logo}
                        alt="Company Logo"
                        className="w-10 h-10 rounded-xl object-contain bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-white/10"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                        <FiBriefcase size={18} />
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Parent Company</span>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">
                        {selectedRequest.companyId?.name || selectedRequest.companyId?.code || 'Company'}
                      </p>
                    </div>
                  </div>
                  {selectedRequest.companyId?.code && (
                    <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-white/10 px-2.5 py-1 rounded-lg">
                      {selectedRequest.companyId.code}
                    </span>
                  )}
                </div>

                {/* Grid Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Contact Info */}
                  <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-3">
                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <FiUser className="text-blue-500" />
                      Contact & Entity
                    </p>
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] text-slate-400">Contact Person</span>
                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                          {selectedRequest.contactPerson || '-'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Phone Number</span>
                        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200 font-semibold">
                          <span>{selectedRequest.phone || '-'}</span>
                          {selectedRequest.phone && <CopyButton text={selectedRequest.phone} />}
                        </div>
                      </div>
                      {selectedRequest.email && (
                        <div>
                          <span className="text-[10px] text-slate-400">Email Address</span>
                          <p className="font-semibold text-slate-700 dark:text-slate-200">
                            {selectedRequest.email}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] text-slate-400">GSTIN</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {selectedRequest.gstin || '-'}
                          </span>
                          {selectedRequest.gstin && <CopyButton text={selectedRequest.gstin} />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Financial & Location */}
                  <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-3">
                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <FiDollarSign className="text-emerald-500" />
                      Credit & Location
                    </p>
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] text-slate-400">Credit Limit</span>
                        <p className="font-bold text-base text-slate-800 dark:text-white">
                          ₹{(selectedRequest.creditLimit ?? 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Credit Days</span>
                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                          {selectedRequest.creditDays ?? 30} Days
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Address / City / State</span>
                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                          {[
                            selectedRequest.address,
                            selectedRequest.city,
                            selectedRequest.state,
                            selectedRequest.pincode
                          ]
                            .filter(Boolean)
                            .join(', ') || '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audit & Submitter Metadata */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Submitted By</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                      {selectedRequest.submittedBy?.email || selectedRequest.submittedBy?.phone || 'Sales Executive'}
                    </p>
                    {selectedRequest.submittedBy?.role && (
                      <span className="inline-block mt-1 text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded">
                        {selectedRequest.submittedBy.role}
                      </span>
                    )}
                    <p className="text-slate-400 text-[10px] mt-1">
                      Submitted on: {selectedRequest.createdAt ? formatDateTimeDDMMYYYY(selectedRequest.createdAt) : '-'}
                    </p>
                  </div>

                  {selectedRequest.reviewedBy && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Reviewed By</span>
                      <p className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                        {selectedRequest.reviewedBy.email || 'Admin'}
                      </p>
                      <p className="text-slate-400 text-[10px] mt-1">
                        Reviewed on: {selectedRequest.updatedAt ? formatDateTimeDDMMYYYY(selectedRequest.updatedAt) : '-'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-white/[0.02]">
                <div className="text-[11px] text-slate-400 font-mono">
                  ID: {selectedRequest._id}
                </div>
                <div className="flex items-center gap-2">
                  {(selectedRequest.approvalStatus || 'PENDING').toUpperCase() === 'PENDING' && (
                    <>
                      <button
                        onClick={() => {
                          const req = selectedRequest;
                          setSelectedRequest(null);
                          handleOpenReviewModal(req, 'APPROVED');
                        }}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
                      >
                        <FiCheck size={14} />
                        <span>Approve Request</span>
                      </button>
                      <button
                        onClick={() => {
                          const req = selectedRequest;
                          setSelectedRequest(null);
                          handleOpenReviewModal(req, 'REJECTED');
                        }}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/20"
                      >
                        <FiX size={14} />
                        <span>Reject Request</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* NEW ONBOARDING REQUEST MODAL (POST /firms/onboard) */}
      {isOnboardModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 dark:bg-slate-950/50 backdrop-blur-lg animate-in fade-in overflow-y-auto">
            <div className="relative w-full max-w-2xl bg-white/40 dark:bg-slate-950/25 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto animate-in zoom-in-95">
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-gradient-to-r from-blue-600/40 to-indigo-600/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                    <FiPlus size={20} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      New Customer Onboarding Request
                    </h3>
                    <p className="text-[11px] font-mono text-slate-950 dark:text-slate-300 mt-0.5">
                      POST /firms/onboard
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !onboardSubmitting && setIsOnboardModalOpen(false)}
                  className="p-2 text-white hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <FiX size={18} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmitOnboard} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs custom-scrollbar">
                {onboardFormError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
                    <FiAlertCircle size={16} className="shrink-0" />
                    <span>{onboardFormError}</span>
                  </div>
                )}

                {/* Company Selection */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                    Parent Company <span className="text-rose-500">*</span>
                  </label>
                  <CustomDropdown
                    value={onboardFormData.companyId}
                    onChange={(val) => setOnboardFormData((prev) => ({ ...prev, companyId: val }))}
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

                {/* Firm Name & Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      Firm / Business Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Telecom & Digital"
                      value={onboardFormData.firmName}
                      onChange={(e) =>
                        setOnboardFormData((prev) => ({ ...prev, firmName: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      Firm Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. APEX-HYD"
                      value={onboardFormData.firmCode}
                      onChange={(e) =>
                        setOnboardFormData((prev) => ({
                          ...prev,
                          firmCode: formatEntityCode(e.target.value)
                        }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white font-mono uppercase focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Contact Person & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      Contact Person Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kiran Reddy"
                      value={onboardFormData.contactPerson}
                      onChange={(e) =>
                        setOnboardFormData((prev) => ({ ...prev, contactPerson: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. +919876543210"
                      value={onboardFormData.phone}
                      onChange={(e) =>
                        setOnboardFormData((prev) => ({
                          ...prev,
                          phone: formatPhone(e.target.value)
                        }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Email & GSTIN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. kiran@apextelecom.in"
                      value={onboardFormData.email}
                      onChange={(e) =>
                        setOnboardFormData((prev) => ({ ...prev, email: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      GSTIN <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 36AAAAA1234A1Z5"
                      value={onboardFormData.gstin}
                      onChange={(e) =>
                        setOnboardFormData((prev) => ({
                          ...prev,
                          gstin: formatGSTIN(e.target.value)
                        }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white font-mono uppercase focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                    Business Address / Premises <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Plot 45, Hitec City"
                    value={onboardFormData.address}
                    onChange={(e) =>
                      setOnboardFormData((prev) => ({ ...prev, address: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* City, State, Pincode */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      City <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Hyderabad"
                      value={onboardFormData.city}
                      onChange={(e) =>
                        setOnboardFormData((prev) => ({ ...prev, city: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      State <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Telangana"
                      value={onboardFormData.state}
                      onChange={(e) =>
                        setOnboardFormData((prev) => ({ ...prev, state: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      Pincode <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 500081"
                      value={onboardFormData.pincode}
                      onChange={(e) =>
                        setOnboardFormData((prev) => ({
                          ...prev,
                          pincode: formatPincode(e.target.value)
                        }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Credit Terms */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      Requested Credit Days
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="180"
                      placeholder="30"
                      value={onboardFormData.creditDays}
                      onChange={(e) =>
                        setOnboardFormData((prev) => ({ ...prev, creditDays: e.target.value }))
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Standard credit period (e.g. 30 days)</p>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      Requested Credit Limit (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10000"
                      placeholder="500000"
                      value={onboardFormData.creditLimit}
                      onChange={(e) =>
                        setOnboardFormData((prev) => ({ ...prev, creditLimit: e.target.value }))
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Maximum allowed credit balance</p>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="pt-3 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    disabled={onboardSubmitting}
                    onClick={() => setIsOnboardModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={onboardSubmitting}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {onboardSubmitting ? (
                      <>
                        <FiLoader className="animate-spin text-sm" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <FiCheck className="text-sm" />
                        <span>Submit Onboard Request</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* REVIEW ACTION MODAL (PATCH /firms/{id}/review) */}
      {reviewModalState.isOpen &&
        reviewModalState.item &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 dark:bg-slate-950/50 backdrop-blur-lg animate-in fade-in overflow-y-auto">
            <div className="relative w-full max-w-lg bg-white/40 dark:bg-slate-950/25 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto animate-in zoom-in-95">
              {/* Header */}
              <div
                className={`p-5 sm:p-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 ${
                  reviewModalState.action === 'APPROVED'
                    ? 'bg-gradient-to-r from-emerald-600/40 to-teal-600/40'
                    : 'bg-gradient-to-r from-rose-600/40 to-red-600/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-2xl text-white shadow-md ${
                      reviewModalState.action === 'APPROVED'
                        ? 'bg-emerald-600 shadow-emerald-500/20'
                        : 'bg-rose-600 shadow-rose-500/20'
                    }`}
                  >
                    {reviewModalState.action === 'APPROVED' ? (
                      <FiCheckCircle size={20} />
                    ) : (
                      <FiAlertCircle size={20} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      {reviewModalState.action === 'APPROVED'
                        ? 'Approve Onboarding Request'
                        : 'Reject Onboarding Request'}
                    </h3>
                    <p className="text-[11px] text-slate-950 dark:text-slate-300 mt-0.5 font-mono">
                      PATCH /firms/{reviewModalState.item._id}/review
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    !reviewModalState.submitting &&
                    setReviewModalState((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="p-2 text-white hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <FiX size={18} />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs text-slate-600 dark:text-slate-300 custom-scrollbar">
                {reviewModalState.error && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
                    <FiAlertCircle size={16} className="shrink-0" />
                    <span>{reviewModalState.error}</span>
                  </div>
                )}

                {/* Target Firm Summary */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-slate-800 dark:text-white truncate">
                      {reviewModalState.item.firmName}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 bg-slate-200/80 dark:bg-white/10 px-2 py-0.5 rounded shrink-0">
                      {reviewModalState.item.firmCode}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Company: {reviewModalState.item.companyId?.name || 'Company'} | City:{' '}
                    {reviewModalState.item.city || '-'}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Credit: ₹{(reviewModalState.item.creditLimit ?? 0).toLocaleString('en-IN')} (
                    {reviewModalState.item.creditDays ?? 30} days)
                  </p>
                </div>

                {reviewModalState.action === 'APPROVED' ? (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    <p className="font-bold">Confirmation</p>
                    <p className="mt-1 text-xs">
                      Approving this request will mark the firm as{' '}
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">APPROVED</span> and
                      activate the customer account with registered credit terms.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                        Rejection Reason <span className="text-rose-500">*</span>
                      </label>
                      <CustomDropdown
                        value={reviewModalState.rejectionReason}
                        onChange={(val) => {
                          setReviewModalState((prev) => ({
                            ...prev,
                            rejectionReason: val,
                            customReason: val === 'OTHER' ? '' : prev.customReason
                          }));
                        }}
                        defaultLabel="Select rejection reason..."
                        options={[
                          ...PRESET_REJECTION_REASONS.map((r) => ({ value: r, label: r })),
                          { value: 'OTHER', label: 'Other / Custom Reason...' }
                        ]}
                        statusColor="!px-3.5 !py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                      />
                    </div>

                    {/* Custom / Additional details textarea */}
                    <div className="pt-1">
                      <label className="block text-[11px] text-slate-500 dark:text-slate-400 font-semibold mb-1">
                        {reviewModalState.rejectionReason === 'OTHER'
                          ? 'Specify Reason Details *'
                          : 'Additional Notes / Comments (Optional):'}
                      </label>
                      <textarea
                        rows={3}
                        placeholder={
                          reviewModalState.rejectionReason === 'OTHER'
                            ? 'Type specific rejection details...'
                            : 'Add any specific notes or instructions for the applicant...'
                        }
                        value={reviewModalState.customReason}
                        onChange={(e) =>
                          setReviewModalState((prev) => ({
                            ...prev,
                            customReason: e.target.value
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-xs resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-end gap-3 shrink-0 bg-slate-50/80 dark:bg-white/[0.02]">
                <button
                  type="button"
                  disabled={reviewModalState.submitting}
                  onClick={() => setReviewModalState((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={reviewModalState.submitting}
                  onClick={handleSubmitReview}
                  className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 ${
                    reviewModalState.action === 'APPROVED'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                  }`}
                >
                  {reviewModalState.submitting ? (
                    <>
                      <FiLoader className="animate-spin text-sm" />
                      <span>Updating...</span>
                    </>
                  ) : reviewModalState.action === 'APPROVED' ? (
                    <>
                      <FiCheck size={14} />
                      <span>Confirm Approval</span>
                    </>
                  ) : (
                    <>
                      <FiX size={14} />
                      <span>Confirm Rejection</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default FirmOnboarding;
