import React, { useState, useRef, useEffect } from 'react';
import {
  FiSliders,
  FiEye,
  FiEyeOff,
  FiRotateCcw
} from 'react-icons/fi';

/**
 * Modern, unified TableToolbar providing:
 * 1. Column Visibility Selector dropdown with search & reset
 * 2. Result counts & bulk selection indicators
 * 3. Sticky-safe glassmorphism design
 * (Data Density is globally configured in Settings)
 */
export const TableToolbar = ({
  columns = [],
  visibleColumns = {},
  onToggleColumn,
  onResetColumns,
  showColumns = true,
  extraActions = null,
  totalCount = null,
  selectedCount = 0,
  summary = null,
  className = ''
}) => {
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const [columnFilter, setColumnFilter] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setColumnsDropdownOpen(false);
      }
    };
    if (columnsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [columnsDropdownOpen]);

  const filteredColumns = columns.filter((col) =>
    col.label.toLowerCase().includes(columnFilter.toLowerCase())
  );

  const activeColumnsCount = columns.filter((c) =>
    visibleColumns[c.id] !== undefined ? visibleColumns[c.id] : true
  ).length;

  return (
    <div
      className={`relative z-25 flex flex-wrap items-center justify-between gap-2.5 py-2 px-3.5 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs ring-1 ring-slate-900/5 dark:ring-white/5 ${className}`}
    >
      {/* Left section: counts & extra custom controls */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {totalCount !== null && (
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span>
              Total:{' '}
              <strong className="font-bold text-slate-900 dark:text-white tabular-nums">
                {totalCount}
              </strong>
            </span>
            {selectedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 tabular-nums">
                {selectedCount} selected
              </span>
            )}
          </div>
        )}
        {summary}
        {extraActions}
      </div>

      {/* Right section: Column Visibility */}
      <div className="flex items-center gap-2.5 ml-auto">
        {showColumns && columns.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setColumnsDropdownOpen((prev) => !prev)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                columnsDropdownOpen
                  ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'bg-white dark:bg-white/5 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 shadow-sm'
              }`}
            >
              <FiSliders className="text-sm" />
              <span>Columns</span>
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                {activeColumnsCount}/{columns.length}
              </span>
            </button>

            {/* Dropdown Popover */}
            {columnsDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white/40 dark:bg-slate-950/25 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-3 z-50 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-white/10">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                    <FiEye className="text-blue-500" />
                    <span>Columns Visibility</span>
                  </div>
                  {onResetColumns && (
                    <button
                      type="button"
                      onClick={onResetColumns}
                      title="Reset columns to default"
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <FiRotateCcw className="text-[10px]" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {/* Filter search if many columns */}
                {columns.length > 7 && (
                  <div className="mb-2">
                    <input
                      type="text"
                      placeholder="Find column..."
                      value={columnFilter}
                      onChange={(e) => setColumnFilter(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Columns List */}
                <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                  {filteredColumns.map((col) => {
                    const isVisible =
                      visibleColumns[col.id] !== undefined
                        ? visibleColumns[col.id]
                        : true;
                    const isLocked = col.alwaysVisible;

                    return (
                      <label
                        key={col.id}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${
                          isLocked
                            ? 'opacity-60 cursor-not-allowed bg-slate-50 dark:bg-white/5 text-slate-400'
                            : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isVisible}
                            disabled={isLocked}
                            onChange={(e) => {
                              if (!isLocked && onToggleColumn) {
                                onToggleColumn(col.id, e.target.checked);
                              }
                            }}
                            className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className={isVisible ? 'font-medium' : 'text-slate-400'}>
                            {col.label}
                          </span>
                        </div>
                        {isLocked ? (
                          <span className="text-[10px] text-slate-400 font-medium">Locked</span>
                        ) : isVisible ? (
                          <FiEye className="text-emerald-500 text-xs shrink-0" />
                        ) : (
                          <FiEyeOff className="text-slate-400 text-xs shrink-0" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TableToolbar;
