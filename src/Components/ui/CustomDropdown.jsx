import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown } from 'react-icons/fi';

const CustomDropdown = ({ value, onChange, options, statusColor, defaultLabel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({
    top: undefined,
    bottom: undefined,
    left: 0,
    minWidth: 0,
    maxHeight: 240,
    openUp: false
  });
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

  const updatePosition = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const spaceBelow = viewportHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;

      const preferredMenuHeight = 240;
      // Open upward if space below is too tight and space above has more room
      const shouldOpenUp = spaceBelow < 200 && spaceAbove > spaceBelow;

      const availableSpace = shouldOpenUp ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(120, Math.min(preferredMenuHeight, availableSpace));

      const minWidth = rect.width;
      const estimatedMenuWidth = Math.max(minWidth, 240);
      let left = rect.left;

      if (left + estimatedMenuWidth > viewportWidth - 12) {
        left = Math.max(12, viewportWidth - estimatedMenuWidth - 12);
      }
      if (left < 12) {
        left = 12;
      }

      setCoords({
        top: shouldOpenUp ? undefined : rect.bottom + 6,
        bottom: shouldOpenUp ? viewportHeight - rect.top + 6 : undefined,
        left,
        minWidth,
        maxHeight,
        openUp: shouldOpenUp
      });
    }
  };

  const toggleDropdown = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  // Close dropdown when clicking outside or scrolling/resizing
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target) &&
        menuRef.current && !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  // Scroll active option into view when opened
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const selectedEl = menuRef.current.querySelector('[data-selected="true"]');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen]);

  // Helper to determine display label and value
  const getOptionInfo = (option) => {
    if (typeof option === 'object' && option !== null) {
      return { value: option.value, label: option.label };
    }
    return { value: option, label: option };
  };

  const selectedOption = options.map(getOptionInfo).find(opt => opt.value === value) || { value, label: value };

  return (
    <div className="relative w-full font-medium" ref={dropdownRef}>
      {/* Trigger Button */}
      <div
        onClick={toggleDropdown}
        className={`w-full bg-transparent outline-none px-3 py-2.5 rounded-lg border cursor-pointer transition-all flex justify-between items-center select-none gap-2 ${statusColor}`}
      >
        <span className="truncate">{(!value && defaultLabel) ? defaultLabel : selectedOption.label}</span>
        <FiChevronDown className={`shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} text-current opacity-70`} />
      </div>

      {/* Options List rendered via createPortal */}
      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: coords.top !== undefined ? `${coords.top}px` : undefined,
            bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
            left: `${coords.left}px`,
            minWidth: `${coords.minWidth}px`,
            maxHeight: `${coords.maxHeight}px`
          }}
          className={`w-max max-w-[280px] bg-white/95 dark:bg-slate-950/90 backdrop-blur-md border border-slate-200 dark:border-white/20 rounded-xl shadow-xl dark:shadow-2xl shadow-slate-900/10 dark:shadow-black/80 overflow-y-auto overflow-x-hidden custom-scrollbar z-[99999] ${
            coords.openUp ? 'animate-dropdown-up' : 'animate-dropdown'
          }`}
        >
          {options.map((option, idx) => {
            const { value: optValue, label: optLabel } = getOptionInfo(option);
            const isSelected = value === optValue;
            return (
              <div
                key={idx}
                data-selected={isSelected}
                onClick={() => {
                  onChange(optValue);
                  setIsOpen(false);
                }}
                className={`px-3 py-2.5 text-xs font-bold cursor-pointer transition-colors ${
                  isSelected 
                    ? 'bg-blue-600 text-white font-bold' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {optLabel}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomDropdown;