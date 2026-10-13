import React from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiCheckSquare } from 'react-icons/fi';

const VARIANT_STYLES = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 active:scale-95',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 active:scale-95',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 active:scale-95',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/25 active:scale-95',
  info: 'bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/25 active:scale-95',
  purple: 'bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/25 active:scale-95',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 shadow-xs active:scale-95'
};

const BulkActionBar = ({
  selectedCount = 0,
  totalCount = 0,
  onClear,
  onClearSelection,
  onExit,
  onExitBulkMode,
  onSelectAll,
  isAllSelected = false,
  actions = [],
  quickSelectors = []
}) => {
  const handleClear = onClear || onClearSelection;
  const handleExit = onExit || onExitBulkMode;

  return createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-4xl animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="bg-white/90 dark:bg-slate-950/95 text-slate-800 dark:text-white backdrop-blur-2xl rounded-2xl p-3 sm:p-4 border border-slate-200/90 dark:border-white/10 shadow-2xl shadow-slate-900/15 dark:shadow-black/70 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Count chip & Quick selectors */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500 dark:bg-cyan-400" />
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-black tracking-wider bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 border border-cyan-500/30 font-mono shadow-xs">
              {selectedCount} SELECTED
            </span>
          </div>

          {/* Quick Selectors / Select All */}
          {quickSelectors && quickSelectors.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {quickSelectors.map((qs, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={qs.onClick}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200/90 text-slate-700 hover:text-slate-900 dark:bg-white/10 dark:hover:bg-white/20 dark:text-slate-300 dark:hover:text-white border border-slate-200/70 dark:border-white/10 transition-all cursor-pointer"
                >
                  {qs.label}
                </button>
              ))}
            </div>
          ) : onSelectAll ? (
            <button
              type="button"
              onClick={onSelectAll}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200/90 text-slate-700 hover:text-slate-900 dark:bg-white/10 dark:hover:bg-white/20 dark:text-slate-300 dark:hover:text-white border border-slate-200/70 dark:border-white/10 transition-all cursor-pointer flex items-center gap-1"
            >
              <FiCheckSquare size={12} className={isAllSelected ? 'text-cyan-600 dark:text-cyan-400' : ''} />
              <span>{isAllSelected ? 'Deselect All' : `Select All (${totalCount || ''})`}</span>
            </button>
          ) : null}
        </div>

        {/* Center/Right: Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
          {actions.map((act, idx) => {
            const Icon = act.icon;
            const style = VARIANT_STYLES[act.variant || 'primary'];
            return (
              <button
                key={idx}
                type="button"
                onClick={act.onClick}
                disabled={act.disabled || selectedCount === 0}
                title={act.tooltip}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${style}`}
              >
                {Icon && <Icon size={13} className="shrink-0" />}
                <span>{act.label}</span>
              </button>
            );
          })}

          {/* Divider if actions and exit/clear buttons coexist */}
          {(handleExit || (handleClear && selectedCount > 0)) && actions.length > 0 && (
            <div className="h-5 w-[1px] bg-slate-200 dark:bg-white/15 hidden sm:block mx-0.5" />
          )}

          {/* Clear / Exit Button */}
          {handleExit && (
            <button
              type="button"
              onClick={handleExit}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 dark:bg-white/10 dark:hover:bg-white/20 dark:text-slate-300 dark:hover:text-white border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer"
              title="Exit Bulk Mode"
            >
              Exit
            </button>
          )}

          {handleClear && selectedCount > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 dark:bg-white/10 dark:hover:bg-rose-500/20 dark:text-slate-400 dark:hover:text-rose-300 border border-slate-200/80 dark:border-white/10 transition-colors cursor-pointer"
              title="Clear Selection"
            >
              <FiX size={15} />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BulkActionBar;
