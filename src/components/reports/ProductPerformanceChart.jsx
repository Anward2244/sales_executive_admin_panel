import React, { useState, useMemo, useCallback } from 'react';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { scaleLinear, scaleBand } from '@visx/scale';
import { LinearGradient } from '@visx/gradient';
import { ParentSize } from '@visx/responsive';
import { useTooltip, useTooltipInPortal, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import {
  FiDollarSign,
  FiBox,
  FiShoppingBag,
  FiTrendingUp,
  FiAward,
  FiBarChart2,
} from 'react-icons/fi';
import Skeleton from '@/components/ui/Skeleton';

// Currency Formatter
const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
};

// Compact Number Formatter (e.g. ₹1.2L, 45k)
const formatCompact = (num, isCurrency = false) => {
  const val = Number(num) || 0;
  const prefix = isCurrency ? '₹' : '';
  if (val >= 10000000) return `${prefix}${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `${prefix}${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `${prefix}${(val / 1000).toFixed(1)}k`;
  return `${prefix}${val.toLocaleString('en-IN')}`;
};

// Tooltip Theme Styler
const getProductTooltipStyle = (isDark) => ({
  ...defaultStyles,
  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.6)',
  color: isDark ? '#ffffff' : '#0f172a',
  border: isDark
    ? '1px solid rgba(255, 255, 255, 0.15)'
    : '1px solid rgba(226, 232, 240, 0.9)',
  borderRadius: '16px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(8px)',
  padding: '12px 14px',
  fontSize: '12px',
  pointerEvents: 'none',
  zIndex: 9999,
  minWidth: '220px',
});

