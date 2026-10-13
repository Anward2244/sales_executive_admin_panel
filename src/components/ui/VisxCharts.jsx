import React, { useState, useEffect } from 'react';
import { Group } from '@visx/group';
import { BarGroup, BarStack, Pie, AreaClosed, LinePath, Line } from '@visx/shape';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { LinearGradient } from '@visx/gradient';
import { ParentSize } from '@visx/responsive';
import { curveMonotoneX } from '@visx/curve';
import { useTooltip, useTooltipInPortal, defaultStyles as tooltipStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { animated, useTransition, useSpring, to } from '@react-spring/web';
import { DiAndroid, DiApple } from 'react-icons/di';

const AnimatedPath = animated.path;
const AnimatedG = animated.g;
const AnimatedRect = animated.rect;

const getIsDark = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
const getGridStroke = () => getIsDark() ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)";
const getAxisStroke = () => getIsDark() ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.12)";

const getTooltipStyles = () => {
  const isDark = getIsDark();
  return {
    ...tooltipStyles,
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(203, 213, 225, 0.9)',
    borderRadius: '16px',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '12px',
    fontWeight: '600',
    boxShadow: isDark 
      ? '0 20px 30px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)' 
      : '0 20px 30px -10px rgba(0, 0, 0, 0.12), inset 0 1px 0 0 rgba(255, 255, 255, 0.8)',
    padding: '10px 14px',
    pointerEvents: 'none',
    zIndex: 9999
  };
};

const tooltipCustomStyles = new Proxy({}, {
  get(target, prop) {
    return getTooltipStyles()[prop];
  }
});

// Compact number formatter (e.g. 1500 -> 1.5k, 120000 -> 1.2L)
const formatCompactNumber = (num, prefix = '') => {
  const val = Number(num) || 0;
  if (val >= 10000000) return `${prefix}${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `${prefix}${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `${prefix}${(val / 1000).toFixed(1)}k`;
  return `${prefix}${val.toLocaleString('en-IN')}`;
};

// ----------------------------------------------------
// React Spring Animated Helpers (Physics Engine)
// ----------------------------------------------------
function AnimatedPoly({ d, fill, onMouseMove, onMouseLeave, className }) {
  const spring = useSpring({
    from: { opacity: 0 },
    to: { opacity: 1 },
    config: { tension: 120, friction: 14 }
  });

  return (
    <AnimatedPath
      d={d}
      fill={fill}
      opacity={spring.opacity}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={className}
    />
  );
}

function AnimatedLine({ d, stroke, strokeWidth, className }) {
  const spring = useSpring({
    from: { opacity: 0 },
    to: { opacity: 1 },
    config: { tension: 120, friction: 14 }
  });

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={spring.opacity}
      className={className}
    />
  );
}

function AnimatedArcItem({ path, fill, onMouseMove, onMouseLeave, onClick, className, stroke, strokeWidth }) {
  const spring = useSpring({
    from: { opacity: 0, scale: 0.8 },
    to: { opacity: 1, scale: 1 },
    config: { tension: 150, friction: 12 }
  });

  return (
    <AnimatedPath
      d={path}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={spring.opacity}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className={className}
    />
  );
}

function AnimatedHorizontalBarItem({ x = 0, y, width, height, fill, rx = 6, ry = 6, onMouseMove, onMouseLeave, className }) {
  const spring = useSpring({
    from: { width: 0, x: 0 },
    to: { width, x },
    config: { tension: 130, friction: 15 }
  });

  return (
    <AnimatedRect
      x={spring.x}
      y={y}
      width={spring.width}
      height={height}
      fill={fill}
      rx={rx}
      ry={ry}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={className}
    />
  );
}

function AnimatedPie({
  arcs,
  path,
  getKey,
  getColor,
  onClickDatum,
  onMouseMoveDatum,
  onMouseLeaveDatum
}) {
  const transitions = useTransition(arcs, {
    from: ({ endAngle }) => ({
      startAngle: endAngle > Math.PI ? 2 * Math.PI : 0,
      endAngle: endAngle > Math.PI ? 2 * Math.PI : 0,
      opacity: 0,
    }),
    enter: ({ startAngle, endAngle }) => ({
      startAngle,
      endAngle,
      opacity: 1,
    }),
    update: ({ startAngle, endAngle }) => ({
      startAngle,
      endAngle,
      opacity: 1,
    }),
    leave: ({ endAngle }) => ({
      startAngle: endAngle > Math.PI ? 2 * Math.PI : 0,
      endAngle: endAngle > Math.PI ? 2 * Math.PI : 0,
      opacity: 0,
    }),
    keys: getKey,
    config: { tension: 120, friction: 14 }
  });

  return transitions((props, arc, { key }) => {
    const [centroidX, centroidY] = path.centroid(arc);
    const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.35;

    return (
      <g key={key}>
        <AnimatedPath
          d={to([props.startAngle, props.endAngle], (startAngle, endAngle) =>
            path({
              ...arc,
              startAngle,
              endAngle,
            })
          )}
          fill={getColor(arc)}
          onClick={(e) => onClickDatum(arc, e)}
          onMouseMove={(e) => onMouseMoveDatum(arc, e)}
          onMouseLeave={onMouseLeaveDatum}
          className="cursor-pointer transition-opacity duration-150 hover:opacity-90"
        />
        {hasSpaceForLabel && (
          <AnimatedG style={{ opacity: props.opacity }}>
            <text
              fill="#ffffff"
              x={centroidX}
              y={centroidY}
              dy=".33em"
              fontSize={10}
              fontWeight={800}
              textAnchor="middle"
              pointerEvents="none"
              className="drop-shadow-xs select-none font-sans"
            >
              {getKey(arc)}
            </text>
          </AnimatedG>
        )}
      </g>
    );
  });
}

