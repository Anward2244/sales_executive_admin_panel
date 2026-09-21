import appIconImg from '../assets/auric.png';

/**
 * Utility for handling native browser notifications, permissions, preferences, and audio feedback
 */

const SETTINGS_KEY = 'inizio_notification_settings_v1';

export const DEFAULT_NOTIFICATION_SETTINGS = {
  browserAlertsEnabled: true, // in-app master switch for desktop notifications
  toastAlertsEnabled: true,   // in-app master switch for floating toasts
  soundEnabled: true,         // in-app sound chime toggle
  soundType: 'chime',         // 'chime' | 'bell' | 'ping' | 'subtle'
  soundVolume: 0.8,           // 0.1 to 1.0
  toastDuration: 5000,        // toast auto-dismiss duration in ms
  toastPosition: 'top-right', // 'top-right' | 'top-center' | 'bottom-right'
  quietHoursEnabled: false,   // Do not disturb mode
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  categories: {
    orders: true,
    quotes: true,
    users: true,
    chat: true,
    brokenImages: true,
    apiRequests: true
  },
  pollingIntervals: {
    orders: 30,         // seconds (Orders & Status)
    quotes: 30,         // seconds (Quote Requests)
    users: 30,          // seconds (User Accounts & Verifications)
    chat: 15,           // seconds (Live Chat Messages)
    brokenImages: 180,  // seconds (Broken Images & Catalog Health)
    apiRequests: 30     // seconds (API Requests & Live Telemetry)
  }
};

export const getNotificationSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...parsed,
      categories: {
        ...DEFAULT_NOTIFICATION_SETTINGS.categories,
        ...(parsed.categories || {})
      },
      pollingIntervals: {
        ...DEFAULT_NOTIFICATION_SETTINGS.pollingIntervals,
        ...(parsed.pollingIntervals || {})
      }
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }
};

export const saveNotificationSettings = (settings) => {
  try {
    const current = getNotificationSettings();
    const updated = {
      ...current,
      ...settings,
      categories: {
        ...current.categories,
        ...(settings.categories || {})
      },
      pollingIntervals: {
        ...current.pollingIntervals,
        ...(settings.pollingIntervals || {})
      }
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('inizio:notification-settings-changed', { detail: updated }));
    return updated;
  } catch (e) {
    console.error('Failed to save notification settings:', e);
    return getNotificationSettings();
  }
};

export const getPollingInterval = (categoryKey, fallbackSeconds = 30) => {
  const settings = getNotificationSettings();
  const val = settings.pollingIntervals?.[categoryKey];
  return (typeof val === 'number' && val >= 5) ? val * 1000 : fallbackSeconds * 1000;
};

export const isBrowserAlertsEnabled = () => {
  const settings = getNotificationSettings();
  return settings.browserAlertsEnabled !== false;
};

export const isToastAlertsEnabled = (categoryKey) => {
  const settings = getNotificationSettings();
  if (settings.toastAlertsEnabled === false) return false;
  if (categoryKey && settings.categories && settings.categories[categoryKey] === false) {
    return false;
  }
  return true;
};

export const isSoundEnabled = () => {
  const settings = getNotificationSettings();
  return settings.soundEnabled !== false;
};

