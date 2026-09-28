import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  FiMail,
  FiSend,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiSearch,
  FiEye,
  FiRefreshCw,
  FiX,
  FiUsers,
  FiPlus,
  FiTrash2,
  FiLoader,
  FiFilter,
  FiArrowRight,
  FiFileText,
  FiCheck,
  FiRotateCw,
  FiInbox
} from 'react-icons/fi';
import {
  getEmailLogsApi,
  resendEmailApi,
  getEmailRecipientsApi,
  updateEmailRecipientsApi
} from '@/api/axios';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import CopyButton from '@/components/ui/CopyButton';
import CustomDropdown from '@/components/ui/CustomDropdown';
import GmailLink from '@/components/ui/GmailLink';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { useDisplayPreferences } from '@/utils/displayPreferences';
import { formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import { validateEmail } from '@/utils/validators';

const EmailNotifications = () => {
  // Email Logs State
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Pagination Metadata
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  });
  const { preferences: displayPrefs } = useDisplayPreferences();
  const [currentPage, setCurrentPage] = useState(1);
  const limitPerPage = displayPrefs.rowsPerPage || 20;

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Active Recipients State (GET & PUT /emails/recipients)
  const [activeRecipients, setActiveRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [isRecipientsModalOpen, setIsRecipientsModalOpen] = useState(false);
  const [editableRecipients, setEditableRecipients] = useState([]);
  const [newRecipientInput, setNewRecipientInput] = useState('');
  const [recipientInputError, setRecipientInputError] = useState('');
  const [savingRecipients, setSavingRecipients] = useState(false);

  // Selected Log Detail Modal
  const [selectedLog, setSelectedLog] = useState(null);

  // Resend Email Modal (POST /emails/resend/{id})
  const [resendTarget, setResendTarget] = useState(null);
  const [resendMode, setResendMode] = useState('original'); // 'original' | 'custom'
  const [customRecipientsList, setCustomRecipientsList] = useState([]);
  const [customRecipientInput, setCustomRecipientInput] = useState('');
  const [customRecipientError, setCustomRecipientError] = useState('');
  const [resending, setResending] = useState(false);

  // Feedback Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Fetch Email Logs (GET /emails/logs)
  const fetchEmailLogs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = {
        page: currentPage,
        limit: limitPerPage
      };
      if (statusFilter && statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await getEmailLogsApi(params);
      const data = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      const paginationMeta = res.data?.meta || {
        total: data.length,
        page: currentPage,
        limit: limitPerPage,
        totalPages: Math.max(1, Math.ceil(data.length / limitPerPage)),
        hasNextPage: false,
        hasPrevPage: false
      };

      setLogs(data);
      setMeta(paginationMeta);
    } catch (err) {
      console.error('Fetch email logs error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to retrieve email logs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, limitPerPage, statusFilter, searchQuery]);

  // Fetch Active Recipients (GET /emails/recipients)
  const fetchActiveRecipients = useCallback(async () => {
    setLoadingRecipients(true);
    try {
      const res = await getEmailRecipientsApi();
      const recs = res.data?.data?.recipients || res.data?.recipients || [];
      setActiveRecipients(recs);
    } catch (err) {
      console.error('Fetch recipients error:', err);
    } finally {
      setLoadingRecipients(false);
    }
  }, []);

  useEffect(() => {
    fetchEmailLogs();
  }, [fetchEmailLogs]);

  useEffect(() => {
    fetchActiveRecipients();
  }, [fetchActiveRecipients]);

  // Client-side search filtering fallback
  const filteredLogs = useMemo(() => {
    let result = [...logs];
    if (statusFilter !== 'ALL') {
      result = result.filter(
        (l) => (l.status || '').toUpperCase() === statusFilter.toUpperCase()
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((l) => {
        const po = (l.poNumber || '').toLowerCase();
        const subj = (l.subject || '').toLowerCase();
        const sender = (l.sender?.name || l.sender?.email || '').toLowerCase();
        const recipientsStr = Array.isArray(l.recipients)
          ? l.recipients.join(' ').toLowerCase()
          : '';
        const msgId = (l.messageId || '').toLowerCase();
        return (
          po.includes(q) ||
          subj.includes(q) ||
          sender.includes(q) ||
          recipientsStr.includes(q) ||
          msgId.includes(q)
        );
      });
    }
    return result;
  }, [logs, statusFilter, searchQuery]);

  // Status Metrics
  const metrics = useMemo(() => {
    const total = meta.total || logs.length;
    const sent = logs.filter((l) => (l.status || '').toUpperCase() === 'SENT').length;
    const failed = logs.filter((l) => (l.status || '').toUpperCase() === 'FAILED').length;
    const queued = logs.filter((l) => (l.status || '').toUpperCase() === 'QUEUED').length;
    return { total, sent, failed, queued };
  }, [logs, meta]);

  // Manage Recipients Handlers
  const handleOpenRecipientsModal = () => {
    setEditableRecipients([...activeRecipients]);
    setNewRecipientInput('');
    setRecipientInputError('');
    setIsRecipientsModalOpen(true);
  };

  const handleAddRecipient = (e) => {
    if (e) e.preventDefault();
    const emailToAdd = newRecipientInput.trim().toLowerCase();
    if (!emailToAdd) return;

    const validation = validateEmail(emailToAdd);
    if (!validation.isValid) {
      setRecipientInputError(validation.error);
      return;
    }

    if (editableRecipients.includes(emailToAdd)) {
      setRecipientInputError('This email is already in the recipients list.');
      return;
    }

    setEditableRecipients((prev) => [...prev, emailToAdd]);
    setNewRecipientInput('');
    setRecipientInputError('');
  };

  const handleRemoveRecipient = (emailToRemove) => {
    setEditableRecipients((prev) => prev.filter((em) => em !== emailToRemove));
  };

  const handleSaveRecipients = async () => {
    if (editableRecipients.length === 0) {
      setRecipientInputError('At least one recipient email address is required.');
      return;
    }

    setSavingRecipients(true);
    try {
      const res = await updateEmailRecipientsApi(editableRecipients);
      const updated = res.data?.data?.recipients || res.data?.recipients || editableRecipients;
      setActiveRecipients(updated);
      setIsRecipientsModalOpen(false);
      showToast('PO notification recipients updated successfully!');
    } catch (err) {
      console.error('Update recipients error:', err);
      setRecipientInputError(
        err.response?.data?.message || err.message || 'Failed to update recipients.'
      );
    } finally {
      setSavingRecipients(false);
    }
  };

  // Resend Email Handlers
  const handleOpenResendModal = (logItem) => {
    setResendTarget(logItem);
    setResendMode('original');
    setCustomRecipientsList(
      Array.isArray(logItem.recipients) && logItem.recipients.length > 0
        ? [...logItem.recipients]
        : []
    );
    setCustomRecipientInput('');
    setCustomRecipientError('');
  };

  const handleAddCustomRecipient = (e) => {
    if (e) e.preventDefault();
    const emailToAdd = customRecipientInput.trim().toLowerCase();
    if (!emailToAdd) return;

    const validation = validateEmail(emailToAdd);
    if (!validation.isValid) {
      setCustomRecipientError(validation.error);
      return;
    }

    if (customRecipientsList.includes(emailToAdd)) {
      setCustomRecipientError('Email already added.');
      return;
    }

    setCustomRecipientsList((prev) => [...prev, emailToAdd]);
    setCustomRecipientInput('');
    setCustomRecipientError('');
  };

  const handleRemoveCustomRecipient = (emailToRemove) => {
    setCustomRecipientsList((prev) => prev.filter((e) => e !== emailToRemove));
  };

  const handleConfirmResend = async () => {
    if (!resendTarget || !resendTarget._id) return;

    let recipientsPayload = [];
    if (resendMode === 'custom') {
      if (customRecipientsList.length === 0) {
        setCustomRecipientError('Please add at least one recipient email to resend.');
        return;
      }
      recipientsPayload = customRecipientsList;
    }

    setResending(true);
    setCustomRecipientError('');
    try {
      const res = await resendEmailApi(resendTarget._id, recipientsPayload);
      showToast(
        res.data?.message || `Email for PO "${resendTarget.poNumber}" has been resent successfully!`
      );
      setResendTarget(null);
      fetchEmailLogs(true);
    } catch (err) {
      console.error('Resend email error:', err);
      setCustomRecipientError(
        err.response?.data?.message || err.message || 'Failed to resend email notification.'
      );
    } finally {
      setResending(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || 'UNKNOWN').toUpperCase();
    if (s === 'SENT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
          <FiCheckCircle size={12} className="shrink-0" />
          SENT
        </span>
      );
    }
    if (s === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-xs">
          <FiAlertCircle size={12} className="shrink-0" />
          FAILED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
        <FiClock size={12} className="shrink-0" />
        {s}
      </span>
    );
  };

  return (
    <div className="space-y-5 pb-12 w-full">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 px-4 py-3 text-white rounded-xl shadow-2xl animate-in slide-in-from-top-4 fade-in ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toast.type === 'error' ? <FiAlertCircle size={18} /> : <FiCheck size={18} />}
          <span className="text-xs font-bold">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 hover:opacity-75 cursor-pointer"
          >
            <FiX size={14} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Email Notifications & Delivery Logs"
        description="Monitor automated Purchase Order email dispatches, delivery status, resend notices, and manage active notification recipients."
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchEmailLogs(true);
              fetchActiveRecipients();
            }}
            disabled={refreshing || loading}
            className="px-3.5 py-2.5 bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh logs & recipients"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenRecipientsModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/20"
          >
            <FiUsers size={14} />
            <span>Manage PO Recipients ({activeRecipients.length})</span>
          </button>
        </div>
      </PageHeader>

      {/* Active Recipients Quick Banner */}
      <Card className="p-4 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 border border-blue-500/15 rounded-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start md:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 shrink-0">
              <FiMail size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  Active PO Notification Recipients
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                  {activeRecipients.length} configured
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Every newly submitted Purchase Order automatically dispatches email notifications to these addresses.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenRecipientsModal}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/15 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-white/15 transition-colors cursor-pointer"
            >
              Configure List &rarr;
            </button>
          </div>
        </div>

        {/* Recipients Pills Preview */}
        {activeRecipients.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-200/60 dark:border-white/10">
            {activeRecipients.slice(0, 5).map((email, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 shadow-xs"
              >
                <GmailLink email={email} />
                <CopyButton text={email} />
              </span>
            ))}
            {activeRecipients.length > 5 && (
              <span
                onClick={handleOpenRecipientsModal}
                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
              >
                +{activeRecipients.length - 5} more
              </span>
            )}
          </div>
        )}
      </Card>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-slate-400">Total Dispatched</p>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {metrics.total}
            </h3>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
            <FiSend size={18} />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-emerald-500">Delivered (Sent)</p>
            <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {metrics.sent}
            </h3>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
            <FiCheckCircle size={18} />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-rose-500">Failed / Retried</p>
            <h3 className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {metrics.failed}
            </h3>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl">
            <FiAlertCircle size={18} />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-purple-500">Active Recipients</p>
            <h3 className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">
              {activeRecipients.length}
            </h3>
          </div>
          <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl">
            <FiUsers size={18} />
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search by PO number, subject, recipient, or sender..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <FiX size={14} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <div className="w-40">
              <CustomDropdown
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'SENT', label: 'Sent (Delivered)' },
                  { value: 'FAILED', label: 'Failed' },
                  { value: 'QUEUED', label: 'Queued' }
                ]}
                statusColor="!py-2 !px-3 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200"
              />
            </div>

            {(searchQuery || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
                className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Logs Table Card */}
      <Card className="overflow-hidden p-0 border border-slate-200/80 dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/10 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">PO Number</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">Sender</th>
                <th className="py-3.5 px-4">Recipients</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Attempts & Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRowSkeleton key={i} cols={8} />
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <FiInbox size={36} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      No email delivery logs found
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery || statusFilter !== 'ALL'
                        ? 'Try clearing your search filters'
                        : 'Outgoing purchase order emails will appear here as they are triggered'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((logItem, index) => {
                  const recipientsList = Array.isArray(logItem.recipients) ? logItem.recipients : [];
                  return (
                    <tr
                      key={logItem._id || index}
                      className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* S.No */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {(currentPage - 1) * limitPerPage + index + 1}
                      </td>

                      {/* PO Number */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {logItem.purchaseOrderId ? (
                            <Link
                              to={`/purchase-orders`}
                              className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {logItem.poNumber || 'N/A'}
                            </Link>
                          ) : (
                            <span className="font-mono font-bold text-slate-800 dark:text-white">
                              {logItem.poNumber || 'N/A'}
                            </span>
                          )}
                          {logItem.poNumber && <CopyButton text={logItem.poNumber} />}
                        </div>
                      </td>

                      {/* Subject */}
                      <td className="py-3 px-4 max-w-xs">
                        <div
                          className="font-semibold text-slate-800 dark:text-slate-200 truncate cursor-pointer hover:text-blue-600 transition-colors"
                          title={logItem.subject}
                          onClick={() => setSelectedLog(logItem)}
                        >
                          {logItem.subject || 'Purchase Order Notification'}
                        </div>
                        {logItem.messageId && (
                          <div
                            className="font-mono text-[10px] text-slate-400 truncate mt-0.5"
                            title={logItem.messageId}
                          >
                            {logItem.messageId}
                          </div>
                        )}
                      </td>

                      {/* Sender */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {logItem.sender?.name || 'Automated System'}
                        </div>
                        {logItem.sender?.email && (
                          <div className="text-[11px] text-slate-400">
                            <GmailLink email={logItem.sender.email} />
                          </div>
                        )}
                      </td>

                      {/* Recipients */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="flex flex-wrap items-center gap-1">
                          {recipientsList.slice(0, 2).map((rec, rIdx) => (
                            <span
                              key={rIdx}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-[10px] text-slate-600 dark:text-slate-300 font-mono truncate max-w-[130px]"
                              title={rec}
                            >
                              {rec}
                            </span>
                          ))}
                          {recipientsList.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setSelectedLog(logItem)}
                              className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold hover:underline cursor-pointer"
                            >
                              +{recipientsList.length - 2} more
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {getStatusBadge(logItem.status)}
                      </td>

                      {/* Attempts & Date */}
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                          {logItem.createdAt ? formatDateTimeDDMMYYYY(logItem.createdAt) : '-'}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <span>Attempts:</span>
                          <strong className="text-slate-600 dark:text-slate-300">
                            {logItem.attemptCount || 1}
                          </strong>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(logItem)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                            title="View Log Details"
                          >
                            <FiEye size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenResendModal(logItem)}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                            title="Resend this email"
                          >
                            <FiRotateCw size={12} />
                            <span>Resend</span>
                          </button>
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
        {!loading && meta.totalPages > 1 && (
          <div className="p-3 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing{' '}
              <strong className="text-slate-800 dark:text-white">
                {(currentPage - 1) * limitPerPage + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-800 dark:text-white">
                {Math.min(currentPage * limitPerPage, meta.total || filteredLogs.length)}
              </strong>{' '}
              of <strong className="text-slate-800 dark:text-white">{meta.total}</strong> logs
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-bold"
              >
                Previous
              </button>
              <span className="px-2 font-bold text-slate-700 dark:text-slate-300">
                Page {currentPage} of {meta.totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={currentPage >= meta.totalPages}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-bold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* DETAIL VIEW MODAL */}
      {selectedLog &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 dark:bg-slate-950/50 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="relative w-full max-w-xl bg-white/40 dark:bg-slate-950/25 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto animate-in zoom-in-95">
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-gradient-to-r from-blue-600/40 to-indigo-600/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                    <FiMail size={20} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Email Delivery Details
                    </h3>
                    <p className="text-[11px] font-mono text-slate-950 dark:text-slate-400 mt-0.5">
                      Log ID: {selectedLog._id}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="p-2 text-white hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <FiX size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs text-slate-600 dark:text-slate-300 custom-scrollbar">
                {/* Status & PO Bar */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Target Purchase Order</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                        {selectedLog.poNumber || 'N/A'}
                      </span>
                      {selectedLog.poNumber && <CopyButton text={selectedLog.poNumber} />}
                    </div>
                  </div>
                  <div>{getStatusBadge(selectedLog.status)}</div>
                </div>

                {/* Subject */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-black/20">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Subject</span>
                  <p className="font-semibold text-slate-800 dark:text-white text-xs leading-relaxed">
                    {selectedLog.subject}
                  </p>
                </div>

                {/* Sender & Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Sender</span>
                    <p className="font-bold text-slate-800 dark:text-white">
                      {selectedLog.sender?.name || 'System Notification'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {selectedLog.sender?.email || 'sales@whatnot.in'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Attempts & Timing</span>
                    <p className="font-bold text-slate-800 dark:text-white">
                      Attempts: {selectedLog.attemptCount || 1}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {selectedLog.lastAttemptAt ? formatDateTimeDDMMYYYY(selectedLog.lastAttemptAt) : '-'}
                    </p>
                  </div>
                </div>

                {/* Recipients List */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      Recipients ({Array.isArray(selectedLog.recipients) ? selectedLog.recipients.length : 0})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {Array.isArray(selectedLog.recipients) &&
                      selectedLog.recipients.map((rec, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-[11px] font-mono text-slate-800 dark:text-white shadow-xs"
                        >
                          <GmailLink email={rec} />
                          <CopyButton text={rec} />
                        </span>
                      ))}
                  </div>
                </div>

                {/* CC List */}
                {Array.isArray(selectedLog.cc) && selectedLog.cc.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400">CC</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedLog.cc.map((ccEmail, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-white/10 text-[11px] font-mono text-slate-600 dark:text-slate-300"
                        >
                          {ccEmail}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message ID */}
                {selectedLog.messageId && (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/10 font-mono text-[11px] text-slate-500 break-all flex items-center justify-between">
                    <span>Message-ID: {selectedLog.messageId}</span>
                    <CopyButton text={selectedLog.messageId} />
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedLog;
                    setSelectedLog(null);
                    handleOpenResendModal(target);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
                >
                  <FiRotateCw size={13} />
                  <span>Resend Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* RESEND EMAIL MODAL (POST /emails/resend/{id}) */}
      {resendTarget &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 dark:bg-slate-950/50 backdrop-blur-lg animate-in fade-in overflow-y-auto">
            <div className="relative w-full max-w-lg bg-white/40 dark:bg-slate-900/25 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto animate-in zoom-in-95">
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-gradient-to-r from-blue-600/40 to-indigo-600/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                    <FiRotateCw size={20} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Resend Purchase Order Email
                    </h3>
                    <p className="text-[11px] font-mono text-slate-950 dark:text-slate-400 mt-0.5">
                      POST /emails/resend/{resendTarget._id}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={resending}
                  onClick={() => setResendTarget(null)}
                  className="p-2 text-white hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <FiX size={18} />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs text-slate-600 dark:text-slate-300 custom-scrollbar">
                {customRecipientError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
                    <FiAlertCircle size={15} className="shrink-0" />
                    <span>{customRecipientError}</span>
                  </div>
                )}

                {/* Target PO Info */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {resendTarget.poNumber || 'PO Details'}
                    </span>
                    {getStatusBadge(resendTarget.status)}
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 truncate">
                    {resendTarget.subject}
                  </p>
                </div>

                {/* Delivery Mode Choice */}
                <div className="space-y-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold">
                    Recipient Distribution Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setResendMode('original')}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        resendMode === 'original'
                          ? 'bg-blue-500/15 border-blue-500/50 text-blue-600 dark:text-blue-400 font-bold'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-bold">Original Recipients</div>
                      <div className="text-[10px] opacity-75 mt-0.5">
                        {Array.isArray(resendTarget.recipients) ? resendTarget.recipients.length : 0} default addresses
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setResendMode('custom')}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        resendMode === 'custom'
                          ? 'bg-blue-500/15 border-blue-500/50 text-blue-600 dark:text-blue-400 font-bold'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-bold">Custom Recipients</div>
                      <div className="text-[10px] opacity-75 mt-0.5">
                        Specify custom delivery list
                      </div>
                    </button>
                  </div>
                </div>

                {/* Recipient List display */}
                {resendMode === 'original' ? (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Targeted Original Addresses:
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                      {Array.isArray(resendTarget.recipients) &&
                        resendTarget.recipients.map((rec, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-white dark:bg-white/10 text-[11px] font-mono text-slate-700 dark:text-slate-300"
                          >
                            {rec}
                          </span>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <form onSubmit={handleAddCustomRecipient} className="flex gap-2">
                      <input
                        type="email"
                        placeholder="Add recipient email (e.g. manager@example.com)..."
                        value={customRecipientInput}
                        onChange={(e) => setCustomRecipientInput(e.target.value)}
                        className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <FiPlus size={14} />
                        <span>Add</span>
                      </button>
                    </form>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 min-h-24 max-h-40 overflow-y-auto space-y-1.5">
                      {customRecipientsList.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-4">
                          No recipients added yet. Type an email above and click Add.
                        </p>
                      ) : (
                        customRecipientsList.map((em, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/10 border border-slate-200/60 dark:border-white/10 text-xs"
                          >
                            <span className="font-mono text-[11px] text-slate-800 dark:text-white truncate">
                              {em}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomRecipient(em)}
                              className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                            >
                              <FiTrash2 size={13} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-end gap-3 shrink-0 bg-slate-50/80 dark:bg-white/[0.02]">
                <button
                  type="button"
                  disabled={resending}
                  onClick={() => setResendTarget(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={resending}
                  onClick={handleConfirmResend}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {resending ? (
                    <>
                      <FiLoader className="animate-spin text-sm" />
                      <span>Resending...</span>
                    </>
                  ) : (
                    <>
                      <FiSend size={13} />
                      <span>Confirm & Resend Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MANAGE RECIPIENTS MODAL (GET & PUT /emails/recipients) */}
      {isRecipientsModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 dark:bg-slate-950/50 backdrop-blur-lg animate-in fade-in overflow-y-auto">
            <div className="relative w-full max-w-lg bg-white/40 dark:bg-slate-900/25 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto animate-in zoom-in-95">
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-gradient-to-r from-blue-600/40 to-indigo-600/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                    <FiUsers size={20} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Active PO Notification Recipients
                    </h3>
                    <p className="text-[11px] font-mono text-slate-950 dark:text-slate-400 mt-0.5">
                      PUT /emails/recipients
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={savingRecipients}
                  onClick={() => setIsRecipientsModalOpen(false)}
                  className="p-2 text-white hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <FiX size={18} />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs text-slate-600 dark:text-slate-300 custom-scrollbar">
                {recipientInputError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
                    <FiAlertCircle size={15} className="shrink-0" />
                    <span>{recipientInputError}</span>
                  </div>
                )}

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  These email addresses receive notifications whenever a new purchase order is submitted in the portal.
                </p>

                {/* Add new recipient input */}
                <form onSubmit={handleAddRecipient} className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter email address (e.g. accounts@inizio.in)..."
                    value={newRecipientInput}
                    onChange={(e) => {
                      setNewRecipientInput(e.target.value);
                      if (recipientInputError) setRecipientInputError('');
                    }}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-md shadow-blue-500/20"
                  >
                    <FiPlus size={15} />
                    <span>Add</span>
                  </button>
                </form>

                {/* Current Recipients list */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    <span>Configured Recipients ({editableRecipients.length})</span>
                    <span>Action</span>
                  </div>

                  <div className="p-2 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar">
                    {editableRecipients.length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-6">
                        No recipients configured. Add at least one email address above.
                      </p>
                    ) : (
                      editableRecipients.map((email, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-white/10 border border-slate-200/60 dark:border-white/10 text-xs hover:border-slate-300 dark:hover:border-white/20 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-mono text-slate-800 dark:text-white truncate">
                              {email}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(email)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Remove recipient"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => setEditableRecipients([...activeRecipients])}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  Reset Changes
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={savingRecipients}
                    onClick={() => setIsRecipientsModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingRecipients}
                    onClick={handleSaveRecipients}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {savingRecipients ? (
                      <>
                        <FiLoader className="animate-spin text-sm" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <FiCheck size={14} />
                        <span>Save Recipients</span>
                      </>
                    )}
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

export default EmailNotifications;
