import React from 'react';

// Base pulse block with subtle shimmer styling
export const SkeletonPulse = ({ className = '', ...props }) => {
  return (
    <div
      className={`bg-slate-200/70 dark:bg-white/[0.06] rounded-lg animate-pulse ${className}`}
      {...props}
    />
  );
};

export const Skeleton = SkeletonPulse;

// Single row skeleton for <tbody> or standalone list
export const TableRowSkeleton = ({ columns = 5, cols, isTableRow = true }) => {
  const colCount = cols || columns;
  const widths = ['w-10', 'w-48', 'w-32', 'w-24', 'w-36', 'w-28', 'w-20', 'w-16'];

  if (isTableRow) {
    return (
      <tr className="border-b border-slate-200/60 dark:border-white/5 animate-pulse">
        {Array.from({ length: colCount }).map((_, c) => (
          <td key={c} className="p-4 whitespace-nowrap">
            <SkeletonPulse
              className={`h-4 ${widths[c % widths.length] || 'w-1/3'}`}
            />
          </td>
        ))}
      </tr>
    );
  }

  return (
    <div className="flex gap-4 p-4 items-center border-b border-slate-200/60 dark:border-white/5 animate-pulse">
      {Array.from({ length: colCount }).map((_, c) => (
        <SkeletonPulse
          key={c}
          className={`h-4 ${widths[c % widths.length] || 'w-1/3'}`}
        />
      ))}
    </div>
  );
};

