import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdSend, MdNotificationsActive, MdKeyboardArrowDown, MdImage,
  MdHistory, MdRefresh, MdPhoneAndroid, MdPhoneIphone, MdPeople,
  MdPerson, MdGroupAdd, MdDoneAll, MdMarkEmailRead, MdDevices,
  MdCheckCircle, MdNotificationsNone
} from 'react-icons/md';
import {
  FiAlertCircle, FiCopy, FiGlobe, FiUsers, FiUser,
  FiUserCheck, FiLayers, FiBox, FiTrendingUp, FiLink, FiCheck, FiX, FiSearch,
  FiChevronLeft, FiChevronRight, FiBarChart2, FiInbox, FiSmartphone, FiClock,
  FiEye, FiRefreshCw, FiSend, FiTag, FiCheckCircle
} from 'react-icons/fi';
import { DiAndroid, DiApple } from "react-icons/di";
import axios from 'axios';
import {
  api,
  BASE_URL,
  getNotificationsApi,
  markNotificationAsReadApi,
  markAllNotificationsAsReadApi,
  registerDeviceTokenApi
} from '@/api/axios';
import CustomDropdown from '@/components/ui/CustomDropdown';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { useConfirm } from '@/Context/ConfirmationContext';
import appIconImg from '@/assets/auric.png';
import { showBrowserNotification, requestBrowserNotificationPermission, isBrowserNotificationSupported } from '@/utils/browserNotifications';

