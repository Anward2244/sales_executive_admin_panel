import React, { useMemo, useCallback } from 'react';
import { Group } from '@visx/group';
import { AreaClosed, LinePath, Bar } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { LinearGradient } from '@visx/gradient';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
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

const formatYAxis = (val, isRevenue) => {
  if (!isRevenue) return Math.round(val);
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
  return `₹${Math.round(val)}`;
};

const InnerTrendChart = ({
  width,
  height,
  data = [],
  metric = 'revenue',
  isDark = false
}) => {
  const margin = { top: 16, right: 20, bottom: 32, left: 52 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const isRevenue = metric === 'revenue';
  const primaryColor = isRevenue ? '#10b981' : '#3b82f6';
  const gradientId = isRevenue ? 'visx-emerald-gradient' : 'visx-blue-gradient';

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
  const getValue = useCallback((d) => (isRevenue ? d.revenue : d.orders), [isRevenue]);

  // Scales
  const dateScale = useMemo(() => {
    if (!data.length) return scaleTime({ range: [0, innerWidth] });
    return scaleTime({
      range: [0, innerWidth],
      domain: [
        Math.min(...data.map((d) => getDate(d).getTime())),
        Math.max(...data.map((d) => getDate(d).getTime()))
      ]
    });
  }, [data, innerWidth, getDate]);

  const valueScale = useMemo(() => {
    if (!data.length) return scaleLinear({ range: [innerHeight, 0] });
    const maxVal = Math.max(...data.map(getValue), 0);
    return scaleLinear({
      range: [innerHeight, 0],
      domain: [0, maxVal > 0 ? maxVal * 1.15 : 10],
      nice: true
    });
  }, [data, innerHeight, getValue]);

  // Pointer move handler
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
        const itemY = valueScale(getValue(closestItem));

        showTooltip({
          tooltipData: closestItem,
          tooltipLeft: itemX + margin.left,
          tooltipTop: itemY + margin.top
        });
      }
    },
    [data, margin.left, margin.top, innerWidth, dateScale, valueScale, getDate, getValue, hideTooltip, showTooltip]
  );

  if (width < 50 || height < 50) return null;

  return (
    <div className="relative select-none">
      <svg width={width} height={height} className="overflow-visible">
        <LinearGradient
          id={gradientId}
          from={primaryColor}
          to={primaryColor}
          fromOpacity={isDark ? 0.45 : 0.35}
          toOpacity={0.02}
        />

        <Group left={margin.left} top={margin.top}>
          {/* Subtle Grid Rows */}
          <GridRows
            scale={valueScale}
            width={innerWidth}
            strokeDasharray="4 4"
            stroke={isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)'}
            pointerEvents="none"
            numTicks={5}
          />

          {/* Area Closed */}
          {data.length > 1 && (
            <AreaClosed
              data={data}
              x={(d) => dateScale(getDate(d)) ?? 0}
              y={(d) => valueScale(getValue(d)) ?? 0}
              yScale={valueScale}
              strokeWidth={0}
              curve={curveMonotoneX}
              fill={`url(#${gradientId})`}
            />
          )}

          {/* Smooth Line Path */}
          {data.length > 1 && (
            <LinePath
              data={data}
              x={(d) => dateScale(getDate(d)) ?? 0}
              y={(d) => valueScale(getValue(d)) ?? 0}
              stroke={primaryColor}
              strokeWidth={2.5}
              curve={curveMonotoneX}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points (if few items) */}
          {data.length <= 12 &&
            data.map((d, i) => {
              const cx = dateScale(getDate(d));
              const cy = valueScale(getValue(d));
              return (
                <circle
                  key={`point-${i}`}
                  cx={cx}
                  cy={cy}
                  r={3.5}
                  fill={primaryColor}
                  stroke={isDark ? '#0f172a' : '#ffffff'}
                  strokeWidth={2}
                  className="transition-transform duration-200"
                />
              );
            })}

          {/* Bottom X-Axis */}
          <AxisBottom
            top={innerHeight}
            scale={dateScale}
            numTicks={innerWidth > 500 ? 7 : 4}
            tickFormat={formatDateLabel}
            stroke="transparent"
            tickStroke="transparent"
            tickLabelProps={() => ({
              fill: isDark ? '#94a3b8' : '#64748b',
              fontSize: 11,
              fontFamily: 'inherit',
              fontWeight: 500,
              textAnchor: 'middle'
            })}
          />

          {/* Left Y-Axis */}
          <AxisLeft
            scale={valueScale}
            numTicks={5}
            tickFormat={(val) => formatYAxis(val, isRevenue)}
            stroke="transparent"
            tickStroke="transparent"
            tickLabelProps={() => ({
              fill: isDark ? '#94a3b8' : '#64748b',
              fontSize: 11,
              fontFamily: 'inherit',
              fontWeight: 500,
              textAnchor: 'end',
              dx: -4,
              dy: 3
            })}
          />

          {/* Interactive Crosshair when Hovered */}
          {tooltipOpen && tooltipData && (
            <g pointerEvents="none">
              {/* Vertical dotted guide line */}
              <line
                x1={dateScale(getDate(tooltipData))}
                x2={dateScale(getDate(tooltipData))}
                y1={0}
                y2={innerHeight}
                stroke={isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)'}
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              {/* Active Outer Pulsing Ring */}
              <circle
                cx={dateScale(getDate(tooltipData))}
                cy={valueScale(getValue(tooltipData))}
                r={8}
                fill={primaryColor}
                fillOpacity={0.25}
              />
              {/* Active Center Solid Point */}
              <circle
                cx={dateScale(getDate(tooltipData))}
                cy={valueScale(getValue(tooltipData))}
                r={4.5}
                fill={primaryColor}
                stroke={isDark ? '#0f172a' : '#ffffff'}
                strokeWidth={2}
              />
            </g>
          )}

          {/* Invisible Overlay Capture Layer */}
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

      {/* Floating Tooltip Box */}
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          key={Math.random()}
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.96)',
            color: isDark ? '#ffffff' : '#0f172a',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(226, 232, 240, 0.9)',
            borderRadius: '14px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(12px)',
            padding: '8px 12px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 100
          }}
        >
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {formatDateLabel(getDate(tooltipData))}
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: primaryColor }}
              />
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {isRevenue ? 'Revenue' : 'Orders'}:
              </span>
              <span className="font-extrabold font-mono text-slate-900 dark:text-white">
                {isRevenue
                  ? `₹${Number(tooltipData.revenue || 0).toLocaleString('en-IN')}`
                  : `${tooltipData.orders || 0} orders`}
              </span>
            </div>
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
};

const VisxTrendChart = ({ data = [], metric = 'revenue', height = 310, isDark = false }) => {
  return (
    <div style={{ width: '100%', height }}>
      <ParentSize debounceTime={10}>
        {({ width, height: pHeight }) => (
          <InnerTrendChart
            width={width}
            height={pHeight || height}
            data={data}
            metric={metric}
            isDark={isDark}
          />
        )}
      </ParentSize>
    </div>
  );
};

export default VisxTrendChart;
