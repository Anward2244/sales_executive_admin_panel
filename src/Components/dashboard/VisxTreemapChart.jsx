import React, { useMemo, useState } from 'react';
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
  FiMinimize2
} from 'react-icons/fi';

// Helper to truncate text for clean SVG node rendering
const truncateLabel = (str = '', maxLen = 14) => {
  if (!str) return '';
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}…` : str;
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
  onToggleCollapse
}) => {
  // Dimensions and layout
  const leafCount = useMemo(() => {
    if (!rootNode) return 1;
    return rootNode.leaves().length;
  }, [rootNode]);

  const margin = { top: 40, left: 60, right: 120, bottom: 40 };

  // Calculate generous horizontal & vertical bounds to prevent clipping
  const canvasWidth = Math.max(width - 20, 1080);
  const canvasHeight = Math.max(height - 20, leafCount * 42 + 90, 560);

  const innerWidth = Math.max(100, canvasWidth - margin.left - margin.right);
  const innerHeight = Math.max(100, canvasHeight - margin.top - margin.bottom);

  return (
    <Tree root={rootNode} size={[innerHeight, innerWidth]}>
      {(tree) => {
        const links = tree.links();
        const nodes = tree.descendants();

        return (
          <Group top={margin.top} left={margin.left}>
            {/* Curved Connector Links */}
            {links.map((link, i) => {
              const linkKey = `link-${i}`;
              return (
                <LinkHorizontal
                  key={linkKey}
                  data={link}
                  x={(d) => d.y}
                  y={(d) => d.x}
                  stroke={isDark ? '#3b4263' : '#94a3b8'}
                  strokeWidth={1.5}
                  strokeOpacity={isDark ? 0.85 : 0.65}
                  fill="none"
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
              const rawId = nodeData._id || nodeData.id || `${nodeData.name}-${depth}-${i}`;
              const nodeId = `node-${depth}-${i}`;
              const isHovered = hoveredNodeId === nodeId;
              const isCollapsed = collapsedIds.has(nodeData.name || rawId);

              const revenueVal = nodeData.revenue ?? node.value ?? 0;
              const ordersVal = nodeData.orders ?? nodeData.orderCount ?? (depth === 3 ? 1 : 0);
              const share = totalValue > 0 ? ((node.value / totalValue) * 100).toFixed(1) : '0';

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
                if (hasChildren || nodeData.children) {
                  onToggleCollapse(nodeData.name || rawId);
                } else if (onNodeClick) {
                  onNodeClick(nodeData);
                }
              };

              // ----------------------------------------------------
              // Level 0: Root Node - Pink Circle with "T" or "A"
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
                      r={isHovered ? 18 : 16}
                      fill="#ff708d"
                      stroke="#ffffff"
                      strokeWidth={2}
                      className="transition-all duration-200"
                      style={{ filter: 'drop-shadow(0 4px 10px rgba(255, 112, 141, 0.45))' }}
                    />
                    <text
                      dy=".35em"
                      fontSize={11}
                      fontWeight={900}
                      textAnchor="middle"
                      fill="#ffffff"
                      className="select-none pointer-events-none"
                    >
                      {nodeData.name?.charAt(0) || 'A'}
                    </text>
                  </Group>
                );
              }

              // ----------------------------------------------------
              // Level 1: Company Node - Cyan Rounded Box (Matching reference 'A')
              // ----------------------------------------------------
              if (depth === 1) {
                const label = truncateLabel(nodeData.name || 'Company', 14);
                const rectWidth = Math.max(54, Math.min(130, label.length * 7.2 + 20));
                const rectHeight = 28;

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
                    <rect
                      width={rectWidth}
                      height={rectHeight}
                      x={-rectWidth / 2}
                      y={-rectHeight / 2}
                      rx={5}
                      ry={5}
                      fill={isDark ? '#0f172a' : '#ffffff'}
                      stroke={isHovered ? '#38bdf8' : '#06b6d4'}
                      strokeWidth={isHovered ? 2 : 1.5}
                      className="transition-all duration-150"
                      style={{
                        filter: isHovered
                          ? 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.45))'
                          : isDark
                          ? 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.2))'
                          : 'drop-shadow(0 1px 3px rgba(6, 182, 212, 0.15))'
                      }}
                    />
                    <text
                      dy=".35em"
                      fontSize={11}
                      fontWeight={700}
                      textAnchor="middle"
                      fill={isDark ? '#e0f2fe' : '#0284c7'}
                      className="select-none pointer-events-none"
                    >
                      {label}
                    </text>
                    {isCollapsed && (
                      <circle
                        cx={rectWidth / 2 - 2}
                        cy={-rectHeight / 2 + 2}
                        r={4}
                        fill="#38bdf8"
                      />
                    )}
                  </Group>
                );
              }

              // ----------------------------------------------------
              // Level 2: Firm Node - Cyan/Sky Rounded Box (Matching reference 'C')
              // ----------------------------------------------------
              if (depth === 2) {
                const label = truncateLabel(nodeData.name || 'Firm', 15);
                const rectWidth = Math.max(56, Math.min(135, label.length * 7 + 20));
                const rectHeight = 28;

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
                    <rect
                      width={rectWidth}
                      height={rectHeight}
                      x={-rectWidth / 2}
                      y={-rectHeight / 2}
                      rx={5}
                      ry={5}
                      fill={isDark ? '#0f172a' : '#ffffff'}
                      stroke={isHovered ? '#38bdf8' : '#06b6d4'}
                      strokeWidth={isHovered ? 2 : 1.5}
                      className="transition-all duration-150"
                      style={{
                        filter: isHovered
                          ? 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.45))'
                          : isDark
                          ? 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.15))'
                          : 'drop-shadow(0 1px 3px rgba(6, 182, 212, 0.15))'
                      }}
                    />
                    <text
                      dy=".35em"
                      fontSize={10.5}
                      fontWeight={700}
                      textAnchor="middle"
                      fill={isDark ? '#e0f2fe' : '#0284c7'}
                      className="select-none pointer-events-none"
                    >
                      {label}
                    </text>
                    {isCollapsed && (
                      <circle
                        cx={rectWidth / 2 - 2}
                        cy={-rectHeight / 2 + 2}
                        r={4}
                        fill="#38bdf8"
                      />
                    )}
                  </Group>
                );
              }

              // ----------------------------------------------------
              // Level 3: PO Node - Cyan Outlined Box with Status Dot (Matching reference 'D')
              // ----------------------------------------------------
              if (depth === 3) {
                const label = truncateLabel(nodeData.poNumber || nodeData.name || 'PO-Order', 15);
                const rectWidth = Math.max(58, Math.min(130, label.length * 7 + 22));
                const rectHeight = 27;
                const poStatus = getStatusDetails(nodeData.status || nodeData.poStatus);

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
                    <rect
                      width={rectWidth}
                      height={rectHeight}
                      x={-rectWidth / 2}
                      y={-rectHeight / 2}
                      rx={5}
                      ry={5}
                      fill={isDark ? '#0f172a' : '#ffffff'}
                      stroke={isHovered ? '#38bdf8' : '#06b6d4'}
                      strokeWidth={isHovered ? 2 : 1.4}
                      className="transition-all duration-150"
                      style={{
                        filter: isHovered
                          ? 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.4))'
                          : isDark
                          ? 'none'
                          : 'drop-shadow(0 1px 2px rgba(6, 182, 212, 0.1))'
                      }}
                    />
                    {/* Status dot */}
                    <circle
                      cx={-rectWidth / 2 + 10}
                      cy={0}
                      r={3}
                      fill={poStatus.color}
                    />
                    <text
                      dx={5}
                      dy=".35em"
                      fontSize={10}
                      fontWeight={700}
                      textAnchor="middle"
                      fill={isDark ? '#e2e8f0' : '#1e293b'}
                      className="select-none pointer-events-none font-mono"
                    >
                      {label}
                    </text>
                    {isCollapsed && (
                      <circle
                        cx={rectWidth / 2 - 2}
                        cy={-rectHeight / 2 + 2}
                        r={4}
                        fill="#38bdf8"
                      />
                    )}
                  </Group>
                );
              }

              // ----------------------------------------------------
              // Level 4+: Leaf Product Nodes - Cyan Dashed Capsule Pill
              // (Matching reference 'A1', 'A2', 'D1', 'D2', 'D3'...)
              // ----------------------------------------------------
              const leafLabel = truncateLabel(nodeData.name || nodeData.productName || 'Product', 15);
              const pillWidth = Math.max(58, Math.min(140, leafLabel.length * 6.8 + 20));
              const pillHeight = 25;

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
                  <rect
                    width={pillWidth}
                    height={pillHeight}
                    x={-pillWidth / 2}
                    y={-pillHeight / 2}
                    rx={13}
                    ry={13}
                    fill={
                      isHovered
                        ? isDark
                          ? 'rgba(6, 182, 212, 0.18)'
                          : '#f0fdfa'
                        : isDark
                        ? '#0f172a'
                        : '#ffffff'
                    }
                    stroke={isHovered ? '#2dd4bf' : '#06b6d4'}
                    strokeWidth={isHovered ? 1.8 : 1.2}
                    strokeDasharray={isHovered ? 'none' : '3 2'}
                    className="transition-all duration-150"
                    style={{
                      filter: isHovered
                        ? 'drop-shadow(0 0 8px rgba(45, 212, 191, 0.35))'
                        : isDark
                        ? 'none'
                        : 'drop-shadow(0 1px 2px rgba(6, 182, 212, 0.1))'
                    }}
                  />
                  <text
                    dy=".35em"
                    fontSize={10}
                    fontWeight={600}
                    textAnchor="middle"
                    fill={isDark ? '#5eead4' : '#0f766e'}
                    className="select-none pointer-events-none"
                  >
                    {leafLabel}
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
            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border shrink-0"
            style={{
              backgroundColor: statusDetails.bg,
              color: statusDetails.color,
              borderColor: `${statusDetails.color}40`
            }}
          >
            <StatusIcon size={10} />
            <span>{statusDetails.label}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
            <span className="text-[10px] text-slate-400 uppercase font-medium block">Total Value</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
              ₹{Number(data.revenue || data.totalAmount || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
            <span className="text-[10px] text-slate-400 uppercase font-medium block">Line Items</span>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
              {data.children?.length || data.itemCount || 1} Products
            </span>
          </div>
        </div>

        {data.firmName && (
          <div className="pt-1.5 border-t border-slate-200/60 dark:border-white/10 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Purchasing Firm:</span>
            <strong className="text-slate-700 dark:text-slate-300">{data.firmName}</strong>
          </div>
        )}
      </div>
    );
  }

  // PURCHASING FIRM TOOLTIP
  if (nodeType === 'firm') {
    return (
      <div className="min-w-[200px] max-w-[260px] space-y-2">
        <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center text-sm border border-sky-500/20">
              <FiBriefcase />
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                Purchasing Firm
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                {data.name}
              </p>
            </div>
          </div>
          {data.city && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
              {data.city}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Spend Volume</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
              ₹{Number(data.revenue || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Orders Placed</span>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
              {data.children?.length || data.orders || 1} POs
            </span>
          </div>
        </div>

        {data.companyName && (
          <div className="pt-1.5 border-t border-slate-200/60 dark:border-white/10 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Trading Partner:</span>
            <strong className="text-slate-700 dark:text-slate-300">{data.companyName}</strong>
          </div>
        )}
      </div>
    );
  }

  // PARTNER COMPANY TOOLTIP
  if (nodeType === 'company') {
    const isActive = data.isActive !== undefined ? data.isActive : true;

    return (
      <div className="min-w-[210px] max-w-[270px] space-y-2">
        <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-sm border border-cyan-500/20">
              <FiLayers />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  Company
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  }`}
                >
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                {data.name}
              </p>
            </div>
          </div>
          {data.code && (
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
              {data.code}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">B2B Revenue</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
              ₹{Number(data.revenue || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Linked Firms</span>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
              {data.children?.length || data.firmCount || 0} Firms
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ROOT NETWORK TOOLTIP
  return (
    <div className="min-w-[190px] space-y-2">
      <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-white/10 pb-2">
        <div className="w-7 h-7 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center text-xs font-black">
          A
        </div>
        <div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-rose-500">
            Ecosystem Root
          </span>
          <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">
            {data.name || 'Auric B2B Network'}
          </p>
        </div>
      </div>
      <div className="text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-400">Total Valuation:</span>
          <strong className="font-mono text-emerald-600 dark:text-emerald-400">
            ₹{Number(data.totalValue || data.revenue || 0).toLocaleString('en-IN')}
          </strong>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Total Companies:</span>
          <strong className="text-slate-700 dark:text-slate-300">{data.children?.length || 0} Companies</strong>
        </div>
      </div>
    </div>
  );
};

// 3. Main Hierarchy Chart Container
const InnerHierarchyChart = ({
  width,
  height,
  data,
  metric = 'revenue',
  isDark = false,
  onNodeClick
}) => {
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());

  const {
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
    tooltipOpen,
    showTooltip,
    hideTooltip
  } = useTooltip();

  // Filter children based on collapsed state
  const filterCollapsed = (node) => {
    if (!node) return null;
    const isNodeCollapsed = collapsedIds.has(node.name || node._id || node.id);
    if (isNodeCollapsed) {
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
  }, [data, metric, collapsedIds]);

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

  const handleExpandAll = () => setCollapsedIds(new Set());

  const handleCollapseToCompanies = () => {
    if (!data?.children) return;
    const compNames = data.children.map((c) => c.name || c.id);
    setCollapsedIds(new Set(compNames));
  };

  if (!rootNode || width < 100 || height < 100) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-xs">
        <span>No hierarchical data available</span>
      </div>
    );
  }

  // Calculate dynamic dimensions
  const leavesCount = rootNode.leaves().length;
  const svgWidth = Math.max(width, 1080);
  const svgHeight = Math.max(height, leavesCount * 42 + 90, 560);

  return (
    <div className="relative select-none w-full h-full flex flex-col">
      {/* Quick Action Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 rounded-xl text-[11px] font-semibold text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>
            Hierarchy: <strong>Companies</strong> → <strong>Firms</strong> → <strong>POs</strong> → <strong>Products</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleExpandAll}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-xs border border-slate-200/60 dark:border-white/10 transition-all cursor-pointer flex items-center gap-1 text-xs"
          >
            <FiMaximize2 size={11} />
            <span>Expand All</span>
          </button>
          <button
            type="button"
            onClick={handleCollapseToCompanies}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-xs border border-slate-200/60 dark:border-white/10 transition-all cursor-pointer flex items-center gap-1 text-xs"
          >
            <FiMinimize2 size={11} />
            <span>Collapse</span>
          </button>
        </div>
      </div>

      {/* Visual Canvas (Scrollable for complex branching) */}
      <div className="relative flex-1 overflow-x-auto overflow-y-auto custom-scrollbar rounded-2xl border border-slate-200/60 dark:border-white/10">
        <svg
          width={svgWidth}
          height={svgHeight}
          className="overflow-visible select-none"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, #1b203a 0%, #15182c 100%)'
              : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)'
          }}
        >
          <NodeLinkTreeView
            width={svgWidth}
            height={svgHeight}
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
          />
        </svg>

        {/* Floating Interactive Tooltip */}
        {tooltipOpen && tooltipData && (
          <TooltipWithBounds
            top={tooltipTop}
            left={tooltipLeft}
            style={{
              ...defaultStyles,
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(14px)',
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
    </div>
  );
};

export default function VisxTreemapChart({
  data,
  metric = 'revenue',
  height = 560,
  isDark = false,
  onNodeClick
}) {
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
