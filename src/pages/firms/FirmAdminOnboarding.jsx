import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  FiCheck, FiLoader, FiAlertCircle, FiSearch, FiServer,
  FiRefreshCcw, FiX, FiClock, FiPhone, FiEye, FiBriefcase,
  FiUserCheck, FiUserX, FiMapPin, FiPlus, FiUser,
  FiCheckCircle, FiLayers, FiDownload, FiDollarSign,
  FiAlertTriangle, FiChevronLeft, FiChevronRight,
  FiFileText, FiCreditCard, FiExternalLink, FiShield,
  FiAward, FiGlobe, FiCalendar, FiMaximize2, FiFilter,
  FiUsers, FiTrendingUp, FiHash, FiMail, FiPercent,
  FiUserPlus
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import CopyButton from '@/components/ui/CopyButton';
import CustomDropdown from '@/components/ui/CustomDropdown';
import GmailLink from '@/components/ui/GmailLink';
import { useDisplayPreferences } from '@/utils/displayPreferences';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import PageHeader from '@/components/ui/PageHeader';
import { StatusBadge, SegmentedTabs, EmptyState, OptimizedImage } from '@/components/ui';
import {
  adminOnboardFirmApi,
  getFirmOnboardingStatsApi,
  getFirmCreatorsApi,
  getFirmsByCreatorApi,
  getCompaniesApi,
  getUsersApi
} from '@/api/axios';
import { formatEntityCode, formatPhone, formatGSTIN, formatPincode } from '@/utils/formatters';
import { validateEntityCode, validatePhone, validateEmail, validateGSTIN, validatePincode } from '@/utils/validators';

const INITIAL_ONBOARD_FORM = {
  companyId: '',
  salesExecutiveId: '',
  firmName: '',
  firmCode: '',
  businessType: 'Proprietorship',
  dateOfEstablishment: '',
  address: '',
  branchAddress: '',
  city: '',
  state: '',
  pincode: '',
  contactPerson: '',
  designation: 'Managing Director',
  phone: '',
  alternatePhone: '',
  email: '',
  website: '',
  creditDays: 30,
  creditLimit: 500000,
  cashDiscount: 2,
  panNumber: '',
  panCardUrl: '',
  tanNumber: '',
  tanCertificateUrl: '',
  gstin: '',
  gstCertificateUrl: '',
  msmeNumber: '',
  bankName: 'HDFC Bank',
  accountNumber: '',
  ifscCode: '',
  cancelledChequeUrl: '',
  declarationAgreed: true,
  authorizedSignatoryName: '',
  signatoryDesignation: 'Authorized Partner',
  companySealOrSignatureUrl: '',
  approvalStatus: 'APPROVED',
  isActive: true
};

const BUSINESS_TYPES = [
  'Proprietorship',
  'Partnership',
  'Private Limited',
  'Public Limited',
  'Limited Liability Partnership (LLP)',
  'One Person Company (OPC)',
  'Joint Venture',
  'Other'
];