export const isBrowserNotificationSupported = () => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const getNotificationPermission = () => {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

export const requestBrowserNotificationPermission = async () => {
  if (!isBrowserNotificationSupported()) {
    console.warn('Browser notifications are not supported on this device/browser.');
    return 'unsupported';
  }

  try {
    let permission;
    // Modern Promise API with callback fallback for older browsers / webviews
    if (typeof Notification.requestPermission === 'function') {
      try {
        const p = Notification.requestPermission((status) => {
          if (status) permission = status;
        });
        if (p && typeof p.then === 'function') {
          permission = await p;
        }
      } catch {
        permission = await new Promise((resolve) => {
          Notification.requestPermission((status) => resolve(status));
        });
      }
    }

    if (!permission && typeof Notification !== 'undefined') {
      permission = Notification.permission;
    }

    if (permission === 'granted') {
      // Also ensure in-app setting is active
      saveNotificationSettings({ browserAlertsEnabled: true });
      showBrowserNotification({
        title: 'Inizio Admin Notifications',
        body: 'Browser notifications are now enabled! You will receive alerts for new orders, quotes, chats, and registrations.',
        path: '/'
      });
    }
    return permission || Notification.permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  }
};

/**
 * Check if quiet hours (Do Not Disturb) is currently active
 */
export const isQuietHoursActive = () => {
  const settings = getNotificationSettings();
  if (!settings.quietHoursEnabled) return false;
  try {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = (settings.quietHoursStart || '22:00').split(':').map(Number);
    const [endH, endM] = (settings.quietHoursEnd || '07:00').split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  } catch {
    return false;
  }
};

/**
 * Play a notification audio chime via Web Audio API
 */
export const playNotificationSound = (customType, customVolume) => {
  if (!isSoundEnabled()) return;
  if (isQuietHoursActive() && !customType) return;

  const settings = getNotificationSettings();
  const tone = customType || settings.soundType || 'chime';
  const volumeMultiplier = typeof customVolume === 'number' ? customVolume : (settings.soundVolume ?? 0.8);

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    if (tone === 'chime') {
      // Pleasant two-tone chime (F#5 to A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(739.99, now);
      gain1.gain.setValueAtTime(0.08 * volumeMultiplier, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.12);
      gain2.gain.setValueAtTime(0.1 * volumeMultiplier, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.6);
    } else if (tone === 'bell') {
      // Warm resonant bell ping (E5 659.25Hz with harmonic)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, now);
      gain.gain.setValueAtTime(0.12 * volumeMultiplier, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
      osc.start(now);
      osc.stop(now + 0.8);
    } else if (tone === 'ping') {
      // High crisp ping (C6 1046.5Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, now);
      gain.gain.setValueAtTime(0.09 * volumeMultiplier, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (tone === 'subtle') {
      // Soft gentle tap/tone (G4 392Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(392.0, now);
      gain.gain.setValueAtTime(0.06 * volumeMultiplier, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    }

    if (navigator.vibrate) {
      navigator.vibrate([150, 80, 150]);
    }
  } catch (err) {
    // Ignore audio context autoplay restrictions
  }
};

// In-memory deduplication cache to prevent duplicate alerts within short intervals (1.5s)
const recentNotifications = new Map();

/**
 * Show a native Desktop / Mobile Browser Notification with automatic deduplication
 */
export const showBrowserNotification = ({
  title,
  body,
  icon = appIconImg,
  path = '/',
  tag,
  category,
  navigate
}) => {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  if (!isBrowserAlertsEnabled()) return false;

  const settings = getNotificationSettings();
  if (category && settings.categories && settings.categories[category] === false) {
    return false;
  }

  // Respect Quiet Hours / Do Not Disturb
  if (!tag?.includes('test') && isQuietHoursActive()) {
    return false;
  }

  // Deduplication guard: ignore exact identical notifications within 1.5 seconds
  const deterministicTag = tag || `inizio-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const notifKey = `${deterministicTag}::${body || ''}`;
  const now = Date.now();

  // Allow test alerts or non-identical calls through; debounce rapid duplicate bursts
  if (!tag?.includes('test') && recentNotifications.has(notifKey) && (now - recentNotifications.get(notifKey)) < 1500) {
    return false; // Suppress rapid duplicate burst
  }
  recentNotifications.set(notifKey, now);

  // Clean old entries from cache
  for (const [key, timestamp] of recentNotifications.entries()) {
    if (now - timestamp > 20000) recentNotifications.delete(key);
  }

  playNotificationSound();

  const options = {
    body: body || 'New alert from Inizio Admin Panel',
    icon: icon || appIconImg,
    badge: appIconImg,
    tag: deterministicTag,
    renotify: true,
    silent: false,
    requireInteraction: false
  };

  try {
    // 1. Try native desktop Notification constructor first (immediate on Desktop Chrome, Windows, Mac)
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      if (typeof navigate === 'function' && path) {
        navigate(path);
      } else if (path && window.location.pathname !== path) {
        window.location.href = path;
      }
      notification.close();
    };
    return true;
  } catch (err) {
    // 2. Fallback to ServiceWorker showNotification (required for Android Chrome / Mobile PWAs)
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then(reg => {
          reg.showNotification(title, options);
        })
        .catch(e => {
          console.error('ServiceWorker showNotification failed:', e);
        });
      return true;
    }
    return false;
  }
};