const Notifications = () => {
  const navigate = useNavigate();
  const { confirm } = useConfirm();

  // Top Tab selection: 'inbox' (User In-App Notifications) or 'campaigns' (Broadcast Push Campaigns)
  const [activeTab, setActiveTab] = useState('inbox');

  // In-App Notifications State (GET /notifications)
  const [inAppNotifications, setInAppNotifications] = useState([]);
  const [inAppLoading, setInAppLoading] = useState(false);
  const [inAppRefreshing, setInAppRefreshing] = useState(false);
  const [inAppError, setInAppError] = useState(null);
  const [inAppMeta, setInAppMeta] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [inAppPage, setInAppPage] = useState(1);
  const [inAppFilter, setInAppFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [inAppSearch, setInAppSearch] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Selected Notification Modal
  const [selectedNotification, setSelectedNotification] = useState(null);

  // Device Token Registration Modal (POST /notifications/device-token)
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

  // Fetch In-App Notifications (GET /notifications)
  const fetchInAppNotifications = async (page = 1, isManual = false) => {
    if (isManual) setInAppRefreshing(true);
    else setInAppLoading(true);
    setInAppError(null);

    try {
      const response = await getNotificationsApi({ page, limit: 20 });
      const resData = response.data || {};
      const list = Array.isArray(resData.data)
        ? resData.data
        : Array.isArray(resData)
          ? resData
          : Array.isArray(resData.notifications)
            ? resData.notifications
            : [];

      setInAppNotifications(list);
      if (resData.meta) {
        setInAppMeta(resData.meta);
      } else {
        setInAppMeta({
          total: list.length,
          page,
          limit: 20,
          totalPages: Math.max(1, Math.ceil(list.length / 20)),
          hasNextPage: false,
          hasPrevPage: false
        });
      }
      setInAppPage(page);
    } catch (err) {
      console.error('Failed to fetch in-app notifications:', err);
      setInAppError(err.response?.data?.message || err.message || 'Failed to load notifications.');
    } finally {
      setInAppLoading(false);
      setInAppRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInAppNotifications(1);
  }, []);

  // Mark Single Notification as Read (PATCH /notifications/{id}/read)
  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    if (!id) return;
    setActionLoadingId(id);
    try {
      await markNotificationAsReadApi(id);
      setInAppNotifications((prev) =>
        prev.map((n) => {
          const nId = n._id || n.id;
          return nId === id ? { ...n, isRead: true, read: true } : n;
        })
      );
      if (selectedNotification && (selectedNotification._id === id || selectedNotification.id === id)) {
        setSelectedNotification((prev) => ({ ...prev, isRead: true, read: true }));
      }
      showToast('Notification marked as read.', 'success');
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      showToast(err.response?.data?.message || err.message || 'Failed to mark as read.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mark All Notifications as Read (PATCH /notifications/read-all)
  const handleMarkAllAsRead = async () => {
    setMarkingAllRead(true);
    try {
      await markAllNotificationsAsReadApi();
      setInAppNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, read: true }))
      );
      if (selectedNotification) {
        setSelectedNotification((prev) => ({ ...prev, isRead: true, read: true }));
      }
      showToast('All notifications marked as read.', 'success');
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      showToast(err.response?.data?.message || err.message || 'Failed to mark all as read.', 'error');
    } finally {
      setMarkingAllRead(false);
    }
  };

  // Register / Update Push Device Token (POST /notifications/device-token)
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

  const handleFillSampleToken = () => {
    setDeviceTokenForm({
      fcmToken: 'fcm_d1e2v3i4c5e_t6o7k8e9n',
      deviceType: 'android'
    });
  };

  const unreadInAppCount = inAppNotifications.filter((n) => !n.isRead && !n.read).length;
  const readInAppCount = inAppNotifications.filter((n) => n.isRead || n.read).length;

  const filteredInAppNotifications = inAppNotifications.filter((item) => {
    const isItemRead = item.isRead || item.read;
    if (inAppFilter === 'unread' && isItemRead) return false;
    if (inAppFilter === 'read' && !isItemRead) return false;

    if (inAppSearch.trim()) {
      const q = inAppSearch.toLowerCase();
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchBody = (item.message || item.body || item.description || '').toLowerCase().includes(q);
      const matchType = (item.type || '').toLowerCase().includes(q);
      return matchTitle || matchBody || matchType;
    }
    return true;
  });

  const getAudienceIcon = (type) => {
    if (type === 'All Users') return <FiUsers className="text-blue-400 text-lg shrink-0" />;
    if (type === 'Single User') return <FiUser className="text-amber-400 text-lg shrink-0" />;
    if (type === 'Selected Users') return <FiUserCheck className="text-emerald-400 text-lg shrink-0" />;
    return null;
  };

  // State for the notification form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [platform, setPlatform] = useState('all'); // 'all', 'android', 'ios'
  const [targetType, setTargetType] = useState('All Users'); // 'All Users', 'Single User', 'Selected Users'
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [clickAction, setClickAction] = useState('none');
  const [actionId, setActionId] = useState('');
  const [isSending, setIsSending] = useState(false);

  // States for target list data
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Refs
  const customerDropdownRef = useRef(null);

  // Searchable select state
  const [searchTerm, setSearchTerm] = useState('');
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);

  // State for the custom target audience dropdown
  const [isAudienceDropdownOpen, setIsAudienceDropdownOpen] = useState(false);
  const audienceDropdownRef = useRef(null);

  // State for campaign history list
  const [campaigns, setCampaigns] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorHistory, setErrorHistory] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [currentHistoryPage, setCurrentHistoryPage] = useState(1);
  const [recipientsMap, setRecipientsMap] = useState({});
  const historyItemsPerPage = 10;

  // Fetch history of campaigns
  const fetchCampaignHistory = async () => {
    setLoadingHistory(true);
    setErrorHistory('');
    try {
      const token = sessionStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      const response = await api.get('/admin/campaign-stats', { headers });
      setCampaigns(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Failed to fetch campaign history:', err);
      setErrorHistory('Failed to load notification history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch products, categories, brands, and customers for selection
  useEffect(() => {
    const fetchSelectionData = async () => {
      try {
        const token = sessionStorage.getItem('accessToken');
        const headers = { Authorization: `Bearer ${token}` };

        const [prodRes, catRes, brandRes, custRes] = await Promise.all([
          axios.get(`${BASE_URL}/api/products/`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${BASE_URL}/api/categories/`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${BASE_URL}/api/brands/`, { headers }).catch(() => ({ data: [] })),
          api.get('/admin/customers', { headers }).catch(() => ({ data: [] }))
        ]);

        setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
        setCategories(Array.isArray(catRes.data) ? catRes.data : []);
        setBrands(Array.isArray(brandRes.data) ? brandRes.data : []);
        setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
      } catch (err) {
        console.error("Failed to load selection data for notifications", err);
      }
    };

    fetchSelectionData();
    fetchCampaignHistory();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (audienceDropdownRef.current && !audienceDropdownRef.current.contains(event.target)) {
        setIsAudienceDropdownOpen(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to look up names for products/categories/brands
  const getActionTargetName = (clickAction, actionId) => {
    if (clickAction === 'homepage' || clickAction === 'home') return 'Home Page';
    if (!actionId) return '';
    if (clickAction === 'product') {
      const p = products.find(prod => prod._id === actionId);
      return p ? p.name : actionId;
    }
    if (clickAction === 'category') {
      const c = categories.find(cat => cat._id === actionId);
      return c ? c.name : actionId;
    }
    if (clickAction === 'brand') {
      const b = brands.find(br => br._id === actionId);
      return b ? b.name : actionId;
    }
    return actionId;
  };

  // Handle form submission
  const handleSendNotification = async (e) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      alert('Please fill in both title and description.');
      return;
    }

    if (clickAction === 'home' && !imageUrl.trim()) {
      alert('Please provide an Image URL when linking to the Home Page.');
      return;
    }

    if (targetType !== 'All Users' && selectedCustomerIds.length === 0) {
      alert('Please select at least one customer.');
      return;
    }

    const targetCount = targetType === 'All Users'
      ? (platform === 'all' ? customers.length : platform === 'android' ? customers.filter(c => c.devices?.some(d => d.devicePlatform?.toLowerCase() === 'android')).length : customers.filter(c => c.devices?.some(d => d.devicePlatform?.toLowerCase() === 'ios')).length)
      : selectedCustomerIds.length;

    const isConfirmed = await confirm(
      `Are you sure you want to send this notification to ${targetType === 'All Users' ? 'all' : targetCount} user(s) on ${platform === 'all' ? 'all platforms' : platform}?`
    );
    if (!isConfirmed) return;

    setIsSending(true);
    try {
      const ids = targetType === 'All Users' ? ['all'] : selectedCustomerIds;
      let successCount = 0;
      let lastCampaignId = '';
      let errorMsgs = [];

      for (const id of ids) {
        try {
          const payload = {
            customerId: id,
            title: title.trim(),
            message: description.trim(),
            imageUrl: imageUrl.trim() || undefined,
            clickAction: clickAction,
            actionId: clickAction === 'home' ? (imageUrl.trim() || undefined) : (clickAction !== 'none' ? actionId : undefined),
            platform: platform !== 'all' ? platform : undefined
          };

          const response = await api.post('/admin/notify', payload);
          if (response.data?.success) {
            successCount++;
            lastCampaignId = response.data.campaignId;
          }
        } catch (err) {
          console.error(`Failed to send to customer ${id}:`, err);
          const errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
          errorMsgs.push(`Customer ID ${id}: ${errMsg}`);
        }
      }

      if (successCount > 0) {
        if (targetType === 'Selected Users') {
          alert(`Notifications sent successfully to ${successCount} of ${ids.length} customers!`);
        } else {
          alert(`Notification sent successfully! Campaign ID: ${lastCampaignId}`);
        }
        if (errorMsgs.length > 0) {
          alert(`Some errors occurred:\n${errorMsgs.join('\n')}`);
        }

        // Reset the form
        setTitle('');
        setDescription('');
        setImageUrl('');
        setTargetType('All Users');
        setSelectedCustomerIds([]);
        setCustomerSearchTerm('');
        setClickAction('none');
        setActionId('');
        setSearchTerm('');
        setPlatform('all');
        setIsActionDropdownOpen(false);

        // Instant refresh of campaign history stats
        fetchCampaignHistory();
        setCurrentHistoryPage(1);
      } else {
        const aggregatedError = errorMsgs.length > 0
          ? `Errors:\n${errorMsgs.join('\n')}`
          : 'Failed to send notification.';
        alert(aggregatedError);
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
      alert(error.response?.data?.message || error.response?.data?.error || 'Failed to send notification.');
    } finally {
      setIsSending(false);
    }
  };

  const handleReuse = (item) => {
    setTitle(item.title || '');
    setDescription(item.message || '');
    setImageUrl(item.imageUrl || '');

    const cAction = item.clickAction || 'none';
    setClickAction(cAction);

    setActionId(cAction === 'home' ? '' : (item.actionId || ''));

    if (item.customerId === 'all') {
      setTargetType('All Users');
      setSelectedCustomerIds([]);
    } else if (item.customerId) {
      const ids = item.customerId.split(',');
      setSelectedCustomerIds(ids);
      if (ids.length === 1) {
        setTargetType('Single User');
      } else {
        setTargetType('Selected Users');
      }
    }
    setCustomerSearchTerm('');
    setSearchTerm('');
    setPlatform(item.platform || 'all');
    setIsActionDropdownOpen(false);

    // Smooth scroll to top of compose form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clickActionOptions = [
    { value: 'none', label: 'No Action' },
    { value: 'home', label: 'Link to Home Page' },
    { value: 'category', label: 'Link to Category' },
    { value: 'product', label: 'Link to Specific Product' },
    { value: 'brand', label: 'Link to Brand' },
    { value: 'external', label: 'Link to External Website' }
  ];

  // Reset pagination when searching
  useEffect(() => {
    setCurrentHistoryPage(1);
  }, [historySearchQuery]);

  const filteredCampaigns = campaigns.filter(c => {
    if (!historySearchQuery) return true;
    const query = historySearchQuery.toLowerCase();
    return (
      (c.title || '').toLowerCase().includes(query) ||
      (c.message || '').toLowerCase().includes(query) ||
      (c.campaignId || '').toLowerCase().includes(query)
    );
  });

  // Calculate paginated campaigns
  const indexOfLastHistoryItem = currentHistoryPage * historyItemsPerPage;
  const indexOfFirstHistoryItem = indexOfLastHistoryItem - historyItemsPerPage;
  const currentHistoryCampaigns = filteredCampaigns.slice(indexOfFirstHistoryItem, indexOfLastHistoryItem);
  const totalHistoryPages = Math.ceil(filteredCampaigns.length / historyItemsPerPage);

  const getHistoryPaginationRange = () => {
    const range = [];
    const delta = 1;

    for (let i = 1; i <= totalHistoryPages; i++) {
      if (
        i === 1 ||
        i === totalHistoryPages ||
        (i >= currentHistoryPage - delta && i <= currentHistoryPage + delta)
      ) {
        range.push(i);
      } else if (range[range.length - 1] !== '...') {
        range.push('...');
      }
    }
    return range;
  };

  useEffect(() => {
    const fetchRecipientsForNotifications = async () => {
      const ids = [];
      currentHistoryCampaigns.forEach(item => {
        if (item.campaignId && recipientsMap[item.campaignId] === undefined && !ids.includes(item.campaignId)) {
          ids.push(item.campaignId);
        }
      });

      if (ids.length === 0) return;

      const token = sessionStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      try {
        const results = await Promise.all(
          ids.map(async (id) => {
            try {
              const res = await api.get(`/admin/campaign-stats/${id}`, { headers });
              return { id, recipients: res.data?.recipients || [] };
            } catch (e) {
              console.error(`Failed to fetch recipients for notification ${id}`, e);
              return { id, recipients: [] };
            }
          })
        );

        setRecipientsMap(prev => {
          const next = { ...prev };
          results.forEach(({ id, recipients }) => {
            next[id] = recipients;
          });
          return next;
        });
      } catch (err) {
        console.error('Error fetching campaign details in notifications:', err);
      }
    };

    if (currentHistoryCampaigns && currentHistoryCampaigns.length > 0) {
      fetchRecipientsForNotifications();
    }
  }, [currentHistoryCampaigns]);

  return (
    <div className="relative space-y-4 min-h-full z-0 w-full">
      {/* In-page Toast feedback */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-sm font-semibold transition-all backdrop-blur-md animate-in fade-in slide-in-from-top-2 ${
          toastMessage.type === 'error'
            ? 'bg-rose-600/95 text-white border-rose-500 shadow-rose-600/20'
            : 'bg-emerald-600/95 text-white border-emerald-500 shadow-emerald-600/20'
        }`}>
          {toastMessage.type === 'error' ? <FiAlertCircle className="text-base shrink-0" /> : <FiCheckCircle className="text-base shrink-0" />}
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

      {/* Header Section */}
      <PageHeader
        title="Notifications Management"
        icon={MdNotificationsActive}
        description="Monitor user in-app notifications, register push device tokens, and broadcast marketing campaigns."
      />

      {/* Main Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'inbox'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-500'
                : 'bg-white/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10'
            }`}
          >
            <FiInbox className="text-base" />
            <span>User In-App Notifications</span>
            {unreadInAppCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-xs">
                {unreadInAppCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('campaigns')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'campaigns'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-500'
                : 'bg-white/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10'
            }`}
          >
            <FiSend className="text-base" />
            <span>Push Broadcast Campaigns</span>
          </button>
        </div>

        {activeTab === 'inbox' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDeviceTokenError(null);
                setDeviceTokenSuccess(null);
                setIsDeviceTokenModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 transition-all cursor-pointer shadow-xs"
            >
              <FiSmartphone className="text-sm text-blue-500" />
              <span>Register Device Token</span>
            </button>
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={markingAllRead || inAppNotifications.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-500/30 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MdDoneAll className="text-sm" />
              <span>{markingAllRead ? 'Marking Read...' : 'Mark All as Read'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Tab 1: User In-App Notifications Content */}
      {activeTab === 'inbox' && (
        <div className="space-y-6">
          {/* KPI Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Notifications</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {inAppMeta?.total ?? inAppNotifications.length}
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">In-app activity feed</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                <FiInbox className="text-xl" />
              </div>
            </Card>

            <Card className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Unread</p>
                <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                  {unreadInAppCount}
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Pending user review</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
                <FiAlertCircle className="text-xl" />
              </div>
            </Card>

            <Card className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Read</p>
                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {readInAppCount}
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Marked as acknowledged</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <FiCheckCircle className="text-xl" />
              </div>
            </Card>

            <Card className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Device Push</p>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  Endpoint Ready
                </h3>
                <button
                  type="button"
                  onClick={() => setIsDeviceTokenModalOpen(true)}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline mt-1 cursor-pointer"
                >
                  Register Device Token &rarr;
                </button>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <MdDevices className="text-xl" />
              </div>
            </Card>
          </div>

          {/* Filter & Search Toolbar */}
          <Card className="p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 w-full md:w-auto bg-slate-100 dark:bg-black/30 p-1 rounded-xl border border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setInAppFilter('all')}
                  className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inAppFilter === 'all'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All ({inAppNotifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setInAppFilter('unread')}
                  className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inAppFilter === 'unread'
                      ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Unread ({unreadInAppCount})
                </button>
                <button
                  type="button"
                  onClick={() => setInAppFilter('read')}
                  className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inAppFilter === 'read'
                      ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Read ({readInAppCount})
                </button>
              </div>

              {/* Search Box and Refresh */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-72">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none" />
                  <input
                    type="text"
                    value={inAppSearch}
                    onChange={(e) => setInAppSearch(e.target.value)}
                    placeholder="Search title, message, type..."
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs font-medium transition-all"
                  />
                  {inAppSearch && (
                    <button
                      type="button"
                      onClick={() => setInAppSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer text-xs"
                    >
                      &times;
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fetchInAppNotifications(inAppPage, true)}
                  disabled={inAppRefreshing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 transition-all cursor-pointer disabled:opacity-50"
                  title="Refresh Notifications"
                >
                  <FiRefreshCw className={`text-sm ${inAppRefreshing ? 'animate-spin text-blue-600' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>
          </Card>

          {/* Notifications Feed */}
          <div className="space-y-3">
            {inAppError && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
                <div className="flex items-center gap-2">
                  <FiAlertCircle className="text-base shrink-0" />
                  <span>{inAppError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchInAppNotifications(inAppPage)}
                  className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {inAppLoading && !inAppRefreshing ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="p-4 animate-pulse">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-1/4"></div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-20"></div>
                    </div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-1/2"></div>
                  </Card>
                ))}
              </div>
            ) : filteredInAppNotifications.length === 0 ? (
              <Card className="p-12 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3">
                  <MdNotificationsNone className="text-3xl" />
                </div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {inAppSearch ? 'No matching notifications' : 'No in-app notifications'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                  {inAppSearch
                    ? `No notifications found matching "${inAppSearch}". Try clearing your filter or search keyword.`
                    : 'Your user in-app activity feed is completely up to date.'}
                </p>
                {inAppSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setInAppSearch('');
                      setInAppFilter('all');
                    }}
                    className="mt-4 px-3.5 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
              </Card>
            ) : (
              filteredInAppNotifications.map((item) => {
                const itemId = item._id || item.id;
                const isItemRead = Boolean(item.isRead || item.read);
                const isLoadingThis = actionLoadingId === itemId;

                return (
                  <div
                    key={itemId || Math.random()}
                    className={`p-4 rounded-2xl border transition-all duration-200 ${
                      isItemRead
                        ? 'bg-white/70 dark:bg-slate-900/60 border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                        : 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-500/30 border-l-4 border-l-blue-600 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/50 dark:border-white/5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Read/Unread Pulse Indicator */}
                        {!isItemRead ? (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                          </span>
                        ) : (
                          <FiCheckCircle className="text-xs text-emerald-500" />
                        )}

                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          item.type === 'ORDER'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            : item.type === 'PROMOTION'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300'
                              : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {item.type || 'SYSTEM'}
                        </span>

                        <h4 className={`text-sm font-bold ${isItemRead ? 'text-slate-800 dark:text-slate-200' : 'text-blue-950 dark:text-blue-100 font-extrabold'}`}>
                          {item.title || 'Untitled Notification'}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-slate-400 dark:text-slate-500 text-xs">
                        <FiClock className="text-xs" />
                        <span>{item.createdAt ? formatDateTimeDDMMYYYY(item.createdAt) : 'Recent'}</span>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed">
                      {item.message || item.body || item.description || 'No additional content provided.'}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-3 mt-3.5 pt-2 border-t border-slate-200/40 dark:border-white/5">
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {itemId && (
                          <span className="font-mono bg-slate-100 dark:bg-black/20 px-2 py-0.5 rounded-md">
                            ID: {String(itemId).slice(-8)}
                          </span>
                        )}
                        {item.customerId && (
                          <span className="font-medium">
                            Target: {item.customerId === 'all' ? 'All Users' : String(item.customerId).slice(-6)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!isItemRead && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(itemId, e)}
                            disabled={isLoadingThis}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            <FiCheck className={`text-xs ${isLoadingThis ? 'animate-spin' : ''}`} />
                            <span>{isLoadingThis ? 'Marking...' : 'Mark Read'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedNotification(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-white/10 cursor-pointer"
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

          {/* Pagination Controls */}
          {inAppMeta && inAppMeta.totalPages > 1 && (
            <Card className="p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Page <span className="font-bold text-slate-800 dark:text-white">{inAppMeta.page}</span> of{' '}
                <span className="font-bold text-slate-800 dark:text-white">{inAppMeta.totalPages}</span>{' '}
                ({inAppMeta.total} total items)
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fetchInAppNotifications(Math.max(1, inAppPage - 1))}
                  disabled={inAppPage <= 1 || inAppLoading}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
                >
                  &larr; Prev
                </button>

                {Array.from({ length: Math.min(5, inAppMeta.totalPages) }, (_, i) => {
                  let pNum = i + 1;
                  if (inAppMeta.totalPages > 5 && inAppPage > 3) {
                    pNum = inAppPage - 2 + i;
                    if (pNum > inAppMeta.totalPages) {
                      pNum = inAppMeta.totalPages - (4 - i);
                    }
                  }
                  if (pNum < 1) pNum = 1;

                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => fetchInAppNotifications(pNum)}
                      disabled={inAppLoading}
                      className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        pNum === inAppPage
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
                  onClick={() => fetchInAppNotifications(Math.min(inAppMeta.totalPages, inAppPage + 1))}
                  disabled={inAppPage >= inAppMeta.totalPages || inAppLoading}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
                >
                  Next &rarr;
                </button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab 2: Broadcast Campaigns Content */}
      {activeTab === 'campaigns' && (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Side: Compose Notification */}
        <Card className="xl:col-span-8 sm:p-8 h-fit !overflow-visible z-10">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <MdSend className="text-blue-600 dark:text-blue-400" /> Send Notification
          </h2>

          <form onSubmit={handleSendNotification} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification Title"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/40 shadow-inner backdrop-blur-md text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all text-sm font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Description</label>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notification message..."
                rows="2.5"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/40 shadow-inner backdrop-blur-md text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all text-sm font-medium resize-none"
              ></textarea>
            </div>

            {/* Platform Targeting */}
            <div className="md:col-span-1">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Target Platform</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPlatform('all')}
                  className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${platform === 'all'
                      ? 'bg-blue-50 border-blue-300 text-blue-700 ring-1 ring-blue-500/30 dark:bg-blue-600/30 dark:border-blue-500/50 dark:text-blue-300 dark:ring-blue-500/40'
                      : 'bg-slate-100 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <FiGlobe className="text-sm shrink-0" />
                  <span>All</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPlatform('android')}
                  className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${platform === 'android'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-1 ring-emerald-500/30 dark:bg-emerald-600/25 dark:border-emerald-500/50 dark:text-emerald-300 dark:ring-emerald-500/40'
                      : 'bg-slate-100 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <DiAndroid className='text-sm shrink-0' />
                  <span>Android</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPlatform('ios')}
                  className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${platform === 'ios'
                      ? 'bg-slate-900 border-slate-700 text-white ring-1 ring-slate-800 dark:bg-white dark:border-slate-400/50 dark:text-black dark:ring-slate-400/40'
                      : 'bg-slate-100 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <DiApple className="text-sm shrink-0" />
                  <span>iOS</span>
                </button>
              </div>
            </div>

            <div ref={audienceDropdownRef} className="md:col-span-1">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Select Target Audience</label>

              {/* Custom Select Trigger */}
              <div className="relative">
                <div
                  onClick={() => setIsAudienceDropdownOpen(!isAudienceDropdownOpen)}
                  className={`w-full px-3.5 py-2 bg-slate-50 dark:bg-black/20 border ${isAudienceDropdownOpen ? 'border-blue-500/50 bg-white dark:bg-black/40 ring-2 ring-blue-500/50' : 'border-slate-200 dark:border-white/10'} rounded-xl shadow-inner backdrop-blur-md text-slate-900 dark:text-white transition-all text-sm font-medium capitalize flex justify-between items-center cursor-pointer select-none`}
                >
                  <div className="flex items-center gap-2">
                    {getAudienceIcon(targetType)}
                    <span>{targetType}</span>
                  </div>
                  <MdKeyboardArrowDown className={`text-xl text-slate-400 transition-transform duration-300 ${isAudienceDropdownOpen ? 'rotate-180 text-blue-500 dark:text-blue-400' : ''}`} />
                </div>

                {/* Custom Select Options Dropdown */}
                {isAudienceDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl shadow-slate-200/50 dark:shadow-black/50 overflow-hidden z-2500 animate-in fade-in slide-in-from-top-2">
                    {['All Users', 'Single User', 'Selected Users'].map((type) => (
                      <div
                        key={type}
                        onClick={() => {
                          setTargetType(type);
                          setIsAudienceDropdownOpen(false);
                          setSelectedCustomerIds([]);
                          setCustomerSearchTerm('');
                          setIsCustomerDropdownOpen(false);
                        }}
                        className={`px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors flex items-center gap-2.5 ${targetType === type ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-500 font-semibold dark:bg-blue-600/35 dark:text-blue-200' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}
                      >
                        {getAudienceIcon(type)}
                        <span>{type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Target Customers selector inline */}
            {targetType !== 'All Users' && (
              <div ref={customerDropdownRef} className="md:col-span-2 relative">
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  {targetType === 'Single User' ? 'Select Customer' : 'Select Customers'}
                </label>

                {/* Selected Users Tags Area */}
                {selectedCustomerIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedCustomerIds.map(id => {
                      const cust = customers.find(c => c._id === id);
                      if (!cust) return null;
                      const hasAndroid = cust.devices?.some(d => d.devicePlatform?.toLowerCase() === 'android');
                      const hasIos = cust.devices?.some(d => d.devicePlatform?.toLowerCase() === 'ios');
                      return (
                        <span key={id} className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-600/30 dark:text-blue-400 dark:border-blue-500/20 text-xs font-semibold rounded-full gap-1 animate-in fade-in">
                          {cust.name || cust.email}
                          {hasAndroid && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold" title="Android Registered Device"><DiAndroid /></span>}
                          {hasIos && <span className="text-[9px] text-indigo-600 dark:text-indigo-300 font-bold" title="iOS Registered Device"><DiApple /></span>}
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerIds(prev => prev.filter(x => x !== id))}
                            className="hover:text-red-500 dark:hover:text-red-400 transition-colors text-sm font-bold focus:outline-none ml-1 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Search Select Input Box */}
                {(targetType === 'Selected Users' || selectedCustomerIds.length === 0) && (
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearchTerm}
                      onChange={(e) => {
                        setCustomerSearchTerm(e.target.value);
                        setIsCustomerDropdownOpen(true);
                      }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      placeholder={targetType === 'Single User' ? "Search customer name or email..." : "Search and add customers..."}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/40 shadow-inner backdrop-blur-md text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all text-sm font-medium"
                    />
                    {customerSearchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerSearchTerm('');
                          setIsCustomerDropdownOpen(false);
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}

                {/* Dropdown Menu */}
                {isCustomerDropdownOpen && (
                  <div className="absolute z-40 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-48">
                    <div className="overflow-y-auto max-h-44 custom-scrollbar">
                      {(() => {
                        const filtered = customers.filter(c => {
                          const matchesSearch = ((c.name || '').toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                            (c.email || '').toLowerCase().includes(customerSearchTerm.toLowerCase()));
                          const matchesNotSelected = !selectedCustomerIds.includes(c._id);
                          if (platform === 'android') {
                            return matchesSearch && matchesNotSelected && c.devices?.some(d => d.devicePlatform?.toLowerCase() === 'android');
                          }
                          if (platform === 'ios') {
                            return matchesSearch && matchesNotSelected && c.devices?.some(d => d.devicePlatform?.toLowerCase() === 'ios');
                          }
                          return matchesSearch && matchesNotSelected;
                        });

                        if (filtered.length === 0) {
                          return <div className="px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500 text-center">No matching customers found</div>;
                        }

                        return filtered.map(cust => (
                          <div
                            key={cust._id}
                            onClick={() => {
                              if (targetType === 'Single User') {
                                setSelectedCustomerIds([cust._id]);
                              } else {
                                setSelectedCustomerIds(prev => [...prev, cust._id]);
                              }
                              setCustomerSearchTerm('');
                              setIsCustomerDropdownOpen(false);
                            }}
                            className="px-3.5 py-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left flex justify-between items-center border-b border-slate-100 dark:border-white/5 last:border-b-0"
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-slate-900 dark:text-white block truncate">{cust.name || 'No Name'}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{cust.email || 'No Email'}</span>
                            </div>
                            <div className="flex gap-1 shrink-0 ml-2">
                              {cust.devices?.some(d => d.devicePlatform?.toLowerCase() === 'android') && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-green-50 text-green-700 border border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20 uppercase">Android</span>
                              )}
                              {cust.devices?.some(d => d.devicePlatform?.toLowerCase() === 'ios') && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-100 text-slate-800 border border-slate-200 dark:bg-white dark:text-black dark:border-slate-500/20 uppercase font-mono">iOS</span>
                              )}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Target users summary warning label */}
            <div className="md:col-span-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-lg px-3 py-1.5 select-none">
              <FiCheck className="text-emerald-600 dark:text-emerald-500 shrink-0" />
              <span>
                Targeting:{' '}
                <strong className="text-slate-800 dark:text-white">
                  {targetType === 'All Users' ? (
                    platform === 'all' ? customers.length :
                      platform === 'android' ? customers.filter(c => c.devices?.some(d => d.devicePlatform?.toLowerCase() === 'android')).length :
                        customers.filter(c => c.devices?.some(d => d.devicePlatform?.toLowerCase() === 'ios')).length
                  ) : selectedCustomerIds.length}
                </strong>{' '}
                {targetType === 'All Users'
                  ? `user(s) matching ${platform === 'all' ? 'All Platforms' : platform === 'android' ? 'Android' : 'iOS'}`
                  : `selected user(s)`
                }
              </span>
            </div>

            <div className="md:col-span-1">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Image URL (Optional)</label>
              <div className="relative">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.png"
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/40 shadow-inner backdrop-blur-md text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all text-sm font-medium"
                />
                <MdImage className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-base" />
              </div>
              {imageUrl.trim() && (
                <div className="mt-2.5 relative w-full max-w-xs h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center">
                  <img src={imageUrl.trim()} alt="Preview" className="max-w-full max-h-full object-contain" onError={(e) => e.target.src = 'https://placehold.co/300x150?text=Invalid+Image+URL'} />
                </div>
              )}
            </div>

            {/* Click Action Dropdown */}
            <div className="md:col-span-1">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Click Action (Optional)</label>
              <div className="relative">
                <CustomDropdown
                  value={clickAction}
                  onChange={(val) => {
                    setClickAction(val);
                    setActionId('');
                    setSearchTerm('');
                    setIsActionDropdownOpen(false);
                  }}
                  options={clickActionOptions}
                  statusColor="pl-9 py-2 text-slate-900 dark:text-white border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm font-medium rounded-xl shadow-inner backdrop-blur-md"
                />
                <FiLink className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none z-10" />
              </div>
            </div>

            {/* Click Action Dynamic Fields */}
            {clickAction !== 'none' && clickAction !== 'home' && (
              <div className="md:col-span-2 p-3 bg-slate-50/80 dark:bg-black/25 border border-slate-200/80 dark:border-white/5 rounded-xl animate-in slide-in-from-bottom-2">
                {clickAction === 'external' && (
                  <>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">External URL</label>
                    <input
                      type="url"
                      required
                      value={actionId}
                      onChange={(e) => setActionId(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/40 shadow-inner backdrop-blur-md text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all text-sm font-medium"
                      placeholder="https://..."
                    />
                  </>
                )}

                {clickAction === 'category' && (
                  <>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Select Category</label>
                    <div className="relative">
                      <CustomDropdown
                        value={actionId}
                        onChange={(val) => setActionId(val)}
                        options={[
                          { value: '', label: '-- Select Category --' },
                          ...categories.map(cat => ({ value: cat._id, label: cat.name }))
                        ]}
                        statusColor="pl-9 py-2 text-slate-900 dark:text-white border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 text-sm font-medium rounded-xl shadow-inner backdrop-blur-md"
                      />
                      <FiLayers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none z-10" />
                    </div>
                  </>
                )}

                {clickAction === 'brand' && (
                  <>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Select Brand</label>
                    <div className="relative">
                      <CustomDropdown
                        value={actionId}
                        onChange={(val) => setActionId(val)}
                        options={[
                          { value: '', label: '-- Select Brand --' },
                          ...brands.map(brand => ({ value: brand._id, label: brand.name }))
                        ]}
                        statusColor="pl-9 py-2 text-slate-900 dark:text-white border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 text-sm font-medium rounded-xl shadow-inner backdrop-blur-md"
                      />
                      <FiTrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none z-10" />
                    </div>
                  </>
                )}

                {clickAction === 'product' && (
                  <div className="relative space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Select Product</label>

                      {/* Dropdown Display Box */}
                      <div
                        onClick={() => setIsActionDropdownOpen(!isActionDropdownOpen)}
                        className="w-full px-3.5 py-2 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/50 cursor-pointer flex justify-between items-center shadow-inner backdrop-blur-md text-slate-900 dark:text-white transition-all text-sm font-medium"
                      >
                        <span className={actionId ? "text-slate-900 dark:text-white font-medium truncate" : "text-slate-400 dark:text-slate-500"}>
                          {actionId
                            ? (products.find(p => p._id === actionId)?.name || 'Select a Product')
                            : 'Select a Product'}
                        </span>
                        <span className="text-slate-400 text-xs">▼</span>
                      </div>

                      {/* Dropdown Menu */}
                      {isActionDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-52">
                          <div className="p-2 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50">
                            <input
                              type="text"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              placeholder="Type to search product..."
                              className="w-full px-3 py-1.5 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400 dark:placeholder-slate-500"
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          </div>

                          <div className="overflow-y-auto max-h-36 custom-scrollbar">
                            {products.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase())).length > 0 ? (
                              products
                                .filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(prod => (
                                   <div
                                     key={prod._id}
                                     onClick={() => {
                                       setActionId(prod._id);
                                       setIsActionDropdownOpen(false);
                                       setSearchTerm('');
                                       if (Array.isArray(prod.images) && prod.images.length > 0) {
                                         setImageUrl(prod.images[0]);
                                       }
                                     }}
                                     className={`px-3.5 py-1.5 text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-600/30 hover:text-blue-600 dark:hover:text-white transition-colors ${actionId === prod._id ? 'bg-blue-50 text-blue-600 dark:bg-blue-600/50 dark:text-white font-semibold' : 'text-slate-700 dark:text-slate-300'}`}
                                   >
                                     {prod.name}
                                   </div>
                                ))
                            ) : (
                              <div className="px-4 py-2 text-xs text-slate-400 dark:text-slate-500 text-center">No products found</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Display Product Images Selector */}
                    {actionId && (() => {
                      const selectedProduct = products.find(p => p._id === actionId);
                      if (!selectedProduct || !Array.isArray(selectedProduct.images) || selectedProduct.images.length === 0) return null;
                      return (
                        <div className="space-y-1.5 pt-1.5 border-t border-slate-200/80 dark:border-white/5">
                          <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Select Product Image</label>
                          <div className="flex flex-wrap gap-2">
                            {selectedProduct.images.map((img, idx) => {
                              const isSelected = imageUrl === img;
                              return (
                                <div
                                  key={idx}
                                  onClick={() => setImageUrl(img)}
                                  className={`w-12 h-12 rounded-lg overflow-hidden border cursor-pointer bg-white flex items-center justify-center p-0.5 transition-all hover:scale-105 ${isSelected ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/30'
                                    }`}
                                >
                                  <img src={img} alt={`Product ${idx}`} className="max-w-full max-h-full object-contain" />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            <div className="md:col-span-2 pt-2">
              <button
                type="submit"
                disabled={isSending}
                className="w-full text-white font-bold py-2.5 px-4 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-600/25 text-sm"
              >
                {isSending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Sending...</span>
                  </div>
                ) : (
                  <>
                    <MdSend /> Send Message
                  </>
                )}
              </button>
            </div>
          </form>
        </Card>

        {/* Right Side: Phone simulator container */}
        <Card className="xl:col-span-4 sm:p-8 h-fit flex flex-col items-center justify-start gap-4">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Live Preview</label>
          <div className="w-full max-w-[270px] aspect-[9/18.5] bg-gradient-to-b from-blue-900/60 via-slate-900 to-black border-[6px] border-slate-800 rounded-[36px] shadow-2xl relative overflow-hidden flex flex-col animate-in fade-in duration-300 select-none">
            {/* Notch / Dynamic Island */}
            {platform === 'ios' ? (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4.5 bg-black rounded-full z-30 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-slate-900 absolute right-3"></div>
              </div>
            ) : (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-black border border-slate-800 z-30"></div>
            )}

            {/* Status Bar */}
            <div className="absolute top-0 left-0 right-0 h-8 px-4 flex justify-between items-center text-[10px] text-white/95 z-20 font-semibold pt-1.5">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <span>📶</span>
                <span>🔋</span>
              </div>
            </div>

            {/* Wallpaper background content */}
            <div className="flex-1 p-3.5 pt-12 relative flex flex-col justify-start">
              {/* Lockscreen date/time info */}
              <div className="text-center text-white/80 mb-5 font-light">
                <div className="text-2xl font-normal">9:41</div>
                <div className="text-[10px]">Thursday, August 13</div>
              </div>

              {/* Push Notification Card */}
              <div className="bg-slate-900/80 backdrop-blur-lg border border-white/10 p-3.5 rounded-2xl shadow-xl space-y-1.5 transition-all duration-300 transform hover:scale-[1.02]">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-sm bg-blue-600 flex items-center justify-center text-[8px] text-white font-black overflow-hidden"><img src={appIconImg} alt="I" /></span>
                    <span>INIZIO</span>
                  </div>
                  <span>now</span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white leading-tight break-words">{title || 'Notification Title'}</h4>
                  <p className="text-[11px] text-slate-300 leading-snug break-words">{description || 'Notification message preview content...'}</p>
                </div>
                {imageUrl && (
                  <div className="mt-2 w-full h-auto rounded-lg overflow-hidden border border-white/5 bg-black/25 flex items-center justify-center">
                    <img src={imageUrl} alt="Notification preview" className="w-full h-full object-cover" onError={(e) => e.target.src = 'https://placehold.co/300x150?text=Invalid+Image+URL'} />
                  </div>
                )}
              </div>
            </div>

            {/* Home indicator bar */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/40 rounded-full"></div>
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center">Live Preview ({platform === 'all' ? 'All Platforms' : platform})</p>

          {/* Test Browser Notification Button */}
          {isBrowserNotificationSupported() && (
            <button
              type="button"
              onClick={async () => {
                const perm = await requestBrowserNotificationPermission();
                if (perm === 'granted') {
                  showBrowserNotification({
                    title: title || 'Inizio Preview Notification',
                    body: description || 'This is a live test preview of your browser push notification.',
                    path: '/notifications',
                    navigate
                  });
                }
              }}
              className="w-full max-w-[270px] py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98"
            >
              <MdNotificationsActive className="text-blue-600 dark:text-blue-400" size={15} />
              Test on this Browser
            </button>
          )}
        </Card>

        {/* Bottom Section: Notification History */}
        <Card className="xl:col-span-12 !p-0 overflow-hidden flex flex-col">
          {/* Table Header & Controls */}
          <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400">
                <MdHistory size={22} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  Notification History
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  View and manage previously sent push notification campaigns
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Search History Bar */}
              <div className="relative flex-1 sm:w-72">
                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <input
                  type="text"
                  placeholder="Search by title, message or ID..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-black/40 shadow-inner backdrop-blur-md text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs font-medium transition-all"
                />
                {historySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setHistorySearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <FiX size={14} />
                  </button>
                )}
              </div>

              <button
                onClick={fetchCampaignHistory}
                disabled={loadingHistory}
                className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl border border-slate-200 dark:border-white/10 transition-all disabled:opacity-50 cursor-pointer shrink-0"
                title="Refresh History"
              >
                <MdRefresh size={18} className={loadingHistory ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {errorHistory && (
            <div className="m-4 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 p-4 rounded-xl border border-rose-200 dark:border-rose-500/30 flex items-center">
              <FiAlertCircle className="mr-2 text-lg shrink-0" /> {errorHistory}
            </div>
          )}

          {/* Table Container */}
          <div className="overflow-x-auto custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[900px]">
              <thead className="sticky top-0 z-10 bg-slate-50/80 dark:bg-white/[0.03] backdrop-blur-md shadow-xs border-b border-slate-200/80 dark:border-white/10 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="p-4 font-bold text-center w-14">S.No</th>
                  <th className="p-4 font-bold">Campaign</th>
                  <th className="p-4 font-bold">Message & Date</th>
                  {/* <th className="p-4 font-bold text-center">Platform</th> */}
                  <th className="p-4 font-bold">Sent To</th>
                  {/* <th className="p-4 font-bold">Click Action</th> */}
                  <th className="p-4 font-bold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                {loadingHistory && campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6">
                      <TableRowSkeleton columns={7} rows={5} />
                    </td>
                  </tr>
                ) : campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                        <MdHistory className="text-4xl text-slate-400 dark:text-slate-500 mb-2" />
                        <p className="font-medium text-sm">No notification history found.</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                        <FiSearch className="text-4xl text-slate-400 dark:text-slate-500 mb-2" />
                        <p className="font-medium text-sm">No matching notifications found.</p>
                        <button
                          onClick={() => setHistorySearchQuery('')}
                          className="mt-3 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 dark:text-blue-400 font-bold rounded-lg border border-blue-200 dark:border-blue-500/30 text-xs transition-colors cursor-pointer"
                        >
                          Clear Search
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentHistoryCampaigns.map((item, index) => {
                    const rowNumber = indexOfFirstHistoryItem + index + 1;
                    const plat = (item.platform || 'all').toLowerCase();

                    return (
                      <tr
                        key={item.campaignId || index}
                        onClick={() => navigate(`/campaign-stats/${item.campaignId}`, { state: { from: '/notifications' } })}
                        className="hover:bg-slate-50/60 dark:hover:bg-white/[0.03] cursor-pointer transition-colors group"
                      >
                        {/* S.No */}
                        <td className="p-4 text-xs text-slate-500 dark:text-slate-400 text-center font-medium">
                          {rowNumber}
                        </td>

                        {/* Campaign (Thumbnail + Title + ID) */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt="Notification media"
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-white/10 shrink-0 bg-slate-100 dark:bg-slate-800"
                                onError={(e) => { e.target.src = 'https://placehold.co/40x40?text=Img'; }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-500/20 shrink-0">
                                <MdImage className="text-lg" />
                              </div>
                            )}
                            <div className="flex flex-col min-w-0 max-w-[220px]">
                              <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={item.title}>
                                {item.title}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tracking-wider truncate mt-0.5" title={item.campaignId}>
                                ID: {item.campaignId}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Message & Date */}
                        <td className="p-4 max-w-[280px]">
                          <p className="text-xs text-slate-700 dark:text-slate-300 truncate whitespace-normal line-clamp-2 leading-relaxed" title={item.message}>
                            {item.message}
                          </p>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-1">
                            {item.createdAt ? formatDateTimeDDMMYYYY(item.createdAt) : '-'}
                          </div>
                        </td>

                        {/* Sent To */}
                        <td className="p-4">
                          {(() => {
                            const recipients = recipientsMap[item.campaignId];
                            if (recipients === undefined) {
                              return (
                                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                                  <span className="w-2.5 h-2.5 border border-slate-400 dark:border-slate-500 border-t-transparent rounded-full animate-spin"></span>
                                  Loading...
                                </span>
                              );
                            }
                            if (recipients.length === 0) {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                                  <FiUsers className="text-blue-600 dark:text-blue-400" size={12} /> All Users
                                </span>
                              );
                            }
                            const names = recipients.map(r => r.user?.name || r.user?.email || r.user?.phone || 'N/A');
                            const limit = 2;
                            const displayedNames = names.slice(0, limit);
                            const remaining = names.length - limit;

                            return (
                              <div className="flex flex-wrap gap-1 items-center max-w-[200px]">
                                {displayedNames.map((name, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded text-blue-700 dark:text-blue-300 font-medium text-[11px] truncate max-w-[110px]"
                                    title={name}
                                  >
                                    {name}
                                  </span>
                                ))}
                                {remaining > 0 && (
                                  <span
                                    className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 rounded text-blue-800 dark:text-blue-400 font-bold text-[10px]"
                                    title={names.slice(limit).join(', ')}
                                  >
                                    +{remaining}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleReuse(item)}
                              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white dark:bg-blue-600/15 dark:hover:bg-blue-600 dark:text-blue-400 dark:hover:text-white rounded-lg border border-blue-200 dark:border-blue-500/20 transition-all text-xs font-semibold cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
                              title="Reuse Notification Content"
                            >
                              <FiCopy size={12} />
                              <span className="hidden sm:inline">Reuse</span>
                            </button>
                            <button
                              onClick={() => navigate(`/campaign-stats/${item.campaignId}`, { state: { from: '/notifications' } })}
                              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 dark:hover:text-white rounded-lg border border-slate-200 dark:border-white/10 transition-all text-xs font-semibold cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
                              title="View Campaign Statistics"
                            >
                              <FiBarChart2 size={12} className="text-indigo-500 dark:text-indigo-400" />
                              <span className="hidden sm:inline">Stats</span>
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

          {/* Pagination Controls */}
          {!loadingHistory && filteredCampaigns.length > 0 && (
            <div className="p-4 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/80 dark:bg-white/[0.02] backdrop-blur-md">
              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left">
                Showing <span className="font-bold text-slate-900 dark:text-white">{indexOfFirstHistoryItem + 1}</span> to <span className="font-bold text-slate-900 dark:text-white">{Math.min(indexOfLastHistoryItem, filteredCampaigns.length)}</span> of <span className="font-bold text-slate-900 dark:text-white">{filteredCampaigns.length}</span> notifications
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentHistoryPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentHistoryPage === 1}
                  className="px-3 sm:px-4 py-2 bg-white hover:bg-slate-100 dark:bg-slate-950/20 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs sm:text-sm font-bold border border-slate-200 dark:border-white/10 transform-gpu cursor-pointer shadow-xs"
                >
                  &larr;
                </button>
                <div className="flex gap-1 mx-1 sm:mx-2 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 items-center">
                  {(() => {
                    const pageNumbers = [];
                    if (totalHistoryPages <= 7) {
                      for (let i = 1; i <= totalHistoryPages; i++) pageNumbers.push(i);
                    } else {
                      if (currentHistoryPage <= 4) {
                        for (let i = 1; i <= 5; i++) pageNumbers.push(i);
                        pageNumbers.push('...');
                        pageNumbers.push(totalHistoryPages);
                      } else if (currentHistoryPage >= totalHistoryPages - 3) {
                        pageNumbers.push(1);
                        pageNumbers.push('...');
                        for (let i = totalHistoryPages - 4; i <= totalHistoryPages; i++) pageNumbers.push(i);
                      } else {
                        pageNumbers.push(1);
                        pageNumbers.push('...');
                        for (let i = currentHistoryPage - 1; i <= currentHistoryPage + 1; i++) pageNumbers.push(i);
                        pageNumbers.push('...');
                        pageNumbers.push(totalHistoryPages);
                      }
                    }
                    return pageNumbers.map((page, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          if (page !== '...') setCurrentHistoryPage(page);
                        }}
                        disabled={page === '...'}
                        className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-lg text-xs sm:text-sm font-medium border transition-colors shrink-0 transform-gpu ${
                          page === currentHistoryPage
                            ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                            : page === '...'
                            ? 'bg-transparent text-slate-400 dark:text-slate-500 border-transparent cursor-default'
                            : 'bg-white hover:bg-slate-100 dark:bg-slate-950/20 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer shadow-xs'
                        }`}
                      >
                        {page}
                      </button>
                    ));
                  })()}
                </div>
                <button
                  onClick={() => setCurrentHistoryPage(prev => Math.min(prev + 1, totalHistoryPages))}
                  disabled={currentHistoryPage === totalHistoryPages || totalHistoryPages === 0}
                  className="px-3 sm:px-4 py-2 bg-white hover:bg-slate-100 dark:bg-slate-950/20 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs sm:text-sm font-bold border border-slate-200 dark:border-white/10 transform-gpu cursor-pointer shadow-xs"
                >
                  &rarr;
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
      )}

      {/* Device Token Registration Modal */}
      {isDeviceTokenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FiSmartphone className="text-lg" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Register Device Token</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">POST /notifications/device-token</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeviceTokenModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <FiX className="text-base" />
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

            <form onSubmit={handleRegisterDeviceToken} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Device Type
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
                    onClick={handleFillSampleToken}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Fill Sample
                  </button>
                </div>
                <textarea
                  required
                  rows={3}
                  value={deviceTokenForm.fcmToken}
                  onChange={(e) => setDeviceTokenForm((prev) => ({ ...prev, fcmToken: e.target.value }))}
                  placeholder="e.g. fcm_d1e2v3i4c5e_t6o7k8e9n..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs font-mono resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeviceTokenModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deviceTokenSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/25 cursor-pointer disabled:opacity-50"
                >
                  {deviceTokenSubmitting ? 'Registering...' : 'Register Device Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notification Details Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FiInbox className="text-lg" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Notification Details</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedNotification._id || selectedNotification.id || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <FiX className="text-base" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-black/20 rounded-xl">
                <span className="font-bold text-slate-500 uppercase text-[10px]">Status:</span>
                <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                  (selectedNotification.isRead || selectedNotification.read)
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                }`}>
                  {(selectedNotification.isRead || selectedNotification.read) ? 'Read' : 'Unread'}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-black/20 rounded-xl space-y-1">
                <span className="font-bold text-slate-500 uppercase text-[10px]">Title:</span>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedNotification.title || 'Untitled'}
                </p>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-black/20 rounded-xl space-y-1">
                <span className="font-bold text-slate-500 uppercase text-[10px]">Message:</span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedNotification.message || selectedNotification.body || selectedNotification.description || 'No content'}
                </p>
              </div>

              {selectedNotification.createdAt && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-black/20 rounded-xl">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Timestamp:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {formatDateTimeDDMMYYYY(selectedNotification.createdAt)}
                  </span>
                </div>
              )}

              {selectedNotification.data && (
                <div className="p-2.5 bg-slate-50 dark:bg-black/20 rounded-xl space-y-1">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Raw Payload:</span>
                  <pre className="p-2 bg-black/10 dark:bg-black/40 rounded-lg text-[11px] font-mono overflow-x-auto text-slate-800 dark:text-slate-200">
                    {JSON.stringify(selectedNotification.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-white/10">
              {!(selectedNotification.isRead || selectedNotification.read) && (
                <button
                  type="button"
                  onClick={() => handleMarkAsRead(selectedNotification._id || selectedNotification.id)}
                  disabled={actionLoadingId === (selectedNotification._id || selectedNotification.id)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/25 cursor-pointer disabled:opacity-50"
                >
                  {actionLoadingId === (selectedNotification._id || selectedNotification.id) ? 'Marking Read...' : 'Mark as Read'}
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
    </div>
  );
};

export default Notifications;