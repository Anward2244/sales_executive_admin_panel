import React from 'react';

const PageHeader = ({
  title,
  icon: Icon,
  badgeIcon: BadgeIcon,
  badgeText,
  description,
  subtitle,
  action,
  actions,
  className = ''
}) => {
  const HeaderIcon = Icon || BadgeIcon;
  const headerText = description || subtitle;
  const headerAction = action || actions;

  return (
    <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative z-10 ${className}`}>
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            {HeaderIcon && <HeaderIcon className="text-blue-600 dark:text-blue-400 shrink-0" />}
            <span>{title}</span>
          </h1>
          {badgeText && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {badgeText}
            </span>
          )}
        </div>
        {headerText && (
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1.5 font-medium leading-relaxed">
            {headerText}
          </p>
        )}
      </div>
      {headerAction && <div className="shrink-0">{headerAction}</div>}
    </div>
  );
};

export default PageHeader;
