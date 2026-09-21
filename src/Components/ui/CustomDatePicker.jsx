import { useState, useEffect, useRef } from 'react';
import { FiChevronLeft, FiChevronRight, FiCalendar } from 'react-icons/fi';

const CustomDatePicker = ({ value, onChange, min, max, label, align = 'right', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse current value or default to today
  const currentDate = value ? new Date(value) : new Date();
  const [viewDate, setViewDate] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));

  // Sync viewDate when value changes
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [value]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleDayClick = (day, e) => {
    e.stopPropagation();
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    // Create date using local time zone
    const selected = new Date(year, month, day);
    const yyyy = selected.getFullYear();
    const mm = String(selected.getMonth() + 1).padStart(2, '0');
    const dd = String(selected.getDate()).padStart(2, '0');
    const dateString = `${yyyy}-${mm}-${dd}`;
    onChange(dateString);
    setIsOpen(false);
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Generate days grid
  const daysGrid = [];
  for (let i = 0; i < firstDay; i++) {
    daysGrid.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    daysGrid.push(i);
  }

  // Format value for display: MM/DD/YYYY
  const getDisplayValue = () => {
    if (!value) return '';
    const parts = value.split('-');
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}/${parts[0]}`;
    }
    return value;
  };

  const isSelected = (day) => {
    if (!value || !day) return false;
    const d = new Date(value);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  };

  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  const isCellDisabled = (day) => {
    if (!day) return true;
    const targetDate = new Date(year, month, day);
    
    if (min) {
      const minParts = min.split('-');
      const minD = new Date(minParts[0], minParts[1] - 1, minParts[2]);
      if (targetDate < minD) return true;
    }
    
    if (max) {
      const maxParts = max.split('-');
      const maxD = new Date(maxParts[0], maxParts[1] - 1, maxParts[2]);
      if (targetDate > maxD) return true;
    }
    
    return false;
  };

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
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
        <FiCalendar className="text-blue-400 hover:text-blue-300 transition-colors text-xs pointer-events-none" />
      </div>

      {isOpen && (
        <div className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full mt-2 bg-slate-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl w-64 z-50 animate-in fade-in zoom-in-95 duration-150`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <FiChevronLeft size={16} />
            </button>
            <span className="text-xs font-black text-white uppercase tracking-wider">
              {months[month]} {year}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <FiChevronRight size={16} />
            </button>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 gap-1 mb-1 text-center">
            {daysOfWeek.map((day) => (
              <span key={day} className="text-[9px] font-black text-slate-500 uppercase">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {daysGrid.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} />;
              }

              const disabled = isCellDisabled(day);
              const selected = isSelected(day);
              const today = isToday(day);

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  disabled={disabled}
                  onClick={(e) => handleDayClick(day, e)}
                  className={`h-7 w-7 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                    selected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/35 border border-blue-500/35'
                      : disabled
                      ? 'text-slate-700 cursor-not-allowed opacity-30'
                      : today
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;
