import React from 'react';
import { FiMail } from 'react-icons/fi';
import { getGmailComposeUrl } from '@/utils/emailUtils';
import CopyButton from './CopyButton';

const GmailLink = ({
  email,
  children,
  className = '',
  showIcon = false,
  iconClassName = 'text-slate-400 dark:text-slate-500',
  iconSize = 14,
  title,
  showCopy = true,
  copySize = 11,
  copyClassName = 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors',
  containerClassName = 'inline-flex items-center gap-1.5 max-w-full',
}) => {
  if (!email) return <span className="text-slate-400 dark:text-slate-500">N/A</span>;

  const url = getGmailComposeUrl(email);

  return (
    <span className={containerClassName}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={title || `Send email to ${email} via Gmail`}
        className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer min-w-0 ${className || 'text-slate-700 dark:text-slate-300'}`}
      >
        {showIcon && <FiMail size={iconSize} className={`shrink-0 ${iconClassName}`} />}
        <span className="truncate">{children || email}</span>
      </a>
      {showCopy && (
        <CopyButton
          text={email}
          size={copySize}
          className={copyClassName}
          title="Copy email"
        />
      )}
    </span>
  );
};

export default GmailLink;
