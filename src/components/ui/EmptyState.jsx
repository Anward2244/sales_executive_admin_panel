import React from 'react';
import { FiInbox, FiSearch, FiRefreshCw } from 'react-icons/fi';
import Card from './Card';

/**
 * Standardized EmptyState component.
 * Provides a clean, modern feedback state when lists, tables,
 * or search queries return no records.
 */
const EmptyState = ({
  icon: Icon = FiInbox,
  title = 'No records found',
  description = 'Try clearing your search query or switching active filter tabs.',
  actionText = 'Reset Filters',
  onAction,
  onReset,
  className = '',
  contained = true,
  children
}) => {
  const handleAction = onAction || onReset;

  const content = (
    <div className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 ${className}`}>
      {/* Icon Container */}
      <div className="w-14 h-14 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl border border-blue-500/20 shadow-xs mb-3.5 transition-transform hover:scale-105">
        <Icon />
      </div>

      {/* Title */}
      <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
        {title}
      </h4>

      {/* Description */}
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1.5 leading-relaxed">
          {description}
        </p>
      )}

      {/* Action Button */}
      {handleAction && (
        <button
          type="button"
          onClick={handleAction}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer active:scale-95"
        >
          <FiRefreshCw className="text-xs" />
          <span>{actionText}</span>
        </button>
      )}

      {children && <div className="mt-4">{children}</div>}
    </div>
  );

  if (contained) {
    return (
      <Card className="w-full">
        {content}
      </Card>
    );
  }

  return content;
};

export default EmptyState;
