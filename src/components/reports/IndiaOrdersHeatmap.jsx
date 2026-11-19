import React, { useState, useMemo, useRef } from 'react';
import IndiaMap from '@svg-maps/india';
import {
  FiMapPin,
  FiAward,
  FiZoomIn,
  FiZoomOut,
  FiRotateCcw,
} from 'react-icons/fi';
import Skeleton from '@/components/ui/Skeleton';

// Format Indian Rupee currency
const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
};

// Normalize string for fuzzy state matching
const normalizeStr = (str) =>
  String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Robust matcher between raw order state string and IndiaMap location
const matchLocation = (rawState, locations) => {
  if (!rawState) return null;
  const target = normalizeStr(rawState);
  if (!target) return null;

  // Direct exact match
  let matched = locations.find(
    (l) => normalizeStr(l.name) === target || l.id.toLowerCase() === target
  );
  if (matched) return matched;

  // Historical and common spelling variations in Indian states
  if (target.includes('odisha') || target.includes('orissa')) {
    return locations.find((l) => l.id === 'or' || normalizeStr(l.name).includes('odisha'));
  }
  if (
    target.includes('jammu') ||
    target.includes('kashmir') ||
    target.includes('ladakh')
  ) {
    return locations.find((l) => l.id === 'jk' || normalizeStr(l.name).includes('jammu'));
  }
  if (target.includes('delhi') || target.includes('nct')) {
    return locations.find((l) => l.id === 'dl' || normalizeStr(l.name).includes('delhi'));
  }
  if (target.includes('puducherry') || target.includes('pondicherry')) {
    return locations.find((l) => l.id === 'py' || normalizeStr(l.name).includes('puducherry'));
  }
  if (target.includes('uttarakhand') || target.includes('uttaranchal')) {
    return locations.find((l) => l.id === 'ut' || normalizeStr(l.name).includes('uttarakhand'));
  }
  if (
    target.includes('dadra') ||
    target.includes('daman') ||
    target.includes('diu') ||
    target.includes('haveli')
  ) {
    return locations.find((l) => l.id === 'dn' || normalizeStr(l.name).includes('daman'));
  }
  if (target.includes('andaman') || target.includes('nicobar')) {
    return locations.find((l) => l.id === 'an');
  }

  // Substring match
  matched = locations.find((l) => {
    const locNorm = normalizeStr(l.name);
    return locNorm.includes(target) || target.includes(locNorm);
  });

  return matched || null;
};

// Heatmap Color Styler based on ratio to highest order state
const getHeatColor = (count, maxCount, isDark) => {
  if (count <= 0) {
    return {
      fill: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
      stroke: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
      fillOpacity: isDark ? 0.6 : 0.85,
      tier: 'none',
      label: 'No Orders',
    };
  }

  const ratio = maxCount > 0 ? count / maxCount : 0;

  if (ratio >= 0.75) {
    // Tier 4: Peak (Highest Demand) - Deep Luminous Indigo
    return {
      fill: isDark ? '#6366f1' : '#4f46e5',
      stroke: isDark ? '#c7d2fe' : '#312e81',
      fillOpacity: 0.95,
      tier: 'peak',
      label: 'Peak Orders',
    };
  } else if (ratio >= 0.45) {
    // Tier 3: High Demand - Vibrant Royal Blue
    return {
      fill: isDark ? '#3b82f6' : '#2563eb',
      stroke: isDark ? '#93c5fd' : '#1e40af',
      fillOpacity: 0.85,
      tier: 'high',
      label: 'High Orders',
    };
  } else if (ratio >= 0.2) {
    // Tier 2: Moderate Demand - Sky Blue
    return {
      fill: isDark ? '#38bdf8' : '#0284c7',
      stroke: isDark ? '#bae6fd' : '#0369a1',
      fillOpacity: 0.75,
      tier: 'medium',
      label: 'Moderate Orders',
    };
  } else {
    // Tier 1: Low Demand - Soft Light Blue
    return {
      fill: isDark ? '#60a5fa' : '#93c5fd',
      stroke: isDark ? '#bfdbfe' : '#60a5fa',
      fillOpacity: 0.65,
      tier: 'low',
      label: 'Low Orders',
    };
  }
};