function AnimatedVerticalBarItem({ x, y, width, height, yMax, fill, rx, ry, onMouseMove, onMouseLeave, className, opacity }) {
  const spring = useSpring({
    from: { y: yMax, height: 0 },
    to: { y, height },
    config: { tension: 130, friction: 15 }
  });

  return (
    <AnimatedRect
      x={x}
      y={spring.y}
      width={width}
      height={spring.height}
      fill={fill}
      opacity={opacity}
      rx={rx}
      ry={ry}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={className}
    />
  );
}

// ----------------------------------------------------
// 1. Visx App Versions Horizontal Bar Chart Component
// ----------------------------------------------------
function AppVersionsHorizontalChart({ data, width, height }) {
  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    showTooltip,
    hideTooltip
  } = useTooltip();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true
  });

  const isMobile = width < 480;
  const margin = isMobile 
    ? { top: 12, right: 30, bottom: 42, left: 55 }
    : { top: 15, right: 40, bottom: 45, left: 75 };
  const effectiveHeight = Math.max(height, isMobile ? 240 : 260);
  const xMax = Math.max(0, width - margin.left - margin.right);
  const yMax = Math.max(0, effectiveHeight - margin.top - margin.bottom);

  const formatVerLabel = (ver) => {
    const s = String(ver || '').trim();
    if (!s || /^unknown/i.test(s) || /^legacy/i.test(s)) return 'Legacy';
    return s.startsWith('v') || s.startsWith('V') ? s : `v${s}`;
  };

  const totalAndroid = data.reduce((sum, d) => sum + (d.androidCount || 0), 0);
  const totalIos = data.reduce((sum, d) => sum + (d.iosCount || 0), 0);

  const maxVal = Math.max(
    ...data.map(d => {
      const a = d.androidCount || 0;
      const i = d.iosCount || 0;
      return (a + i) > 0 ? (a + i) : (d.count || 0);
    }),
    1
  );

  const yScale = scaleBand({
    range: [0, yMax],
    domain: data.map(d => formatVerLabel(d.version)),
    padding: data.length > 6 ? 0.25 : 0.35
  });

  const xScale = scaleLinear({
    range: [0, xMax],
    domain: [0, maxVal * 1.15]
  });

  if (width < 10 || height < 10) return null;

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[240px]">
      <svg width={width} height={effectiveHeight}>
        {/* Soft Blue Gradient for Android */}
        <LinearGradient id="visx-app-android-grad" from="#3b82f6" to="#2563eb" fromOpacity={0.9} toOpacity={0.55} />
        {/* Soft Emerald Gradient for iOS */}
        <LinearGradient id="visx-app-ios-grad" from="#10b981" to="#059669" fromOpacity={0.9} toOpacity={0.55} />

        <Group left={margin.left} top={margin.top}>
          {data.map((d, idx) => {
            const verLabel = formatVerLabel(d.version);
            const androidCount = d.androidCount !== undefined 
              ? d.androidCount 
              : (d.platform?.toLowerCase() === 'ios' ? 0 : (d.count || 0));
            const iosCount = d.iosCount !== undefined 
              ? d.iosCount 
              : (d.platform?.toLowerCase() === 'ios' ? (d.count || 0) : 0);
            const totalCount = (androidCount + iosCount) > 0 ? (androidCount + iosCount) : (d.count || 0);

            const totalWidth = xScale(totalCount);
            const androidWidth = totalCount > 0 ? (androidCount / totalCount) * totalWidth : 0;
            const iosWidth = totalCount > 0 ? (iosCount / totalCount) * totalWidth : 0;

            const bandHeight = yScale.bandwidth();
            const barHeight = Math.min(22, Math.max(12, bandHeight));
            const barY = (yScale(verLabel) || 0) + (bandHeight - barHeight) / 2;

            const isHovered = tooltipOpen && tooltipData?.label === verLabel;
            const hasBoth = androidCount > 0 && iosCount > 0;

            const handleHover = (event) => {
              const coords = localPoint(event.target.ownerSVGElement, event);
              showTooltip({
                tooltipLeft: coords?.x || 0,
                tooltipTop: coords?.y || 0,
                tooltipData: {
                  label: verLabel,
                  version: d.version,
                  androidCount,
                  iosCount,
                  count: totalCount
                }
              });
            };

            return (
              <React.Fragment key={`app-ver-${verLabel}-${idx}`}>
                {/* Android Segment / Bar */}
                {androidCount > 0 && (
                  <AnimatedHorizontalBarItem
                    x={0}
                    y={barY}
                    width={androidWidth}
                    height={barHeight}
                    fill={isHovered ? '#60a5fa' : 'url(#visx-app-android-grad)'}
                    rx={hasBoth ? 4 : 6}
                    ry={hasBoth ? 4 : 6}
                    onMouseMove={handleHover}
                    onMouseLeave={hideTooltip}
                    className="transition-colors duration-150 cursor-pointer"
                  />
                )}

                {/* iOS Segment / Bar */}
                {iosCount > 0 && (
                  <AnimatedHorizontalBarItem
                    x={hasBoth ? androidWidth + 1 : 0}
                    y={barY}
                    width={hasBoth ? Math.max(0, iosWidth - 1) : iosWidth}
                    height={barHeight}
                    fill={isHovered ? '#34d399' : 'url(#visx-app-ios-grad)'}
                    rx={hasBoth ? 4 : 6}
                    ry={hasBoth ? 4 : 6}
                    onMouseMove={handleHover}
                    onMouseLeave={hideTooltip}
                    className="transition-colors duration-150 cursor-pointer"
                  />
                )}

                {/* Total Count Label */}
                <text
                  x={totalWidth + 8}
                  y={barY + barHeight / 2}
                  dy=".35em"
                  fill={isHovered ? '#ffffff' : '#94a3b8'}
                  fontSize={11}
                  fontWeight={700}
                  className="font-mono select-none"
                >
                  {totalCount}
                </text>
              </React.Fragment>
            );
          })}

          <AxisLeft
            scale={yScale}
            stroke="transparent"
            tickStroke="transparent"
            tickLabelProps={{
              fill: '#94a3b8',
              fontSize: isMobile ? 9 : 11,
              fontWeight: 700,
              textAnchor: 'end',
              dx: -3,
              dy: 3
            }}
          />
        </Group>
      </svg>

      {/* Bottom Platform Colors Legend */}
      <div className="absolute bottom-1 left-0 right-0 flex justify-center items-center gap-2 sm:gap-6 text-[10px] sm:text-xs font-bold px-2">
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-xl backdrop-blur-md border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-xs shadow-blue-500/50"></span>
          <span>Android</span>
          {totalAndroid > 0 && <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">({totalAndroid})</span>}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-xl backdrop-blur-md border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50"></span>
          <span>iOS</span>
          {totalIos > 0 && <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">({totalIos})</span>}
        </div>
      </div>

      {tooltipOpen && tooltipData && (
        <TooltipInPortal top={tooltipTop} left={tooltipLeft} style={tooltipCustomStyles}>
          <div className="min-w-[150px] space-y-2 p-0.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5 gap-3">
              <span className="font-extrabold text-white text-xs">{tooltipData.label}</span>
              <span className="font-mono text-[11px] text-slate-300 font-bold bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                {tooltipData.count} devices
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-3 text-blue-400">
                <span className="flex items-center gap-1.5 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Android:
                </span>
                <span className="font-mono font-bold text-white text-[11px]">
                  {tooltipData.androidCount}
                  <span className="text-[9px] text-blue-400/80 ml-1 font-semibold">
                    ({tooltipData.count > 0 ? Math.round((tooltipData.androidCount / tooltipData.count) * 100) : 0}%)
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 text-emerald-400">
                <span className="flex items-center gap-1.5 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  iOS:
                </span>
                <span className="font-mono font-bold text-white text-[11px]">
                  {tooltipData.iosCount}
                  <span className="text-[9px] text-emerald-400/80 ml-1 font-semibold">
                    ({tooltipData.count > 0 ? Math.round((tooltipData.iosCount / tooltipData.count) * 100) : 0}%)
                  </span>
                </span>
              </div>
            </div>
          </div>
        </TooltipInPortal>
      )}
    </div>
  );
}

