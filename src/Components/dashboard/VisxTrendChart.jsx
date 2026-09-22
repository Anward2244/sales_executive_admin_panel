import React, { useMemo, useCallback } from 'react';
import { Group } from '@visx/group';
import { AreaClosed, LinePath, Bar } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { LinearGradient } from '@visx/gradient';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft, AxisRight } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { ParentSize } from '@visx/responsive';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';

// Date parser helper
const parseDate = (d) => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  const parts = String(d).split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  return new Date(d);
};

const formatDateLabel = (date) => {
  try {
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return String(date);
  }
};

const formatFullDate = (date) => {
  try {
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(date);
  }
};

const formatRevenueAxis = (val) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
  return `₹${Math.round(val)}`;
};

const InnerTrendChart = ({
  width,
  height,
  data = [],
  visibleSeries = { revenue: true, orders: true },
  isDark = false
}) => {
  const showRevenue = visibleSeries.revenue ?? true;
  const showOrders = visibleSeries.orders ?? true;

  const margin = {
    top: 20,
    right: showOrders ? 52 : 20,
    bottom: 34,
    left: showRevenue ? 58 : 24
  };

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  // Tooltip setup
  const {
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
    tooltipOpen,
    showTooltip,
    hideTooltip
  } = useTooltip();

  // Accessors
  const getDate = useCallback((d) => parseDate(d.date), []);
  const getRevenue = useCallback((d) => Number(d.revenue) || 0, []);
  const getOrders = useCallback((d) => Number(d.orders) || 0, []);

  // Compute bar width based on innerWidth & item count
  const barWidth = useMemo(() => {
    if (!data.length) return 14;
    const available = innerWidth / Math.max(data.length, 1);
    return Math.max(8, Math.min(28, available * 0.45));
  }, [data.length, innerWidth]);

  // Scales
  const dateScale = useMemo(() => {
    if (!data.length) return scaleTime({ range: [0, innerWidth] });
    const minTime = Math.min(...data.map((d) => getDate(d).getTime()));
    const maxTime = Math.max(...data.map((d) => getDate(d).getTime()));

    // When single item or identical dates
    if (minTime === maxTime) {
      return scaleTime({
        range: [innerWidth / 2, innerWidth / 2],
        domain: [new Date(minTime), new Date(maxTime)]
      });
    }

    const pad = Math.max(barWidth / 2 + 6, 16);
    return scaleTime({
      range: [pad, Math.max(pad + 10, innerWidth - pad)],
      domain: [new Date(minTime), new Date(maxTime)]
    });
  }, [data, innerWidth, barWidth, getDate]);

  const revenueScale = useMemo(() => {
    if (!data.length) return scaleLinear({ range: [innerHeight, 0] });
    const maxVal = Math.max(...data.map(getRevenue), 0);
    return scaleLinear({
      range: [innerHeight, 0],
      domain: [0, maxVal > 0 ? maxVal * 1.18 : 10000],
      nice: true
    });
  }, [data, innerHeight, getRevenue]);

  const orderScale = useMemo(() => {
    if (!data.length) return scaleLinear({ range: [innerHeight, 0] });
    const maxVal = Math.max(...data.map(getOrders), 0);
    return scaleLinear({
      range: [innerHeight, 0],
      domain: [0, maxVal > 0 ? Math.max(Math.ceil(maxVal * 1.25), 4) : 5],
      nice: true
    });
  }, [data, innerHeight, getOrders]);

  // Pointer move handler for tooltip
  const handlePointerMove = useCallback(
    (event) => {
      if (!data.length) return;
      const point = localPoint(event);
      if (!point) return;

      const x = point.x - margin.left;
      if (x < 0 || x > innerWidth) {
        hideTooltip();
        return;
      }

      const hoveredDate = dateScale.invert(x).getTime();
      let closestItem = data[0];
      let minDiff = Infinity;

      for (let i = 0; i < data.length; i++) {
        const itemTime = getDate(data[i]).getTime();
        const diff = Math.abs(itemTime - hoveredDate);
        if (diff < minDiff) {
          minDiff = diff;
          closestItem = data[i];
        }
      }

      if (closestItem) {
        const itemX = dateScale(getDate(closestItem));
        const revY = revenueScale(getRevenue(closestItem));
        const ordY = orderScale(getOrders(closestItem));
        const itemY = showRevenue ? revY : ordY;

        showTooltip({
          tooltipData: closestItem,
          tooltipLeft: itemX + margin.left,
          tooltipTop: Math.max(margin.top + 10, itemY + margin.top)
        });
      }
    },
    [data, margin.left, margin.top, innerWidth, dateScale, revenueScale, orderScale, showRevenue, getDate, getRevenue, getOrders, hideTooltip, showTooltip]
  );

  if (width < 50 || height < 50) return null;

  const isSelectedDate = (item) => {
    if (!tooltipData) return false;
    return getDate(item).getTime() === getDate(tooltipData).getTime();
  };

  return (
    <div className="relative select-none w-full">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          {/* Revenue Emerald Gradient */}
          <LinearGradient
            id="mix-revenue-gradient"
            from="#10b981"
            to="#10b981"
            fromOpacity={isDark ? 0.38 : 0.28}
            toOpacity={0.01}
          />
          {/* Orders Bar Indigo/Blue Gradient */}
          <linearGradient id="mix-order-bar-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity={isDark ? 0.85 : 0.9} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={isDark ? 0.55 : 0.65} />
          </linearGradient>
          {/* Active Orders Bar Hover Gradient */}
          <linearGradient id="mix-order-bar-hover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity={1} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0.9} />
          </linearGradient>
        </defs>

        <Group left={margin.left} top={margin.top}>
          {/* Subtle Grid Rows (aligned to Revenue or Orders scale) */}
          <GridRows
            scale={showRevenue ? revenueScale : orderScale}
            width={innerWidth}
            strokeDasharray="4 4"
            stroke={isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)'}
            pointerEvents="none"
            numTicks={5}
          />

          {/* LAYER 1: Orders (Rounded Bars) */}
          {showOrders &&
            data.map((d, i) => {
              const ordersCount = getOrders(d);
              const barHeight = Math.max(0, innerHeight - orderScale(ordersCount));
              const barX = dateScale(getDate(d)) - barWidth / 2;
              const barY = orderScale(ordersCount);
              const isHovered = isSelectedDate(d);

              return (
                <g key={`bar-${i}`}>
                  {/* Subtle bar shadow / highlight glow on hover */}
                  {isHovered && barHeight > 0 && (
                    <rect
                      x={barX - 2}
                      y={barY - 2}
                      width={barWidth + 4}
                      height={barHeight + 4}
                      rx={Math.min(6, barWidth / 2)}
                      fill="rgba(59, 130, 246, 0.25)"
                      pointerEvents="none"
                    />
                  )}
                  <rect
                    x={barX}
                    y={barY}
                    width={barWidth}
                    height={barHeight}
                    rx={Math.min(4, barWidth / 3)}
                    fill={isHovered ? 'url(#mix-order-bar-hover)' : 'url(#mix-order-bar-gradient)'}
                    stroke={isHovered ? '#60a5fa' : 'transparent'}
                    strokeWidth={isHovered ? 1.5 : 0}
                    className="transition-all duration-150"
                  />
                </g>
              );
            })}

          {/* LAYER 2: Revenue (Area Closed + Spline Line) */}
          {showRevenue && data.length > 1 && (
            <>
              <AreaClosed
                data={data}
                x={(d) => dateScale(getDate(d)) ?? 0}
                y={(d) => revenueScale(getRevenue(d)) ?? 0}
                yScale={revenueScale}
                strokeWidth={0}
                curve={curveMonotoneX}
                fill="url(#mix-revenue-gradient)"
              />
              <LinePath
                data={data}
                x={(d) => dateScale(getDate(d)) ?? 0}
                y={(d) => revenueScale(getRevenue(d)) ?? 0}
                stroke="#10b981"
                strokeWidth={2.75}
                curve={curveMonotoneX}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Revenue Marker Dots (when fewer points or highlighted) */}
          {showRevenue &&
            data.length <= 16 &&
            data.map((d, i) => {
              const cx = dateScale(getDate(d));
              const cy = revenueScale(getRevenue(d));
              const isHovered = isSelectedDate(d);
              return (
                <circle
                  key={`rev-point-${i}`}
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5.5 : 3.5}
                  fill="#10b981"
                  stroke={isDark ? '#0f172a' : '#ffffff'}
                  strokeWidth={isHovered ? 2.5 : 2}
                  className="transition-all duration-150"
                />
              );
            })}

          {/* Bottom X-Axis: Dates */}
          <AxisBottom
            top={innerHeight}
            scale={dateScale}
            numTicks={innerWidth > 520 ? 7 : 4}
            tickFormat={formatDateLabel}
            stroke="transparent"
            tickStroke="transparent"
            tickLabelProps={() => ({
              fill: isDark ? '#94a3b8' : '#64748b',
              fontSize: 11,
              fontFamily: 'inherit',
              fontWeight: 500,
              textAnchor: 'middle',
              dy: 4
            })}
          />

          {/* Left Y-Axis: Revenue (₹) */}
          {showRevenue && (
            <AxisLeft
              scale={revenueScale}
              numTicks={5}
              tickFormat={formatRevenueAxis}
              stroke="transparent"
              tickStroke="transparent"
              tickLabelProps={() => ({
                fill: isDark ? '#34d399' : '#059669',
                fontSize: 11,
                fontFamily: 'inherit',
                fontWeight: 600,
                textAnchor: 'end',
                dx: -4,
                dy: 3
              })}
            />
          )}

          {/* Right Y-Axis: Orders (Count) */}
          {showOrders && (
            <AxisRight
              left={innerWidth}
              scale={orderScale}
              numTicks={Math.min(5, Math.max(...data.map(getOrders), 5))}
              tickFormat={(val) => Math.round(val)}
              stroke="transparent"
              tickStroke="transparent"
              tickLabelProps={() => ({
                fill: isDark ? '#60a5fa' : '#2563eb',
                fontSize: 11,
                fontFamily: 'inherit',
                fontWeight: 600,
                textAnchor: 'start',
                dx: 4,
                dy: 3
              })}
            />
          )}

          {/* Interactive Crosshair when Hovered */}
          {tooltipOpen && tooltipData && (
            <g pointerEvents="none">
              {/* Vertical dotted crosshair line */}
              <line
                x1={dateScale(getDate(tooltipData))}
                x2={dateScale(getDate(tooltipData))}
                y1={0}
                y2={innerHeight}
                stroke={isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.22)'}
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />

              {/* Active Pulsing Ring on Revenue Point */}
              {showRevenue && (
                <>
                  <circle
                    cx={dateScale(getDate(tooltipData))}
                    cy={revenueScale(getRevenue(tooltipData))}
                    r={9}
                    fill="#10b981"
                    fillOpacity={0.25}
                  />
                  <circle
                    cx={dateScale(getDate(tooltipData))}
                    cy={revenueScale(getRevenue(tooltipData))}
                    r={5}
                    fill="#10b981"
                    stroke={isDark ? '#0f172a' : '#ffffff'}
                    strokeWidth={2}
                  />
                </>
              )}
            </g>
          )}

          {/* Invisible Overlay to Capture Pointer Movements */}
          <Bar
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            rx={14}
            onTouchStart={handlePointerMove}
            onTouchMove={handlePointerMove}
            onMouseMove={handlePointerMove}
            onMouseLeave={hideTooltip}
          />
        </Group>
      </svg>

      {/* Floating Rich Tooltip Box */}
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          key={`tooltip-${getDate(tooltipData).getTime()}`}
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.98)',
            color: isDark ? '#ffffff' : '#0f172a',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(226, 232, 240, 0.9)',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(16px)',
            padding: '10px 14px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 100,
            minWidth: '180px'
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {formatFullDate(getDate(tooltipData))}
              </span>
              <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                Daily
              </span>
            </div>

            <div className="space-y-1.5">
              {/* Revenue Row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Revenue</span>
                </div>
                <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                  ₹{Number(tooltipData.revenue || 0).toLocaleString('en-IN')}
                </span>
              </div>

              {/* Orders Row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-md bg-blue-500 shrink-0" />
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Orders</span>
                </div>
                <span className="text-xs font-black font-mono text-blue-600 dark:text-blue-400">
                  {tooltipData.orders || 0} {tooltipData.orders === 1 ? 'order' : 'orders'}
                </span>
              </div>

              {/* Dynamic Avg Order Value Row if orders > 0 */}
              {Number(tooltipData.orders) > 0 && Number(tooltipData.revenue) > 0 && (
                <div className="flex items-center justify-between gap-4 pt-1 border-t border-dashed border-slate-200 dark:border-white/10 text-[11px]">
                  <span className="text-slate-400">Avg Value</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                    ₹{Math.round(Number(tooltipData.revenue) / Number(tooltipData.orders)).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
};

const VisxTrendChart = ({
  data = [],
  visibleSeries = { revenue: true, orders: true },
  height = 320,
  isDark = false
}) => {
  return (
    <div style={{ width: '100%', height }}>
      <ParentSize debounceTime={10}>
        {({ width, height: pHeight }) => (
          <InnerTrendChart
            width={width}
            height={pHeight || height}
            data={data}
            visibleSeries={visibleSeries}
            isDark={isDark}
          />
        )}
      </ParentSize>
    </div>
  );
};

export default VisxTrendChart;