const FirmAdminOnboarding = () => {
  const navigate = useNavigate();
  const { salesExecutiveId: paramSalesExecutiveId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // Core Data States
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    byCompany: []
  });
  const [creatorsSummary, setCreatorsSummary] = useState({
    totalCreators: 0,
    totalFirmsCreated: 0,
    totalPendingFirms: 0,
    totalApprovedFirms: 0,
    totalRejectedFirms: 0
  });
  const [creators, setCreators] = useState([]);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [salesExecutivesList, setSalesExecutivesList] = useState([]);

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [isPollingActive, setIsPollingActive] = useState(true);
  const [lastPolledAt, setLastPolledAt] = useState(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('ALL');

  // Creator Firms Detail Drawer / Modal State
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [creatorFirms, setCreatorFirms] = useState([]);
  const [creatorFirmsMeta, setCreatorFirmsMeta] = useState(null);
  const [loadingCreatorFirms, setLoadingCreatorFirms] = useState(false);
  const [creatorFirmsError, setCreatorFirmsError] = useState('');
  const [creatorFirmsSearch, setCreatorFirmsSearch] = useState('');
  const [creatorFirmsStatusFilter, setCreatorFirmsStatusFilter] = useState('ALL');

  // Single Firm Details Drawer
  const [selectedFirm, setSelectedFirm] = useState(null);

  // Lightbox Document Preview Modal
  const [docPreviewModal, setDocPreviewModal] = useState({
    isOpen: false,
    title: '',
    url: ''
  });

  // Admin Onboarding Modal State
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [onboardFormData, setOnboardFormData] = useState(INITIAL_ONBOARD_FORM);
  const [onboardFormErrors, setOnboardFormErrors] = useState({});
  const [onboardSubmitting, setOnboardSubmitting] = useState(false);
  const [onboardApiError, setOnboardApiError] = useState('');

  // Preferences
  const { preferences: displayPrefs } = useDisplayPreferences();

  // 1. Fetch Onboarding Stats & Creators Data
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError('');

    try {
      const [statsRes, creatorsRes, companiesRes, usersRes] = await Promise.allSettled([
        getFirmOnboardingStatsApi(),
        getFirmCreatorsApi(),
        getCompaniesApi(),
        getUsersApi({ role: 'SALES_EXECUTIVE' })
      ]);

      // Process Stats
      if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
        const statsData = statsRes.value.data.data || statsRes.value.data;
        const rawByCompany = Array.isArray(statsData.byCompany) ? statsData.byCompany : [];
        // Stable deterministic sort by company name so buttons do not change position on polling
        const sortedByCompany = [...rawByCompany].sort((a, b) => {
          const nameA = (a.name || a.code || '').trim().toLowerCase();
          const nameB = (b.name || b.code || '').trim().toLowerCase();
          return nameA.localeCompare(nameB);
        });

        setStats({
          total: Number(statsData.total || 0),
          pending: Number(statsData.pending || 0),
          approved: Number(statsData.approved || 0),
          rejected: Number(statsData.rejected || 0),
          byCompany: sortedByCompany
        });
      }

      // Process Creators
      if (creatorsRes.status === 'fulfilled' && creatorsRes.value?.data) {
        const creatorsData = creatorsRes.value.data.data || creatorsRes.value.data;
        if (creatorsData.summary) {
          setCreatorsSummary({
            totalCreators: Number(creatorsData.summary.totalCreators || 0),
            totalFirmsCreated: Number(creatorsData.summary.totalFirmsCreated || 0),
            totalPendingFirms: Number(creatorsData.summary.totalPendingFirms || 0),
            totalApprovedFirms: Number(creatorsData.summary.totalApprovedFirms || 0),
            totalRejectedFirms: Number(creatorsData.summary.totalRejectedFirms || 0)
          });
        }
        let rawCreators = [];
        if (Array.isArray(creatorsData.creators)) {
          rawCreators = creatorsData.creators;
        } else if (Array.isArray(creatorsData)) {
          rawCreators = creatorsData;
        }

        // Stable sort creators so their cards also keep deterministic positions
        const sortedCreators = [...rawCreators].sort((a, b) => {
          const aFirms = a.metrics?.totalFirms || 0;
          const bFirms = b.metrics?.totalFirms || 0;
          if (bFirms !== aFirms) return bFirms - aFirms;
          const nameA = (a.fullName || a.firstName || '').toLowerCase();
          const nameB = (b.fullName || b.firstName || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

        setCreators(sortedCreators);
      }

      // Process Companies
      if (companiesRes.status === 'fulfilled' && companiesRes.value?.data) {
        const compList = Array.isArray(companiesRes.value.data.data)
          ? companiesRes.value.data.data
          : (Array.isArray(companiesRes.value.data) ? companiesRes.value.data : []);
        setAvailableCompanies(compList);
      }

      // Process Users / Sales Executives for Dropdown
      if (usersRes.status === 'fulfilled' && usersRes.value?.data) {
        const usersList = Array.isArray(usersRes.value.data.data)
          ? usersRes.value.data.data
          : (Array.isArray(usersRes.value.data) ? usersRes.value.data : []);
        setSalesExecutivesList(usersList);
      }

      setLastPolledAt(new Date());
    } catch (err) {
      console.error('Error fetching admin onboarding data:', err);
      setError(err?.response?.data?.message || 'Failed to load onboarding metrics and creators.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling Effect (every 15s)
  useEffect(() => {
    if (!isPollingActive) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [isPollingActive, fetchData]);

  // Global ESC Key Listener to dismiss modals cleanly
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (docPreviewModal.isOpen) {
          setDocPreviewModal({ isOpen: false, title: '', url: '' });
        } else if (isOnboardModalOpen && !onboardSubmitting) {
          setIsOnboardModalOpen(false);
        } else if (selectedFirm) {
          setSelectedFirm(null);
        } else if (selectedCreator) {
          setSelectedCreator(null);
          setCreatorFirms([]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [docPreviewModal.isOpen, isOnboardModalOpen, onboardSubmitting, selectedFirm, selectedCreator]);

  // Fetch Firms for a Specific Creator (Drilldown)
  const fetchFirmsByCreator = useCallback(async (salesExecutiveId, creatorObj = null) => {
    if (!salesExecutiveId) return;
    setLoadingCreatorFirms(true);
    setCreatorFirmsError('');
    if (creatorObj) {
      setSelectedCreator(creatorObj);
    }

    try {
      const response = await getFirmsByCreatorApi(salesExecutiveId);
      const resData = response?.data || {};
      const firmsList = Array.isArray(resData.data)
        ? resData.data
        : (Array.isArray(resData) ? resData : []);
      const meta = resData.meta || null;

      setCreatorFirms(firmsList);
      setCreatorFirmsMeta(meta);

      if (!creatorObj && meta?.salesExecutive) {
        setSelectedCreator(meta.salesExecutive);
      }
    } catch (err) {
      console.error('Error fetching firms by creator:', err);
      setCreatorFirmsError(err?.response?.data?.message || 'Failed to load firms created by this sales person.');
    } finally {
      setLoadingCreatorFirms(false);
    }
  }, []);

  // Handle URL param creator if opened directly
  useEffect(() => {
    const creatorIdToOpen = paramSalesExecutiveId || searchParams.get('creator');
    if (creatorIdToOpen && creators.length > 0) {
      const foundCreator = creators.find(
        (c) => (c.salesExecutiveId || c._id || c.id) === creatorIdToOpen
      );
      fetchFirmsByCreator(creatorIdToOpen, foundCreator || { id: creatorIdToOpen, fullName: 'Sales Executive' });
    }
  }, [paramSalesExecutiveId, searchParams, creators, fetchFirmsByCreator]);

  // Selected Company Object for robust cross-matching
  const selectedCompanyObj = useMemo(() => {
    if (!selectedCompanyFilter || selectedCompanyFilter === 'ALL') return null;
    const filterLower = String(selectedCompanyFilter).trim().toLowerCase();
    const filterNorm = filterLower.replace(/[^a-zA-Z0-9]/g, '');

    return (
      stats.byCompany.find((c) => {
        const cId = String(c.companyId || c._id || '').toLowerCase();
        const cCode = String(c.code || '').toLowerCase();
        const cCodeNorm = cCode.replace(/[^a-zA-Z0-9]/g, '');
        const cName = String(c.name || '').toLowerCase();
        return (
          cId === filterLower ||
          cCode === filterLower ||
          cCodeNorm === filterNorm ||
          cName === filterLower
        );
      }) ||
      availableCompanies.find((c) => {
        const cId = String(c._id || c.id || '').toLowerCase();
        const cCode = String(c.code || '').toLowerCase();
        const cCodeNorm = cCode.replace(/[^a-zA-Z0-9]/g, '');
        const cName = String(c.name || '').toLowerCase();
        return (
          cId === filterLower ||
          cCode === filterLower ||
          cCodeNorm === filterNorm ||
          cName === filterLower
        );
      }) || {
        companyId: selectedCompanyFilter,
        code: selectedCompanyFilter,
        name: selectedCompanyFilter
      }
    );
  }, [selectedCompanyFilter, stats.byCompany, availableCompanies]);

  // Company Filter Tabs for SegmentedTabs
  const companyTabs = useMemo(() => {
    const allTab = {
      id: 'ALL',
      label: 'All Companies',
      count: stats.total || creatorsSummary.totalFirmsCreated || 0
    };

    const compTabs = (stats.byCompany || []).map((comp) => {
      const tabId = comp.companyId || comp._id || comp.code || comp.name;
      return {
        id: tabId,
        label: comp.name || comp.code,
        count: comp.total || 0
      };
    });

    return [allTab, ...compTabs];
  }, [stats.total, stats.byCompany, creatorsSummary.totalFirmsCreated]);

  const handleCompanyFilterChange = useCallback((tabId) => {
    if (selectedCompanyFilter === tabId && tabId !== 'ALL') {
      setSelectedCompanyFilter('ALL');
    } else {
      setSelectedCompanyFilter(tabId);
    }
  }, [selectedCompanyFilter]);

  // Helper to test if a firm matches the selected company
  const doesFirmBelongToCompany = useCallback((firm, company) => {
    if (!firm || !company) return false;

    const targetId = String(company.companyId || company._id || company.id || '').trim().toLowerCase();
    const targetCode = String(company.code || '').trim();
    const targetName = String(company.name || '').trim().toLowerCase();

    // 1. Direct company ID match (if companyId is ObjectId string or populated object)
    const firmCompId = typeof firm.companyId === 'object'
      ? String(firm.companyId?._id || firm.companyId?.id || '').trim().toLowerCase()
      : String(firm.companyId || '').trim().toLowerCase();

    if (targetId && firmCompId && targetId === firmCompId) {
      return true;
    }

    // 2. Direct company name match (when populated)
    if (typeof firm.companyId === 'object' && firm.companyId?.name) {
      const firmCompName = String(firm.companyId.name).trim().toLowerCase();
      if (targetName && firmCompName === targetName) {
        return true;
      }
    }

    // 3. Firm Code prefix normalization match (e.g. firmCode "WHATNOTBGLR-TES-4754" vs code "WHATNOT-BGLR")
    if (firm.firmCode && targetCode) {
      const rawPrefix = String(firm.firmCode).split('-')[0] || '';
      const normPrefix = rawPrefix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const normTargetCode = targetCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

      if (normPrefix && normTargetCode) {
        if (normPrefix === normTargetCode) return true;
        if (normPrefix.startsWith(normTargetCode) || normTargetCode.startsWith(normPrefix)) return true;
      }

      const normFullCode = String(firm.firmCode).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (normTargetCode && normFullCode.startsWith(normTargetCode)) return true;
    }

    // 4. Firm Code prefix against company name (e.g. "INIZIO-LOT-2482" vs company name "Inizio")
    if (firm.firmCode && targetName) {
      const rawPrefix = String(firm.firmCode).split('-')[0] || '';
      const normPrefix = rawPrefix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const normTargetName = targetName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (normPrefix && normTargetName && normTargetName.includes(normPrefix)) {
        return true;
      }
    }

    return false;
  }, []);

  // Helper to test if a creator belongs to the selected company
  const doesCreatorBelongToCompany = useCallback((creator, company) => {
    if (!creator || !company) return false;

    // Check recentFirms
    if (Array.isArray(creator.recentFirms) && creator.recentFirms.length > 0) {
      if (creator.recentFirms.some((f) => doesFirmBelongToCompany(f, company))) {
        return true;
      }
    }

    // Check assignedCompanyIds or companyId
    const targetId = String(company.companyId || company._id || company.id || '').trim().toLowerCase();
    if (targetId) {
      if (creator.companyId && String(creator.companyId).trim().toLowerCase() === targetId) return true;
      if (Array.isArray(creator.assignedCompanyIds)) {
        if (creator.assignedCompanyIds.some((cid) => String(cid?._id || cid).trim().toLowerCase() === targetId)) {
          return true;
        }
      }
    }

    return false;
  }, [doesFirmBelongToCompany]);

  // Filtered Creators based on search & company
  const filteredCreators = useMemo(() => {
    let result = [...creators];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((creator) => {
        const name = (creator.fullName || `${creator.firstName || ''} ${creator.lastName || ''}`).toLowerCase();
        const email = (creator.email || '').toLowerCase();
        const phone = (creator.phone || '').toLowerCase();
        const role = (creator.role || '').toLowerCase();
        const recentMatch = (creator.recentFirms || []).some(
          (f) =>
            (f.firmName || '').toLowerCase().includes(term) ||
            (f.firmCode || '').toLowerCase().includes(term) ||
            (f.city || '').toLowerCase().includes(term)
        );

        return name.includes(term) || email.includes(term) || phone.includes(term) || role.includes(term) || recentMatch;
      });
    }

    // Company filter
    if (selectedCompanyFilter !== 'ALL' && selectedCompanyObj) {
      result = result.filter((creator) => doesCreatorBelongToCompany(creator, selectedCompanyObj));
    }

    return result;
  }, [creators, searchTerm, selectedCompanyFilter, selectedCompanyObj, doesCreatorBelongToCompany]);

  // Filtered Creator Firms for Drawer
  const filteredCreatorFirms = useMemo(() => {
    let result = [...creatorFirms];

    if (creatorFirmsSearch.trim()) {
      const term = creatorFirmsSearch.toLowerCase();
      result = result.filter((f) => {
        const name = (f.firmName || '').toLowerCase();
        const code = (f.firmCode || '').toLowerCase();
        const contact = (f.contactPerson || '').toLowerCase();
        const phone = (f.phone || '').toLowerCase();
        const city = (f.city || '').toLowerCase();
        const comp = (f.companyId?.name || f.companyId?.code || '').toLowerCase();
        return name.includes(term) || code.includes(term) || contact.includes(term) || phone.includes(term) || city.includes(term) || comp.includes(term);
      });
    }

    if (creatorFirmsStatusFilter !== 'ALL') {
      result = result.filter(
        (f) => (f.approvalStatus || 'APPROVED').toUpperCase() === creatorFirmsStatusFilter.toUpperCase()
      );
    }

    return result;
  }, [creatorFirms, creatorFirmsSearch, creatorFirmsStatusFilter]);

  // Export Creators to Excel (respects active search & company filter)
  const handleExportExcel = () => {
    if (filteredCreators.length === 0) return;

    const dataToExport = filteredCreators.map((c) => ({
      'Sales Executive': c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
      'Email': c.email || 'N/A',
      'Phone': c.phone || 'N/A',
      'Role': c.role || 'SALES_EXECUTIVE',
      'Total Firms Created': c.metrics?.totalFirms || 0,
      'Approved Firms': c.metrics?.approvedFirms || 0,
      'Pending Firms': c.metrics?.pendingFirms || 0,
      'Rejected Firms': c.metrics?.rejectedFirms || 0,
      'Active Firms': c.metrics?.activeFirms || 0,
      'Recent Firms': (c.recentFirms || []).map((rf) => `${rf.firmName} (${rf.firmCode || 'N/A'})`).join('; ')
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Creators');
    XLSX.writeFile(workbook, `sales_creators_onboarding_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Open Direct Admin Onboard Modal
  const handleOpenOnboardModal = (prefillSalesExecutiveId = '') => {
    setOnboardFormData({
      ...INITIAL_ONBOARD_FORM,
      companyId: availableCompanies[0]?._id || '',
      salesExecutiveId: prefillSalesExecutiveId || creators[0]?.salesExecutiveId || creators[0]?._id || salesExecutivesList[0]?._id || ''
    });
    setOnboardFormErrors({});
    setOnboardApiError('');
    setIsOnboardModalOpen(true);
  };

  // Generate Suggested Firm Code
  const handleAutoGenerateFirmCode = () => {
    const comp = availableCompanies.find((c) => c._id === onboardFormData.companyId);
    const prefix = comp ? (comp.code || comp.name.slice(0, 7)).toUpperCase().replace(/[^A-Z0-9]/g, '') : 'FIRM';
    const namePart = (onboardFormData.firmName || 'FIRM').slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const randDigits = Math.floor(1000 + Math.random() * 9000);
    const suggestedCode = `${prefix}-${namePart || 'NEW'}-${randDigits}`;
    setOnboardFormData((prev) => ({ ...prev, firmCode: suggestedCode }));
  };

  // Validate Admin Onboarding Form
  const validateForm = () => {
    const errors = {};

    if (!onboardFormData.companyId) errors.companyId = 'Please select a company';
    if (!onboardFormData.firmName.trim()) errors.firmName = 'Firm name is required';
    if (!onboardFormData.firmCode.trim()) errors.firmCode = 'Firm code is required';
    if (!onboardFormData.contactPerson.trim()) errors.contactPerson = 'Contact person is required';

    if (!onboardFormData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!validatePhone(onboardFormData.phone)) {
      errors.phone = 'Enter a valid 10-digit phone number';
    }

    if (onboardFormData.alternatePhone && !validatePhone(onboardFormData.alternatePhone)) {
      errors.alternatePhone = 'Enter a valid 10-digit alternate phone number';
    }

    if (!onboardFormData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!validateEmail(onboardFormData.email)) {
      errors.email = 'Enter a valid email address';
    }

    if (!onboardFormData.address.trim()) errors.address = 'Registered address is required';
    if (!onboardFormData.city.trim()) errors.city = 'City is required';
    if (!onboardFormData.state.trim()) errors.state = 'State is required';

    if (!onboardFormData.pincode.trim()) {
      errors.pincode = 'Pincode is required';
    } else if (!validatePincode(onboardFormData.pincode)) {
      errors.pincode = 'Enter a valid 6-digit Indian pincode';
    }

    if (onboardFormData.gstin && !validateGSTIN(onboardFormData.gstin)) {
      errors.gstin = 'Invalid GSTIN format (15 characters: e.g. 36ABCDE1234F1Z5)';
    }

    if (!onboardFormData.declarationAgreed) {
      errors.declarationAgreed = 'You must confirm the legal onboarding declaration';
    }

    setOnboardFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Admin Direct Onboarding
  const handleSubmitAdminOnboard = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setOnboardSubmitting(true);
    setOnboardApiError('');

    try {
      const payload = {
        companyId: onboardFormData.companyId,
        firmName: onboardFormData.firmName.trim(),
        firmCode: onboardFormData.firmCode.trim().toUpperCase(),
        businessType: onboardFormData.businessType,
        dateOfEstablishment: onboardFormData.dateOfEstablishment || undefined,
        address: onboardFormData.address.trim(),
        branchAddress: onboardFormData.branchAddress.trim() || undefined,
        city: onboardFormData.city.trim(),
        state: onboardFormData.state.trim(),
        pincode: onboardFormData.pincode.trim(),
        contactPerson: onboardFormData.contactPerson.trim(),
        designation: onboardFormData.designation.trim() || undefined,
        phone: formatPhone(onboardFormData.phone),
        alternatePhone: onboardFormData.alternatePhone ? formatPhone(onboardFormData.alternatePhone) : undefined,
        email: onboardFormData.email.trim().toLowerCase(),
        website: onboardFormData.website.trim() || undefined,
        creditDays: Number(onboardFormData.creditDays) || 30,
        creditLimit: Number(onboardFormData.creditLimit) || 0,
        cashDiscount: Number(onboardFormData.cashDiscount) || 0,
        panNumber: onboardFormData.panNumber.trim().toUpperCase() || undefined,
        panCardUrl: onboardFormData.panCardUrl.trim() || undefined,
        tanNumber: onboardFormData.tanNumber.trim().toUpperCase() || undefined,
        tanCertificateUrl: onboardFormData.tanCertificateUrl.trim() || undefined,
        gstin: onboardFormData.gstin.trim().toUpperCase() || undefined,
        gstCertificateUrl: onboardFormData.gstCertificateUrl.trim() || undefined,
        msmeNumber: onboardFormData.msmeNumber.trim().toUpperCase() || undefined,
        bankName: onboardFormData.bankName.trim() || undefined,
        accountNumber: onboardFormData.accountNumber.trim() || undefined,
        ifscCode: onboardFormData.ifscCode.trim().toUpperCase() || undefined,
        cancelledChequeUrl: onboardFormData.cancelledChequeUrl.trim() || undefined,
        declarationAgreed: Boolean(onboardFormData.declarationAgreed),
        authorizedSignatoryName: onboardFormData.authorizedSignatoryName.trim() || onboardFormData.contactPerson.trim(),
        signatoryDesignation: onboardFormData.signatoryDesignation.trim() || 'Authorized Signatory',
        companySealOrSignatureUrl: onboardFormData.companySealOrSignatureUrl.trim() || undefined,
        approvalStatus: onboardFormData.approvalStatus || 'APPROVED',
        isActive: Boolean(onboardFormData.isActive),
        salesExecutiveId: onboardFormData.salesExecutiveId || undefined
      };

      await adminOnboardFirmApi(payload);

      setSuccessToast(`Firm "${payload.firmName}" onboarded successfully!`);
      setIsOnboardModalOpen(false);
      setOnboardFormData(INITIAL_ONBOARD_FORM);

      // Refresh stats & creators
      fetchData(true);

      // If a creator drawer was active and matches, refresh it
      if (selectedCreator && (selectedCreator.salesExecutiveId === payload.salesExecutiveId || selectedCreator.id === payload.salesExecutiveId)) {
        fetchFirmsByCreator(payload.salesExecutiveId, selectedCreator);
      }
    } catch (err) {
      console.error('Error submitting admin firm onboard:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to onboard firm. Please check input fields.';
      setOnboardApiError(msg);
    } finally {
      setOnboardSubmitting(false);
    }
  };

  // Close Toast
  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => setSuccessToast(''), 4500);
    return () => clearTimeout(timer);
  }, [successToast]);

  return (
    <div className="space-y-5 pb-12 w-full">
      {/* Success Toast */}
      {successToast && (
        <div className="fixed top-5 right-5 z-[10001] flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-2xl animate-in slide-in-from-top-4 fade-in">
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
        title="Admin Onboarding"
        icon={FiUserPlus}
        badgeIcon={FiUserCheck}
        subtitle="Direct firm onboarding, sales creator analytics, and company distribution metrics."
        actions={
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Live Polling Status Indicator */}
            <button
              type="button"
              onClick={() => setIsPollingActive((prev) => !prev)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 ${isPollingActive
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                : 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'
                }`}
              title={
                isPollingActive
                  ? `Live polling active (every 15s). Click to pause.${lastPolledAt ? ` Last checked at ${lastPolledAt.toLocaleTimeString()}` : ''
                  }`
                  : 'Polling paused. Click to resume auto-polling.'
              }
            >
              <span className="relative flex h-2 w-2">
                {isPollingActive && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${isPollingActive ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                ></span>
              </span>
              <span className="text-[11px] font-mono font-bold">
                {isPollingActive ? 'Live (15s)' : 'Paused'}
              </span>
            </button>

            {/* Refresh */}
            <button
              onClick={() => fetchData(false)}
              disabled={loading}
              className="px-3.5 py-2 text-xs bg-white/40 dark:bg-white/5 font-semibold rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 shadow-md hover:bg-slate-100 dark:hover:bg-white/10 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              title="Refresh data"
            >
              <FiRefreshCcw className={`text-sm ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {/* Export */}
            <button
              onClick={handleExportExcel}
              disabled={creators.length === 0}
              className="px-3.5 py-2 text-xs bg-white/40 dark:bg-white/5 font-semibold rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 shadow-md hover:bg-slate-100 dark:hover:bg-white/10 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              title="Export creators list to Excel"
            >
              <FiDownload className="text-sm text-emerald-500" />
              <span>Export</span>
            </button>

            {/* Admin Onboard CTA */}
            <button
              onClick={() => handleOpenOnboardModal()}
              className="px-4 py-2 text-xs font-bold text-white rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <FiPlus className="text-base" />
              <span>Admin Onboard</span>
            </button>
          </div>
        }
      />

      {/* ========================================================
          KPI STATS CARDS (UNIFIED WITH OTHER PAGES)
         ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Onboarded */}
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-blue-500/30 hover:border-blue-500/60 transition-all group">
          <div className="flex items-center justify-between">
            <span className="kpi-card-title text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Total Onboarded
            </span>
            <div className="w-10 h-10 rounded-xl kpi-icon-blue flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <FiLayers size={18} />
            </div>
          </div>
          <p className="kpi-card-value text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight truncate font-mono">
            {stats.total || creatorsSummary.totalFirmsCreated || 0}
          </p>
          <p className="kpi-card-subtitle text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            Across {stats.byCompany.length} trading companies
          </p>
        </div>

        {/* Approved Firms */}
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-emerald-500/30 hover:border-emerald-500/60 transition-all group">
          <div className="flex items-center justify-between">
            <span className="kpi-card-title text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Approved Firms
            </span>
            <div className="w-10 h-10 rounded-xl kpi-icon-emerald flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <FiUserCheck size={18} />
            </div>
          </div>
          <p className="kpi-card-value text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight truncate font-mono">
            {stats.approved || creatorsSummary.totalApprovedFirms || 0}
          </p>
          <p className="kpi-card-subtitle text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            Ready for purchase orders
          </p>
        </div>

        {/* Pending Verification */}
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-amber-500/30 shadow-xs hover:border-amber-500/60 transition-all group">
          <div className="flex items-center justify-between">
            <span className="kpi-card-title text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span>Pending Review</span>
            </span>
            <div className="w-10 h-10 rounded-xl kpi-icon-amber flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <FiClock size={18} />
            </div>
          </div>
          <p className="kpi-card-value text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight truncate font-mono">
            {stats.pending ?? creatorsSummary.totalPendingFirms ?? 0}
          </p>
          <p className="kpi-card-subtitle text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            Awaiting admin sign-off
          </p>
        </div>

        {/* Rejected */}
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-rose-500/30 shadow-xs hover:border-rose-500/60 transition-all group">
          <div className="flex items-center justify-between">
            <span className="kpi-card-title text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Rejected Firms
            </span>
            <div className="w-10 h-10 rounded-xl kpi-icon-rose flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <FiUserX size={18} />
            </div>
          </div>
          <p className="kpi-card-value text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight truncate font-mono">
            {stats.rejected ?? creatorsSummary.totalRejectedFirms ?? 0}
          </p>
          <p className="kpi-card-subtitle text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            Declined applications
          </p>
        </div>

        {/* Total Sales Creators */}
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-purple-500/30 shadow-xs hover:border-purple-500/60 transition-all group">
          <div className="flex items-center justify-between">
            <span className="kpi-card-title text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Sales Creators
            </span>
            <div className="w-10 h-10 rounded-xl kpi-icon-purple flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <FiUsers size={18} />
            </div>
          </div>
          <p className="kpi-card-value text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight truncate font-mono">
            {creatorsSummary.totalCreators || creators.length || 0}
          </p>
          <p className="kpi-card-subtitle text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            Active onboarding agents
          </p>
        </div>
      </div>

      {/* Trading Company Filter Pills (SegmentedTabs matching other pages) */}
      {stats.byCompany && stats.byCompany.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 sm:p-2 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl sm:rounded-full shadow-xs">
          <div className="flex items-center gap-2 pl-2 sm:pl-3 shrink-0">
            <FiBriefcase className="text-blue-600 dark:text-blue-400 text-sm" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Company
            </span>
          </div>

          <div className="flex-1 min-w-0 max-w-full no-scrollbar flex items-center justify-start sm:justify-center">
            <SegmentedTabs
              tabs={companyTabs}
              activeTab={selectedCompanyFilter}
              onChange={handleCompanyFilterChange}
              size="sm"
              className="w-full sm:w-auto"
            />
          </div>

          {/* {selectedCompanyFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedCompanyFilter('ALL')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline px-3 shrink-0 cursor-pointer text-center"
            >
              Clear Filter
            </button>
          )} */}
        </div>
      )}

      {/* Main Content: Search Bar & Creator List */}
      <div className="space-y-4">
        {/* Controls Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <input
              type="text"
              placeholder="Search sales executives by name, email, phone, or firm code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <FiX size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedCompanyObj && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-1.5 shrink-0">
                <span>{selectedCompanyObj.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCompanyFilter('ALL')}
                  className="hover:text-blue-800 dark:hover:text-white cursor-pointer"
                  title="Remove company filter"
                >
                  <FiX size={12} />
                </button>
              </span>
            )}
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
              Showing {filteredCreators.length} of {creators.length} Creators
            </span>
          </div>
        </div>

        {/* Creators Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="p-5 rounded-2xl bg-white/50 dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 animate-pulse space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-white/10" />
                  <div className="space-y-2 flex-1">
                    <div className="w-3/4 h-4 bg-slate-200 dark:bg-white/10 rounded" />
                    <div className="w-1/2 h-3 bg-slate-200 dark:bg-white/10 rounded" />
                  </div>
                </div>
                <div className="h-16 bg-slate-200 dark:bg-white/10 rounded-xl" />
                <div className="h-8 bg-slate-200 dark:bg-white/10 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredCreators.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 text-center">
            <EmptyState
              icon={FiUsers}
              title="No Sales Creators Found"
              description={
                searchTerm || selectedCompanyFilter !== 'ALL'
                  ? `No sales creators match ${selectedCompanyObj ? `company "${selectedCompanyObj.name}"` : 'your filter criteria'
                  }${searchTerm ? ` and search "${searchTerm}"` : ''}.`
                  : 'No sales executives have created onboarding requests yet.'
              }
              action={
                searchTerm || selectedCompanyFilter !== 'ALL' ? (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCompanyFilter('ALL');
                    }}
                    className="px-4 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-xl hover:bg-blue-500/20 transition-all cursor-pointer"
                  >
                    Reset Filters
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenOnboardModal()}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all cursor-pointer shadow-md"
                  >
                    Onboard New Firm
                  </button>
                )
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCreators.map((creator) => {
              const executiveId = creator.salesExecutiveId || creator._id || creator.id;
              const name = creator.fullName || `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || 'Unknown Executive';
              const initial = name.charAt(0).toUpperCase() || 'S';
              const metrics = creator.metrics || {
                totalFirms: 0,
                approvedFirms: 0,
                pendingFirms: 0,
                rejectedFirms: 0,
                activeFirms: 0
              };
              const recentFirms = creator.recentFirms || [];

              return (
                <div
                  key={executiveId}
                  className="p-5 rounded-2xl bg-white/50 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 hover:border-blue-500/40 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    {/* Creator Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                          {creator.profileImage ? (
                            <img
                              src={creator.profileImage}
                              alt={name}
                              className="w-full h-full object-cover rounded-xl"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            initial
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {name}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              {creator.role?.replace(/_/g, ' ') || 'Sales Executive'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Action: Direct Onboard for this creator */}
                      <button
                        type="button"
                        onClick={() => handleOpenOnboardModal(executiveId)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-white/5 transition-all cursor-pointer"
                        title={`Onboard new firm for ${name}`}
                      >
                        <FiPlus size={16} />
                      </button>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      {creator.email && (
                        <div className="flex items-center gap-2 truncate">
                          <FiMail className="text-slate-400 shrink-0 text-xs" />
                          <GmailLink email={creator.email} className="truncate" />
                        </div>
                      )}
                      {creator.phone && (
                        <div className="flex items-center gap-2">
                          <FiPhone className="text-slate-400 shrink-0 text-xs" />
                          <span className="font-mono">{formatPhone(creator.phone)}</span>
                        </div>
                      )}
                    </div>

                    {/* Performance Metrics Badges */}
                    <div className="grid grid-cols-4 gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 text-center">
                      <div>
                        <span className="block text-[9px] uppercase font-bold text-slate-400">Total</span>
                        <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                          {metrics.totalFirms}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase font-bold text-emerald-500">Approved</span>
                        <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {metrics.approvedFirms}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase font-bold text-amber-500">Pending</span>
                        <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">
                          {metrics.pendingFirms}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase font-bold text-rose-500">Rejected</span>
                        <span className="text-sm font-black font-mono text-rose-600 dark:text-rose-400">
                          {metrics.rejectedFirms}
                        </span>
                      </div>
                    </div>

                    {/* Recent Firms preview */}
                    {recentFirms.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>Recent Firms</span>
                          <span>{recentFirms.length} latest</span>
                        </div>
                        <div className="space-y-1.5">
                          {recentFirms.slice(0, 3).map((rf) => (
                            <div
                              key={rf._id}
                              onClick={() => {
                                fetchFirmsByCreator(executiveId, creator);
                              }}
                              className="p-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 hover:border-blue-400/60 transition-all flex items-center justify-between gap-2 cursor-pointer group/rf"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover/rf:text-blue-600 dark:group-hover/rf:text-blue-400">
                                  {rf.firmName}
                                </p>
                                <p className="text-[10px] font-mono text-slate-400 truncate">
                                  {rf.firmCode || 'NO CODE'} • {rf.city || 'N/A'}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <StatusBadge status={rf.approvalStatus || 'APPROVED'} size="xs" dot />
                                {rf.creditLimit > 0 && (
                                  <p className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                                    ₹{(rf.creditLimit / 100000).toFixed(1)}L
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {metrics.activeFirms} Active in system
                    </span>
                    <button
                      type="button"
                      onClick={() => fetchFirmsByCreator(executiveId, creator)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <FiEye size={13} />
                      <span>View All Firms</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================
          DRAWER: Firms Created by Specific Sales Person
          (GET /firms/admin/creators/{salesExecutiveId})
         ======================================================== */}
      {selectedCreator &&
        createPortal(
          <div className="fixed inset-0 z-[9990] overflow-hidden flex justify-end">
            {/* Backdrop */}
            <div
              className="fixed inset-0 dark:bg-slate-900/60 backdrop-blur-lg transition-opacity"
              onClick={() => {
                setSelectedCreator(null);
                setCreatorFirms([]);
              }}
            />

            <div className="relative w-full max-w-4xl bg-white/40 dark:bg-slate-900 shadow-2xl z-10 flex flex-col h-full border-l border-slate-200 dark:border-white/10 animate-in slide-in-from-right duration-250">
              {/* Header */}
              <div className="p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-900/80 backdrop-blur-md flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-blue-600 to-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                    {(selectedCreator.fullName || selectedCreator.firstName || 'S').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-black text-slate-900 dark:text-white truncate">
                        {selectedCreator.fullName || `${selectedCreator.firstName || ''} ${selectedCreator.lastName || ''}`.trim()}
                      </h2>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {selectedCreator.role || 'SALES_EXECUTIVE'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {selectedCreator.email} • {selectedCreator.phone ? formatPhone(selectedCreator.phone) : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenOnboardModal(
                        selectedCreator.salesExecutiveId || selectedCreator._id || selectedCreator.id
                      )
                    }
                    className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <FiPlus size={14} />
                    <span>Onboard for {selectedCreator.firstName || 'Creator'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCreator(null);
                      setCreatorFirms([]);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <FiX size={18} />
                  </button>
                </div>
              </div>

              {/* Sub-Header Stats Banner */}
              {creatorFirmsMeta?.summary && (
                <div className="px-5 py-3 bg-blue-50/50 dark:bg-white/2 border-b border-slate-200/80 dark:border-white/5 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <span className="text-slate-600 dark:text-slate-300">
                      Total Firms: <strong className="text-slate-900 dark:text-white font-mono">{creatorFirmsMeta.summary.total}</strong>
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Approved: <strong className="font-mono">{creatorFirmsMeta.summary.approved}</strong>
                    </span>
                    <span className="text-amber-600 dark:text-amber-400">
                      Pending: <strong className="font-mono">{creatorFirmsMeta.summary.pending}</strong>
                    </span>
                    <span className="text-rose-600 dark:text-rose-400">
                      Rejected: <strong className="font-mono">{creatorFirmsMeta.summary.rejected}</strong>
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      fetchFirmsByCreator(
                        selectedCreator.salesExecutiveId || selectedCreator._id || selectedCreator.id,
                        selectedCreator
                      )
                    }
                    disabled={loadingCreatorFirms}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <FiRefreshCcw size={12} className={loadingCreatorFirms ? 'animate-spin' : ''} />
                    <span>Reload Firms</span>
                  </button>
                </div>
              )}

              {/* Filter toolbar inside drawer */}
              <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                  <input
                    type="text"
                    placeholder="Filter firms by name, code, contact, city..."
                    value={creatorFirmsSearch}
                    onChange={(e) => setCreatorFirmsSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  {creatorFirmsSearch && (
                    <button
                      onClick={() => setCreatorFirmsSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <FiX size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {['ALL', 'APPROVED', 'PENDING', 'REJECTED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setCreatorFirmsStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${creatorFirmsStatusFilter === st
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Firms List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                {loadingCreatorFirms ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-white/40 dark:bg-white/5 animate-pulse h-24"
                      />
                    ))}
                  </div>
                ) : creatorFirmsError ? (
                  <div className="p-6 text-center space-y-2">
                    <FiAlertTriangle className="text-amber-500 text-3xl mx-auto" />
                    <p className="text-xs text-rose-500 font-semibold">{creatorFirmsError}</p>
                    <button
                      onClick={() =>
                        fetchFirmsByCreator(
                          selectedCreator.salesExecutiveId || selectedCreator._id || selectedCreator.id,
                          selectedCreator
                        )
                      }
                      className="px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-xl"
                    >
                      Try Again
                    </button>
                  </div>
                ) : filteredCreatorFirms.length === 0 ? (
                  <div className="p-8 text-center">
                    <EmptyState
                      icon={FiServer}
                      title="No Firms Found"
                      description={
                        creatorFirmsSearch || creatorFirmsStatusFilter !== 'ALL'
                          ? 'No firms match your filter criteria.'
                          : 'This sales executive has not onboarded any firms yet.'
                      }
                    />
                  </div>
                ) : (
                  filteredCreatorFirms.map((firm) => (
                    <div
                      key={firm._id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 hover:border-blue-500/40 shadow-xs hover:shadow-md transition-all space-y-3 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {firm.firmName}
                            </h4>
                            {firm.firmCode && (
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                                {firm.firmCode}
                                <CopyButton text={firm.firmCode} />
                              </span>
                            )}
                            <StatusBadge status={firm.approvalStatus || 'APPROVED'} size="xs" dot />
                            {firm.isActive && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                Active
                              </span>
                            )}
                          </div>

                          {/* Company Name & Location */}
                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                            {firm.companyId?.name && (
                              <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                                <FiBriefcase className="text-slate-400 text-xs" />
                                {firm.companyId.name}
                              </span>
                            )}
                            {(firm.city || firm.state) && (
                              <span className="flex items-center gap-1">
                                <FiMapPin className="text-slate-400 text-xs" />
                                {[firm.city, firm.state].filter(Boolean).join(', ')}
                              </span>
                            )}
                            {firm.businessType && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                                {firm.businessType}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right Action: Details Drawer */}
                        <button
                          type="button"
                          onClick={() => setSelectedFirm(firm)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <FiEye size={13} />
                          <span>Inspect</span>
                        </button>
                      </div>

                      {/* Contact & Commercial Info Banner */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
                        <div>
                          <span className="block text-[9px] uppercase font-bold text-slate-400">Contact</span>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {firm.contactPerson || 'N/A'}
                          </p>
                          <p className="font-mono text-[10px] text-slate-400 truncate">{firm.phone || ''}</p>
                        </div>

                        <div>
                          <span className="block text-[9px] uppercase font-bold text-slate-400">Credit Limit</span>
                          <p className="font-mono font-bold text-slate-900 dark:text-white">
                            ₹{(firm.creditLimit || 0).toLocaleString('en-IN')}
                          </p>
                          <p className="text-[10px] text-slate-400">{firm.creditDays || 30} days credit</p>
                        </div>

                        <div>
                          <span className="block text-[9px] uppercase font-bold text-slate-400">Tax & Bank</span>
                          <p className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate">
                            GST: {firm.gstin ? formatGSTIN(firm.gstin) : (firm.panNumber || 'N/A')}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{firm.bankName || 'No Bank'}</p>
                        </div>

                        <div>
                          <span className="block text-[9px] uppercase font-bold text-slate-400">Created On</span>
                          <p className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                            {formatDateDDMMYYYY(firm.createdAt)}
                          </p>
                          {firm.reviewedBy && (
                            <p className="text-[10px] text-slate-400 truncate">
                              By {firm.reviewedBy.firstName || 'Admin'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================
          DRAWER: Single Firm Full Inspection
         ======================================================== */}
      {selectedFirm &&
        createPortal(
          <div className="fixed inset-0 z-[9995] overflow-hidden flex justify-end">
            <div
              className="fixed inset-0 dark:bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setSelectedFirm(null)}
            />

            <div className="relative w-full max-w-2xl bg-white/20 dark:bg-slate-900 backdrop-blur-lg shadow-2xl z-10 flex flex-col h-full border-l border-slate-200 dark:border-white/10 animate-in slide-in-from-right duration-200">
              {/* Header */}
              <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {selectedFirm.firmName}
                    </h3>
                    <StatusBadge status={selectedFirm.approvalStatus || 'APPROVED'} size="xs" dot />
                  </div>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    Code: {selectedFirm.firmCode || 'N/A'} • Created {formatDateTimeDDMMYYYY(selectedFirm.createdAt)}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedFirm(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <FiX size={18} />
                </button>
              </div>

              {/* Scrollable details */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs custom-scrollbar">
                {/* Company Info */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Associated Company
                  </span>
                  <div className="flex items-center gap-3">
                    {selectedFirm.companyId?.logo && (
                      <img
                        src={selectedFirm.companyId.logo}
                        alt={selectedFirm.companyId.name}
                        className="w-10 h-10 object-contain rounded-lg p-1 bg-white"
                      />
                    )}
                    <div>
                      <h5 className="font-bold text-slate-900 dark:text-white">
                        {selectedFirm.companyId?.name || 'Trading Company'}
                      </h5>
                      <p className="text-[11px] font-mono text-slate-500">
                        Code: {selectedFirm.companyId?.code || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Commercial Terms */}
                <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-500/20 grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Credit Limit</span>
                    <p className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                      ₹{(selectedFirm.creditLimit || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Credit Days</span>
                    <p className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                      {selectedFirm.creditDays || 30} Days
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Cash Discount</span>
                    <p className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                      {selectedFirm.cashDiscount || 0}%
                    </p>
                  </div>
                </div>

                {/* Contact & Location Details */}
                <div className="space-y-3">
                  <h4 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                    Contact & Location
                  </h4>
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5">
                    <div>
                      <span className="text-[10px] text-slate-400">Contact Person</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{selectedFirm.contactPerson || 'N/A'}</p>
                      <p className="text-[10px] text-slate-400">{selectedFirm.designation || 'Proprietor'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Phone Numbers</span>
                      <p className="font-mono text-slate-800 dark:text-slate-200">{selectedFirm.phone || 'N/A'}</p>
                      {selectedFirm.alternatePhone && (
                        <p className="font-mono text-[10px] text-slate-400">{selectedFirm.alternatePhone}</p>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Email Address</span>
                      <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{selectedFirm.email || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">City, State & Pincode</span>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {[selectedFirm.city, selectedFirm.state, selectedFirm.pincode].filter(Boolean).join(', ')}
                      </p>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-slate-200/40 dark:border-white/5">
                      <span className="text-[10px] text-slate-400">Registered Address</span>
                      <p className="text-slate-700 dark:text-slate-300 mt-0.5">{selectedFirm.address || 'N/A'}</p>
                    </div>
                    {selectedFirm.branchAddress && (
                      <div className="col-span-2">
                        <span className="text-[10px] text-slate-400">Branch / Warehouse Address</span>
                        <p className="text-slate-700 dark:text-slate-300 mt-0.5">{selectedFirm.branchAddress}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tax & Banking Identifiers */}
                <div className="space-y-3">
                  <h4 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                    Tax, KYC & Banking
                  </h4>
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5">
                    <div>
                      <span className="text-[10px] text-slate-400">GSTIN</span>
                      <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedFirm.gstin || 'Not Provided'}</p>
                      {selectedFirm.gstCertificateUrl && (
                        <button
                          onClick={() =>
                            setDocPreviewModal({
                              isOpen: true,
                              title: `GST Certificate - ${selectedFirm.firmName}`,
                              url: selectedFirm.gstCertificateUrl
                            })
                          }
                          className="text-[10px] text-blue-600 dark:text-blue-400 underline mt-0.5 cursor-pointer block"
                        >
                          View GST Document
                        </button>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400">PAN Number</span>
                      <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedFirm.panNumber || 'Not Provided'}</p>
                      {selectedFirm.panCardUrl && (
                        <button
                          onClick={() =>
                            setDocPreviewModal({
                              isOpen: true,
                              title: `PAN Card - ${selectedFirm.firmName}`,
                              url: selectedFirm.panCardUrl
                            })
                          }
                          className="text-[10px] text-blue-600 dark:text-blue-400 underline mt-0.5 cursor-pointer block"
                        >
                          View PAN Card
                        </button>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400">Bank Name</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedFirm.bankName || 'N/A'}</p>
                      <p className="font-mono text-[10px] text-slate-400">
                        Acc: {selectedFirm.accountNumber || 'N/A'} • IFSC: {selectedFirm.ifscCode || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400">TAN / MSME</span>
                      <p className="font-mono text-[11px] text-slate-800 dark:text-slate-200">
                        TAN: {selectedFirm.tanNumber || 'N/A'}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400">
                        MSME: {selectedFirm.msmeNumber || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Creator & Submitter Info */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Attributed Sales Executive
                  </span>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedFirm.submittedBy?.fullName || selectedFirm.creatorName || selectedFirm.creator?.fullName || 'Sales Executive'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {selectedFirm.submittedBy?.email || selectedFirm.creator?.email || ''}
                  </p>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================
          MODAL: Direct Admin Onboard Form (POST /firms/admin/onboard)
          FIXED VIEWPORT BOUNDARIES & STICKY FOOTER
         ======================================================== */}
      {isOnboardModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 dark:bg-slate-950/75 backdrop-blur-lg animate-in fade-in overflow-hidden">
            <div className="relative w-full max-w-3xl bg-white/40 dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[88vh] h-full sm:h-auto overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Fixed Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-gradient-to-r from-blue-600/15 via-indigo-600/10 to-purple-600/10 dark:from-blue-600/30 dark:via-indigo-600/20 dark:to-purple-600/15">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                    <FiPlus size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      Admin Direct Firm Onboarding
                    </h3>
                    <p className="text-[11px] font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                      POST /firms/admin/onboard
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !onboardSubmitting && setIsOnboardModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <FiX size={18} />
                </button>
              </div>

              {/* Error Banner */}
              {onboardApiError && (
                <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 shrink-0">
                  <FiAlertCircle className="text-base shrink-0" />
                  <span>{onboardApiError}</span>
                </div>
              )}

              {/* Form Body - Scrollable */}
              <form
                id="adminOnboardForm"
                onSubmit={handleSubmitAdminOnboard}
                className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-5 text-xs custom-scrollbar"
              >
                {/* SECTION 1: Company & Sales Assignment */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-white/5 pb-1">
                    <FiBriefcase size={14} />
                    <span>1. Company & Sales Person Assignment</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Company Select */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Trading Company *
                      </label>
                      <select
                        value={onboardFormData.companyId}
                        onChange={(e) => {
                          setOnboardFormData((prev) => ({ ...prev, companyId: e.target.value }));
                          if (onboardFormErrors.companyId) {
                            setOnboardFormErrors((prev) => ({ ...prev, companyId: null }));
                          }
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
                      >
                        <option value="">Select Company...</option>
                        {availableCompanies.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name} ({c.code || 'CODE'})
                          </option>
                        ))}
                      </select>
                      {onboardFormErrors.companyId && (
                        <p className="text-[11px] text-rose-500 mt-1">{onboardFormErrors.companyId}</p>
                      )}
                    </div>

                    {/* Sales Executive Assignment */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Assigned Sales Executive
                      </label>
                      <select
                        value={onboardFormData.salesExecutiveId}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, salesExecutiveId: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
                      >
                        <option value="">None / Admin Initiated</option>
                        {creators.map((c) => {
                          const cId = c.salesExecutiveId || c._id || c.id;
                          return (
                            <option key={cId} value={cId}>
                              {c.fullName || `${c.firstName || ''} ${c.lastName || ''}`} ({c.phone || c.email})
                            </option>
                          );
                        })}
                        {salesExecutivesList
                          .filter((u) => !creators.some((c) => (c.salesExecutiveId || c._id) === u._id))
                          .map((u) => (
                            <option key={u._id} value={u._id}>
                              {u.firstName} {u.lastName} ({u.email})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    {/* Approval Status */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Initial Approval Status
                      </label>
                      <select
                        value={onboardFormData.approvalStatus}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, approvalStatus: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium font-mono"
                      >
                        <option value="APPROVED">APPROVED (Immediate Active Status)</option>
                        <option value="PENDING">PENDING (Awaiting Review)</option>
                      </select>
                    </div>

                    {/* Active Toggle */}
                    <div className="flex items-center gap-3 pt-6">
                      <input
                        type="checkbox"
                        id="isActiveToggle"
                        checked={onboardFormData.isActive}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                      />
                      <label htmlFor="isActiveToggle" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                        Mark Firm as Active in System
                      </label>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Firm Basic Information */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-white/5 pb-1">
                    <FiServer size={14} />
                    <span>2. Firm Details</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Firm Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Firm / Business Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Metro Telecom & Digital Solutions"
                        value={onboardFormData.firmName}
                        onChange={(e) => {
                          setOnboardFormData((prev) => ({ ...prev, firmName: e.target.value }));
                          if (onboardFormErrors.firmName) setOnboardFormErrors((prev) => ({ ...prev, firmName: null }));
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
                      />
                      {onboardFormErrors.firmName && (
                        <p className="text-[11px] text-rose-500 mt-1">{onboardFormErrors.firmName}</p>
                      )}
                    </div>

                    {/* Firm Code with Generator */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Firm Code *
                        </label>
                        <button
                          type="button"
                          onClick={handleAutoGenerateFirmCode}
                          className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                        >
                          Auto Suggest
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. METRO-HYD"
                        value={onboardFormData.firmCode}
                        onChange={(e) => {
                          setOnboardFormData((prev) => ({ ...prev, firmCode: e.target.value.toUpperCase() }));
                          if (onboardFormErrors.firmCode) setOnboardFormErrors((prev) => ({ ...prev, firmCode: null }));
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                      {onboardFormErrors.firmCode && (
                        <p className="text-[11px] text-rose-500 mt-1">{onboardFormErrors.firmCode}</p>
                      )}
                    </div>

                    {/* Business Type */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Business Type
                      </label>
                      <select
                        value={onboardFormData.businessType}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, businessType: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
                      >
                        {BUSINESS_TYPES.map((bt) => (
                          <option key={bt} value={bt}>
                            {bt}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Date of Establishment */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Date of Establishment
                      </label>
                      <input
                        type="date"
                        value={onboardFormData.dateOfEstablishment}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, dateOfEstablishment: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
                      />
                    </div>

                    {/* Website */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Website URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://metrotelecom.in"
                        value={onboardFormData.website}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, website: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Contact Person & Location */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-white/5 pb-1">
                    <FiUser size={14} />
                    <span>3. Contact & Address Details</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Contact Person */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Contact Person Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Kiran Reddy"
                        value={onboardFormData.contactPerson}
                        onChange={(e) => {
                          setOnboardFormData((prev) => ({ ...prev, contactPerson: e.target.value }));
                          if (onboardFormErrors.contactPerson) setOnboardFormErrors((prev) => ({ ...prev, contactPerson: null }));
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
                      />
                      {onboardFormErrors.contactPerson && (
                        <p className="text-[11px] text-rose-500 mt-1">{onboardFormErrors.contactPerson}</p>
                      )}
                    </div>

                    {/* Designation */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Designation
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Managing Director"
                        value={onboardFormData.designation}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, designation: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
                      />
                    </div>

                    {/* Primary Phone */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Primary Phone Number *
                      </label>
                      <input
                        type="tel"
                        placeholder="+919876543210"
                        value={onboardFormData.phone}
                        onChange={(e) => {
                          setOnboardFormData((prev) => ({ ...prev, phone: e.target.value }));
                          if (onboardFormErrors.phone) setOnboardFormErrors((prev) => ({ ...prev, phone: null }));
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
                      />
                      {onboardFormErrors.phone && (
                        <p className="text-[11px] text-rose-500 mt-1">{onboardFormErrors.phone}</p>
                      )}
                    </div>

                    {/* Alternate Phone */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Alternate Phone
                      </label>
                      <input
                        type="tel"
                        placeholder="+919811223344"
                        value={onboardFormData.alternatePhone}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, alternatePhone: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
                      />
                    </div>

                    {/* Email */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        placeholder="orders@metrotelecom.in"
                        value={onboardFormData.email}
                        onChange={(e) => {
                          setOnboardFormData((prev) => ({ ...prev, email: e.target.value }));
                          if (onboardFormErrors.email) setOnboardFormErrors((prev) => ({ ...prev, email: null }));
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                      {onboardFormErrors.email && (
                        <p className="text-[11px] text-rose-500 mt-1">{onboardFormErrors.email}</p>
                      )}
                    </div>

                    {/* Registered Address */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Registered Address *
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Plot 45, Cyber Gateway, Hitec City"
                        value={onboardFormData.address}
                        onChange={(e) => {
                          setOnboardFormData((prev) => ({ ...prev, address: e.target.value }));
                          if (onboardFormErrors.address) setOnboardFormErrors((prev) => ({ ...prev, address: null }));
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none font-medium"
                      />
                      {onboardFormErrors.address && (
                        <p className="text-[11px] text-rose-500 mt-1">{onboardFormErrors.address}</p>
                      )}
                    </div>

                    {/* Branch Address */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Branch / Warehouse Address (Optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Warehouse 12, Kukatpally"
                        value={onboardFormData.branchAddress}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, branchAddress: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                      />
                    </div>

                    {/* City */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        City *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Hyderabad"
                        value={onboardFormData.city}
                        onChange={(e) => {
                          setOnboardFormData((prev) => ({ ...prev, city: e.target.value }));
                          if (onboardFormErrors.city) setOnboardFormErrors((prev) => ({ ...prev, city: null }));
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
                      />
                      {onboardFormErrors.city && (
                        <p className="text-[11px] text-rose-500 mt-1">{onboardFormErrors.city}</p>
                      )}
                    </div>

                    {/* State */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        State *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Telangana"
                        value={onboardFormData.state}
                        onChange={(e) => {
                          setOnboardFormData((prev) => ({ ...prev, state: e.target.value }));
                          if (onboardFormErrors.state) setOnboardFormErrors((prev) => ({ ...prev, state: null }));
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
                      />
                      {onboardFormErrors.state && (
                        <p className="text-[11px] text-rose-500 mt-1">{onboardFormErrors.state}</p>
                      )}
                    </div>

                    {/* Pincode */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Pincode *
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="500081"
                        value={onboardFormData.pincode}
                        onChange={(e) => {
                          setOnboardFormData((prev) => ({ ...prev, pincode: e.target.value }));
                          if (onboardFormErrors.pincode) setOnboardFormErrors((prev) => ({ ...prev, pincode: null }));
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
                      />
                      {onboardFormErrors.pincode && (
                        <p className="text-[11px] text-rose-500 mt-1">{onboardFormErrors.pincode}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* SECTION 4: Commercial & Credit Terms */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-white/5 pb-1">
                    <FiDollarSign size={14} />
                    <span>4. Commercial & Credit Parameters</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Credit Days */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Credit Days
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={180}
                        placeholder="30"
                        value={onboardFormData.creditDays}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, creditDays: Number(e.target.value) }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>

                    {/* Credit Limit */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Credit Limit (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={10000}
                        placeholder="500000"
                        value={onboardFormData.creditLimit}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, creditLimit: Number(e.target.value) }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>

                    {/* Cash Discount */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Cash Discount (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        placeholder="2"
                        value={onboardFormData.cashDiscount}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, cashDiscount: Number(e.target.value) }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 5: Tax Identifiers & Documents */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-white/5 pb-1">
                    <FiFileText size={14} />
                    <span>5. Tax Identifiers & KYC Proofs</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* GSTIN */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        GSTIN (15 Digits)
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        placeholder="36ABCDE1234F1Z5"
                        value={onboardFormData.gstin}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                      {onboardFormErrors.gstin && (
                        <p className="text-[11px] text-rose-500 mt-1">{onboardFormErrors.gstin}</p>
                      )}
                    </div>

                    {/* GST Certificate URL */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        GST Certificate URL / Path
                      </label>
                      <input
                        type="text"
                        placeholder="/uploads/documents/gst_123.pdf"
                        value={onboardFormData.gstCertificateUrl}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, gstCertificateUrl: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>

                    {/* PAN */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        PAN Number (10 Digits)
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="ABCDE1234F"
                        value={onboardFormData.panNumber}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, panNumber: e.target.value.toUpperCase() }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>

                    {/* PAN Card URL */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        PAN Card URL / Path
                      </label>
                      <input
                        type="text"
                        placeholder="/uploads/documents/pan_123.pdf"
                        value={onboardFormData.panCardUrl}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, panCardUrl: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>

                    {/* TAN */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        TAN Number
                      </label>
                      <input
                        type="text"
                        placeholder="HYDA12345B"
                        value={onboardFormData.tanNumber}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, tanNumber: e.target.value.toUpperCase() }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>

                    {/* TAN Certificate URL */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        TAN Certificate URL / Path
                      </label>
                      <input
                        type="text"
                        placeholder="/uploads/documents/tan_123.pdf"
                        value={onboardFormData.tanCertificateUrl}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, tanCertificateUrl: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>

                    {/* MSME */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        MSME / Udyam Number
                      </label>
                      <input
                        type="text"
                        placeholder="UDYAM-TS-01-0012345"
                        value={onboardFormData.msmeNumber}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, msmeNumber: e.target.value.toUpperCase() }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 6: Bank Account Details */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-white/5 pb-1">
                    <FiCreditCard size={14} />
                    <span>6. Banking Information</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Bank Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC Bank"
                        value={onboardFormData.bankName}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, bankName: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
                      />
                    </div>

                    {/* Account Number */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Account Number
                      </label>
                      <input
                        type="text"
                        placeholder="50200012345678"
                        value={onboardFormData.accountNumber}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, accountNumber: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>

                    {/* IFSC */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        maxLength={11}
                        placeholder="HDFC0001234"
                        value={onboardFormData.ifscCode}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>

                    {/* Cancelled Cheque URL */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Cancelled Cheque URL / Path
                      </label>
                      <input
                        type="text"
                        placeholder="/uploads/documents/cheque_123.jpg"
                        value={onboardFormData.cancelledChequeUrl}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, cancelledChequeUrl: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 7: Authorized Signatory & Legal Declaration */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-white/5 pb-1">
                    <FiShield size={14} />
                    <span>7. Authorized Signatory & Legal Declaration</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Signatory Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Signatory Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Kiran Reddy"
                        value={onboardFormData.authorizedSignatoryName}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, authorizedSignatoryName: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
                      />
                    </div>

                    {/* Signatory Designation */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Signatory Designation
                      </label>
                      <input
                        type="text"
                        placeholder="Authorized Partner"
                        value={onboardFormData.signatoryDesignation}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, signatoryDesignation: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
                      />
                    </div>

                    {/* Seal / Signature URL */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Company Seal or Signature URL / Path
                      </label>
                      <input
                        type="text"
                        placeholder="/uploads/documents/seal_123.png"
                        value={onboardFormData.companySealOrSignatureUrl}
                        onChange={(e) => setOnboardFormData((prev) => ({ ...prev, companySealOrSignatureUrl: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>

                    {/* Declaration Agreed */}
                    <div className="sm:col-span-2 pt-1">
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5">
                        <input
                          type="checkbox"
                          id="declarationAgreed"
                          checked={onboardFormData.declarationAgreed}
                          onChange={(e) => {
                            setOnboardFormData((prev) => ({ ...prev, declarationAgreed: e.target.checked }));
                            if (onboardFormErrors.declarationAgreed) {
                              setOnboardFormErrors((prev) => ({ ...prev, declarationAgreed: null }));
                            }
                          }}
                          className="mt-0.5 w-4 h-4 text-blue-600 rounded cursor-pointer"
                        />
                        <label htmlFor="declarationAgreed" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                          I confirm that the applicant entity information, PAN, GSTIN, and banking details have been verified and comply with company credit risk policies.
                        </label>
                      </div>
                      {onboardFormErrors.declarationAgreed && (
                        <p className="text-[11px] text-rose-500 mt-1">{onboardFormErrors.declarationAgreed}</p>
                      )}
                    </div>
                  </div>
                </div>
              </form>

              {/* Fixed Sticky Footer - ALWAYS VISIBLE INSIDE VIEWPORT */}
              <div className="p-3.5 sm:p-4 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between sm:justify-end gap-3 shrink-0">
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
                  form="adminOnboardForm"
                  disabled={onboardSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {onboardSubmitting ? (
                    <>
                      <FiLoader className="animate-spin text-sm" />
                      <span>Onboarding Firm...</span>
                    </>
                  ) : (
                    <>
                      <FiCheck size={14} />
                      <span>Complete Onboarding</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================
          MODAL: Document Preview Lightbox
         ======================================================== */}
      {docPreviewModal.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[10005] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {docPreviewModal.title || 'Document Preview'}
                </h3>
                <div className="flex items-center gap-2">
                  <a
                    href={docPreviewModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
                    title="Open Original Document"
                  >
                    <FiExternalLink size={16} />
                  </a>
                  <button
                    onClick={() => setDocPreviewModal({ isOpen: false, title: '', url: '' })}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                  >
                    <FiX size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/50">
                {docPreviewModal.url.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={docPreviewModal.url}
                    title={docPreviewModal.title}
                    className="w-full h-[70vh] rounded-xl border border-white/10"
                  />
                ) : (
                  <img
                    src={docPreviewModal.url}
                    alt={docPreviewModal.title}
                    className="max-h-[75vh] max-w-full object-contain rounded-xl"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23222"/><text x="50%" y="50%" fill="%23888" font-size="14" dominant-baseline="middle" text-anchor="middle">Failed to load document preview</text></svg>';
                    }}
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

export default FirmAdminOnboarding;