export function VisxAppVersionsChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center text-slate-500 text-xs py-10 italic">
        No app versions data recorded.
      </div>
    );
  }

  return (
    <ParentSize className="w-full h-full min-h-[240px]">
      {({ width, height }) => (
        <AppVersionsHorizontalChart data={data} width={width} height={height} />
      )}
    </ParentSize>
  );
}

// ----------------------------------------------------
// 2. Visx Notifications Donut Chart Component (Animated)
// ----------------------------------------------------
function NotificationsDonutChart({ enabled, disabled, width, height, onClick }) {
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [animationCompleted, setAnimationCompleted] = useState(false);

  useEffect(() => {
    setAnimationCompleted(false);
    const timer = setTimeout(() => {
      setAnimationCompleted(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [enabled, disabled]);

  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    showTooltip,
    hideTooltip
  } = useTooltip();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true
  });

  const data = [
    { label: 'Enabled', value: enabled, color: '#10b981' },
    { label: 'Disabled', value: disabled, color: '#f43f5e' }
  ];

  const total = enabled + disabled;
  const isMobile = width < 480;
  const effectiveHeight = Math.max(height, isMobile ? 240 : 270);
  const margin = isMobile ? 12 : 20;
  const availableHeight = effectiveHeight - 38;
  const radius = Math.max(50, Math.min(width, availableHeight) / 2 - margin);
  const innerRadius = radius * (isMobile ? 0.60 : 0.65);
  const centerX = width / 2;
  const centerY = availableHeight / 2 + 5;

  if (width < 10 || height < 10) return null;

  const filteredData = selectedSegment
    ? data.filter(d => d.label === selectedSegment)
    : data;

  const selectedItem = data.find(d => d.label === selectedSegment);

  const handleClick = (type) => {
    if (!animationCompleted) return;
    if (onClick) {
      onClick(type);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[240px]">
      <svg width={width} height={effectiveHeight}>
        <LinearGradient id="grad-enabled" from="#10b981" to="#059669" fromOpacity={0.9} toOpacity={0.55} />
        <LinearGradient id="grad-disabled" from="#f43f5e" to="#e11d48" fromOpacity={0.9} toOpacity={0.55} />
        <Group top={centerY} left={centerX}>
          <Pie
            data={filteredData}
            pieValue={(d) => d.value}
            outerRadius={radius}
            innerRadius={innerRadius}
            padAngle={selectedSegment ? 0 : 0.04}
            cornerRadius={selectedSegment ? 0 : 6}
          >
            {(pie) => (
              <AnimatedPie
                {...pie}
                getKey={(arc) => arc.data.label}
                getColor={(arc) => (arc.data.label === 'Enabled' ? 'url(#grad-enabled)' : 'url(#grad-disabled)')}
                onClickDatum={(arc) => setSelectedSegment(selectedSegment === arc.data.label ? null : arc.data.label)}
                onMouseMoveDatum={(arc, event) => {
                  const coords = localPoint(event.target.ownerSVGElement, event);
                  showTooltip({
                    tooltipLeft: coords?.x || 0,
                    tooltipTop: coords?.y || 0,
                    tooltipData: arc.data
                  });
                }}
                onMouseLeaveDatum={hideTooltip}
              />
            )}
          </Pie>
          
          {/* Clickable center background area after animation completes */}
          {animationCompleted && (
            <circle
              r={innerRadius * 0.95}
              fill="rgba(59, 130, 246, 0.02)"
              className="cursor-pointer hover:fill-blue-500/5 transition-all duration-300"
              onClick={() => handleClick(selectedItem ? selectedItem.label : 'All')}
            />
          )}

          {/* Donut Center Label */}
          <text
            textAnchor="middle"
            dy={animationCompleted ? "-0.7em" : "-0.3em"}
            fill="currentColor"
            fontSize={selectedItem ? 18 : 22}
            fontWeight={900}
            className="font-mono cursor-pointer select-none text-slate-900 dark:text-white"
            onClick={() => {
              if (animationCompleted) {
                handleClick(selectedItem ? selectedItem.label : 'All');
              } else {
                setSelectedSegment(null);
              }
            }}
          >
            {selectedItem ? selectedItem.value : formatCompactNumber(total)}
          </text>
          <text
            textAnchor="middle"
            dy={animationCompleted ? "0.6em" : "1.4em"}
            fill="currentColor"
            fontSize={10}
            fontWeight={700}
            className="uppercase tracking-wider cursor-pointer select-none text-slate-500 dark:text-slate-400"
            onClick={() => {
              if (animationCompleted) {
                handleClick(selectedItem ? selectedItem.label : 'All');
              } else {
                setSelectedSegment(null);
              }
            }}
          >
            {selectedItem ? selectedItem.label : 'Total Users'}
          </text>

          {animationCompleted && (
            <text
              textAnchor="middle"
              dy="2.1em"
              fill="currentColor"
              fontSize={8}
              fontWeight={800}
              className="uppercase tracking-wider cursor-pointer select-none animate-pulse text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              onClick={() => handleClick(selectedItem ? selectedItem.label : 'All')}
            >
              Click for Details
            </text>
          )}
        </Group>
      </svg>

      {/* Custom Bottom Glassmorphic Legend */}
      <div className="absolute bottom-0.5 left-0 right-0 flex flex-wrap justify-center gap-2 sm:gap-6 text-[10px] sm:text-xs font-bold px-2">
        <div
          onClick={() => setSelectedSegment(selectedSegment === 'Enabled' ? null : 'Enabled')}
          className={`flex items-center gap-1.5 sm:gap-2 cursor-pointer px-2.5 py-1 rounded-xl backdrop-blur-md border shadow-sm transition-all duration-200 ${
            selectedSegment === 'Enabled'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-300 ring-1 ring-emerald-500 font-bold'
              : 'bg-white/80 hover:bg-white border-slate-200/80 text-slate-700 hover:text-slate-900 dark:bg-slate-900/50 dark:hover:bg-slate-800/60 dark:border-white/10 dark:text-slate-300'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50"></span>
          <span>Enabled ({total > 0 ? Math.round((enabled / total) * 100) : 0}%)</span>
        </div>
        <div
          onClick={() => setSelectedSegment(selectedSegment === 'Disabled' ? null : 'Disabled')}
          className={`flex items-center gap-1.5 sm:gap-2 cursor-pointer px-2.5 py-1 rounded-xl backdrop-blur-md border shadow-sm transition-all duration-200 ${
            selectedSegment === 'Disabled'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:bg-rose-500/20 dark:border-rose-500/40 dark:text-rose-300 ring-1 ring-rose-500 font-bold'
              : 'bg-white/80 hover:bg-white border-slate-200/80 text-slate-700 hover:text-slate-900 dark:bg-slate-900/50 dark:hover:bg-slate-800/60 dark:border-white/10 dark:text-slate-300'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs shadow-rose-500/50"></span>
          <span>Disabled ({total > 0 ? Math.round((disabled / total) * 100) : 0}%)</span>
        </div>
      </div>

      {tooltipOpen && tooltipData && (
        <TooltipInPortal top={tooltipTop} left={tooltipLeft} style={tooltipCustomStyles}>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: tooltipData.color }}
            ></span>
            <span>
              {tooltipData.label}: <strong className="text-white font-mono">{tooltipData.value} users</strong>
            </span>
          </div>
        </TooltipInPortal>
      )}
    </div>
  );
}

export function VisxNotificationsDonutChart({ enabled = 0, disabled = 0, onClick }) {
  if (enabled === 0 && disabled === 0) {
    return (
      <div className="text-center text-slate-500 text-xs py-10 italic">
        No device permissions recorded.
      </div>
    );
  }

  return (
    <ParentSize className="w-full h-full min-h-[240px]">
      {({ width, height }) => (
        <NotificationsDonutChart enabled={enabled} disabled={disabled} width={width} height={height} onClick={onClick} />
      )}
    </ParentSize>
  );
}

// ----------------------------------------------------
// 3. Visx Price Tier Grouped Vertical Bar Chart Component (Animated)
// ----------------------------------------------------
function PriceTierGroupedChart({ categories, views, cartAdds, width, height }) {
  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    showTooltip,
    hideTooltip
  } = useTooltip();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true
  });

  const keys = ['views', 'cartAdds'];
  const groupData = categories.map((cat, i) => ({
    category: cat,
    views: views[i] || 0,
    cartAdds: cartAdds[i] || 0
  }));

  const isMobile = width < 480;
  const margin = isMobile 
    ? { top: 32, right: 12, bottom: 35, left: 38 }
    : { top: 30, right: 20, bottom: 45, left: 45 };
  const effectiveHeight = Math.max(height, isMobile ? 240 : 270);
  const xMax = Math.max(0, width - margin.left - margin.right);
  const yMax = Math.max(0, effectiveHeight - margin.top - margin.bottom);

  const x0Scale = scaleBand({
    domain: categories,
    range: [0, xMax],
    padding: 0.3
  });

  const x1Scale = scaleBand({
    domain: keys,
    range: [0, x0Scale.bandwidth()],
    padding: 0.15
  });

  const maxValue = Math.max(...views, ...cartAdds, 5);

  const yScale = scaleLinear({
    domain: [0, maxValue * 1.15],
    range: [yMax, 0]
  });

  const colorScale = scaleOrdinal({
    domain: keys,
    range: ['#3b82f6', '#10b981']
  });

  if (width < 10 || height < 10) return null;

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[240px]">
      {/* Legend in Header / Overlay */}
      <div className="absolute top-1 left-0 right-0 flex flex-wrap justify-center sm:justify-end gap-x-4 gap-y-1 px-3 text-[10px] sm:text-xs font-bold pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 shrink-0"></span>
          <span className="text-slate-400">Total Views</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 shrink-0"></span>
          <span className="text-slate-400">Cart Additions</span>
        </div>
      </div>

      <svg width={width} height={effectiveHeight}>
        <LinearGradient id="visx-blue-grad" from="#3b82f6" to="#2563eb" fromOpacity={0.9} toOpacity={0.55} />
        <LinearGradient id="visx-emerald-grad" from="#10b981" to="#059669" fromOpacity={0.9} toOpacity={0.55} />

        <Group left={margin.left} top={margin.top}>
          <GridRows scale={yScale} width={xMax} stroke={getGridStroke()} strokeDasharray="3 3" pointerEvents="none" />
          <BarGroup
            data={groupData}
            keys={keys}
            height={yMax}
            x0={(d) => d.category}
            x0Scale={x0Scale}
            x1Scale={x1Scale}
            yScale={yScale}
            color={colorScale}
          >
            {(barGroups) =>
              barGroups.map((barGroup) => (
                <Group key={`bar-group-${barGroup.index}-${barGroup.x0}`} left={barGroup.x0}>
                  {barGroup.bars.map((bar) => {
                    const fill = bar.key === 'views' ? 'url(#visx-blue-grad)' : 'url(#visx-emerald-grad)';
                    const categoryName = categories[barGroup.index] || barGroup.x0;
                    const isHovered = tooltipOpen && tooltipData?.category === categoryName && tooltipData?.key === bar.key;
                    return (
                      <AnimatedVerticalBarItem
                        key={`bar-group-bar-${barGroup.index}-${bar.index}-${bar.key}`}
                        x={bar.x}
                        y={bar.y}
                        width={bar.width}
                        height={bar.height}
                        yMax={yMax}
                        fill={isHovered ? (bar.key === 'views' ? '#60a5fa' : '#34d399') : fill}
                        rx={4}
                        ry={4}
                        onMouseMove={(event) => {
                          const coords = localPoint(event.target.ownerSVGElement, event);
                          showTooltip({
                            tooltipLeft: coords?.x || 0,
                            tooltipTop: coords?.y || 0,
                            tooltipData: {
                              category: categoryName,
                              key: bar.key,
                              label: bar.key === 'views' ? 'Total Views' : 'Cart Additions',
                              value: bar.value,
                              color: bar.key === 'views' ? '#3b82f6' : '#10b981'
                            }
                          });
                        }}
                        onMouseLeave={hideTooltip}
                        className="transition-colors duration-150 cursor-pointer"
                      />
                    );
                  })}
                </Group>
              ))
            }
          </BarGroup>

          <AxisBottom
            top={yMax}
            scale={x0Scale}
            stroke={getAxisStroke()}
            tickStroke="transparent"
            tickFormat={(val) => {
              if (isMobile) {
                if (val.includes('Budget')) return '<₹1k';
                if (val.includes('Mid')) return '₹1k-10k';
                if (val.includes('Premium')) return '₹10k-20k';
                if (val.includes('Luxury')) return '>₹20k';
                return val;
              }
              if (val.includes('Budget')) return 'Budget (<₹1k)';
              if (val.includes('Mid')) return 'Mid (₹1k-10k)';
              if (val.includes('Premium')) return 'Premium (₹10k-20k)';
              return val;
            }}
            tickLabelProps={{
              fill: '#94a3b8',
              fontSize: isMobile ? 8.5 : 9,
              fontWeight: 700,
              textAnchor: 'middle',
              dy: 4
            }}
          />

          <AxisLeft
            scale={yScale}
            stroke="transparent"
            tickStroke="transparent"
            tickFormat={(v) => formatCompactNumber(v)}
            tickLabelProps={{
              fill: '#94a3b8',
              fontSize: isMobile ? 9 : 10,
              fontWeight: 600,
              textAnchor: 'end',
              dx: -3,
              dy: 3
            }}
          />
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <TooltipInPortal top={tooltipTop} left={tooltipLeft} style={tooltipCustomStyles}>
          <div className="space-y-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{tooltipData.category}</div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tooltipData.color }}></span>
              <span>{tooltipData.label}: <strong className="text-white font-mono">{tooltipData.value.toLocaleString('en-IN')} actions</strong></span>
            </div>
          </div>
        </TooltipInPortal>
      )}
    </div>
  );
}

