/**
 * Utility for handling display preferences across the application.
 * Manages ambient glow fluid animations, floating scroll-to-top button, density (comfortable, compact, dense), column visibility, etc.
 */

import { useState, useEffect, useCallback } from 'react';

export const DISPLAY_PREFS_KEY = 'whatnot_sales_display_preferences';
export const LEGACY_DISPLAY_PREFS_KEY = 'Auric_display_preferences';
export const DISPLAY_PREFS_EVENT = 'WhatnotSales:display-preferences-changed';

export const DEFAULT_DISPLAY_PREFERENCES = {
  density: 'comfortable', // 'comfortable' | 'compact' | 'dense'
  ambientGlow: true,
  timeFormat: '12h',      // '12h' | '24h'
  autoScrollToTop: true,
  rowsPerPage: 10,        // Default pagination rows per page
  columnVisibility: {}    // Map of tableKey -> { [colKey]: boolean }
};

/**
 * Density style lookup helper for table headers and body cells.
 * Dense mode strictly satisfies requirement of reducing cell padding to py-2 px-3
 * for users working on standard 13-14" laptop screens who want to view more rows without excessive scrolling.
 */
export const getDensityStyles = (density = 'comfortable') => {
  switch (density) {
    case 'dense':
      return {
        th: 'py-2 px-3 text-[11px] font-bold tracking-wider uppercase',
        td: 'py-2 px-3 text-xs',
        badge: 'py-0.5 px-2 text-[10px]',
        button: 'p-1 text-xs',
        rowGap: 'gap-1',
        spacing: 'dense'
      };
    case 'compact':
      return {
        th: 'py-2.5 px-3.5 text-xs font-bold tracking-wider uppercase',
        td: 'py-2.5 px-3.5 text-xs',
        badge: 'py-1 px-2.5 text-xs',
        button: 'p-1.5 text-xs',
        rowGap: 'gap-1.5',
        spacing: 'compact'
      };
    case 'comfortable':
    default:
      return {
        th: 'py-3.5 px-4 sm:px-5 text-xs font-bold tracking-wider uppercase',
        td: 'py-3.5 px-4 sm:px-5 text-sm',
        badge: 'py-1 px-3 text-xs',
        button: 'p-2 text-sm',
        rowGap: 'gap-2',
        spacing: 'comfortable'
      };
  }
};

/**
 * Retrieve saved display preferences from localStorage safely.
 */
export const getDisplayPreferences = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(DISPLAY_PREFS_KEY) || localStorage.getItem(LEGACY_DISPLAY_PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_DISPLAY_PREFERENCES,
          ...parsed,
          columnVisibility: {
            ...DEFAULT_DISPLAY_PREFERENCES.columnVisibility,
            ...(parsed.columnVisibility || {})
          }
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
      ...newPrefs,
      columnVisibility: {
        ...(current.columnVisibility || {}),
        ...(newPrefs.columnVisibility || {})
      }
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify(updated));
    }
    applyDisplayPreferences(updated);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DISPLAY_PREFS_EVENT, { detail: updated }));
      window.dispatchEvent(new CustomEvent('Auric:display-preferences-changed', { detail: updated }));
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
    window.addEventListener('Auric:display-preferences-changed', handlePrefsChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(DISPLAY_PREFS_EVENT, handlePrefsChange);
      window.removeEventListener('Auric:display-preferences-changed', handlePrefsChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const updatePreference = useCallback((key, value) => {
    const updated = saveDisplayPreferences({ [key]: value });
    setPreferences(updated);
    return updated;
  }, []);

  const updateTableColumnVisibility = useCallback((tableKey, colKey, isVisible) => {
    const current = getDisplayPreferences();
    const currentTableCols = current.columnVisibility?.[tableKey] || {};
    const updatedColumnVisibility = {
      ...(current.columnVisibility || {}),
      [tableKey]: {
        ...currentTableCols,
        [colKey]: isVisible
      }
    };
    const updated = saveDisplayPreferences({ columnVisibility: updatedColumnVisibility });
    setPreferences(updated);
    return updated;
  }, []);

  const resetTableColumnVisibility = useCallback((tableKey) => {
    const current = getDisplayPreferences();
    const updatedColumnVisibility = { ...(current.columnVisibility || {}) };
    delete updatedColumnVisibility[tableKey];
    const updated = saveDisplayPreferences({ columnVisibility: updatedColumnVisibility });
    setPreferences(updated);
    return updated;
  }, []);

  return {
    preferences,
    updatePreference,
    setPreferences,
    updateTableColumnVisibility,
    resetTableColumnVisibility
  };
};
