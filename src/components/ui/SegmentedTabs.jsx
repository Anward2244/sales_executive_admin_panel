import React from 'react';

/**
 * Standard themes mapped by status keyword.
 * Ensures consistent color-coding (blue for all, green for active/approved,
 * amber for pending, rose for inactive/rejected) across all pages.
 */
const DEFAULT_THEMES = {
  all: {
    bg: 'bg-blue-600',
    activeBadgeClass: 'bg-blue-800 text-white',
    badgeClass: 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'
  },
  approved: {
    bg: 'bg-emerald-600',
    activeBadgeClass: 'bg-emerald-800 text-white',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  },
  active: {
    bg: 'bg-emerald-600',
    activeBadgeClass: 'bg-emerald-800 text-white',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  },
  pending: {
    bg: 'bg-amber-600',
    activeBadgeClass: 'bg-amber-800 text-white',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
  },
  inactive: {
    bg: 'bg-rose-600',
    activeBadgeClass: 'bg-rose-800 text-white',
    badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
  },
  rejected: {
    bg: 'bg-rose-600',
    activeBadgeClass: 'bg-rose-800 text-white',
    badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
  }
};

/**
 * Reusable SegmentedTabs component for status and filter tabs with live count badges.
 */
const SegmentedTabs = ({
  tabs = [],
  activeTab,
  onChange,
  className = '',
  tabClassName = '',
  size = 'md'
}) => {
  if (!tabs || tabs.length === 0) return null;

  return (
    <div
      className={`flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-white/5 rounded-full shadow-md border border-slate-200/60 dark:border-white/10 overflow-x-auto self-start sm:self-auto shrink-0 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const normId = String(tab.id || '').toLowerCase();
        const theme = DEFAULT_THEMES[normId] || DEFAULT_THEMES.all;

        const bgClass = tab.bg || theme.bg;
        const activeBadgeClass = tab.activeBadgeClass || theme.activeBadgeClass;
        const badgeClass = tab.badgeClass || theme.badgeClass;

        const isActive =
          String(activeTab || '').toLowerCase() === normId ||
          (!activeTab && normId === 'all');

        const sizeClasses =
          size === 'sm'
            ? 'px-3 py-1 text-xs'
            : 'px-3.5 py-1.5 text-xs';

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange?.(tab.id)}
            className={`flex items-center gap-2 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${sizeClasses} ${
              isActive
                ? `${bgClass} text-white shadow-xs font-bold`
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            } ${tabClassName}`}
          >
            <span>{tab.label || tab.id}</span>
            {tab.count !== undefined && tab.count !== null && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? activeBadgeClass : badgeClass
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedTabs;