export function VisxPriceTierGroupedBarChart({ categories = [], views = [], cartAdds = [] }) {
  const isAllZero = views.every(v => v === 0) && cartAdds.every(c => c === 0);
  if (isAllZero || categories.length === 0) {
    return (
      <div className="text-center text-slate-500 text-xs py-16 italic">
        No product engagement data recorded for price tiers.
      </div>
    );
  }

  return (
    <ParentSize className="w-full h-full min-h-[240px]">
      {({ width, height }) => (
        <PriceTierGroupedChart
          categories={categories}
          views={views}
          cartAdds={cartAdds}
          width={width}
          height={height}
        />
      )}
    </ParentSize>
  );
}

// ----------------------------------------------------
// 4. Visx Area Trend Chart Component (Animated Spring Reveal)
// ----------------------------------------------------
function InnerAreaChart({ labels, data, breakdowns = [], color, valuePrefix, valueSuffix, width, height }) {
  const { tooltipOpen, tooltipLeft, tooltipTop, tooltipData, showTooltip, hideTooltip } = useTooltip();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true
  });

  const springProps = useSpring({
    from: { opacity: 0, transform: 'translateY(12px)' },
    to: { opacity: 1, transform: 'translateY(0px)' },
    config: { tension: 120, friction: 14 }
  });

  const isMobile = width < 480;
  const margin = isMobile 
    ? { top: 12, right: 12, bottom: 28, left: 40 }
    : { top: 18, right: 20, bottom: 32, left: 50 };
  const effectiveHeight = Math.max(height || 0, isMobile ? 120 : 140);
  const xMax = Math.max(0, width - margin.left - margin.right);
  const yMax = Math.max(0, effectiveHeight - margin.top - margin.bottom);

  const chartData = labels.map((label, idx) => ({
    label,
    value: Number(data[idx]) || 0,
    breakdown: breakdowns[idx] || null,
    idx
  }));

  const xScale = scaleBand({
    domain: labels,
    range: [0, xMax],
    padding: 0.1
  });

  const maxValue = Math.max(...data.map(v => Number(v) || 0), 5);

  const yScale = scaleLinear({
    domain: [0, maxValue * 1.15],
    range: [yMax, 0]
  });

  const tickValues = React.useMemo(() => {
    const maxTicks = isMobile ? 5 : (labels.length > 15 ? 7 : labels.length);
    if (labels.length > maxTicks) {
      const step = Math.ceil(labels.length / (maxTicks - 1));
      return labels.filter((_, i) => i % step === 0 || i === labels.length - 1);
    }
    return undefined;
  }, [labels, isMobile]);

  if (width < 10 || height < 10) return null;

  const getX = (d) => (xScale(d.label) || 0) + xScale.bandwidth() / 2;
  const getY = (d) => yScale(d.value) || 0;

  const handleTooltip = (event) => {
    const coords = localPoint(event.target.ownerSVGElement || event.target, event);
    if (!coords) return;
    const mouseX = coords.x - margin.left;

    let closest = chartData[0];
    let minDiff = Infinity;
    chartData.forEach((d) => {
      const px = getX(d);
      const diff = Math.abs(px - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = d;
      }
    });

    if (closest) {
      const breakdownItemsCount = closest.breakdown ? Object.keys(closest.breakdown).length : 0;
      const estimatedHeight = 60 + breakdownItemsCount * 18;
      
      const isLowerHalf = coords.y > yMax / 2;
      const tooltipTopCalculated = isLowerHalf ? coords.y - estimatedHeight : coords.y + 15;

      showTooltip({
        tooltipLeft: coords.x + 10,
        tooltipTop: tooltipTopCalculated,
        tooltipData: closest
      });
    }
  };

  const gradId = `visx-area-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[120px]">
      <svg width={width} height={effectiveHeight}>
        <LinearGradient id={gradId} from={color} to={color} fromOpacity={0.45} toOpacity={0.02} />
        <Group left={margin.left} top={margin.top}>
          <GridRows scale={yScale} width={xMax} stroke={getGridStroke()} strokeDasharray="3 3" pointerEvents="none" />
          <AnimatedG style={springProps}>
            <AreaClosed
              data={chartData}
              x={getX}
              y={getY}
              yScale={yScale}
              curve={curveMonotoneX}
              fill={`url(#${gradId})`}
            />
            <LinePath
              data={chartData}
              x={getX}
              y={getY}
              curve={curveMonotoneX}
              stroke={color}
              strokeWidth={2.5}
            />
          </AnimatedG>

          {/* Transparent Overlay for Full Canvas Mouse Hover Tracking */}
          <rect
            x={0}
            y={0}
            width={xMax}
            height={yMax}
            fill="transparent"
            onMouseMove={handleTooltip}
            onMouseLeave={hideTooltip}
            className="cursor-crosshair"
          />

          {/* Active Vertical Crosshair Line (Airbnb Visx Style) */}
          {tooltipOpen && tooltipData && (
            <g pointerEvents="none">
              {/* Vertical Dashed Line */}
              <Line
                from={{ x: getX(tooltipData), y: 0 }}
                to={{ x: getX(tooltipData), y: yMax }}
                stroke="#5eead4"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />

              {/* Glowing Highlighted Dot */}
              <circle
                cx={getX(tooltipData)}
                cy={getY(tooltipData)}
                r={6}
                fill="#ffffff"
                stroke={color}
                strokeWidth={3}
              />

              {/* Floating Inline Glassmorphic Value Badge (Airbnb Visx Style) */}
              <g transform={`translate(${Math.min(getX(tooltipData) + 12, xMax - 70)}, ${Math.max(getY(tooltipData) - 14, 10)})`}>
                <rect width={65} height={22} rx={6} fill="rgba(15, 23, 42, 0.75)" stroke="rgba(94, 234, 212, 0.5)" strokeWidth={1} />
                <text x={32.5} y={15} textAnchor="middle" fill="#ffffff" fontSize={11} fontWeight={800} className="font-mono">
                  {valuePrefix}{tooltipData.value.toLocaleString('en-IN')}{valueSuffix}
                </text>
              </g>

            </g>
          )}

          <AxisBottom
            top={yMax}
            scale={xScale}
            tickValues={tickValues}
            stroke={getAxisStroke()}
            tickStroke="transparent"
            tickFormat={(val) => {
              if (!val) return '';
              if (isMobile && String(val).length > 5) return String(val).slice(0, 4);
              return val;
            }}
            tickLabelProps={{
              fill: '#94a3b8',
              fontSize: isMobile ? 9 : 10,
              fontWeight: 600,
              textAnchor: 'middle',
              dy: 4
            }}
          />
          <AxisLeft
            scale={yScale}
            stroke="transparent"
            tickStroke="transparent"
            tickFormat={(v) => formatCompactNumber(v, valuePrefix)}
            tickLabelProps={{
              fill: '#94a3b8',
              fontSize: isMobile ? 9 : 10,
              fontWeight: 600,
              textAnchor: 'end',
              dx: -3,
              dy: 3
            }}
          />
        </Group>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipInPortal top={tooltipTop} left={tooltipLeft} style={tooltipCustomStyles}>
          <div className="space-y-1.5">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{tooltipData.label}</div>
            <div className="flex items-center gap-2 border-b border-white/10 pb-1 mb-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
              <span>
                Total: <strong className="text-white font-mono">{valuePrefix}{tooltipData.value.toLocaleString('en-IN')}{valueSuffix}</strong>
              </span>
            </div>

            {/* Action Breakdown Details */}
            {tooltipData.breakdown && Object.keys(tooltipData.breakdown).length > 0 ? (
              <div className="space-y-1 text-[10px] text-slate-300 font-medium">
                {Object.entries(tooltipData.breakdown)
                  .sort((a, b) => b[1] - a[1]) // Sort by count descending
                  .map(([actionType, count]) => (
                    <div key={actionType} className="flex justify-between items-center gap-4">
                      <span className="text-slate-400">{actionType}</span>
                      <span className="text-white font-bold font-mono">{count}</span>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>
        </TooltipInPortal>
      )}
    </div>
  );
}

export function VisxAreaChart({ labels = [], data = [], breakdowns = [], color = '#3b82f6', valuePrefix = '', valueSuffix = '' }) {
  if (!data || data.length === 0 || data.every(v => v === 0)) {
    return (
      <div className="text-center text-slate-500 text-xs py-12 italic">
        No trend data recorded.
      </div>
    );
  }

  return (
    <ParentSize className="w-full h-full min-h-[120px]">
      {({ width, height }) => (
        <InnerAreaChart
          labels={labels}
          data={data}
          breakdowns={breakdowns}
          color={color}
          valuePrefix={valuePrefix}
          valueSuffix={valueSuffix}
          width={width}
          height={height}
        />
      )}
    </ParentSize>
  );
}

// ----------------------------------------------------
// 5. Visx Stacked Bar Chart Component (Animated Spring Heights)
// ----------------------------------------------------
function InnerStackedBarChart({ labels, series, width, height }) {
  const { tooltipOpen, tooltipLeft, tooltipTop, tooltipData, showTooltip, hideTooltip } = useTooltip();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true
  });

  const keys = series.map(s => s.name);
  const colorMap = {
    'Delivered': '#10b981',
    'Processing': '#3b82f6',
    'Cancelled': '#f43f5e',
    'Pending': '#f59e0b'
  };

  const stackData = labels.map((label, i) => {
    const row = { label };
    series.forEach(s => {
      row[s.name] = Number(s.data[i]) || 0;
    });
    return row;
  });

  const isMobile = width < 480;
  const margin = isMobile 
    ? { top: 32, right: 12, bottom: 35, left: 38 }
    : { top: 35, right: 20, bottom: 40, left: 45 };
  const effectiveHeight = Math.max(height, isMobile ? 240 : 270);
  const xMax = Math.max(0, width - margin.left - margin.right);
  const yMax = Math.max(0, effectiveHeight - margin.top - margin.bottom);

  const xScale = scaleBand({
    domain: labels,
    range: [0, xMax],
    padding: 0.35
  });

  const maxTotal = Math.max(
    ...stackData.map(row => keys.reduce((sum, key) => sum + (row[key] || 0), 0)),
    5
  );

  const yScale = scaleLinear({
    domain: [0, maxTotal * 1.15],
    range: [yMax, 0]
  });

  const colorScale = scaleOrdinal({
    domain: keys,
    range: keys.map(k => colorMap[k] || '#8b5cf6')
  });

  if (width < 10 || height < 10) return null;

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[240px]">
      {/* Top Legend */}
      <div className="absolute top-1 left-0 right-0 flex flex-wrap justify-center sm:justify-end gap-x-3 gap-y-1 px-3 text-[10px] font-bold pointer-events-none">
        {keys.map((key) => (
          <div key={`stack-legend-${key}`} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: colorMap[key] || '#8b5cf6' }}></span>
            <span className="text-slate-400">{key}</span>
          </div>
        ))}
      </div>

      <svg width={width} height={effectiveHeight}>

        <Group left={margin.left} top={margin.top}>
          <GridRows scale={yScale} width={xMax} stroke={getGridStroke()} strokeDasharray="3 3" pointerEvents="none" />
          <BarStack
            data={stackData}
            keys={keys}
            x={(d) => d.label}
            xScale={xScale}
            yScale={yScale}
            color={colorScale}
          >
            {(barStacks) =>
              barStacks.map((barStack) =>
                barStack.bars.map((bar) => {
                  const isHovered = tooltipOpen && tooltipData?.label === bar.bar.data.label && tooltipData?.seriesName === barStack.key;
                  return (
                    <AnimatedVerticalBarItem
                      key={`bar-stack-${barStack.key}-${bar.index}`}
                      x={bar.x}
                      y={bar.y}
                      width={bar.width}
                      height={bar.height}
                      yMax={yMax}
                      fill={bar.color}
                      opacity={isHovered ? 0.75 : 1}
                      rx={2}
                      ry={2}
                      onMouseMove={(event) => {
                        const coords = localPoint(event.target.ownerSVGElement, event);
                        showTooltip({
                          tooltipLeft: coords?.x || 0,
                          tooltipTop: coords?.y || 0,
                          tooltipData: {
                            label: bar.bar.data.label,
                            seriesName: barStack.key,
                            value: bar.bar.data[barStack.key],
                            color: bar.color
                          }
                        });
                      }}
                      onMouseLeave={hideTooltip}
                      className="transition-colors duration-150 cursor-pointer"
                    />
                  );
                })
              )
            }
          </BarStack>

          <AxisBottom
            top={yMax}
            scale={xScale}
            stroke={getAxisStroke()}
            tickStroke="transparent"
            tickFormat={(val) => {
              if (!val) return '';
              if (isMobile && String(val).length > 5) return String(val).slice(0, 4);
              return val;
            }}
            tickLabelProps={{
              fill: '#94a3b8',
              fontSize: isMobile ? 9 : 10,
              fontWeight: 600,
              textAnchor: 'middle',
              dy: 4
            }}
          />

          <AxisLeft
            scale={yScale}
            stroke="transparent"
            tickStroke="transparent"
            tickFormat={(v) => formatCompactNumber(v)}
            tickLabelProps={{
              fill: '#94a3b8',
              fontSize: isMobile ? 9 : 10,
              fontWeight: 600,
              textAnchor: 'end',
              dx: -3,
              dy: 3
            }}
          />
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <TooltipInPortal top={tooltipTop} left={tooltipLeft} style={tooltipCustomStyles}>
          <div className="space-y-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{tooltipData.label}</div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tooltipData.color }}></span>
              <span>{tooltipData.seriesName}: <strong className="text-white font-mono">{tooltipData.value} orders</strong></span>
            </div>
          </div>
        </TooltipInPortal>
      )}
    </div>
  );
}

