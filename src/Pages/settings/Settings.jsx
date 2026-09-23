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
  FiImage
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
  const [guideBrowserTab, setGuideBrowserTab] = useState('chrome'); // 'chrome' | 'edge' | 'safari' | 'firefox' | 'windows'
  const [isGuideOpen, setIsGuideOpen] = useState(false);
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

  // Copy site URL
  const handleCopySiteUrl = () => {
    try {
      navigator.clipboard.writeText(window.location.origin);
      triggerFeedback('Site URL copied to clipboard!');
    } catch {
      triggerFeedback('Unable to copy URL automatically', 'error');
    }
  };

  // Request native permission
  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    try {
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
      } else if (currentPerm === 'denied') {
        triggerFeedback('Notifications were blocked in your browser settings.', 'error');
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
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                            : 'border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15'
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
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-xs'
                            : 'border-slate-200/80 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300'
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

          {/* 6. Step-by-Step Browser Notification Setup & Troubleshooting Guide */}
          <div
            id="browser-notification-guide"
            className={`rounded-3xl border backdrop-blur-xl transition-all overflow-hidden ${
              isDark
                ? 'bg-slate-900/60 border-white/10'
                : 'bg-white/40 border-slate-200/80 shadow-lg shadow-slate-500/30'
            }`}
          >
            {/* Guide Header Banner */}
            <div
              onClick={() => setIsGuideOpen(!isGuideOpen)}
              className="p-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg border border-blue-500/20 shadow-xs">
                  <FiCompass />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      Browser Setup & Troubleshooting Guide
                    </h3>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      Step-by-Step
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Instructions for Chrome, Edge, Safari, Firefox & Windows OS Notification settings
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
                {/* Browser Selection Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {[
                    { key: 'chrome', label: 'Chrome / Brave', icon: FiCompass },
                    { key: 'edge', label: 'Microsoft Edge', icon: FiMonitor },
                    { key: 'safari', label: 'Apple Safari', icon: FiCompass },
                    { key: 'firefox', label: 'Mozilla Firefox', icon: FiShield },
                    { key: 'windows', label: 'Windows 11 / 10 OS', icon: FiSliders }
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

                {/* Tab Instructions Content */}
                <div className="p-5 sm:p-6 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5">
                  {guideBrowserTab === 'chrome' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          1
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Click the "Site Information" icon in the Address Bar
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        In Google Chrome or Brave, look at the address bar at the top of your screen. Click the{' '}
                        <strong className="text-slate-900 dark:text-white">Tune / Sliders icon</strong> (or padlock) immediately to the left of the URL.
                      </p>

                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          2
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Toggle "Notifications" to Allow
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        In the popup menu that appears, locate <strong className="text-slate-900 dark:text-white">Notifications</strong> and switch the toggle to{' '}
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                          Allow
                        </span>.
                      </p>

                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          3
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Resetting Blocked Settings in Chrome Settings
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        If notifications remain blocked, open a new Chrome tab and navigate to:{' '}
                        <code className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-mono text-[11px]">
                          chrome://settings/content/notifications
                        </code>
                        . Ensure your site URL is listed under "Allowed to send notifications".
                      </p>
                    </div>
                  )}

                  {guideBrowserTab === 'edge' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          1
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Click the Padlock icon in Microsoft Edge
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        Click the <strong className="text-slate-900 dark:text-white">Lock icon 🔒</strong> on the left side of the address bar.
                      </p>

                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          2
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Select "Permissions for this site"
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        In the dropdown menu, locate <strong className="text-slate-900 dark:text-white">Notifications</strong> and select{' '}
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                          Allow
                        </span>.
                      </p>

                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          3
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Edge Global Permission Manager
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        To inspect Edge global notification exceptions, navigate to{' '}
                        <code className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-mono text-[11px]">
                          edge://settings/content/notifications
                        </code>{' '}
                        in a new tab.
                      </p>
                    </div>
                  )}

                  {guideBrowserTab === 'safari' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          1
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Open Safari Preferences / Settings
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        Click <strong className="text-slate-900 dark:text-white">Safari</strong> in the top macOS menu bar and choose{' '}
                        <strong className="text-slate-900 dark:text-white">Settings</strong> (or press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">Cmd + ,</kbd>).
                      </p>

                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          2
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Navigate to Websites &rarr; Notifications
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        Select the <strong className="text-slate-900 dark:text-white">Websites</strong> tab at the top, then choose{' '}
                        <strong className="text-slate-900 dark:text-white">Notifications</strong> in the left sidebar. Locate this admin site and select{' '}
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                          Allow
                        </span>.
                      </p>

                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          3
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Verify macOS System Settings
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        Ensure <strong className="text-slate-900 dark:text-white">System Settings &rarr; Notifications &rarr; Safari</strong> has "Allow Notifications" turned on.
                      </p>
                    </div>
                  )}

                  {guideBrowserTab === 'firefox' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          1
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Click the Shield / Permissions Icon
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        Click the permission toggle icon to the left of the URL bar in Firefox.
                      </p>

                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          2
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Clear "Blocked Temporarily" or Click Allow
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                        Remove any temporary block and toggle Notifications to{' '}
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                          Allowed
                        </span>.
                      </p>
                    </div>
                  )}

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
                </div>

                {/* 7. Live System Diagnostics Table */}
                <div className="pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                    <FiShield className="text-emerald-500" /> Live Diagnostics Checklist
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 block font-medium">Notification API:</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                        <FiCheckCircle className="text-xs" /> Supported
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
                      <span className="text-[10px] text-slate-400 block font-medium">Local Preferences:</span>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5">
                        <FiCheckCircle className="text-xs" /> Synced
                      </span>
                    </div>
                  </div>

                  {/* Diagnostic Footer Quick Actions */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/60 dark:border-white/5 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Need to copy this panel's origin URL for browser site settings?
                    </span>
                    <div className="flex items-center gap-2">
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
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Comfortable</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Compact</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
