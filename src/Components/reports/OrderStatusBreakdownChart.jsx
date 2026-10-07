import React, { useState, useMemo } from 'react';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { LinearGradient } from '@visx/gradient';
import { ParentSize } from '@visx/responsive';
import { useTooltip, useTooltipInPortal, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import {
  FiLayers,
  FiDollarSign,
  FiCheckCircle,
  FiClock,
  FiTruck,
  FiXCircle,
  FiFilter,
  FiBarChart2,
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

// Compact format for axis and bar top labels
const formatCompact = (num, isCurrency = false) => {
  const val = Number(num) || 0;
  const prefix = isCurrency ? '₹' : '';
  if (val >= 10000000) return `${prefix}${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `${prefix}${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `${prefix}${(val / 1000).toFixed(1)}k`;
  return `${prefix}${val.toLocaleString('en-IN')}`;
};

// Stage visual metadata
const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    gradientId: 'grad-pending',
    from: '#f59e0b',
    to: '#d97706',
    hoverColor: '#fbbf24',
    textColor: 'text-amber-500 dark:text-amber-400',
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/15',
    icon: FiClock,
  },
  APPROVED: {
    label: 'Approved',
    gradientId: 'grad-approved',
    from: '#10b981',
    to: '#059669',
    hoverColor: '#34d399',
    textColor: 'text-emerald-500 dark:text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    icon: FiCheckCircle,
  },
  DISPATCHED: {
    label: 'Dispatched',
    gradientId: 'grad-dispatched',
    from: '#3b82f6',
    to: '#2563eb',
    hoverColor: '#60a5fa',
    textColor: 'text-blue-500 dark:text-blue-400',
    borderColor: 'border-blue-500/30',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/15',
    icon: FiTruck,
  },
  REJECTED: {
    label: 'Rejected',
    gradientId: 'grad-rejected',
    from: '#f43f5e',
    to: '#e11d48',
    hoverColor: '#fb7185',
    textColor: 'text-rose-500 dark:text-rose-400',
    borderColor: 'border-rose-500/30',
    bgColor: 'bg-rose-500/10 dark:bg-rose-500/15',
    icon: FiXCircle,
  },
};

const DEFAULT_STATUS_CONFIG = {
  label: 'Other',
  gradientId: 'grad-default',
  from: '#8b5cf6',
  to: '#6d28d9',
  hoverColor: '#a78bfa',
  textColor: 'text-purple-500 dark:text-purple-400',
  borderColor: 'border-purple-500/30',
  bgColor: 'bg-purple-500/10 dark:bg-purple-500/15',
  icon: FiLayers,
};

const getStatusMeta = (statusKey) => {
  const key = String(statusKey || '').toUpperCase();
  return STATUS_CONFIG[key] || { ...DEFAULT_STATUS_CONFIG, label: statusKey || 'Other' };
};

// Inner SVG Chart Renderer
function InnerBarChart({
  width,
  height,
  data,
  metric,
  totalOrders,
  totalRevenue,
  selectedStatus,
  onSelectStatus,
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

  const isMobile = width < 480;
  const margin = isMobile
    ? { top: 28, right: 12, bottom: 42, left: 44 }
    : { top: 32, right: 24, bottom: 48, left: 54 };

  const xMax = Math.max(0, width - margin.left - margin.right);
  const yMax = Math.max(0, height - margin.top - margin.bottom);

  // Scales
  const xScale = useMemo(
    () =>
      scaleBand({
        domain: data.map((d) => d.status),
        range: [0, xMax],
        padding: data.length <= 2 ? 0.5 : 0.32,
      }),
    [data, xMax]
  );

  const maxVal = useMemo(() => {
    const values = data.map((d) => (metric === 'count' ? d.count : d.totalAmount));
    const highest = Math.max(...values, 0);
    return highest > 0 ? highest : 10;
  }, [data, metric]);

  const yScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, maxVal * 1.18],
        range: [yMax, 0],
        nice: true,
      }),
    [maxVal, yMax]
  );

  if (width < 20 || height < 20) return null;

  const gridStroke = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const axisStroke = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
  const axisTextFill = isDark ? '#94a3b8' : '#64748b';

  return (
    <div ref={containerRef} className="relative w-full h-full select-none">
      <svg width={width} height={height} className="overflow-visible">
        {/* Gradients */}
        <defs>
          <LinearGradient
            id="grad-pending"
            from="#f59e0b"
            to="#d97706"
            fromOpacity={0.95}
            toOpacity={0.65}
          />
          <LinearGradient
            id="grad-approved"
            from="#10b981"
            to="#059669"
            fromOpacity={0.95}
            toOpacity={0.65}
          />
          <LinearGradient
            id="grad-dispatched"
            from="#3b82f6"
            to="#2563eb"
            fromOpacity={0.95}
            toOpacity={0.65}
          />
          <LinearGradient
            id="grad-rejected"
            from="#f43f5e"
            to="#e11d48"
            fromOpacity={0.95}
            toOpacity={0.65}
          />
          <LinearGradient
            id="grad-default"
            from="#8b5cf6"
            to="#6d28d9"
            fromOpacity={0.95}
            toOpacity={0.65}
          />
        </defs>

        <Group left={margin.left} top={margin.top}>
          {/* Subtle Horizontal Grid Rows */}
          <GridRows
            scale={yScale}
            width={xMax}
            stroke={gridStroke}
            strokeDasharray="3 3"
            pointerEvents="none"
            numTicks={5}
          />

          {/* Bar Columns */}
          {data.map((d) => {
            const statusKey = d.status;
            const meta = getStatusMeta(statusKey);
            const val = metric === 'count' ? d.count : d.totalAmount;
            const barWidth = xScale.bandwidth();
            const barX = xScale(statusKey) || 0;
            const barY = yScale(val);
            const barHeight = Math.max(0, yMax - barY);

            const isHovered = hoveredKey === statusKey;
            const isSelected = selectedStatus === statusKey;
            const hasSelection = selectedStatus && selectedStatus !== 'ALL';
            const opacity = hasSelection ? (isSelected ? 1 : 0.35) : isHovered ? 1 : 0.88;

            return (
              <Group key={`bar-group-${statusKey}`}>
                {/* Background hover pillar track */}
                <rect
                  x={barX - 4}
                  y={0}
                  width={barWidth + 8}
                  height={yMax}
                  fill={isHovered ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent'}
                  rx={8}
                  className="pointer-events-none transition-colors duration-150"
                />

                {/* The Animated Rounded Bar */}
                <Bar
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  fill={isHovered ? meta.hoverColor : `url(#${meta.gradientId})`}
                  opacity={opacity}
                  rx={6}
                  ry={6}
                  stroke={isSelected ? '#ffffff' : isHovered ? meta.hoverColor : 'transparent'}
                  strokeWidth={isSelected ? 2 : 1}
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => onSelectStatus && onSelectStatus(statusKey)}
                  onMouseEnter={(e) => {
                    setHoveredKey(statusKey);
                    const point = localPoint(e);
                    if (point) {
                      showTooltip({
                        tooltipData: d,
                        tooltipLeft: point.x,
                        tooltipTop: point.y,
                      });
                    }
                  }}
                  onMouseMove={(e) => {
                    const point = localPoint(e);
                    if (point) {
                      showTooltip({
                        tooltipData: d,
                        tooltipLeft: point.x,
                        tooltipTop: point.y,
                      });
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredKey(null);
                    hideTooltip();
                  }}
                />

                {/* Value Label on Top of the Bar */}
                {barHeight > 10 && (
                  <text
                    x={barX + barWidth / 2}
                    y={Math.max(12, barY - 7)}
                    textAnchor="middle"
                    fontSize={isMobile ? 10 : 11}
                    fontWeight="700"
                    fill={isDark ? '#e2e8f0' : '#1e293b'}
                    className="pointer-events-none select-none transition-opacity duration-200"
                    opacity={hasSelection && !isSelected ? 0.35 : 1}
                  >
                    {metric === 'count' ? d.count : formatCompact(d.totalAmount, true)}
                  </text>
                )}
              </Group>
            );
          })}

          {/* Left Y Axis */}
          <AxisLeft
            scale={yScale}
            numTicks={5}
            stroke={axisStroke}
            tickStroke={axisStroke}
            tickLabelProps={() => ({
              fill: axisTextFill,
              fontSize: 10,
              fontWeight: 600,
              textAnchor: 'end',
              dx: -4,
              dy: 3,
            })}
            tickFormat={(val) => (metric === 'count' ? `${val}` : formatCompact(val, true))}
          />

          {/* Bottom X Axis */}
          <AxisBottom
            top={yMax}
            scale={xScale}
            stroke={axisStroke}
            tickStroke="transparent"
            tickLabelProps={(val) => {
              const isSelected = selectedStatus === val;
              return {
                fill: isSelected
                  ? isDark
                    ? '#ffffff'
                    : '#0f172a'
                  : axisTextFill,
                fontSize: isMobile ? 10 : 11,
                fontWeight: isSelected ? 700 : 600,
                textAnchor: 'middle',
                dy: 4,
              };
            }}
            tickFormat={(val) => {
              const meta = getStatusMeta(val);
              return meta.label;
            }}
          />
        </Group>
      </svg>

      {/* Interactive Tooltip in Portal */}
      {tooltipOpen && tooltipData && (
        <TooltipInPortal
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.97)',
            color: isDark ? '#ffffff' : '#0f172a',
            border: isDark
              ? '1px solid rgba(255, 255, 255, 0.15)'
              : '1px solid rgba(226, 232, 240, 0.9)',
            borderRadius: '16px',
            boxShadow:
              '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(16px)',
            padding: '12px 14px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 9999,
            minWidth: '190px',
          }}
        >
          {(() => {
            const meta = getStatusMeta(tooltipData.status);
            const Icon = meta.icon;
            const count = Number(tooltipData.count) || 0;
            const totalAmt = Number(tooltipData.totalAmount) || 0;
            const safeTotalOrders = totalOrders > 0 ? totalOrders : 1;
            const safeTotalRev = totalRevenue > 0 ? totalRevenue : 1;
            const countPct = Math.round((count / safeTotalOrders) * 100);
            const revPct = Math.round((totalAmt / safeTotalRev) * 100);
            const avgOrderValue = count > 0 ? Math.round(totalAmt / count) : 0;

            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: meta.from }}
                    />
                    <span className="font-extrabold text-xs tracking-wide">{tooltipData.status}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${meta.bgColor} ${meta.textColor} ${meta.borderColor} flex items-center gap-1`}
                  >
                    <Icon className="text-[10px]" />
                    {meta.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Orders</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                      {count} <span className="text-[10px] text-slate-400">({countPct}%)</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Commitment</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                      {formatCompact(totalAmt, true)}{' '}
                      <span className="text-[10px] text-slate-400">({revPct}%)</span>
                    </p>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Avg Value/PO:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {formatCurrency(avgOrderValue)}
                  </span>
                </div>

                <div className="pt-1 text-[9px] text-blue-500 dark:text-blue-400 text-center font-medium italic">
                  Click bar to filter table
                </div>
              </div>
            );
          })()}
        </TooltipInPortal>
      )}
    </div>
  );
}

// Master Export Component
export default function OrderStatusBreakdownChart({
  statusBreakdown = [],
  totalRevenue = 0,
  totalOrders = 0,
  selectedStatus = 'ALL',
  onSelectStatus,
  isDark = false,
  loading = false,
}) {
  const [metric, setMetric] = useState('count'); // 'count' | 'revenue'

  // Standard ordered pipeline stages
  const formattedData = useMemo(() => {
    const orderPriority = ['PENDING', 'APPROVED', 'DISPATCHED', 'REJECTED'];

    // Map existing records
    const recordMap = {};
    if (Array.isArray(statusBreakdown)) {
      statusBreakdown.forEach((item) => {
        const key = String(item._id || item.status || '').toUpperCase();
        if (key) {
          recordMap[key] = {
            status: key,
            count: Number(item.count) || 0,
            totalAmount: Number(item.totalAmount || item.totalValue) || 0,
          };
        }
      });
    }

    // Ensure standard stages are preserved or appended
    const result = [];
    orderPriority.forEach((st) => {
      if (recordMap[st]) {
        result.push(recordMap[st]);
        delete recordMap[st];
      } else {
        // If status wasn't recorded, keep placeholder if there are orders or leave out
        result.push({
          status: st,
          count: 0,
          totalAmount: 0,
        });
      }
    });

    // Add any remaining custom statuses
    Object.values(recordMap).forEach((item) => {
      result.push(item);
    });

    return result;
  }, [statusBreakdown]);

  const calculatedTotalOrders = useMemo(() => {
    if (totalOrders > 0) return totalOrders;
    return formattedData.reduce((sum, d) => sum + (d.count || 0), 0);
  }, [totalOrders, formattedData]);

  const calculatedTotalRevenue = useMemo(() => {
    if (totalRevenue > 0) return totalRevenue;
    return formattedData.reduce((sum, d) => sum + (d.totalAmount || 0), 0);
  }, [totalRevenue, formattedData]);

  const hasData = formattedData.some((d) => d.count > 0 || d.totalAmount > 0);

  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-lg flex flex-col justify-between">
      <div>
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <FiBarChart2 className="text-lg" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Order Status Breakdown</span>
                {selectedStatus && selectedStatus !== 'ALL' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    Filtered: {selectedStatus}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Distribution of order volume and financial commitments
              </p>
            </div>
          </div>

          {/* Metric Toggle Tabs */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-white/5">
            <button
              type="button"
              onClick={() => setMetric('count')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${metric === 'count'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
            >
              <FiLayers className="text-xs" />
              <span>Volume</span>
            </button>
            <button
              type="button"
              onClick={() => setMetric('revenue')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${metric === 'revenue'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
            >
              <FiDollarSign className="text-xs" />
              <span>Revenue</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="space-y-4 my-4">
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        ) : !hasData ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <FiLayers className="text-2xl text-slate-300 dark:text-slate-600" />
            <span>No order statuses recorded yet for this range.</span>
          </div>
        ) : (
          <div className="w-full">
            {/* Visx Bar Chart Container */}
            <div className="w-full h-[240px] min-h-[240px] my-1">
              <ParentSize>
                {({ width, height }) => (
                  <InnerBarChart
                    width={width}
                    height={height}
                    data={formattedData}
                    metric={metric}
                    totalOrders={calculatedTotalOrders}
                    totalRevenue={calculatedTotalRevenue}
                    selectedStatus={selectedStatus}
                    onSelectStatus={onSelectStatus}
                    isDark={isDark}
                  />
                )}
              </ParentSize>
            </div>

            {/* Quick Status Pill Filters & Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-200/60 dark:border-white/5">
              {formattedData.map((item) => {
                const meta = getStatusMeta(item.status);
                const Icon = meta.icon;
                const isSelected = selectedStatus === item.status;

                return (
                  <button
                    key={`pill-${item.status}`}
                    type="button"
                    onClick={() => onSelectStatus && onSelectStatus(item.status)}
                    className={`p-2.5 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between ${isSelected
                        ? `ring-2 ring-blue-500 dark:ring-blue-400 ${meta.bgColor} ${meta.borderColor}`
                        : `bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15`
                      }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold ${meta.textColor}`}
                      >
                        <Icon className="text-xs" />
                        <span>{meta.label}</span>
                      </span>
                      {isSelected && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500 text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                        {item.count} <span className="text-[10px] font-normal text-slate-400">POs</span>
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {formatCompact(item.totalAmount, true)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span>Pipeline Stage Distribution</span>
          {selectedStatus && selectedStatus !== 'ALL' && (
            <button
              type="button"
              onClick={() => onSelectStatus && onSelectStatus('ALL')}
              className="text-blue-500 hover:underline font-semibold text-[11px] cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
        <span className="font-bold text-slate-700 dark:text-slate-300">
          Total: {formatCurrency(calculatedTotalRevenue)} ({calculatedTotalOrders} Orders)
        </span>
      </div>
    </div>
  );
}
