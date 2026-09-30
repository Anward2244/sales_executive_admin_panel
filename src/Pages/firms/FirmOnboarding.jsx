import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FiCheck, FiLoader, FiAlertCircle, FiSearch, FiServer,
  FiRefreshCcw, FiX, FiClock, FiPhone, FiEye, FiBriefcase,
  FiUserCheck, FiUserX, FiMapPin, FiPlus, FiUser,
  FiCheckCircle, FiLayers, FiDownload, FiDollarSign,
  FiAlertTriangle, FiChevronLeft, FiChevronRight,
  FiFileText, FiCreditCard, FiExternalLink, FiShield,
  FiAward, FiGlobe, FiCalendar, FiMaximize2
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
  const [apiMeta, setApiMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Document preview lightbox modal state
  const [docPreviewModal, setDocPreviewModal] = useState({
    isOpen: false,
    title: '',
    url: ''
  });

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

  // Display Preferences & Pagination
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

  // Live Polling State
  const [isPollingActive, setIsPollingActive] = useState(true);
  const [lastPolledAt, setLastPolledAt] = useState(null);

  // Fetch Onboarding Requests
  const fetchRequests = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError('');
    try {
      const response = await getFirmOnboardingRequestsApi();
      let list = [];
      let meta = null;
      if (response && response.data) {
        if (Array.isArray(response.data.data)) {
          list = response.data.data;
          meta = response.data.meta;
        } else if (Array.isArray(response.data)) {
          list = response.data;
        } else if (Array.isArray(response.data.requests)) {
          list = response.data.requests;
          meta = response.data.meta;
        }
      }
      setRequests(list);
      if (meta) setApiMeta(meta);

      // Dispatch global event for Layout menu bar badge & red dot indicator
      const pendingCount = list.filter(
        (item) => (item.approvalStatus || 'PENDING').toUpperCase() === 'PENDING'
      ).length;
      window.dispatchEvent(
        new CustomEvent('firm-onboarding-updated', {
          detail: { requests: list, pendingCount }
        })
      );
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

  // Background polling for real-time requests (every 15s)
  useEffect(() => {
    if (!isPollingActive) return;

    const intervalId = setInterval(() => {
      fetchRequests(true).then(() => {
        setLastPolledAt(new Date());
      });
    }, 15000);

    return () => clearInterval(intervalId);
  }, [isPollingActive, fetchRequests]);

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
        if (docPreviewModal.isOpen) {
          setDocPreviewModal({ isOpen: false, title: '', url: '' });
        } else if (isOnboardModalOpen && !onboardSubmitting) {
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
  }, [isOnboardModalOpen, onboardSubmitting, reviewModalState, selectedRequest, docPreviewModal.isOpen]);

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
        const altPhone = (item.alternatePhone || '').toLowerCase();
        const email = (item.email || '').toLowerCase();
        const city = (item.city || '').toLowerCase();
        const state = (item.state || '').toLowerCase();
        const gstin = (item.gstin || '').toLowerCase();
        const panNumber = (item.panNumber || '').toLowerCase();
        const tanNumber = (item.tanNumber || '').toLowerCase();
        const bankName = (item.bankName || '').toLowerCase();
        const businessType = (item.businessType || '').toLowerCase();
        const designation = (item.designation || '').toLowerCase();
        const signatory = (item.authorizedSignatoryName || '').toLowerCase();
        const compName = (item.companyId?.name || '').toLowerCase();
        const submitter = (item.submittedBy?.email || item.submittedBy?.phone || '').toLowerCase();

        return (
          firmName.includes(term) ||
          firmCode.includes(term) ||
          contactPerson.includes(term) ||
          phone.includes(term) ||
          altPhone.includes(term) ||
          email.includes(term) ||
          city.includes(term) ||
          state.includes(term) ||
          gstin.includes(term) ||
          panNumber.includes(term) ||
          tanNumber.includes(term) ||
          bankName.includes(term) ||
          businessType.includes(term) ||
          designation.includes(term) ||
          signatory.includes(term) ||
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

  // Slide-Over Detail Drawer navigation for Firm Review
  const selectedRequestIndex = useMemo(() => {
    if (!selectedRequest) return -1;
    return sortedRequests.findIndex((r) => r._id === selectedRequest._id);
  }, [selectedRequest, sortedRequests]);

  const canGoPrevRequest = selectedRequestIndex > 0;
  const canGoNextRequest = selectedRequestIndex >= 0 && selectedRequestIndex < sortedRequests.length - 1;

  const handlePrevRequest = useCallback(() => {
    if (selectedRequestIndex > 0) {
      setSelectedRequest(sortedRequests[selectedRequestIndex - 1]);
    }
  }, [selectedRequestIndex, sortedRequests]);

  const handleNextRequest = useCallback(() => {
    if (selectedRequestIndex >= 0 && selectedRequestIndex < sortedRequests.length - 1) {
      setSelectedRequest(sortedRequests[selectedRequestIndex + 1]);
    }
  }, [selectedRequestIndex, sortedRequests]);

  // Drawer keyboard shortcuts (Left/Right arrow to cycle requests, Esc to close)
  useEffect(() => {
    if (!selectedRequest || docPreviewModal.isOpen) return;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      if (e.key === 'Escape') {
        setSelectedRequest(null);
      } else if (e.key === 'ArrowLeft') {
        if (canGoPrevRequest) handlePrevRequest();
      } else if (e.key === 'ArrowRight') {
        if (canGoNextRequest) handleNextRequest();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRequest, canGoPrevRequest, canGoNextRequest, handlePrevRequest, handleNextRequest, docPreviewModal.isOpen]);

  // Prevent background scroll when Drawer is open
  useEffect(() => {
    if (selectedRequest) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedRequest]);

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

  // Ensure current page does not exceed total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      handlePageChange(1);
    }
  }, [currentPage, totalPages]);

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
        title="Firm Onboarding"
        icon={FiUserCheck}
        badgeIcon={FiUserCheck}
        subtitle="Review, approve, and initiate customer onboarding requests across enterprise companies"
        actions={
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Live Polling Status Indicator / Toggle */}
            <button
              type="button"
              onClick={() => setIsPollingActive((prev) => !prev)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 ${
                isPollingActive
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                  : 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
              title={
                isPollingActive
                  ? `Live polling active (every 15s). Click to pause.${
                      lastPolledAt ? ` Last checked at ${lastPolledAt.toLocaleTimeString()}` : ''
                    }`
                  : 'Polling paused. Click to resume auto-polling.'
              }
            >
              <span className="relative flex h-2 w-2">
                {isPollingActive && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isPollingActive ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                ></span>
              </span>
              <span className="text-[11px] font-mono font-bold">
                {isPollingActive ? 'Live (15s)' : 'Paused'}
              </span>
            </button>

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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {item.firmName}
                              </p>
                              {item.businessType && (
                                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/10 px-1.5 py-0.2 rounded border border-slate-200/60 dark:border-white/5">
                                  {item.businessType}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 px-2 py-0.5 rounded-md whitespace-nowrap">
                                {item.firmCode || '-'}
                              </span>
                              {item.firmCode && <CopyButton text={item.firmCode} />}
                              {(item.panCardUrl || item.tanCertificateUrl || item.companySealOrSignatureUrl || item.cancelledChequeUrl) && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20" title="KYC Documents Attached">
                                  <FiFileText size={10} />
                                  <span>Docs</span>
                                </span>
                              )}
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
                          {item.designation && (
                            <p className="text-[10px] text-slate-400 font-medium">
                              {item.designation}
                            </p>
                          )}
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
        {sortedRequests.length > 0 && (
          <div className="px-5 py-3.5 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <span>
                Showing <strong className="text-slate-800 dark:text-slate-200">{indexOfFirstItem + 1}</strong> to{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {Math.min(indexOfLastItem, sortedRequests.length)}
                </strong>{' '}
                of <strong className="text-slate-800 dark:text-slate-200">{sortedRequests.length}</strong> requests
              </span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-semibold shadow-xs flex items-center gap-1 text-slate-700 dark:text-slate-300"
                >
                  <FiChevronLeft size={13} />
                  <span>Previous</span>
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
                        type="button"
                        onClick={() => handlePageChange(pg)}
                        className={`min-w-7 h-7 px-2 flex items-center justify-center rounded-lg font-bold transition-colors cursor-pointer ${
                          currentPage === pg
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
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
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-semibold shadow-xs flex items-center gap-1 text-slate-700 dark:text-slate-300"
                >
                  <span>Next</span>
                  <FiChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DETAIL SLIDE-OVER DRAWER */}
      {selectedRequest &&
        createPortal(
          <div className="fixed inset-0 z-[10000] overflow-hidden">
            {/* Backdrop Blur Overlay */}
            <div
              className="fixed inset-0 dark:bg-slate-950/60 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
              onClick={() => setSelectedRequest(null)}
            />

            {/* Slide-Over Drawer Container (Pinned to Right) */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
              <div className="w-screen max-w-2xl sm:max-w-3xl bg-white/40 dark:bg-slate-950/25 border-l border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 z-10">
                {/* 1. Sticky Drawer Header */}
                <div className="px-5 sm:px-6 py-4 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg border border-blue-500/20 shrink-0">
                      <FiServer size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                          {selectedRequest.firmName}
                        </h3>
                        {selectedRequest.firmCode && (
                          <span className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded font-semibold border border-slate-200 dark:border-white/10">
                            {selectedRequest.firmCode}
                          </span>
                        )}
                        {getStatusBadge(selectedRequest.approvalStatus)}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        Submitted: {selectedRequest.createdAt ? formatDateTimeDDMMYYYY(selectedRequest.createdAt) : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Header Actions: Quick Request Stepping + Close */}
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {selectedRequestIndex >= 0 && (
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl p-1 text-xs">
                        <button
                          type="button"
                          onClick={handlePrevRequest}
                          disabled={!canGoPrevRequest}
                          title="Previous Request (Left Arrow)"
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <FiChevronLeft size={15} />
                        </button>
                        <span className="px-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 font-semibold select-none">
                          {selectedRequestIndex + 1} of {sortedRequests.length}
                        </span>
                        <button
                          type="button"
                          onClick={handleNextRequest}
                          disabled={!canGoNextRequest}
                          title="Next Request (Right Arrow)"
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <FiChevronRight size={15} />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(null)}
                      title="Close drawer (Esc)"
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                    >
                      <FiX size={18} />
                    </button>
                  </div>
                </div>

                {/* 2. Scrollable Body Content */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-xs text-slate-600 dark:text-slate-300 custom-scrollbar">
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

                {/* Grid 1: Business Profile & Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Business Entity Profile */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-3">
                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <FiBriefcase className="text-blue-500" />
                      Business & Establishment
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Business Type</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-200/60 dark:bg-white/10 px-2 py-0.5 rounded text-[11px]">
                          {selectedRequest.businessType || 'Proprietorship'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Established Date</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">
                          {selectedRequest.dateOfEstablishment ? formatDateDDMMYYYY(selectedRequest.dateOfEstablishment) : '-'}
                        </span>
                      </div>
                      {selectedRequest.website && (
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-400">Website</span>
                          <a
                            href={selectedRequest.website.startsWith('http') ? selectedRequest.website : `https://${selectedRequest.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate max-w-[170px]"
                          >
                            <FiGlobe size={11} />
                            <span className="truncate">{selectedRequest.website}</span>
                          </a>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Cash Discount</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                          {selectedRequest.cashDiscount !== undefined && selectedRequest.cashDiscount !== null ? `${selectedRequest.cashDiscount}%` : '0%'}
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
                          {selectedRequest.contactPerson || '-'}
                          {selectedRequest.designation && (
                            <span className="text-slate-400 text-[11px] font-normal block">
                              {selectedRequest.designation}
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Primary Phone</span>
                        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200 font-semibold font-mono">
                          <span>{selectedRequest.phone || '-'}</span>
                          {selectedRequest.phone && <CopyButton text={selectedRequest.phone} />}
                        </div>
                      </div>
                      {selectedRequest.alternatePhone && (
                        <div>
                          <span className="text-[10px] text-slate-400">Alternate Phone</span>
                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-mono">
                            <span>{selectedRequest.alternatePhone}</span>
                            <CopyButton text={selectedRequest.alternatePhone} />
                          </div>
                        </div>
                      )}
                      {selectedRequest.email && (
                        <div>
                          <span className="text-[10px] text-slate-400">Email Address</span>
                          <div className="mt-0.5">
                            <GmailLink email={selectedRequest.email} label={selectedRequest.email} />
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
                          {selectedRequest.address || '-'}
                        </p>
                      </div>
                      {selectedRequest.branchAddress && (
                        <div>
                          <span className="text-[10px] text-slate-400">Branch Address</span>
                          <p className="font-medium text-slate-600 dark:text-slate-300 leading-snug">
                            {selectedRequest.branchAddress}
                          </p>
                        </div>
                      )}
                      <div className="pt-1 border-t border-slate-200/60 dark:border-white/5 flex justify-between">
                        <span className="text-[10px] text-slate-400">City, State, PIN</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {[selectedRequest.city, selectedRequest.state, selectedRequest.pincode].filter(Boolean).join(', ') || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial & Credit Terms */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-3">
                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <FiDollarSign className="text-emerald-500" />
                      Credit & Terms
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-slate-400">Approved Credit Limit</span>
                        <span className="font-bold text-base text-slate-900 dark:text-white font-mono">
                          ₹{(selectedRequest.creditLimit ?? 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-slate-400">Credit Days Window</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">
                          {selectedRequest.creditDays ?? 30} Days
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-slate-400">Cash Discount</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {selectedRequest.cashDiscount ?? 0}%
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
                        {selectedRequest.panCardUrl ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded">
                            Uploaded
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400">Not Uploaded</span>
                        )}
                      </div>
                      <div className="font-mono text-xs font-bold text-slate-800 dark:text-white">
                        {selectedRequest.panNumber || 'Not Provided'}
                      </div>
                      {selectedRequest.panCardUrl && (
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setDocPreviewModal({
                                isOpen: true,
                                title: `PAN Card (${selectedRequest.panNumber || selectedRequest.firmName})`,
                                url: selectedRequest.panCardUrl
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-[11px] font-bold transition-all cursor-pointer"
                          >
                            <FiEye size={12} />
                            <span>Preview</span>
                          </button>
                          <a
                            href={selectedRequest.panCardUrl}
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
                        {selectedRequest.tanCertificateUrl ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded">
                            Uploaded
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400">Not Uploaded</span>
                        )}
                      </div>
                      <div className="font-mono text-xs font-bold text-slate-800 dark:text-white">
                        {selectedRequest.tanNumber || 'Not Provided'}
                      </div>
                      {selectedRequest.tanCertificateUrl && (
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setDocPreviewModal({
                                isOpen: true,
                                title: `TAN Certificate (${selectedRequest.tanNumber || selectedRequest.firmName})`,
                                url: selectedRequest.tanCertificateUrl
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-[11px] font-bold transition-all cursor-pointer"
                          >
                            <FiEye size={12} />
                            <span>Preview</span>
                          </button>
                          <a
                            href={selectedRequest.tanCertificateUrl}
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
                        {selectedRequest.gstCertificateUrl ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded">
                            Proof Attached
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400">Self Declared</span>
                        )}
                      </div>
                      <div className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {selectedRequest.gstin || 'Not Provided'}
                      </div>
                      {selectedRequest.gstCertificateUrl && (
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setDocPreviewModal({
                                isOpen: true,
                                title: `GST Certificate (${selectedRequest.gstin || selectedRequest.firmName})`,
                                url: selectedRequest.gstCertificateUrl
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
                  {(selectedRequest.msmeNumber || selectedRequest.msmeCertificateUrl || selectedRequest.incorporationCertificateUrl || selectedRequest.otherLicensesUrl) && (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex flex-wrap gap-2 text-[11px]">
                      {selectedRequest.msmeNumber && (
                        <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 font-mono">
                          MSME: <strong>{selectedRequest.msmeNumber}</strong>
                        </span>
                      )}
                      {selectedRequest.msmeCertificateUrl && (
                        <button
                          type="button"
                          onClick={() => setDocPreviewModal({ isOpen: true, title: 'MSME Certificate', url: selectedRequest.msmeCertificateUrl })}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-500/20 flex items-center gap-1 cursor-pointer"
                        >
                          <FiEye size={11} /> MSME Certificate
                        </button>
                      )}
                      {selectedRequest.incorporationCertificateUrl && (
                        <button
                          type="button"
                          onClick={() => setDocPreviewModal({ isOpen: true, title: 'Incorporation Certificate', url: selectedRequest.incorporationCertificateUrl })}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-500/20 flex items-center gap-1 cursor-pointer"
                        >
                          <FiEye size={11} /> Incorporation Doc
                        </button>
                      )}
                      {selectedRequest.otherLicensesUrl && (
                        <button
                          type="button"
                          onClick={() => setDocPreviewModal({ isOpen: true, title: 'Trade / Business License', url: selectedRequest.otherLicensesUrl })}
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
                          {selectedRequest.bankName || 'Not Provided'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Account Number</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {selectedRequest.accountNumber || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">IFSC Code</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {selectedRequest.ifscCode || '-'}
                        </span>
                      </div>
                      {selectedRequest.cancelledChequeUrl && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Cancelled Cheque</span>
                          <button
                            type="button"
                            onClick={() =>
                              setDocPreviewModal({
                                isOpen: true,
                                title: `Cancelled Cheque Proof (${selectedRequest.bankName || selectedRequest.firmName})`,
                                url: selectedRequest.cancelledChequeUrl
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
                          {selectedRequest.authorizedSignatoryName || selectedRequest.contactPerson || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Designation</span>
                        <span className="text-slate-600 dark:text-slate-300">
                          {selectedRequest.signatoryDesignation || selectedRequest.designation || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Declaration</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${selectedRequest.declarationAgreed ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 text-slate-600'}`}>
                          <FiCheck size={10} />
                          {selectedRequest.declarationAgreed ? 'Agreed & Signed' : 'Pending'}
                        </span>
                      </div>
                      {selectedRequest.companySealOrSignatureUrl && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Stamp / Signature Proof</span>
                          <button
                            type="button"
                            onClick={() =>
                              setDocPreviewModal({
                                isOpen: true,
                                title: `Official Stamp / Signature (${selectedRequest.firmName})`,
                                url: selectedRequest.companySealOrSignatureUrl
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

              {/* 3. Sticky Action Footer */}
                <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50/90 dark:bg-slate-950/80 backdrop-blur-md">
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
                      Close Drawer
                    </button>
                  </div>
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

      {/* Document Preview Lightbox Modal */}
      {docPreviewModal.isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[10002] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setDocPreviewModal({ isOpen: false, title: '', url: '' })}
          >
            <div
              className="relative max-w-3xl w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
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
    </div>
  );
};

export default FirmOnboarding;
