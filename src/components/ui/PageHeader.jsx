import React from 'react';
import BackButton from './BackButton';

const PageHeader = ({
  title,
  icon: Icon,
  badgeIcon: BadgeIcon,
  badgeText,
  description,
  subtitle,
  action,
  actions,
  children,
  className = '',
  showBackButton = true
}) => {
  const HeaderIcon = Icon || BadgeIcon;
  const headerText = description || subtitle;
  const headerAction = action || actions || children;

  const renderIcon = () => {
    if (!HeaderIcon) return null;
    const sizeClass = headerText
      ? 'w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 text-blue-600 dark:text-blue-400 shrink-0'
      : 'w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-blue-600 dark:text-blue-400 shrink-0';

    if (React.isValidElement(HeaderIcon)) {
      return (
        <span className={`${sizeClass} flex items-center justify-center`}>
          {React.cloneElement(HeaderIcon, {
            className: `${HeaderIcon.props?.className || ''} w-full h-full`
          })}
        </span>
      );
    }
    return (
      <HeaderIcon
        className={sizeClass}
      />
    );
  };

  return (
    <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 relative z-10 ${className}`}>
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {showBackButton && <BackButton className="shrink-0" />}
        {renderIcon()}
        <div className="min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {title}
            </h1>
            {badgeText && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {badgeText}
              </span>
            )}
          </div>
          {headerText && (
            <p className="text-[11px] sm:text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1 font-medium leading-normal sm:leading-relaxed">
              {headerText}
            </p>
          )}
        </div>
      </div>
      {headerAction && <div className="shrink-0 w-full sm:w-auto">{headerAction}</div>}
    </div>
  );
};

export default PageHeader;