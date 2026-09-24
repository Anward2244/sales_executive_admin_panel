import React, { useState, useEffect } from 'react';
import {
  FiSettings,
  FiSun,
  FiMoon,
  FiBell,
  FiBellOff,
  FiVolume2,
  FiVolumeX,
  FiVolume1,
  FiLayout,
  FiCheck,
  FiCheckCircle,
  FiAlertCircle,
  FiAlertTriangle,
  FiTrash2,
  FiMonitor,
  FiZap,
  FiSliders,
  FiClock,
  FiLayers,
  FiActivity,
  FiShield,
  FiHelpCircle,
  FiInfo,
  FiExternalLink,
  FiCompass,
  FiSmartphone,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
  FiCopy,
  FiEye,
  FiX,
  FiArrowRight,
  FiMessageSquare,
  FiShoppingBag,
  FiPackage,
  FiUsers,
  FiFileText,
  FiImage,
  FiLock,
  FiUnlock,
  FiGlobe,
  FiTerminal
} from 'react-icons/fi';
import { useTheme } from '@/Context/ThemeContext';
import { useAuth } from '@/Context/AuthContext';
import { useConfirm } from '@/Context/ConfirmationContext';
import CustomDropdown from '@/components/ui/CustomDropdown';
import PageHeader from '@/components/ui/PageHeader';
import {
  getNotificationSettings,
  saveNotificationSettings,
  isBrowserNotificationSupported,
  getNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  playNotificationSound,
  isQuietHoursActive,
  isSecureOrigin,
  DEFAULT_NOTIFICATION_SETTINGS
} from '@/utils/browserNotifications';
import {
  useDisplayPreferences,
  saveDisplayPreferences,
  DEFAULT_DISPLAY_PREFERENCES
} from '@/utils/displayPreferences';
import appIconImg from '@/assets/auric.png';

const getInitialStorage = () => {
  try {
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const val = localStorage.getItem(key) || '';
        totalBytes += (key.length + val.length) * 2;
      }
    }
    return {
      usedKb: (totalBytes / 1024).toFixed(1),
      itemsCount: localStorage.length
    };
  } catch {
    return { usedKb: '0', itemsCount: 0 };
  }
};

