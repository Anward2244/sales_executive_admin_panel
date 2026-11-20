import React, { useState, useMemo, useCallback } from 'react';
import { Group } from '@visx/group';
import { Pie } from '@visx/shape';
import { ParentSize } from '@visx/responsive';
import { useTooltip, useTooltipInPortal, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { animated, useSpring } from '@react-spring/web';
import {
  FiDollarSign,
  FiBox,
  FiShoppingBag,
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
  '#9333ea', // Purple-600
  '#3b82f6', // Blue-500
  '#06b6d4', // Cyan-500
  '#f59e0b', // Amber-500
  '#ec4899', // Pink-500
  '#94a3b8', // Slate-400 for "Others"
];

// Tooltip Theme Styler
const getProductTooltipStyle = (isDark) => ({
  ...defaultStyles,
  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
  color: isDark ? '#ffffff' : '#0f172a',
  border: isDark
    ? '1px solid rgba(255, 255, 255, 0.15)'
    : '1px solid rgba(226, 232, 240, 0.9)',
  borderRadius: '16px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(10px)',
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

// Animated Pie Arc Item with Spring Physics
function AnimatedArcItem({
  arc,
  path,
  fill,
  isHovered,
  isDark,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}) {
  const spring = useSpring({
    from: { opacity: 0, scale: 0.8 },
    to: { opacity: 1, scale: isHovered ? 1.03 : 1 },
    config: { tension: 170, friction: 14 },
  });

  return (
    <animated.path
      d={path(arc) || ''}
      fill={fill}
      opacity={spring.opacity}
      transform={spring.scale.to((s) => `scale(${s})`)}
      transformOrigin="center center"
      stroke={isHovered ? (isDark ? '#ffffff' : '#0f172a') : 'transparent'}
      strokeWidth={isHovered ? 2.5 : 0}
      className="transition-colors duration-150 cursor-pointer"
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    />
  );
}

// Animated Segment for the Stacked Catalog Bar
function AnimatedStackedSegment({ slice }) {
  const spring = useSpring({
    from: { width: '0%' },
    to: { width: `${slice.sharePct}%` },
    config: { tension: 130, friction: 16 },
  });

  return (
    <animated.div
      style={{
        ...spring,
        backgroundColor: slice.color,
      }}
      className="h-full first:rounded-l-full last:rounded-r-full"
      title={`${slice.label}: ${slice.sharePct}%`}
    />
  );
}

// Animated Progress Bar for Top Products
function AnimatedProductProgress({ share, isFirst, idx }) {
  const spring = useSpring({
    from: { width: '0%' },
    to: { width: `${Math.min(100, Math.max(8, Number(share)))}%` },
    config: { tension: 130, friction: 15 },
  });

  return (
    <div className="h-1 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
      <animated.div
        className={`h-full rounded-full ${
          isFirst
            ? 'bg-purple-600 dark:bg-purple-400'
            : idx === 1
              ? 'bg-indigo-500'
              : idx === 2
                ? 'bg-blue-500'
                : 'bg-sky-400'
        }`}
        style={spring}
      />
    </div>
  );
}

// ==========================================
// 1. SUBCOMPONENT: DONUT SHARE CONCENTRATION
// ==========================================
function DonutConcentrationChart({
  width,
  height,
  donutData,
  activeMetric,
  isDark,
  top3Contribution,
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

  const [hoveredIdx, setHoveredIdx] = useState(null);

  const radius = Math.min(width, height) / 2 - 8;
  const innerRadius = radius * 0.62;

  const handleSliceHover = (arc, i, e) => {
    setHoveredIdx(i);
    const point = localPoint(e);
    if (point) {
      showTooltip({
        tooltipData: {
          productName: arc.data.label,
          sku: arc.data.sku,
          totalRevenue: activeMetric === 'revenue' ? arc.data.value : undefined,
          totalQuantity: activeMetric === 'quantity' ? arc.data.value : undefined,
          ordersCount: activeMetric === 'orders' ? arc.data.value : undefined,
          sharePercent: arc.data.sharePct,
          rank: i + 1,
        },
        tooltipLeft: point.x,
        tooltipTop: point.y,
      });
    }
  };

  const textPrimary = isDark ? '#ffffff' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center select-none">
      <svg width={width} height={height} className="overflow-visible">
        <Group top={height / 2} left={width / 2}>
          <Pie
            data={donutData}
            pieValue={(d) => Number(d.value) || 0}
            outerRadius={radius}
            innerRadius={innerRadius}
            padAngle={0.03}
            cornerRadius={4}
          >
            {(pie) =>
              pie.arcs.map((arc, i) => (
                <AnimatedArcItem
                  key={`donut-slice-${i}`}
                  arc={arc}
                  path={pie.path}
                  fill={arc.data.color}
                  isHovered={hoveredIdx === i}
                  isDark={isDark}
                  onMouseEnter={(e) => handleSliceHover(arc, i, e)}
                  onMouseMove={(e) => handleSliceHover(arc, i, e)}
                  onMouseLeave={() => {
                    setHoveredIdx(null);
                    hideTooltip();
                  }}
                />
              ))
            }
          </Pie>

          {/* Center Callout inside Donut hole */}
          <text
            x={0}
            y={-10}
            textAnchor="middle"
            fontSize={9}
            fontWeight="700"
            fill={textMuted}
            className="uppercase tracking-wider select-none pointer-events-none"
          >
            Top 3 Share
          </text>
          <text
            x={0}
            y={10}
            textAnchor="middle"
            fontSize={16}
            fontWeight="900"
            fill={textPrimary}
            className="font-mono select-none pointer-events-none"
          >
            {top3Contribution}%
          </text>
          <text
            x={0}
            y={24}
            textAnchor="middle"
            fontSize={8}
            fontWeight="600"
            fill={textMuted}
            className="select-none pointer-events-none"
          >
            {activeMetric === 'revenue' ? 'of Revenue' : activeMetric === 'quantity' ? 'of Volume' : 'of Orders'}
          </text>
        </Group>
      </svg>

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
  // Selected product row for interactive highlight
  const [selectedProduct, setSelectedProduct] = useState(null);

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

  // Sorted product list based on activeMetric
  const sortedProducts = useMemo(() => {
    if (!Array.isArray(productPerformance) || productPerformance.length === 0) return [];
    const list = [...productPerformance];
    list.sort((a, b) => getMetricVal(b, activeMetric) - getMetricVal(a, activeMetric));
    return list;
  }, [productPerformance, activeMetric, getMetricVal]);

  // Top product (matching Peak State in Heatmap)
  const topProduct = useMemo(() => {
    if (!sortedProducts.length) return null;
    return sortedProducts[0];
  }, [sortedProducts]);

  // Overall total for activeMetric
  const overallMetricTotal = useMemo(() => {
    if (activeMetric === 'quantity') return Number(totalUnitsSold) || 1;
    if (activeMetric === 'orders') return Number(effectiveTotalOrders) || 1;
    return Number(totalRevenue) || 1;
  }, [activeMetric, totalRevenue, totalUnitsSold, effectiveTotalOrders]);

  // Top Product Share %
  const topProductShare = useMemo(() => {
    if (!topProduct) return '0.0';
    const val = getMetricVal(topProduct, activeMetric);
    return overallMetricTotal > 0 ? ((val / overallMetricTotal) * 100).toFixed(1) : '0.0';
  }, [topProduct, activeMetric, overallMetricTotal, getMetricVal]);

  // Top 3 Contribution calculation matching activeMetric
  const top3Contribution = useMemo(() => {
    if (!sortedProducts.length) return '0.0';
    const top3 = sortedProducts.slice(0, 3);
    const sum = top3.reduce((acc, p) => acc + getMetricVal(p, activeMetric), 0);
    return Math.min(100, (sum / overallMetricTotal) * 100).toFixed(1);
  }, [sortedProducts, activeMetric, overallMetricTotal, getMetricVal]);

  // Donut slices dataset: Top 5 + Others
  const donutData = useMemo(() => {
    if (!sortedProducts.length) return [];
    const top5 = sortedProducts.slice(0, 5);
    const top5Total = top5.reduce((sum, p) => sum + getMetricVal(p, activeMetric), 0);
    const remaining = Math.max(0, overallMetricTotal - top5Total);

    const slices = top5.map((p, idx) => {
      const val = getMetricVal(p, activeMetric);
      return {
        label: p.productName || p.sku || `Product #${idx + 1}`,
        sku: p.sku || '',
        value: val,
        sharePct: overallMetricTotal > 0 ? ((val / overallMetricTotal) * 100).toFixed(1) : '0.0',
        color: DONUT_COLORS[idx % DONUT_COLORS.length],
        product: p,
      };
    });

    if (remaining > 0 && sortedProducts.length > 5) {
      slices.push({
        label: 'Other Products',
        sku: 'OTHER',
        value: remaining,
        sharePct: overallMetricTotal > 0 ? ((remaining / overallMetricTotal) * 100).toFixed(1) : '0.0',
        color: DONUT_COLORS[5],
        product: null,
      });
    }

    return slices;
  }, [sortedProducts, activeMetric, overallMetricTotal, getMetricVal]);

  if (loading) {
    return (
      <div className="p-3 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-44 rounded-xl" />
          <Skeleton className="h-8 w-32 rounded-xl" />
        </div>
        <div className="space-y-3 pt-2">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
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
    <div className="p-3 flex-1 flex flex-col justify-start">
      {/* ================= TOP SECTION: CONTROLS, HIGHLIGHT PILL & CANVAS ================= */}
      <div>
        {/* Highest Demand Product Highlight Pill (matching Peak State Pill in Heatmap) */}
        {topProduct ? (
          <div className="mb-2 p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 dark:bg-purple-400 animate-pulse shrink-0" />
              <span className="text-xs text-slate-700 dark:text-slate-300 truncate">
                Top Performer:{' '}
                <strong className="text-purple-600 dark:text-purple-400 font-bold">
                  {topProduct.productName || topProduct.sku}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                {activeMetric === 'revenue'
                  ? formatCompact(topProduct.totalRevenue, true)
                  : activeMetric === 'quantity'
                    ? `${(topProduct.totalQuantity || 0).toLocaleString('en-IN')} units`
                    : `${topProduct.ordersCount || 0} POs`}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold">
                {topProductShare}%
              </span>
            </div>
          </div>
        ) : (
          <div className="mb-2 p-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-xs text-slate-400 text-center">
            No product distribution recorded in this timeframe
          </div>
        )}
        
        {/* Metric Selector Bar */}
        <div className="flex items-center justify-between gap-2 mb-2">
          {/* Metric Selector Pills */}
          <div className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveMetric('revenue')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeMetric === 'revenue'
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
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeMetric === 'quantity'
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
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeMetric === 'orders'
                  ? 'bg-amber-600 text-white shadow-amber-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FiShoppingBag className="text-xs" />
              <span>Orders</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 font-semibold px-2">
            Share Concentration
          </span>
        </div>

        {/* Visual Chart Canvas - Compact and balanced Donut visualization */}
        <div className="relative w-full bg-purple-200/10 dark:bg-purple-950/20 rounded-2xl h-[195px] sm:h-[210px] mx-auto flex items-center justify-center select-none overflow-hidden my-1.5">
          <ParentSize>
            {({ width, height }) => {
              if (width <= 0 || height <= 0) return null;
              return (
                <DonutConcentrationChart
                  width={width}
                  height={height}
                  donutData={donutData}
                  activeMetric={activeMetric}
                  isDark={isDark}
                  top3Contribution={top3Contribution}
                />
              );
            }}
          </ParentSize>
        </div>

        {/* Donut Legend Color Pills - Symmetrically aligned in a 2/3-column grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 mb-2">
          {donutData.map((slice, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-xs select-none hover:border-slate-300 dark:hover:border-white/10 transition-colors shadow-2xs"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                style={{ backgroundColor: slice.color }}
              />
              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate text-[11px] min-w-0 flex-1" title={slice.label}>
                {slice.label}
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px] shrink-0">
                {slice.sharePct}%
              </span>
            </div>
          ))}
        </div>

        {/* Catalog Share Distribution Legend (matching Heatmap Spectrum Legend) */}
        <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>
                Top 3 Share:{' '}
                <strong className="text-purple-600 dark:text-purple-400 font-bold">
                  {top3Contribution}%
                </strong>
              </span>
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {productPerformance.length} Total SKUs
            </span>
          </div>

          {/* Multi-segment stacked bar with spring-animated width */}
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/5 flex overflow-hidden">
            {donutData.map((slice, idx) => (
              <AnimatedStackedSegment key={idx} slice={slice} />
            ))}
          </div>
        </div>
      </div>

      {/* ================= BOTTOM SECTION: TOP 5 PRODUCTS RANKING LIST ================= */}
      <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          <span>Top Performing Products</span>
          <span>
            {activeMetric === 'revenue'
              ? 'Revenue / Share'
              : activeMetric === 'quantity'
                ? 'Units / Share'
                : 'Orders / Share'}
          </span>
        </div>

        {sortedProducts.length > 0 ? (
          sortedProducts.slice(0, 5).map((prod, idx) => {
            const val = getMetricVal(prod, activeMetric);
            const share = overallMetricTotal > 0 ? ((val / overallMetricTotal) * 100).toFixed(1) : '0.0';
            const isFirst = idx === 0;
            const formattedVal =
              activeMetric === 'revenue'
                ? formatCompact(val, true)
                : `${val.toLocaleString('en-IN')} ${activeMetric === 'quantity' ? 'units' : 'POs'}`;

            const isSelected =
              selectedProduct?._id === prod._id ||
              (prod.sku && selectedProduct?.sku === prod.sku);

            return (
              <div
                key={prod._id || prod.sku || idx}
                onClick={() =>
                  setSelectedProduct((prev) =>
                    prev?._id === prod._id || (prod.sku && prev?.sku === prod.sku) ? null : prod
                  )
                }
                className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-500/40 shadow-xs'
                    : 'bg-white/80 dark:bg-white/3 border-slate-200/70 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span
                      className={`w-5 h-5 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
                        isFirst
                          ? 'bg-purple-600 text-white shadow-xs'
                          : idx === 1
                            ? 'bg-indigo-500 text-white'
                            : idx === 2
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <span
                      className="font-semibold text-slate-800 dark:text-slate-200 truncate"
                      title={prod.productName || prod.sku}
                    >
                      {prod.productName || prod.sku}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formattedVal}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      {share}%
                    </span>
                  </div>
                </div>

                {/* Relative Volume Progress Bar with Spring Animation */}
                <AnimatedProductProgress share={share} isFirst={isFirst} idx={idx} />
              </div>
            );
          })
        ) : (
          <div className="py-4 text-center text-xs text-slate-400">
            No product performance records available.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductPerformanceChart;
