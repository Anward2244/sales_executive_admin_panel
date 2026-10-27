import React from 'react';
import { FiLoader } from 'react-icons/fi';

/**
 * Standardized Button component for the admin panel.
 * Provides unified heights, border radii, focus rings, and active states.
 */
const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  isLoading = false,
  disabled = false,
  className = '',
  type = 'button',
  onClick,
  ...props
}) => {
  // 1. Unified Sizing (heights, padding, font size, border-radius)
  const sizeClasses = {
    sm: 'h-8 px-2.5 text-xs rounded-lg gap-1.5',
    md: 'h-10 px-3.5 text-xs sm:text-sm rounded-xl gap-2',
    lg: 'h-11 px-5 text-sm sm:text-base rounded-xl gap-2.5',
    icon: 'h-10 w-10 p-0 rounded-xl justify-center'
  };

  // 2. Unified Color Variants
  const variantClasses = {
    primary:
      'bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs hover:shadow-md hover:shadow-blue-500/20 active:scale-[0.98]',
    secondary:
      'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 font-semibold active:scale-[0.98]',
    outline:
      'border border-slate-300 dark:border-white/15 hover:border-blue-500 dark:hover:border-blue-400 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 font-semibold active:scale-[0.98]',
    danger:
      'bg-rose-500/10 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-rose-500/15 dark:hover:bg-rose-600 dark:text-rose-400 dark:hover:text-white border border-rose-500/20 font-semibold active:scale-[0.98]',
    ghost:
      'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 font-medium active:scale-[0.98]'
  };

  const isInteractiveDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isInteractiveDisabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 select-none cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 shrink-0 ${
        sizeClasses[size] || sizeClasses.md
      } ${variantClasses[variant] || variantClasses.primary} ${
        isInteractiveDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
      } ${className}`}
      {...props}
    >
      {isLoading ? (
        <FiLoader className="animate-spin text-current text-sm shrink-0" />
      ) : (
        Icon && iconPosition === 'left' && <Icon className="text-current text-sm shrink-0" />
      )}
      {children && <span className="truncate">{children}</span>}
      {!isLoading && Icon && iconPosition === 'right' && (
        <Icon className="text-current text-sm shrink-0" />
      )}
    </button>
  );
};

export default Button;