const Settings = () => {
  const { setTheme, toggleTheme, isDark } = useTheme();
  const { user } = useAuth();
  const confirmModal = useConfirm();

  // Active Tab
  const [activeTab, setActiveTab] = useState('appearance'); // 'appearance', 'notifications', 'display', 'system'

  // Notification / Toast Feedback banner
  const [feedback, setFeedback] = useState(null);

  // Notification Settings State
  const [notificationConfig, setNotificationConfig] = useState(() => getNotificationSettings());
  const [browserPermission, setBrowserPermission] = useState(() => getNotificationPermission());
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [guideBrowserTab, setGuideBrowserTab] = useState('chrome'); // 'chrome' | 'edge' | 'firefox' | 'localhost' | 'windows' | 'faq'
  const [isGuideOpen, setIsGuideOpen] = useState(() => !isSecureOrigin() || getNotificationPermission() !== 'granted');
  const [previewTab, setPreviewTab] = useState('os'); // 'os' | 'toast'

  // Display Preferences State (Managed globally via useDisplayPreferences)
  const { preferences: displayPrefs, updatePreference: updateDisplayPrefState, setPreferences: setDisplayPrefs } = useDisplayPreferences();

  // Local Storage Usage calculation initialized lazily
  const [storageUsage, setStorageUsage] = useState(getInitialStorage);

  const refreshStorage = () => {
    setStorageUsage(getInitialStorage());
  };

  const triggerFeedback = (msg, type = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => {
      setFeedback(null);
    }, 3500);
  };

  // Sync display preferences
  const updateDisplayPref = (key, value) => {
    updateDisplayPrefState(key, value);
    triggerFeedback('Display preference updated');
  };

  // Handle Notification master switch updates
  const handleNotificationToggle = (key) => {
    const updated = {
      ...notificationConfig,
      [key]: !notificationConfig[key]
    };
    const saved = saveNotificationSettings(updated);
    setNotificationConfig(saved);
    triggerFeedback(
      `${key === 'browserAlertsEnabled' ? 'Desktop alerts' : key === 'soundEnabled' ? 'Sound alerts' : 'Toast alerts'} ${
        updated[key] ? 'enabled' : 'disabled'
      }`
    );
  };

  // Handle category notification toggles
  const handleCategoryToggle = (categoryKey) => {
    const updated = {
      ...notificationConfig,
      categories: {
        ...notificationConfig.categories,
        [categoryKey]: !notificationConfig.categories?.[categoryKey]
      }
    };
    const saved = saveNotificationSettings(updated);
    setNotificationConfig(saved);
    triggerFeedback(`Alerts for ${categoryKey} updated`);
  };

  // Handle Polling interval change
  const handleIntervalChange = (categoryKey, seconds) => {
    const updated = {
      ...notificationConfig,
      pollingIntervals: {
        ...notificationConfig.pollingIntervals,
        [categoryKey]: Number(seconds)
      }
    };
    const saved = saveNotificationSettings(updated);
    setNotificationConfig(saved);
    triggerFeedback(`Refresh interval for ${categoryKey} set to ${seconds}s`);
  };

  // Refresh browser permission status
  const handleRefreshPermission = () => {
    const perm = getNotificationPermission();
    setBrowserPermission(perm);
    triggerFeedback(`Browser permission status: ${perm}`);
  };

  // Sound type change
  const handleSoundTypeChange = (tone) => {
    const updated = {
      ...notificationConfig,
      soundType: tone
    };
    const saved = saveNotificationSettings(updated);
    setNotificationConfig(saved);
    playNotificationSound(tone, notificationConfig.soundVolume);
    triggerFeedback(`Chime tone set to ${tone.toUpperCase()}`);
  };

  // Sound volume change
  const handleSoundVolumeChange = (vol) => {
    const volume = Number(vol);
    const updated = {
      ...notificationConfig,
      soundVolume: volume
    };
    const saved = saveNotificationSettings(updated);
    setNotificationConfig(saved);
    playNotificationSound(notificationConfig.soundType, volume);
    triggerFeedback(`Volume set to ${Math.round(volume * 100)}%`);
  };

  // Toast duration change
  const handleToastDurationChange = (durationMs) => {
    const ms = Number(durationMs);
    const updated = {
      ...notificationConfig,
      toastDuration: ms
    };
    const saved = saveNotificationSettings(updated);
    setNotificationConfig(saved);
    triggerFeedback(`Toast auto-dismiss set to ${ms === 0 ? 'Manual Dismiss' : ms / 1000 + 's'}`);
  };

  // Toast position change
  const handleToastPositionChange = (position) => {
    const updated = {
      ...notificationConfig,
      toastPosition: position
    };
    const saved = saveNotificationSettings(updated);
    setNotificationConfig(saved);
    triggerFeedback(`Toast placement set to ${position}`);
  };

  // Quiet hours toggle & time
  const handleQuietHoursToggle = () => {
    const updated = {
      ...notificationConfig,
      quietHoursEnabled: !notificationConfig.quietHoursEnabled
    };
    const saved = saveNotificationSettings(updated);
    setNotificationConfig(saved);
    triggerFeedback(`Quiet Hours (Do Not Disturb) ${updated.quietHoursEnabled ? 'enabled' : 'disabled'}`);
  };

  const handleQuietHoursTimeChange = (field, val) => {
    const updated = {
      ...notificationConfig,
      [field]: val
    };
    const saved = saveNotificationSettings(updated);
    setNotificationConfig(saved);
  };

  // Copy text helper with feedback
  const handleCopyText = (text, label = 'Copied to clipboard!') => {
    try {
      navigator.clipboard.writeText(text);
      triggerFeedback(label);
    } catch {
      triggerFeedback('Unable to copy automatically', 'error');
    }
  };

  // Copy site URL
  const handleCopySiteUrl = () => {
    handleCopyText(window.location.origin, 'Site origin URL copied to clipboard!');
  };

  // Request native permission
  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    try {
      const isSec = isSecureOrigin();
      const granted = await requestBrowserNotificationPermission();
      const currentPerm = getNotificationPermission();
      setBrowserPermission(currentPerm);
      if (granted === 'granted' || currentPerm === 'granted') {
        triggerFeedback('Desktop notification permission granted!');
        showBrowserNotification({
          title: 'Auric Desktop Alerts Active',
          body: 'Browser notifications are now authorized and ready to alert you on new orders and events.',
          tag: 'test-permission-granted'
        });
      } else if (currentPerm === 'denied' || !isSec) {
        setIsGuideOpen(true);
        if (!isSec) {
          triggerFeedback('Insecure HTTP origin detected ("Not Secure" browser). Check the guide below to enable the insecure origin flag.', 'error');
        } else {
          triggerFeedback('Notifications were blocked in your browser settings. See guide below.', 'error');
        }
        const el = document.getElementById('browser-notification-guide');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      } else {
        triggerFeedback('Notification request was dismissed or unsupported.', 'info');
      }
    } finally {
      setIsRequestingPermission(false);
    }
  };

  // Test sound
  const handleTestSound = (customTone) => {
    const tone = customTone || notificationConfig.soundType || 'chime';
    playNotificationSound(tone, notificationConfig.soundVolume);
    triggerFeedback(`Auditioning "${tone}" sound chime`);
  };

  // Test desktop notification
  const handleTestNotification = () => {
    if (!isBrowserNotificationSupported()) {
      triggerFeedback('Notifications are not supported in this browser.', 'error');
      return;
    }
    if (browserPermission !== 'granted') {
      triggerFeedback(`Browser permission is "${browserPermission}". Please click "Enable Desktop Alerts" or unblock in your browser.`, 'error');
    }

    const sent = showBrowserNotification({
      title: 'New Purchase Order Received',
      body: 'Purchase Order PO-2026-000001 for B New Mobiles (₹1,122,543) submitted.',
      path: '/purchase-orders',
      tag: 'test-auric-alert'
    });
    playNotificationSound(notificationConfig.soundType, notificationConfig.soundVolume);

    if (sent) {
      triggerFeedback('Desktop test notification sent! Check your screen/action center.');
    } else if (browserPermission === 'granted') {
      triggerFeedback('Test alert dispatched to system notification tray.');
    }
  };

  // Reset all preferences
  const handleResetPreferences = async () => {
    if (confirmModal?.confirm) {
      const confirmed = await confirmModal.confirm(
        'Are you sure you want to reset all panel settings and theme preferences back to default (Light Mode)?'
      );
      if (!confirmed) return;
    } else if (!window.confirm('Reset all panel settings to default (Light Mode)?')) {
      return;
    }

    // Set theme to light
    setTheme('light');

    // Reset notifications
    saveNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
    setNotificationConfig(DEFAULT_NOTIFICATION_SETTINGS);

    // Reset display prefs
    saveDisplayPreferences(DEFAULT_DISPLAY_PREFERENCES);
    setDisplayPrefs(DEFAULT_DISPLAY_PREFERENCES);

    refreshStorage();
    triggerFeedback('All settings successfully reset to defaults');
  };

  return (
    <div className="min-h-full pb-16 relative">
      {/* Page Header */}
      <PageHeader
        title="Panel Settings"
        icon={FiSettings}
        description="Configure your workspace appearance, theme preferences, live notification channels, and panel telemetry."
      />

      {/* Floating Status / Feedback Toast */}
      {feedback && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-xl ${
              feedback.type === 'error'
                ? 'bg-rose-500/95 text-white border-rose-400/30 shadow-rose-500/20'
                : 'bg-emerald-600/95 text-white border-emerald-400/30 shadow-emerald-500/20'
            }`}
          >
            {feedback.type === 'error' ? (
              <FiAlertCircle className="text-lg shrink-0" />
            ) : (
              <FiCheckCircle className="text-lg shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-semibold tracking-wide">{feedback.msg}</span>
          </div>
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-6 border-b border-slate-200/80 dark:border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'appearance'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/70 dark:border-transparent'
          }`}
        >
          {isDark ? <FiMoon className="text-sm" /> : <FiSun className="text-sm" />}
          Theme & Appearance
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'notifications'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/70 dark:border-transparent'
          }`}
        >
          <FiBell className="text-sm" />
          Notifications & Alerts
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('display')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'display'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/70 dark:border-transparent'
          }`}
        >
          <FiLayout className="text-sm" />
          Display & Layout
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'system'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/70 dark:border-transparent'
          }`}
        >
          <FiMonitor className="text-sm" />
          System & Storage
        </button>
      </div>

      {/* ========================================================
          TAB 1: THEME & APPEARANCE (PRIMARY FOCUS)
          ======================================================== */}
      {activeTab === 'appearance' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Main Interactive Theme Toggle Banner */}
          <div
            className={`p-6 sm:p-7 rounded-3xl border transition-all relative overflow-hidden backdrop-blur-xl ${
              isDark
                ? 'bg-slate-900/60 border-white/10 shadow-2xl shadow-black/40'
                : 'bg-white/80 border-slate-200/80 shadow-xl shadow-slate-900/5'
            }`}
          >
            {/* Ambient Background Decorative Glow */}
            <div
              className={`absolute -right-16 -top-16 w-64 h-64 rounded-full pointer-events-none filter blur-3xl opacity-30 ${
                isDark ? 'bg-blue-600' : 'bg-amber-400'
              }`}
            />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 transition-transform duration-300 shadow-md ${
                    isDark
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-blue-500/10'
                      : 'bg-amber-500/15 text-amber-500 border border-amber-400/40 shadow-amber-500/10'
                  }`}
                >
                  {isDark ? <FiMoon /> : <FiSun />}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      Theme Mode: {isDark ? 'Dark Theme' : 'Light Theme (Preferred)'}
                    </h2>
                    <span
                      className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${
                        !isDark
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}
                    >
                      {!isDark ? 'Active Default' : 'Active'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
                    Toggle instantly between crisp daylight light mode and low-glare dark mode.
                    Changes apply immediately across all navigation, cards, tables, and dialogs.
                  </p>
                </div>
              </div>

              {/* Master Theme Toggle Switch */}
              <div className="flex items-center gap-3 self-end sm:self-center">
                <span
                  className={`text-xs font-bold transition-colors ${
                    !isDark ? 'text-amber-600 dark:text-amber-400 font-extrabold' : 'text-slate-400'
                  }`}
                >
                  Light
                </span>

                <button
                  type="button"
                  id="theme-toggle-master"
                  onClick={() => {
                    toggleTheme();
                    triggerFeedback(`Switched to ${isDark ? 'Light' : 'Dark'} theme`);
                  }}
                  className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none shadow-inner ${
                    isDark ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                  role="switch"
                  aria-checked={isDark}
                  title={`Click to switch to ${isDark ? 'Light' : 'Dark'} Mode`}
                >
                  <span className="sr-only">Toggle Theme</span>
                  <span
                    className={`pointer-events-none inline-flex h-7 w-7 transform items-center justify-center rounded-full bg-white text-xs shadow-md ring-0 transition duration-300 ease-in-out ${
                      isDark ? 'translate-x-8 text-blue-600' : 'translate-x-0 text-amber-500'
                    }`}
                  >
                    {isDark ? <FiMoon /> : <FiSun />}
                  </span>
                </button>

                <span
                  className={`text-xs font-bold transition-colors ${
                    isDark ? 'text-blue-400 font-extrabold' : 'text-slate-500'
                  }`}
                >
                  Dark
                </span>
              </div>
            </div>
          </div>

          {/* Visual Theme Selection Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FiLayers className="text-blue-500" /> Theme Palettes
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Click a card below to switch themes
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* LIGHT THEME CARD */}
              <div
                onClick={() => {
                  setTheme('light');
                  triggerFeedback('Light Theme selected');
                }}
                className={`p-5 rounded-3xl border-2 transition-all duration-300 cursor-pointer relative overflow-hidden group ${
                  !isDark
                    ? 'border-blue-600 bg-white shadow-xl shadow-blue-500/10 ring-4 ring-blue-500/10'
                    : 'border-slate-200/50 dark:border-white/10 bg-white/40 dark:bg-slate-900/30 hover:border-blue-400/50'
                }`}
              >
                {!isDark && (
                  <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md shadow-blue-600/30">
                    <FiCheck className="text-sm stroke-[3]" /> Active Theme
                  </div>
                )}

                {/* Mock UI Preview (Light) */}
                <div className="w-full h-32 rounded-2xl bg-gradient-to-br from-white via-sky-50 to-blue-100 border border-slate-200 p-3 flex flex-col justify-between overflow-hidden shadow-inner mb-4">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="w-24 h-2 bg-slate-200 rounded-full" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-14 rounded-xl bg-white border border-slate-200/80 p-2 shadow-xs flex flex-col justify-between">
                      <div className="w-6 h-1.5 bg-blue-500 rounded-full" />
                      <div className="w-10 h-3 bg-slate-800 rounded-sm font-bold text-[9px] flex items-center justify-center text-white">
                        $48.2k
                      </div>
                    </div>
                    <div className="h-14 rounded-xl bg-white border border-slate-200/80 p-2 shadow-xs flex flex-col justify-between">
                      <div className="w-6 h-1.5 bg-emerald-500 rounded-full" />
                      <div className="w-8 h-3 bg-emerald-600 rounded-sm font-bold text-[9px] flex items-center justify-center text-white">
                        +14%
                      </div>
                    </div>
                    <div className="h-14 rounded-xl bg-white border border-slate-200/80 p-2 shadow-xs flex flex-col justify-between">
                      <div className="w-6 h-1.5 bg-indigo-500 rounded-full" />
                      <div className="w-9 h-3 bg-slate-400 rounded-sm" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-base text-slate-900 dark:text-white">
                        Light Mode
                      </h4>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        Default
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Crisp, modern daylight palette tailored for high-contrast viewing and long working hours.
                    </p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      !isDark
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {!isDark && <FiCheck className="text-xs stroke-[3]" />}
                  </div>
                </div>
              </div>

              {/* DARK THEME CARD */}
              <div
                onClick={() => {
                  setTheme('dark');
                  triggerFeedback('Dark Theme selected');
                }}
                className={`p-5 rounded-3xl border-2 transition-all duration-300 cursor-pointer relative overflow-hidden group ${
                  isDark
                    ? 'border-blue-500 bg-slate-900 shadow-xl shadow-blue-500/10 ring-4 ring-blue-500/10'
                    : 'border-slate-200/50 dark:border-white/10 bg-white/80 dark:bg-slate-900/30 hover:border-blue-400/50'
                }`}
              >
                {isDark && (
                  <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md shadow-blue-600/30">
                    <FiCheck className="text-sm stroke-[3]" /> Active Theme
                  </div>
                )}

                {/* Mock UI Preview (Dark) */}
                <div className="w-full h-32 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 border border-white/10 p-3 flex flex-col justify-between overflow-hidden shadow-inner mb-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </div>
                    <div className="w-24 h-2 bg-white/10 rounded-full" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-14 rounded-xl bg-slate-900/80 border border-white/10 p-2 shadow-xs flex flex-col justify-between">
                      <div className="w-6 h-1.5 bg-blue-400 rounded-full" />
                      <div className="w-10 h-3 bg-blue-600 rounded-sm font-bold text-[9px] flex items-center justify-center text-white">
                        $48.2k
                      </div>
                    </div>
                    <div className="h-14 rounded-xl bg-slate-900/80 border border-white/10 p-2 shadow-xs flex flex-col justify-between">
                      <div className="w-6 h-1.5 bg-emerald-400 rounded-full" />
                      <div className="w-8 h-3 bg-emerald-600 rounded-sm font-bold text-[9px] flex items-center justify-center text-white">
                        +14%
                      </div>
                    </div>
                    <div className="h-14 rounded-xl bg-slate-900/80 border border-white/10 p-2 shadow-xs flex flex-col justify-between">
                      <div className="w-6 h-1.5 bg-indigo-400 rounded-full" />
                      <div className="w-9 h-3 bg-white/20 rounded-sm" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-base text-slate-900 dark:text-white">
                      Dark Space Mode
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Deep slate, dark cobalt accents and low-light styling for night usage and minimal eye strain.
                    </p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isDark
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {isDark && <FiCheck className="text-xs stroke-[3]" />}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Visual Polish Preferences */}
          <div
            className={`p-6 rounded-3xl border backdrop-blur-xl ${
              isDark
                ? 'bg-slate-900/50 border-white/10'
                : 'bg-white/40 border-slate-200/80 shadow-xl shadow-slate-500/30'
            }`}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <FiZap className="text-amber-500" /> Visual & Motion Accents
            </h3>

            <div className="space-y-4">
              {/* Ambient Glow Animations */}
              <div className="flex items-center justify-between py-2 border-b border-slate-200/80 dark:border-white/10">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    Ambient Glow Fluid Animation
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Renders dynamic background color orbs that gently drift and illuminate sidebar cards.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateDisplayPref('ambientGlow', !displayPrefs.ambientGlow)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    displayPrefs.ambientGlow ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  role="switch"
                  aria-checked={displayPrefs.ambientGlow}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      displayPrefs.ambientGlow ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Auto Scroll to Top */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    Floating 'Back to Top' Button
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Displays a quick smooth-scroll trigger when reviewing long tables and catalog lists.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateDisplayPref('autoScrollToTop', !displayPrefs.autoScrollToTop)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    displayPrefs.autoScrollToTop ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  role="switch"
                  aria-checked={displayPrefs.autoScrollToTop}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      displayPrefs.autoScrollToTop ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: NOTIFICATIONS, CUSTOMIZATION & BROWSER GUIDE
          ======================================================== */}
      {activeTab === 'notifications' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 1. Hero Permission Status & Quick Action Card */}
          <div
            className={`p-6 sm:p-7 rounded-3xl border transition-all relative overflow-hidden backdrop-blur-xl ${
              isDark
                ? 'bg-slate-900/60 border-white/10 shadow-2xl'
                : 'bg-white/80 border-slate-200/80 shadow-xl shadow-slate-900/5'
            }`}
          >
            {/* Ambient Background Glow */}
            <div
              className={`absolute -right-16 -top-16 w-64 h-64 rounded-full pointer-events-none filter blur-3xl opacity-20 ${
                browserPermission === 'granted'
                  ? 'bg-emerald-500'
                  : browserPermission === 'denied'
                  ? 'bg-rose-500'
                  : 'bg-amber-500'
              }`}
            />

            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
              <div className="flex items-start sm:items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 border shadow-md transition-transform duration-300 ${
                    browserPermission === 'granted'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : browserPermission === 'denied'
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  }`}
                >
                  {browserPermission === 'granted' ? (
                    <FiBell className="animate-pulse" />
                  ) : browserPermission === 'denied' ? (
                    <FiBellOff />
                  ) : (
                    <FiAlertCircle />
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      Browser Desktop Push Notifications
                    </h2>
                    <span
                      className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5 ${
                        browserPermission === 'granted'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : browserPermission === 'denied'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          browserPermission === 'granted'
                            ? 'bg-emerald-500 animate-ping'
                            : browserPermission === 'denied'
                            ? 'bg-rose-500'
                            : 'bg-amber-500 animate-pulse'
                        }`}
                      />
                      <span>
                        {browserPermission === 'granted'
                          ? 'Permission Granted (Active)'
                          : browserPermission === 'denied'
                          ? 'Permission Blocked / Denied'
                          : 'Permission Required'}
                      </span>
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    {browserPermission === 'granted'
                      ? 'Your browser is authorized to display OS-level push notifications. You will receive immediate alerts for incoming purchase orders and dispatch approvals even when working in other tabs.'
                      : browserPermission === 'denied'
                      ? 'Notifications are currently blocked by your browser settings. Desktop push banners will not appear until unblocked in your browser address bar. Check our troubleshooting guide below.'
                      : 'Enable desktop push notifications so sales managers and admins receive real-time alerts when new procurement orders are placed by sales executives.'}
                  </p>

                  {!isSecureOrigin() && (
                    <div className="mt-3.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-300">
                        <FiAlertTriangle className="text-amber-500 text-base shrink-0" />
                        <span>
                          <strong>"Not Secure" Browser Detected (HTTP):</strong> Chromium, Edge & Brave automatically suppress desktop notifications on non-HTTPS origins unless whitelisted.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsGuideOpen(true);
                          const el = document.getElementById('browser-notification-guide');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold whitespace-nowrap shadow-xs transition-colors shrink-0 cursor-pointer"
                      >
                        Open Not Secure Setup Guide &darr;
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full lg:w-auto">
                {browserPermission !== 'granted' && isBrowserNotificationSupported() && (
                  <button
                    type="button"
                    disabled={isRequestingPermission}
                    onClick={handleRequestPermission}
                    className="flex-1 lg:flex-none px-4 py-2.5 text-xs font-extrabold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <FiBell className="text-sm" />
                    <span>{isRequestingPermission ? 'Requesting...' : 'Enable Desktop Alerts'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="flex-1 lg:flex-none px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FiZap className="text-amber-500" />
                  <span>Send Test Alert</span>
                </button>

                <button
                  type="button"
                  onClick={handleRefreshPermission}
                  title="Check browser permission again"
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer"
                >
                  <FiRefreshCw className="text-sm" />
                </button>
              </div>
            </div>
          </div>

          {/* 3. Master Alert Channels */}
          <div
            className={`p-6 rounded-3xl border backdrop-blur-xl ${
              isDark
                ? 'bg-slate-900/50 border-white/10'
                : 'bg-white/40 border-slate-200/80 shadow-lg shadow-slate-500/50'
            }`}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <FiSliders className="text-blue-500" /> Master Notification Channels
            </h3>

            <div className="space-y-4">
              {/* Browser Desktop Push */}
              <div className="flex items-center justify-between py-2 border-b border-slate-200/80 dark:border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Desktop System Push Banners
                    </p>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      OS Level
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Deliver native popups through Windows / macOS notification centers even when tab is backgrounded.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleNotificationToggle('browserAlertsEnabled')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notificationConfig.browserAlertsEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  role="switch"
                  aria-checked={notificationConfig.browserAlertsEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      notificationConfig.browserAlertsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Sound Chimes */}
              <div className="flex items-center justify-between py-2 border-b border-slate-200/80 dark:border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Audio Notification Chimes
                    </p>
                    <button
                      type="button"
                      onClick={() => handleTestSound()}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <FiVolume2 /> Test Chime
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Play a gentle audible ping on newly incoming purchase orders and urgent alerts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleNotificationToggle('soundEnabled')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notificationConfig.soundEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  role="switch"
                  aria-checked={notificationConfig.soundEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      notificationConfig.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toast Alerts Master */}
              <div className="flex items-center justify-between py-2 border-b border-slate-200/80 dark:border-white/10">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    In-App Floating Toast Banners
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Render real-time floating status banners inside the top corner of the admin portal.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleNotificationToggle('toastAlertsEnabled')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notificationConfig.toastAlertsEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  role="switch"
                  aria-checked={notificationConfig.toastAlertsEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      notificationConfig.toastAlertsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Quiet Hours / Do Not Disturb */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Do Not Disturb (Quiet Hours)
                    </p>
                    {notificationConfig.quietHoursEnabled && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isQuietHoursActive()
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-500'
                        }`}
                      >
                        {isQuietHoursActive() ? 'Currently Active' : 'Scheduled'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Automatically mute audible chimes and suppress desktop popups during off-hours or focus windows.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleQuietHoursToggle}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notificationConfig.quietHoursEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  role="switch"
                  aria-checked={notificationConfig.quietHoursEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      notificationConfig.quietHoursEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* 4. Audio & In-App Customization Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Audio Tone & Volume Customization */}
            <div
              className={`p-6 rounded-3xl border backdrop-blur-xl flex flex-col justify-between ${
                isDark
                  ? 'bg-slate-900/50 border-white/10'
                  : 'bg-white/40 border-slate-200/80 shadow-lg shadow-slate-500/30'
              }`}
            >
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                  <FiVolume2 className="text-blue-500" /> Audio Tone & Volume
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Select synthesizer tone style and listening volume level
                </p>

                {/* Tone Options */}
                <div className="space-y-2 mb-4">
                  {[
                    { key: 'chime', label: 'Chime', desc: 'Pleasant two-tone melody (F#5 & A5)' },
                    { key: 'bell', label: 'Bell Ping', desc: 'Resonant harmonic bell (E5)' },
                    { key: 'ping', label: 'Crisp Ping', desc: 'High-frequency alert ping (C6)' },
                    { key: 'subtle', label: 'Subtle Tap', desc: 'Soft wooden click (G4)' }
                  ].map((t) => {
                    const isSelected = (notificationConfig.soundType || 'chime') === t.key;
                    return (
                      <div
                        key={t.key}
                        onClick={() => handleSoundTypeChange(t.key)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-blue-500 bg-white dark:bg-blue-950/80'
                            : 'border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 bg-white/40 dark:bg-blue-400/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white block">
                              {t.label}
                            </span>
                            <span className="text-[11px] text-slate-400 block">{t.desc}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestSound(t.key);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <FiVolume1 className="text-xs" />
                          <span>Audition</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Volume selector */}
              <div className="pt-3 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Volume Level:</span>
                <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs font-semibold">
                  {[
                    { val: 0.3, label: '30% Soft' },
                    { val: 0.6, label: '60% Mid' },
                    { val: 1.0, label: '100% Full' }
                  ].map((v) => (
                    <button
                      key={v.val}
                      type="button"
                      onClick={() => handleSoundVolumeChange(v.val)}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        notificationConfig.soundVolume === v.val
                          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* In-App Toast & Quiet Hours Settings */}
            <div
              className={`p-6 rounded-3xl border backdrop-blur-xl flex flex-col justify-between ${
                isDark
                  ? 'bg-slate-900/50 border-white/10'
                  : 'bg-white/40 border-slate-200/80 shadow-lg shadow-slate-500/30'
              }`}
            >
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                  <FiLayout className="text-blue-500" /> Toast Duration & Quiet Hours
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Configure on-screen banner persistence and scheduled mute windows
                </p>

                {/* Toast Duration Selector */}
                <div className="space-y-3 mb-5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Toast Auto-Dismiss Duration:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { ms: 3000, label: '3 Seconds' },
                      { ms: 5000, label: '5 Seconds' },
                      { ms: 8000, label: '8 Seconds' },
                      { ms: 12000, label: '12 Seconds' },
                      { ms: 0, label: 'Manual Dismiss' }
                    ].map((dur) => (
                      <button
                        key={dur.ms}
                        type="button"
                        onClick={() => handleToastDurationChange(dur.ms)}
                        className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          notificationConfig.toastDuration === dur.ms
                            ? 'border-blue-600 bg-white dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 shadow-xs'
                            : 'border-slate-200/80 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300 bg-white/40 dark:bg-blue-400/5'
                        }`}
                      >
                        {dur.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quiet Hours Schedule Configuration */}
                {notificationConfig.quietHoursEnabled && (
                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3 animate-in fade-in duration-150">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 block">
                      Scheduled Quiet Window (24h format):
                    </span>
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 block mb-1">Mute from:</span>
                        <input
                          type="time"
                          value={notificationConfig.quietHoursStart || '22:00'}
                          onChange={(e) => handleQuietHoursTimeChange('quietHoursStart', e.target.value)}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-white"
                        />
                      </div>
                      <span className="text-slate-400 font-bold mt-4">&rarr;</span>
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 block mb-1">Until:</span>
                        <input
                          type="time"
                          value={notificationConfig.quietHoursEnd || '07:00'}
                          onChange={(e) => handleQuietHoursTimeChange('quietHoursEnd', e.target.value)}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Placement selector */}
              <div className="pt-3 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Screen Position:</span>
                <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs font-semibold">
                  {['top-right', 'top-center', 'bottom-right'].map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => handleToastPositionChange(pos)}
                      className={`px-2.5 py-1 rounded-lg capitalize transition-all cursor-pointer ${
                        (notificationConfig.toastPosition || 'top-right') === pos
                          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {pos.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 5. Notification Categories & Polling Intervals */}
          <div
            className={`p-6 rounded-3xl border backdrop-blur-xl ${
              isDark
                ? 'bg-slate-900/50 border-white/10'
                : 'bg-white/40 border-slate-200/80 shadow-lg shadow-slate-500/30'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <FiClock className="text-blue-500" /> Category Channels & Polling Intervals
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Granularly subscribe to business events and tune background check intervals
                </p>
              </div>
            </div>

            <div className="max-w-md">
              {[
                {
                  key: 'orders',
                  label: 'Purchase Orders & Dispatch',
                  desc: 'Real-time alerts when sales reps create POs or when dispatch approvals occur.',
                  icon: FiShoppingBag,
                  color: 'text-blue-500 bg-blue-500/10 border-blue-500/20'
                }
              ].map((cat) => {
                const isEnabled = notificationConfig.categories?.[cat.key] !== false;
                const interval = notificationConfig.pollingIntervals?.[cat.key] || 30;
                const IconComponent = cat.icon;

                return (
                  <div
                    key={cat.key}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      isEnabled
                        ? isDark
                          ? 'bg-white/[0.02] border-white/10 shadow-xs'
                          : 'bg-slate-50/80 border-slate-200/80 shadow-xs'
                        : 'opacity-55 bg-transparent border-dashed border-slate-300 dark:border-white/5'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg border ${cat.color}`}>
                            <IconComponent className="text-sm" />
                          </div>
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                            {cat.label}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCategoryToggle(cat.key)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                          role="switch"
                          aria-checked={isEnabled}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                              isEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-snug">
                        {cat.desc}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-white/5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Frequency:
                      </span>
                      <div className="w-[130px]">
                        <CustomDropdown
                          value={interval}
                          disabled={!isEnabled}
                          onChange={(val) => handleIntervalChange(cat.key, Number(val))}
                          options={[
                            { value: 15, label: '15s (Realtime)' },
                            { value: 30, label: '30s (Default)' },
                            { value: 60, label: '60s (Standard)' },
                            { value: 120, label: '2 mins (Eco)' }
                          ]}
                          statusColor="!py-1 !px-2.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. Step-by-Step Browser Notification Setup & Troubleshooting Guide (Not Secure Browsers) */}
          <div
            id="browser-notification-guide"
            className={`rounded-3xl border backdrop-blur-xl transition-all overflow-hidden ${
              isDark
                ? 'bg-slate-900/60 border-white/10'
                : 'bg-white/60 border-slate-200/80 shadow-lg shadow-slate-500/20'
            }`}
          >
            {/* Guide Header Banner */}
            <div
              onClick={() => setIsGuideOpen(!isGuideOpen)}
              className="p-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between cursor-pointer group select-none"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl border shadow-xs transition-colors ${
                    !isSecureOrigin()
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                  }`}
                >
                  {!isSecureOrigin() ? <FiUnlock /> : <FiCompass />}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      Browser Setup & Troubleshooting Guide
                    </h3>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                        !isSecureOrigin()
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                      }`}
                    >
                      {!isSecureOrigin() ? 'Action Required: Not Secure Browser' : 'HTTP & Not Secure Setup'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Step-by-step instructions to enable desktop notifications on "Not Secure" browsers, HTTP origins & local network IPs
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">
                  {isGuideOpen ? 'Hide Guide' : 'Show Guide'}
                </span>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  {isGuideOpen ? <FiChevronUp /> : <FiChevronDown />}
                </div>
              </div>
            </div>

            {/* Guide Body */}
            {isGuideOpen && (
              <div className="p-6 space-y-6 animate-in fade-in duration-200">
                {/* 1. Context Explanation & Whitelist Helper Banner */}
                <div
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    !isSecureOrigin()
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                      : 'bg-blue-500/10 border-blue-500/20 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 text-base mt-0.5">
                      <FiAlertTriangle />
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-extrabold tracking-tight">
                          Why Modern Browsers Block Notifications on "Not Secure" (HTTP) Origins
                        </h4>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                            isSecureOrigin()
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {isSecureOrigin() ? 'Secure Context Active' : 'Not Secure Connection'}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed opacity-90">
                        Modern Chromium browsers (Google Chrome, Microsoft Edge, Brave) and Mozilla Firefox enforce the{' '}
                        <strong>W3C Secure Contexts standard</strong>. When opening an admin dashboard via plain HTTP (e.g.{' '}
                        <code className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px]">
                          http://192.168.x.x
                        </code>{' '}
                        or unencrypted network domains), the browser shows a <strong className="underline">"Not secure"</strong> badge and permanently suppresses desktop notification prompts. Follow the instructions below to enable the browser flag or site permission.
                      </p>

                      {/* Origin Copy & Flag Shortcut Box */}
                      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-black/10 dark:border-white/10">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-600 dark:text-slate-400">Current Dashboard Origin:</span>
                          <code className="px-2 py-1 rounded-lg bg-black/10 dark:bg-white/10 font-mono text-[11px] font-bold select-all">
                            {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}
                          </code>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopySiteUrl}
                            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                          >
                            <FiCopy className="text-xs text-blue-500" />
                            <span>Copy Origin URL</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                'chrome://flags/#unsafely-treat-insecure-origin-as-secure',
                                'Chrome flag URL copied! Paste into Chrome address bar.'
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          >
                            <FiCompass className="text-xs" />
                            <span>Copy Chrome Flag URL</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Browser Selection Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {[
                    { key: 'chrome', label: 'Chrome / Brave (Not Secure)', icon: FiCompass },
                    { key: 'edge', label: 'Microsoft Edge (Not Secure)', icon: FiMonitor },
                    { key: 'firefox', label: 'Mozilla Firefox', icon: FiShield },
                    { key: 'localhost', label: 'Localhost Workaround', icon: FiTerminal },
                    { key: 'windows', label: 'Windows OS Alerts', icon: FiSliders },
                    { key: 'faq', label: 'Not Secure FAQs', icon: FiHelpCircle }
                  ].map((tab) => {
                    const TabIcon = tab.icon;
                    const isActive = guideBrowserTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setGuideBrowserTab(tab.key)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <TabIcon className="text-xs" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 3. Tab Instructions Content */}
                <div className="p-5 sm:p-6 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5">
                  {/* TAB: CHROME / BRAVE */}
                  {guideBrowserTab === 'chrome' && (
                    <div className="space-y-6">
                      {/* Method 1: Insecure Flag */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-extrabold uppercase">
                            Method 1 (Recommended & 100% Reliable)
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Enable the "Insecure Origins Treated as Secure" Chrome Flag
                          </h4>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          This tells Google Chrome or Brave to whitelist this specific HTTP address as a secure origin, enabling native desktop push notifications permanently without requiring an SSL certificate.
                        </p>

                        <div className="space-y-3 pl-2 sm:pl-4 border-l-2 border-blue-500/30">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px]">
                                1
                              </span>
                              <span>Open Chrome's Insecure Origin Flag Page</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 pl-7 leading-relaxed">
                              Open a new tab in Chrome, paste the following URL into the address bar, and press Enter:
                            </p>
                            <div className="pl-7 pt-1 flex items-center gap-2">
                              <code className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-mono text-[11px] font-bold select-all">
                                chrome://flags/#unsafely-treat-insecure-origin-as-secure
                              </code>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyText(
                                    'chrome://flags/#unsafely-treat-insecure-origin-as-secure',
                                    'Chrome flag URL copied to clipboard!'
                                  )
                                }
                                className="px-2.5 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <FiCopy className="text-xs" />
                                <span>Copy</span>
                              </button>
                            </div>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 pl-7 block">
                              (For Brave browser users, open: <code className="font-mono">brave://flags/#unsafely-treat-insecure-origin-as-secure</code>)
                            </span>
                          </div>

                          <div className="space-y-1 pt-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px]">
                                2
                              </span>
                              <span>Enable the Setting and Enter This Dashboard's URL</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 pl-7 leading-relaxed">
                              Find the highlighted flag <strong>"Insecure origins treated as secure"</strong>. Switch its dropdown from <strong className="text-rose-500">Disabled</strong> to <strong className="text-emerald-500">Enabled</strong>.
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 pl-7 leading-relaxed">
                              In the text box that appears directly underneath, paste your exact site origin:
                            </p>
                            <div className="pl-7 pt-1 flex items-center gap-2">
                              <code className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-bold select-all">
                                {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}
                              </code>
                              <button
                                type="button"
                                onClick={handleCopySiteUrl}
                                className="px-2.5 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <FiCopy className="text-xs" />
                                <span>Copy Origin</span>
                              </button>
                            </div>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 pl-7 block">
                              Tip: If you have multiple ports or test IPs, separate them with commas (e.g.{' '}
                              <code className="font-mono">http://192.168.1.50:5173, http://192.168.1.50:3000</code>).
                            </span>
                          </div>

                          <div className="space-y-1 pt-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px]">
                                3
                              </span>
                              <span>Click "Relaunch" and Allow Notifications</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 pl-7 leading-relaxed">
                              Click the blue <strong className="text-blue-600 dark:text-blue-400">Relaunch</strong> button at the bottom-right corner of Chrome. Once Chrome reopens, return to this tab, click{' '}
                              <strong className="text-slate-900 dark:text-white">"Enable Desktop Alerts"</strong> at the top of this page, and click <strong className="text-emerald-500">Allow</strong> when prompted!
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Method 2: Site Settings */}
                      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-[11px] font-extrabold uppercase">
                            Method 2 (Alternative)
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Address Bar "Not Secure" Site Settings
                          </h4>
                        </div>
                        <div className="space-y-2 pl-2 sm:pl-4 text-xs text-slate-600 dark:text-slate-400">
                          <p>
                            1. Look at the address bar where it says <strong className="text-rose-500">"Not secure"</strong> or displays a sliders/tune icon next to the URL.
                          </p>
                          <p>
                            2. Click on <strong className="text-slate-900 dark:text-white">"Not secure"</strong> &rarr; click <strong className="text-slate-900 dark:text-white">"Site settings"</strong>.
                          </p>
                          <p>
                            3. Locate <strong className="text-slate-900 dark:text-white">Notifications</strong> &rarr; change the dropdown from "Block (default)" to{' '}
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                              Allow
                            </span>.
                          </p>
                          <p>
                            4. Scroll down to <strong className="text-slate-900 dark:text-white">Insecure content</strong> &rarr; change from "Block" to{' '}
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                              Allow
                            </span>.
                          </p>
                          <p>
                            5. Return to this dashboard tab and click the <strong className="text-blue-500">Reload</strong> banner or press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">Ctrl + R</kbd>.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB: MICROSOFT EDGE */}
                  {guideBrowserTab === 'edge' && (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-extrabold uppercase">
                            Method 1 (Recommended)
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Enable the Insecure Origins Flag in Microsoft Edge
                          </h4>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          Microsoft Edge is built on Chromium and respects the same flag. Once enabled, Edge will treat this HTTP IP as secure.
                        </p>

                        <div className="space-y-3 pl-2 sm:pl-4 border-l-2 border-blue-500/30">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px]">
                                1
                              </span>
                              <span>Open Edge's Insecure Origins Flag</span>
                            </div>
                            <div className="pl-7 pt-1 flex items-center gap-2">
                              <code className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-mono text-[11px] font-bold select-all">
                                edge://flags/#unsafely-treat-insecure-origin-as-secure
                              </code>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyText(
                                    'edge://flags/#unsafely-treat-insecure-origin-as-secure',
                                    'Edge flag URL copied to clipboard!'
                                  )
                                }
                                className="px-2.5 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <FiCopy className="text-xs" />
                                <span>Copy</span>
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1 pt-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px]">
                                2
                              </span>
                              <span>Set to Enabled & Paste Portal Origin</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 pl-7 leading-relaxed">
                              Switch the dropdown to <strong>Enabled</strong> and paste this portal origin:
                            </p>
                            <div className="pl-7 pt-1 flex items-center gap-2">
                              <code className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-bold select-all">
                                {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}
                              </code>
                              <button
                                type="button"
                                onClick={handleCopySiteUrl}
                                className="px-2.5 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <FiCopy className="text-xs" />
                                <span>Copy Origin</span>
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1 pt-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px]">
                                3
                              </span>
                              <span>Restart Edge and Grant Permission</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 pl-7 leading-relaxed">
                              Click the <strong className="text-blue-600 dark:text-blue-400">Restart</strong> button at the bottom-right corner of Edge. Return here and click <strong className="text-slate-900 dark:text-white">"Enable Desktop Alerts"</strong>.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Edge Method 2 */}
                      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-[11px] font-extrabold uppercase">
                            Method 2 (Alternative)
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Edge Address Bar Permissions
                          </h4>
                        </div>
                        <div className="space-y-2 pl-2 sm:pl-4 text-xs text-slate-600 dark:text-slate-400">
                          <p>
                            1. Click the <strong className="text-rose-500">"Not secure"</strong> badge or Lock icon in Edge address bar.
                          </p>
                          <p>
                            2. Click <strong className="text-slate-900 dark:text-white">Permissions for this site</strong>.
                          </p>
                          <p>
                            3. Locate <strong className="text-slate-900 dark:text-white">Notifications</strong> &rarr; choose{' '}
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                              Allow
                            </span>.
                          </p>
                          <p>
                            4. Reload this page to apply changes.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB: MOZILLA FIREFOX */}
                  {guideBrowserTab === 'firefox' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          1
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Open Firefox Advanced Config (about:config)
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        Open a new tab in Firefox and type <code className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[11px] font-bold">about:config</code> into the address bar. Click <strong className="text-slate-900 dark:text-white">"Accept the Risk and Continue"</strong>.
                      </p>

                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          2
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Permit Insecure Web Notifications
                        </h4>
                      </div>
                      <div className="pl-8 space-y-2">
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          In the search box at the top, paste the following preference:
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-mono text-[11px] font-bold select-all">
                            dom.webnotifications.allow_insecure
                          </code>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                'dom.webnotifications.allow_insecure',
                                'Preference name copied!'
                              )
                            }
                            className="px-2.5 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <FiCopy className="text-xs" />
                            <span>Copy</span>
                          </button>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          Double-click the row or click the toggle button on the right to set its value to{' '}
                          <strong className="text-emerald-500 font-mono font-bold">true</strong>.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          3
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Reload & Click the Shield / Permission Icon
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        Return to this dashboard, press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">F5</kbd>, and click <strong className="text-blue-600 dark:text-blue-400">"Enable Desktop Alerts"</strong>. Firefox will now display the native permission dialog. Select <strong className="text-emerald-500">Always Allow</strong>.
                      </p>
                    </div>
                  )}

                  {/* TAB: LOCALHOST WORKAROUND */}
                  {guideBrowserTab === 'localhost' && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                          <FiZap className="text-base" />
                          <span>Instant Localhost Workaround (Zero Browser Configuration)</span>
                        </div>
                        <p className="leading-relaxed">
                          By web security design, all modern browsers treat <strong className="text-slate-900 dark:text-white font-mono">http://localhost</strong> and <strong className="text-slate-900 dark:text-white font-mono">http://127.0.0.1</strong> as <strong>intrinsically secure origins</strong>, even over plain HTTP!
                        </p>
                        <p className="leading-relaxed">
                          If you are opening the browser on the same computer where this dashboard is hosted:
                        </p>
                        <div className="p-3 rounded-lg bg-black/10 dark:bg-white/5 font-mono text-xs text-slate-900 dark:text-white space-y-1">
                          <div className="text-rose-500 line-through">
                            http://192.168.x.x:5173 (Triggers "Not Secure" block)
                          </div>
                          <div className="text-emerald-500 font-bold flex items-center justify-between gap-2">
                            <span>http://localhost:5173 (Recognized as Secure Context!)</span>
                            <button
                              type="button"
                              onClick={() => handleCopyText('http://localhost:5173', 'Localhost URL copied!')}
                              className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold cursor-pointer"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Simply browse using localhost and you will be able to click "Enable Desktop Alerts" immediately without changing any browser flags!
                        </p>
                      </div>

                      <div className="pt-2 space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <FiCheckCircle className="text-emerald-500" /> In-App Sounds & Floating Toasts Always Work
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Even if you cannot adjust browser flags or native push remains blocked on a remote HTTP browser, our <strong>In-App Floating Toasts</strong> and <strong>Web Audio Sound Chimes</strong> do not require HTTPS or browser permission. You will still receive realtime alerts for purchase orders as long as this admin tab is open.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* TAB: WINDOWS OS SETTINGS */}
                  {guideBrowserTab === 'windows' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          1
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Check Windows 11 / 10 "Focus Assist" or "Do Not Disturb"
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        Open the Windows Notification Center (click date/time in the bottom-right corner or press{' '}
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">Win + N</kbd>). If the{' '}
                        <strong className="text-slate-900 dark:text-white">Bell with Zzz (Do Not Disturb)</strong> is active, Windows will silence all desktop popups! Turn it off to see popups.
                      </p>

                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          2
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Enable Browser Notifications in Windows Settings
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">Win + I</kbd> to open Windows Settings &rarr;{' '}
                        <strong className="text-slate-900 dark:text-white">System &rarr; Notifications</strong>. Ensure "Notifications" is toggled{' '}
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                          On
                        </span>.
                      </p>

                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          3
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Allow Google Chrome / Edge Banners
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        Scroll down to "Notifications from apps and other senders", click on your browser (Chrome or Edge), and make sure{' '}
                        <strong className="text-slate-900 dark:text-white">"Show notification banners"</strong> is checked.
                      </p>
                    </div>
                  )}

                  {/* TAB: NOT SECURE FAQS */}
                  {guideBrowserTab === 'faq' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <FiHelpCircle className="text-blue-500" /> Why does my browser show "Not Secure" next to the URL?
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Your browser shows "Not Secure" because the portal is loaded over unencrypted HTTP rather than HTTPS with an SSL certificate. This is normal for local office networks, intranet IP addresses (e.g. 192.168.x.x), or internal staging servers.
                        </p>
                      </div>

                      <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <FiHelpCircle className="text-blue-500" /> Why doesn't the notification prompt appear when I click "Enable Desktop Alerts"?
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Chromium browsers silently reject or suppress notification permission requests on non-HTTPS origins by default. Enabling the <code className="font-mono text-[11px] text-blue-500">#unsafely-treat-insecure-origin-as-secure</code> flag bypasses this restriction for this specific address.
                        </p>
                      </div>

                      <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <FiHelpCircle className="text-blue-500" /> Does whitelisting this origin compromise my computer security?
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          No. The flag only elevates permissions for the exact origin URL(s) you enter into the whitelist text box. All other internet browsing remains strictly guarded under standard security rules.
                        </p>
                      </div>

                      <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <FiHelpCircle className="text-blue-500" /> Can we enable SSL / HTTPS so employees don't need to configure flags?
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Yes! For network-wide internal use without client-side flags, your IT administrator can install a trusted local SSL certificate using tools like <code className="font-mono text-[11px]">mkcert</code>, Let's Encrypt with internal DNS, or put the panel behind an Nginx/Caddy HTTPS reverse proxy.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Live System Diagnostics Table with Insecure Origin Status */}
                <div className="pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                    <FiShield className="text-emerald-500" /> Live Connection & Diagnostics Checklist
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 block font-medium">Security Context:</span>
                      <span
                        className={`text-xs font-bold flex items-center gap-1 mt-0.5 ${
                          isSecureOrigin()
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isSecureOrigin() ? (
                          <FiCheckCircle className="text-xs" />
                        ) : (
                          <FiAlertTriangle className="text-xs" />
                        )}
                        {isSecureOrigin() ? 'Secure (HTTPS / Localhost)' : 'Not Secure (HTTP Origin)'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 block font-medium">Permission State:</span>
                      <span
                        className={`text-xs font-bold capitalize flex items-center gap-1 mt-0.5 ${
                          browserPermission === 'granted'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : browserPermission === 'denied'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {browserPermission === 'granted' ? (
                          <FiCheckCircle className="text-xs" />
                        ) : (
                          <FiAlertCircle className="text-xs" />
                        )}
                        {browserPermission}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 block font-medium">Web Audio Engine:</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                        <FiCheckCircle className="text-xs" /> Synthesizer Ready
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 block font-medium">In-App Floating Toasts:</span>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5">
                        <FiCheckCircle className="text-xs" /> Always Active
                      </span>
                    </div>
                  </div>

                  {/* Diagnostic Footer Quick Actions */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/60 dark:border-white/5 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Current Site Origin: <code className="font-mono font-bold text-slate-700 dark:text-slate-300">{typeof window !== 'undefined' ? window.location.origin : ''}</code>
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopySiteUrl}
                        className="px-3 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FiCopy className="text-xs" />
                        <span>Copy Origin URL</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(
                            'chrome://flags/#unsafely-treat-insecure-origin-as-secure',
                            'Chrome Flag URL copied to clipboard!'
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FiCompass className="text-xs" />
                        <span>Copy Chrome Flag</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleTestNotification}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      >
                        <FiZap className="text-xs text-amber-400" />
                        <span>Trigger Test Alert</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: DISPLAY & LAYOUT PREFERENCES
          ======================================================== */}
      {activeTab === 'display' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div
            className={`p-6 rounded-3xl border backdrop-blur-xl ${
              isDark
                ? 'bg-slate-900/50 border-white/10'
                : 'bg-white/40 border-slate-200/80 shadow-lg shadow-slate-500/30'
            }`}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <FiLayout className="text-blue-500" /> Data Density & Tables
            </h3>

            <div className="space-y-5">
              {/* Density selector */}
              <div>
                <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
                  Table & Card Spacing Density
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                  <div
                    onClick={() => updateDisplayPref('density', 'comfortable')}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                      displayPrefs.density === 'comfortable'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <div>
                      <p className={`text-xs font-bold text-slate-900 dark:text-white ${displayPrefs.density === 'comfortable' ? 'text-white' : ''}`}>Comfortable</p>
                      <p className={`text-[11px] text-slate-500 dark:text-slate-400 ${displayPrefs.density === 'comfortable' ? 'text-white' : ''}`}>
                        Generous padding for easier reading
                      </p>
                    </div>
                    {displayPrefs.density === 'comfortable' && (
                      <FiCheck className="text-blue-600 font-bold" />
                    )}
                  </div>

                  <div
                    onClick={() => updateDisplayPref('density', 'compact')}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                      displayPrefs.density === 'compact'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <div>
                      <p className={`text-xs font-bold text-slate-900 dark:text-white ${displayPrefs.density === 'compact' ? 'text-white' : ''}`}>Compact</p>
                      <p className={`text-[11px] text-slate-500 dark:text-slate-400 ${displayPrefs.density === 'compact' ? 'text-white' : ''}`}>
                        Dense rows for maximum data density
                      </p>
                    </div>
                    {displayPrefs.density === 'compact' && (
                      <FiCheck className="text-blue-600 font-bold" />
                    )}
                  </div>
                </div>
              </div>

              {/* Time Format */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-white/10">
                <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
                  Time Display Format
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => updateDisplayPref('timeFormat', '12h')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      displayPrefs.timeFormat === '12h'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                    }`}
                  >
                    12-Hour (e.g. 02:30 PM)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDisplayPref('timeFormat', '24h')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      displayPrefs.timeFormat === '24h'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                    }`}
                  >
                    24-Hour (e.g. 14:30)
                  </button>
                </div>
              </div>

              {/* Default Table & List Rows Per Page */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 dark:text-white">
                      Default Rows Per Page
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Sets the global pagination row limit across all data tables and lists
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[10, 20, 50, 100].map((count) => {
                      const isSelected = (displayPrefs.rowsPerPage || 10) === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() => updateDisplayPref('rowsPerPage', count)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                              : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                          }`}
                        >
                          {count} rows
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 4: SYSTEM & STORAGE DIAGNOSTICS
          ======================================================== */}
      {activeTab === 'system' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Panel Telemetry Overview */}
          <div
            className={`p-6 rounded-3xl border backdrop-blur-xl ${
              isDark
                ? 'bg-slate-900/50 border-white/10'
                : 'bg-white/40 border-slate-200/80 shadow-lg shadow-slate-500/30'
            }`}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <FiActivity className="text-blue-500" /> Admin Environment Telemetry
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Panel Build
                </p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  v2.4.0 (Enterprise)
                </p>
                <p className="text-[11px] text-emerald-500 font-semibold mt-1 flex items-center gap-1">
                  <FiCheckCircle /> Up to date
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Active Operator
                </p>
                <p className="text-base font-black text-slate-900 dark:text-white mt-1 truncate">
                  {user?.email || 'admin@inizio.in'}
                </p>
                <p className="text-[11px] text-blue-500 font-semibold mt-1 uppercase">
                  {user?.role || 'ADMIN'} Privileges
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Framework Stack
                </p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  React 19 & Vite 8
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Tailwind CSS v4 Engine
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Client Cache Usage
                </p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  ~{storageUsage.usedKb} KB
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {storageUsage.itemsCount} stored keys
                </p>
              </div>
            </div>
          </div>

          {/* Reset Preferences Card */}
          <div
            className={`p-6 rounded-3xl border border-rose-500/20 backdrop-blur-xl shadow-xl ${
              isDark ? 'bg-rose-950/10' : 'bg-rose-50/40'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <FiTrash2 /> Reset All Panel Preferences
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
                  Restore panel theme back to default <strong>Light Mode</strong>, reset notification intervals,
                  and clear cached UI layout preferences. Your user account and database data will not be affected.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetPreferences}
                className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 transition-all cursor-pointer shrink-0"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
