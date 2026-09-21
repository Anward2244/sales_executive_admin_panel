import React, { useState } from 'react';
import {
  FiSettings,
  FiSun,
  FiMoon,
  FiBell,
  FiVolume2,
  FiLayout,
  FiCheck,
  FiCheckCircle,
  FiAlertCircle,
  FiTrash2,
  FiMonitor,
  FiZap,
  FiSliders,
  FiClock,
  FiLayers,
  FiActivity
} from 'react-icons/fi';
import { useTheme } from '@/Context/ThemeContext';
import { useAuth } from '@/Context/AuthContext';
import { useConfirm } from '@/Context/ConfirmationContext';
import PageHeader from '@/components/ui/PageHeader';
import {
  getNotificationSettings,
  saveNotificationSettings,
  isBrowserNotificationSupported,
  getNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  playNotificationSound,
  DEFAULT_NOTIFICATION_SETTINGS
} from '@/utils/browserNotifications';

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

  // Display Preferences State (Stored in LocalStorage)
  const [displayPrefs, setDisplayPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem('inizio_display_preferences');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      density: 'comfortable', // 'comfortable' | 'compact'
      ambientGlow: true,
      timeFormat: '12h', // '12h' | '24h'
      autoScrollToTop: true
    };
  });

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
    setDisplayPrefs(prev => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem('inizio_display_preferences', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save display prefs:', e);
      }
      return updated;
    });
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

  // Request native permission
  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    try {
      const granted = await requestBrowserNotificationPermission();
      setBrowserPermission(granted ? 'granted' : 'denied');
      if (granted) {
        triggerFeedback('Desktop notification permission granted!');
        showBrowserNotification('Notifications Active', {
          body: 'Auric Admin Panel desktop alerts are now configured.'
        });
      } else {
        triggerFeedback('Permission was not granted by your browser.', 'error');
      }
    } finally {
      setIsRequestingPermission(false);
    }
  };

  // Test sound
  const handleTestSound = () => {
    playNotificationSound();
    triggerFeedback('Sound chime triggered');
  };

  // Test desktop notification
  const handleTestNotification = () => {
    showBrowserNotification('Auric Panel Test Alert', {
      body: 'Real-time telemetry and push alerts are functioning properly.',
      icon: '/favicon.ico'
    });
    playNotificationSound();
    triggerFeedback('Test notification sent');
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
    const defaultDisplay = {
      density: 'comfortable',
      ambientGlow: true,
      timeFormat: '12h',
      autoScrollToTop: true
    };
    setDisplayPrefs(defaultDisplay);
    try {
      localStorage.setItem('inizio_display_preferences', JSON.stringify(defaultDisplay));
    } catch {
      // ignore
    }

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
                    : 'border-slate-200/50 dark:border-white/10 bg-white/40 dark:bg-slate-900/30 hover:border-blue-400/50'
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
                : 'bg-white/80 border-slate-200/80 shadow-md shadow-slate-900/5'
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
          TAB 2: NOTIFICATIONS & AUDIO ALERTS
          ======================================================== */}
      {activeTab === 'notifications' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Native Browser Notification Status Banner */}
          <div
            className={`p-6 rounded-3xl border backdrop-blur-xl ${
              isDark
                ? 'bg-slate-900/50 border-white/10'
                : 'bg-white/80 border-slate-200/80 shadow-md shadow-slate-900/5'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FiBell className="text-blue-500" /> Desktop Push Notifications
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Browser notification status:{' '}
                  <span
                    className={`font-bold capitalize ${
                      browserPermission === 'granted'
                        ? 'text-emerald-500'
                        : browserPermission === 'denied'
                        ? 'text-rose-500'
                        : 'text-amber-500'
                    }`}
                  >
                    {browserPermission}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {browserPermission !== 'granted' && isBrowserNotificationSupported() && (
                  <button
                    type="button"
                    disabled={isRequestingPermission}
                    onClick={handleRequestPermission}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isRequestingPermission ? 'Requesting...' : 'Enable Desktop Alerts'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 transition-all cursor-pointer"
                >
                  Send Test Alert
                </button>
              </div>
            </div>
          </div>

          {/* Master Channels */}
          <div
            className={`p-6 rounded-3xl border backdrop-blur-xl ${
              isDark
                ? 'bg-slate-900/50 border-white/10'
                : 'bg-white/80 border-slate-200/80 shadow-md shadow-slate-900/5'
            }`}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <FiSliders className="text-blue-500" /> Master Alert Channels
            </h3>

            <div className="space-y-4">
              {/* Browser Alerts Master */}
              <div className="flex items-center justify-between py-2 border-b border-slate-200/80 dark:border-white/10">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    Desktop System Notifications
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Show OS-level notification popups even when the browser tab is in the background.
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

              {/* Sound Master */}
              <div className="flex items-center justify-between py-2 border-b border-slate-200/80 dark:border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Audio Notification Chime
                    </p>
                    <button
                      type="button"
                      onClick={handleTestSound}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
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
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    In-App Floating Toast Banners
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Render top-right real-time status banners inside the admin panel.
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
            </div>
          </div>

          {/* Notification Categories & Polling Intervals */}
          <div
            className={`p-6 rounded-3xl border backdrop-blur-xl ${
              isDark
                ? 'bg-slate-900/50 border-white/10'
                : 'bg-white/80 border-slate-200/80 shadow-md shadow-slate-900/5'
            }`}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <FiClock className="text-blue-500" /> Category Channels & Polling Intervals
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'orders', label: 'Purchase Orders & Dispatch', desc: 'Alerts when buyers place or update order states.' },
                { key: 'quotes', label: 'Price Quote Requests', desc: 'Notifications for new and pending quotation bids.' },
                { key: 'users', label: 'New User Registrations', desc: 'Account approvals and KYC verification alerts.' },
                { key: 'chat', label: 'Live Customer Support Messages', desc: 'Direct messages from active buyer conversations.' },
                { key: 'brokenImages', label: 'Product Catalog Health', desc: 'Scans and alerts on missing item imagery.' },
                { key: 'apiRequests', label: 'API & Telemetry Health', desc: 'Network status drops and latency alerts.' }
              ].map(cat => {
                const isEnabled = notificationConfig.categories?.[cat.key] !== false;
                const interval = notificationConfig.pollingIntervals?.[cat.key] || 30;

                return (
                  <div
                    key={cat.key}
                    className={`p-4 rounded-2xl border transition-all ${
                      isEnabled
                        ? isDark
                          ? 'bg-white/[0.02] border-white/10'
                          : 'bg-slate-50 border-slate-200'
                        : 'opacity-60 bg-transparent border-dashed border-slate-300 dark:border-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {cat.label}
                      </span>
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
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{cat.desc}</p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-white/5">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Check Interval:
                      </span>
                      <select
                        value={interval}
                        disabled={!isEnabled}
                        onChange={(e) => handleIntervalChange(cat.key, e.target.value)}
                        className="text-xs font-bold py-1 px-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                      >
                        <option value={15}>15s (Realtime)</option>
                        <option value={30}>30s (Default)</option>
                        <option value={60}>60s (Standard)</option>
                        <option value={120}>2 mins (Eco)</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
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
                : 'bg-white/80 border-slate-200/80 shadow-md shadow-slate-900/5'
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
                : 'bg-white/80 border-slate-200/80 shadow-md shadow-slate-900/5'
            }`}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <FiActivity className="text-blue-500" /> Admin Environment Telemetry
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white/40 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10">
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

              <div className="p-4 rounded-2xl bg-white/40 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10">
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

              <div className="p-4 rounded-2xl bg-white/40 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10">
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

              <div className="p-4 rounded-2xl bg-white/40 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10">
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
            className={`p-6 rounded-3xl border border-rose-500/20 backdrop-blur-xl ${
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
