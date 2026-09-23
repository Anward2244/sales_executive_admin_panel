import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiBell,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiSearch,
  FiEye,
  FiRefreshCw,
  FiCheck,
  FiX,
  FiShoppingBag,
  FiFileText,
  FiSmartphone,
  FiArrowRight,
  FiInbox,
  FiFilter,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import {
  MdDoneAll,
  MdNotificationsNone,
  MdDevices
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

  // Notifications State (GET /v1/notifications or /notifications)
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Pagination metadata from API
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
  const limitPerPage = displayPrefs.rowsPerPage || 10;

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' or specific notification type
  const [searchQuery, setSearchQuery] = useState('');

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Selected Notification Modal
  const [selectedNotification, setSelectedNotification] = useState(null);

  // Device Token Registration Modal
  const [isDeviceTokenModalOpen, setIsDeviceTokenModalOpen] = useState(false);
  const [deviceTokenForm, setDeviceTokenForm] = useState({
    fcmToken: '',
    deviceType: 'android'
  });
  const [deviceTokenSubmitting, setDeviceTokenSubmitting] = useState(false);
  const [deviceTokenSuccess, setDeviceTokenSuccess] = useState(null);
  const [deviceTokenError, setDeviceTokenError] = useState(null);

  // In-page Toast feedback
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

  // Helper for Type styling & labels
  const getTypeConfig = (type, relatedEntityType) => {
    const rawType = (type || relatedEntityType || '').toUpperCase();

    if (rawType.includes('PO') || rawType.includes('PURCHASE') || rawType === 'ORDER') {
      return {
        label: 'Purchase Order',
        icon: <FiShoppingBag className="text-sm" />,
        badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
        cardBorder: 'border-l-emerald-500'
      };
    }
    if (rawType.includes('USER') || rawType.includes('CUSTOMER') || rawType.includes('AUTH')) {
      return {
        label: 'User Account',
        icon: <FiFileText className="text-sm" />,
        badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20',
        cardBorder: 'border-l-indigo-500'
      };
    }
    if (rawType.includes('ALERT') || rawType.includes('WARNING') || rawType.includes('ERROR')) {
      return {
        label: 'System Alert',
        icon: <FiAlertCircle className="text-sm" />,
        badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
        cardBorder: 'border-l-rose-500'
      };
    }

    // Default system notification
    return {
      label: type ? type.replace(/_/g, ' ') : 'System Notice',
      icon: <FiBell className="text-sm" />,
      badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20',
      cardBorder: 'border-l-blue-500'
    };
  };

  // Fetch Notifications
  const fetchNotifications = async (page = 1, isManual = false, isSilent = false) => {
    if (isManual) setRefreshing(true);
    else if (!isSilent) setLoading(true);
    setError(null);

    try {
      const response = await getNotificationsApi({ page, limit: limitPerPage });
      const resData = response.data || {};
      const list = Array.isArray(resData.data)
        ? resData.data
        : Array.isArray(resData)
          ? resData
          : Array.isArray(resData.notifications)
            ? resData.notifications
            : [];

      setNotifications(list);

      if (resData.meta) {
        setMeta(resData.meta);
      } else {
        setMeta({
          total: list.length,
          page,
          limit: limitPerPage,
          totalPages: Math.max(1, Math.ceil(list.length / limitPerPage)),
          hasNextPage: false,
          hasPrevPage: false
        });
      }
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      if (!isSilent) {
        setError(err.response?.data?.message || err.message || 'Failed to load notifications.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications(currentPage);

    // Background polling every 15 seconds to fetch latest notifications live
    const pollTimer = setInterval(() => {
      fetchNotifications(currentPage, false, true);
    }, 15000);

    const onFocus = () => {
      fetchNotifications(currentPage, false, true);
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener('focus', onFocus);
    };
  }, [currentPage, limitPerPage]);

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
      if (selectedNotification && (selectedNotification._id === id || selectedNotification.id === id)) {
        setSelectedNotification((prev) => ({ ...prev, isRead: true }));
      }
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
      if (selectedNotification) {
        setSelectedNotification((prev) => ({ ...prev, isRead: true }));
      }
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

  // Client-side computed stats
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const readCount = notifications.filter((n) => n.isRead).length;
  const poCount = notifications.filter((n) =>
    (n.type || '').toUpperCase().includes('PO') || (n.relatedEntityType || '').toUpperCase() === 'PURCHASEORDER'
  ).length;

  // Extract unique notification types for filter dropdown
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
        title="Notifications"
        icon={MdNotificationsNone}
        description="Monitor system alerts, purchase order updates, and in-app communications in real time."
        badge={
          meta.total > 0
            ? `${meta.total} Total`
            : null
        }
        actions={
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, message, ID..."
                className="w-full pl-9 pr-7 py-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white placeholder-slate-400 text-xs font-medium transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer text-xs"
                >
                  &times;
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => fetchNotifications(currentPage, true)}
              disabled={refreshing || loading}
              className="p-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:border-blue-500/40 transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
              title="Refresh notifications list"
            >
              <FiRefreshCw className={`text-base ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        }
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Notifications
            </p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {meta.total ?? notifications.length}
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Catalog activity log</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
            <FiInbox className="text-xl" />
          </div>
        </Card>

        {/* Unread */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Unread
            </p>
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {unreadCount}
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Needs acknowledgment</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
            <FiAlertCircle className="text-xl" />
          </div>
        </Card>

        {/* Read */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Read
            </p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {readCount}
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Reviewed items</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <FiCheckCircle className="text-xl" />
          </div>
        </Card>

        {/* Purchase Orders */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Purchase Orders
            </p>
            <h3 className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1">
              {poCount}
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">PO creation events</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-500/20">
            <FiShoppingBag className="text-xl" />
          </div>
        </Card>

        {/* Push Device Token Card */}
        <Card className="p-4 flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Device Push
            </p>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              <span>FCM Ready</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                setDeviceTokenError(null);
                setDeviceTokenSuccess(null);
                setIsDeviceTokenModalOpen(true);
              }}
              className="text-xs font-extrabold text-blue-600 dark:text-blue-400 hover:underline mt-1 cursor-pointer flex items-center gap-1"
            >
              <span>Register Token</span>
              <FiArrowRight className="text-xs" />
            </button>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <FiSmartphone className="text-xl" />
          </div>
        </Card>
      </div>

      {/* Filter, Search & Density Controls */}
      <Card className="p-3.5 sm:p-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-black/30 p-1 rounded-xl border border-slate-200/80 dark:border-white/10 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unread')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'unread'
                  ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('read')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'read'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Read ({readCount})
            </button>
          </div>

          {/* Right Side: Type Filter + Search + Limit */}
          <div className="flex items-center gap-2.5 flex-wrap flex-1 lg:justify-end">
            {/* Type selector */}
            {availableTypes.length > 0 && (
              <div className="min-w-[160px]">
                <CustomDropdown
                  value={typeFilter}
                  onChange={(val) => setTypeFilter(val)}
                  options={[
                    { value: 'ALL', label: 'All Event Types' },
                    ...availableTypes.map((t) => ({
                      value: t,
                      label: t.replace(/_/g, ' ')
                    }))
                  ]}
                  statusColor="!px-3 !py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 font-semibold text-slate-700 dark:text-slate-300"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Mark All As Read */}
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={markingAllRead || unreadCount === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 dark:disabled:text-slate-600 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
              >
                <MdDoneAll className="text-xs" />
                <span>{markingAllRead ? 'Marking...' : 'Mark Read'}</span>
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Notifications Feed */}
      <div className="space-y-3">
        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <FiAlertCircle className="text-base shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchNotifications(currentPage)}
              className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !refreshing ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4 animate-pulse space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-1/4"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-24"></div>
                </div>
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-1/2"></div>
              </Card>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          /* Empty State */
          <Card className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3">
              <MdNotificationsNone className="text-3xl" />
            </div>
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
              {searchQuery || statusFilter !== 'all' || typeFilter !== 'ALL'
                ? 'No matching notifications found'
                : 'No notifications available'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
              {searchQuery || statusFilter !== 'all' || typeFilter !== 'ALL'
                ? 'Try adjusting your filters or search keywords to view other notifications.'
                : 'All system notifications and purchase order updates will appear here.'}
            </p>
            {(searchQuery || statusFilter !== 'all' || typeFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setTypeFilter('ALL');
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer shadow-md shadow-blue-500/25"
              >
                Reset Filters
              </button>
            )}
          </Card>
        ) : (
          /* List of Notifications */
          filteredNotifications.map((item) => {
            const itemId = item._id || item.id;
            const isRead = Boolean(item.isRead);
            const isLoadingThis = actionLoadingId === itemId;
            const typeConfig = getTypeConfig(item.type, item.relatedEntityType);
            const isPurchaseOrder =
              (item.type || '').toUpperCase().includes('PO') ||
              (item.relatedEntityType || '').toUpperCase() === 'PURCHASEORDER';

            return (
              <div
                key={itemId || Math.random()}
                onClick={() => setSelectedNotification(item)}
                className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 group cursor-pointer backdrop-blur-xl ${
                  isRead
                    ? 'bg-white/70 dark:bg-slate-900/50 border-slate-200/80 dark:border-white/10 hover:border-blue-400/40 hover:shadow-md'
                    : `bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-500/30 border-l-4 ${typeConfig.cardBorder} shadow-xs hover:shadow-lg`
                }`}
              >
                {/* Header line of the card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Read/Unread Indicator */}
                    {!isRead ? (
                      <span className="relative flex h-2.5 w-2.5" title="Unread">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                      </span>
                    ) : (
                      <FiCheckCircle className="text-xs text-emerald-500" title="Read" />
                    )}

                    {/* Event Type Pill */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${typeConfig.badgeClass}`}
                    >
                      {typeConfig.icon}
                      <span>{typeConfig.label}</span>
                    </span>

                    {/* Notification Title */}
                    <h4
                      className={`text-sm font-bold transition-colors ${
                        isRead
                          ? 'text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                          : 'text-slate-900 dark:text-white font-extrabold group-hover:text-blue-600'
                      }`}
                    >
                      {item.title || 'Untitled Notification'}
                    </h4>
                  </div>

                  {/* Relative / Timestamp */}
                  <div className="flex items-center gap-1.5 shrink-0 text-slate-400 dark:text-slate-500 text-[11px] font-medium">
                    <FiClock className="text-xs text-slate-400" />
                    <span title={item.createdAt ? formatDateTimeDDMMYYYY(item.createdAt) : ''}>
                      {item.createdAt ? getRelativeTime(item.createdAt) : 'Recent'}
                    </span>
                  </div>
                </div>

                {/* Message Body */}
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
                  {item.message || 'No additional details provided.'}
                </p>

                {/* Card Footer with Meta tags & Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-2.5 border-t border-slate-100 dark:border-white/5">
                  {/* Entity Metadata tags */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                    {item.relatedEntityType && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-semibold">
                        <span>Entity:</span>
                        <strong className="font-mono text-slate-800 dark:text-slate-200">
                          {item.relatedEntityType}
                        </strong>
                      </span>
                    )}

                    {item.relatedEntityId && (
                      <div
                        className="inline-flex items-center gap-1 font-mono bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md text-slate-500 dark:text-slate-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>ID: {String(item.relatedEntityId).slice(-8)}</span>
                        <CopyButton text={item.relatedEntityId} title="Copy Entity ID" />
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {/* Direct Navigate to Purchase Orders if it's a PO event */}
                    {isPurchaseOrder && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate('/purchase-orders', {
                            state: { highlightOrderId: item.relatedEntityId }
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl border border-emerald-500/25 transition-all cursor-pointer shadow-xs"
                        title="View Purchase Orders page"
                      >
                        <FiShoppingBag className="text-xs" />
                        <span>View PO</span>
                        <FiArrowRight className="text-[10px]" />
                      </button>
                    )}

                    {/* Mark as Read Button */}
                    {!isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(itemId, e)}
                        disabled={isLoadingThis}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        <FiCheck className={`text-xs ${isLoadingThis ? 'animate-spin' : ''}`} />
                        <span>{isLoadingThis ? 'Marking...' : 'Mark Read'}</span>
                      </button>
                    )}

                    {/* Details modal trigger */}
                    <button
                      type="button"
                      onClick={() => setSelectedNotification(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-200/80 dark:border-white/10 cursor-pointer"
                    >
                      <FiEye className="text-xs" />
                      <span>Details</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Bar */}
      {meta && meta.totalPages > 1 && (
        <Card className="p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Page <span className="font-bold text-slate-800 dark:text-white">{meta.page}</span> of{' '}
            <span className="font-bold text-slate-800 dark:text-white">{meta.totalPages}</span>{' '}
            ({meta.total} total notifications)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
            >
              <FiChevronLeft className="inline text-xs mr-0.5" /> Prev
            </button>

            {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
              let pNum = i + 1;
              if (meta.totalPages > 5 && currentPage > 3) {
                pNum = currentPage - 2 + i;
                if (pNum > meta.totalPages) {
                  pNum = meta.totalPages - (4 - i);
                }
              }
              if (pNum < 1) pNum = 1;

              return (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => setCurrentPage(pNum)}
                  disabled={loading}
                  className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    pNum === currentPage
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                      : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={currentPage >= meta.totalPages || loading}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
            >
              Next <FiChevronRight className="inline text-xs ml-0.5" />
            </button>
          </div>
        </Card>
      )}

      {/* ================= Notification Details Modal ================= */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 dark:bg-slate-950/50 backdrop-blur-lg animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white/40 dark:bg-slate-950/25 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/80 dark:border-white/10 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg border border-blue-500/20">
                  <FiBell />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Notification Details</h3>
                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                    <span>ID: {selectedNotification._id || selectedNotification.id}</span>
                    <CopyButton text={selectedNotification._id || selectedNotification.id} />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer transition-colors"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {/* Modal Details */}
            <div className="space-y-3.5 text-xs">
              {/* Status and Type Pills */}
              <div className="flex items-center justify-between p-3 bg-slate-50/80 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      selectedNotification.isRead
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                    }`}
                  >
                    {selectedNotification.isRead ? 'Read' : 'Unread'}
                  </span>
                </div>

                {selectedNotification.type && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type:</span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-mono text-[11px] font-bold">
                      {selectedNotification.type}
                    </span>
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="p-3.5 bg-slate-50/80 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Title</span>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedNotification.title || 'Untitled Notification'}
                </p>
              </div>

              {/* Message */}
              <div className="p-3.5 bg-slate-50/80 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Message</span>
                <p className="text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedNotification.message || 'No message provided.'}
                </p>
              </div>

              {/* Related Entity Information */}
              {(selectedNotification.relatedEntityType || selectedNotification.relatedEntityId) && (
                <div className="p-3.5 bg-slate-50/80 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Linked Entity
                  </span>
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div>
                      <span className="font-semibold text-slate-600 dark:text-slate-400">Type: </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedNotification.relatedEntityType || 'N/A'}
                      </span>
                    </div>
                    {selectedNotification.relatedEntityId && (
                      <div className="flex items-center gap-1.5 font-mono text-slate-700 dark:text-slate-300">
                        <span>ID: {selectedNotification.relatedEntityId}</span>
                        <CopyButton text={selectedNotification.relatedEntityId} />
                      </div>
                    )}
                  </div>

                  {/* Quick Action Button for Entity */}
                  {selectedNotification.relatedEntityType === 'PurchaseOrder' && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNotification(null);
                          navigate('/purchase-orders', {
                            state: { highlightOrderId: selectedNotification.relatedEntityId }
                          });
                        }}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/25"
                      >
                        <FiShoppingBag className="text-sm" />
                        <span>Navigate to Purchase Orders</span>
                        <FiArrowRight className="text-xs" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Recipient ID */}
              {selectedNotification.recipientId && (
                <div className="flex items-center justify-between p-3 bg-slate-50/80 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recipient ID:</span>
                  <div className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300">
                    <span>{selectedNotification.recipientId}</span>
                    <CopyButton text={selectedNotification.recipientId} />
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {selectedNotification.createdAt && (
                  <div className="p-3 bg-slate-50/80 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Created</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {formatDateTimeDDMMYYYY(selectedNotification.createdAt, true)}
                    </span>
                  </div>
                )}
                {selectedNotification.updatedAt && (
                  <div className="p-3 bg-slate-50/80 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Updated</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {formatDateTimeDDMMYYYY(selectedNotification.updatedAt, true)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/80 dark:border-white/10">
              {!selectedNotification.isRead && (
                <button
                  type="button"
                  onClick={() => handleMarkAsRead(selectedNotification._id || selectedNotification.id)}
                  disabled={actionLoadingId === (selectedNotification._id || selectedNotification.id)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/25 cursor-pointer disabled:opacity-50"
                >
                  {actionLoadingId === (selectedNotification._id || selectedNotification.id)
                    ? 'Marking Read...'
                    : 'Mark as Read'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= Device Token Registration Modal ================= */}
      {isDeviceTokenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 dark:bg-slate-950/50 backdrop-blur-lg animate-in fade-in duration-200">
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