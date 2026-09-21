import React from 'react';

export const SkeletonPulse = ({ className = '', ...props }) => {
  return (
    <div 
      className={`bg-slate-200/70 dark:bg-white/5 rounded-lg animate-pulse ${className}`} 
      {...props}
    />
  );
};

export const TableRowSkeleton = ({ columns = 5, rows = 5 }) => {
  return (
    <div className="w-full space-y-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 p-4 items-center border-b border-slate-200/80 dark:border-white/5">
          {Array.from({ length: columns }).map((_, c) => (
            <SkeletonPulse 
              key={c} 
              className={`h-4 ${
                c === 0 ? 'w-10' : c === 1 ? 'w-1/4' : c === 2 ? 'w-1/3' : 'w-1/6'
              }`} 
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardGridSkeleton = ({ cards = 4 }) => {
  const gridCols = cards === 5 ? 'lg:grid-cols-5' : cards === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4';
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols} gap-6`}>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="bg-white/40 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 space-y-4 animate-pulse">
          <SkeletonPulse className="h-40 w-full rounded-2xl" />
          <SkeletonPulse className="h-6 w-3/4" />
          <SkeletonPulse className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
};

export const KPISkeleton = ({ cards = 4 }) => {
  const gridCols = cards === 5 ? 'lg:grid-cols-5' : cards === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4';
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${gridCols} gap-4`}>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 flex items-center justify-between animate-pulse shadow-xs dark:shadow-none">
          <div className="space-y-2 flex-1">
            <SkeletonPulse className="h-3 w-1/2" />
            <SkeletonPulse className="h-7 w-1/3" />
          </div>
          <SkeletonPulse className="w-12 h-12 rounded-2xl" />
        </div>
      ))}
    </div>
  );
};

export default SkeletonPulse;
