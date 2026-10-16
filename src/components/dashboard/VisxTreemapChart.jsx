import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Group } from '@visx/group';
import { Tree, hierarchy } from '@visx/hierarchy';
import { LinkHorizontal } from '@visx/shape';
import { ParentSize } from '@visx/responsive';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import {
  FiPackage,
  FiBriefcase,
  FiShoppingBag,
  FiLayers,
  FiFileText,
  FiClock,
  FiCheckCircle,
  FiTruck,
  FiXCircle,
  FiMaximize2,
  FiMinimize2,
  FiSearch,
  FiX,
  FiZoomIn,
  FiZoomOut,
  FiRotateCcw,
  FiChevronRight
} from 'react-icons/fi';

// Helper to truncate text for clean SVG node rendering
const truncateLabel = (str = '', maxLen = 14) => {
  if (!str) return '';
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}…` : str;
};

// Compact financial metric formatter (Indian numbering: Cr, L, k)
const formatCompactMetric = (val, metric = 'revenue') => {
  if (metric === 'orders') {
    const count = Number(val) || 0;
    return `${count} ${count === 1 ? 'PO' : 'POs'}`;
  }
  const n = Number(val) || 0;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toLocaleString('en-IN')}`;
};

// Helper for PO status styling
const getStatusDetails = (status = '') => {
  const norm = String(status).toUpperCase();
  if (norm.includes('APPROV')) {
    return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', label: 'Approved', icon: FiCheckCircle };
  }
  if (norm.includes('DISPATCH')) {
    return { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', label: 'Dispatched', icon: FiTruck };
  }
  if (norm.includes('REJECT')) {
    return { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', label: 'Rejected', icon: FiXCircle };
  }
  return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', label: 'Pending', icon: FiClock };
};

// 1. Node-Link Tree View (Multi-level Company -> Firm -> PO -> Product)
const NodeLinkTreeView = ({
  width,
  height,
  rootNode,
  totalValue,
  metric,
  isDark,
  hoveredNodeId,
  setHoveredNodeId,
  showTooltip,
  hideTooltip,
  onNodeClick,
  collapsedIds,
  onToggleCollapse,
  searchQuery = '',
  matchingIds = new Set()
}) => {
  const leafCount = useMemo(() => {
    if (!rootNode) return 1;
    return rootNode.leaves().length;
  }, [rootNode]);

  const margin = { top: 40, left: 60, right: 140, bottom: 40 };

  // Calculate generous canvas bounds to prevent truncation
  const canvasWidth = Math.max(width - 20, 1180);
  const canvasHeight = Math.max(height - 20, leafCount * 46 + 100, 560);

  const innerWidth = Math.max(100, canvasWidth - margin.left - margin.right);
  const innerHeight = Math.max(100, canvasHeight - margin.top - margin.bottom);

  const isSearchActive = Boolean(searchQuery && searchQuery.trim().length > 0);

  return (
    <Tree root={rootNode} size={[innerHeight, innerWidth]}>
      {(tree) => {
        const links = tree.links();
        const nodes = tree.descendants();

        return (
          <Group top={margin.top} left={margin.left}>
            {/* SVG Gradients Definition */}
            <defs>
              <linearGradient id="tree-root-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>

            {/* Curved Connector Links */}
            {links.map((link, i) => {
              const linkKey = `link-${i}`;
              const targetNode = link.target;
              const targetData = targetNode?.data || {};
              const targetId = targetData._id || targetData.id || targetData.name || targetData.poNumber;
              const isTargetMatch = isSearchActive && matchingIds.has(targetId);

              const strokeColor = isTargetMatch
                ? '#f59e0b'
                : isDark
                ? '#334155'
                : '#cbd5e1';

              const strokeWidth = isTargetMatch ? 2.5 : 1.5;
              const strokeOpacity = isSearchActive && !isTargetMatch ? 0.2 : isDark ? 0.75 : 0.65;

              return (
                <LinkHorizontal
                  key={linkKey}
                  data={link}
                  x={(d) => d.y}
                  y={(d) => d.x}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={strokeOpacity}
                  fill="none"
                  className="transition-all duration-200"
                />
              );
            })}

            {/* Hierarchy Nodes */}
            {nodes.map((node, i) => {
              const top = node.x;
              const left = node.y;
              const depth = node.depth;
              const isRoot = depth === 0;
              const hasChildren = Boolean(node.children && node.children.length > 0);
              const nodeData = node.data || {};
              const rawId = nodeData._id || nodeData.id || nodeData.poNumber || `${nodeData.name}-${depth}-${i}`;
              const nodeId = `node-${depth}-${i}`;
              const isHovered = hoveredNodeId === nodeId;
              const isCollapsed = collapsedIds.has(nodeData.name || rawId);

              const revenueVal = nodeData.revenue ?? node.value ?? 0;
              const ordersVal = nodeData.orders ?? nodeData.orderCount ?? (depth === 3 ? 1 : 0);
              const share = totalValue > 0 ? ((node.value / totalValue) * 100).toFixed(1) : '0';

              const isMatch = isSearchActive && matchingIds.has(rawId);
              const dimUnmatched = isSearchActive && !isMatch;

              // Determine node role/level
              const nodeType =
                nodeData.nodeType ||
                (isRoot
                  ? 'root'
                  : depth === 1
                  ? 'company'
                  : depth === 2
                  ? 'firm'
                  : depth === 3
                  ? 'po'
                  : 'product');

              // Common tooltip handler
              const handleMouseEnter = (e) => {
                setHoveredNodeId(nodeId);
                const point = localPoint(e);
                if (point) {
                  showTooltip({
                    tooltipData: {
                      ...nodeData,
                      nodeType,
                      depth,
                      revenue: revenueVal,
                      orders: ordersVal,
                      share,
                      totalValue
                    },
                    tooltipLeft: point.x,
                    tooltipTop: point.y
                  });
                }
              };

              const handleMouseLeave = () => {
                setHoveredNodeId(null);
                hideTooltip();
              };

              const handleClick = (e) => {
                e.stopPropagation();
                if (depth === 3 && onNodeClick) {
                  // Direct PO Drawer Click
                  onNodeClick(nodeData);
                } else if (hasChildren || nodeData.children) {
                  onToggleCollapse(nodeData.name || rawId);
                } else if (onNodeClick) {
                  onNodeClick(nodeData);
                }
              };

              // ----------------------------------------------------
              // Level 0: Root Node - Central Procurement Hub
              // ----------------------------------------------------
              if (isRoot) {
                return (
                  <Group
                    key={nodeId}
                    top={top}
                    left={left}
                    className="cursor-pointer"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onClick={handleClick}
                  >
                    <circle
                      r={isHovered ? 20 : 18}
                      fill="url(#tree-root-grad)"
                      stroke="#ffffff"
                      strokeWidth={2.5}
                      className="transition-all duration-200"
                      style={{ filter: 'drop-shadow(0 4px 14px rgba(236, 72, 153, 0.5))' }}
                    />
                    <text
                      dy=".35em"
                      fontSize={11}
                      fontWeight={900}
                      textAnchor="middle"
                      fill="#ffffff"
                      className="select-none pointer-events-none"
                    >
                      A
                    </text>
                  </Group>
                );
              }

              // ----------------------------------------------------
              // Level 1: Trading Company Node - Indigo / Blue Card
              // ----------------------------------------------------
              if (depth === 1) {
                const label = truncateLabel(nodeData.name || 'Company', 12);
                const rectWidth = 180;
                const rectHeight = 36;
                const formattedVal = formatCompactMetric(revenueVal, metric);
                const childCount = nodeData.children?.length || nodeData.firmCount || 0;

                return (
                  <Group
                    key={nodeId}
                    top={top}
                    left={left}
                    className="cursor-pointer transition-all duration-200"
                    opacity={dimUnmatched ? 0.25 : 1}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onClick={handleClick}
                  >
                    <rect
                      width={rectWidth}
                      height={rectHeight}
                      x={-rectWidth / 2}
                      y={-rectHeight / 2}
                      rx={8}
                      ry={8}
                      fill={isDark ? '#1e1b4b' : '#ffffff'}
                      stroke={
                        isMatch
                          ? '#f59e0b'
                          : isHovered
                          ? '#6366f1'
                          : isDark
                          ? '#312e81'
                          : '#c7d2fe'
                      }
                      strokeWidth={isMatch || isHovered ? 2 : 1.5}
                      className="transition-all duration-150"
                      style={{
                        filter: isMatch
                          ? 'drop-shadow(0 0 12px rgba(245, 158, 11, 0.6))'
                          : isHovered
                          ? 'drop-shadow(0 4px 14px rgba(99, 102, 241, 0.35))'
                          : isDark
                          ? 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))'
                          : 'drop-shadow(0 2px 4px rgba(99, 102, 241, 0.08))'
                      }}
                    />

                    {/* Company Initial Badge */}
                    <rect
                      x={-rectWidth / 2 + 6}
                      y={-12}
                      width={24}
                      height={24}
                      rx={6}
                      fill={isDark ? '#312e81' : '#e0e7ff'}
                    />
                    <text
                      x={-rectWidth / 2 + 18}
                      y={3.5}
                      fontSize={10}
                      fontWeight={800}
                      textAnchor="middle"
                      fill={isDark ? '#c7d2fe' : '#4338ca'}
                      className="select-none pointer-events-none"
                    >
                      {nodeData.code ? String(nodeData.code).slice(0, 3) : String(nodeData.name || 'CO').slice(0, 2).toUpperCase()}
                    </text>

                    {/* Company Name */}
                    <text
                      x={-rectWidth / 2 + 36}
                      y={3.5}
                      fontSize={11}
                      fontWeight={700}
                      textAnchor="start"
                      fill={isDark ? '#ffffff' : '#0f172a'}
                      className="select-none pointer-events-none"
                    >
                      {label}
                    </text>

                    {/* Inline Metric Pill */}
                    <rect
                      x={rectWidth / 2 - 58}
                      y={-10}
                      width={52}
                      height={20}
                      rx={5}
                      fill={isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.12)'}
                    />
                    <text
                      x={rectWidth / 2 - 32}
                      y={3.5}
                      fontSize={9.5}
                      fontWeight={800}
                      textAnchor="middle"
                      fill={isDark ? '#a5b4fc' : '#4338ca'}
                      className="select-none pointer-events-none font-mono"
                    >
                      {formattedVal}
                    </text>

                    {/* Collapsed Branch Count Pill */}
                    {isCollapsed && childCount > 0 && (
                      <g transform={`translate(${rectWidth / 2 + 8}, 0)`}>
                        <rect
                          x={0}
                          y={-10}
                          width={44}
                          height={20}
                          rx={10}
                          fill="#4f46e5"
                          style={{ filter: 'drop-shadow(0 2px 4px rgba(79, 70, 229, 0.4))' }}
                        />
                        <text
                          x={22}
                          y={3.5}
                          fontSize={9.5}
                          fontWeight={800}
                          textAnchor="middle"
                          fill="#ffffff"
                          className="select-none pointer-events-none"
                        >
                          +{childCount}
                        </text>
                      </g>
                    )}
                  </Group>
                );
              }

              // ----------------------------------------------------
              // Level 2: Purchasing Firm Node - Teal / Emerald Card
              // ----------------------------------------------------
              if (depth === 2) {
                const label = truncateLabel(nodeData.name || 'Firm', 12);
                const rectWidth = 175;
                const rectHeight = 34;
                const formattedVal = formatCompactMetric(revenueVal, metric);
                const childCount = nodeData.children?.length || nodeData.pos?.length || 0;

                return (
                  <Group
                    key={nodeId}
                    top={top}
                    left={left}
                    className="cursor-pointer transition-all duration-200"
                    opacity={dimUnmatched ? 0.25 : 1}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onClick={handleClick}
                  >
                    <rect
                      width={rectWidth}
                      height={rectHeight}
                      x={-rectWidth / 2}
                      y={-rectHeight / 2}
                      rx={8}
                      ry={8}
                      fill={isDark ? '#042f2e' : '#ffffff'}
                      stroke={
                        isMatch
                          ? '#f59e0b'
                          : isHovered
                          ? '#14b8a6'
                          : isDark
                          ? '#115e59'
                          : '#99f6e4'
                      }
                      strokeWidth={isMatch || isHovered ? 2 : 1.4}
                      className="transition-all duration-150"
                      style={{
                        filter: isMatch
                          ? 'drop-shadow(0 0 12px rgba(245, 158, 11, 0.6))'
                          : isHovered
                          ? 'drop-shadow(0 4px 12px rgba(20, 184, 166, 0.35))'
                          : isDark
                          ? 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))'
                          : 'drop-shadow(0 2px 4px rgba(20, 184, 166, 0.08))'
                      }}
                    />

                    {/* Firm Icon Pill */}
                    <rect
                      x={-rectWidth / 2 + 6}
                      y={-11}
                      width={22}
                      height={22}
                      rx={5}
                      fill={isDark ? '#115e59' : '#ccfbf1'}
                    />
                    <text
                      x={-rectWidth / 2 + 17}
                      y={3.5}
                      fontSize={9.5}
                      fontWeight={800}
                      textAnchor="middle"
                      fill={isDark ? '#5eead4' : '#0f766e'}
                      className="select-none pointer-events-none"
                    >
                      F
                    </text>

                    {/* Firm Name */}
                    <text
                      x={-rectWidth / 2 + 34}
                      y={3.5}
                      fontSize={10.5}
                      fontWeight={700}
                      textAnchor="start"
                      fill={isDark ? '#f0fdfa' : '#0f172a'}
                      className="select-none pointer-events-none"
                    >
                      {label}
                    </text>

                    {/* Inline Metric Pill */}
                    <rect
                      x={rectWidth / 2 - 56}
                      y={-9}
                      width={50}
                      height={18}
                      rx={4}
                      fill={isDark ? 'rgba(20, 184, 166, 0.25)' : 'rgba(20, 184, 166, 0.12)'}
                    />
                    <text
                      x={rectWidth / 2 - 31}
                      y={3.5}
                      fontSize={9}
                      fontWeight={800}
                      textAnchor="middle"
                      fill={isDark ? '#5eead4' : '#0f766e'}
                      className="select-none pointer-events-none font-mono"
                    >
                      {formattedVal}
                    </text>

                    {/* Collapsed Branch Count Pill */}
                    {isCollapsed && childCount > 0 && (
                      <g transform={`translate(${rectWidth / 2 + 8}, 0)`}>
                        <rect
                          x={0}
                          y={-10}
                          width={42}
                          height={20}
                          rx={10}
                          fill="#0d9488"
                          style={{ filter: 'drop-shadow(0 2px 4px rgba(13, 148, 136, 0.4))' }}
                        />
                        <text
                          x={21}
                          y={3.5}
                          fontSize={9}
                          fontWeight={800}
                          textAnchor="middle"
                          fill="#ffffff"
                          className="select-none pointer-events-none"
                        >
                          +{childCount}
                        </text>
                      </g>
                    )}
                  </Group>
                );
              }

              // ----------------------------------------------------
              // Level 3: PO Node - Status-Coded Clickable Card
              // ----------------------------------------------------
              if (depth === 3) {
                const poNum = truncateLabel(nodeData.poNumber || nodeData.name || 'PO-Order', 11);
                const rectWidth = 160;
                const rectHeight = 30;
                const poStatus = getStatusDetails(nodeData.status || nodeData.poStatus);
                const formattedVal = formatCompactMetric(revenueVal, 'revenue');
                const childCount = nodeData.children?.length || 0;

                return (
                  <Group
                    key={nodeId}
                    top={top}
                    left={left}
                    className="cursor-pointer transition-all duration-200"
                    opacity={dimUnmatched ? 0.25 : 1}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onClick={handleClick}
                  >
                    <rect
                      width={rectWidth}
                      height={rectHeight}
                      x={-rectWidth / 2}
                      y={-rectHeight / 2}
                      rx={6}
                      ry={6}
                      fill={isDark ? '#0f172a' : '#ffffff'}
                      stroke={
                        isMatch
                          ? '#f59e0b'
                          : isHovered
                          ? poStatus.color
                          : isDark
                          ? '#334155'
                          : '#e2e8f0'
                      }
                      strokeWidth={isMatch || isHovered ? 2 : 1.2}
                      className="transition-all duration-150"
                      style={{
                        filter: isMatch
                          ? 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.6))'
                          : isHovered
                          ? `drop-shadow(0 0 10px ${poStatus.color}55)`
                          : 'none'
                      }}
                    />

                    {/* Status Dot */}
                    <circle
                      cx={-rectWidth / 2 + 10}
                      cy={0}
                      r={4}
                      fill={poStatus.color}
                    />

                    {/* PO Number */}
                    <text
                      x={-rectWidth / 2 + 20}
                      y={3.5}
                      fontSize={10}
                      fontWeight={700}
                      textAnchor="start"
                      fill={isDark ? '#f8fafc' : '#0f172a'}
                      className="select-none pointer-events-none font-mono"
                    >
                      {poNum}
                    </text>

                    {/* Total Value */}
                    <text
                      x={rectWidth / 2 - 8}
                      y={3.5}
                      fontSize={9.5}
                      fontWeight={800}
                      textAnchor="end"
                      fill={poStatus.color}
                      className="select-none pointer-events-none font-mono"
                    >
                      {formattedVal}
                    </text>

                    {/* Collapsed Items Count Pill */}
                    {isCollapsed && childCount > 0 && (
                      <g transform={`translate(${rectWidth / 2 + 8}, 0)`}>
                        <rect
                          x={0}
                          y={-8}
                          width={36}
                          height={16}
                          rx={8}
                          fill={poStatus.color}
                        />
                        <text
                          x={18}
                          y={3}
                          fontSize={8.5}
                          fontWeight={800}
                          textAnchor="middle"
                          fill="#ffffff"
                          className="select-none pointer-events-none"
                        >
                          +{childCount}
                        </text>
                      </g>
                    )}
                  </Group>
                );
              }

              // ----------------------------------------------------
              // Level 4: Leaf Product Nodes - Violet Capsule Pill
              // ----------------------------------------------------
              const leafLabel = truncateLabel(nodeData.name || nodeData.productName || 'Product', 12);
              const pillWidth = 145;
              const pillHeight = 24;

              return (
                <Group
                  key={nodeId}
                  top={top}
                  left={left}
                  className="cursor-pointer transition-all duration-200"
                  opacity={dimUnmatched ? 0.25 : 1}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onClick={handleClick}
                >
                  <rect
                    width={pillWidth}
                    height={pillHeight}
                    x={-pillWidth / 2}
                    y={-pillHeight / 2}
                    rx={12}
                    ry={12}
                    fill={
                      isMatch
                        ? 'rgba(245, 158, 11, 0.15)'
                        : isHovered
                        ? isDark
                          ? 'rgba(168, 85, 247, 0.2)'
                          : '#faf5ff'
                        : isDark
                        ? '#0f172a'
                        : '#ffffff'
                    }
                    stroke={isMatch ? '#f59e0b' : isHovered ? '#a855f7' : isDark ? '#475569' : '#cbd5e1'}
                    strokeWidth={isMatch || isHovered ? 1.8 : 1.2}
                    strokeDasharray={isHovered ? 'none' : '3 2'}
                    className="transition-all duration-150"
                  />

                  {/* Product Label */}
                  <text
                    x={-pillWidth / 2 + 12}
                    y={3.5}
                    fontSize={9.5}
                    fontWeight={600}
                    textAnchor="start"
                    fill={isDark ? '#e9d5ff' : '#7e22ce'}
                    className="select-none pointer-events-none"
                  >
                    {leafLabel}
                  </text>

                  {/* Qty Badge */}
                  <text
                    x={pillWidth / 2 - 10}
                    y={3.5}
                    fontSize={9}
                    fontWeight={800}
                    textAnchor="end"
                    fill={isDark ? '#c084fc' : '#9333ea'}
                    className="select-none pointer-events-none font-mono"
                  >
                    {nodeData.quantity ? `x${nodeData.quantity}` : ''}
                  </text>
                </Group>
              );
            })}
          </Group>
        );
      }}
    </Tree>
  );
};

