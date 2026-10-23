import React from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { useNavigationHistory } from '@/context/NavigationHistoryContext';

const BackButton = ({
  className = '',
  label = 'Back',
  title = 'Go back to previous page',
  forceVisible = false,
  onClick
}) => {
  const { canGoBack, goBack } = useNavigationHistory();

  if (!canGoBack && !forceVisible) {
    return null;
  }

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    } else {
      goBack();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={title || label}
      title={title || label}
      className={`group inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl
        bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10
        text-slate-700 dark:text-slate-200
        border border-slate-200/80 dark:border-white/10
        shadow-xs hover:border-slate-300 dark:hover:border-white/20
        transition-all duration-150 cursor-pointer active:scale-95 shrink-0 ${className}`}
    >
      <FiArrowLeft className="text-sm shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5 text-blue-600 dark:text-blue-400" />
      <span>{label}</span>
    </button>
  );
};

export default BackButton;
