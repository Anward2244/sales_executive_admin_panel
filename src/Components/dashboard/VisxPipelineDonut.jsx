import React, { useMemo, useState } from 'react';
import { Group } from '@visx/group';
import { Pie } from '@visx/shape';
import { ParentSize } from '@visx/responsive';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';

const STAGE_CONFIG = [
  { key: 'PENDING', label: 'Pending Approval', color: '#f59e0b' },
  { key: 'APPROVED', label: 'Approved', color: '#3b82f6' },
  { key: 'DISPATCHED', label: 'Dispatched / Fulfilled', color: '#10b981' },
  { key: 'REJECTED', label: 'Rejected', color: '#f43f5e' }
];

const InnerPipelineDonut = ({
  width,
  height,
  statusBreakdown = {},
  totalCount = 0,
  isDark = false
}) => {
  const [activeKey, setActiveKey] = useState(null);

  const {
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
    tooltipOpen,
    showTooltip,
    hideTooltip
  } = useTooltip();

  // Prepare data array for Pie
  const slices = useMemo(() => {
    return STAGE_CONFIG.map((cfg) => {
      const data = statusBreakdown[cfg.key] || {};
      const count = Number(data.count) || 0;
      const value = Number(data.value) || 0;
      return {
        ...cfg,
        count,
        value
      };
    });
  }, [statusBreakdown]);

  // Sizing
  const size = Math.min(width, height);
  const radius = Math.max(10, size / 2 - 12);
  const innerRadius = radius * 0.72;
  const centerX = width / 2;
  const centerY = height / 2;

  if (width < 50 || height < 50) return null;

  return (
    <div className="relative select-none flex items-center justify-center">
      <svg width={width} height={height} className="overflow-visible">
        <Group top={centerY} left={centerX}>
          {totalCount === 0 ? (
            /* Empty State Ring */
            <circle
              r={radius}
              fill="none"
              stroke={isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}
              strokeWidth={radius - innerRadius}
              strokeDasharray="4 4"
            />
          ) : (
            <Pie
              data={slices}
              pieValue={(d) => (d.count > 0 ? d.count : 0)}
              outerRadius={(arc) => (arc.data.key === activeKey ? radius + 4 : radius)}
              innerRadius={innerRadius}
              padAngle={0.035}
              cornerRadius={4}
            >
              {(pie) => {
                return pie.arcs.map((arc, i) => {
                  const { key, color } = arc.data;
                  const isHovered = key === activeKey;
                  const arcPath = pie.path(arc);

                  return (
                    <g key={`arc-${key || i}`}>
                      <path
                        d={arcPath}
                        fill={color}
                        fillOpacity={isHovered ? 1 : 0.88}
                        stroke={isDark ? '#0f172a' : '#ffffff'}
                        strokeWidth={2}
                        className="cursor-pointer transition-all duration-200"
                        onMouseEnter={(e) => {
                          setActiveKey(key);
                          const point = localPoint(e);
                          if (point) {
                            showTooltip({
                              tooltipData: arc.data,
                              tooltipLeft: point.x,
                              tooltipTop: point.y
                            });
                          }
                        }}
                        onMouseMove={(e) => {
                          const point = localPoint(e);
                          if (point) {
                            showTooltip({
                              tooltipData: arc.data,
                              tooltipLeft: point.x,
                              tooltipTop: point.y
                            });
                          }
                        }}
                        onMouseLeave={() => {
                          setActiveKey(null);
                          hideTooltip();
                        }}
                      />
                    </g>
                  );
                });
              }}
            </Pie>
          )}

          {/* Donut Center Display */}
          <g pointerEvents="none" className="text-center">
            <text
              textAnchor="middle"
              dy="-0.2em"
              fontSize={size > 220 ? 26 : 22}
              fontWeight="900"
              fontFamily="inherit"
              fill={isDark ? '#ffffff' : '#0f172a'}
            >
              {totalCount}
            </text>
            <text
              textAnchor="middle"
              dy="1.3em"
              fontSize={11}
              fontWeight="600"
              fontFamily="inherit"
              fill={isDark ? '#94a3b8' : '#64748b'}
              letterSpacing="0.05em"
            >
              {totalCount === 1 ? 'TOTAL PO' : 'TOTAL POs'}
            </text>
          </g>
        </Group>
      </svg>

      {/* Floating Tooltip */}
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          key={Math.random()}
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
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
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: tooltipData.color }}
              />
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {tooltipData.label}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Orders:</span>
              <span className="font-extrabold font-mono text-slate-900 dark:text-white">
                {tooltipData.count} ({totalCount > 0 ? Math.round((tooltipData.count / totalCount) * 100) : 0}%)
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Value:</span>
              <span className="font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                ₹{Number(tooltipData.value || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
};

const VisxPipelineDonut = ({
  statusBreakdown = {},
  totalCount = 0,
  height = 230,
  isDark = false
}) => {
  return (
    <div style={{ width: '100%', height }}>
      <ParentSize debounceTime={10}>
        {({ width, height: pHeight }) => (
          <InnerPipelineDonut
            width={width}
            height={pHeight || height}
            statusBreakdown={statusBreakdown}
            totalCount={totalCount}
            isDark={isDark}
          />
        )}
      </ParentSize>
    </div>
  );
};

export default VisxPipelineDonut;