// Reusable Tooltip Content Card
const ProductTooltipContent = ({ tooltipData }) => {
  if (!tooltipData) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-slate-200/60 dark:border-white/10">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-500">
            {tooltipData.rank ? `Rank #${tooltipData.rank}` : 'Catalog SKU'}
          </div>
          <div className="font-bold text-xs truncate max-w-[180px]">
            {tooltipData.productName}
          </div>
        </div>
        {tooltipData.sku && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 font-semibold shrink-0">
            {tooltipData.sku}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
        {tooltipData.totalRevenue !== undefined && (
          <div>
            <span className="text-slate-400 block text-[10px]">Revenue:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(tooltipData.totalRevenue)}
            </span>
          </div>
        )}

        {tooltipData.totalQuantity !== undefined && (
          <div>
            <span className="text-slate-400 block text-[10px]">Units Sold:</span>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
              {Number(tooltipData.totalQuantity).toLocaleString('en-IN')}
            </span>
          </div>
        )}

        {tooltipData.ordersCount !== undefined && (
          <div>
            <span className="text-slate-400 block text-[10px]">PO Orders:</span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
              {tooltipData.ordersCount} POs
            </span>
          </div>
        )}

        {tooltipData.sharePercent !== undefined && (
          <div>
            <span className="text-slate-400 block text-[10px]">Share %:</span>
            <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
              {tooltipData.sharePercent}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 1. SUBCOMPONENT: LEADERBOARD BAR CHART
// ==========================================
function LeaderboardBarChart({
  width,
  height,
  sortedProducts,
  activeMetric,
  totalRevenue,
  totalUnitsSold,
  totalOrders,
  isDark,
}) {
  const {
    tooltipOpen,
    tooltipLeft = 0,
    tooltipTop = 0,
    tooltipData,
    showTooltip,
    hideTooltip,
  } = useTooltip();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
    zIndex: 9999,
  });

  const [hoveredKey, setHoveredKey] = useState(null);

  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const trackBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(241, 245, 249, 0.9)';

  const isMobile = width < 520;
  const isSmallMobile = width < 380;
  const margin = {
    top: 8,
    right: isMobile ? 80 : 100,
    bottom: 8,
    left: isSmallMobile ? 110 : isMobile ? 135 : 175,
  };

  const xMax = Math.max(10, width - margin.left - margin.right);
  const yMax = Math.max(10, height - margin.top - margin.bottom);

  const maxVal = Math.max(
    ...sortedProducts.map((p) => {
      if (activeMetric === 'quantity') return Number(p.totalQuantity || 0);
      if (activeMetric === 'orders') return Number(p.ordersCount || 0);
      return Number(p.totalRevenue || 0);
    }),
    1
  );

  // Extend scale domain to 1.25x so end-of-bar text labels never overflow past the right margin
  const xScale = scaleLinear({
    domain: [0, maxVal * 1.25],
    range: [0, xMax],
  });

  const getProductKey = useCallback(
    (product, idx) => (product._id ? `${product._id}-${idx}` : `${product.sku || product.productName || 'p'}-${idx}`),
    []
  );

  const yScale = scaleBand({
    domain: sortedProducts.map((p, idx) => getProductKey(p, idx)),
    range: [0, yMax],
    padding: 0.28,
  });

  return (
    <div ref={containerRef} className="relative w-full h-full select-none">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <LinearGradient
            id="prod-grad-revenue"
            from="#a855f7"
            to="#7c3aed"
          />
          <LinearGradient
            id="prod-grad-quantity"
            from="#38bdf8"
            to="#2563eb"
          />
          <LinearGradient
            id="prod-grad-orders"
            from="#fbbf24"
            to="#d97706"
          />
        </defs>

        <Group left={margin.left} top={margin.top}>
          {sortedProducts.map((product, idx) => {
            const key = getProductKey(product, idx);
            const barY = yScale(key);
            const barHeight = yScale.bandwidth();

            const val = activeMetric === 'quantity'
              ? Number(product.totalQuantity || 0)
              : activeMetric === 'orders'
                ? Number(product.ordersCount || 0)
                : Number(product.totalRevenue || 0);

            const barWidth = Math.max(4, xScale(val));
            const isHovered = hoveredKey === key;

            const gradientId =
              activeMetric === 'quantity'
                ? 'prod-grad-quantity'
                : activeMetric === 'orders'
                  ? 'prod-grad-orders'
                  : 'prod-grad-revenue';

            const formattedVal =
              activeMetric === 'revenue'
                ? formatCompact(val, true)
                : `${val.toLocaleString('en-IN')}`;

            const sharePercent = activeMetric === 'quantity'
              ? (totalUnitsSold ? ((val / Number(totalUnitsSold)) * 100).toFixed(1) : '0')
              : activeMetric === 'orders'
                ? (totalOrders ? ((val / Number(totalOrders)) * 100).toFixed(1) : '0')
                : (totalRevenue ? ((val / Number(totalRevenue)) * 100).toFixed(1) : '0');

            const handleHover = (e) => {
              setHoveredKey(key);
              const point = localPoint(e);
              if (point) {
                showTooltip({
                  tooltipData: { ...product, rank: idx + 1, sharePercent },
                  tooltipLeft: point.x,
                  tooltipTop: point.y,
                });
              }
            };

            const prodName = product.productName || product.sku || 'Product';
            const maxChars = isSmallMobile ? 11 : isMobile ? 15 : 21;
            const displayName = prodName.length > maxChars ? `${prodName.slice(0, maxChars - 2)}...` : prodName;

            return (
              <Group key={key}>
                {/* Product Title Label on the Left */}
                <text
                  x={-12}
                  y={(barY || 0) + barHeight / 2}
                  textAnchor="end"
                  alignmentBaseline="middle"
                  fontSize={isMobile ? 10 : 11}
                  fontWeight={idx < 3 ? '800' : '600'}
                  fill={isHovered ? (isDark ? '#ffffff' : '#0f172a') : textPrimary}
                  className="cursor-pointer select-none"
                >
                  {/* Rank Medal Indicator */}
                  {idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : `#${idx + 1} `}
                  {displayName}
                </text>

                {/* Background Track */}
                <Bar
                  x={0}
                  y={barY}
                  width={xMax}
                  height={barHeight}
                  fill={trackBg}
                  rx={6}
                  ry={6}
                  className="pointer-events-none"
                />

                {/* Filled Gradient Bar */}
                <Bar
                  x={0}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  fill={`url(#${gradientId})`}
                  opacity={isHovered ? 1 : 0.9}
                  rx={6}
                  ry={6}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={handleHover}
                  onMouseMove={handleHover}
                  onMouseLeave={() => {
                    setHoveredKey(null);
                    hideTooltip();
                  }}
                />

                {/* End-of-Bar Value Label */}
                <text
                  x={barWidth + 8}
                  y={(barY || 0) + barHeight / 2}
                  alignmentBaseline="middle"
                  fontSize={isMobile ? 10 : 11}
                  fontWeight="800"
                  fill={isDark ? '#e2e8f0' : '#1e293b'}
                  className="font-mono select-none pointer-events-none"
                >
                  {formattedVal}
                  <tspan fontSize={isMobile ? 8.5 : 9.5} fill={textSecondary} dx={4}>
                    ({sharePercent}%)
                  </tspan>
                </text>
              </Group>
            );
          })}
        </Group>
      </svg>

      {/* Portal-based Floating Tooltip with exact cursor positioning */}
      {tooltipOpen && tooltipData && (
        <TooltipInPortal
          top={tooltipTop}
          left={tooltipLeft}
          style={getProductTooltipStyle(isDark)}
        >
          <ProductTooltipContent tooltipData={tooltipData} />
        </TooltipInPortal>
      )}
    </div>
  );
}

// ==========================================
// 2. MAIN COMPONENT: PRODUCT PERFORMANCE
// ==========================================
const ProductPerformanceChart = ({
  productPerformance = [],
  totalRevenue = 0,
  totalUnitsSold = 0,
  totalOrders = 0,
  isDark = false,
  loading = false,
}) => {
  // Metric Mode: 'revenue' | 'quantity' | 'orders'
  const [activeMetric, setActiveMetric] = useState('revenue');
  // Top Limit: 5 | 8 | 10
  const [topLimit, setTopLimit] = useState(8);

  // Compute effective total orders fallback
  const effectiveTotalOrders = useMemo(() => {
    if (Number(totalOrders) > 0) return Number(totalOrders);
    return (
      productPerformance.reduce((acc, p) => acc + (Number(p.ordersCount) || 0), 0) || 1
    );
  }, [totalOrders, productPerformance]);

  // Metric value helper
  const getMetricVal = useCallback((p, metric) => {
    if (metric === 'quantity') return Number(p.totalQuantity || 0);
    if (metric === 'orders') return Number(p.ordersCount || 0);
    return Number(p.totalRevenue || 0);
  }, []);

  // Sorted and limited dataset based on activeMetric
  const sortedProducts = useMemo(() => {
    if (!Array.isArray(productPerformance) || productPerformance.length === 0) return [];
    const list = [...productPerformance];
    list.sort((a, b) => getMetricVal(b, activeMetric) - getMetricVal(a, activeMetric));
    return list.slice(0, topLimit);
  }, [productPerformance, activeMetric, topLimit, getMetricVal]);

  // Insights Metrics
  const insights = useMemo(() => {
    if (!productPerformance.length) {
      return { topRevenueProduct: null, topVolumeProduct: null, highestPriceProduct: null };
    }
    const byRevenue = [...productPerformance].sort((a, b) => (Number(b.totalRevenue) || 0) - (Number(a.totalRevenue) || 0))[0];
    const byVolume = [...productPerformance].sort((a, b) => (Number(b.totalQuantity) || 0) - (Number(a.totalQuantity) || 0))[0];
    const byPrice = [...productPerformance]
      .filter((p) => p.totalQuantity > 0)
      .sort((a, b) => {
        const pA = (Number(a.totalRevenue) || 0) / (Number(a.totalQuantity) || 1);
        const pB = (Number(b.totalRevenue) || 0) / (Number(b.totalQuantity) || 1);
        return pB - pA;
      })[0];

    return {
      topRevenueProduct: byRevenue,
      topVolumeProduct: byVolume,
      highestPriceProduct: byPrice,
    };
  }, [productPerformance]);

  // Dynamic Top 3 Contribution calculation matching the active metric
  const top3Contribution = useMemo(() => {
    if (!productPerformance.length) return '0.0';
    const sorted = [...productPerformance].sort(
      (a, b) => getMetricVal(b, activeMetric) - getMetricVal(a, activeMetric)
    );
    const top3 = sorted.slice(0, 3);
    const sum = top3.reduce((acc, p) => acc + getMetricVal(p, activeMetric), 0);
    const total =
      activeMetric === 'quantity'
        ? Number(totalUnitsSold) || 1
        : activeMetric === 'orders'
          ? Number(effectiveTotalOrders) || 1
          : Number(totalRevenue) || 1;
    return Math.min(100, (sum / total) * 100).toFixed(1);
  }, [productPerformance, activeMetric, totalRevenue, totalUnitsSold, effectiveTotalOrders, getMetricVal]);

  if (loading) {
    return (
      <div className="p-3 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-44 rounded-xl" />
          <Skeleton className="h-8 w-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          <div className="lg:col-span-2 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!productPerformance.length) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm">
        No product performance data available to plot.
      </div>
    );
  }

  return (
    <div className="p-3 flex-1 flex flex-col space-y-5">

      {/* ================= CONTROLS & SUB-HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/60 dark:border-white/5">
        {/* Metric Selector Pills */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
            Metric:
          </span>
          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveMetric('revenue')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeMetric === 'revenue'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <FiDollarSign className="text-xs" />
              <span>Revenue</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMetric('quantity')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeMetric === 'quantity'
                  ? 'bg-blue-600 text-white shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <FiBox className="text-xs" />
              <span>Units</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMetric('orders')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeMetric === 'orders'
                  ? 'bg-amber-600 text-white shadow-amber-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <FiShoppingBag className="text-xs" />
              <span>Orders</span>
            </button>
          </div>
        </div>

        {/* Top N Range Filter */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
            Show:
          </span>
          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-xs">
            {[5, 8, 10].map((limit) => (
              <button
                key={limit}
                type="button"
                onClick={() => setTopLimit(limit)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${topLimit === limit
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                Top {limit}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ================= MAIN CHART PANEL ================= */}
      <div className="bg-slate-50/50 dark:bg-white/2 border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5 relative flex-1 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <FiBarChart2 className="text-purple-500" />
              <span>Top {sortedProducts.length} Product Leaderboard</span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Ranked by {activeMetric === 'revenue' ? 'revenue generated (₹)' : activeMetric === 'quantity' ? 'units sold' : 'PO orders count'}
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400 bg-white dark:bg-white/5 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-white/5">
            Hover for detail
          </span>
        </div>

        {/* Responsive SVG Chart with portal-based tooltip */}
        <div className="flex-1 min-h-[340px]" style={{ minHeight: Math.max(340, sortedProducts.length * 46) }}>
          <ParentSize>
            {({ width, height }) => {
              if (width <= 0 || height <= 0) return null;
              return (
                <LeaderboardBarChart
                  width={width}
                  height={height}
                  sortedProducts={sortedProducts}
                  activeMetric={activeMetric}
                  totalRevenue={totalRevenue}
                  totalUnitsSold={totalUnitsSold}
                  totalOrders={effectiveTotalOrders}
                  isDark={isDark}
                />
              );
            }}
          </ParentSize>
        </div>
      </div>

      {/* ================= EXECUTIVE INSIGHT HIGHLIGHT STRIP ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Top Revenue Leader */}
        <div className="p-3 rounded-2xl bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 flex items-center gap-2.5">
          <div className="w-9 h-9 kpi-icon-purple rounded-xl flex items-center justify-center shrink-0">
            <FiAward className="text-base" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block truncate">
              Revenue Leader
            </span>
            <div className="font-bold text-xs text-slate-900 dark:text-white truncate" title={insights.topRevenueProduct?.productName}>
              {insights.topRevenueProduct?.productName || 'N/A'}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono">
              {formatCurrency(insights.topRevenueProduct?.totalRevenue || 0)}
            </div>
          </div>
        </div>

        {/* Top Volume Leader */}
        <div className="p-3 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 flex items-center gap-2.5">
          <div className="w-9 h-9 kpi-icon-blue rounded-xl flex items-center justify-center shrink-0">
            <FiBox className="text-base" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block truncate">
              Volume Leader
            </span>
            <div className="font-bold text-xs text-slate-900 dark:text-white truncate" title={insights.topVolumeProduct?.productName}>
              {insights.topVolumeProduct?.productName || 'N/A'}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono">
              {(insights.topVolumeProduct?.totalQuantity || 0).toLocaleString('en-IN')} units
            </div>
          </div>
        </div>

        {/* Dynamic Metric Contribution */}
        <div className="p-3 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5">
          <div className="w-9 h-9 kpi-icon-emerald rounded-xl flex items-center justify-center shrink-0">
            <FiTrendingUp className="text-base" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block truncate">
              Top 3 Share
            </span>
            <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
              {top3Contribution}% of {activeMetric === 'revenue' ? 'Revenue' : activeMetric === 'orders' ? 'Orders' : 'Volume'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Top 3 bestsellers
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ProductPerformanceChart;
