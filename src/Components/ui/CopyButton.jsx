import React, { useState } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';

const CopyButton = ({ text, className = "text-slate-600 hover:text-slate-300", size = 12, title = "Copy ID" }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
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
      className={`${className} p-0.5 rounded transition-colors shrink-0 flex items-center justify-center`}
      title={copied ? "Copied!" : title}
    >
      {copied ? (
        <FiCheck className="text-emerald-400" size={size} />
      ) : (
        <FiCopy size={size} />
      )}
    </button>
  );
};

export default CopyButton;
