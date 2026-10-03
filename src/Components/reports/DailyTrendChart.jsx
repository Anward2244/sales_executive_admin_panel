import React, { useState, useMemo, useCallback } from 'react';
import { Group } from '@visx/group';
import { AreaClosed, LinePath, Bar, Line } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { LinearGradient } from '@visx/gradient';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { ParentSize } from '@visx/responsive';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import {
  FiTrendingUp,
  FiDollarSign,
  FiLayers,
  FiCalendar,
  FiAward,
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

// Compact format for axis ticks and labels
const formatCompact = (num, isCurrency = false) => {
  const val = Number(num) || 0;
  const prefix = isCurrency ? '₹' : '';
  if (val >= 10000000) return `${prefix}${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `${prefix}${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `${prefix}${(val / 1000).toFixed(1)}k`;
  return `${prefix}${val.toLocaleString('en-IN')}`;
};

// Parse date safely
const parseDate = (d) => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  const parts = String(d).split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  return new Date(d);
};

const formatDateTick = (date) => {
  try {
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return String(date);
  }
};

const formatFullDate = (date) => {
  try {
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(date);
  }
};

// Accessors
const getDate = (d) => parseDate(d.date || d._id);

// Inner SVG Line & Area Chart Renderer
function InnerTrendLineChart({
  width,
  height,
  data,
  metric, // 'revenue' | 'orders'
  totalRevenue,
  totalOrders,
  peakRevenue,
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

  const isMobile = width < 480;
  const margin = isMobile
    ? { top: 28, right: 14, bottom: 42, left: 46 }
    : { top: 32, right: 24, bottom: 48, left: 56 };

  const xMax = Math.max(0, width - margin.left - margin.right);
  const yMax = Math.max(0, height - margin.top - margin.bottom);

  // Value accessor based on metric
  const getYValue = useCallback(
    (d) => (metric === 'revenue' ? Number(d.totalAmount) || 0 : Number(d.orderCount) || 0),
    [metric]
  );

  // Scales
  const timeScale = useMemo(() => {
    if (!data.length) return null;
    const dates = data.map(getDate);
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    // If only 1 data point, buffer by 1 day on each side
    if (minDate.getTime() === maxDate.getTime()) {
      minDate.setDate(minDate.getDate() - 1);
      maxDate.setDate(maxDate.getDate() + 1);
    }
    return scaleTime({
      domain: [minDate, maxDate],
      range: [0, xMax],
    });
  }, [data, xMax]);

  const maxY = useMemo(() => {
    const values = data.map(getYValue);
    const highest = Math.max(...values, 0);
    return highest > 0 ? highest : 10;
  }, [data, getYValue]);

  const yScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, maxY * 1.18],
        range: [yMax, 0],
        nice: true,
      }),
    [maxY, yMax]
  );

  // Hover detection handler
  const handleTooltip = useCallback(
    (event) => {
      if (!data.length || !timeScale) return;
      const point = localPoint(event);
      if (!point) return;
      const x0 = point.x - margin.left;

      if (x0 < 0 || x0 > xMax) {
        hideTooltip();
        return;
      }

      const xDate = timeScale.invert(x0);
      let closestItem = data[0];
      let minDiff = Infinity;

      data.forEach((d) => {
        const itemDate = getDate(d);
        const diff = Math.abs(xDate.getTime() - itemDate.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closestItem = d;
        }
      });

      if (closestItem) {
        const cx = timeScale(getDate(closestItem)) + margin.left;
        const cy = yScale(getYValue(closestItem)) + margin.top;
        showTooltip({
          tooltipData: closestItem,
          tooltipLeft: cx,
          tooltipTop: cy,
        });
      }
    },
    [data, timeScale, margin.left, margin.top, xMax, yScale, getYValue, showTooltip, hideTooltip]
  );

  if (width < 20 || height < 20 || !timeScale) return null;

  const isRevenue = metric === 'revenue';
  const strokeColor = isRevenue ? '#10b981' : '#3b82f6';
  const areaGradId = isRevenue ? 'daily-trend-revenue-grad' : 'daily-trend-orders-grad';
  const gridStroke = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const axisStroke = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
  const axisTextFill = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="relative w-full h-full select-none">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          {/* Emerald Gradient for Revenue */}
          <LinearGradient
            id="daily-trend-revenue-grad"
            from="#10b981"
            to="#14b8a6"
            fromOpacity={0.4}
            toOpacity={0.03}
          />
          {/* Blue Gradient for Orders */}
          <LinearGradient
            id="daily-trend-orders-grad"
            from="#3b82f6"
            to="#6366f1"
            fromOpacity={0.4}
            toOpacity={0.03}
          />
        </defs>

        <Group left={margin.left} top={margin.top}>
          {/* Subtle Grid Rows */}
          <GridRows
            scale={yScale}
            width={xMax}
            stroke={gridStroke}
            strokeDasharray="3 3"
            pointerEvents="none"
            numTicks={5}
          />

          {/* Shaded Area Under Curve */}
          <AreaClosed
            data={data}
            x={(d) => timeScale(getDate(d)) ?? 0}
            y={(d) => yScale(getYValue(d)) ?? 0}
            yScale={yScale}
            strokeWidth={0}
            curve={curveMonotoneX}
            fill={`url(#${areaGradId})`}
          />

          {/* Smooth Trend Line */}
          <LinePath
            data={data}
            x={(d) => timeScale(getDate(d)) ?? 0}
            y={(d) => yScale(getYValue(d)) ?? 0}
            curve={curveMonotoneX}
            stroke={strokeColor}
            strokeWidth={2.5}
            strokeLinecap="round"
          />

          {/* Data Points (Dots on chart) */}
          {data.length <= 31 &&
            data.map((d, i) => {
              const cx = timeScale(getDate(d));
              const cy = yScale(getYValue(d));
              const isHovered = tooltipOpen && tooltipData && (tooltipData.date === d.date || tooltipData._id === d._id);
              const isPeak = isRevenue && Number(d.totalAmount) === peakRevenue && peakRevenue > 0;

              return (
                <g key={`point-${d._id || i}`}>
                  {isPeak && !isHovered && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={6}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      className="animate-pulse"
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6 : isPeak ? 4.5 : 3}
                    fill={isHovered ? '#ffffff' : isPeak ? '#f59e0b' : strokeColor}
                    stroke={strokeColor}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    className="transition-all duration-150"
                  />
                </g>
              );
            })}

          {/* Hover guideline and active dot */}
          {tooltipOpen && tooltipData && (
            <g pointerEvents="none">
              <Line
                from={{ x: timeScale(getDate(tooltipData)), y: 0 }}
                to={{ x: timeScale(getDate(tooltipData)), y: yMax }}
                stroke={isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)'}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              <circle
                cx={timeScale(getDate(tooltipData))}
                cy={yScale(getYValue(tooltipData))}
                r={7}
                fill={strokeColor}
                stroke="#ffffff"
                strokeWidth={2.5}
              />
            </g>
          )}

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
            tickFormat={(val) => (isRevenue ? formatCompact(val, true) : `${val}`)}
          />

          {/* Bottom X Axis */}
          <AxisBottom
            top={yMax}
            scale={timeScale}
            numTicks={isMobile ? 4 : data.length > 15 ? 7 : data.length}
            stroke={axisStroke}
            tickStroke="transparent"
            tickLabelProps={() => ({
              fill: axisTextFill,
              fontSize: isMobile ? 10 : 11,
              fontWeight: 600,
              textAnchor: 'middle',
              dy: 4,
            })}
            tickFormat={(val) => formatDateTick(val)}
          />

          {/* Invisible Overlay for Mouse Interaction */}
          <Bar
            x={0}
            y={0}
            width={xMax}
            height={yMax}
            fill="transparent"
            className="cursor-crosshair"
            onMouseMove={handleTooltip}
            onMouseLeave={hideTooltip}
          />
        </Group>
      </svg>

      {/* Floating Tooltip */}
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
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
            zIndex: 999,
            minWidth: '200px',
          }}
        >
          {(() => {
            const dateObj = getDate(tooltipData);
            const rev = Number(tooltipData.totalAmount) || 0;
            const ord = Number(tooltipData.orderCount) || 0;
            const aov = ord > 0 ? Math.round(rev / ord) : 0;
            const safeTotalRev = totalRevenue > 0 ? totalRevenue : 1;
            const revPct = Math.round((rev / safeTotalRev) * 100);

            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <FiCalendar className="text-emerald-500 text-xs" />
                    <span className="font-extrabold text-xs tracking-wide">
                      {formatFullDate(dateObj)}
                    </span>
                  </div>
                  {rev === peakRevenue && peakRevenue > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-0.5">
                      <FiAward className="text-[9px]" /> Peak
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Daily Revenue</p>
                    <p className="font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(rev)}
                    </p>
                    {revPct > 0 && (
                      <p className="text-[9px] text-slate-400 font-medium">{revPct}% of period</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Orders Placed</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                      {ord} {ord === 1 ? 'order' : 'orders'}
                    </p>
                    {aov > 0 && (
                      <p className="text-[9px] text-slate-400 font-medium">
                        AOV: {formatCompact(aov, true)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </TooltipWithBounds>
      )}
    </div>
  );
}

// Master Export Component for Daily Velocity & Trend Line Chart
export default function DailyTrendChart({
  dailyTrend = [],
  totalRevenue = 0,
  totalOrders = 0,
  isDark = false,
  loading = false,
}) {
  const [metric, setMetric] = useState('revenue'); // 'revenue' | 'orders'

  // Sort chronologically and validate
  const trendData = useMemo(() => {
    if (!Array.isArray(dailyTrend)) return [];
    return [...dailyTrend].sort((a, b) => {
      const da = parseDate(a.date || a._id).getTime();
      const db = parseDate(b.date || b._id).getTime();
      return da - db;
    });
  }, [dailyTrend]);

  const maxRevenue = useMemo(() => {
    if (!trendData.length) return 0;
    return Math.max(...trendData.map((t) => Number(t.totalAmount) || 0));
  }, [trendData]);

  const peakDayObj = useMemo(() => {
    if (!trendData.length || maxRevenue === 0) return null;
    return trendData.find((t) => Number(t.totalAmount) === maxRevenue) || null;
  }, [trendData, maxRevenue]);

  const calculatedTotalRevenue = useMemo(() => {
    if (totalRevenue > 0) return totalRevenue;
    return trendData.reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
  }, [totalRevenue, trendData]);

  const calculatedTotalOrders = useMemo(() => {
    if (totalOrders > 0) return totalOrders;
    return trendData.reduce((sum, d) => sum + (Number(d.orderCount) || 0), 0);
  }, [totalOrders, trendData]);

  const dailyAverageRevenue = useMemo(() => {
    if (!trendData.length) return 0;
    return Math.round(calculatedTotalRevenue / trendData.length);
  }, [trendData.length, calculatedTotalRevenue]);

  const hasData = trendData.length > 0 && (calculatedTotalRevenue > 0 || calculatedTotalOrders > 0);

  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-lg flex flex-col justify-between">
      <div>
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FiTrendingUp className="text-lg" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Daily Velocity & Trend</span>
                <span className="text-xs font-bold px-2.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-600 dark:text-slate-300">
                  {trendData.length} Days
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Day-by-day order generation and intake amounts
              </p>
            </div>
          </div>

          {/* Metric Toggle Tabs */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-white/5">
            <button
              type="button"
              onClick={() => setMetric('revenue')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                metric === 'revenue'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FiDollarSign className="text-xs" />
              <span>Revenue</span>
            </button>
            <button
              type="button"
              onClick={() => setMetric('orders')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                metric === 'orders'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FiLayers className="text-xs" />
              <span>Orders</span>
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
            <FiTrendingUp className="text-2xl text-slate-300 dark:text-slate-600" />
            <span>No daily trends recorded yet for this range.</span>
          </div>
        ) : (
          <div className="w-full">
            {/* Visx Line/Area Chart Container */}
            <div className="w-full h-[240px] min-h-[240px] my-1">
              <ParentSize>
                {({ width, height }) => (
                  <InnerTrendLineChart
                    width={width}
                    height={height}
                    data={trendData}
                    metric={metric}
                    totalRevenue={calculatedTotalRevenue}
                    totalOrders={calculatedTotalOrders}
                    peakRevenue={maxRevenue}
                    isDark={isDark}
                  />
                )}
              </ParentSize>
            </div>

            {/* Quick Stat Highlight Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-200/60 dark:border-white/5">
              <div className="p-2.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5">
                <span className="text-[10px] text-slate-400 font-medium block">Total Intake</span>
                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(calculatedTotalRevenue)}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5">
                <span className="text-[10px] text-slate-400 font-medium block">Daily Average</span>
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                  {formatCurrency(dailyAverageRevenue)}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5">
                <span className="text-[10px] text-slate-400 font-medium block">Total Orders</span>
                <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                  {calculatedTotalOrders} POs
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5">
                <span className="text-[10px] text-slate-400 font-medium block">Peak Intake</span>
                <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                  {formatCompact(maxRevenue, true)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Continuous Velocity Tracking</span>
        <span className="font-bold text-slate-700 dark:text-slate-300">
          Peak Day:{' '}
          {peakDayObj
            ? `${formatDateTick(getDate(peakDayObj))} (${formatCurrency(maxRevenue)})`
            : formatCurrency(maxRevenue)}
        </span>
      </div>
    </div>
  );
}
