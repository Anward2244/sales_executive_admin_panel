import React, { useState, useEffect, useRef } from 'react';
import { FiClock } from 'react-icons/fi';

const CustomTimePicker = ({ value, onChange, label, align = 'right', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Parse HH:MM (24h) to 12h structure
  const parseTime = (timeVal) => {
    if (!timeVal) {
      return { hour12: 12, minute: 0, period: 'AM' };
    }
    const parts = timeVal.split(':');
    if (parts.length < 2) {
      return { hour12: 12, minute: 0, period: 'AM' };
    }
    const h24 = parseInt(parts[0], 10);
    const min = parseInt(parts[1], 10);

    const period = h24 >= 12 ? 'PM' : 'AM';
    const hour12 = h24 % 12 || 12;

    return { hour12, minute: min, period };
  };

  // Convert 12h structure to HH:MM (24h)
  const formatTime24 = (h12, min, prd) => {
    let h24 = h12 % 12;
    if (prd === 'PM') {
      h24 += 12;
    }
    const hh = String(h24).padStart(2, '0');
    const mm = String(min).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const { hour12, minute, period } = parseTime(value);

  const handleSelectHour = (h) => {
    const time24 = formatTime24(h, minute, period);
    onChange(time24);
  };

  const handleSelectMinute = (m) => {
    const time24 = formatTime24(hour12, m, period);
    onChange(time24);
  };

  const handleSelectPeriod = (p) => {
    const time24 = formatTime24(hour12, minute, p);
    onChange(time24);
  };

  const getDisplayValue = () => {
    if (!value) return '--:-- --';
    const formattedMin = String(minute).padStart(2, '0');
    return `${String(hour12).padStart(2, '0')}:${formattedMin} ${period}`;
  };

  // Lists
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 bg-slate-800/80 border border-white/10 hover:border-blue-500/35 hover:bg-slate-800 transition-all cursor-pointer rounded-xl px-3 py-2 w-full h-[38px]"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-bold uppercase select-none">{label}:</span>
          <span className="text-xs text-white font-bold font-mono min-w-[76px] text-left">
            {getDisplayValue()}
          </span>
        </div>
        <FiClock className="text-blue-400 hover:text-blue-300 transition-colors text-xs pointer-events-none" />
      </div>

      {/* Dropdown Popup */}
      {isOpen && (
        <div className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full mt-2 bg-slate-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-3 shadow-2xl w-60 z-50 animate-in fade-in zoom-in-95 duration-150 flex gap-3`}>
          {/* Hours column */}
          <div className="flex flex-col flex-1">
            <span className="text-[9px] font-black text-slate-500 uppercase text-center mb-1.5 select-none">Hour</span>
            <div className="flex flex-col gap-0.5 overflow-y-auto max-h-36 pr-1 no-scrollbar">
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => handleSelectHour(h)}
                  className={`py-1 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                    hour12 === h
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {String(h).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>

          {/* Minutes column */}
          <div className="flex flex-col flex-1">
            <span className="text-[9px] font-black text-slate-500 uppercase text-center mb-1.5 select-none">Min</span>
            <div className="flex flex-col gap-0.5 overflow-y-auto max-h-36 pr-1 no-scrollbar">
              {minutes.map((m) => {
                const minVal = parseInt(m, 10);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectMinute(minVal)}
                    className={`py-1 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                      minute === minVal
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AM/PM Period column */}
          <div className="flex flex-col justify-center gap-1.5 w-12 border-l border-white/10 pl-3">
            <button
              type="button"
              onClick={() => handleSelectPeriod('AM')}
              className={`py-2 text-xs font-black rounded-lg transition-all text-center cursor-pointer ${
                period === 'AM'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => handleSelectPeriod('PM')}
              className={`py-2 text-xs font-black rounded-lg transition-all text-center cursor-pointer ${
                period === 'PM'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              PM
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomTimePicker;
