import React, { useState } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';

const SIZE_MAP = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20
};

const getNumericSize = (size) => {
  if (typeof size === 'number' && !isNaN(size)) return size;
  if (typeof size === 'string') {
    if (SIZE_MAP[size.toLowerCase()]) return SIZE_MAP[size.toLowerCase()];
    const parsed = parseInt(size, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return 12;
};

const CopyButton = ({
  text,
  className = "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white",
  size = 12,
  title = "Copy to clipboard"
}) => {
  const [copied, setCopied] = useState(false);
  const numericSize = getNumericSize(size);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
        .catch((err) => {
          console.error("Failed to copy using clipboard API:", err);
        });
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textarea);
    }
  };

  return (
    <button 
      onClick={handleCopy}
      type="button"
      className={`${className} p-1 rounded-md transition-colors shrink-0 inline-flex items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10`}
      title={copied ? "Copied!" : title}
      style={{ width: numericSize + 10, height: numericSize + 10 }}
    >
      {copied ? (
        <FiCheck
          className="text-emerald-500 shrink-0"
          size={numericSize}
          style={{ width: `${numericSize}px`, height: `${numericSize}px` }}
        />
      ) : (
        <FiCopy
          className="shrink-0"
          size={numericSize}
          style={{ width: `${numericSize}px`, height: `${numericSize}px` }}
        />
      )}
    </button>
  );
};

export default CopyButton;
