import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce any value (e.g. search input terms)
 * @param {*} value - The input value to debounce
 * @param {number} delay - The delay in milliseconds (default 300ms)
 * @returns {*} The debounced value
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default useDebounce;
