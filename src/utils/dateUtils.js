/**
 * Formats any Date or timestamp into DD-MM-YYYY format.
 * Example: 2026-07-21 -> "21-07-2026"
 */
export const formatDateDDMMYYYY = (dateInput) => {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
};

/**
 * Formats any Date or timestamp into DD-MM-YYYY, HH:MM AM/PM format.
 * Example: "21-07-2026, 03:45 PM"
 */
export const formatDateTimeDDMMYYYY = (dateInput, includeSeconds = false) => {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hoursStr = String(hours).padStart(2, '0');

  if (includeSeconds) {
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year}, ${hoursStr}:${minutes}:${seconds} ${ampm}`;
  }

  return `${day}-${month}-${year}, ${hoursStr}:${minutes} ${ampm}`;
};

/**
 * Formats any YYYY-MM-DD string into DD-MM-YYYY format.
 */
export const formatYYYYMMDDToDDMMYYYY = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return dateStr || '';
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};
