import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiPlay, FiCheckCircle, FiXCircle, FiX, FiDownload } from 'react-icons/fi';

const BatchProgressModal = ({
  isOpen,
  title,
  taskTitle,
  total = 0,
  current = 0,
  percentage,
  successCount = 0,
  failureCount = 0,
  logs = [],
  status,
  isFinished = false,
  onAbort,
  onClose
}) => {
  const logContainerRef = useRef(null);

  const displayTitle = title || taskTitle || 'Executing Batch Operation';

  // Normalize finish status across various usages
  const isFinishedResolved = Boolean(
    isFinished ||
    status === 'completed' ||
    status === 'error' ||
    (total > 0 && current >= total)
  );

  const pct = percentage !== undefined
    ? Math.min(100, Math.max(0, percentage))
    : (total > 0 ? Math.min(100, Math.round((current / total) * 100)) : (isFinishedResolved ? 100 : 0));

  // Normalize logs whether array of strings or array of { time, text, type }
  const parsedLogs = (logs || []).map((l) => {
    if (typeof l === 'string') {
      const isSuccess = l.includes('✓') || l.toLowerCase().includes('success') || l.toLowerCase().includes('completed');
      const isError = l.includes('✗') || l.toLowerCase().includes('fail') || l.toLowerCase().includes('error');
      return {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        text: l,
        type: isSuccess ? 'success' : isError ? 'error' : 'info'
      };
    }
    return {
      time: l?.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text: l?.text || l?.message || JSON.stringify(l),
      type: l?.type || 'info'
    };
  });

  const effectiveSuccessCount = successCount || parsedLogs.filter((l) => l.type === 'success').length;
  const effectiveFailureCount = failureCount || parsedLogs.filter((l) => l.type === 'error').length;

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const downloadLogs = () => {
    const logContent = parsedLogs.map((l) => `[${l.time}] [${(l.type || 'info').toUpperCase()}] ${l.text}`).join('\n');
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Batch_Job_${Date.now()}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && isFinishedResolved) {
      onClose?.();
    }
  };

  const handleHeaderClose = () => {
    if (!isFinishedResolved && onAbort) {
      onAbort();
    }
    onClose?.();
  };

  return createPortal(
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg border transition-all ${
              isFinishedResolved
                ? (status === 'error' || (effectiveFailureCount > 0 && effectiveSuccessCount === 0)
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20')
                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
            }`}>
              {isFinishedResolved ? (
                status === 'error' || (effectiveFailureCount > 0 && effectiveSuccessCount === 0) ? (
                  <FiXCircle />
                ) : (
                  <FiCheckCircle />
                )
              ) : (
                <FiPlay className="animate-spin" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {displayTitle}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isFinishedResolved
                  ? (status === 'error' ? 'Batch operation stopped or encountered errors.' : 'Batch operation completed.')
                  : `Processing ${current} of ${total} items (${pct}%)...`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleHeaderClose}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer transition-all"
            title={isFinishedResolved ? 'Close' : 'Cancel & Close'}
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Progress Bar & Counters */}
        <div className="p-4 bg-slate-50/70 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/10 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className="text-slate-700 dark:text-slate-300">
              {pct}% {isFinishedResolved ? 'DONE' : 'COMPLETED'}
            </span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-emerald-500 flex items-center gap-1 font-bold">
                <FiCheckCircle size={13} /> {effectiveSuccessCount} Succeeded
              </span>
              {effectiveFailureCount > 0 && (
                <span className="text-rose-500 flex items-center gap-1 font-bold">
                  <FiXCircle size={13} /> {effectiveFailureCount} Failed
                </span>
              )}
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${
                status === 'error'
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Streaming Logs Console */}
        <div
          ref={logContainerRef}
          className="p-4 bg-slate-950 font-mono text-[11px] text-slate-300 overflow-y-auto flex-1 space-y-1.5 min-h-[180px] max-h-[260px] select-text"
        >
          {parsedLogs.length === 0 ? (
            <div className="text-slate-500 italic">Waiting for batch operations...</div>
          ) : (
            parsedLogs.map((l, index) => (
              <div
                key={index}
                className={`flex items-start gap-2 leading-relaxed ${
                  l.type === 'success'
                    ? 'text-emerald-400'
                    : l.type === 'error'
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                <span className="text-slate-600 shrink-0">[{l.time}]</span>
                <span className="break-all">{l.text}</span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between bg-slate-50/70 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={downloadLogs}
            disabled={parsedLogs.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer disabled:opacity-40"
          >
            <FiDownload size={13} />
            <span>Download Log</span>
          </button>

          {!isFinishedResolved ? (
            <button
              type="button"
              onClick={onAbort}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer"
            >
              Abort Execution
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5"
            >
              <FiCheckCircle size={14} />
              <span>Done & Close</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BatchProgressModal;
