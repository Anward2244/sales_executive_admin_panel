// List of all 28 Indian States and 8 Union Territories (36 in total)
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal'
];

export const POPULAR_STATES = INDIAN_STATES;

/**
 * Checks if a string represents an "all states / pan India" selection
 */
export const isAllKeyword = (val) => {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return (
    s === 'all' ||
    s === 'all states' ||
    s === 'all locations' ||
    s === 'all territory' ||
    s === 'all territories' ||
    s === 'pan india' ||
    s === 'india' ||
    s === 'pan-india' ||
    s === '*'
  );
};

/**
 * Parse raw location input (string or array) from spreadsheets or inputs.
 * If "all" is specified, returns all Indian states & UTs.
 */
export const parseLocationInput = (input) => {
  if (!input) return [];

  if (Array.isArray(input)) {
    const hasAll = input.some((item) => isAllKeyword(item));
    if (hasAll) {
      return [...INDIAN_STATES];
    }
    return input.map((s) => String(s).trim()).filter(Boolean);
  }

  const rawStr = String(input).trim();
  if (!rawStr) return [];

  // Check if whole string is an 'all' keyword
  if (isAllKeyword(rawStr)) {
    return [...INDIAN_STATES];
  }

  // Split by comma, semicolon or newline
  const tokens = rawStr
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const hasAll = tokens.some((token) => isAllKeyword(token));
  if (hasAll) {
    return [...INDIAN_STATES];
  }

  return tokens;
};