// Full table skeleton with styled header and multiple rows
export const TableSkeleton = ({ columns = 6, rows = 6, showHeader = true, className = '' }) => {
  const colCount = columns;

  return (
    <div className={`w-full overflow-hidden bg-white/40 dark:bg-slate-900/40 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs ${className}`}>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          {showHeader && (
            <thead className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-white/10">
              <tr>
                {Array.from({ length: colCount }).map((_, c) => (
                  <th key={c} className="p-4">
                    <SkeletonPulse className="h-3.5 w-24" />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
            {Array.from({ length: rows }).map((_, r) => (
              <TableRowSkeleton key={r} cols={colCount} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Metric / KPI stat cards skeleton
export const KPISkeleton = ({ cards = 4, className = '' }) => {
  const gridCols =
    cards === 5
      ? 'lg:grid-cols-5'
      : cards === 3
      ? 'lg:grid-cols-3'
      : cards === 6
      ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
      : 'lg:grid-cols-4';

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${gridCols} gap-4 ${className}`}>
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xs dark:shadow-none animate-pulse"
        >
          <div className="flex items-center justify-between mb-3">
            <SkeletonPulse className="w-10 h-10 rounded-xl" />
            <SkeletonPulse className="w-5 h-5 rounded-md" />
          </div>
          <div className="space-y-2">
            <SkeletonPulse className="h-3 w-1/2" />
            <SkeletonPulse className="h-7 w-3/4" />
            <SkeletonPulse className="h-2.5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
};

// Card Grid skeleton (for products, categories, search results)
export const CardGridSkeleton = ({ cards = 8, cols = 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4', className = '' }) => {
  return (
    <div className={`grid ${cols} gap-4 sm:gap-5 ${className}`}>
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="bg-white/50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 space-y-4 animate-pulse shadow-xs"
        >
          <SkeletonPulse className="h-36 w-full rounded-xl" />
          <div className="space-y-2">
            <SkeletonPulse className="h-5 w-3/4" />
            <SkeletonPulse className="h-3.5 w-1/2" />
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
            <SkeletonPulse className="h-4 w-20" />
            <SkeletonPulse className="h-8 w-16 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
};

// Chart Card Skeleton (for Trend Chart, Donut Chart, etc.)
export const ChartCardSkeleton = ({ height = 320 }) => {
  return (
    <div className="w-full space-y-4 animate-pulse">
      <div
        style={{ height }}
        className="w-full rounded-2xl bg-slate-100/50 dark:bg-white/[0.02] border border-dashed border-slate-200/80 dark:border-white/10 flex flex-col justify-end p-6 gap-3"
      >
        <div className="flex items-end justify-between gap-2 h-full pb-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="w-full bg-slate-200/80 dark:bg-white/10 rounded-t-lg transition-all"
              style={{ height: `${20 + ((i * 19) % 70)}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between pt-2 border-t border-slate-200/60 dark:border-white/5">
          <SkeletonPulse className="h-2.5 w-12" />
          <SkeletonPulse className="h-2.5 w-12" />
          <SkeletonPulse className="h-2.5 w-12" />
          <SkeletonPulse className="h-2.5 w-12" />
        </div>
      </div>
    </div>
  );
};

// Donut Chart Skeleton
export const DonutChartSkeleton = ({ height = 230 }) => {
  return (
    <div
      style={{ height }}
      className="w-full flex items-center justify-center animate-pulse"
    >
      <div className="relative flex items-center justify-center">
        <div className="w-36 h-36 rounded-full border-8 border-slate-200/70 dark:border-white/10 border-t-blue-500/40 border-r-cyan-400/40" />
        <div className="absolute flex flex-col items-center">
          <SkeletonPulse className="h-5 w-14 mb-1" />
          <SkeletonPulse className="h-3 w-10" />
        </div>
      </div>
    </div>
  );
};

// Treemap / Tree View Skeleton
export const TreemapSkeleton = ({ height = 520 }) => {
  return (
    <div
      style={{ height }}
      className="w-full rounded-2xl bg-slate-100/40 dark:bg-white/[0.02] border border-dashed border-slate-200/80 dark:border-white/10 p-8 flex items-center animate-pulse overflow-hidden relative"
    >
      <div className="flex items-center gap-12 w-full">
        {/* Root */}
        <div className="flex flex-col items-center">
          <SkeletonPulse className="w-14 h-14 rounded-2xl mb-2" />
          <SkeletonPulse className="h-3 w-20" />
        </div>

        {/* Branch Level 1 */}
        <div className="flex flex-col gap-6 flex-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-8">
              <SkeletonPulse className="h-10 w-36 rounded-xl shrink-0" />
              <div className="flex items-center gap-4 flex-1">
                <SkeletonPulse className="h-8 w-28 rounded-lg" />
                <SkeletonPulse className="h-8 w-28 rounded-lg" />
                <SkeletonPulse className="h-8 w-24 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Profile & Details Skeleton
export const ProfileSkeleton = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse">
      {/* Left Identity Hero Card */}
      <div className="lg:col-span-4 bg-white/40 dark:bg-slate-900/60 rounded-3xl p-6 border border-slate-200/80 dark:border-white/10 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <SkeletonPulse className="w-24 h-24 rounded-3xl" />
          <SkeletonPulse className="h-6 w-40" />
          <SkeletonPulse className="h-4 w-48" />
          <div className="flex gap-2">
            <SkeletonPulse className="h-6 w-20 rounded-full" />
            <SkeletonPulse className="h-6 w-20 rounded-full" />
          </div>
        </div>
        <div className="border-t border-slate-200/80 dark:border-white/10 pt-4 space-y-3">
          <SkeletonPulse className="h-10 w-full rounded-xl" />
          <SkeletonPulse className="h-10 w-full rounded-xl" />
          <SkeletonPulse className="h-10 w-full rounded-xl" />
        </div>
      </div>

      {/* Right Details Card */}
      <div className="lg:col-span-8 bg-white/40 dark:bg-slate-900/60 rounded-3xl p-6 border border-slate-200/80 dark:border-white/10 space-y-6">
        <div className="flex gap-3 border-b border-slate-200/80 dark:border-white/10 pb-4">
          <SkeletonPulse className="h-8 w-28 rounded-lg" />
          <SkeletonPulse className="h-8 w-28 rounded-lg" />
          <SkeletonPulse className="h-8 w-28 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonPulse className="h-3.5 w-24" />
              <SkeletonPulse className="h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonPulse;
