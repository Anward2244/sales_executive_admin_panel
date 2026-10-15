import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FiCheckCircle,
  FiAlertCircle,
  FiAlertTriangle,
  FiInfo,
  FiX,
  FiRotateCcw
} from 'react-icons/fi';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Individual Toast Card Component with progress bar and undo support
const ToastItem = ({ toast, onDismiss }) => {
  const { id, message, type = 'info', duration = 4500, onUndo, undoText = 'Undo', title } = toast;
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const remainingTimeRef = useRef(duration);
  const lastTickRef = useRef(Date.now());

  useEffect(() => {
    if (duration <= 0 || duration === Infinity) return;

    lastTickRef.current = Date.now();
    const interval = setInterval(() => {
      if (!isPaused) {
        const now = Date.now();
        const elapsed = now - lastTickRef.current;
        lastTickRef.current = now;

        remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
        const percent = (remainingTimeRef.current / duration) * 100;
        setProgress(percent);

        if (remainingTimeRef.current <= 0) {
          clearInterval(interval);
          onDismiss(id);
        }
      } else {
        lastTickRef.current = Date.now();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [id, duration, isPaused, onDismiss]);

  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => {
    lastTickRef.current = Date.now();
    setIsPaused(false);
  };

  const handleUndo = (e) => {
    e.stopPropagation();
    if (typeof onUndo === 'function') {
      try {
        onUndo();
      } catch (err) {
        console.error('Error executing toast undo:', err);
      }
    }
    onDismiss(id);
  };

  // Type-specific styling
  const config = {
    success: {
      icon: <FiCheckCircle className="text-emerald-500 text-lg shrink-0" />,
      border: 'border-emerald-500/30 dark:border-emerald-500/40',
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
      glow: 'shadow-emerald-500/15',
      progressBar: 'bg-emerald-500',
      tag: 'Success'
    },
    error: {
      icon: <FiAlertCircle className="text-rose-500 text-lg shrink-0" />,
      border: 'border-rose-500/30 dark:border-rose-500/40',
      bg: 'bg-rose-500/10 dark:bg-rose-500/15',
      glow: 'shadow-rose-500/15',
      progressBar: 'bg-rose-500',
      tag: 'Error'
    },
    warning: {
      icon: <FiAlertTriangle className="text-amber-500 text-lg shrink-0" />,
      border: 'border-amber-500/30 dark:border-amber-500/40',
      bg: 'bg-amber-500/10 dark:bg-amber-500/15',
      glow: 'shadow-amber-500/15',
      progressBar: 'bg-amber-500',
      tag: 'Warning'
    },
    info: {
      icon: <FiInfo className="text-blue-500 text-lg shrink-0" />,
      border: 'border-blue-500/30 dark:border-blue-500/40',
      bg: 'bg-blue-500/10 dark:bg-blue-500/15',
      glow: 'shadow-blue-500/15',
      progressBar: 'bg-blue-500',
      tag: 'Info'
    }
  }[type] || {
    icon: <FiInfo className="text-blue-500 text-lg shrink-0" />,
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
    glow: 'shadow-blue-500/15',
    progressBar: 'bg-blue-500',
    tag: 'Notice'
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="alert"
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border ${config.border} bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl ${config.glow} transition-all duration-300 animate-in fade-in slide-in-from-top-3 flex flex-col p-3.5 sm:p-4 text-slate-800 dark:text-slate-100 min-w-[280px] max-w-sm sm:max-w-md w-full`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl shrink-0 ${config.bg}`}>
          {config.icon}
        </div>

        <div className="flex-1 min-w-0 pr-1">
          {title && (
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
              {title}
            </p>
          )}
          <div className="text-xs sm:text-sm font-medium leading-relaxed break-words">
            {message}
          </div>

          {onUndo && (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleUndo}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                <FiRotateCcw className="text-[11px]" />
                <span>{undoText}</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(id)}
          aria-label="Dismiss notification"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0 -mr-1 -mt-1"
        >
          <FiX className="text-sm" />
        </button>
      </div>

      {/* Progress bar timer */}
      {duration > 0 && duration !== Infinity && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200/40 dark:bg-white/5 overflow-hidden">
          <div
            className={`h-full ${config.progressBar} transition-[width] ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clear = useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = useCallback((message, options = {}) => {
    const id = options.id || `toast-${Date.now()}-${counterRef.current++}`;
    const newToast = {
      id,
      message,
      type: options.type || 'info',
      duration: options.duration !== undefined ? options.duration : 4500,
      onUndo: options.onUndo,
      undoText: options.undoText || 'Undo',
      title: options.title,
      ...options
    };

    setToasts((prev) => {
      // Avoid duplicate identical message within 500ms
      const filtered = prev.filter((t) => t.id !== id);
      // Keep max 5 visible toasts to avoid viewport clutter
      if (filtered.length >= 5) {
        return [...filtered.slice(filtered.length - 4), newToast];
      }
      return [...filtered, newToast];
    });

    return id;
  }, []);

  const toast = useCallback(
    (message, options) => addToast(message, options),
    [addToast]
  );

  toast.success = useCallback(
    (message, options) => addToast(message, { ...options, type: 'success' }),
    [addToast]
  );

  toast.error = useCallback(
    (message, options) => addToast(message, { ...options, type: 'error' }),
    [addToast]
  );

  toast.info = useCallback(
    (message, options) => addToast(message, { ...options, type: 'info' }),
    [addToast]
  );

  toast.warning = useCallback(
    (message, options) => addToast(message, { ...options, type: 'warning' }),
    [addToast]
  );

  toast.dismiss = dismiss;
  toast.clear = clear;

  return (
    <ToastContext.Provider value={{ toast, dismiss, clear }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <aside
            aria-live="polite"
            className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none p-2 sm:p-0"
          >
            {toasts.map((item) => (
              <ToastItem key={item.id} toast={item} onDismiss={dismiss} />
            ))}
          </aside>,
          document.body
        )}
    </ToastContext.Provider>
  );
};

export default ToastContext;
