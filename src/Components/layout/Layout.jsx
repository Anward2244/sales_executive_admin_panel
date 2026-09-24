import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/Context/AuthContext';
import { useTheme } from '@/Context/ThemeContext';
import {
  FiLogOut, FiMenu, FiX, FiUser,
  FiBell, FiBellOff, FiChevronDown, FiChevronRight,
  FiMessageSquare, FiPackage, FiUserPlus, FiClock, FiAlertTriangle, FiFileText,
  FiCheckCircle, FiVolume2, FiShield, FiArrowUp, FiSettings, FiSun, FiMoon
} from 'react-icons/fi';
import { getAccessibleMenus } from '@/config/menus';
import HeaderSearch from './HeaderSearch';
import InternetStrengthIndicator from './InternetStrengthIndicator';
import auricLightLogo from '@/assets/auric_light.png';
import auricDarkLogo from '@/assets/auric_dark.png';
import {
  api,
  BASE_URL,
  getNotificationsApi,
  markNotificationAsReadApi,
  markAllNotificationsAsReadApi
} from '@/api/axios';
import { isRouteAllowed } from '@/utils/rbac';
import {
  isBrowserNotificationSupported,
  getNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  playNotificationSound,
  getNotificationSettings,
  saveNotificationSettings,
  isBrowserAlertsEnabled,
  isToastAlertsEnabled,
  getPollingInterval
} from '@/utils/browserNotifications';
import { useDisplayPreferences } from '@/utils/displayPreferences';

