import React, { useRef, useState, useLayoutEffect, useEffect, useCallback } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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
  dispatched: {
    bg: 'bg-blue-600',
    activeBadgeClass: 'bg-blue-800 text-white',
    badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
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
  },
  unread: {
    bg: 'bg-amber-600',
    activeBadgeClass: 'bg-amber-800 text-white',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
  },
  read: {
    bg: 'bg-emerald-600',
    activeBadgeClass: 'bg-emerald-800 text-white',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  }
};

/**
 * Reusable SegmentedTabs component for status and filter tabs with live count badges,
 * smooth sliding active pill indicator, and responsive mobile horizontal scrolling with scroll hints.
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

  const containerRef = useRef(null);
  const tabRefs = useRef({});
  const isInitialRender = useRef(true);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Identify currently active tab item
  const normActiveId = String(activeTab || '').toLowerCase();
  const activeItem =
    tabs.find((t) => {
      const normId = String(t.id || '').toLowerCase();
      return normId === normActiveId || (!activeTab && normId === 'all');
    }) || tabs[0];

  const activeNormId = String(activeItem?.id || '').toLowerCase();
  const activeTheme = DEFAULT_THEMES[activeNormId] || DEFAULT_THEMES.all;
  const activeBg = activeItem?.bg || activeTheme.bg;

  const [indicatorStyle, setIndicatorStyle] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    bg: activeBg,
    ready: false
  });

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  const scrollToActiveTab = useCallback((activeEl, smooth = true) => {
    const container = containerRef.current;
    if (!container || !activeEl) return;

    const targetLeft = activeEl.offsetLeft;
    const targetWidth = activeEl.offsetWidth;
    const containerScrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;

    if (
      targetLeft < containerScrollLeft ||
      targetLeft + targetWidth > containerScrollLeft + containerWidth
    ) {
      const targetScroll = targetLeft - (containerWidth - targetWidth) / 2;
      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }, []);

  const updateIndicator = useCallback(
    (shouldScroll = false) => {
      const targetId = activeItem?.id;
      const activeEl = tabRefs.current[targetId];
      if (activeEl) {
        setIndicatorStyle({
          left: activeEl.offsetLeft,
          top: activeEl.offsetTop,
          width: activeEl.offsetWidth,
          height: activeEl.offsetHeight,
          bg: activeBg,
          ready: true
        });

        if (shouldScroll) {
          scrollToActiveTab(activeEl, true);
        }
      }
      checkScroll();
    },
    [activeItem?.id, activeBg, scrollToActiveTab, checkScroll]
  );

  useIsomorphicLayoutEffect(() => {
    updateIndicator(false);
    const timer = requestAnimationFrame(() => {
      isInitialRender.current = false;
      checkScroll();
    });
    return () => cancelAnimationFrame(timer);
  }, [updateIndicator, checkScroll]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      updateIndicator(false);
      checkScroll();
    };

    window.addEventListener('resize', handleResize);
    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(handleResize);
      observer.observe(container);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, [updateIndicator, checkScroll]);

  const handleTabClick = (tab) => {
    const targetEl = tabRefs.current[tab.id];
    if (targetEl) {
      const normId = String(tab.id || '').toLowerCase();
      const theme = DEFAULT_THEMES[normId] || DEFAULT_THEMES.all;
      const bg = tab.bg || theme.bg;

      setIndicatorStyle({
        left: targetEl.offsetLeft,
        top: targetEl.offsetTop,
        width: targetEl.offsetWidth,
        height: targetEl.offsetHeight,
        bg,
        ready: true
      });

      scrollToActiveTab(targetEl, true);
    }

    onChange?.(tab.id);
  };

  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-1 text-xs'
      : 'px-3 py-1.5 sm:px-3.5 text-xs';

  return (
    <div className={`relative max-w-full w-full sm:w-auto min-w-0 ${className}`}>
      {/* Scrollable Tab Container */}
      <div
        ref={containerRef}
        onScroll={checkScroll}
        className="relative flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-white/5 rounded-full shadow-md border border-slate-200/60 dark:border-white/10 max-w-full w-full sm:w-auto min-w-0 overflow-x-auto no-scrollbar select-none overscroll-x-contain touch-pan-x"
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none'
        }}
        role="tablist"
      >
        {/* Gliding Active Pill Indicator */}
        <div
          className={`absolute top-0 left-0 rounded-full shadow-xs pointer-events-none ${indicatorStyle.bg} ${
            isInitialRender.current
              ? ''
              : 'transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] will-change-[transform,width,height,background-color]'
          } ${indicatorStyle.ready ? 'opacity-100' : 'opacity-0'}`}
          style={{
            transform: `translate3d(${indicatorStyle.left}px, ${indicatorStyle.top}px, 0)`,
            width: `${indicatorStyle.width}px`,
            height: `${indicatorStyle.height}px`
          }}
          aria-hidden="true"
        />

        {tabs.map((tab) => {
          const normId = String(tab.id || '').toLowerCase();
          const theme = DEFAULT_THEMES[normId] || DEFAULT_THEMES.all;

          const activeBadgeClass = tab.activeBadgeClass || theme.activeBadgeClass;
          const badgeClass = tab.badgeClass || theme.badgeClass;

          const isActive =
            String(activeTab || '').toLowerCase() === normId ||
            (!activeTab && normId === 'all');

          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabClick(tab)}
              className={`relative z-10 flex items-center gap-1.5 sm:gap-2 rounded-full font-semibold transition-colors duration-200 cursor-pointer whitespace-nowrap shrink-0 active:scale-95 ${sizeClasses} ${
                isActive
                  ? 'text-white font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              } ${tabClassName}`}
            >
              <span>{tab.label || tab.id}</span>
              {tab.count !== undefined && tab.count !== null && (
                <span
                  className={`text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full transition-colors duration-200 shrink-0 ${
                    isActive ? `${activeBadgeClass} text-white` : badgeClass
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Left Scroll Indicator Gradient */}
      <div
        className={`pointer-events-none absolute left-0.5 top-0.5 bottom-0.5 w-6 bg-gradient-to-r from-slate-200/90 dark:from-slate-900/90 to-transparent rounded-l-full transition-opacity duration-200 z-20 ${
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      />

      {/* Right Scroll Indicator Gradient */}
      <div
        className={`pointer-events-none absolute right-0.5 top-0.5 bottom-0.5 w-6 bg-gradient-to-l from-slate-200/90 dark:from-slate-900/90 to-transparent rounded-r-full transition-opacity duration-200 z-20 ${
          canScrollRight ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      />
    </div>
  );
};

export default SegmentedTabs;
