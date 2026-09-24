/**
 * Real-time Form Input Validators
 * Returns { isValid: boolean, error?: string } or boolean
 */

// Regex patterns
export const REGEX_EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const REGEX_INDIAN_PHONE = /^[6-9]\d{9}$/;
export const REGEX_GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const REGEX_PAN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const REGEX_PINCODE = /^[1-9][0-9]{5}$/;
export const REGEX_ENTITY_CODE = /^[A-Z0-9_-]{2,30}$/;

/**
 * Validates Email Address
 */
export const validateEmail = (email) => {
  if (!email || !String(email).trim()) {
    return { isValid: false, error: 'Email address is required.' };
  }
  const clean = String(email).trim();
  if (!REGEX_EMAIL.test(clean)) {
    return { isValid: false, error: 'Please enter a valid email address (e.g. name@domain.com).' };
  }
  return { isValid: true, error: null };
};

/**
 * Validates 10-digit Indian Phone/Mobile Number
 */
export const validatePhone = (phone) => {
  if (!phone || !String(phone).trim()) {
    return { isValid: false, error: 'Phone number is required.' };
  }
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length !== 10) {
    return { isValid: false, error: `Phone number must be 10 digits (currently ${clean.length}).` };
  }
  if (!REGEX_INDIAN_PHONE.test(clean)) {
    return { isValid: false, error: 'Phone number must begin with 6, 7, 8, or 9.' };
  }
  return { isValid: true, error: null };
};

/**
 * Validates Indian 15-character GSTIN
 */
export const validateGSTIN = (gstin) => {
  if (!gstin || !String(gstin).trim()) {
    return { isValid: false, error: 'GSTIN is required.' };
  }
  const clean = String(gstin).trim().toUpperCase();
  if (clean.length !== 15) {
    return { isValid: false, error: `GSTIN must be exactly 15 characters (currently ${clean.length}).` };
  }
  if (!REGEX_GSTIN.test(clean)) {
    return { isValid: false, error: 'Invalid GSTIN format. Expected format: 22AAAAA0000A1Z5.' };
  }
  return { isValid: true, error: null };
};

/**
 * Validates Indian 10-character PAN Number
 */
export const validatePAN = (pan) => {
  if (!pan || !String(pan).trim()) {
    return { isValid: false, error: 'PAN number is required.' };
  }
  const clean = String(pan).trim().toUpperCase();
  if (clean.length !== 10) {
    return { isValid: false, error: `PAN must be exactly 10 characters (currently ${clean.length}).` };
  }
  if (!REGEX_PAN.test(clean)) {
    return { isValid: false, error: 'Invalid PAN format. Expected: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).' };
  }
  return { isValid: true, error: null };
};

/**
 * Validates 6-digit Indian PIN Code
 */
export const validatePincode = (pincode) => {
  if (!pincode || !String(pincode).trim()) {
    return { isValid: false, error: 'PIN code is required.' };
  }
  const clean = String(pincode).replace(/\D/g, '');
  if (clean.length !== 6) {
    return { isValid: false, error: `PIN code must be 6 digits (currently ${clean.length}).` };
  }
  if (!REGEX_PINCODE.test(clean)) {
    return { isValid: false, error: 'Invalid PIN code. Must not start with 0.' };
  }
  return { isValid: true, error: null };
};

/**
 * Validates Entity/Company/Firm Code
 */
export const validateEntityCode = (code) => {
  if (!code || !String(code).trim()) {
    return { isValid: false, error: 'Code is required.' };
  }
  const clean = String(code).trim().toUpperCase();
  if (clean.length < 2) {
    return { isValid: false, error: 'Code must be at least 2 characters.' };
  }
  if (!REGEX_ENTITY_CODE.test(clean)) {
    return { isValid: false, error: 'Code can only contain letters, numbers, hyphens, and underscores.' };
  }
  return { isValid: true, error: null };
};
