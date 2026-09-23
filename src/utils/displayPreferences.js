/**
 * Utility for handling display preferences across the application.
 * Manages ambient glow fluid animations, floating scroll-to-top button, density, etc.
 */

import { useState, useEffect, useCallback } from 'react';

export const DISPLAY_PREFS_KEY = 'inizio_display_preferences';
export const DISPLAY_PREFS_EVENT = 'inizio:display-preferences-changed';

export const DEFAULT_DISPLAY_PREFERENCES = {
  density: 'comfortable', // 'comfortable' | 'compact'
  ambientGlow: true,
  timeFormat: '12h',      // '12h' | '24h'
  autoScrollToTop: true,
  rowsPerPage: 10         // Default pagination rows per page
};

/**
 * Retrieve saved display preferences from localStorage safely.
 */
export const getDisplayPreferences = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(DISPLAY_PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_DISPLAY_PREFERENCES,
          ...parsed
        };
      }
    }
  } catch (err) {
    console.warn('Failed to parse display preferences from localStorage:', err);
  }
  return { ...DEFAULT_DISPLAY_PREFERENCES };
};

/**
 * Apply preference side-effects to DOM (e.g., data attributes).
 */
export const applyDisplayPreferences = (prefs) => {
  if (typeof document === 'undefined') return;
  const current = prefs || getDisplayPreferences();
  document.documentElement.setAttribute('data-ambient-glow', current.ambientGlow ? 'true' : 'false');
  document.documentElement.setAttribute('data-density', current.density || 'comfortable');
};

/**
 * Save updated display preferences to localStorage and notify all listeners.
 */
export const saveDisplayPreferences = (newPrefs) => {
  try {
    const current = getDisplayPreferences();
    const updated = {
      ...current,
      ...newPrefs
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify(updated));
    }
    applyDisplayPreferences(updated);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DISPLAY_PREFS_EVENT, { detail: updated }));
    }
    return updated;
  } catch (err) {
    console.error('Failed to save display preferences:', err);
    return getDisplayPreferences();
  }
};

// Apply preferences on initial script evaluation
if (typeof document !== 'undefined') {
  applyDisplayPreferences();
}

/**
 * React hook to read and react to display preferences in real time.
 */
export const useDisplayPreferences = () => {
  const [preferences, setPreferences] = useState(() => getDisplayPreferences());

  useEffect(() => {
    // Ensure DOM attributes are synced on mount
    applyDisplayPreferences(preferences);

    const handlePrefsChange = (e) => {
      if (e?.detail) {
        setPreferences(e.detail);
      } else {
        setPreferences(getDisplayPreferences());
      }
    };

    const handleStorageChange = (e) => {
      if (e.key === DISPLAY_PREFS_KEY) {
        const updated = getDisplayPreferences();
        setPreferences(updated);
        applyDisplayPreferences(updated);
      }
    };

    window.addEventListener(DISPLAY_PREFS_EVENT, handlePrefsChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(DISPLAY_PREFS_EVENT, handlePrefsChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const updatePreference = useCallback((key, value) => {
    const updated = saveDisplayPreferences({ [key]: value });
    setPreferences(updated);
    return updated;
  }, []);

  return { preferences, updatePreference, setPreferences };
};
