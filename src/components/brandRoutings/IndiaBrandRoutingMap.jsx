import React, { useState, useMemo, useRef } from 'react';
import IndiaMap from '@svg-maps/india';
import {
  FiMapPin,
  FiGlobe,
  FiBriefcase,
  FiLayers,
  FiCheckCircle,
  FiAlertCircle,
  FiEdit2,
  FiFilter,
  FiInfo,
  FiZoomIn,
  FiZoomOut,
  FiRotateCcw,
  FiZap,
  FiChevronLeft,
  FiChevronRight,
  FiArrowLeft,
  FiCheck,
  FiSliders,
  FiEye,
  FiX
} from 'react-icons/fi';
import { getBrandColor } from '@/pages/brandRoutings/BrandRoutings';
import CustomDropdown from '@/components/ui/CustomDropdown';

// Distinct, harmonious color palettes aligned with the admin panel's KPI theme tokens
const COMPANY_PALETTES = [
  {
    name: 'indigo',
    fill: '#6366f1', // Indigo
    stroke: '#4338ca',
    bg: 'bg-indigo-500',
    text: 'text-indigo-600 dark:text-indigo-400',
    badge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
    border: 'border-indigo-500/30'
  },
  {
    name: 'cyan',
    fill: '#06b6d4', // Cyan
    stroke: '#0e7490',
    bg: 'bg-cyan-500',
    text: 'text-cyan-600 dark:text-cyan-400',
    badge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
    border: 'border-cyan-500/30'
  },
  {
    name: 'purple',
    fill: '#8b5cf6', // Violet/Purple
    stroke: '#6d28d9',
    bg: 'bg-purple-500',
    text: 'text-purple-600 dark:text-purple-400',
    badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
    border: 'border-purple-500/30'
  },
  {
    name: 'blue',
    fill: '#3b82f6', // Royal Blue
    stroke: '#1d4ed8',
    bg: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
    border: 'border-blue-500/30'
  },
  {
    name: 'emerald',
    fill: '#10b981', // Emerald
    stroke: '#047857',
    bg: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    border: 'border-emerald-500/30'
  },
  {
    name: 'amber',
    fill: '#f59e0b', // Amber/Orange
    stroke: '#b45309',
    bg: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    border: 'border-amber-500/30'
  },
  {
    name: 'rose',
    fill: '#f43f5e', // Rose
    stroke: '#be123c',
    bg: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
    border: 'border-rose-500/30'
  }
];

