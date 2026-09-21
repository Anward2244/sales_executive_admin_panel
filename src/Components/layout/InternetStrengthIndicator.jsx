import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiWifi, FiWifiOff, FiRefreshCw, FiActivity, FiZap } from 'react-icons/fi';

const InternetStrengthIndicator = ({ compact = true, className = '' }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [latency, setLatency] = useState(null);
  const [downlink, setDownlink] = useState(null);
  const [effectiveType, setEffectiveType] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const popoverRef = useRef(null);

  const measureNetwork = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false);
      setLatency(null);
      return;
    }

    setIsOnline(true);
    setIsTesting(true);

    // Read Network Information API if supported
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      if (conn.downlink !== undefined) setDownlink(conn.downlink);
      if (conn.effectiveType) setEffectiveType(conn.effectiveType.toUpperCase());
    }

    // Measure active latency via cache-busted fetch
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      await fetch(`/?_ping=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const rtt = Math.round(performance.now() - start);
      setLatency(rtt);
      setLastChecked(new Date());
    } catch {
      if (!navigator.onLine) {
        setIsOnline(false);
        setLatency(null);
      } else {
        // High latency fallback if fetch took long or timed out
        setLatency(conn?.rtt || 999);
      }
    } finally {
      setIsTesting(false);
    }
  }, []);

  useEffect(() => {
    measureNetwork();

    const handleOnline = () => {
      setIsOnline(true);
      measureNetwork();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLatency(null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      conn.addEventListener('change', measureNetwork);
    }

    // Periodic ping check every 20 seconds (only when tab is active/visible)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        measureNetwork();
      }
    }, 20000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        measureNetwork();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (conn) {
        conn.removeEventListener('change', measureNetwork);
      }
      clearInterval(interval);
    };
  }, [measureNetwork]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Compute strength level: 0 (offline), 1 (poor), 2 (fair), 3 (good), 4 (excellent)
  const getStrengthInfo = () => {
    if (!isOnline) {
      return {
        level: 0,
        bars: 0,
        label: 'Offline',
        color: 'text-rose-500 dark:text-rose-400',
        barColor: 'bg-rose-500',
        badgeBg: 'bg-rose-500/10 border-rose-500/20 text-rose-500 dark:text-rose-400',
        dotColor: 'bg-rose-500'
      };
    }

    if (latency === null) {
      return {
        level: 3,
        bars: 3,
        label: 'Checking...',
        color: 'text-blue-500 dark:text-blue-400',
        barColor: 'bg-blue-500',
        badgeBg: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
        dotColor: 'bg-blue-500'
      };
    }

    if (latency < 100) {
      return {
        level: 4,
        bars: 4,
        label: 'Excellent',
        color: 'text-emerald-600 dark:text-emerald-400',
        barColor: 'bg-emerald-500',
        badgeBg: 'bg-emerald-500/50 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
        dotColor: 'bg-emerald-500'
      };
    }

    if (latency < 250) {
      return {
        level: 3,
        bars: 3,
        label: 'Good',
        color: 'text-emerald-500/50 dark:text-emerald-400',
        barColor: 'bg-emerald-500/50',
        badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 dark:text-emerald-400',
        dotColor: 'bg-emerald-500'
      };
    }

    if (latency < 500) {
      return {
        level: 2,
        bars: 2,
        label: 'Fair',
        color: 'text-amber-500 dark:text-amber-400',
        barColor: 'bg-amber-500',
        badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
        dotColor: 'bg-amber-500'
      };
    }

    return {
      level: 1,
      bars: 1,
      label: 'Poor',
      color: 'text-rose-500 dark:text-rose-400',
      barColor: 'bg-rose-500',
      badgeBg: 'bg-rose-500/10 border-rose-500/20 text-rose-500 dark:text-rose-400',
      dotColor: 'bg-rose-500'
    };
  };

  const strength = getStrengthInfo();

  return (
    <div className={`relative inline-block z-40 ${className}`} ref={popoverRef}>
      {compact ? (
        /* Header Icon Button (beside Bell icon) */
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title={`Internet: ${strength.label}${latency !== null ? ` (${latency}ms)` : ''} - Click for details`}
          className="relative p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus:outline-none cursor-pointer flex items-center justify-center select-none"
        >
          {isOnline ? (
            <FiWifi className={`text-xl ${strength.color} transition-colors`} />
          ) : (
            <FiWifiOff className="text-xl text-rose-500 animate-pulse transition-colors" />
          )}

          {/* Small Status Dot */}
          <span
            className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-slate-900 ${strength.dotColor} ${
              !isOnline ? 'animate-ping' : ''
            }`}
          />
        </button>
      ) : (
        /* Expanded Pill Button */
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Click to view network details"
          className="bg-white/80 dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-white/10 px-3.5 py-2 rounded-2xl flex items-center gap-2.5 shadow-xs dark:shadow-lg shrink-0 cursor-pointer transition-all active:scale-95 select-none"
        >
          {/* Signal Bars Visual */}
          <div className="flex items-end gap-[2px] h-3.5 px-0.5" aria-hidden="true">
            <span
              className={`w-1 rounded-xs transition-all duration-300 ${
                strength.bars >= 1 ? strength.barColor : 'bg-slate-300 dark:bg-slate-700'
              }`}
              style={{ height: '30%' }}
            />
            <span
              className={`w-1 rounded-xs transition-all duration-300 ${
                strength.bars >= 2 ? strength.barColor : 'bg-slate-300 dark:bg-slate-700'
              }`}
              style={{ height: '52%' }}
            />
            <span
              className={`w-1 rounded-xs transition-all duration-300 ${
                strength.bars >= 3 ? strength.barColor : 'bg-slate-300 dark:bg-slate-700'
              }`}
              style={{ height: '76%' }}
            />
            <span
              className={`w-1 rounded-xs transition-all duration-300 ${
                strength.bars >= 4 ? strength.barColor : 'bg-slate-300 dark:bg-slate-700'
              }`}
              style={{ height: '100%' }}
            />
          </div>

          {/* Wifi Icon */}
          {isOnline ? (
            <FiWifi className={`text-sm ${strength.color}`} />
          ) : (
            <FiWifiOff className="text-sm text-rose-500 dark:text-rose-400" />
          )}

          {/* Text & Latency info */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`font-bold hidden sm:inline ${strength.color}`}>
              {strength.label}
            </span>
            {latency !== null && isOnline && (
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold">
                {latency}ms
              </span>
            )}
          </div>
        </button>
      )}

      {/* Popover Details Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-xl ${strength.badgeBg}`}>
                {isOnline ? <FiWifi size={15} /> : <FiWifiOff size={15} />}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Internet Connection</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Real-time signal monitor</p>
              </div>
            </div>

            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${strength.badgeBg}`}>
              {strength.label}
            </span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block flex items-center gap-1">
                <FiActivity size={11} className="text-blue-500" /> Latency / Ping
              </span>
              <p className="text-sm font-black font-mono text-slate-800 dark:text-white mt-1">
                {isOnline && latency !== null ? `${latency} ms` : isOnline ? 'Measuring...' : 'N/A'}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block flex items-center gap-1">
                <FiZap size={11} className="text-amber-500" /> Speed / Type
              </span>
              <p className="text-sm font-black font-mono text-slate-800 dark:text-white mt-1">
                {downlink ? `${downlink} Mbps` : effectiveType || (isOnline ? 'Online' : 'Offline')}
              </p>
            </div>
          </div>

          {/* Footer with Refresh Button */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 dark:border-white/10 text-[11px]">
            <span className="text-slate-400 dark:text-slate-500 text-[10px]">
              {lastChecked ? `Checked ${lastChecked.toLocaleTimeString()}` : 'Live monitoring'}
            </span>

            <button
              type="button"
              onClick={measureNetwork}
              disabled={isTesting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              <FiRefreshCw size={11} className={isTesting ? 'animate-spin' : ''} />
              {isTesting ? 'Testing...' : 'Test Ping'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternetStrengthIndicator;
