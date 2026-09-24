/**
 * Real-time Input Formatters for standardizing forms and user inputs
 */

/**
 * Formats an entity/company/firm/product code:
 * Converts to uppercase, strips invalid special characters (keeps alphanumeric, hyphens, and underscores),
 * and replaces spaces with hyphens.
 * Example: "auric co 01" -> "AURIC-CO-01"
 */
export const formatEntityCode = (val) => {
  if (!val) return '';
  return String(val)
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 30);
};

/**
 * Formats a 10-digit phone/mobile number (digits only, max 10 characters)
 * Example: "98765 43210" -> "9876543210"
 */
export const formatPhone = (val) => {
  if (!val) return '';
  return String(val).replace(/\D/g, '').slice(0, 10);
};

/**
 * Formats Indian GSTIN (15 characters, uppercase alphanumeric)
 * Format: 2 digits (State) + 10 chars (PAN) + 1 entity + 'Z' + 1 check digit
 * Example: "27aabcu9603r1zm" -> "27AABCU9603R1ZM"
 */
export const formatGSTIN = (val) => {
  if (!val) return '';
  return String(val).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
};

/**
 * Formats Indian PAN Number (10 characters, uppercase alphanumeric)
 * Format: 5 letters + 4 digits + 1 letter
 * Example: "aabcu9603r" -> "AABCU9603R"
 */
export const formatPAN = (val) => {
  if (!val) return '';
  return String(val).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
};

/**
 * Formats a 6-digit Indian PIN code (digits only, max 6 characters)
 * Example: "400 001" -> "400001"
 */
export const formatPincode = (val) => {
  if (!val) return '';
  return String(val).replace(/\D/g, '').slice(0, 6);
};

/**
 * Formats an Aadhaar number into spaced 4-digit groups (12 digits total)
 * Example: "123456789012" -> "1234 5678 9012"
 */
export const formatAadhaar = (val) => {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '').slice(0, 12);
  const parts = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.substring(i, i + 4));
  }
  return parts.join(' ');
};

/**
 * Formats currency into Indian Rupee format (e.g. ₹ 1,50,000.00)
 */
export const formatCurrency = (amount, includeSymbol = true) => {
  const num = Number(amount);
  if (isNaN(num)) return includeSymbol ? '₹ 0.00' : '0.00';
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return includeSymbol ? `₹ ${formatted}` : formatted;
};

/**
 * Capitalizes first letter of each word (Title Case)
 */
export const formatTitleCase = (val) => {
  if (!val) return '';
  return String(val)
    .toLowerCase()
    .replace(/(?:^|\s|-)\S/g, (char) => char.toUpperCase());
};
