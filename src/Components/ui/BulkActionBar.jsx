import React from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiCheckSquare } from 'react-icons/fi';

const VARIANT_STYLES = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20',
  danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-500/20',
  warning: 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-500/20',
  info: 'bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-500/20',
  purple: 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-500/20',
  secondary: 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10'
};

const BulkActionBar = ({
  selectedCount = 0,
  totalCount = 0,
  onClear,
  onExit,
  actions = [],
  quickSelectors = []
}) => {
  return createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-4xl animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="bg-slate-900/90 dark:bg-slate-950/95 text-white backdrop-blur-2xl rounded-2xl p-3 sm:p-4 border border-white/20 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Count chip & Quick selectors */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="px-3 py-1 rounded-full text-xs font-black tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
              {selectedCount} SELECTED
            </span>
          </div>

          {/* Quick Selectors */}
          {quickSelectors && quickSelectors.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {quickSelectors.map((qs, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={qs.onClick}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  {qs.label}
                </button>
              ))}
            </div>
          )}
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

          {/* Clear / Exit Button */}
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer ml-1"
              title="Exit Bulk Mode"
            >
              Exit
            </button>
          )}

          {onClear && selectedCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