// Helper to normalize state names for fuzzy territorial matching
export const matchesStateName = (ruleStates, mapLocationName) => {
  if (!Array.isArray(ruleStates) || ruleStates.length === 0) return false;

  // Wildcard Pan-India match
  if (ruleStates.some((s) => s === '*' || String(s).toLowerCase().includes('pan-india') || String(s).toLowerCase() === 'all')) {
    return true;
  }

  const normTarget = String(mapLocationName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  return ruleStates.some((ruleState) => {
    const normRule = String(ruleState || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normRule) return false;

    // Direct match
    if (normRule === normTarget) return true;

    // Dadra & Nagar Haveli and Daman & Diu
    if (
      (normRule.includes('dadra') || normRule.includes('daman') || normRule.includes('diu')) &&
      (normTarget.includes('dadra') || normTarget.includes('daman') || normTarget.includes('diu'))
    ) {
      return true;
    }

    // Jammu & Kashmir and Ladakh
    if (
      (normRule.includes('jammu') || normRule.includes('kashmir') || normRule.includes('ladakh')) &&
      (normTarget.includes('jammu') || normTarget.includes('kashmir'))
    ) {
      return true;
    }

    // Orissa / Odisha
    if (
      (normRule.includes('odisha') || normRule.includes('orissa')) &&
      (normTarget.includes('odisha') || normTarget.includes('orissa'))
    ) {
      return true;
    }

    // Pondicherry / Puducherry
    if (
      (normRule.includes('puducherry') || normRule.includes('pondicherry')) &&
      (normTarget.includes('puducherry') || normTarget.includes('pondicherry'))
    ) {
      return true;
    }

    // Uttarakhand / Uttaranchal
    if (
      (normRule.includes('uttarakhand') || normRule.includes('uttaranchal')) &&
      (normTarget.includes('uttarakhand') || normTarget.includes('uttaranchal'))
    ) {
      return true;
    }

    return false;
  });
};

const IndiaBrandRoutingMap = ({
  matrixData = [],
  companies = [],
  onOpenConfigure,
  onOpenAdd
}) => {
  // Available Brands list with rule counts
  const availableBrandsWithMeta = useMemo(() => {
    return matrixData
      .map((g) => {
        const rules = Array.isArray(g.rules) ? g.rules : (Array.isArray(g.mappings) ? g.mappings : []);
        return {
          brand: g.brand,
          ruleCount: rules.length,
          hasWildcard: rules.some((r) => Array.isArray(r.states) && r.states.some((s) => s === '*')),
          group: g
        };
      })
      .filter((b) => Boolean(b.brand))
      .sort((a, b) => {
        if (a.brand === 'ALL') return -1;
        if (b.brand === 'ALL') return 1;
        return a.brand.localeCompare(b.brand);
      });
  }, [matrixData]);

  const availableBrands = useMemo(() => {
    return availableBrandsWithMeta.map((b) => b.brand);
  }, [availableBrandsWithMeta]);

  // Selected Brand State
  const [selectedBrand, setSelectedBrand] = useState(() => {
    if (availableBrands.length > 0) {
      return availableBrands.includes('ALL') ? 'ALL' : availableBrands[0];
    }
    return 'ALL';
  });

  // Selected State on Map (for Inspection Sidebar)
  const [selectedStateLoc, setSelectedStateLoc] = useState(null);

  // Hovered State State (for Tooltip)
  const [hoveredStateLoc, setHoveredStateLoc] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, containerWidth: 600 });

  // Spotlight Filter by Company
  const [filterCompanyKey, setFilterCompanyKey] = useState('ALL');

  // Highlight specific rule on map
  const [highlightedRuleIdx, setHighlightedRuleIdx] = useState(null);

  // Zoom / Viewbox Controls
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Horizontal scroll ref for brand pill strip
  const brandPillScrollRef = useRef(null);

  const scrollBrandPills = (direction) => {
    if (brandPillScrollRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      brandPillScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Map company identifiers to color palettes deterministically
  const companyColorMap = useMemo(() => {
    const map = new Map();
    companies.forEach((comp, idx) => {
      const color = COMPANY_PALETTES[idx % COMPANY_PALETTES.length];
      const key = comp.code || comp._id || comp.name;
      map.set(key, color);
      if (comp._id) map.set(comp._id, color);
      if (comp.code) map.set(comp.code, color);
      if (comp.name) map.set(comp.name, color);
    });
    return map;
  }, [companies]);

  const getCompanyColor = (companyKey) => {
    if (!companyKey) return null;
    return companyColorMap.get(companyKey) || COMPANY_PALETTES[0];
  };

  // Find routing rules for the currently selected brand
  const selectedBrandGroup = useMemo(() => {
    return matrixData.find((g) => (g.brand || '').toLowerCase() === selectedBrand.toLowerCase()) || null;
  }, [matrixData, selectedBrand]);

  const brandRules = useMemo(() => {
    if (!selectedBrandGroup) return [];
    return Array.isArray(selectedBrandGroup.rules) && selectedBrandGroup.rules.length > 0
      ? selectedBrandGroup.rules
      : (Array.isArray(selectedBrandGroup.mappings) ? selectedBrandGroup.mappings : []);
  }, [selectedBrandGroup]);

  // Fallback ALL group rules
  const allBrandGroup = useMemo(() => {
    return matrixData.find((g) => (g.brand || '').toUpperCase() === 'ALL') || null;
  }, [matrixData]);

  const fallbackRules = useMemo(() => {
    if (!allBrandGroup) return [];
    return Array.isArray(allBrandGroup.rules) && allBrandGroup.rules.length > 0
      ? allBrandGroup.rules
      : (Array.isArray(allBrandGroup.mappings) ? allBrandGroup.mappings : []);
  }, [allBrandGroup]);

  // Compute territory resolution for each location
  // NOTE: Fallback ('ALL') rules are NOT visualized on the map for other brands.
  // The map strictly visualizes only the selected brand's own configured rules.
  // The global fallback policy is segregated at the bottom of the right details panel.
  const stateRoutingMap = useMemo(() => {
    const map = new Map();

    IndiaMap.locations.forEach((loc) => {
      // 1. Direct state rule in selected brand
      const directRule = brandRules.find((r) => {
        const isWild = Array.isArray(r.states) && r.states.some((s) => s === '*' || String(s).toLowerCase().includes('pan-india'));
        return !isWild && matchesStateName(r.states, loc.name);
      });

      // 2. Wildcard rule in selected brand
      const wildcardRule = brandRules.find((r) => {
        return Array.isArray(r.states) && r.states.some((s) => s === '*' || String(s).toLowerCase().includes('pan-india'));
      });

      // Active rule belongs strictly to selectedBrand (if viewing 'ALL', direct/wildcard come from ALL brand)
      const activeRule = directRule || wildcardRule || null;
      const isDirect = Boolean(directRule);
      const isWildcard = !directRule && Boolean(wildcardRule);
      const isCovered = Boolean(activeRule);
      const isUnassigned = !activeRule;

      let companyObj = null;
      if (activeRule) {
        if (typeof activeRule.companyId === 'object' && activeRule.companyId) {
          companyObj = activeRule.companyId;
        } else {
          companyObj = companies.find(
            (c) => c._id === activeRule.companyId || (activeRule.companyCode && c.code === activeRule.companyCode)
          ) || null;
        }
      }

      const companyKey = companyObj?.code || companyObj?._id || activeRule?.companyCode || activeRule?.companyId || null;
      const companyName = companyObj?.name || companyObj?.code || activeRule?.companyCode || 'Corporate Partner';
      const color = activeRule ? getCompanyColor(companyKey) : null;

      map.set(loc.id, {
        location: loc,
        rule: activeRule,
        directRule,
        wildcardRule,
        isCovered,
        isDirect,
        isWildcard,
        isFallback: false,
        isUnassigned,
        company: companyObj,
        companyName,
        companyCode: companyObj?.code || activeRule?.companyCode || '',
        color
      });
    });

    return map;
  }, [brandRules, companies, companyColorMap]);

  // Aggregate stats for coverage banner
  const coverageStats = useMemo(() => {
    let directCount = 0;
    let wildcardCount = 0;
    let unassignedCount = 0;
    const companyStateCounts = new Map();

    stateRoutingMap.forEach((info) => {
      if (info.isDirect) {
        directCount++;
      } else if (info.isWildcard) {
        wildcardCount++;
      } else {
        unassignedCount++;
      }

      if (info.isCovered) {
        const cKey = info.companyCode || info.companyName || 'Other';
        companyStateCounts.set(cKey, (companyStateCounts.get(cKey) || 0) + 1);
      }
    });

    const totalLocations = IndiaMap.locations.length; // 36
    const coveredCount = directCount + wildcardCount;
    const percent = Math.round((coveredCount / totalLocations) * 100);

    return {
      directCount,
      wildcardCount,
      unassignedCount,
      coveredCount,
      totalLocations,
      percent,
      uniqueCompaniesCount: companyStateCounts.size,
      companyStateCounts
    };
  }, [stateRoutingMap]);

  // All brands configured in the inspected state
  const inspectedStateBrands = useMemo(() => {
    if (!selectedStateLoc) return [];

    const list = [];
    matrixData.forEach((group) => {
      const bName = group.brand;
      const rules = Array.isArray(group.rules) ? group.rules : (Array.isArray(group.mappings) ? group.mappings : []);
      rules.forEach((r) => {
        if (matchesStateName(r.states, selectedStateLoc.name)) {
          const comp = typeof r.companyId === 'object'
            ? r.companyId
            : companies.find((c) => c._id === r.companyId || c.code === r.companyCode);

          list.push({
            brand: bName,
            isWildcard: Array.isArray(r.states) && r.states.some((s) => s === '*'),
            companyName: comp?.name || r.companyCode || 'Corporate Partner',
            companyCode: comp?.code || r.companyCode || '',
            priority: r.priority || 10,
            cities: r.cities || [],
            excludedCities: r.excludedCities || [],
            isActive: r.isActive !== false,
            group
          });
        }
      });
    });

    return list;
  }, [selectedStateLoc, matrixData, companies]);

  // Mouse move handler for floating tooltip
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      containerWidth: rect.width,
      containerHeight: rect.height
    });
  };

  const activeHoveredInfo = hoveredStateLoc ? stateRoutingMap.get(hoveredStateLoc.id) : null;
  const activeInspectedInfo = selectedStateLoc ? stateRoutingMap.get(selectedStateLoc.id) : null;

  // Has active wildcard for selected brand
  const selectedBrandHasWildcard = useMemo(() => {
    return brandRules.some((r) => Array.isArray(r.states) && r.states.some((s) => s === '*'));
  }, [brandRules]);

  return (
    <div className="space-y-4">
      {/* ================= TOP TOOLBAR & CONTROLS ================= */}
      <div className="bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Row 1: Brand Selection Controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Brand Search Dropdown + Title */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg border border-blue-500/20 shrink-0">
                <FiMapPin />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Territory Distribution Map
                </h3>
                <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Brand:</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {selectedBrand === 'ALL' ? 'ALL (Global Default Fallback)' : selectedBrand}
                  </span>
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden sm:block mx-1" />

            {/* Searchable Brand Selector Dropdown */}
            <div className="w-full sm:w-60">
              <CustomDropdown
                value={selectedBrand}
                onChange={(val) => {
                  setSelectedBrand(val);
                  setFilterCompanyKey('ALL');
                  setHighlightedRuleIdx(null);
                  setSelectedStateLoc(null);
                }}
                options={availableBrandsWithMeta.map((b) => ({
                  value: b.brand,
                  label: `${b.brand} (${b.ruleCount} rule${b.ruleCount === 1 ? '' : 's'}${b.hasWildcard ? ' • Pan-India' : ''})`
                }))}
                searchable={true}
                placeholder="Search brands..."
                statusColor="!px-3 !py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Quick Stats & Actions */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-between lg:justify-end">
            {/* Quick KPI Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300">
              <FiCheckCircle className="text-blue-500" />
              <span>
                {coverageStats.coveredCount}/36 Covered ({coverageStats.percent}%)
              </span>
            </div>

            {/* Configure Rule button */}
            {selectedBrandGroup && onOpenConfigure && (
              <button
                type="button"
                onClick={() => onOpenConfigure(selectedBrandGroup)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <FiEdit2 className="text-xs" />
                <span>Configure Rules</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Scrollable Brand Ribbon with visible scrollbar and navigation arrows */}
        <div className="relative pt-1 border-t border-slate-200/60 dark:border-white/5">
          <div className="flex items-center gap-2">
            {/* Scroll Left Button */}
            <button
              type="button"
              onClick={() => scrollBrandPills('left')}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shrink-0 cursor-pointer shadow-2xs"
              title="Scroll brands left"
            >
              <FiChevronLeft size={14} />
            </button>

            {/* Scrollable Container with VISIBLE styled scrollbar */}
            <div
              ref={brandPillScrollRef}
              className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar flex-1 select-none"
              style={{ scrollBehavior: 'smooth' }}
            >
              {availableBrandsWithMeta.map((b) => {
                const isSelected = selectedBrand.toLowerCase() === b.brand.toLowerCase();
                const isAll = b.brand === 'ALL';

                return (
                  <button
                    key={b.brand}
                    type="button"
                    onClick={() => {
                      setSelectedBrand(b.brand);
                      setFilterCompanyKey('ALL');
                      setHighlightedRuleIdx(null);
                      setSelectedStateLoc(null);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-blue-500/40 hover:bg-blue-50/50 dark:hover:bg-slate-700/50'
                      }`}
                  >
                    {isAll ? <FiGlobe className="text-xs" /> : <FiZap className="text-xs" />}
                    <span>{isAll ? 'ALL (Fallback)' : b.brand}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                        }`}
                    >
                      {b.ruleCount}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Scroll Right Button */}
            <button
              type="button"
              onClick={() => scrollBrandPills('right')}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shrink-0 cursor-pointer shadow-2xs"
              title="Scroll brands right"
            >
              <FiChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ================= ACTIVE BRAND POLICY BANNER ================= */}
      {selectedBrandHasWildcard ? (
        <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-800 dark:text-purple-300 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shrink-0" />
            <span>
              <strong>Pan-India Rule Active (*):</strong> Brand <strong>{selectedBrand}</strong> covers all 36 Indian territories automatically under its wildcard rule, unless specific state overrides take priority.
            </span>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-purple-500/20 font-bold shrink-0">
            Wildcard (*)
          </span>
        </div>
      ) : selectedBrand !== 'ALL' && coverageStats.directCount > 0 ? (
        <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
            <span>
              <strong>Targeted Territory Policy:</strong> Brand <strong>{selectedBrand}</strong> has direct routing configured in <strong>{coverageStats.directCount}</strong> state{coverageStats.directCount === 1 ? '' : 's'}.
              <span className="text-slate-500 dark:text-slate-400 ml-1">
                (Other {36 - coverageStats.directCount} states will inherit the global 'ALL' fallback rule at runtime).
              </span>
            </span>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-blue-500/20 font-bold shrink-0">
            {coverageStats.directCount} / 36 States
          </span>
        </div>
      ) : null}

      {/* ================= MAIN MAP WORKSPACE & INSPECTOR ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Interactive Vector SVG Map Card */}
        <div className="lg:col-span-8 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-white/10 p-5 shadow-xs relative overflow-hidden">
          {/* Map Header Toolbar */}
          <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-200/60 dark:border-white/5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Interactive State View
              </span>
              <span className="text-[11px] text-slate-400">
                (Click any state to inspect or click rule on right to highlight)
              </span>
            </div>

            {/* Zoom / Reset Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(z + 0.2, 1.8))}
                className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-blue-600 text-xs transition-colors cursor-pointer shadow-xs"
                title="Zoom in map"
              >
                <FiZoomIn />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(z - 0.2, 0.8))}
                className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-blue-600 text-xs transition-colors cursor-pointer shadow-xs"
                title="Zoom out map"
              >
                <FiZoomOut />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoomLevel(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-blue-600 text-xs transition-colors cursor-pointer shadow-xs"
                title="Reset zoom"
              >
                <FiRotateCcw />
              </button>
            </div>
          </div>

          {/* SVG Map Container */}
          <div
            className="relative w-full aspect-612/696 max-h-145 mx-auto flex items-center justify-center select-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredStateLoc(null)}
          >
            <svg
              viewBox={IndiaMap.viewBox}
              className="w-full h-full overflow-visible transition-transform duration-200 ease-out"
              style={{
                transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: 'center center'
              }}
            >
              <defs>
                <filter id="state-shadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2" />
                </filter>
                <filter id="active-state-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#2563eb" floodOpacity="0.8" />
                </filter>
              </defs>

              {IndiaMap.locations.map((loc) => {
                const info = stateRoutingMap.get(loc.id);
                const isSelected = selectedStateLoc?.id === loc.id;
                const isHovered = hoveredStateLoc?.id === loc.id;

                // Check if this state matches highlighted rule from sidebar
                const isRuleHighlighted =
                  highlightedRuleIdx !== null &&
                  brandRules[highlightedRuleIdx] &&
                  matchesStateName(brandRules[highlightedRuleIdx].states, loc.name);

                // Company match check for spotlight
                const matchesSpotlight =
                  filterCompanyKey === 'ALL' ||
                  info?.companyCode === filterCompanyKey ||
                  info?.company?.name === filterCompanyKey;

                // Harmonious color calculation matching panel theme
                let fillColor = '#f1f5f9'; // soft light slate
                let strokeColor = '#cbd5e1';
                let fillOpacity = 0.5;

                if (info?.isCovered) {
                  if (info.color?.fill) {
                    fillColor = info.color.fill;
                    strokeColor = info.color.stroke || '#64748b';

                    // THEME TINTING:
                    // Wildcard Pan-India (*) uses a soft, sophisticated translucent tint (0.35)
                    // so the map never looks like solid neon paint.
                    // Direct state overrides pop out with rich prominence (0.78).
                    if (info.isDirect) {
                      fillOpacity = matchesSpotlight ? 0.78 : 0.2;
                    } else if (info.isWildcard) {
                      fillOpacity = matchesSpotlight ? 0.35 : 0.12;
                    } else if (info.isFallback) {
                      fillOpacity = matchesSpotlight ? 0.22 : 0.08;
                    }
                  }
                } else {
                  // Truly unconfigured for this brand
                  fillColor = '#f8fafc';
                  strokeColor = '#e2e8f0';
                  fillOpacity = matchesSpotlight ? 0.6 : 0.15;
                }

                if (isRuleHighlighted) {
                  strokeColor = '#2563eb';
                  fillOpacity = 0.95;
                } else if (isSelected) {
                  strokeColor = '#1d4ed8';
                  fillOpacity = 0.95;
                } else if (isHovered) {
                  fillOpacity = Math.min(fillOpacity + 0.35, 0.95);
                  strokeColor = isSelected ? '#1d4ed8' : '#2563eb';
                }

                return (
                  <path
                    key={loc.id}
                    id={loc.id}
                    d={loc.path}
                    fill={fillColor}
                    fillOpacity={fillOpacity}
                    stroke={strokeColor}
                    strokeWidth={isSelected || isRuleHighlighted ? '2.8' : isHovered ? '2' : '0.8'}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className="transition-all duration-150 cursor-pointer"
                    style={{
                      filter: isSelected || isRuleHighlighted ? 'url(#active-state-glow)' : isHovered ? 'url(#state-shadow)' : undefined
                    }}
                    onMouseEnter={() => setHoveredStateLoc(loc)}
                    onClick={() => {
                      setSelectedStateLoc((prev) => (prev?.id === loc.id ? null : loc));
                    }}
                  />
                );
              })}
            </svg>

            {/* Smooth Floating Tooltip (Follows cursor, positioned cleanly above pointer so state is never covered) */}
            {hoveredStateLoc && activeHoveredInfo && (() => {
              const isNearTop = tooltipPos.y < 120;
              const isNearLeft = tooltipPos.x < 130;
              const isNearRight = tooltipPos.x > (tooltipPos.containerWidth || 550) - 130;

              const transformX = isNearLeft ? '0%' : isNearRight ? '-100%' : '-50%';
              const transformY = isNearTop ? '0%' : '-100%';
              const posX = isNearLeft ? tooltipPos.x + 14 : isNearRight ? tooltipPos.x - 14 : tooltipPos.x;
              const posY = isNearTop ? tooltipPos.y + 18 : tooltipPos.y - 14;

              return (
                <div
                  className="absolute z-50 pointer-events-none p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-2xl min-w-52.5 max-w-xs transition-opacity duration-75 select-none"
                  style={{
                    left: `${posX}px`,
                    top: `${posY}px`,
                    transform: `translate(${transformX}, ${transformY})`,
                    pointerEvents: 'none'
                  }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: activeHoveredInfo.color?.fill || '#6366f1' }}
                      />
                      <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {hoveredStateLoc.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        ({hoveredStateLoc.id.toUpperCase()})
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${activeHoveredInfo.isDirect
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          : activeHoveredInfo.isWildcard
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                            : 'bg-slate-100 dark:bg-white/10 text-slate-500'
                        }`}
                    >
                      {activeHoveredInfo.isDirect
                        ? 'Direct Rule'
                        : activeHoveredInfo.isWildcard
                          ? 'Pan-India (*)'
                          : 'Unassigned'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    {activeHoveredInfo.isCovered ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-400">Company:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {activeHoveredInfo.companyName} {activeHoveredInfo.companyCode && `(${activeHoveredInfo.companyCode})`}
                          </span>
                        </div>
                        {activeHoveredInfo.rule?.priority !== undefined && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-400">Priority:</span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              P{activeHoveredInfo.rule.priority}
                            </span>
                          </div>
                        )}
                        {Array.isArray(activeHoveredInfo.rule?.cities) && activeHoveredInfo.rule.cities.length > 0 && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate pt-0.5">
                            Cities: {activeHoveredInfo.rule.cities.join(', ')}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                        Unconfigured &mdash; Resolves via Global Fallback
                      </div>
                    )}
                    <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold pt-0.5 flex items-center gap-1">
                      <span>Click territory to inspect</span>
                      <span>&rarr;</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Company Color Legend Strip */}
          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Fulfilling Partners for {selectedBrand}:
              </span>
              {filterCompanyKey !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setFilterCompanyKey('ALL')}
                  className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Clear Spotlight Filter
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {companies.map((comp) => {
                const cKey = comp.code || comp._id || comp.name;
                const palette = getCompanyColor(cKey);
                const stateCount = coverageStats.companyStateCounts.get(comp.code || comp.name) || 0;
                const isSpotlit = filterCompanyKey === cKey;

                // Dim companies that have 0 states under this brand
                if (stateCount === 0 && filterCompanyKey !== cKey) return null;

                return (
                  <button
                    key={comp._id || comp.code}
                    type="button"
                    onClick={() => {
                      setFilterCompanyKey((prev) => (prev === cKey ? 'ALL' : cKey));
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${isSpotlit
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-white/10 hover:border-slate-300 text-slate-700 dark:text-slate-200'
                      }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: palette?.fill || '#3b82f6' }}
                    />
                    <span className="font-bold">{comp.name || comp.code}</span>
                    <span className="text-[10px] font-mono px-1 rounded bg-black/5 dark:bg-white/10 font-bold">
                      {stateCount} states
                    </span>
                  </button>
                );
              })}

              {/* Unassigned States indicator */}
              {coverageStats.unassignedCount > 0 && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                  <span>Unassigned ({coverageStats.unassignedCount} states)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Inspector / Brand Overview Panel */}
        <div className="lg:col-span-4 space-y-4">
          {selectedStateLoc ? (
            /* ================= STATE INSPECTION CARD ================= */
            <div className="bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-white/10 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0"
                    style={{ backgroundColor: activeInspectedInfo?.color?.fill || '#64748b' }}
                  >
                    {selectedStateLoc.id.toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                      {selectedStateLoc.name}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Territory Code: {selectedStateLoc.id.toUpperCase()}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedStateLoc(null)}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  title="Return to brand rule list"
                >
                  <FiArrowLeft size={12} />
                  <span>Rules</span>
                </button>
              </div>

              {/* Selected Brand fulfillment in this state */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  {selectedBrand} Routing in {selectedStateLoc.name}:
                </span>

                {activeInspectedInfo?.isCovered ? (
                  <div className="p-3.5 rounded-2xl bg-white/90 dark:bg-white/3 border border-slate-200/80 dark:border-white/10 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {activeInspectedInfo.companyName}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${activeInspectedInfo.isDirect
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : activeInspectedInfo.isWildcard
                              ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                          }`}
                      >
                        {activeInspectedInfo.isDirect
                          ? 'Direct State Rule'
                          : activeInspectedInfo.isWildcard
                            ? 'Pan-India (*)'
                            : 'Global Fallback'}
                      </span>
                    </div>

                    {activeInspectedInfo.companyCode && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Partner Entity Code:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {activeInspectedInfo.companyCode}
                        </span>
                      </div>
                    )}

                    {activeInspectedInfo.rule?.priority !== undefined && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Priority Rank:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          P{activeInspectedInfo.rule.priority}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <FiAlertCircle className="text-sm shrink-0" />
                      <span>No direct rule for {selectedBrand}</span>
                    </div>
                    <p className="text-[11px] text-amber-600/90 dark:text-amber-300/80 leading-relaxed">
                      Orders for {selectedBrand} placed in {selectedStateLoc.name} will be fulfilled using the global fallback policy.
                    </p>
                  </div>
                )}
              </div>

              {/* All Brands Configured for this state */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    All Brands in {selectedStateLoc.name}:
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 font-mono">
                    {inspectedStateBrands.length} rules
                  </span>
                </div>

                {inspectedStateBrands.length > 0 ? (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {inspectedStateBrands.map((entry, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {entry.brand}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {entry.companyName} {entry.companyCode && `(${entry.companyCode})`}
                          </div>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${entry.isWildcard
                              ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            }`}
                        >
                          {entry.isWildcard ? '*' : 'Direct'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No brands are explicitly mapped to this state.
                  </p>
                )}
              </div>

              {/* Edit Rule Action */}
              {selectedBrandGroup && onOpenConfigure && (
                <button
                  type="button"
                  onClick={() => onOpenConfigure(selectedBrandGroup)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <FiEdit2 />
                  <span>Configure {selectedBrand} Rules</span>
                </button>
              )}
            </div>
          ) : (
            /* ================= BRAND RULE BREAKDOWN & SUMMARY ================= */
            <div className="bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-white/10 p-5 shadow-xs space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${getBrandColor(selectedBrand).bg
                      }`}
                  >
                    {selectedBrand === 'ALL' ? '★' : selectedBrand.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                      {selectedBrand}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {brandRules.length} routing rule{brandRules.length === 1 ? '' : 's'} configured
                    </span>
                  </div>
                </div>

                {selectedBrandGroup && onOpenConfigure && (
                  <button
                    type="button"
                    onClick={() => onOpenConfigure(selectedBrandGroup)}
                    className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-500/10 transition-colors cursor-pointer"
                    title="Edit brand rules"
                  >
                    <FiEdit2 size={14} />
                  </button>
                )}
              </div>

              {/* Active Rules List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Configured Rule Matrix:
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Hover to highlight on map
                  </span>
                </div>

                {brandRules.length > 0 ? (
                  <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                    {brandRules.map((rule, idx) => {
                      const company = typeof rule.companyId === 'object'
                        ? rule.companyId
                        : companies.find((c) => c._id === rule.companyId || c.code === rule.companyCode);
                      const compName = company?.name || rule.companyCode || 'Corporate Partner';
                      const compCode = company?.code || rule.companyCode || '';
                      const isWildcard = Array.isArray(rule.states) && rule.states.some((s) => s === '*');
                      const palette = getCompanyColor(compCode || compName);
                      const isHighlighted = highlightedRuleIdx === idx;

                      return (
                        <div
                          key={rule._id || idx}
                          onMouseEnter={() => setHighlightedRuleIdx(idx)}
                          onMouseLeave={() => setHighlightedRuleIdx(null)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer ${isHighlighted
                              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500/50 shadow-xs'
                              : 'bg-white/80 dark:bg-white/2 border-slate-200/70 dark:border-white/5 hover:border-slate-300'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: palette?.fill || '#3b82f6' }}
                              />
                              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                                {compName}
                              </span>
                              {compCode && (
                                <span className="text-[10px] font-mono font-bold text-slate-400">
                                  ({compCode})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                                P{rule.priority !== undefined ? rule.priority : 10}
                              </span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isWildcard
                                    ? 'bg-purple-500/10 text-purple-600'
                                    : 'bg-emerald-500/10 text-emerald-600'
                                  }`}
                              >
                                {isWildcard ? 'Pan-India (*)' : `${rule.states?.length || 0} States`}
                              </span>
                            </div>
                          </div>

                          {/* States preview */}
                          {!isWildcard && Array.isArray(rule.states) && rule.states.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap pt-1">
                              {rule.states.slice(0, 4).map((st) => (
                                <span
                                  key={st}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 font-medium"
                                >
                                  {st}
                                </span>
                              ))}
                              {rule.states.length > 4 && (
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                                  +{rule.states.length - 4} more
                                </span>
                              )}
                            </div>
                          )}

                          {rule.description && (
                            <p className="text-[10px] text-slate-400 italic pt-1 truncate">
                              {rule.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 text-center space-y-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No routing rules configured for {selectedBrand}.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      This brand automatically uses the global 'ALL' fallback route.
                    </p>
                  </div>
                )}
              </div>

              {/* Diagnostics Card */}
              <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Coverage Summary:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 block font-bold">DIRECT OVERRIDES</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">
                      {coverageStats.directCount} States
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 block font-bold">WILDCARD STATUS</span>
                    <span className="text-base font-black text-purple-600 dark:text-purple-400">
                      {selectedBrandHasWildcard ? 'Active (*)' : 'None'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= SEGREGATED GLOBAL FALLBACK POLICY CARD (AT BOTTOM OF RIGHT DETAILS SECTION) ================= */}
          {selectedBrand !== 'ALL' && (
            <div className="bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-white/10 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm border border-indigo-500/20 shrink-0">
                    <FiGlobe />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Global Default Fallback ('ALL')
                    </h5>
                    <span className="text-[10px] text-slate-400 block">
                      Runtime failover for unconfigured territories
                    </span>
                  </div>
                </div>

                {onOpenConfigure && allBrandGroup && (
                  <button
                    type="button"
                    onClick={() => onOpenConfigure(allBrandGroup)}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    title="Configure global default fallback route"
                  >
                    <FiEdit2 size={11} />
                    <span>Configure</span>
                  </button>
                )}
              </div>

              {fallbackRules.length > 0 ? (
                <div className="space-y-2">
                  {fallbackRules.map((fRule, fIdx) => {
                    const comp = typeof fRule.companyId === 'object'
                      ? fRule.companyId
                      : companies.find((c) => c._id === fRule.companyId || c.code === fRule.companyCode);
                    const compName = comp?.name || fRule.companyCode || 'Corporate Partner';
                    const compCode = comp?.code || fRule.companyCode || '';
                    const palette = getCompanyColor(compCode || compName);
                    const isWildcard = Array.isArray(fRule.states) && fRule.states.includes('*');

                    return (
                      <div
                        key={fRule._id || fIdx}
                        className="p-3 rounded-2xl bg-slate-50/80 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: palette?.fill || '#6366f1' }}
                            />
                            <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate">
                              {compName}
                            </span>
                            {compCode && (
                              <span className="text-[10px] font-mono font-bold text-slate-400">
                                ({compCode})
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                            P{fRule.priority !== undefined ? fRule.priority : 10}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                          <span>Territory Scope:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {isWildcard ? 'Pan-India (*)' : `${fRule.states?.length || 0} States`}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed pt-0.5">
                    States not directly configured for <strong>{selectedBrand}</strong> are displayed uncolored on the map, and will automatically resolve to this <strong>ALL</strong> fallback partner at runtime.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No global fallback policy is currently configured.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IndiaBrandRoutingMap;
