import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiBell,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiSearch,
  FiRefreshCw,
  FiCheck,
  FiX,
  FiShoppingBag,
  FiFileText,
  FiSmartphone,
  FiArrowRight,
  FiChevronLeft,
  FiChevronRight,
  FiExternalLink,
  FiCode
} from 'react-icons/fi';
import {
  MdDoneAll,
  MdNotificationsNone
} from 'react-icons/md';
import {
  getNotificationsApi,
  markNotificationAsReadApi,
  markAllNotificationsAsReadApi,
  registerDeviceTokenApi
} from '@/api/axios';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import CopyButton from '@/components/ui/CopyButton';
import CustomDropdown from '@/components/ui/CustomDropdown';
import { useDisplayPreferences } from '@/utils/displayPreferences';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';

const Notifications = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Pagination state
  const { preferences: displayPrefs } = useDisplayPreferences();
  const [currentPage, setCurrentPage] = useState(1);
  const limitPerPage = displayPrefs.rowsPerPage || 10;

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'unread' | 'read' | 'po' | 'alert'
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Notification for Master-Detail View
  const [explicitSelectedId, setExplicitSelectedId] = useState(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [showRawPayload, setShowRawPayload] = useState(false);

  // Device Token Registration Modal
  const [isDeviceTokenModalOpen, setIsDeviceTokenModalOpen] = useState(false);
  const [deviceTokenForm, setDeviceTokenForm] = useState({
    fcmToken: '',
    deviceType: 'android'
  });
  const [deviceTokenSubmitting, setDeviceTokenSubmitting] = useState(false);
  const [deviceTokenSuccess, setDeviceTokenSuccess] = useState(null);
  const [deviceTokenError, setDeviceTokenError] = useState(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((curr) => (curr?.text === text ? null : curr));
    }, 4000);
  };

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

  // Check if item is a Purchase Order event
  const checkIsPurchaseOrder = (notif) => {
    if (!notif) return false;
    const rawType = (notif.type || '').toUpperCase();
    const relType = (notif.relatedEntityType || '').toUpperCase();
    return (
      rawType.includes('PO') ||
      rawType.includes('PURCHASE') ||
      relType.includes('PO') ||
      relType.includes('PURCHASE') ||
      relType === 'ORDER' ||
      Boolean(notif.poNumber || notif.data?.poNumber || notif.metadata?.poNumber)
    );
  };

  const checkIsAlert = (notif) => {
    if (!notif) return false;
    const rawType = (notif.type || '').toUpperCase();
    return rawType.includes('ALERT') || rawType.includes('WARN') || rawType.includes('ERROR');
  };

  // Helper for Type styling & labels
  const getTypeConfig = (type, relatedEntityType) => {
    const rawType = (type || relatedEntityType || '').toUpperCase();

    if (rawType.includes('PO') || rawType.includes('PURCHASE') || rawType === 'ORDER') {
      return {
        label: 'Purchase Order',
        icon: FiShoppingBag,
        badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
        activeRing: 'ring-emerald-500/30',
        accentBar: 'bg-emerald-500'
      };
    }
    if (rawType.includes('USER') || rawType.includes('CUSTOMER') || rawType.includes('AUTH')) {
      return {
        label: 'User Account',
        icon: FiFileText,
        badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20',
        activeRing: 'ring-indigo-500/30',
        accentBar: 'bg-indigo-500'
      };
    }

    // Default system notification
    return {
      label: type ? type.replace(/_/g, ' ') : 'System Notice',
      icon: FiBell,
      badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20',
      activeRing: 'ring-blue-500/30',
      accentBar: 'bg-blue-500'
    };
  };

  // Fetch Notifications API call
  const fetchNotifications = useCallback(async (isManual = false, isSilent = false) => {
    if (isManual) setRefreshing(true);
    setError(null);

    try {
      const response = await getNotificationsApi({ limit: 1000 });
      const resData = response.data || {};
      const list = Array.isArray(resData.data)
        ? resData.data
        : Array.isArray(resData)
          ? resData
          : Array.isArray(resData.notifications)
            ? resData.notifications
            : [];

      setNotifications(list);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      if (!isSilent) {
        setError(err.response?.data?.message || err.message || 'Failed to load notifications.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const initialFetch = async () => {
      try {
        const response = await getNotificationsApi({ limit: 1000 });
        if (isCancelled) return;
        const resData = response.data || {};
        const list = Array.isArray(resData.data)
          ? resData.data
          : Array.isArray(resData)
            ? resData
            : Array.isArray(resData.notifications)
              ? resData.notifications
              : [];
        setNotifications(list);
      } catch (err) {
        if (!isCancelled) {
          setError(err.response?.data?.message || err.message || 'Failed to load notifications.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    initialFetch();

    // Background polling every 15 seconds
    const pollTimer = setInterval(() => {
      fetchNotifications(false, true);
    }, 15000);

    const onFocus = () => {
      fetchNotifications(false, true);
    };
    window.addEventListener('focus', onFocus);

    return () => {
      isCancelled = true;
      clearInterval(pollTimer);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchNotifications]);

  // Mark Single Notification as Read
  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    if (!id) return;
    setActionLoadingId(id);
    try {
      await markNotificationAsReadApi(id);
      setNotifications((prev) =>
        prev.map((n) => {
          const nId = n._id || n.id;
          return nId === id ? { ...n, isRead: true } : n;
        })
      );
      showToast('Notification marked as read.', 'success');
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      showToast(err.response?.data?.message || err.message || 'Failed to mark as read.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mark All Notifications as Read
  const handleMarkAllAsRead = async () => {
    setMarkingAllRead(true);
    try {
      await markAllNotificationsAsReadApi();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
      showToast('All notifications marked as read.', 'success');
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      showToast(err.response?.data?.message || err.message || 'Failed to mark all as read.', 'error');
    } finally {
      setMarkingAllRead(false);
    }
  };

  // Register Device Token
  const handleRegisterDeviceToken = async (e) => {
    e.preventDefault();
    if (!deviceTokenForm.fcmToken.trim()) {
      setDeviceTokenError('Please enter a valid FCM / Device Token.');
      return;
    }
    setDeviceTokenSubmitting(true);
    setDeviceTokenError(null);
    setDeviceTokenSuccess(null);
    try {
      const response = await registerDeviceTokenApi({
        fcmToken: deviceTokenForm.fcmToken.trim(),
        deviceType: deviceTokenForm.deviceType
      });
      const msg = response.data?.message || 'Device token registered successfully!';
      setDeviceTokenSuccess(msg);
      showToast(msg, 'success');
      setTimeout(() => {
        setIsDeviceTokenModalOpen(false);
        setDeviceTokenSuccess(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to register device token:', err);
      setDeviceTokenError(err.response?.data?.message || err.message || 'Failed to register device token.');
    } finally {
      setDeviceTokenSubmitting(false);
    }
  };

  // PO identification and navigation helpers
  const getNotificationOrderId = (notif) => {
    if (!notif) return null;
    return (
      notif.relatedEntityId ||
      notif.relatedEntity?._id ||
      notif.relatedEntity?.id ||
      notif.data?.purchaseOrderId ||
      notif.data?.orderId ||
      notif.data?._id ||
      notif.metadata?.purchaseOrderId ||
      notif.metadata?.orderId ||
      notif.metadata?._id ||
      notif.purchaseOrderId ||
      notif.orderId ||
      null
    );
  };

  const getNotificationPoNumber = (notif) => {
    if (!notif) return null;
    if (notif.poNumber) return notif.poNumber;
    if (notif.data?.poNumber) return notif.data.poNumber;
    if (notif.metadata?.poNumber) return notif.metadata.poNumber;
    const combinedText = `${notif.title || ''} ${notif.message || ''}`;
    const poMatch = combinedText.match(/\b(PO[-_#]?[A-Za-z0-9]+)\b/i);
    return poMatch ? poMatch[1] : null;
  };

  const handleNavigateToPO = (notif, e) => {
    if (e) e.stopPropagation();
    if (!notif) return;
    const targetId = getNotificationOrderId(notif);
    const targetPoNum = getNotificationPoNumber(notif);
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

  // Stats
  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  // Extract unique notification types for dropdown filter
  const availableTypes = useMemo(() => {
    const types = new Set();
    notifications.forEach((item) => {
      if (item.type) types.add(item.type);
    });
    return Array.from(types);
  }, [notifications]);

  // Filtered Notifications list
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // Status filter
      if (statusFilter === 'unread' && item.isRead) return false;
      if (statusFilter === 'read' && !item.isRead) return false;
      if (statusFilter === 'po' && !checkIsPurchaseOrder(item)) return false;
      if (statusFilter === 'alert' && !checkIsAlert(item)) return false;

      // Type filter
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchMessage = (item.message || '').toLowerCase().includes(q);
        const matchType = (item.type || '').toLowerCase().includes(q);
        const matchEntity = (item.relatedEntityType || '').toLowerCase().includes(q);
        const matchId = (item._id || '').toLowerCase().includes(q) || (item.relatedEntityId || '').toLowerCase().includes(q);
        return matchTitle || matchMessage || matchType || matchEntity || matchId;
      }

      return true;
    });
  }, [notifications, statusFilter, typeFilter, searchQuery]);

  // Client-side pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / limitPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const indexOfLastItem = safeCurrentPage * limitPerPage;
  const indexOfFirstItem = indexOfLastItem - limitPerPage;
  const currentNotifications = filteredNotifications.slice(indexOfFirstItem, indexOfLastItem);

  // Maintain active selection without causing cascading re-renders
  const selectedNotification = useMemo(() => {
    if (filteredNotifications.length === 0) return null;
    if (explicitSelectedId) {
      const found = filteredNotifications.find(
        (n) => (n._id || n.id) === explicitSelectedId
      );
      if (found) return found;
    }
    return filteredNotifications[0] || null;
  }, [filteredNotifications, explicitSelectedId]);

  const selectedNotificationId = selectedNotification ? (selectedNotification._id || selectedNotification.id) : null;

  // Stepper calculations for selected notification
  const selectedIndex = selectedNotification
    ? filteredNotifications.findIndex(
        (n) => (n._id || n.id) === selectedNotificationId
      )
    : -1;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < filteredNotifications.length - 1;

  const handlePrevNotification = useCallback(() => {
    if (hasPrev) {
      const prevItem = filteredNotifications[selectedIndex - 1];
      setExplicitSelectedId(prevItem._id || prevItem.id);
    }
  }, [hasPrev, filteredNotifications, selectedIndex]);

  const handleNextNotification = useCallback(() => {
    if (hasNext) {
      const nextItem = filteredNotifications[selectedIndex + 1];
      setExplicitSelectedId(nextItem._id || nextItem.id);
    }
  }, [hasNext, filteredNotifications, selectedIndex]);

  // Keyboard navigation: Up/Down arrow to cycle through notifications, Esc to clear
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || isDeviceTokenModalOpen) {
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        handlePrevNotification();
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        handleNextNotification();
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
  }, [handlePrevNotification, handleNextNotification, isDeviceTokenModalOpen, isMobileDetailOpen]);

  // Handlers that safely reset to page 1 on filter changes
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleTypeFilterChange = (type) => {
    setTypeFilter(type);
    setCurrentPage(1);
  };

  const selectNotificationItem = (item) => {
    const id = item._id || item.id;
    setExplicitSelectedId(id);
    setIsMobileDetailOpen(true);
  };

  return (
    <div className="relative space-y-5 min-h-full w-full pb-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold backdrop-blur-xl animate-in fade-in slide-in-from-top-3 ${
            toastMessage.type === 'error'
              ? 'bg-rose-600/90 text-white border-rose-500 shadow-rose-600/30'
              : 'bg-emerald-600/90 text-white border-emerald-500 shadow-emerald-600/30'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <FiAlertCircle className="text-base shrink-0" />
          ) : (
            <FiCheckCircle className="text-base shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 hover:opacity-75 cursor-pointer p-0.5"
          >
            <FiX className="text-sm" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Notifications Inbox"
        icon={FiBell}
        description="Streamlined split inbox for instant triage, real-time alerts, and direct purchase order shortcuts."
        badgeText={
          notifications.length > 0
            ? `${unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}`
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
                Live 15s
              </span>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchNotifications(true)}
              disabled={refreshing || loading}
              className="p-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-bold flex items-center transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Refresh notifications"
            >
              <FiRefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Register Device Token Button */}
            <button
              type="button"
              onClick={() => {
                setDeviceTokenError(null);
                setDeviceTokenSuccess(null);
                setIsDeviceTokenModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 hover:border-blue-500/40 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer shadow-xs"
            >
              <FiSmartphone className="text-xs text-blue-500" />
              <span>Register Token</span>
            </button>

            {/* Mark All As Read */}
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={markingAllRead || unreadCount === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 dark:disabled:text-slate-600 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
            >
              <MdDoneAll className="text-sm" />
              <span>{markingAllRead ? 'Marking...' : 'Mark All Read'}</span>
            </button>
          </div>
        }
      />

      {/* Main Split-Screen Inbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:h-[calc(100vh-165px)] lg:min-h-[580px] lg:max-h-[calc(100vh-165px)]">
        {/* ================= LEFT COLUMN: MASTER LIST (5 cols) ================= */}
        <div className="lg:col-span-5 flex flex-col h-full min-h-0 space-y-2.5 bg-white/40 dark:bg-slate-900/25 rounded-2xl shadow-xl">
          {/* Search, Type Filter & Quick Controls (Sticky at top of left pane) */}
          <div className="shrink-0 p-3 sm:p-3.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 space-y-2.5 shadow-xs">
            <div className="relative w-full">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search notifications (Press '/' to focus)..."
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

            {/* Filter pills & Type selector */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleStatusFilterChange('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusFilterChange('unread')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    statusFilter === 'unread'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusFilterChange('read')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    statusFilter === 'read'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  Read
                </button>
              </div>

              {availableTypes.length > 0 && (
                <div className="min-w-[130px]">
                  <CustomDropdown
                    value={typeFilter}
                    onChange={(val) => handleTypeFilterChange(val)}
                    options={[
                      { value: 'ALL', label: 'All Types' },
                      ...availableTypes.map((t) => ({
                        value: t,
                        label: t.replace(/_/g, ' ')
                      }))
                    ]}
                    statusColor="!px-2.5 !py-1 text-[11px] rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300"
                  />
                </div>
              )}
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
                onClick={() => fetchNotifications(true)}
                className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors cursor-pointer text-xs"
              >
                Retry
              </button>
            </div>
          )}

          {/* Master List Feed - Dedicated Scroll Container */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 pr-1">
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
            ) : filteredNotifications.length === 0 ? (
              <Card className="p-8 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-2.5">
                  <MdNotificationsNone className="text-2xl" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No notifications match filter
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mt-1">
                  Try clearing your search keyword or switching filter pills.
                </p>
                {(searchQuery || statusFilter !== 'all' || typeFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSearchChange('');
                      handleStatusFilterChange('all');
                      handleTypeFilterChange('ALL');
                    }}
                    className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </Card>
            ) : (
              currentNotifications.map((item, idx) => {
                const itemId = item._id || item.id || `notif-${idx}`;
                const isSelected = selectedNotificationId === itemId;
                const isRead = Boolean(item.isRead);
                const typeConfig = getTypeConfig(item.type, item.relatedEntityType);
                const TypeIcon = typeConfig.icon;
                const isPurchaseOrder = checkIsPurchaseOrder(item);
                const poNumber = isPurchaseOrder ? getNotificationPoNumber(item) : null;

                return (
                  <div
                    key={itemId}
                    onClick={() => selectNotificationItem(item)}
                    className={`relative p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer text-left group backdrop-blur-xl ${
                      isSelected
                        ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500/80 ring-2 ring-blue-500/30 shadow-md'
                        : isRead
                        ? 'bg-white/70 dark:bg-slate-900/50 border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                        : 'bg-white dark:bg-slate-900 border-blue-200/80 dark:border-blue-500/30 shadow-xs hover:border-blue-300'
                    }`}
                  >
                    {/* Left Accent indicator for unread items */}
                    {!isRead && (
                      <span
                        className={`absolute left-0 top-3.5 bottom-3.5 w-1 rounded-r-full ${typeConfig.accentBar}`}
                      />
                    )}

                    {/* Top Row: Type badge, unread dot, timestamp */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Unread beacon */}
                        {!isRead ? (
                          <span className="relative flex h-2 w-2 shrink-0" title="Unread">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                          </span>
                        ) : (
                          <FiCheckCircle className="text-[11px] text-emerald-500 shrink-0" title="Read" />
                        )}

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 ${typeConfig.badgeClass}`}
                        >
                          <TypeIcon className="text-[10px]" />
                          <span className="truncate max-w-[100px]">{typeConfig.label}</span>
                        </span>

                        {poNumber && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold shrink-0">
                            #{poNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                        <FiClock className="text-[10px]" />
                        <span>{getRelativeTime(item.createdAt)}</span>
                      </div>
                    </div>

                    {/* Notification Title */}
                    <h4
                      className={`text-xs leading-snug truncate transition-colors ${
                        !isRead
                          ? 'font-bold text-slate-900 dark:text-white'
                          : 'font-semibold text-slate-700 dark:text-slate-300'
                      } ${isSelected ? 'text-blue-700 dark:text-blue-300' : ''}`}
                    >
                      {item.title || 'Untitled Notification'}
                    </h4>

                    {/* Message Snippet */}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {item.message || 'No additional details provided.'}
                    </p>

                    {/* Bottom Quick Row */}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-white/5 text-[10px] text-slate-400">
                      <span className="font-mono truncate max-w-[160px]">
                        {item.relatedEntityId
                          ? `ID: ...${String(item.relatedEntityId).slice(-6)}`
                          : ''}
                      </span>

                      <div className="flex items-center gap-2">
                        {!isRead && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(itemId, e)}
                            disabled={actionLoadingId === itemId}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <FiCheck className="text-[10px]" />
                            <span>Mark read</span>
                          </button>
                        )}
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="group-hover:text-blue-500 font-semibold flex items-center gap-0.5">
                          <span>View</span>
                          <FiArrowRight className="text-[9px]" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Master List Pagination (Pinned at bottom of left pane) */}
          {filteredNotifications.length > 0 && totalPages > 1 && (
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
            {selectedNotification ? (
              (() => {
                const selId = selectedNotification._id || selectedNotification.id;
                const isRead = Boolean(selectedNotification.isRead);
                const typeConfig = getTypeConfig(
                  selectedNotification.type,
                  selectedNotification.relatedEntityType
                );
                const TypeIcon = typeConfig.icon;
                const isPO = checkIsPurchaseOrder(selectedNotification);
                const poNum = getNotificationPoNumber(selectedNotification);
                const rawData = selectedNotification.data || selectedNotification.metadata;

                return (
                  <div className="flex flex-col h-full min-h-0">
                    {/* Detail Sticky Header */}
                    <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 dark:bg-black/20 flex items-center justify-between gap-3 shrink-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg border border-blue-500/20 shrink-0">
                          <TypeIcon />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${typeConfig.badgeClass}`}
                            >
                              <TypeIcon className="text-[10px]" />
                              <span>{typeConfig.label}</span>
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isRead
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                              }`}
                            >
                              {isRead ? 'Read' : 'Unread'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 mt-1 truncate">
                            <span>ID: {selId}</span>
                            <CopyButton text={selId} title="Copy Notification ID" />
                          </div>
                        </div>
                      </div>

                      {/* Header Controls: Stepper & Mark Read */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Stepper Navigation */}
                        {filteredNotifications.length > 1 && (
                          <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200/80 dark:border-white/10 shadow-xs">
                            <button
                              type="button"
                              onClick={handlePrevNotification}
                              disabled={!hasPrev}
                              title="Previous (or 'k' / up arrow)"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer"
                            >
                              <FiChevronLeft size={14} />
                            </button>
                            <span className="text-[10px] font-mono px-2 text-slate-500 font-bold select-none">
                              {selectedIndex >= 0 ? `${selectedIndex + 1}/${filteredNotifications.length}` : ''}
                            </span>
                            <button
                              type="button"
                              onClick={handleNextNotification}
                              disabled={!hasNext}
                              title="Next (or 'j' / down arrow)"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer"
                            >
                              <FiChevronRight size={14} />
                            </button>
                          </div>
                        )}

                        {!isRead && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(selId, e)}
                            disabled={actionLoadingId === selId}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <FiCheck className={`text-xs ${actionLoadingId === selId ? 'animate-spin' : ''}`} />
                            <span>{actionLoadingId === selId ? 'Marking...' : 'Mark Read'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Scrollable Detail Body */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar text-xs">
                      {/* Timestamps ribbon */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 p-2.5 bg-slate-50/70 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-1.5">
                          <FiClock className="text-slate-400" />
                          <span>
                            Delivered:{' '}
                            <strong className="text-slate-700 dark:text-slate-300 font-semibold">
                              {selectedNotification.createdAt
                                ? formatDateTimeDDMMYYYY(selectedNotification.createdAt, true)
                                : 'Recent'}
                            </strong>
                          </span>
                        </div>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {getRelativeTime(selectedNotification.createdAt)}
                        </span>
                      </div>

                      {/* Main Title */}
                      <div className="space-y-1">
                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                          {selectedNotification.title || 'Untitled Notification'}
                        </h2>
                      </div>

                      {/* Main Message Body */}
                      <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-black/30 border border-slate-200/60 dark:border-white/5 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Notification Content
                        </span>
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {selectedNotification.message || 'No additional details provided.'}
                        </p>
                      </div>

                      {/* Direct PO Hero Banner (if purchase order) */}
                      {isPO && (
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm font-bold shrink-0">
                                <FiShoppingBag />
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-slate-900 dark:text-white">
                                  Purchase Order Detected
                                </h4>
                                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium font-mono">
                                  {poNum ? `Order Reference: #${poNum}` : 'Direct order event'}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleNavigateToPO(selectedNotification, e)}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer ml-auto"
                            >
                              <span>Open PO in Management</span>
                              <FiExternalLink className="text-xs" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Linked Entity Details */}
                      {(selectedNotification.relatedEntityType || selectedNotification.relatedEntityId) && (
                        <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-black/20 border border-slate-200/60 dark:border-white/5 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Linked Entity Information
                          </span>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-[11px] text-slate-400 block">Entity Type</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                                {selectedNotification.relatedEntityType || 'N/A'}
                              </span>
                            </div>
                            {selectedNotification.relatedEntityId && (
                              <div>
                                <span className="text-[11px] text-slate-400 block">Entity ID</span>
                                <div className="flex items-center gap-1 font-mono text-slate-800 dark:text-slate-200">
                                  <span className="truncate max-w-[150px]">
                                    {selectedNotification.relatedEntityId}
                                  </span>
                                  <CopyButton text={selectedNotification.relatedEntityId} />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Additional Technical Metadata (Accordion) */}
                      {rawData && (
                        <div className="border border-slate-200/60 dark:border-white/5 rounded-2xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setShowRawPayload((prev) => !prev)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 flex items-center justify-between text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <FiCode className="text-slate-400" />
                              <span>Raw Payload / Metadata</span>
                            </div>
                            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-mono">
                              {showRawPayload ? 'Hide JSON' : 'View JSON'}
                            </span>
                          </button>
                          {showRawPayload && (
                            <div className="p-3 bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-48 custom-scrollbar">
                              <pre>{JSON.stringify(rawData, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      )}
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
                          onClick={(e) => handleNavigateToPO(selectedNotification, e)}
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
                  <MdNotificationsNone />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No Notification Selected
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                  Select any notification from the left feed to preview its complete message body, linked entity, and actions here.
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
      {isMobileDetailOpen && selectedNotification && (
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
                    <FiBell />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    Notification Details
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
                    Title
                  </span>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedNotification.title || 'Untitled Notification'}
                  </h2>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Message
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {selectedNotification.message || 'No additional details provided.'}
                  </p>
                </div>

                {checkIsPurchaseOrder(selectedNotification) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      setIsMobileDetailOpen(false);
                      handleNavigateToPO(selectedNotification, e);
                    }}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                  >
                    <FiShoppingBag className="text-sm" />
                    <span>View Purchase Order</span>
                    <FiArrowRight className="text-xs" />
                  </button>
                )}

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 space-y-2 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Metadata
                  </span>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedNotification.isRead ? 'Read' : 'Unread'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Delivered</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {getRelativeTime(selectedNotification.createdAt)}
                    </span>
                  </div>
                  {selectedNotification.relatedEntityType && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Entity</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {selectedNotification.relatedEntityType}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-3.5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                {!selectedNotification.isRead && (
                  <button
                    type="button"
                    onClick={() => handleMarkAsRead(selectedNotification._id || selectedNotification.id)}
                    className="px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Mark as Read
                  </button>
                )}
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

      {/* ================= Device Token Registration Modal ================= */}
      {isDeviceTokenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 dark:bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white/40 dark:bg-slate-950/25 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/80 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg border border-blue-500/20">
                  <FiSmartphone />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Register Device Token</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Push notification token setup</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeviceTokenModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer transition-colors"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {deviceTokenSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <FiCheckCircle className="text-sm shrink-0" />
                <span>{deviceTokenSuccess}</span>
              </div>
            )}

            {deviceTokenError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <FiAlertCircle className="text-sm shrink-0" />
                <span>{deviceTokenError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterDeviceToken} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Device Platform
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['android', 'ios', 'web'].map((dev) => (
                    <button
                      key={dev}
                      type="button"
                      onClick={() => setDeviceTokenForm((prev) => ({ ...prev, deviceType: dev }))}
                      className={`py-2 px-2 rounded-xl text-xs font-bold uppercase transition-all border cursor-pointer ${
                        deviceTokenForm.deviceType === dev
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                    >
                      {dev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    FCM Device Token
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDeviceTokenForm((prev) => ({
                        ...prev,
                        fcmToken: 'sample_fcm_token_' + Math.random().toString(36).substring(7)
                      }))
                    }
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Sample Token
                  </button>
                </div>
                <textarea
                  required
                  rows={3}
                  value={deviceTokenForm.fcmToken}
                  onChange={(e) => setDeviceTokenForm((prev) => ({ ...prev, fcmToken: e.target.value }))}
                  placeholder="Paste your FCM registration token here..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-mono text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200/80 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsDeviceTokenModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deviceTokenSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md shadow-blue-500/25 cursor-pointer disabled:opacity-50"
                >
                  {deviceTokenSubmitting ? 'Registering...' : 'Save Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;