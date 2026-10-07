import React, { useState, useMemo } from 'react';
import { Group } from '@visx/group';
import { Bar, Pie } from '@visx/shape';
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
  FiPieChart,
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

// Distinct Palette for Donut slices
const DONUT_COLORS = [
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#64748b', // Slate for "Others"
];

// Tooltip Theme Styler
const getProductTooltipStyle = (isDark) => ({
  ...defaultStyles,
  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
  color: isDark ? '#ffffff' : '#0f172a',
  border: isDark
    ? '1px solid rgba(255, 255, 255, 0.15)'
    : '1px solid rgba(226, 232, 240, 0.9)',
  borderRadius: '16px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(16px)',
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
            <span className="font-mono font-bold">
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

  const margin = { top: 8, right: 90, bottom: 8, left: 180 };
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

  const xScale = scaleLinear({
    domain: [0, maxVal * 1.05],
    range: [0, xMax],
  });

  const yScale = scaleBand({
    domain: sortedProducts.map((p) => p._id || p.sku || p.productName),
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
            const key = product._id || product.sku || product.productName;
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
              ? (totalUnitsSold ? ((val / totalUnitsSold) * 100).toFixed(1) : '0')
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

            return (
              <Group key={key}>
                {/* Product Title Label on the Left */}
                <text
                  x={-14}
                  y={(barY || 0) + barHeight / 2}
                  textAnchor="end"
                  alignmentBaseline="middle"
                  fontSize={11}
                  fontWeight={idx < 3 ? '800' : '600'}
                  fill={isHovered ? (isDark ? '#ffffff' : '#0f172a') : textPrimary}
                  className="cursor-pointer select-none"
                >
                  {/* Rank Medal Indicator */}
                  {idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : `#${idx + 1} `}
                  {product.productName.length > 22
                    ? `${product.productName.slice(0, 20)}...`
                    : product.productName}
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
                  x={barWidth + 10}
                  y={(barY || 0) + barHeight / 2}
                  alignmentBaseline="middle"
                  fontSize={11}
                  fontWeight="800"
                  fill={isDark ? '#e2e8f0' : '#1e293b'}
                  className="font-mono select-none pointer-events-none"
                >
                  {formattedVal}
                  <tspan fontSize={9.5} fill={textSecondary} dx={4}>
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
// 2. SUBCOMPONENT: DONUT SHARE CONCENTRATION
// ==========================================
function DonutConcentrationChart({
  width,
  height,
  donutData,
  activeMetric,
  totalRevenue,
  totalUnitsSold,
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

  const radius = Math.min(width, height) / 2;
  const innerRadius = radius * 0.62;

  const handleSliceHover = (arc, i, e) => {
    const point = localPoint(e);
    if (point) {
      showTooltip({
        tooltipData: {
          productName: arc.data.label,
          sku: arc.data.sku,
          totalRevenue: activeMetric === 'revenue' ? arc.data.value : undefined,
          totalQuantity: activeMetric === 'quantity' ? arc.data.value : undefined,
          sharePercent: arc.data.sharePct,
          rank: i + 1,
        },
        tooltipLeft: point.x,
        tooltipTop: point.y,
      });
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center select-none">
      <svg width={width} height={height}>
        <Group top={height / 2} left={width / 2}>
          <Pie
            data={donutData}
            pieValue={(d) => Number(d.value) || 0}
            outerRadius={radius - 4}
            innerRadius={innerRadius}
            padAngle={0.03}
            cornerRadius={4}
          >
            {(pie) =>
              pie.arcs.map((arc, i) => (
                <path
                  key={`donut-slice-${i}`}
                  d={pie.path(arc) || ''}
                  fill={arc.data.color}
                  className="transition-transform duration-200 cursor-pointer hover:opacity-85"
                  onMouseEnter={(e) => handleSliceHover(arc, i, e)}
                  onMouseMove={(e) => handleSliceHover(arc, i, e)}
                  onMouseLeave={hideTooltip}
                />
              ))
            }
          </Pie>
        </Group>
      </svg>

      {/* Center Stat Inside Donut */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {activeMetric === 'revenue' ? 'Revenue' : 'Units'}
        </span>
        <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
          {activeMetric === 'revenue'
            ? formatCompact(totalRevenue, true)
            : totalUnitsSold.toLocaleString('en-IN')}
        </span>
      </div>

      {/* Portal-based Floating Tooltip */}
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
// 3. MAIN COMPONENT: PRODUCT PERFORMANCE
// ==========================================
const ProductPerformanceChart = ({
  productPerformance = [],
  totalRevenue = 0,
  totalUnitsSold = 0,
  isDark = false,
  loading = false,
}) => {
  // Metric Mode: 'revenue' | 'quantity' | 'orders'
  const [activeMetric, setActiveMetric] = useState('revenue');
  // Top Limit: 5 | 8 | 10
  const [topLimit, setTopLimit] = useState(8);

  // Sorted and limited dataset based on activeMetric
  const sortedProducts = useMemo(() => {
    if (!Array.isArray(productPerformance) || productPerformance.length === 0) return [];
    const list = [...productPerformance];
    list.sort((a, b) => {
      if (activeMetric === 'quantity') {
        return (Number(b.totalQuantity) || 0) - (Number(a.totalQuantity) || 0);
      }
      if (activeMetric === 'orders') {
        return (Number(b.ordersCount) || 0) - (Number(a.ordersCount) || 0);
      }
      return (Number(b.totalRevenue) || 0) - (Number(a.totalRevenue) || 0);
    });
    return list.slice(0, topLimit);
  }, [productPerformance, activeMetric, topLimit]);

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

  // Donut Data: Top 5 + Others
  const donutData = useMemo(() => {
    if (!productPerformance.length) return [];
    const top5 = productPerformance.slice(0, 5);
    const top5Total = top5.reduce((sum, p) => {
      const val = activeMetric === 'quantity' ? Number(p.totalQuantity || 0) : Number(p.totalRevenue || 0);
      return sum + val;
    }, 0);

    const overallTotal = activeMetric === 'quantity'
      ? (totalUnitsSold || 1)
      : (Number(totalRevenue) || 1);

    const remaining = Math.max(0, overallTotal - top5Total);

    const slices = top5.map((p, idx) => {
      const val = activeMetric === 'quantity' ? Number(p.totalQuantity || 0) : Number(p.totalRevenue || 0);
      return {
        label: p.productName || p.sku || `Product #${idx + 1}`,
        sku: p.sku,
        value: val,
        color: DONUT_COLORS[idx % DONUT_COLORS.length],
        sharePct: ((val / overallTotal) * 100).toFixed(1),
        isOther: false,
      };
    });

    if (remaining > 0 && productPerformance.length > 5) {
      slices.push({
        label: `Other ${productPerformance.length - 5} SKUs`,
        sku: 'OTHER',
        value: remaining,
        color: DONUT_COLORS[5],
        sharePct: ((remaining / overallTotal) * 100).toFixed(1),
        isOther: true,
      });
    }

    return slices;
  }, [productPerformance, activeMetric, totalRevenue, totalUnitsSold]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
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
    <div className="p-5 sm:p-6 space-y-6">
      {/* ================= CONTROLS & SUB-HEADER ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-white/5">
        {/* Metric Selector Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
            Plot Metric:
          </span>
          <button
            type="button"
            onClick={() => setActiveMetric('revenue')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
              activeMetric === 'revenue'
                ? 'bg-purple-600 text-white shadow-purple-500/20'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
            }`}
          >
            <FiDollarSign className="text-xs" />
            <span>Gross Revenue</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMetric('quantity')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
              activeMetric === 'quantity'
                ? 'bg-blue-600 text-white shadow-blue-500/20'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
            }`}
          >
            <FiBox className="text-xs" />
            <span>Units Sold</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMetric('orders')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
              activeMetric === 'orders'
                ? 'bg-amber-600 text-white shadow-amber-500/20'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
            }`}
          >
            <FiShoppingBag className="text-xs" />
            <span>Orders Count</span>
          </button>
        </div>

        {/* Top N Range Filter */}
        <div className="flex items-center gap-1.5 self-start md:self-auto">
          <span className="text-xs font-bold text-slate-400 mr-1">Show:</span>
          {[5, 8, 10].map((limit) => (
            <button
              key={limit}
              type="button"
              onClick={() => setTopLimit(limit)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                topLimit === limit
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              Top {limit}
            </button>
          ))}
        </div>
      </div>

      {/* ================= EXECUTIVE INSIGHT HIGHLIGHT STRIP ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Top Revenue Leader */}
        <div className="p-3.5 rounded-2xl bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <FiAward className="text-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
              Revenue Leader
            </span>
            <div className="font-extrabold text-xs text-slate-900 dark:text-white truncate" title={insights.topRevenueProduct?.productName}>
              {insights.topRevenueProduct?.productName || 'N/A'}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono">
              {formatCurrency(insights.topRevenueProduct?.totalRevenue || 0)}
            </div>
          </div>
        </div>

        {/* Top Volume Leader */}
        <div className="p-3.5 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <FiBox className="text-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
              Highest Volume Sold
            </span>
            <div className="font-extrabold text-xs text-slate-900 dark:text-white truncate" title={insights.topVolumeProduct?.productName}>
              {insights.topVolumeProduct?.productName || 'N/A'}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono">
              {(insights.topVolumeProduct?.totalQuantity || 0).toLocaleString('en-IN')} units
            </div>
          </div>
        </div>

        {/* Catalog Concentration */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <FiTrendingUp className="text-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              Top 3 Contribution
            </span>
            <div className="font-extrabold text-xs text-slate-900 dark:text-white">
              {productPerformance.slice(0, 3).reduce((sum, p) => {
                const totalRev = Number(totalRevenue) || 1;
                return sum + ((Number(p.totalRevenue || 0) / totalRev) * 100);
              }, 0).toFixed(1)}% of Revenue
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Generated by Top 3 bestsellers
            </div>
          </div>
        </div>
      </div>

      {/* ================= MAIN DUAL CHART PANELS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Ranked Leaderboard Bar Visualizer (8 Columns) */}
        <div className="lg:col-span-8 bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5 relative">
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
          <div style={{ height: Math.max(340, sortedProducts.length * 46) }}>
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
                    isDark={isDark}
                  />
                );
              }}
            </ParentSize>
          </div>
        </div>

        {/* Right: Portfolio Donut Breakdown & Category Share (4 Columns) */}
        <div className="lg:col-span-4 bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <FiPieChart className="text-blue-500" />
              <span>Share Concentration</span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Top 5 products vs remainder of catalog
            </p>

            {/* Donut Chart Container with portal-based tooltip */}
            <div className="h-48 relative mt-3 flex items-center justify-center">
              <ParentSize>
                {({ width, height }) => {
                  if (width <= 0 || height <= 0) return null;
                  return (
                    <DonutConcentrationChart
                      width={width}
                      height={height}
                      donutData={donutData}
                      activeMetric={activeMetric}
                      totalRevenue={totalRevenue}
                      totalUnitsSold={totalUnitsSold}
                      isDark={isDark}
                    />
                  );
                }}
              </ParentSize>
            </div>
          </div>

          {/* Legend Items */}
          <div className="space-y-1.5 pt-3 border-t border-slate-200/60 dark:border-white/5">
            {donutData.map((slice, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate" title={slice.label}>
                    {slice.label}
                  </span>
                </div>
                <div className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                  {slice.sharePct}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPerformanceChart;
