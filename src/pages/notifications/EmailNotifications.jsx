import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiMail,
  FiSend,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiSearch,
  FiRefreshCw,
  FiCheck,
  FiX,
  FiShoppingBag,
  FiUsers,
  FiArrowRight,
  FiChevronLeft,
  FiChevronRight,
  FiExternalLink,
  FiRotateCw,
  FiPlus,
  FiTrash2,
  FiLoader,
  FiHash
} from 'react-icons/fi';
import {
  MdNotificationsNone
} from 'react-icons/md';
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
import { useDisplayPreferences } from '@/utils/displayPreferences';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import { validateEmail } from '@/utils/validators';
import { useToast } from '@/context/ToastContext';

const EmailNotifications = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const { toast } = useToast();

  // Email Logs State
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Pagination state
  const { preferences: displayPrefs } = useDisplayPreferences();
  const [currentPage, setCurrentPage] = useState(1);
  const limitPerPage = displayPrefs.rowsPerPage || 10;

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'SENT' | 'FAILED' | 'QUEUED'
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Email Log for Master-Detail View
  const [explicitSelectedId, setExplicitSelectedId] = useState(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  // Active Recipients State (GET & PUT /emails/recipients)
  const [activeRecipients, setActiveRecipients] = useState([]);
  const [isRecipientsModalOpen, setIsRecipientsModalOpen] = useState(false);
  const [editableRecipients, setEditableRecipients] = useState([]);
  const [newRecipientInput, setNewRecipientInput] = useState('');
  const [recipientInputError, setRecipientInputError] = useState('');
  const [savingRecipients, setSavingRecipients] = useState(false);

  // Resend Email Modal (POST /emails/resend/{id})
  const [resendTarget, setResendTarget] = useState(null);
  const [resendMode, setResendMode] = useState('original'); // 'original' | 'custom'
  const [customRecipientsList, setCustomRecipientsList] = useState([]);
  const [customRecipientInput, setCustomRecipientInput] = useState('');
  const [customRecipientError, setCustomRecipientError] = useState('');
  const [resending, setResending] = useState(false);


  // Helper for human-friendly relative time
  const getRelativeTime = (dateInput) => {
    if (!dateInput) return '';
    const now = new Date();
    const date = new Date(dateInput);
    const diffMs = now - date;
    if (diffMs < 0) return 'Just now';
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDateDDMMYYYY(dateInput);
  };

  // PO identification and navigation helpers
  const getLogOrderId = (log) => {
    if (!log) return null;
    if (typeof log.purchaseOrderId === 'object') {
      return log.purchaseOrderId?._id || log.purchaseOrderId?.id || null;
    }
    return (
      log.purchaseOrderId ||
      log.orderId ||
      log.relatedEntityId ||
      log.data?.purchaseOrderId ||
      log.data?.orderId ||
      log.metadata?.purchaseOrderId ||
      log.metadata?.orderId ||
      null
    );
  };

  const getLogPoNumber = (log) => {
    if (!log) return null;
    if (log.poNumber) return log.poNumber;
    if (typeof log.purchaseOrderId === 'object' && log.purchaseOrderId?.poNumber) {
      return log.purchaseOrderId.poNumber;
    }
    if (log.data?.poNumber) return log.data.poNumber;
    if (log.metadata?.poNumber) return log.metadata.poNumber;
    const combinedText = `${log.subject || ''} ${log.messageId || ''}`;
    const poMatch = combinedText.match(/\b(PO[-_A-Za-z0-9]+)\b/i);
    return poMatch ? poMatch[1] : null;
  };

  const handleNavigateToPO = (log, e) => {
    if (e) e.stopPropagation();
    if (!log) return;
    const targetId = getLogOrderId(log);
    const targetPoNum = getLogPoNumber(log);
    const navUrl = targetId
      ? `/purchase-orders?orderId=${encodeURIComponent(targetId)}`
      : targetPoNum
      ? `/purchase-orders?poNumber=${encodeURIComponent(targetPoNum)}`
      : '/purchase-orders';

    navigate(navUrl, {
      state: {
        highlightOrderId: targetId,
        orderId: targetId,
        poId: targetId,
        poNumber: targetPoNum,
        openDrawer: true
      }
    });
  };

  // Helper for Status styling & config
  const getStatusConfig = (status) => {
    const s = (status || 'QUEUED').toUpperCase();
    if (s === 'SENT') {
      return {
        label: 'Sent',
        icon: FiCheckCircle,
        badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
        activeRing: 'ring-emerald-500/30',
        accentBar: 'bg-emerald-500',
        dotColor: 'bg-emerald-500',
        pingColor: 'bg-emerald-400'
      };
    }
    if (s === 'FAILED') {
      return {
        label: 'Failed',
        icon: FiAlertCircle,
        badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
        activeRing: 'ring-rose-500/30',
        accentBar: 'bg-rose-500',
        dotColor: 'bg-rose-600',
        pingColor: 'bg-rose-400'
      };
    }
    return {
      label: s === 'QUEUED' ? 'Queued' : s,
      icon: FiClock,
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
      activeRing: 'ring-amber-500/30',
      accentBar: 'bg-amber-500',
      dotColor: 'bg-amber-500',
      pingColor: 'bg-amber-400'
    };
  };

  // Fetch Email Logs API
  const fetchEmailLogs = useCallback(async (isManual = false, isSilent = false) => {
    if (isManual) {
      setRefreshing(true);
      setError(null);
    }

    try {
      const res = await getEmailLogsApi();
      const data = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch email logs:', err);
      if (!isSilent) {
        setError(err.response?.data?.message || err.message || 'Failed to retrieve email logs.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch Active Recipients (GET /emails/recipients)
  const fetchActiveRecipients = useCallback(async () => {
    try {
      const res = await getEmailRecipientsApi();
      const recs = res.data?.data?.recipients || res.data?.recipients || [];
      setActiveRecipients(recs);
    } catch (err) {
      console.error('Failed to fetch active recipients:', err);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const initialFetch = async () => {
      try {
        const res = await getEmailLogsApi();
        if (isCancelled) return;
        const data = res.data?.data || (Array.isArray(res.data) ? res.data : []);
        setLogs(data);
      } catch (err) {
        if (!isCancelled) {
          setError(err.response?.data?.message || err.message || 'Failed to retrieve email logs.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    const initialFetchRecipients = async () => {
      try {
        const res = await getEmailRecipientsApi();
        if (isCancelled) return;
        const recs = res.data?.data?.recipients || res.data?.recipients || [];
        setActiveRecipients(recs);
      } catch (err) {
        console.error('Failed to fetch active recipients:', err);
      }
    };

    initialFetch();
    initialFetchRecipients();

    // Background polling every 20 seconds
    const pollTimer = setInterval(() => {
      fetchEmailLogs(false, true);
    }, 20000);

    const onFocus = () => {
      fetchEmailLogs(false, true);
      fetchActiveRecipients();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      isCancelled = true;
      clearInterval(pollTimer);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchEmailLogs, fetchActiveRecipients]);

  // Status Metrics
  const metrics = useMemo(() => {
    const total = logs.length;
    const sent = logs.filter((l) => (l.status || '').toUpperCase() === 'SENT').length;
    const failed = logs.filter((l) => (l.status || '').toUpperCase() === 'FAILED').length;
    const queued = logs.filter((l) => (l.status || '').toUpperCase() === 'QUEUED').length;
    return { total, sent, failed, queued };
  }, [logs]);

  // Filtered Logs list
  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      // Status filter
      if (statusFilter !== 'ALL' && (item.status || '').toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSubject = String(item.subject || '').toLowerCase().includes(q);
        const matchPo = String(item.poNumber || '').toLowerCase().includes(q);
        const matchSenderName = String(item.sender?.name || '').toLowerCase().includes(q);
        const matchSenderEmail = String(item.sender?.email || '').toLowerCase().includes(q);
        const matchMsgId = String(item.messageId || '').toLowerCase().includes(q);
        const recipientsList = Array.isArray(item.recipients) ? item.recipients : [];
        const matchRecipients = recipientsList.some((r) => String(r).toLowerCase().includes(q));

        const orderId = getLogOrderId(item);
        const poNum = getLogPoNumber(item);

        const idCandidates = [
          item._id,
          item.id,
          orderId,
          poNum,
          item.sender?._id,
          item.sender?.id
        ];
        const matchId = idCandidates.some((val) => val && String(val).toLowerCase().includes(q));

        return (
          matchSubject ||
          matchPo ||
          matchSenderName ||
          matchSenderEmail ||
          matchMsgId ||
          matchRecipients ||
          matchId
        );
      }

      return true;
    });
  }, [logs, statusFilter, searchQuery]);

  // Client-side pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / limitPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const indexOfLastItem = safeCurrentPage * limitPerPage;
  const indexOfFirstItem = indexOfLastItem - limitPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstItem, indexOfLastItem);

  // Maintain active selection
  const selectedLog = useMemo(() => {
    if (filteredLogs.length === 0) return null;
    if (explicitSelectedId) {
      const found = filteredLogs.find(
        (l) => (l._id || l.id) === explicitSelectedId
      );
      if (found) return found;
    }
    return filteredLogs[0] || null;
  }, [filteredLogs, explicitSelectedId]);

  const selectedLogId = selectedLog ? (selectedLog._id || selectedLog.id) : null;

  // Stepper calculations for selected log
  const selectedIndex = selectedLog
    ? filteredLogs.findIndex((l) => (l._id || l.id) === selectedLogId)
    : -1;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < filteredLogs.length - 1;

  const handlePrevLog = useCallback(() => {
    if (hasPrev) {
      const prevItem = filteredLogs[selectedIndex - 1];
      setExplicitSelectedId(prevItem._id || prevItem.id);
    }
  }, [hasPrev, filteredLogs, selectedIndex]);

  const handleNextLog = useCallback(() => {
    if (hasNext) {
      const nextItem = filteredLogs[selectedIndex + 1];
      setExplicitSelectedId(nextItem._id || nextItem.id);
    }
  }, [hasNext, filteredLogs, selectedIndex]);

  // Keyboard navigation: Up/Down arrow to cycle through logs, Esc to close drawer/modals, '/' for search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) ||
        isRecipientsModalOpen ||
        resendTarget
      ) {
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        handlePrevLog();
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        handleNextLog();
      } else if (e.key === 'Escape') {
        if (isMobileDetailOpen) {
          setIsMobileDetailOpen(false);
        }
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevLog, handleNextLog, isRecipientsModalOpen, resendTarget, isMobileDetailOpen]);

  // Handlers that safely reset to page 1 on filter changes
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const selectLogItem = (item) => {
    const id = item._id || item.id;
    setExplicitSelectedId(id);
    setIsMobileDetailOpen(true);
  };

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
      toast.success('PO notification recipients updated successfully!');
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
  const handleOpenResendModal = (logItem, e) => {
    if (e) e.stopPropagation();
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
    setCustomRecipientsList((prev) => prev.filter((em) => em !== emailToRemove));
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
      toast.success(
        res.data?.message || `Email for PO "${resendTarget.poNumber || 'notification'}" resent successfully!`
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

  return (
    <div className="relative space-y-5 min-h-full w-full pb-10">
      {/* Page Header */}
      <PageHeader
        title="Email Notifications"
        icon={FiMail}
        description="Streamlined delivery inbox for automated Purchase Order emails, dispatch tracking, and direct recipient management."
        badgeText={
          logs.length > 0
            ? `${logs.length} Total Logs${metrics.failed > 0 ? ` • ${metrics.failed} failed` : ''}`
            : null
        }
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Live Sync Status Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                Live 20s
              </span>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                fetchEmailLogs(true);
                fetchActiveRecipients();
              }}
              disabled={refreshing || loading}
              className="p-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-bold flex items-center transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Refresh logs & recipients"
            >
              <FiRefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Manage PO Recipients Button */}
            <button
              type="button"
              onClick={handleOpenRecipientsModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 hover:border-blue-500/40 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer shadow-xs"
            >
              <FiUsers className="text-xs text-blue-500" />
              <span>PO Recipients ({activeRecipients.length})</span>
            </button>
          </div>
        }
      />

      {/* Main Split-Screen Inbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:h-[calc(100vh-165px)] lg:min-h-[580px] lg:max-h-[calc(100vh-165px)]">
        {/* ================= LEFT COLUMN: MASTER LIST (5 cols) ================= */}
        <div className="lg:col-span-5 flex flex-col h-full min-h-0 space-y-2.5 bg-white/40 dark:bg-slate-900/25 rounded-2xl shadow-xl">
          {/* Search, Filter Pills & Quick Controls (Sticky at top of left pane) */}
          <div className="shrink-0 p-3 sm:p-3.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 space-y-2.5 shadow-xs">
            <div className="relative w-full">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by PO, subject, recipient, sender (Press '/' to focus)..."
                className="w-full pl-9 pr-7 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white placeholder-slate-400 text-xs font-medium transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer text-xs"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleStatusFilterChange('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 shadow-md hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  All ({metrics.total})
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusFilterChange('SENT')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    statusFilter === 'SENT'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 shadow-md hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  Sent ({metrics.sent})
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusFilterChange('FAILED')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    statusFilter === 'FAILED'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 shadow-md hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  Failed ({metrics.failed})
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusFilterChange('QUEUED')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    statusFilter === 'QUEUED'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 shadow-md hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  Queued ({metrics.queued})
                </button>
              </div>

              <div className="min-w-[125px]">
                <CustomDropdown
                  value={statusFilter}
                  onChange={(val) => handleStatusFilterChange(val)}
                  options={[
                    { value: 'ALL', label: 'All Statuses' },
                    { value: 'SENT', label: 'Sent (Delivered)' },
                    { value: 'FAILED', label: 'Failed' },
                    { value: 'QUEUED', label: 'Queued' }
                  ]}
                  statusColor="!px-2.5 !py-1 text-[11px] rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="shrink-0 p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
              <div className="flex items-center gap-2">
                <FiAlertCircle className="text-base shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => fetchEmailLogs(true)}
                className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors cursor-pointer text-xs"
              >
                Retry
              </button>
            </div>
          )}

          {/* Master List Feed - Dedicated Scroll Container */}
          <div className="flex-1 min-h-0 px-2.5 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {loading && !refreshing ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Card key={i} className="p-3.5 animate-pulse space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-16"></div>
                    </div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-4/5"></div>
                  </Card>
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <Card className="p-8 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-2.5">
                  <MdNotificationsNone className="text-2xl" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No email logs match filter
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mt-1">
                  Try clearing your search keyword or switching filter pills.
                </p>
                {(searchQuery || statusFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSearchChange('');
                      handleStatusFilterChange('ALL');
                    }}
                    className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </Card>
            ) : (
              currentLogs.map((item, idx) => {
                const itemId = item._id || item.id || `log-${idx}`;
                const isSelected = selectedLogId === itemId;
                const statusConfig = getStatusConfig(item.status);
                const StatusIcon = statusConfig.icon;
                const poNum = getLogPoNumber(item);
                const recipientsList = Array.isArray(item.recipients) ? item.recipients : [];

                return (
                  <div
                    key={itemId}
                    onClick={() => selectLogItem(item)}
                    className={`relative p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer text-left group backdrop-blur-xl ${
                      isSelected
                        ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500/80 ring-2 ring-blue-500/30 shadow-md'
                        : item.status?.toUpperCase() === 'FAILED'
                        ? 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/30 hover:border-rose-300'
                        : 'bg-white/70 dark:bg-slate-900/50 border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    {/* Left Accent indicator */}
                    <span
                      className={`absolute left-0 top-3.5 bottom-3.5 w-1 rounded-r-full ${statusConfig.accentBar}`}
                    />

                    {/* Top Row: Status badge, PO number, timestamp */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Status beacon */}
                        {item.status?.toUpperCase() === 'FAILED' ? (
                          <span className="relative flex h-2 w-2 shrink-0" title="Delivery Failed">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                          </span>
                        ) : item.status?.toUpperCase() === 'SENT' ? (
                          <FiCheckCircle className="text-[11px] text-emerald-500 shrink-0" title="Delivered" />
                        ) : (
                          <span className="relative flex h-2 w-2 shrink-0" title="Queued">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                          </span>
                        )}

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 ${statusConfig.badgeClass}`}
                        >
                          <StatusIcon className="text-[10px]" />
                          <span className="truncate max-w-[80px]">{statusConfig.label}</span>
                        </span>

                        {poNum && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold shrink-0">
                            #{poNum}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                        <FiClock className="text-[10px]" />
                        <span>{getRelativeTime(item.createdAt || item.lastAttemptAt)}</span>
                      </div>
                    </div>

                    {/* Email Subject */}
                    <h4
                      className={`text-xs leading-snug truncate transition-colors ${
                        item.status?.toUpperCase() === 'FAILED'
                          ? 'font-bold text-rose-700 dark:text-rose-300'
                          : 'font-bold text-slate-900 dark:text-white'
                      } ${isSelected ? 'text-blue-700 dark:text-blue-300' : ''}`}
                    >
                      {item.subject || 'Purchase Order Email Notification'}
                    </h4>

                    {/* Recipients Preview */}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1 leading-relaxed font-mono">
                      To:{' '}
                      {recipientsList.length > 0
                        ? recipientsList.join(', ')
                        : 'System configured recipients'}
                    </p>

                    {/* Bottom Quick Row */}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-white/5 text-[10px] text-slate-400">
                      <span>
                        {item.attemptCount && item.attemptCount > 1 ? `Attempts: ${item.attemptCount}` : 'Standard Dispatch'}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => handleOpenResendModal(item, e)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <FiRotateCw className="text-[10px]" />
                        <span>Resend</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Master List Pagination (Pinned at bottom of left pane) */}
          {filteredLogs.length > 0 && totalPages > 1 && (
            <div className="shrink-0 p-2.5 sm:p-3 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-2 text-xs shadow-xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Page <strong className="text-slate-800 dark:text-white">{safeCurrentPage}</strong> of{' '}
                <strong className="text-slate-800 dark:text-white">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
                >
                  <FiChevronLeft className="inline text-xs mr-0.5" /> Prev
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
                >
                  Next <FiChevronRight className="inline text-xs ml-0.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ================= RIGHT COLUMN: DETAIL INSPECTION PANE (7 cols) ================= */}
        <div className="hidden lg:flex lg:col-span-7 flex-col h-full min-h-0">
          <div className="flex flex-col h-full min-h-0 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl bg-white/60 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden">
            {selectedLog ? (
              (() => {
                const selId = selectedLog._id || selectedLog.id;
                const statusConfig = getStatusConfig(selectedLog.status);
                const StatusIcon = statusConfig.icon;
                const poNum = getLogPoNumber(selectedLog);
                const isPO = Boolean(poNum || getLogOrderId(selectedLog));
                const recipientsList = Array.isArray(selectedLog.recipients) ? selectedLog.recipients : [];

                return (
                  <div className="flex flex-col h-full min-h-0">
                    {/* Detail Sticky Header */}
                    <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 dark:bg-black/20 flex items-center justify-between gap-3 shrink-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg border border-blue-500/20 shrink-0">
                          <FiMail />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${statusConfig.badgeClass}`}
                            >
                              <StatusIcon className="text-[10px]" />
                              <span>{statusConfig.label}</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300">
                              Attempts: {selectedLog.attemptCount || 1}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate">
                            {selectedLog.createdAt || selectedLog.lastAttemptAt
                              ? `Dispatched ${getRelativeTime(selectedLog.createdAt || selectedLog.lastAttemptAt)} • ${formatDateTimeDDMMYYYY(selectedLog.createdAt || selectedLog.lastAttemptAt, true)}`
                              : 'Recent delivery'}
                          </p>
                        </div>
                      </div>

                      {/* Header Controls: Stepper & Resend Button */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Stepper Navigation */}
                        {filteredLogs.length > 1 && (
                          <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200/80 dark:border-white/10 shadow-xs">
                            <button
                              type="button"
                              onClick={handlePrevLog}
                              disabled={!hasPrev}
                              title="Previous (or 'k' / up arrow)"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer"
                            >
                              <FiChevronLeft size={14} />
                            </button>
                            <span className="text-[10px] font-mono px-2 text-slate-500 font-bold select-none">
                              {selectedIndex >= 0 ? `${selectedIndex + 1}/${filteredLogs.length}` : ''}
                            </span>
                            <button
                              type="button"
                              onClick={handleNextLog}
                              disabled={!hasNext}
                              title="Next (or 'j' / down arrow)"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer"
                            >
                              <FiChevronRight size={14} />
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleOpenResendModal(selectedLog, e)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <FiRotateCw className="text-xs" />
                          <span>Resend Email</span>
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Detail Body */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar text-xs">
                      {/* Main Subject */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Email Subject
                        </span>
                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                          {selectedLog.subject || 'Purchase Order Email Notification'}
                        </h2>
                      </div>

                      {/* Direct PO Hero Banner (if purchase order attached) */}
                      {isPO && (
                        <div className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-base font-bold shrink-0">
                              <FiShoppingBag />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                                  #{poNum || 'Purchase Order'}
                                </span>
                                {poNum && <CopyButton text={poNum} />}
                              </div>
                              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                                Direct purchase order dispatch
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleNavigateToPO(selectedLog, e)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer ml-auto shrink-0"
                          >
                            <span>Open Purchase Order</span>
                            <FiExternalLink className="text-xs" />
                          </button>
                        </div>
                      )}

                      {/* Failure Banner (if status is FAILED) */}
                      {(selectedLog.status?.toUpperCase() === 'FAILED' || selectedLog.errorMessage || selectedLog.error) && (
                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 space-y-1.5">
                          <div className="flex items-center gap-2 font-bold text-xs">
                            <FiAlertCircle className="text-sm shrink-0" />
                            <span>Delivery Failure Recorded</span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-rose-600 dark:text-rose-400">
                            {selectedLog.errorMessage || selectedLog.error || 'The email server reported an error while dispatching this message. Use the Resend action to retry.'}
                          </p>
                        </div>
                      )}

                      {/* Addressing & Dispatch Card (Recipients & Sender) */}
                      <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-black/20 border border-slate-200/60 dark:border-white/5 space-y-3.5">
                        {/* Recipients */}
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                            Recipients ({recipientsList.length})
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {recipientsList.length === 0 ? (
                              <span className="text-slate-400 italic">No recipients logged</span>
                            ) : (
                              recipientsList.map((email, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-white/10 border border-slate-200/80 dark:border-white/10 text-[11px] font-mono text-slate-800 dark:text-slate-200 shadow-xs"
                                >
                                  <GmailLink email={email} />
                                  <CopyButton text={email} />
                                </span>
                              ))
                            )}
                          </div>
                        </div>

                        {/* CC List (if any) */}
                        {Array.isArray(selectedLog.cc) && selectedLog.cc.length > 0 && (
                          <div className="pt-2.5 border-t border-slate-200/50 dark:border-white/5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                              Carbon Copy (CC) ({selectedLog.cc.length})
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedLog.cc.map((ccEmail, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white dark:bg-white/10 border border-slate-200/80 dark:border-white/10 text-[11px] font-mono text-slate-700 dark:text-slate-300"
                                >
                                  <GmailLink email={ccEmail} />
                                  <CopyButton text={ccEmail} />
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sender info */}
                        <div className="pt-2.5 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between text-xs">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Sender
                          </span>
                          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
                            <span>{selectedLog.sender?.name || 'Automated Dispatch'}</span>
                            {selectedLog.sender?.email && (
                              <span className="font-normal font-mono text-[11px] text-slate-400">
                                (<GmailLink email={selectedLog.sender.email} />)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Technical & Debug Identifiers (Accordion) */}
                      <details className="group rounded-2xl border border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 p-3.5 text-xs transition-colors">
                        <summary className="flex items-center justify-between cursor-pointer list-none font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 select-none">
                          <span className="flex items-center gap-2">
                            <FiHash className="text-xs" />
                            <span>System & Debug Identifiers</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="pt-3 mt-3 border-t border-slate-200/50 dark:border-white/5 space-y-2 font-mono text-[11px] text-slate-500">
                          <div className="flex items-center justify-between">
                            <span>Log Record ID:</span>
                            <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                              <span>{selId}</span>
                              <CopyButton text={selId} />
                            </div>
                          </div>
                          {selectedLog.messageId && (
                            <div className="flex items-center justify-between">
                              <span>Message-ID:</span>
                              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                                <span className="truncate max-w-[220px]">{selectedLog.messageId}</span>
                                <CopyButton text={selectedLog.messageId} />
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>

                    {/* Detail Sticky Footer - Permanently Anchored at the Bottom */}
                    <div className="p-3.5 sm:p-4 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-black/30 flex items-center justify-between text-[11px] text-slate-400 shrink-0 mt-auto">
                      <span>
                        Use <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono text-slate-700 dark:text-slate-300">↑</kbd>{' '}
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono text-slate-700 dark:text-slate-300">↓</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono text-slate-700 dark:text-slate-300">j</kbd>/<kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono text-slate-700 dark:text-slate-300">k</kbd> to step
                      </span>

                      {isPO && (
                        <button
                          type="button"
                          onClick={(e) => handleNavigateToPO(selectedLog, e)}
                          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Go to Purchase Orders</span>
                          <FiArrowRight className="text-xs" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* Empty selection placeholder */
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-3xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-3xl mb-4 border border-blue-500/20">
                  <FiMail />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No Email Log Selected
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                  Select any delivery log from the left feed to inspect recipient addresses, delivery status, and resend options here.
                </p>
                <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
                  <span>Pro-tip: Press</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-600 dark:text-slate-300">
                    /
                  </kbd>
                  <span>to jump into quick search</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= MOBILE DETAIL DRAWER MODAL (< lg screens) ================= */}
      {isMobileDetailOpen && selectedLog && (
        <div className="lg:hidden fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 dark:bg-slate-950/50 backdrop-blur-md transition-opacity"
            onClick={() => setIsMobileDetailOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 pointer-events-none">
            <div className="w-screen max-w-md bg-white/40 dark:bg-slate-950/25 border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col h-full pointer-events-auto animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="px-4 py-3.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold shrink-0">
                    <FiMail />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    Email Delivery Details
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMobileDetailOpen(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                  >
                    <FiX size={18} />
                  </button>
                </div>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Subject
                  </span>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedLog.subject || 'Purchase Order Email Notification'}
                  </h2>
                </div>

                {getLogPoNumber(selectedLog) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      setIsMobileDetailOpen(false);
                      handleNavigateToPO(selectedLog, e);
                    }}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                  >
                    <FiShoppingBag className="text-sm" />
                    <span>View Purchase Order (#{getLogPoNumber(selectedLog)})</span>
                    <FiArrowRight className="text-xs" />
                  </button>
                )}

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 space-y-2 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Delivery Metadata
                  </span>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">
                      {selectedLog.status || 'SENT'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Dispatched</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {getRelativeTime(selectedLog.createdAt || selectedLog.lastAttemptAt)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Attempts</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {selectedLog.attemptCount || 1}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 space-y-2 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Recipients
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(selectedLog.recipients) && selectedLog.recipients.map((em, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-white dark:bg-white/10 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {em}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-3.5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                <button
                  type="button"
                  onClick={(e) => {
                    setIsMobileDetailOpen(false);
                    handleOpenResendModal(selectedLog, e);
                  }}
                  className="px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <FiRotateCw className="text-xs" />
                  <span>Resend Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileDetailOpen(false)}
                  className="px-3.5 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MANAGE RECIPIENTS MODAL ================= */}
      {isRecipientsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 dark:bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white/40 dark:bg-slate-950/25 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/80 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg border border-blue-500/20">
                  <FiUsers />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Active PO Recipients</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Automated dispatch list</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecipientsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer transition-colors"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {recipientInputError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <FiAlertCircle className="text-sm shrink-0" />
                <span>{recipientInputError}</span>
              </div>
            )}

            <form onSubmit={handleAddRecipient} className="flex gap-2 text-xs">
              <input
                type="email"
                placeholder="Enter recipient email (e.g. accounts@inizio.in)..."
                value={newRecipientInput}
                onChange={(e) => {
                  setNewRecipientInput(e.target.value);
                  if (recipientInputError) setRecipientInputError('');
                }}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-md shadow-blue-500/25"
              >
                <FiPlus size={15} />
                <span>Add</span>
              </button>
            </form>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                <span>Configured List ({editableRecipients.length})</span>
              </div>

              <div className="p-2 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 max-h-56 overflow-y-auto space-y-1.5 custom-scrollbar">
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

            <div className="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-white/10">
              <button
                type="button"
                onClick={() => setEditableRecipients([...activeRecipients])}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-white cursor-pointer font-medium"
              >
                Reset
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRecipientsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingRecipients}
                  onClick={handleSaveRecipients}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md shadow-blue-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
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
        </div>
      )}

      {/* ================= RESEND EMAIL MODAL ================= */}
      {resendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 dark:bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white/40 dark:bg-slate-950/25 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/80 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg border border-blue-500/20">
                  <FiRotateCw />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Resend Purchase Order Email</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {resendTarget.poNumber ? `Order #${resendTarget.poNumber}` : 'Direct notification dispatch'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={resending}
                onClick={() => setResendTarget(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer transition-colors"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {customRecipientError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <FiAlertCircle className="text-sm shrink-0" />
                <span>{customRecipientError}</span>
              </div>
            )}

            {/* Recipient Distribution Mode */}
            <div className="space-y-2 text-xs">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Distribution Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResendMode('original')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    resendMode === 'original'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="font-bold">Original Addresses</div>
                  <div className={`text-[10px] mt-0.5 ${resendMode === 'original' ? 'text-white/80' : 'text-slate-400'}`}>
                    {Array.isArray(resendTarget.recipients) ? resendTarget.recipients.length : 0} default recipient(s)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setResendMode('custom')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    resendMode === 'custom'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="font-bold">Custom Addresses</div>
                  <div className={`text-[10px] mt-0.5 ${resendMode === 'custom' ? 'text-white/80' : 'text-slate-400'}`}>
                    Specify target list
                  </div>
                </button>
              </div>
            </div>

            {/* Recipients Display / Adder */}
            {resendMode === 'original' ? (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 space-y-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Original Delivery Targets:
                </span>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {Array.isArray(resendTarget.recipients) &&
                    resendTarget.recipients.map((rec, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-lg bg-white dark:bg-white/10 text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10"
                      >
                        {rec}
                      </span>
                    ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <form onSubmit={handleAddCustomRecipient} className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter email to add (e.g. manager@example.com)..."
                    value={customRecipientInput}
                    onChange={(e) => setCustomRecipientInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <FiPlus size={14} />
                    <span>Add</span>
                  </button>
                </form>

                <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 min-h-20 max-h-36 overflow-y-auto space-y-1.5 custom-scrollbar">
                  {customRecipientsList.length === 0 ? (
                    <p className="text-[11px] text-slate-400 text-center py-4">
                      No recipients added. Type an email above and click Add.
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

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/80 dark:border-white/10">
              <button
                type="button"
                disabled={resending}
                onClick={() => setResendTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resending}
                onClick={handleConfirmResend}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md shadow-blue-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
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
        </div>
      )}
    </div>
  );
};

export default EmailNotifications;
