import React from 'react';
import {
  FiCheckCircle,
  FiClock,
  FiTruck,
  FiXCircle,
  FiAlertCircle,
  FiCheck,
  FiSend,
  FiShield,
  FiUserCheck,
  FiUserX,
  FiBox
} from 'react-icons/fi';

/**
 * Standardized Status Badge configuration map.
 * Ensures consistent color palettes, border opacities, and icon associations
 * across all tables, drawers, detail views, and cards.
 */
const STATUS_CONFIGS = {
  // --- Purchase Orders & Dispatches ---
  APPROVED: {
    label: 'Approved',
    icon: FiCheckCircle,
    colorClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    dotClass: 'bg-emerald-500'
  },
  DISPATCHED: {
    label: 'Dispatched',
    icon: FiTruck,
    colorClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    dotClass: 'bg-blue-500'
  },
  DELIVERED: {
    label: 'Delivered',
    icon: FiCheck,
    colorClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    dotClass: 'bg-emerald-500'
  },
  PENDING: {
    label: 'Pending',
    icon: FiClock,
    colorClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    dotClass: 'bg-amber-500',
    pulse: true
  },
  REJECTED: {
    label: 'Rejected',
    icon: FiXCircle,
    colorClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    dotClass: 'bg-rose-500'
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: FiXCircle,
    colorClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
    dotClass: 'bg-slate-500'
  },

  // --- Email Notifications ---
  SENT: {
    label: 'Sent',
    icon: FiCheckCircle,
    colorClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    dotClass: 'bg-emerald-500'
  },
  FAILED: {
    label: 'Failed',
    icon: FiAlertCircle,
    colorClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    dotClass: 'bg-rose-500'
  },
  QUEUED: {
    label: 'Queued',
    icon: FiClock,
    colorClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    dotClass: 'bg-amber-500',
    pulse: true
  },

  // --- User / Account Statuses ---
  ACTIVE: {
    label: 'Active',
    icon: FiUserCheck,
    colorClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    dotClass: 'bg-emerald-500'
  },
  INACTIVE: {
    label: 'Inactive',
    icon: FiUserX,
    colorClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
    dotClass: 'bg-slate-400'
  },
  SUSPENDED: {
    label: 'Suspended',
    icon: FiAlertCircle,
    colorClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    dotClass: 'bg-rose-500'
  },

  // --- User Roles ---
  ADMIN: {
    label: 'Admin',
    icon: FiShield,
    colorClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    dotClass: 'bg-purple-500'
  },
  SALES_HEAD: {
    label: 'Sales Head',
    colorClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    dotClass: 'bg-indigo-500'
  },
  SALES_EXECUTIVE: {
    label: 'Sales Executive',
    colorClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    dotClass: 'bg-blue-500'
  },
  BILLING: {
    label: 'Billing',
    colorClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    dotClass: 'bg-emerald-500'
  },
  WAREHOUSE: {
    label: 'Warehouse',
    colorClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    dotClass: 'bg-amber-500'
  }
};

const VARIANT_CONFIGS = {
  success: {
    colorClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    dotClass: 'bg-emerald-500'
  },
  warning: {
    colorClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    dotClass: 'bg-amber-500'
  },
  danger: {
    colorClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    dotClass: 'bg-rose-500'
  },
  info: {
    colorClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    dotClass: 'bg-blue-500'
  },
  purple: {
    colorClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    dotClass: 'bg-purple-500'
  },
  neutral: {
    colorClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
    dotClass: 'bg-slate-400'
  }
};

const SIZE_CLASSES = {
  xs: 'px-2 py-0.5 text-[10px] gap-1',
  sm: 'px-2.5 py-1 text-xs gap-1.5',
  md: 'px-3 py-1 text-xs gap-1.5 font-bold',
  lg: 'px-3.5 py-1.5 text-sm gap-2 font-bold'
};

const StatusBadge = ({
  status,
  variant,
  label,
  icon: CustomIcon,
  showIcon = true,
  dot = false,
  size = 'sm',
  className = '',
  ...props
}) => {
  const normKey = (status || '').toUpperCase();
  const config = STATUS_CONFIGS[normKey] || {};
  const variantConfig = variant ? VARIANT_CONFIGS[variant] : null;

  const colorClass = variantConfig?.colorClass || config.colorClass || 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20';
  const dotColorClass = variantConfig?.dotClass || config.dotClass || 'bg-slate-400';
  const displayLabel = label || config.label || (status ? String(status).replace(/_/g, ' ') : 'N/A');
  const IconComponent = CustomIcon !== undefined ? CustomIcon : (showIcon ? config.icon : null);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  const isPulse = config.pulse || false;

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold border tracking-wide uppercase shrink-0 transition-colors shadow-xs ${colorClass} ${sizeClass} ${className}`}
      {...props}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {isPulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColorClass}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColorClass}`} />
        </span>
      )}
      {IconComponent && <IconComponent className="shrink-0 text-current text-[11px]" />}
      <span className="truncate">{displayLabel}</span>
    </span>
  );
};

export default StatusBadge;