// 2. Rich Hover Tooltip Card
const HierarchyTooltipContent = ({ data, isDark }) => {
  if (!data) return null;

  const nodeType = data.nodeType || 'product';
  const statusDetails = getStatusDetails(data.status || data.poStatus);
  const StatusIcon = statusDetails.icon;

  // PRODUCT TOOLTIP
  if (nodeType === 'product') {
    return (
      <div className="min-w-[220px] max-w-[280px] space-y-2.5">
        <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center text-sm border border-teal-500/20">
              <FiShoppingBag />
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                Product Item
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                {data.name}
              </p>
            </div>
          </div>
          {data.sku && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
              {data.sku}
            </span>
          )}
        </div>

        {/* Product financial metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
            <span className="text-[10px] text-slate-400 uppercase font-medium block">Qty Ordered</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
              {data.quantity || 1} units
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
            <span className="text-[10px] text-slate-400 uppercase font-medium block">Unit Price</span>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
              ₹{Number(data.unitPrice || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="col-span-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-bold">Line Total</span>
            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs">
              ₹{Number(data.revenue || (data.quantity * data.unitPrice) || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Hierarchy Trace */}
        <div className="pt-1.5 border-t border-slate-200/60 dark:border-white/10 text-[10px] text-slate-500 dark:text-slate-400 space-y-1">
          {data.poNumber && (
            <div className="flex items-center justify-between">
              <span>Order:</span>
              <strong className="font-mono text-slate-700 dark:text-slate-300">{data.poNumber}</strong>
            </div>
          )}
          {data.firmName && (
            <div className="flex items-center justify-between">
              <span>Firm:</span>
              <strong className="text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{data.firmName}</strong>
            </div>
          )}
          {data.companyName && (
            <div className="flex items-center justify-between">
              <span>Company:</span>
              <strong className="text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{data.companyName}</strong>
            </div>
          )}
        </div>
      </div>
    );
  }

  // PURCHASE ORDER TOOLTIP
  if (nodeType === 'po') {
    return (
      <div className="min-w-[220px] max-w-[280px] space-y-2.5">
        <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm border border-blue-500/20">
              <FiFileText />
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Purchase Order
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight mt-0.5 font-mono">
                {data.poNumber || data.name}
              </p>
            </div>
          </div>
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 border shrink-0"
            style={{
              color: statusDetails.color,
              backgroundColor: statusDetails.bg,
              borderColor: `${statusDetails.color}35`
            }}
          >
            <StatusIcon className="text-xs" />
            <span>{statusDetails.label}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
            <span className="text-[10px] text-slate-400 uppercase font-medium block">Order Value</span>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
              ₹{Number(data.revenue || data.totalAmount || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
            <span className="text-[10px] text-slate-400 uppercase font-medium block">Line Items</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
              {data.children?.length || 1} products
            </span>
          </div>
        </div>

        <div className="pt-1.5 border-t border-slate-200/60 dark:border-white/10 text-[10px] text-slate-500 dark:text-slate-400 space-y-1">
          {data.firmName && (
            <div className="flex items-center justify-between">
              <span>Firm:</span>
              <strong className="text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{data.firmName}</strong>
            </div>
          )}
          {data.companyName && (
            <div className="flex items-center justify-between">
              <span>Company:</span>
              <strong className="text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{data.companyName}</strong>
            </div>
          )}
          <div className="text-center pt-1 text-blue-500 dark:text-blue-400 font-semibold cursor-pointer">
            Click to preview complete order drawer →
          </div>
        </div>
      </div>
    );
  }

  // FIRM TOOLTIP
  if (nodeType === 'firm') {
    return (
      <div className="min-w-[220px] max-w-[280px] space-y-2.5">
        <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center text-sm border border-teal-500/20">
              <FiBriefcase />
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                Purchasing Firm
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                {data.name}
              </p>
            </div>
          </div>
          {data.city && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
              {data.city}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
            <span className="text-[10px] text-slate-400 uppercase font-medium block">Total Orders</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
              {data.orders || data.children?.length || 0} POs
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
            <span className="text-[10px] text-slate-400 uppercase font-medium block">Revenue</span>
            <span className="font-mono font-bold text-teal-600 dark:text-teal-400 text-xs">
              ₹{Number(data.revenue || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {data.companyName && (
          <div className="pt-1.5 border-t border-slate-200/60 dark:border-white/10 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Parent Company:</span>
            <strong className="text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{data.companyName}</strong>
          </div>
        )}
      </div>
    );
  }

  // COMPANY TOOLTIP
  return (
    <div className="min-w-[220px] max-w-[280px] space-y-2.5">
      <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm border border-indigo-500/20">
            <FiLayers />
          </div>
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Trading Company
            </span>
            <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
              {data.name}
            </p>
          </div>
        </div>
        {data.code && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
            {data.code}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
          <span className="text-[10px] text-slate-400 uppercase font-medium block">Linked Firms</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
            {data.firmCount || data.children?.length || 0} entities
          </span>
        </div>
        <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
          <span className="text-[10px] text-slate-400 uppercase font-medium block">Total Value</span>
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
            ₹{Number(data.revenue || 0).toLocaleString('en-IN')}
          </span>
        </div>
      </div>
    </div>
  );
};

// 3. Main Hierarchy Chart Container with Search, Zoom & Presets
const InnerHierarchyChart = ({
  width,
  height,
  data,
  metric = 'revenue',
  isDark: isDarkProp,
  onNodeClick
}) => {
  let themeIsDark = false;
  try {
    const themeContext = useTheme();
    themeIsDark = themeContext?.isDark ?? false;
  } catch {
    themeIsDark = false;
  }
  const isDark = isDarkProp !== undefined ? isDarkProp : themeIsDark;
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const chartContainerRef = useRef(null);

  const {
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
    tooltipOpen,
    showTooltip,
    hideTooltip
  } = useTooltip();

  // Search matching logic & ancestor auto-expansion
  const { matchingIds, matchCount } = useMemo(() => {
    if (!searchQuery || !searchQuery.trim() || !data) {
      return { matchingIds: new Set(), matchCount: 0 };
    }
    const q = searchQuery.trim().toLowerCase();
    const matches = new Set();
    let count = 0;

    const traverse = (node) => {
      if (!node) return false;
      const name = String(node.name || '').toLowerCase();
      const poNum = String(node.poNumber || '').toLowerCase();
      const sku = String(node.sku || '').toLowerCase();
      const city = String(node.city || '').toLowerCase();
      const code = String(node.code || '').toLowerCase();

      const isCurrentMatch =
        name.includes(q) ||
        poNum.includes(q) ||
        sku.includes(q) ||
        city.includes(q) ||
        code.includes(q);

      let childMatched = false;
      if (node.children && node.children.length > 0) {
        node.children.forEach((c) => {
          if (traverse(c)) childMatched = true;
        });
      }

      if (isCurrentMatch || childMatched) {
        const id = node._id || node.id || node.poNumber || node.name;
        matches.add(id);
        if (isCurrentMatch) count++;
        return true;
      }
      return false;
    };

    traverse(data);
    return { matchingIds: matches, matchCount: count };
  }, [searchQuery, data]);

  // Filter children based on collapsed state (while keeping active search matches visible)
  const filterCollapsed = (node) => {
    if (!node) return null;
    const nodeId = node.name || node._id || node.id || node.poNumber;
    const isNodeCollapsed = collapsedIds.has(nodeId);

    // If searching, keep branches with matches uncollapsed so users see them
    const hasSearchMatch = matchingIds.has(nodeId);

    if (isNodeCollapsed && !hasSearchMatch) {
      return { ...node, children: null };
    }
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: node.children.map(filterCollapsed)
      };
    }
    return { ...node };
  };

  const { rootNode, totalValue } = useMemo(() => {
    if (!data || !data.children || data.children.length === 0) {
      return { rootNode: null, totalValue: 0 };
    }

    const filteredData = filterCollapsed(data);

    const valueAccessor = (d) => {
      if (metric === 'revenue') {
        return Number(d.revenue ?? d.value ?? 0);
      }
      return Number(d.orders ?? d.orderCount ?? d.count ?? 1);
    };

    const root = hierarchy(filteredData)
      .sum(valueAccessor)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    return { rootNode: root, totalValue: root.value || 0 };
  }, [data, metric, collapsedIds, matchingIds]);

  const handleToggleCollapse = (nodeKey) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    });
  };

  // Depth preset buttons
  const handleExpandAll = () => setCollapsedIds(new Set());

  const handleCollapseToCompanies = () => {
    if (!data?.children) return;
    const compNames = data.children.map((c) => c.name || c.id || c._id);
    setCollapsedIds(new Set(compNames));
  };

  const handleCollapseToFirms = () => {
    if (!data?.children) return;
    const firmKeys = [];
    data.children.forEach((c) => {
      (c.children || []).forEach((f) => {
        firmKeys.push(f.name || f.id || f._id);
      });
    });
    setCollapsedIds(new Set(firmKeys));
  };

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((z) => Math.min(1.8, +(z + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.6, +(z - 0.15).toFixed(2)));
  const handleZoomReset = () => setZoomLevel(1);

  const toggleFullscreen = () => {
    if (!chartContainerRef.current) return;
    if (!document.fullscreenElement) {
      chartContainerRef.current.requestFullscreen?.().then(() => setIsChartFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsChartFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsChartFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  if (!rootNode || width < 100 || height < 100) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-xs">
        <span>No hierarchical data available</span>
      </div>
    );
  }

  // Calculate dynamic dimensions scaled by zoom
  const leavesCount = rootNode.leaves().length;
  const baseSvgWidth = Math.max(width, 1180);
  const baseSvgHeight = Math.max(height, leavesCount * 46 + 100, 560);
  const svgWidth = baseSvgWidth * zoomLevel;
  const svgHeight = baseSvgHeight * zoomLevel;

  return (
    <div
      ref={chartContainerRef}
      className={`relative select-none w-full h-full flex flex-col ${
        isChartFullscreen
          ? `p-4 sm:p-6 ${
              isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
            } dark:bg-slate-950 dark:text-slate-100 z-[99999]`
          : ''
      }`}
      style={
        isChartFullscreen
          ? {
              backgroundColor: isDark ? '#020617' : '#f8fafc',
            }
          : undefined
      }
    >
      {/* 1. Quick Search & Interactive Level Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-3 py-2 mb-2 bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/70 dark:border-white/10 rounded-2xl text-xs backdrop-blur-md shadow-xs">
        {/* Left: Search Input */}
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <div className="relative w-full">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              placeholder="Search tree entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-7 py-1 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <FiX size={11} />
              </button>
            )}
          </div>
          {searchQuery && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap">
              {matchCount} match{matchCount === 1 ? '' : 'es'}
            </span>
          )}
        </div>

        {/* Center: Depth Presets */}
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mr-1 hidden lg:inline">
            Presets:
          </span>
          <button
            type="button"
            onClick={handleExpandAll}
            className="px-2.5 py-1 rounded-lg bg-blue-200/40 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-md border border-slate-200/70 dark:border-white/10 transition-all cursor-pointer text-xs font-semibold whitespace-nowrap"
          >
            All Levels
          </button>
          <button
            type="button"
            onClick={handleCollapseToFirms}
            className="px-2.5 py-1 rounded-lg bg-blue-200/40 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-xs border border-slate-200/70 dark:border-white/10 transition-all cursor-pointer text-xs font-semibold whitespace-nowrap"
          >
            To Firms
          </button>
          <button
            type="button"
            onClick={handleCollapseToCompanies}
            className="px-2.5 py-1 rounded-lg bg-blue-200/40 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-xs border border-slate-200/70 dark:border-white/10 transition-all cursor-pointer text-xs font-semibold whitespace-nowrap"
          >
            Companies Only
          </button>
        </div>

        {/* Right: Zoom & Fullscreen Controls */}
        <div className="flex items-center gap-1.5 justify-end">
          <div className="inline-flex items-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-white/10 p-0.5 shadow-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.6}
              title="Zoom Out"
              className="p-1 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer disabled:opacity-30"
            >
              <FiZoomOut size={13} />
            </button>
            <span className="px-1.5 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 min-w-[36px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 1.8}
              title="Zoom In"
              className="p-1 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer disabled:opacity-30"
            >
              <FiZoomIn size={13} />
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              title="Reset Zoom"
              className="p-1 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer border-l border-slate-200 dark:border-white/10 ml-0.5"
            >
              <FiRotateCcw size={11} />
            </button>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isChartFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-xs border border-slate-200/70 dark:border-white/10 transition-all cursor-pointer"
          >
            {isChartFullscreen ? <FiMinimize2 size={13} /> : <FiMaximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* 2. Visual Canvas (Scrollable for complex branching) */}
      <div className="relative flex-1 overflow-x-auto overflow-y-auto custom-scrollbar rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-inner">
        <svg
          width={svgWidth}
          height={svgHeight}
          className="overflow-visible select-none transition-all duration-150"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, #0b1120 0%, #060913 100%)'
              : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)'
          }}
        >
          <g transform={`scale(${zoomLevel})`}>
            <NodeLinkTreeView
              width={baseSvgWidth}
              height={baseSvgHeight}
              rootNode={rootNode}
              totalValue={totalValue}
              metric={metric}
              isDark={isDark}
              hoveredNodeId={hoveredNodeId}
              setHoveredNodeId={setHoveredNodeId}
              showTooltip={showTooltip}
              hideTooltip={hideTooltip}
              onNodeClick={onNodeClick}
              collapsedIds={collapsedIds}
              onToggleCollapse={handleToggleCollapse}
              searchQuery={searchQuery}
              matchingIds={matchingIds}
            />
          </g>
        </svg>

        {/* Floating Interactive Tooltip */}
        {tooltipOpen && tooltipData && (
          <TooltipWithBounds
            top={tooltipTop}
            left={tooltipLeft}
            style={{
              ...defaultStyles,
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(16px)',
              color: isDark ? '#ffffff' : '#0f172a',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid rgba(226, 232, 240, 0.95)',
              borderRadius: '16px',
              padding: '12px 14px',
              boxShadow: isDark
                ? '0 20px 25px -5px rgba(0, 0, 0, 0.65), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
                : '0 20px 25px -5px rgba(15, 23, 42, 0.14), 0 8px 10px -6px rgba(15, 23, 42, 0.08)',
              zIndex: 100,
              pointerEvents: 'none'
            }}
          >
            <HierarchyTooltipContent data={tooltipData} isDark={isDark} />
          </TooltipWithBounds>
        )}
      </div>

      {/* 3. Footer Legend Bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 mt-2 text-[11px] text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-900/60 rounded-xl border border-slate-200/70 dark:border-white/10 shadow-xs flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-md bg-indigo-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Trading Company</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-md bg-teal-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Purchasing Firm</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Purchase Order</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Ordered Product</span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400">
          Tip: Click on PO cards to view slide-over order drawer
        </div>
      </div>
    </div>
  );
};

export default function VisxTreemapChart({
  data,
  metric = 'revenue',
  height = 560,
  isDark: isDarkProp,
  onNodeClick
}) {
  let themeIsDark = false;
  try {
    const themeContext = useTheme();
    themeIsDark = themeContext?.isDark ?? false;
  } catch {
    themeIsDark = false;
  }
  const isDark = isDarkProp !== undefined ? isDarkProp : themeIsDark;
  return (
    <div style={{ width: '100%', height }} className="relative">
      <ParentSize>
        {({ width, height: pHeight }) => (
          <InnerHierarchyChart
            width={width}
            height={pHeight}
            data={data}
            metric={metric}
            isDark={isDark}
            onNodeClick={onNodeClick}
          />
        )}
      </ParentSize>
    </div>
  );
}
