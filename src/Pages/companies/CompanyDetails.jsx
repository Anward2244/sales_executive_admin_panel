import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiArrowLeft, FiLoader, FiAlertCircle,
  FiCalendar, FiClock, FiTag, FiBriefcase,
  FiRefreshCcw, FiExternalLink, FiCheckCircle, FiXCircle,
  FiInfo, FiImage, FiCopy, FiCheck, FiEdit3, FiX, FiTrash2
} from 'react-icons/fi';
import { getCompanyByIdApi, updateCompanyApi, deleteCompanyApi } from '@/api/axios';
import { useConfirm } from '@/Context/ConfirmationContext';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import CopyButton from '@/components/ui/CopyButton';

const formatRelativeTime = (dateString) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  if (isNaN(date.getTime()) || date.getTime() === 0) return 'Never';

  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 0) return 'Just now';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDateDDMMYYYY(date);
};

const CompanyDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { confirm: confirmDialog, showAlert } = useConfirm() || {};

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    code: '',
    description: '',
    logo: '',
    isActive: true
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  const handleDeleteCompany = async () => {
    if (!company || !id) return;

    const message = `Are you sure you want to permanently delete company "${company.name}" (${company.code || id})? This action cannot be undone.`;
    let isConfirmed = false;
    if (confirmDialog) {
      isConfirmed = await confirmDialog(message);
    } else {
      isConfirmed = window.confirm(message);
    }
    if (!isConfirmed) return;

    setDeleting(true);
    try {
      await deleteCompanyApi(id);
      navigate('/companies', {
        state: { toastMessage: `Company "${company.name}" was deleted successfully.` }
      });
    } catch (err) {
      console.error('Failed to delete company:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to delete company.';
      if (showAlert) {
        showAlert(errorMsg, 'error');
      } else {
        alert(errorMsg);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!company) return;
    setEditFormData({
      name: company.name || '',
      code: company.code || '',
      description: company.description || '',
      logo: company.logo || '',
      isActive: company.isActive ?? true
    });
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    if (!editSubmitting) {
      setIsEditModalOpen(false);
      setEditError(null);
    }
  };

  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleUpdateCompany = async (e) => {
    e.preventDefault();
    if (!editFormData.name.trim()) {
      setEditError('Company Name is required.');
      return;
    }
    if (!editFormData.code.trim()) {
      setEditError('Company Code is required.');
      return;
    }

    setEditSubmitting(true);
    setEditError(null);

    const payload = {
      name: editFormData.name.trim(),
      code: editFormData.code.trim().toUpperCase(),
      description: editFormData.description ? editFormData.description.trim() : '',
      logo: editFormData.logo ? editFormData.logo.trim() : '',
      isActive: Boolean(editFormData.isActive)
    };

    try {
      const response = await updateCompanyApi(id, payload);
      const updatedData = response.data?.data || response.data || {};

      setCompany((prev) => ({
        ...prev,
        ...payload,
        ...(typeof updatedData === 'object' ? updatedData : {})
      }));

      setIsEditModalOpen(false);
      setSuccessToast(`Company "${payload.name}" updated successfully!`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error('Failed to update company:', err);
      setEditError(err.response?.data?.message || err.message || 'Failed to update company details.');
    } finally {
      setEditSubmitting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isEditModalOpen && !editSubmitting) {
        setIsEditModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditModalOpen, editSubmitting]);

  const fetchCompany = useCallback(async (isSilent = false) => {
    if (!id) return;
    if (!isSilent) setLoading(true);
    setError('');
    setImageError(false);
    try {
      const response = await getCompanyByIdApi(id);
      let companyData = null;

      if (response.data?.data) {
        companyData = response.data.data;
      } else if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
        companyData = response.data;
      }

      if (companyData) {
        setCompany(companyData);
      } else {
        setError('Company record not found.');
      }
    } catch (err) {
      console.error('Failed to fetch company details:', err);
      setError(err.response?.data?.message || 'Failed to load company details.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let ignore = false;
    if (!id) return;

    getCompanyByIdApi(id)
      .then((response) => {
        if (!ignore) {
          let companyData = null;
          if (response.data?.data) {
            companyData = response.data.data;
          } else if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
            companyData = response.data;
          }

          if (companyData) {
            setCompany(companyData);
            setError('');
          } else {
            setError('Company record not found.');
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error('Failed to fetch company details:', err);
          setError(err.response?.data?.message || 'Failed to load company details.');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [id]);

  const handleCopyRaw = () => {
    if (!company) return;
    navigator.clipboard.writeText(JSON.stringify(company, null, 2));
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const initial = company?.name ? company.name.charAt(0).toUpperCase() : 'C';
  const hasLogo = Boolean(company?.logo) && !imageError;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/companies')}
            className="p-2.5 bg-white/40 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-2xl border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer shadow-xl shrink-0 hover:scale-105 active:scale-95"
            title="Back to Companies"
          >
            <FiArrowLeft className="text-lg" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Link to="/companies" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Companies
              </Link>
              <span>/</span>
              <span className="text-slate-800 dark:text-slate-200 truncate max-w-xs font-bold">
                {company?.name || 'Company Details'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5 flex items-center gap-2.5">
              <FiBriefcase className="text-blue-600 dark:text-blue-400 shrink-0 text-2xl" />
              <span>Company Profile</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchCompany(false)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer text-xs font-bold shadow-xs hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            title="Refresh details"
          >
            <FiRefreshCcw className={`text-sm ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          {company && (
            <>
              <button
                type="button"
                onClick={handleOpenEditModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all cursor-pointer text-xs font-bold shadow-md shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
                title="Edit company profile"
              >
                <FiEdit3 className="text-sm" />
                <span>Edit Company</span>
              </button>

              <button
                type="button"
                onClick={handleCopyRaw}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer text-xs font-bold shadow-xs"
                title="Copy company data as JSON"
              >
                {copiedRaw ? <FiCheck className="text-emerald-500 text-sm" /> : <FiCopy className="text-sm" />}
                <span>{copiedRaw ? 'JSON Copied' : 'Export JSON'}</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteCompany}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200/80 dark:border-rose-500/20 transition-all cursor-pointer text-xs font-bold shadow-xs hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                title="Delete company (DEL /companies/{id})"
              >
                {deleting ? <FiLoader className="animate-spin text-sm text-rose-500" /> : <FiTrash2 className="text-sm" />}
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-16 flex flex-col items-center justify-center shadow-xs">
          <FiLoader className="text-4xl text-blue-600 animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            Loading company information...
          </p>
          <p className="text-xs text-slate-400 mt-1">Retrieving entity data from server</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-6 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-3xl text-rose-700 dark:text-rose-300 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FiAlertCircle className="text-2xl text-rose-500 shrink-0" />
            <div>
              <p className="font-bold text-sm">Failed to retrieve company</p>
              <p className="text-xs opacity-90 mt-0.5">{error}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchCompany(false)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => navigate('/companies')}
              className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
            >
              All Companies
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      {!loading && !error && company && (
        <>
          {/* Main Hero Header Card */}
          <div className="relative overflow-hidden bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl dark:shadow-black/50 isolate">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6 justify-between">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* Logo or Initial Avatar */}
                <div className="relative group shrink-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-100 dark:bg-white/5 border-2 border-slate-200/80 dark:border-white/10 flex items-center justify-center shadow-md shadow-slate-200 dark:shadow-none">
                    {hasLogo ? (
                      <img
                        src={company.logo}
                        alt={company.name}
                        onError={() => setImageError(true)}
                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center text-3xl font-black shadow-inner">
                        {initial}
                      </div>
                    )}
                  </div>
                  {company.isActive && (
                    <span
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-sm"
                      title="Company is currently Active"
                    />
                  )}
                </div>

                {/* Name, Code, ID */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      {company.name}
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                        company.isActive
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${company.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                      <span>{company.isActive ? 'Active Company' : 'Inactive'}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Monospace Code Badge */}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 font-mono font-black text-xs">
                      <FiTag className="text-xs" />
                      <span>CODE: {company.code || 'N/A'}</span>
                    </span>

                    {/* Copyable ID */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400 font-mono text-xs">
                      <span>ID:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{company._id}</span>
                      <CopyButton text={company._id} title="Copy Company ID" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Badge in Hero */}
              <div className="flex items-center gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-slate-200/80 dark:border-white/10">
                <div className="text-right hidden sm:block">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Account State</p>
                  <p className={`text-base font-extrabold ${company.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                    {company.isActive ? 'Operational' : 'Suspended'}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
                  company.isActive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}>
                  {company.isActive ? <FiCheckCircle /> : <FiXCircle />}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: Operating Code */}
            <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Short Code</p>
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <FiTag className="text-base" />
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 font-mono tracking-wider">
                {company.code || 'N/A'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">Identifier for invoice & orders</p>
            </div>

            {/* Metric 2: Catalog Status */}
            <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</p>
                <span className={`p-2 rounded-xl ${company.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                  {company.isActive ? <FiCheckCircle className="text-base" /> : <FiXCircle className="text-base" />}
                </span>
              </div>
              <p className={`text-2xl font-black mt-2 tracking-tight ${company.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {company.isActive ? 'Active' : 'Inactive'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                {company.isActive ? 'Visible across all panels' : 'Hidden from active orders'}
              </p>
            </div>

            {/* Metric 3: Created At */}
            <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Created</p>
                <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <FiCalendar className="text-base" />
                </span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-2 font-mono">
                {formatDateDDMMYYYY(company.createdAt)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium flex items-center gap-1">
                <FiClock className="text-[10px]" />
                {formatRelativeTime(company.createdAt)}
              </p>
            </div>

            {/* Metric 4: Last Updated */}
            <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Updated</p>
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <FiClock className="text-base" />
                </span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-2 font-mono">
                {formatDateDDMMYYYY(company.updatedAt)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium flex items-center gap-1">
                <FiClock className="text-[10px]" />
                {formatRelativeTime(company.updatedAt)}
              </p>
            </div>
          </div>

          {/* Details & Overview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Description & Overview (Span 2) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description Card */}
              <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                  <FiInfo className="text-blue-600 dark:text-blue-400" />
                  <span>About Company</span>
                </h3>
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10">
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {company.description || 'No description has been registered for this company.'}
                  </p>
                </div>
              </div>

              {/* Comprehensive Entity Data Table */}
              <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                  <FiBriefcase className="text-blue-600 dark:text-blue-400" />
                  <span>Entity Specifications</span>
                </h3>
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10">
                  <table className="w-full text-left text-xs border-collapse">
                    <tbody className="divide-y divide-slate-500/30 dark:divide-white/10">
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 font-bold text-slate-500 dark:text-slate-400 w-44 bg-slate-50 dark:bg-white/[0.02]">
                          Company Name
                        </td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          {company.name}
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02]">
                          Internal Code
                        </td>
                        <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {company.code || 'N/A'}
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02]">
                          System Record ID
                        </td>
                        <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <span>{company._id}</span>
                          <CopyButton text={company._id} title="Copy Mongo ID" />
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02]">
                          Active Status
                        </td>
                        <td className="p-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            company.isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${company.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span>{company.isActive ? 'Active' : 'Inactive'}</span>
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02]">
                          Registration Date
                        </td>
                        <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                          {formatDateTimeDDMMYYYY(company.createdAt, true)}
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02]">
                          Last Modified
                        </td>
                        <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                          {formatDateTimeDDMMYYYY(company.updatedAt, true)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sidebar Assets & Meta (Span 1) */}
            <div className="space-y-6">
              {/* Logo Asset Card */}
              <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                  <FiImage className="text-blue-600 dark:text-blue-400" />
                  <span>Logo Asset</span>
                </h3>

                <div className="w-full h-44 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-center p-4 overflow-hidden shadow-inner">
                  {hasLogo ? (
                    <img
                      src={company.logo}
                      alt={company.name}
                      onError={() => setImageError(true)}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-center p-4">
                      <FiImage className="text-3xl mb-2 stroke-1" />
                      <p className="text-xs font-semibold">No valid image found</p>
                      <p className="text-[10px] mt-0.5 opacity-80">Using generated initials avatar</p>
                    </div>
                  )}
                </div>

                {company.logo && (
                  <div className="mt-4 space-y-2">
                    <div className="p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Asset URL</p>
                      <p className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate" title={company.logo}>
                        {company.logo}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <CopyButton
                        text={company.logo}
                        className="flex-1 justify-center py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                        title="Copy logo image URL"
                      />
                      <a
                        href={company.logo}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-500/20 rounded-xl text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                        title="Open image in new window"
                      >
                        <FiExternalLink />
                        <span>Open</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Danger Zone Card */}
              <div className="bg-rose-500/5 dark:bg-rose-500/10 backdrop-blur-xl p-6 rounded-3xl border border-rose-200/80 dark:border-rose-500/20 shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <FiAlertCircle className="text-base shrink-0" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Danger Zone</h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Permanently remove this company entity and detach associated configuration. This action cannot be reversed.
                </p>
                <button
                  type="button"
                  onClick={handleDeleteCompany}
                  disabled={deleting}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-600/20 hover:scale-[1.01] active:scale-[0.99]"
                  title="Delete company (DEL /companies/{id})"
                >
                  {deleting ? (
                    <FiLoader className="animate-spin text-sm" />
                  ) : (
                    <FiTrash2 className="text-sm" />
                  )}
                  <span>{deleting ? 'Deleting Company...' : 'Delete Company'}</span>
                </button>
              </div>

              {/* Quick Actions Card */}
              {/* <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl space-y-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
                  <FiBriefcase className="text-blue-600 dark:text-blue-400" />
                  <span>Actions</span>
                </h3>

                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/20 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <FiEdit3 className="text-sm" />
                  <span>Edit Company Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/companies')}
                  className="w-full py-2.5 px-4 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <FiArrowLeft className="text-sm" />
                  <span>Back to Company Directory</span>
                </button>

                <button
                  type="button"
                  onClick={() => fetchCompany(false)}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-200/80 dark:border-white/10"
                >
                  <FiRefreshCcw className="text-sm" />
                  <span>Reload Company Data</span>
                </button>
              </div> */}
            </div>
          </div>
        </>
      )}

      {/* Floating Success Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-[10001] bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 font-semibold text-xs border border-emerald-400/30">
          <FiCheckCircle className="text-lg shrink-0" />
          <span>{successToast}</span>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="ml-2 hover:bg-emerald-700/50 p-1 rounded-lg transition-colors cursor-pointer"
            title="Dismiss notification"
          >
            <FiX className="text-sm" />
          </button>
        </div>
      )}

      {/* Edit Company Modal */}
      {isEditModalOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 dark:bg-slate-950/50 backdrop-blur-lg animate-fade-in"
            onClick={handleCloseEditModal}
          />

          {/* Modal Box */}
          <div className="relative bg-white/40 dark:bg-slate-950/25 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 z-10 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/10 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FiEdit3 className="text-xl" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    Edit Company
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Update company credentials and operational state.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={editSubmitting}
                onClick={handleCloseEditModal}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                title="Close"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Error Message */}
            {editError && (
              <div className="p-3.5 mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-150">
                <FiAlertCircle className="shrink-0 text-base" />
                <span>{editError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleUpdateCompany} className="space-y-4">
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
                    placeholder="https://images.unsplash.com/photo-..."
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
                  rows={3}
                  disabled={editSubmitting}
                  placeholder="e.g. Next-Gen Mobile Accessories, GaN Fast Chargers & Power Technology"
                  value={editFormData.description}
                  onChange={handleEditInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white placeholder-slate-400 resize-none leading-relaxed"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                <div>
                  <label htmlFor="editCompanyIsActive" className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer block">
                    Active Status
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Enable this company for catalogs and inventory listings.
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="editCompanyIsActive"
                  name="isActive"
                  checked={editFormData.isActive}
                  onChange={handleEditInputChange}
                  className="w-5 h-5 rounded-md text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-slate-200/80 dark:border-white/10">
                <button
                  type="button"
                  disabled={editSubmitting}
                  onClick={handleCloseEditModal}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
                >
                  {editSubmitting && <FiLoader className="animate-spin text-xs" />}
                  <span>{editSubmitting ? 'Saving Changes...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CompanyDetails;
