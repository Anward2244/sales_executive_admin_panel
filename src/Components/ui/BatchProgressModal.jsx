import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiPlay, FiCheckCircle, FiXCircle, FiX, FiDownload } from 'react-icons/fi';

const BatchProgressModal = ({
  isOpen,
  taskTitle,
  total = 0,
  current = 0,
  successCount = 0,
  failureCount = 0,
  logs = [],
  isFinished = false,
  onAbort,
  onClose
}) => {
  const logContainerRef = useRef(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  const downloadLogs = () => {
    const logContent = logs.map((l) => `[${l.time}] ${l.text}`).join('\n');
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Batch_Job_${Date.now()}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg border border-blue-500/20">
              <FiPlay className={isFinished ? '' : 'animate-spin'} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {taskTitle || 'Executing Batch Operation'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isFinished ? 'Batch operation completed.' : `Processing ${current} of ${total} items...`}
              </p>
            </div>
          </div>

          {isFinished && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              <FiX size={16} />
            </button>
          )}
        </div>

        {/* Progress Bar & Counters */}
        <div className="p-4 bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/10 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className="text-slate-700 dark:text-slate-300">{pct}% COMPLETED</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-emerald-500 flex items-center gap-1 font-bold">
                <FiCheckCircle size={13} /> {successCount} Succeeded
              </span>
              {failureCount > 0 && (
                <span className="text-rose-500 flex items-center gap-1 font-bold">
                  <FiXCircle size={13} /> {failureCount} Failed
                </span>
              )}
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Streaming Logs Console */}
        <div
          ref={logContainerRef}
          className="p-4 bg-slate-950 font-mono text-[11px] text-slate-300 overflow-y-auto flex-1 space-y-1.5 min-h-[180px] max-h-[260px]"
        >
          {logs.map((l, index) => (
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
              <span>{l.text}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={downloadLogs}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <FiDownload size={13} />
            <span>Download Log</span>
          </button>

          {!isFinished ? (
            <button
              type="button"
              onClick={onAbort}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer"
            >
              Abort
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md cursor-pointer"
            >
              Done & Refresh
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BatchProgressModal;