export function VisxStackedBarChart({ labels = [], series = [] }) {
  if (!series || series.length === 0 || labels.length === 0) {
    return (
      <div className="text-center text-slate-500 text-xs py-12 italic">
        No orders metrics recorded.
      </div>
    );
  }

  return (
    <ParentSize className="w-full h-full min-h-[240px]">
      {({ width, height }) => (
        <InnerStackedBarChart labels={labels} series={series} width={width} height={height} />
      )}
    </ParentSize>
  );
}

// ----------------------------------------------------
// 6. Visx Donut Chart Component (Animated Airbnb Spring Selection Pattern)
// ----------------------------------------------------
function InnerDonutChart({ data, centerLabel, width, height }) {
  const [selectedSegment, setSelectedSegment] = useState(null);

  const { tooltipOpen, tooltipLeft, tooltipTop, tooltipData, showTooltip, hideTooltip } = useTooltip();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true
  });

  const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
  const palette = ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e'];

  const isMobile = width < 480;
  const effectiveHeight = Math.max(height, isMobile ? 240 : 270);
  const margin = isMobile ? 12 : 20;
  const availableHeight = effectiveHeight - 40;
  const radius = Math.max(50, Math.min(width, availableHeight) / 2 - margin);
  const innerRadius = radius * (isMobile ? 0.60 : 0.65);
  const centerX = width / 2;
  const centerY = availableHeight / 2 + 5;

  if (width < 10 || height < 10) return null;

  const filteredData = selectedSegment
    ? data.filter(d => d.label === selectedSegment)
    : data;

  const selectedItem = data.find(d => d.label === selectedSegment);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[240px]">
      <svg width={width} height={effectiveHeight}>
        <Group top={centerY} left={centerX}>
          <Pie
            data={filteredData}
            pieValue={(d) => d.value}
            outerRadius={radius}
            innerRadius={innerRadius}
            padAngle={selectedSegment ? 0 : 0.03}
            cornerRadius={selectedSegment ? 0 : 4}
          >
            {(pie) => (
              <AnimatedPie
                {...pie}
                getKey={(arc) => arc.data.label}
                getColor={(arc) => {
                  const originalIdx = data.findIndex(d => d.label === arc.data.label);
                  return palette[(originalIdx >= 0 ? originalIdx : 0) % palette.length];
                }}
                onClickDatum={(arc) => setSelectedSegment(selectedSegment === arc.data.label ? null : arc.data.label)}
                onMouseMoveDatum={(arc, event) => {
                  const coords = localPoint(event.target.ownerSVGElement, event);
                  showTooltip({
                    tooltipLeft: coords?.x || 0,
                    tooltipTop: coords?.y || 0,
                    tooltipData: { ...arc.data, color: palette[(data.findIndex(d => d.label === arc.data.label) >= 0 ? data.findIndex(d => d.label === arc.data.label) : 0) % palette.length] }
                  });
                }}
                onMouseLeaveDatum={hideTooltip}
              />
            )}
          </Pie>

          {/* Center Counter Label */}
          <text
            textAnchor="middle"
            dy="-0.3em"
            fill="currentColor"
            fontSize={selectedItem ? 18 : 22}
            fontWeight={900}
            className="font-mono cursor-pointer text-slate-900 dark:text-white"
            onClick={() => setSelectedSegment(null)}
          >
            {selectedItem ? formatCompactNumber(selectedItem.value) : formatCompactNumber(total)}
          </text>
          <text
            textAnchor="middle"
            dy="1.4em"
            fill="currentColor"
            fontSize={10}
            fontWeight={700}
            className="uppercase tracking-wider cursor-pointer select-none text-slate-500 dark:text-slate-400"
            onClick={() => setSelectedSegment(null)}
          >
            {selectedItem ? selectedItem.label : centerLabel}
          </text>
        </Group>
      </svg>

      {/* Bottom Glassmorphic Legend for Donut Slices */}
      <div className="absolute bottom-0.5 left-0 right-0 flex flex-wrap justify-center gap-1.5 px-2 text-[9px] sm:text-[10px] font-semibold max-h-14 overflow-y-auto custom-scrollbar">
        {data.map((d, idx) => {
          const color = palette[idx % palette.length];
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          const isSelected = selectedSegment === d.label;
          return (
            <div
              key={`legend-${d.label || idx}`}
              onClick={() => setSelectedSegment(isSelected ? null : d.label)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg cursor-pointer backdrop-blur-md border shadow-sm transition-all duration-200 ${
                isSelected
                  ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-slate-800 dark:border-white/20 dark:text-white ring-1 ring-blue-400 font-bold scale-105'
                  : 'bg-white/80 text-slate-700 hover:text-slate-900 border-slate-200/80 hover:bg-white dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:border-white/10 dark:hover:border-white/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
              <span className="truncate max-w-[90px]">{d.label}</span>
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[9px]">({pct}%)</span>
            </div>
          );
        })}
      </div>

      {tooltipOpen && tooltipData && (
        <TooltipInPortal top={tooltipTop} left={tooltipLeft} style={tooltipCustomStyles}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tooltipData.color }}></span>
            <span>{tooltipData.label}: <strong className="text-white font-mono">{tooltipData.value} {centerLabel.toLowerCase()}</strong></span>
          </div>
        </TooltipInPortal>
      )}
    </div>
  );
}

export function VisxDonutChart({ data = [], centerLabel = 'Items' }) {
  const normalizedData = (data || []).map((d, i) => ({
    label: d.label || d.name || `Item ${i + 1}`,
    value: Number(d.value !== undefined ? d.value : (d.count || 0))
  }));

  const isAllZero = normalizedData.length === 0 || normalizedData.every(d => d.value === 0);

  if (isAllZero) {
    return (
      <div className="text-center text-slate-500 text-xs py-10 italic">
        No distribution data recorded.
      </div>
    );
  }

  return (
    <ParentSize className="w-full h-full min-h-[240px]">
      {({ width, height }) => (
        <InnerDonutChart data={normalizedData} centerLabel={centerLabel} width={width} height={height} />
      )}
    </ParentSize>
  );
}
