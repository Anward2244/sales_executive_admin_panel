import React, { forwardRef } from 'react';

/**
 * Standardized Input component for the admin panel.
 * Enforces unified heights (40px/32px), border radii (rounded-xl),
 * focus rings, typography, and dark mode palette.
 */
const Input = forwardRef(({
  label,
  error,
  helperText,
  icon: Icon,
  rightIcon: RightIcon,
  onRightIconClick,
  size = 'md',
  className = '',
  containerClassName = '',
  required = false,
  disabled = false,
  id,
  type = 'text',
  ...props
}, ref) => {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  const sizeClasses = {
    sm: 'h-8 px-2.5 text-xs',
    md: 'h-10 px-3.5 text-xs sm:text-sm',
    lg: 'h-11 px-4 text-sm'
  };

  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 select-none"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center justify-center text-sm">
            <Icon />
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          className={`w-full rounded-xl border font-normal transition-all duration-150 outline-hidden
            bg-white dark:bg-slate-900/80
            text-slate-900 dark:text-slate-100
            placeholder:text-slate-400 dark:placeholder:text-slate-500
            shadow-xs
            ${sizeClasses[size] || sizeClasses.md}
            ${Icon ? 'pl-9' : ''}
            ${RightIcon ? 'pr-9' : ''}
            ${
              error
                ? 'border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                : 'border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}
            ${className}`}
          {...props}
        />

        {RightIcon && (
          <button
            type="button"
            tabIndex={-1}
            onClick={onRightIconClick}
            className={`absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm flex items-center justify-center ${
              onRightIconClick ? 'cursor-pointer' : 'pointer-events-none'
            }`}
          >
            <RightIcon />
          </button>
        )}
      </div>

      {error ? (
        <p className="mt-1 text-xs text-rose-500 dark:text-rose-400 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
