import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown, FiSearch } from 'react-icons/fi';

const CustomDropdown = ({
  value,
  onChange,
  options = [],
  statusColor,
  defaultLabel,
  placeholder,
  disabled = false,
  className,
  containerClassName,
  menuClassName,
  searchable = false,
  allowCustom = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
  const searchInputRef = useRef(null);

  const updatePosition = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const spaceBelow = viewportHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;

      const preferredMenuHeight = searchable ? 280 : 240;
      // Open upward if space below is too tight and space above has more room
      const shouldOpenUp = spaceBelow < 200 && spaceAbove > spaceBelow;

      const availableSpace = shouldOpenUp ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(140, Math.min(preferredMenuHeight, availableSpace));

      const minWidth = rect.width;
      // Adapt minimum popup width based on longest option label
      const maxOptionLength = options.reduce((max, opt) => {
        const lbl = typeof opt === 'object' && opt !== null ? String(opt.label ?? '') : String(opt ?? '');
        return Math.max(max, lbl.length);
      }, 0);
      const baseMinMenuWidth = maxOptionLength > 18 ? 220 : (maxOptionLength > 8 ? 140 : 80);
      const estimatedMenuWidth = Math.max(minWidth, baseMinMenuWidth, searchable ? 200 : 0);
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
        minWidth: Math.max(minWidth, baseMinMenuWidth, searchable ? 200 : 0),
        maxHeight,
        openUp: shouldOpenUp
      });
    }
  };

  const toggleDropdown = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
    if (isOpen) {
      setSearchQuery('');
    }
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
        setSearchQuery('');
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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, searchable]);

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
      return { value: option.value, label: option.label ?? option.value };
    }
    return { value: option, label: String(option) };
  };

  const normalizedOptions = useMemo(() => options.map(getOptionInfo), [options]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.trim().toLowerCase();
    return normalizedOptions.filter((opt) =>
      String(opt.label).toLowerCase().includes(q) || String(opt.value).toLowerCase().includes(q)
    );
  }, [searchable, searchQuery, normalizedOptions]);

  const selectedOption = normalizedOptions.find(opt => 
    opt.value === value || (value !== '' && value !== null && value !== undefined && String(opt.value) === String(value))
  );

  const fallbackPlaceholder = defaultLabel || placeholder;
  const isValueEmpty = value === '' || value === null || value === undefined;
  const displayLabel = selectedOption 
    ? (isValueEmpty && fallbackPlaceholder ? fallbackPlaceholder : selectedOption.label)
    : (fallbackPlaceholder || (isValueEmpty ? 'Select...' : String(value)));

  const handleSelect = (val) => {
    onChange?.(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={containerClassName || "relative w-full font-medium"} ref={dropdownRef}>
      {/* Trigger Button */}
      <div
        onClick={toggleDropdown}
        className={`w-full bg-white dark:bg-blue-700 outline-none px-3 py-2.5 rounded-lg border cursor-pointer transition-all flex justify-between items-center select-none gap-2 ${
          disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
        } ${statusColor || ''} ${className || ''}`}
      >
        <span className="truncate">{displayLabel}</span>
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
          className={`w-max max-w-[340px] bg-white/40 dark:bg-slate-950/50 backdrop-blur-md border border-slate-200 dark:border-white/20 rounded-xl shadow-xl dark:shadow-2xl shadow-slate-900/10 dark:shadow-black/80 flex flex-col overflow-hidden z-[99999] ${
            coords.openUp ? 'animate-dropdown-up' : 'animate-dropdown'
          } ${menuClassName || ''}`}
        >
          {searchable && (
            <div
              className="p-2 border-b border-slate-200/80 dark:border-white/10 shrink-0 bg-slate-50/80 dark:bg-slate-900/80"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative flex items-center">
                <FiSearch className="absolute left-2.5 text-slate-400 text-xs pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && allowCustom && searchQuery.trim()) {
                      e.preventDefault();
                      handleSelect(searchQuery.trim());
                    }
                  }}
                  className="w-full pl-7 pr-6 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="overflow-y-auto overflow-x-hidden custom-scrollbar flex-1">
            {allowCustom && searchQuery.trim() && !filteredOptions.some(o => String(o.value).toLowerCase() === searchQuery.trim().toLowerCase()) && (
              <div
                onClick={() => handleSelect(searchQuery.trim())}
                className="px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer border-b border-slate-100 dark:border-white/5 flex items-center gap-1.5"
              >
                <span>+ Use &quot;{searchQuery.trim()}&quot;</span>
              </div>
            )}

            {filteredOptions.length === 0 && (!allowCustom || !searchQuery.trim()) ? (
              <div className="px-3 py-4 text-xs text-center text-slate-400">
                No options found
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value || (value !== '' && value !== null && value !== undefined && String(opt.value) === String(value));
                return (
                  <div
                    key={idx}
                    data-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={`px-3 py-2.5 text-xs font-bold cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-blue-600 text-white font-bold' 
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomDropdown;