const IndiaOrdersHeatmap = ({
  orders = [],
  totalOrders = 0,
  isDark = false,
  loading = false,
}) => {
  const [hoveredLoc, setHoveredLoc] = useState(null);
  const [selectedLoc, setSelectedLoc] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const containerRef = useRef(null);

  // Aggregate orders by state
  const { stateStatsMap, rankedStates, maxOrdersCount, totalMappedOrders } = useMemo(() => {
    const statsMap = new Map();

    // Initialize all 36 Indian states from SVG map
    IndiaMap.locations.forEach((loc) => {
      statsMap.set(loc.id, {
        id: loc.id,
        name: loc.name,
        path: loc.path,
        orderCount: 0,
        revenue: 0,
      });
    });

    let mappedOrdersCount = 0;

    (orders || []).forEach((order) => {
      const rawState =
        order.state ||
        order.shippingAddress?.state ||
        order.firm?.state ||
        order.firmState ||
        '';

      if (!rawState) return;

      const matchedLoc = matchLocation(rawState, IndiaMap.locations);
      if (matchedLoc) {
        const item = statsMap.get(matchedLoc.id);
        if (item) {
          const rev = Number(order.totalAmount || order.finalAmount || order.amount || 0);
          item.orderCount += 1;
          item.revenue += rev;
          mappedOrdersCount += 1;
        }
      }
    });

    let maxOrders = 0;
    statsMap.forEach((s) => {
      if (s.orderCount > maxOrders) {
        maxOrders = s.orderCount;
      }
    });

    const ranked = Array.from(statsMap.values())
      .filter((s) => s.orderCount > 0)
      .sort((a, b) => b.orderCount - a.orderCount || b.revenue - a.revenue);

    return {
      stateStatsMap: statsMap,
      rankedStates: ranked,
      maxOrdersCount: maxOrders,
      totalMappedOrders: mappedOrdersCount,
    };
  }, [orders]);

  // Handle cursor movement inside container for smooth tooltip
  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const boundedX = Math.min(Math.max(10, rawX - 90), Math.max(10, rect.width - 200));
    const boundedY = Math.max(10, rawY - 85);
    setTooltipPos({ x: boundedX, y: boundedY });
  };

  const effectiveTotal = totalOrders || totalMappedOrders || 1;
  const topState = rankedStates[0] || null;

  if (loading) {
    return (
      <div className="bg-white/40 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-hidden flex flex-col justify-between h-full p-3">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-10 h-10 rounded-2xl" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-44 rounded-lg" />
            <Skeleton className="h-3 w-64 rounded-lg" />
          </div>
        </div>
        <div className="space-y-4 my-auto">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-[280px] w-full rounded-2xl" />
        </div>
        <div className="space-y-2 mt-6">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/40 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-hidden flex flex-col justify-between h-full">
      {/* Card Header & Controls */}
      <div className="p-3 border-b border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 kpi-icon-blue rounded-2xl">
            <FiMapPin className="text-xl" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>State Orders Heatmap</span>
              {rankedStates.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {rankedStates.length} Active {rankedStates.length === 1 ? 'State' : 'States'}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Geographic order density & highest ordering territories
            </p>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-inner">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 2.5))}
            className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Zoom in"
          >
            <FiZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 1))}
            className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Zoom out"
          >
            <FiZoomOut size={14} />
          </button>
          {zoomLevel !== 1 && (
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="p-1.5 text-slate-500 hover:text-rose-500 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Reset zoom"
            >
              <FiRotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col justify-between">
        {/* Top Section: Highlight Pill & Canvas */}
        <div>
          {/* Highest Demand State Highlight Pill */}
          {topState ? (
            <div className="mb-4 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse shrink-0" />
                <span className="text-xs text-slate-700 dark:text-slate-300 truncate">
                  Peak State:{' '}
                  <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                    {topState.name}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                  {topState.orderCount} PO{topState.orderCount === 1 ? '' : 's'}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold">
                  {((topState.orderCount / effectiveTotal) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-xs text-slate-400 text-center">
              No regional state order distribution recorded in this timeframe
            </div>
          )}

          {/* SVG Heatmap Canvas */}
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredLoc(null)}
            className="relative w-full bg-blue-200/10 rounded-2xl aspect-612/696 max-h-[340px] sm:max-h-[380px] mx-auto flex items-center justify-center select-none overflow-hidden my-2"
          >
            <svg
              viewBox={IndiaMap.viewBox}
              className="w-full h-full overflow-visible transition-transform duration-200 ease-out"
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
              }}
            >
              <defs>
                <filter id="heatmap-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#4f46e5" floodOpacity="0.75" />
                </filter>
                <filter id="hover-shadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
                </filter>
              </defs>

              {IndiaMap.locations.map((loc) => {
                const stat = stateStatsMap.get(loc.id) || { orderCount: 0, revenue: 0 };
                const isHovered = hoveredLoc?.id === loc.id;
                const isSelected = selectedLoc?.id === loc.id;
                const isPeak = topState && topState.id === loc.id && topState.orderCount > 0;

                const heat = getHeatColor(stat.orderCount, maxOrdersCount, isDark);

                let fillColor = heat.fill;
                let strokeColor = heat.stroke;
                let fillOpacity = heat.fillOpacity;

                if (isSelected) {
                  strokeColor = isDark ? '#ffffff' : '#1e1b4b';
                  fillOpacity = 1;
                } else if (isHovered) {
                  fillOpacity = 1;
                  strokeColor = isDark ? '#60a5fa' : '#2563eb';
                } else if (isPeak) {
                  strokeColor = isDark ? '#c7d2fe' : '#312e81';
                }

                return (
                  <path
                    key={loc.id}
                    id={loc.id}
                    d={loc.path}
                    fill={fillColor}
                    fillOpacity={fillOpacity}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? '2.5' : isHovered ? '2' : isPeak ? '1.5' : '0.75'}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className="transition-colors duration-150 cursor-pointer"
                    style={{
                      filter: isSelected || isPeak
                        ? 'url(#heatmap-glow)'
                        : isHovered
                          ? 'url(#hover-shadow)'
                          : undefined,
                    }}
                    onMouseEnter={() => setHoveredLoc({ ...loc, ...stat })}
                    onClick={() =>
                      setSelectedLoc((prev) => (prev?.id === loc.id ? null : { ...loc, ...stat }))
                    }
                  />
                );
              })}
            </svg>

            {/* Smooth Hover Tooltip Following Cursor */}
            {hoveredLoc && (
              <div
                className="absolute z-50 pointer-events-none p-3 rounded-2xl bg-white/40 dark:bg-slate-900/95 backdrop-blur-lg border border-slate-200/80 dark:border-white/10 shadow-2xl min-w-48 max-w-xs transition-opacity duration-75 select-none"
                style={{
                  left: `${tooltipPos.x}px`,
                  top: `${tooltipPos.y}px`,
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-slate-100 dark:border-white/10 pb-1.5">
                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {hoveredLoc.name}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 shrink-0">
                    {hoveredLoc.id?.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-left">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Orders</span>
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                      {hoveredLoc.orderCount || 0} PO{hoveredLoc.orderCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Share</span>
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
                      {effectiveTotal > 0
                        ? `${(((hoveredLoc.orderCount || 0) / effectiveTotal) * 100).toFixed(1)}%`
                        : '0%'}
                    </span>
                  </div>
                </div>

                {hoveredLoc.revenue > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Revenue:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(hoveredLoc.revenue)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Heatmap Spectrum Gradient Legend */}
          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-white/5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold mb-1.5">
              <span>0 Orders</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                <FiAward className="text-xs" />
                <span>Peak Demand ({maxOrdersCount})</span>
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-linear-to-r from-slate-200 via-sky-400 via-blue-600 to-indigo-600 dark:from-slate-800 dark:via-sky-500 dark:via-blue-500 dark:to-indigo-500" />
          </div>
        </div>

        {/* Top 5 Ordering States Ranking List */}
        <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-white/5 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Top Ordering States</span>
            <span>Orders / Share</span>
          </div>

          {rankedStates.length > 0 ? (
            rankedStates.slice(0, 5).map((st, idx) => {
              const share = ((st.orderCount / effectiveTotal) * 100).toFixed(1);
              const isFirst = idx === 0;

              return (
                <div
                  key={st.id}
                  onClick={() => setSelectedLoc((prev) => (prev?.id === st.id ? null : st))}
                  className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    selectedLoc?.id === st.id
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500/40 shadow-xs'
                      : 'bg-white/80 dark:bg-white/3 border-slate-200/70 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span
                        className={`w-5 h-5 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
                          isFirst
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : idx === 1
                              ? 'bg-blue-500 text-white'
                              : idx === 2
                                ? 'bg-sky-500 text-white'
                                : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {st.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {st.orderCount} PO{st.orderCount === 1 ? '' : 's'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        {share}%
                      </span>
                    </div>
                  </div>

                  {/* Relative Volume Progress Bar */}
                  <div className="h-1 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isFirst
                          ? 'bg-indigo-600 dark:bg-indigo-400'
                          : idx === 1
                            ? 'bg-blue-500'
                            : 'bg-sky-400'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(8, Number(share)))}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-4 text-center text-xs text-slate-400">
              No regional distribution records available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IndiaOrdersHeatmap;