const Layout = () => {
  const { user, logout, userPermissions } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const { preferences: displayPrefs } = useDisplayPreferences();
  const auricLogo = isDark ? auricDarkLogo : auricLightLogo;
  const location = useLocation();
  const mainRef = useRef(null);
  const [pollingConfigVersion, setPollingConfigVersion] = useState(0);

  useEffect(() => {
    const handleSettingsChange = () => {
      setPollingConfigVersion(v => v + 1);
    };
    window.addEventListener('inizio:notification-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('inizio:notification-settings-changed', handleSettingsChange);
  }, []);

  const isChatRoute = location.pathname.startsWith('/chat');
  const [showScrollTop, setShowScrollTop] = useState(false);

  const checkScrollState = () => {
    if (!displayPrefs.autoScrollToTop || isChatRoute) {
      if (showScrollTop) setShowScrollTop(false);
      return;
    }

    const mainTop = mainRef.current ? mainRef.current.scrollTop : 0;
    const winTop = window.pageYOffset || document.documentElement?.scrollTop || document.body?.scrollTop || 0;
    let anyContainerTop = 0;

    // Only inspect scrollable containers within the main content area (excluding the sidebar menu)
    if (mainRef.current) {
      const scrollables = mainRef.current.querySelectorAll('.overflow-y-auto, .overflow-auto, .custom-scrollbar');
      scrollables.forEach(el => {
        if (el && el.scrollTop > anyContainerTop) {
          anyContainerTop = el.scrollTop;
        }
      });
    }

    const currentScroll = Math.max(mainTop, winTop, anyContainerTop);
    setShowScrollTop(currentScroll > 40);
  };

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    setShowScrollTop(false);
  }, [location.pathname]);

  useEffect(() => {
    checkScrollState();
  }, [displayPrefs.autoScrollToTop]);

  useEffect(() => {
    const handleEvents = (e) => {
      // Ignore scroll/wheel/touch events originating inside the sidebar menu
      if (e && e.target && e.target.closest && e.target.closest('aside')) {
        return;
      }
      checkScrollState();
    };

    window.addEventListener('scroll', handleEvents, { capture: true, passive: true });
    window.addEventListener('wheel', handleEvents, { capture: true, passive: true });
    window.addEventListener('touchmove', handleEvents, { capture: true, passive: true });

    const mainEl = mainRef.current;
    if (mainEl) {
      mainEl.addEventListener('scroll', handleEvents, { passive: true });
    }

    // Safety polling every 300ms to guarantee detection in all browser environments
    const intervalId = setInterval(checkScrollState, 300);

    return () => {
      window.removeEventListener('scroll', handleEvents, { capture: true });
      window.removeEventListener('wheel', handleEvents, { capture: true });
      window.removeEventListener('touchmove', handleEvents, { capture: true });
      if (mainEl) {
        mainEl.removeEventListener('scroll', handleEvents);
      }
      clearInterval(intervalId);
    };
  }, [location.pathname, displayPrefs.autoScrollToTop]);

  const scrollToTop = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      const scrollables = mainRef.current.querySelectorAll('.overflow-y-auto, .overflow-auto, .custom-scrollbar');
      scrollables.forEach(el => {
        if (el && el.scrollTop > 0) {
          el.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (document.documentElement) {
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (document.body) {
      document.body.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [openMenus, setOpenMenus] = useState({});
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isNotificationsDropdownOpen, setIsNotificationsDropdownOpen] = useState(false);
  const notificationsDropdownRef = useRef(null);
  const mobileNotificationsDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const mobileProfileDropdownRef = useRef(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [ordersUnreadCount, setOrdersUnreadCount] = useState(0);
  const [usersUnreadCount, setUsersUnreadCount] = useState(0);
  const [usersVerifyUnreadCount, setUsersVerifyUnreadCount] = useState(0);
  const [usersDeletionUnreadCount, setUsersDeletionUnreadCount] = useState(0);
  const [brokenImagesUnreadCount, setBrokenImagesUnreadCount] = useState(0);
  const [inAppNotifications, setInAppNotifications] = useState([]);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);
  const prevNotificationsRef = useRef(null);
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const [browserPermission, setBrowserPermission] = useState(() => getNotificationPermission());
  const [browserAlertsEnabled, setBrowserAlertsEnabled] = useState(() => isBrowserAlertsEnabled());
  const navigation = useNavigate();

  // Listen for native browser permission changes, window focus, and in-app settings changes
  useEffect(() => {
    const updatePerm = () => {
      setBrowserPermission(getNotificationPermission());
      setBrowserAlertsEnabled(isBrowserAlertsEnabled());
    };

    updatePerm();
    window.addEventListener('focus', updatePerm);

    const onSettingsChange = (e) => {
      if (e?.detail) {
        setBrowserAlertsEnabled(e.detail.browserAlertsEnabled !== false);
      } else {
        setBrowserAlertsEnabled(isBrowserAlertsEnabled());
      }
    };
    window.addEventListener('inizio:notification-settings-changed', onSettingsChange);

    let permStatus = null;
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'notifications' })
        .then(status => {
          permStatus = status;
          status.onchange = () => {
            setBrowserPermission(status.state || getNotificationPermission());
          };
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('focus', updatePerm);
      window.removeEventListener('inizio:notification-settings-changed', onSettingsChange);
      if (permStatus) permStatus.onchange = null;
    };
  }, []);

  // Also sync permission whenever the notifications dropdown is opened
  useEffect(() => {
    if (isNotificationsDropdownOpen) {
      setBrowserPermission(getNotificationPermission());
      setBrowserAlertsEnabled(isBrowserAlertsEnabled());
    }
  }, [isNotificationsDropdownOpen]);

  const prevOrdersRef = useRef(null);
  const prevUsersRef = useRef(null);
  const prevPendingRef = useRef(null);
  const prevDeletionRef = useRef(null);
  const prevBrokenImagesRef = useRef(null);
  const isInitialDataLoad = useRef(true);
  const [toasts, setToasts] = useState([]);
  const [failedImageProductNames, setFailedImageProductNames] = useState([]);
  const prevFailedImagesRef = useRef(new Set());
  const recentToastsRef = useRef(new Map());

  const addToast = (title, message, path, IconComponent = FiBell, tag, category) => {
    if (!isToastAlertsEnabled(category)) {
      return;
    }
    const key = `${title}:${message}`;
    const now = Date.now();
    // Prevent identical toast from being triggered within 4 seconds
    if (recentToastsRef.current.has(key) && (now - recentToastsRef.current.get(key) < 4000)) {
      return;
    }
    recentToastsRef.current.set(key, now);

    const id = now + Math.random().toString(36).substring(2, 9);
    setToasts(prev => {
      if (prev.some(t => t.title === title && t.message === message)) {
        return prev;
      }
      return [...prev, { id, title, message, path, IconComponent }];
    });

    // If the window/tab is in the background or hidden, trigger native Chrome/OS notification.
    if (document.hidden || !document.hasFocus()) {
      showBrowserNotification({
        title,
        body: message,
        path,
        tag: tag || `inizio-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        category,
        navigate: navigation
      });
    } else {
      playNotificationSound();
    }

    const duration = getNotificationSettings().toastDuration || 6000;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  const handleRequestBrowserPermission = async () => {
    try {
      const res = await requestBrowserNotificationPermission();
      const current = getNotificationPermission();
      const finalPerm = (res === 'granted' || current === 'granted') ? 'granted' : (res || current);
      setBrowserPermission(finalPerm);
      setShowPermissionBanner(false);

      if (finalPerm === 'granted') {
        saveNotificationSettings({ browserAlertsEnabled: true });
        setBrowserAlertsEnabled(true);
        handleTestBrowserNotification();
      }
    } catch (err) {
      console.error('Error requesting browser notification permission:', err);
      setBrowserPermission(getNotificationPermission());
    }
  };

  const handleTurnOffBrowserAlerts = (e) => {
    e?.stopPropagation?.();
    saveNotificationSettings({ browserAlertsEnabled: false });
    setBrowserAlertsEnabled(false);
  };

  const handleTestBrowserNotification = () => {
    showBrowserNotification({
      title: 'Auric Admin Test Alert',
      body: 'Browser notifications are working perfectly! You will receive live alerts for system notifications and updates.',
      path: '/notifications',
      tag: `test-alert-${Date.now()}`,
      navigate: navigation
    });
  };

  const handleNotificationClick = (path, id) => {
    setIsNotificationsDropdownOpen(false);
    dismissNotification(id);
    navigation(path);
  };

  const dismissNotification = (id) => {
    if (id === 'chat') setChatUnreadCount(0);
    if (id === 'orders') setOrdersUnreadCount(0);
    if (id === 'verify') setUsersVerifyUnreadCount(0);
    if (id === 'deletion') setUsersDeletionUnreadCount(0);
    if (id === 'users') setUsersUnreadCount(0);
    if (id === 'broken-images') setBrokenImagesUnreadCount(0);
    if (id === 'image-errors') setFailedImageProductNames([]);
    if (typeof id === 'string' && id.startsWith('inapp-')) {
      const rawId = id.replace('inapp-', '');
      markNotificationAsReadApi(rawId).catch(() => {});
      setNotificationsUnreadCount(prev => Math.max(0, prev - 1));
      setInAppNotifications(prev => prev.map(n => ((n._id === rawId || n.id === rawId) ? { ...n, isRead: true } : n)));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }
  };

  const clearAllNotifications = () => {
    setChatUnreadCount(0);
    setOrdersUnreadCount(0);
    setUsersVerifyUnreadCount(0);
    setUsersDeletionUnreadCount(0);
    setUsersUnreadCount(0);
    setBrokenImagesUnreadCount(0);
    setFailedImageProductNames([]);
    markAllNotificationsAsReadApi().catch(() => {});
    setNotificationsUnreadCount(0);
    setInAppNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    window.dispatchEvent(new CustomEvent('notifications-updated'));
  };

  const toggleSubMenu = (menuName) => {
    setOpenMenus(prev => {
      if (prev[menuName]) return {}; // Close if it's already open
      return { [menuName]: true }; // Open this menu, implicitly closing others
    });
  };

  // Close mobile menu automatically when a route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileDropdownOpen(false);
    setIsNotificationsDropdownOpen(false);
  }, [location.pathname]);

  // URL Protection Check
  useEffect(() => {
    if (user) {
      if (user.role !== 'admin' && userPermissions.length === 0) return;
      const currentAccessibleMenus = getAccessibleMenus(userPermissions, user.role);
      const allowed = isRouteAllowed(location.pathname, currentAccessibleMenus, user.role);
      if (!allowed) {
        console.warn(`Access denied to path: ${location.pathname}. Redirecting to dashboard.`);
        navigation('/', { replace: true });
      }
    }
  }, [location.pathname, userPermissions, user]);

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        notificationsDropdownRef.current &&
        !notificationsDropdownRef.current.contains(event.target) &&
        (!mobileNotificationsDropdownRef.current || !mobileNotificationsDropdownRef.current.contains(event.target))
      ) {
        setIsNotificationsDropdownOpen(false);
      }
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target) &&
        (!mobileProfileDropdownRef.current || !mobileProfileDropdownRef.current.contains(event.target))
      ) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const getNotificationsList = () => {
    const list = [];
    if (chatUnreadCount > 0) {
      list.push({
        id: 'chat',
        title: 'New Chat Messages',
        description: `You have ${chatUnreadCount} unread message${chatUnreadCount > 1 ? 's' : ''} from customers.`,
        path: '/chat',
        icon: <FiMessageSquare />,
        color: 'text-blue-400 bg-blue-500/10'
      });
    }
    if (usersUnreadCount > 0) {
      list.push({
        id: 'users',
        title: 'New User Registrations',
        description: `${usersUnreadCount} new user${usersUnreadCount > 1 ? 's' : ''} registered recently.`,
        path: '/users',
        icon: <FiUserPlus />,
        color: 'text-indigo-400 bg-indigo-500/10'
      });
    }

    // In-app notifications from API (GET /notifications)
    inAppNotifications
      .filter((n) => !n.isRead)
      .slice(0, 5)
      .forEach((item) => {
        const isPO =
          (item.type || '').toUpperCase().includes('PO') ||
          (item.relatedEntityType || '').toUpperCase() === 'PURCHASEORDER';
        list.unshift({
          id: `inapp-${item._id || item.id}`,
          title: item.title || 'Notification',
          description: item.message || 'New system update.',
          path: isPO ? '/purchase-orders' : '/notifications',
          icon: isPO ? <FiPackage /> : <FiBell />,
          color: isPO ? 'text-cyan-400 bg-cyan-500/10' : 'text-blue-400 bg-blue-500/10'
        });
      });

    return list;
  };

  const notificationsList = getNotificationsList();
  const totalUnreadCount =
    chatUnreadCount +
    usersUnreadCount +
    notificationsUnreadCount;

  // Request Browser Notification Permission on load / show banner
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      setShowPermissionBanner(true);
    }
  }, []);

  const requestNotificationPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('Notification permission granted.');
          // Show test notification via service worker
          if (navigator.serviceWorker && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then(registration => {
              registration.showNotification('Auric Notifications', {
                body: 'Mobile alerts are now active!',
                icon: auricLogo,
                vibrate: [100, 50, 100]
              });
            });
          }
        }
        setShowPermissionBanner(false);
      });
    }
  };

  // Poll in-app notifications (GET /notifications)
  useEffect(() => {
    let isMounted = true;

    const fetchNotifications = async () => {
      if (!user) return;
      try {
        const response = await getNotificationsApi({ page: 1, limit: 20 });
        const resData = response.data || {};
        const list = Array.isArray(resData.data)
          ? resData.data
          : Array.isArray(resData)
            ? resData
            : Array.isArray(resData.notifications)
              ? resData.notifications
              : [];

        if (!isMounted) return;

        const unreadList = list.filter((n) => !n.isRead);
        const unreadCount = unreadList.length;

        // Trigger in-app toast for new incoming notifications
        if (prevNotificationsRef.current !== null && !isInitialDataLoad.current) {
          const prevIds = new Set(prevNotificationsRef.current.map((n) => n._id || n.id));
          const newItems = unreadList.filter((n) => !prevIds.has(n._id || n.id));

          if (newItems.length > 0) {
            newItems.forEach((item) => {
              const isPO =
                (item.type || '').toUpperCase().includes('PO') ||
                (item.relatedEntityType || '').toUpperCase() === 'PURCHASEORDER';
              addToast(
                item.title || 'New Notification',
                item.message || 'You received a new notification.',
                isPO ? '/purchase-orders' : '/notifications',
                isPO ? FiPackage : FiBell,
                `notif-${item._id || item.id}`,
                'notifications'
              );
            });
          }
        }

        prevNotificationsRef.current = list;
        setInAppNotifications(list);
        setNotificationsUnreadCount(unreadCount);
      } catch (err) {
        console.error('Failed to poll notifications in Layout:', err);
      }
    };

    fetchNotifications();
    const interval = getPollingInterval('notifications', 15);
    const intervalId = setInterval(fetchNotifications, interval);

    const onNotifsUpdated = () => {
      fetchNotifications();
    };
    window.addEventListener('notifications-updated', onNotifsUpdated);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('notifications-updated', onNotifsUpdated);
    };
  }, [user, pollingConfigVersion]);

  // Clear counts when visiting the page
  useEffect(() => {
    if (location.pathname === '/users' || location.pathname === '/users/list') {
      setUsersUnreadCount(0);
    }
  }, [location.pathname]);

  // Update browser tab title with total unread notification counts
  useEffect(() => {
    const totalNotifications = chatUnreadCount + usersUnreadCount + notificationsUnreadCount;
    if (totalNotifications > 0) {
      document.title = `(${totalNotifications}) Auric`;
    } else {
      document.title = 'Auric';
    }
  }, [chatUnreadCount, usersUnreadCount, notificationsUnreadCount]);

  // Global event listener for image load failures
  useEffect(() => {
    const handleImageErrorEvent = (e) => {
      const productName = e.detail.name || 'Product';
      setFailedImageProductNames(prev => {
        if (prev.includes(productName)) return prev;
        return [...prev, productName];
      });
      addToast(
        "Image Load Failed",
        `Failed to load product image for: ${productName}. Please check WordPress library access.`,
        "/products/list",
        FiAlertTriangle
      );
    };
    window.addEventListener('product-image-error', handleImageErrorEvent);
    return () => window.removeEventListener('product-image-error', handleImageErrorEvent);
  }, []);

  // Helper to format image URLs
  const formatImageUrl = (path) => {
    if (!path || typeof path !== 'string') return '';
    if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('//')) return path;
    const cleanPath = path.replace(/\\/g, '/');
    return `${BASE_URL}${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
  };

  const getBadgeCount = (path) => {
    if (path === '/chat') return chatUnreadCount;
    if (path === '/users') return usersUnreadCount;
    if (path === '/notifications') return notificationsUnreadCount;
    return 0;
  };

  const userMenus = getAccessibleMenus(userPermissions, user?.role);
  const isExpanded = isHovered || isMobileMenuOpen;

  return (
    <div className={`flex h-full w-full font-sans overflow-hidden relative z-0 transition-colors duration-300 ${
      isDark 
        ? 'panel-bg-dark text-slate-300' 
        : 'panel-bg-light text-slate-700'
    }`}>

      {/* Global Ambient Glows */}
      {displayPrefs.ambientGlow && (
        isDark ? (
          <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
            <div className="absolute top-10 left-10 w-80 h-80 bg-blue-500/30 rounded-full mix-blend-screen filter blur-[80px] opacity-60 transform-gpu animate-glow"></div>
            <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500/20 rounded-full mix-blend-screen filter blur-[100px] opacity-70 transform-gpu animate-glow-alt" style={{ animationDelay: '-12s' }}></div>
          </div>
        ) : (
          <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
            {/* Blue glowing moving blobs for Light Mode */}
            <div className="absolute -top-12 -left-12 w-[420px] h-[420px] bg-gradient-to-br from-blue-400/40 to-sky-400/35 rounded-full filter blur-[75px] opacity-80 transform-gpu animate-glow"></div>
            {/* <div className="absolute bottom-0 right-0 w-[480px] h-[480px] bg-gradient-to-tl from-blue-500/35 to-indigo-400/30 rounded-full filter blur-[95px] opacity-85 transform-gpu animate-glow-alt" style={{ animationDelay: '-12s' }}></div> */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[380px] h-[380px] bg-gradient-to-tr from-sky-400/30 to-blue-500/25 rounded-full filter blur-[85px] opacity-75 transform-gpu animate-glow" style={{ animationDelay: '-25s' }}></div>
          </div>
        )
      )}

      {/* Toast Notification Stack Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 w-80 max-w-[90%] pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => {
              navigation(t.path);
              setToasts(prev => prev.filter(item => item.id !== t.id));
            }}
            className={`flex items-start justify-between gap-4.5 p-4 border border-l-4 rounded-xl cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 animate-in slide-in-from-right-full fade-in text-left group pointer-events-auto select-none ${
              isDark 
                ? 'bg-slate-900 border-white/10 hover:bg-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.8)]' 
                : 'bg-white/40 backdrop-blur-md border-slate-200 hover:bg-white shadow-xl shadow-slate-900/10'
            } ${t.path.startsWith('/chat') ? 'border-l-blue-500 shadow-blue-500/10' :
                t.path.startsWith('/orders') ? 'border-l-emerald-500 shadow-emerald-500/10' :
                  (t.path === '/users/list' || t.path.includes('tab=approved')) ? 'border-l-indigo-500 shadow-indigo-500/10' :
                    t.path.includes('tab=pending') ? 'border-l-amber-500 shadow-amber-500/10' :
                      t.path.includes('tab=deleted') ? 'border-l-rose-500 shadow-rose-500/10' :
                        'border-l-blue-500 shadow-blue-500/10'
              }`}
          >
            <div className={`p-1 rounded-xl shrink-0 group-hover:scale-110 transition-transform ${
              isDark ? 'bg-white/5' : 'bg-slate-100'
            } ${t.path.startsWith('/chat') ? 'text-blue-500' :
                t.path.startsWith('/orders') ? 'text-emerald-500' :
                  (t.path === '/users/list' || t.path.includes('tab=approved')) ? 'text-indigo-500' :
                    t.path.includes('tab=pending') ? 'text-amber-500' :
                      t.path.includes('tab=deleted') ? 'text-rose-500' :
                        'text-blue-500'
              }`}>
              <t.IconComponent size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold tracking-wide ${isDark ? 'text-white' : 'text-slate-800'}`}>{t.title}</p>
              <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t.message}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setToasts(prev => prev.filter(item => item.id !== t.id));
              }}
              className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FiX size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Notification Permission Request Banner */}
      {showPermissionBanner && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-100 animate-in fade-in slide-in-from-top-4 w-[90%] max-w-md">
          <div className="bg-slate-900 border border-white/10 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 backdrop-blur-xl">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 shrink-0">
                <FiBell className="text-lg animate-bounce" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Enable Push Notifications</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Stay updated with instant message alerts on mobile.</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={requestNotificationPermission}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
              >
                Enable
              </button>
              <button
                onClick={() => setShowPermissionBanner(false)}
                className="px-2 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE TOP BAR (Visible only on small screens) */}
      <div className={`lg:hidden fixed top-0 left-0 right-0 h-16 backdrop-blur-2xl border-b z-40 flex items-center justify-between px-4 transition-colors ${
        isDark 
          ? 'bg-slate-950/80 border-white/10 shadow-xl shadow-black/50' 
          : 'bg-white/85 border-slate-200/80 shadow-md shadow-slate-900/5'
      }`}>
        <img src={auricLogo} alt="Auric Logo" className="h-12 w-auto object-contain" />
        <div className="flex items-center gap-3">
          {/* Mobile Internet Strength Indicator */}
          <InternetStrengthIndicator compact={true} />

          {/* Mobile Notifications Dropdown */}
          <div className="relative" ref={mobileNotificationsDropdownRef}>
            <button
              onClick={() => setIsNotificationsDropdownOpen(!isNotificationsDropdownOpen)}
              className={`${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'} relative transition-colors mt-1 focus:outline-none`}
            >
              <FiBell className="text-xl cursor-pointer" />
              {totalUnreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 pointer-events-none">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white dark:border-slate-950 shadow-xs"></span>
                </span>
              )}
            </button>

            {isNotificationsDropdownOpen && (
              <div className={`absolute right-0 mt-3 w-72 backdrop-blur-2xl border rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 ${
                isDark 
                  ? 'bg-slate-900/90 border-white/10 shadow-black/50' 
                  : 'bg-white/95 border-slate-200 shadow-slate-900/10'
              }`}>
                <div className={`px-3.5 py-2 border-b flex justify-between items-center mb-1 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-800'}`}>System Notifications</span>
                    {totalUnreadCount > 0 && (
                      <span className="text-[9px] bg-blue-500/20 text-blue-600 font-bold px-1.5 py-0.2 rounded-full border border-blue-500/20 shrink-0">
                        {totalUnreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {totalUnreadCount > 0 && (
                      <button
                        onClick={clearAllNotifications}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                          isDark ? 'text-slate-400 hover:text-rose-400' : 'text-slate-500 hover:text-rose-600'
                        }`}
                        title="Clear all notifications"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      onClick={() => setIsNotificationsDropdownOpen(false)}
                      className={`p-1 rounded-lg transition-colors cursor-pointer ${
                        isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                      title="Close"
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                </div>

                {/* Browser Notification Status Bar */}
                {browserPermission !== 'granted' ? (
                  <div className="mx-3 my-2 p-2.5 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FiBell className="text-blue-500 shrink-0" size={13} />
                      <span className={`text-[10px] font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Desktop Alerts</span>
                    </div>
                    <button
                      onClick={handleRequestBrowserPermission}
                      className="px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all cursor-pointer shadow-sm shrink-0"
                    >
                      Enable
                    </button>
                  </div>
                ) : (
                  <div className="mx-3 my-2 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-[9px]">
                    <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Browser Alerts Active
                    </span>
                    <button
                      onClick={handleTestBrowserNotification}
                      className={`${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} font-bold underline transition-colors cursor-pointer`}
                    >
                      Test
                    </button>
                  </div>
                )}

                <div className="max-h-60 overflow-y-auto divide-y divide-white/5 no-scrollbar">
                  {notificationsList.length === 0 ? (
                    <div className="py-6 text-center text-slate-500 text-xs">
                      <FiBell className="mx-auto text-xl mb-1 text-slate-500 animate-bounce" />
                      <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>All caught up!</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">No new system updates.</p>
                    </div>
                  ) : (
                    notificationsList.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif.path, notif.id)}
                        className={`flex items-start gap-2.5 p-2.5 transition-all cursor-pointer group relative ${
                          isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg text-sm shrink-0 ${notif.color}`}>
                          {notif.icon}
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5 pr-5">
                          <p className={`text-[11px] font-bold transition-colors ${
                            isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-800 group-hover:text-blue-600'
                          }`}>
                            {notif.title}
                          </p>
                          <p className={`text-[9px] leading-normal line-clamp-2 ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            {notif.description}
                          </p>
                        </div>
                        {/* Dismiss X Button per Item */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissNotification(notif.id);
                          }}
                          className={`absolute right-2 top-2 p-1 rounded-md transition-all cursor-pointer ${
                            isDark ? 'text-slate-500 hover:text-rose-400 hover:bg-rose-500/10' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                          title="Dismiss notification"
                        >
                          <FiX size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Mobile Dropdown Footer */}
                <div className={`px-3 py-2 border-t flex items-center justify-between text-[10px] ${
                  isDark ? 'border-white/5 bg-slate-950/40 text-slate-400' : 'border-slate-100 bg-slate-50/80 text-slate-500'
                }`}>
                  <Link
                    to="/notifications"
                    onClick={() => setIsNotificationsDropdownOpen(false)}
                    className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                  >
                    View All Notifications &rarr;
                  </Link>
                  <Link
                    to="/settings/notifications"
                    onClick={() => setIsNotificationsDropdownOpen(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    Settings
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Profile Dropdown */}
          <div className="relative" ref={mobileProfileDropdownRef}>
            <div
              className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center !text-white font-bold text-xs shadow-inner cursor-pointer"
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            >
              {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
            </div>

            {/* Dropdown Menu */}
            {isProfileDropdownOpen && (
              <div className={`absolute right-0 mt-3 w-52 backdrop-blur-xl border rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 ${
                isDark 
                  ? 'bg-slate-900/90 border-white/10 shadow-black/50' 
                  : 'bg-white/95 border-slate-200 shadow-slate-900/10'
              }`}>
                <div className={`px-4 py-2 border-b mb-1 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                  <p className={`text-sm font-semibold line-clamp-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{user.email || 'User'}</p>
                  <p className={`text-xs capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Administrator</p>
                </div>

                {/* Theme Switch Toggle */}
                <div className={`px-4 py-2 flex items-center justify-between border-b my-1 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-2">
                    {isDark ? (
                      <FiMoon className="text-blue-400 text-sm" />
                    ) : (
                      <FiSun className="text-amber-500 text-sm" />
                    )}
                    <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {isDark ? 'Dark Mode' : 'Light Mode'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTheme();
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isDark ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                    role="switch"
                    aria-checked={isDark}
                    title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        isDark ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <Link
                  to="/profile"
                  onClick={() => setIsProfileDropdownOpen(false)}
                  className={`flex items-center px-4 py-2 text-sm transition-colors ${
                    isDark ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <FiUser className="mr-2" /> Profile
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setIsProfileDropdownOpen(false)}
                  className={`flex items-center px-4 py-2 text-sm transition-colors ${
                    isDark ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <FiSettings className="mr-2" /> Panel Settings
                </Link>
                <button
                  onClick={logout}
                  className="w-full flex items-center px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <FiLogOut className="mr-2" /> Logout
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className={`p-1 focus:outline-none transition-colors ${
              isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FiMenu className="text-2xl" />
          </button>
        </div>
      </div>

      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 dark:bg-black/60 backdrop-blur-lg z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          transform transition-all duration-300 ease-in-out lg:translate-x-0 overflow-hidden
          ${isDark 
            ? 'bg-slate-950/50 border-r border-white/10 shadow-2xl shadow-black/80 backdrop-blur-2xl' 
            : 'bg-white/60 border-r border-slate-200/80 shadow-2xl shadow-slate-900/15 backdrop-blur-lg'
          }
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isExpanded ? 'w-72 sm:w-80' : 'lg:w-20 w-72 sm:w-80'}
        `}
      >
        {/* Sidebar Ambient Glows */}
        {displayPrefs.ambientGlow && (
          isDark ? (
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10 transform-gpu">
              <div className="absolute top-[10%] left-[-20%] w-64 h-64 bg-blue-600/20 rounded-full mix-blend-screen filter blur-[80px] opacity-60 transform-gpu animate-glow"></div>
              <div className="absolute bottom-[20%] right-[-20%] w-72 h-72 bg-blue-600/50 rounded-full mix-blend-screen filter blur-[100px] opacity-50 transform-gpu animate-glow" style={{ animationDelay: '-5s' }}></div>
            </div>
          ) : (
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10 transform-gpu">
              <div className="absolute top-[10%] left-[-20%] w-64 h-64 bg-blue-400/15 rounded-full filter blur-[75px] opacity-60 transform-gpu"></div>
              <div className="absolute bottom-[20%] right-[-20%] w-72 h-72 bg-sky-300/20 rounded-full filter blur-[95px] opacity-50 transform-gpu"></div>
            </div>
          )
        )}

        <div className={`h-16 flex items-center justify-center border-b bg-transparent shrink-0 relative overflow-hidden ${
          isDark ? 'border-white/10' : 'border-slate-200/80'
        }`}>
          {/* Full Logo */}
          <div className={`absolute transition-all duration-300 ease-in-out flex items-center justify-center ${isExpanded ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-75 rotate-[-12deg] pointer-events-none'
            }`}>
            <Link to="/"><img src={isDark ? auricDarkLogo : auricLightLogo} alt="Auric Logo" className="h-14 w-auto object-contain scale-125" /></Link>
          </div>

          {/* Collapsed App Icon */}
          <div className={`absolute transition-all duration-300 ease-in-out flex items-center justify-center ${isExpanded ? 'opacity-0 scale-75 rotate-[12deg] pointer-events-none' : 'opacity-100 scale-100 rotate-0'
            }`}>
            <Link to="/"><img src={isDark ? auricDarkLogo : auricLightLogo} alt="Auric Logo" className="lg:h-12 lg:w-12 h-12 w-auto object-contain" /></Link>
          </div>

          {/* Mobile Close Button */}
          <button
            className={`lg:hidden absolute right-4 p-1.5 rounded-xl transition-all cursor-pointer z-10 ${
              isDark 
                ? 'text-slate-400 hover:text-white bg-white/5 border border-white/10 hover:bg-white/15'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100 border border-slate-200 hover:bg-slate-200'
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
            title="Close Menu"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-3 overflow-y-auto no-scrollbar space-y-2">
          <p className={`px-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 opacity-100 mb-4 max-h-8 mt-2 ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          }`}>
            {isExpanded ? 'MAIN MENU' : 'MENU'}
          </p>

          {userMenus.map((menu) => {

            if (!menu) return null;
            const Icon = menu.icon;

            // IF THIS MENU HAS SUB-MENUS (Dropdown Logic)
            if (menu.subMenus) {
              const isOpen = openMenus[menu.name];
              // Check if any sub-menu is the currently active page so we can highlight the parent
              const isChildActive = menu.subMenus.some(sub => location.pathname === sub.path);
              const parentBadgeCount = menu.subMenus.reduce((sum, sub) => sum + getBadgeCount(sub.path), 0);

              return (
                <div key={menu.name} className="space-y-1">
                  {/* Parent Toggle Button */}
                  <button
                    onClick={() => toggleSubMenu(menu.name)}
                    title={!isExpanded ? menu.name : undefined}
                    className={`
                      w-full h-12 flex items-center justify-between px-3.5 transition-all duration-200 group rounded-xl relative cursor-pointer
                      ${isChildActive
                        ? isDark
                          ? 'bg-gradient-to-r from-blue-600/25 to-blue-500/15 text-white font-semibold border border-blue-500/40 shadow-sm shadow-blue-500/10 hover:shadow-md hover:shadow-blue-500/20'
                          : 'bg-gradient-to-r from-blue-600/15 to-indigo-600/10 text-blue-700 font-bold border border-blue-400/30 shadow-sm shadow-blue-500/5 hover:shadow-md hover:shadow-blue-500/15'
                        : isExpanded
                          ? isDark
                            ? 'text-slate-300 border border-transparent hover:bg-white/[0.02] hover:text-white hover:border-white/10 hover:translate-x-0.5 hover:shadow-md hover:shadow-black/30'
                            : 'text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-900 hover:border-slate-200/80 hover:translate-x-0.5 hover:shadow-md hover:shadow-slate-900/10'
                          : isDark
                            ? 'bg-white/[0.02] border border-white/5 text-slate-300 hover:bg-white/[0.02] hover:text-white hover:border-white/15 hover:scale-[1.03] hover:shadow-md hover:shadow-black/30'
                            : 'bg-slate-100/60 border border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300 hover:scale-[1.03] hover:shadow-md hover:shadow-slate-900/10'
                      }
                    `}
                  >
                    <div className="flex items-center min-w-0">
                      {Icon && (
                        <div className="relative shrink-0 flex items-center justify-center">
                          <Icon
                            className={`shrink-0 transition-all duration-200 
                              ${isChildActive 
                                ? (isDark ? 'text-blue-400 scale-110' : 'text-blue-600 scale-110') 
                                : (isDark ? 'text-slate-400 group-hover:text-blue-400 group-hover:scale-110' : 'text-slate-500 group-hover:text-blue-600 group-hover:scale-110')} 
                              ${isExpanded ? 'text-lg' : 'text-base lg:mr-0'}`}
                          />
                          {!isExpanded && parentBadgeCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 shadow-sm animate-pulse pointer-events-none" />
                          )}
                        </div>
                      )}
                      <span className={`font-medium text-sm whitespace-nowrap transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 max-w-[150px] ml-3' : 'opacity-0 max-w-0 overflow-hidden ml-0'
                        }`}>{menu.name}</span>
                    </div>

                    <div className={`flex items-center shrink-0 transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 max-w-[50px] ml-2' : 'opacity-0 max-w-0 overflow-hidden ml-0'
                      }`}>
                      {!isOpen && parentBadgeCount > 0 && (
                        <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shrink-0 shadow-sm">
                          {parentBadgeCount > 9 ? '9+' : parentBadgeCount}
                        </span>
                      )}
                      <FiChevronRight className={`transition-transform duration-200 ${isOpen ? (isDark ? 'rotate-90 text-blue-400' : 'rotate-90 text-blue-600') : isChildActive ? (isDark ? 'text-blue-400' : 'text-blue-600') : (isDark ? 'text-slate-400 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-900')}`} />
                    </div>
                  </button>

                  {/* Collapsible Sub-Menus */}
                  {isExpanded && (
                    <div
                      className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                        }`}
                    >
                      <div className="overflow-hidden">
                        <div className="pl-10 pr-2 py-1 space-y-1">
                          {menu.subMenus.map((sub) => {
                            const isSubActive = location.pathname === sub.path;
                            const SubIcon = sub.icon;
                            const badgeCount = getBadgeCount(sub.path);
                            return (
                              <Link
                                key={sub.path}
                                to={sub.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`
                                flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200
                                ${isSubActive
                                    ? isDark
                                      ? 'bg-blue-600/25 text-white font-bold border border-blue-500/40 shadow-sm shadow-blue-500/10 hover:shadow-md hover:shadow-blue-500/20'
                                      : 'bg-blue-600/15 text-blue-700 font-bold border border-blue-400/40 shadow-sm shadow-blue-500/5 hover:shadow-md hover:shadow-blue-500/15'
                                    : isDark
                                      ? 'text-slate-400 hover:bg-white/[0.03] border border-transparent hover:border-white/15 hover:text-slate-100 hover:translate-x-1 hover:shadow-sm hover:shadow-black/30'
                                      : 'text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200 hover:text-slate-900 hover:translate-x-1 hover:shadow-sm hover:shadow-slate-900/10'
                                  }
                              `}
                              >
                                <div className="flex items-center min-w-0">
                                  {SubIcon && (
                                    <SubIcon className={`text-[15px] mr-2.5 shrink-0 transition-colors ${isSubActive ? (isDark ? 'text-blue-400' : 'text-blue-600') : (isDark ? 'text-slate-500 group-hover:text-slate-300' : 'text-slate-400 group-hover:text-slate-700')}`} />
                                  )}
                                  <span className="truncate">{sub.name}</span>
                                </div>
                                {badgeCount > 0 && (
                                  <span className="ml-2 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shrink-0 shadow-xs">
                                    {badgeCount > 9 ? '9+' : badgeCount}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // IF THIS IS A STANDARD FLAT LINK
            const isActive = location.pathname === menu.path;
            const badgeCount = getBadgeCount(menu.path);

            return (
              <Link
                key={menu.path}
                to={menu.path}
                onClick={() => {
                  setOpenMenus({});
                  setIsMobileMenuOpen(false);
                }}
                title={!isExpanded ? menu.name : undefined}
                className={`
                  w-full h-12 flex items-center justify-between px-3.5 transition-all duration-200 group rounded-xl relative cursor-pointer
                  ${isActive
                    ? isDark
                      ? 'bg-gradient-to-r from-blue-600/25 to-blue-500/15 text-white font-semibold border border-blue-500/40 shadow-sm shadow-blue-500/10 hover:shadow-md hover:shadow-blue-500/20'
                      : 'bg-gradient-to-r from-blue-600/15 to-indigo-600/10 text-blue-700 font-bold border border-blue-400/40 shadow-sm shadow-blue-500/5 hover:shadow-md hover:shadow-blue-500/15'
                    : isExpanded
                      ? isDark
                        ? 'text-slate-300 border border-transparent hover:bg-white/[0.02] hover:text-white hover:border-white/10 hover:translate-x-0.5 hover:shadow-md hover:shadow-black/30'
                        : 'text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-900 hover:border-slate-200/80 hover:translate-x-0.5 hover:shadow-md hover:shadow-slate-900/10'
                      : isDark
                        ? 'bg-white/[0.02] border border-white/5 text-slate-300 hover:bg-white/[0.02] hover:text-white hover:border-white/15 hover:scale-[1.03] hover:shadow-md hover:shadow-black/30'
                        : 'bg-slate-100/60 border border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300 hover:scale-[1.03] hover:shadow-md hover:shadow-slate-900/10'
                  }
                `}
              >
                <div className="flex items-center min-w-0">
                  {Icon && (
                    <div className="relative shrink-0 flex items-center justify-center">
                      <Icon
                        className={`shrink-0 transition-all duration-200 
                          ${isActive 
                            ? (isDark ? 'scale-110 text-blue-400' : 'scale-110 text-blue-600') 
                            : (isDark ? 'group-hover:scale-110 text-slate-400 group-hover:text-blue-400' : 'group-hover:scale-110 text-slate-500 group-hover:text-blue-600')} 
                          ${isExpanded ? 'text-lg' : 'text-base lg:mr-0'}`}
                      />
                      {!isExpanded && badgeCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 pointer-events-none">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 border-2 border-white dark:border-slate-900 shadow-sm"></span>
                        </span>
                      )}
                    </div>
                  )}
                  <span className={`font-medium text-sm whitespace-nowrap transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 max-w-[150px] ml-3' : 'opacity-0 max-w-0 overflow-hidden ml-0'
                    }`}>{menu.name}</span>
                </div>
                {badgeCount > 0 && (
                  <div className={`ml-2 flex items-center gap-1.5 transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 max-w-[60px] ml-2' : 'opacity-0 max-w-0 overflow-hidden ml-0'}`}>
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shrink-0 shadow-sm">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* MAIN CONTENT WRAPPER (Includes Header, Content, Footer) */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden bg-transparent relative pt-16 lg:pt-0 lg:pl-20 transition-all duration-300 ${isExpanded ? 'lg:blur-[2px]' : 'blur-none'}`}>

        {/* GLOBAL HEADER (Desktop Top Bar) */}
        <header className={`hidden lg:flex h-16 border-b items-center justify-between px-8 sticky top-0 z-40 transition-colors ${
          isDark 
            ? 'bg-transparent border-white/10 shadow-sm shadow-black/50' 
            : 'bg-white/5 border-slate-200/80 shadow-md shadow-slate-900/5'
        }`}>

          {/* Left Side: Global Search */}
          <HeaderSearch />

          {/* Right Side: Profile & Notifications */}
          <div className="flex items-center space-x-4 sm:space-x-5">
            {/* Internet Strength Indicator */}
            <InternetStrengthIndicator compact={true} />

            {/* Desktop Notifications Dropdown */}
            <div className="relative" ref={notificationsDropdownRef}>
              <button
                onClick={() => setIsNotificationsDropdownOpen(!isNotificationsDropdownOpen)}
                className={`${isDark ? 'text-slate-400 hover:text-blue-500' : 'text-slate-600 hover:text-blue-600'} relative transition-colors mt-1 focus:outline-none`}
                title="Notifications"
              >
                <FiBell className="text-xl cursor-pointer" />
                {totalUnreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 pointer-events-none">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white dark:border-slate-950 shadow-xs"></span>
                  </span>
                )}
              </button>

              {isNotificationsDropdownOpen && (
                <div className={`absolute right-0 mt-3 w-80 sm:w-96 backdrop-blur-2xl border rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 ${
                  isDark 
                    ? 'bg-slate-900/90 border-white/10 shadow-black/50' 
                    : 'bg-white/80 border-slate-200 shadow-slate-900/10'
                }`}>
                  <div className={`px-4 py-2.5 border-b flex justify-between items-center mb-1 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-800'}`}>System Notifications</span>
                      {totalUnreadCount > 0 && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-600 font-bold px-2 py-0.5 rounded-full border border-blue-500/20">
                          {totalUnreadCount} New
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {totalUnreadCount > 0 && (
                        <button
                          onClick={clearAllNotifications}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                            isDark ? 'text-slate-400 hover:text-rose-400 hover:bg-white/5' : 'text-slate-500 hover:text-rose-600 hover:bg-slate-100'
                          }`}
                          title="Clear all notifications"
                        >
                          Clear All
                        </button>
                      )}
                      <button
                        onClick={() => setIsNotificationsDropdownOpen(false)}
                        className={`p-1 rounded-lg transition-colors cursor-pointer ${
                          isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                        title="Close popup"
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Desktop Browser Notification Status Bar */}
                  {browserPermission === 'granted' && browserAlertsEnabled ? (
                    <div className="mx-3 my-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-emerald-600 font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Browser Desktop Alerts Active
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleTestBrowserNotification}
                          className={`text-xs font-bold underline transition-colors cursor-pointer ${
                            isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                          }`}
                          title="Send a test notification"
                        >
                          Test
                        </button>
                        <span className="text-slate-400">|</span>
                        <button
                          type="button"
                          onClick={handleTurnOffBrowserAlerts}
                          className="text-xs text-rose-500 hover:text-rose-600 font-bold hover:underline transition-colors cursor-pointer"
                          title="Turn off desktop alerts"
                        >
                          Turn Off
                        </button>
                      </div>
                    </div>
                  ) : browserPermission === 'denied' ? (
                    <div className="mx-3 my-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between gap-3 shadow-inner">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-rose-500/20 text-rose-500 shrink-0">
                          <FiBellOff size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-rose-600 leading-tight">Notifications Blocked</p>
                          <p className="text-[10px] text-slate-500">Please enable notifications in your browser address bar settings.</p>
                        </div>
                      </div>
                      <Link
                        to="/settings/notifications"
                        onClick={() => setIsNotificationsDropdownOpen(false)}
                        className="px-2.5 py-1 text-[10px] font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-600 border border-rose-500/30 rounded-xl transition-all cursor-pointer shrink-0"
                      >
                        Settings
                      </Link>
                    </div>
                  ) : (
                    <div className="mx-3 my-2 p-3 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-between gap-3 shadow-inner">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-blue-500/20 text-blue-500">
                          <FiBell size={16} />
                        </div>
                        <div>
                          <p className={`text-xs font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Desktop Push Alerts</p>
                          <p className="text-[10px] text-slate-500">Get notified for orders even when tab is in background.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRequestBrowserPermission}
                        className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all cursor-pointer shadow-md shrink-0 active:scale-95"
                      >
                        Enable Alerts
                      </button>
                    </div>
                  )}

                  <div className="max-h-72 overflow-y-auto divide-y divide-white/5 no-scrollbar">
                    {notificationsList.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-xs">
                        <FiBell className="mx-auto text-2xl mb-2 text-slate-500 animate-bounce" />
                        <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>All caught up!</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">No new system updates.</p>
                      </div>
                    ) : (
                      notificationsList.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif.path, notif.id)}
                          className={`flex items-start gap-3 p-3 transition-all cursor-pointer group relative ${
                            isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className={`p-2 rounded-xl text-base shrink-0 ${notif.color}`}>
                            {notif.icon}
                          </div>
                          <div className="flex-1 min-w-0 space-y-0.5 pr-6">
                            <p className={`text-xs font-bold transition-colors ${
                              isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-800 group-hover:text-blue-600'
                            }`}>
                              {notif.title}
                            </p>
                            <p className={`text-[10px] leading-relaxed line-clamp-2 ${
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                              {notif.description}
                            </p>
                          </div>
                          {/* Dismiss X Button per Item */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissNotification(notif.id);
                            }}
                            className={`absolute right-2.5 top-3 p-1 rounded-md transition-all cursor-pointer opacity-80 hover:opacity-100 ${
                              isDark ? 'text-slate-500 hover:text-rose-400 hover:bg-rose-500/10' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title="Dismiss notification"
                          >
                            <FiX size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Dropdown footer link to notification settings */}
                  <div className={`px-3.5 py-2.5 border-t flex items-center justify-between text-[11px] ${
                    isDark ? 'border-white/5 bg-slate-950/40 text-slate-400' : 'border-slate-100 bg-slate-50/80 text-slate-500'
                  }`}>
                    <Link
                      to="/notifications"
                      onClick={() => setIsNotificationsDropdownOpen(false)}
                      className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                    >
                      View All Notifications &rarr;
                    </Link>
                    <Link
                      to="/settings/notifications"
                      onClick={() => setIsNotificationsDropdownOpen(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-medium flex items-center gap-1 hover:underline transition-colors"
                    >
                      <FiSettings size={11} /> Settings
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className={`h-8 w-px ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}></div>

            {/* Profile Dropdown Trigger */}
            <div className="relative" ref={profileDropdownRef}>
              <div
                className="flex items-center cursor-pointer group"
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center !text-white font-bold text-xs shadow-inner">
                  {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="ml-3 hidden md:block">
                  <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Admin Account</p>
                  <p className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Administrator</p>
                </div>
                <FiChevronDown className={`ml-2 transition-colors ${isDark ? 'text-slate-400 group-hover:text-white' : 'text-slate-500 group-hover:text-slate-900'}`} />
              </div>

              {/* Dropdown Menu */}
              {isProfileDropdownOpen && (
                <div className={`absolute right-0 mt-3 w-52 backdrop-blur-xl border rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 ${
                  isDark 
                    ? 'bg-slate-900/50 border-white/10 shadow-black/50' 
                    : 'bg-white/40 border-slate-200 shadow-slate-900/10'
                }`}>
                  <div className={`px-4 py-2 border-b mb-1 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                    <p className={`text-sm font-semibold line-clamp-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{user.email || 'User'}</p>
                    <p className={`text-xs capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Administrator</p>
                  </div>

                  {/* Theme Switch Toggle */}
                  <div className={`px-4 py-2 flex items-center justify-between border-b my-1 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                      {isDark ? (
                        <FiMoon className="text-blue-400 text-sm" />
                      ) : (
                        <FiSun className="text-amber-500 text-sm" />
                      )}
                      <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {isDark ? 'Dark Mode' : 'Light Mode'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTheme();
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isDark ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                      role="switch"
                      aria-checked={isDark}
                      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          isDark ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <Link
                    to="/profile"
                    onClick={() => setIsProfileDropdownOpen(false)}
                    className={`flex items-center px-4 py-2 text-sm transition-colors ${
                      isDark ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <FiUser className="mr-2" /> Profile
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setIsProfileDropdownOpen(false)}
                    className={`flex items-center px-4 py-2 text-sm transition-colors ${
                      isDark ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <FiSettings className="mr-2" /> Panel Settings
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full flex items-center px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <FiLogOut className="mr-2" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Browser Notification Permission Top Banner */}
        {showPermissionBanner && browserPermission === 'default' && (
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white px-4 py-2.5 flex items-center justify-between shadow-lg z-30 backdrop-blur-md animate-in slide-in-from-top-2 border-b border-white/20">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-white/20">
                <FiBell size={16} />
              </div>
              <p className="text-xs font-semibold">
                <span className="font-extrabold">Stay updated in real-time:</span> Enable desktop browser notifications to receive instant alerts for new orders, registrations, and messages.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRequestBrowserPermission}
                className="px-3 py-1 bg-white text-blue-600 hover:bg-white/90 text-xs font-extrabold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Enable Notifications
              </button>
              <button
                onClick={() => setShowPermissionBanner(false)}
                className="p-1 text-white/70 hover:text-white transition-colors cursor-pointer"
                title="Dismiss"
              >
                <FiX size={16} />
              </button>
            </div>
          </div>
        )}

        {/* DYNAMIC PAGE CONTENT */}
        <main ref={mainRef} onScroll={checkScrollState} className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="w-full mx-auto p-1 sm:p-2 lg:p-4 min-h-full">
            <Outlet context={{ setChatUnreadCount, setOrdersUnreadCount, setUsersUnreadCount, setUsersVerifyUnreadCount, setUsersDeletionUnreadCount }} />
          </div>
        </main>

        {/* GLOBAL FOOTER */}
        <footer className={`backdrop-blur-2xl border-t py-4 px-8 mt-auto z-10 relative transition-colors ${
          isDark 
            ? 'bg-transparent border-white/10 shadow-lg shadow-black/50' 
            : 'bg-white/40 border-slate-200/80 shadow-xs shadow-slate-900/5'
        }`}>
          <div className={`w-full mx-auto flex flex-col md:flex-row justify-between items-center text-xs font-medium ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <p>© {new Date().getFullYear()} Inizio Workspace. All rights reserved.</p>
            <div className="flex items-center space-x-4 mt-2 md:mt-0">
              {/* <Link to="/help" className="hover:text-blue-500 transition-colors">Help Center</Link> */}
              <Link to="/settings/privacy-policy" className={`transition-colors ${
                isDark ? 'hover:text-blue-400' : 'hover:text-blue-600'
              }`}>
                Privacy Policy
              </Link>
              {/* <span className="px-2 py-0.5 bg-white/10 text-slate-300 rounded-md border border-white/10">
                v1.2.0
              </span> */}
            </div>
          </div>
        </footer>

      </div>

      {/* Scroll to Top Floating Button (Rendered directly into document.body to avoid parent CSS clipping) */}
      {displayPrefs.autoScrollToTop && !isChatRoute && typeof document !== 'undefined' && createPortal(
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          title="Scroll to top"
          style={{
            position: 'fixed',
            bottom: '64px',
            right: '24px',
            zIndex: 999999,
            opacity: showScrollTop ? 1 : 0,
            transform: showScrollTop ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.8)',
            pointerEvents: showScrollTop ? 'auto' : 'none',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
          }}
          className={`p-3.5 rounded-2xl backdrop-blur-xl transition-all duration-300 cursor-pointer group active:scale-90 flex items-center justify-center ${
            isDark
              ? 'bg-gradient-to-br from-slate-900/95 to-blue-950/95 border border-blue-500/40 text-blue-400 hover:text-white hover:from-blue-600 hover:to-indigo-600 hover:border-blue-400 shadow-[0_8px_25px_rgba(0,0,0,0.8),0_0_25px_rgba(37,99,235,0.4)] hover:shadow-[0_8px_35px_rgba(37,99,235,0.7)]'
              : 'bg-white/95 border border-blue-400/40 text-blue-600 hover:text-white hover:bg-blue-600 hover:border-blue-600 shadow-xl shadow-blue-500/15'
          }`}
        >
          <FiArrowUp className="w-5 h-5 transition-transform duration-300 group-hover:-translate-y-1" />
        </button>,
        document.body
      )}
    </div>
  );
};

export default Layout;