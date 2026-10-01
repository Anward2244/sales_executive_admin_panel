import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  FiUploadCloud,
  FiFileText,
  FiDownload,
  FiCheckCircle,
  FiAlertTriangle,
  FiAlertCircle,
  FiX,
  FiTrash2,
  FiPlus,
  FiRefreshCw,
  FiArrowRight,
  FiCheck,
  FiSearch,
  FiInfo,
  FiPackage,
  FiBriefcase,
  FiMapPin,
  FiZap,
  FiTag,
  FiHelpCircle
} from 'react-icons/fi';
import { createProductApi, bulkCreateProductsApi, getCompaniesApi, getBrandRoutingMatrixApi, getCategoryApi } from '@/api/axios';
import CustomDropdown from '@/components/ui/CustomDropdown';
import { INDIAN_STATES, parseLocationInput, isAllKeyword } from '@/utils/indianStates';

// Standard measurement units
const COMMON_UNITS = ['PCS', 'SET', 'BOX', 'PAIR', 'KG', 'MTR', 'PKT', 'ROLL'];

// Helper to normalize strings for header comparison
const normalizeKey = (key) =>
  String(key || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Helper to match category by code, ID, or name
export const matchCategory = (inputStr, catList) => {
  if (!inputStr || !catList || catList.length === 0) return null;
  const clean = String(inputStr).toLowerCase().trim();
  const cleanAlphanum = clean.replace(/[^a-z0-9]/g, '');

  return catList.find((c) => {
    const cId = String(c._id || '').toLowerCase().trim();
    const cCode = String(c.code || '').toLowerCase().trim();
    const cName = String(c.name || '').toLowerCase().trim();
    const cCodeAlphanum = cCode.replace(/[^a-z0-9]/g, '');
    const cNameAlphanum = cName.replace(/[^a-z0-9]/g, '');

    return (
      cId === clean ||
      cCode === clean ||
      cName === clean ||
      (cCodeAlphanum && cCodeAlphanum === cleanAlphanum) ||
      (cNameAlphanum && cNameAlphanum === cleanAlphanum) ||
      (clean.length >= 3 && (cName.includes(clean) || clean.includes(cName))) ||
      (cCode && clean.includes(cCode))
    );
  });
};

// Helper to match company by code, ID, or name
const matchCompany = (inputStr, compList) => {
  if (!inputStr || !compList || compList.length === 0) return null;
  const clean = String(inputStr).toLowerCase().trim();
  const cleanAlphanum = clean.replace(/[^a-z0-9]/g, '');

  return compList.find((c) => {
    const cId = String(c._id || '').toLowerCase().trim();
    const cCode = String(c.code || '').toLowerCase().trim();
    const cName = String(c.name || '').toLowerCase().trim();
    const cCodeAlphanum = cCode.replace(/[^a-z0-9]/g, '');
    const cNameAlphanum = cName.replace(/[^a-z0-9]/g, '');

    return (
      cId === clean ||
      cCode === clean ||
      cName === clean ||
      (cCodeAlphanum && cCodeAlphanum === cleanAlphanum) ||
      (cNameAlphanum && cNameAlphanum === cleanAlphanum) ||
      (clean.length >= 3 && (cName.includes(clean) || clean.includes(cName))) ||
      (cCode && clean.includes(cCode))
    );
  });
};

// Helper to resolve brand routing rules from matrix for bulk row
export const resolveBrandRoutingForBulk = (brandName, brandMatrix = [], companies = []) => {
  if (!brandName || typeof brandName !== 'string') return null;
  const target = brandName.trim();
  if (!target) return null;

  // 1. Direct match in matrix (case-insensitive)
  let matchedGroup = (brandMatrix || []).find(
    (item) => item.brand && item.brand.trim().toLowerCase() === target.toLowerCase()
  );

  // 2. Fallback to global "ALL" brand rules
  if (!matchedGroup || !Array.isArray(matchedGroup.rules) || matchedGroup.rules.length === 0) {
    matchedGroup = (brandMatrix || []).find(
      (item) => item.brand && item.brand.trim().toUpperCase() === 'ALL'
    );
  }

  if (!matchedGroup || !Array.isArray(matchedGroup.rules) || matchedGroup.rules.length === 0) {
    return null;
  }

  const isFallback = matchedGroup.brand?.toUpperCase() === 'ALL' && target.toUpperCase() !== 'ALL';
  const companyMappings = [];
  const allStates = new Set();

  matchedGroup.rules.forEach((rule) => {
    const cRef = rule.companyId;
    let cId = typeof cRef === 'object' ? cRef?._id : cRef;
    let matchedComp = companies.find((c) => c._id === cId);
    if (!matchedComp && typeof cRef === 'object' && cRef?.name) {
      matchedComp = matchCompany(cRef.name, companies);
      if (matchedComp) cId = matchedComp._id;
    }

    if (cId) {
      const rawStates = Array.isArray(rule.states) ? rule.states : [];
      const states = rawStates.includes('*') || rawStates.some((s) => String(s).toUpperCase() === 'ALL')
        ? [...INDIAN_STATES]
        : rawStates;

      states.forEach((st) => allStates.add(st));
      companyMappings.push({
        companyId: cId,
        companyName: matchedComp?.name || (typeof cRef === 'object' ? cRef?.name : ''),
        companyCode: matchedComp?.code || (typeof cRef === 'object' ? cRef?.code : ''),
        states
      });
    }
  });

  if (companyMappings.length === 0) return null;

  return {
    sourceBrand: matchedGroup.brand,
    isFallback,
    primaryCompanyId: companyMappings[0].companyId,
    primaryCompanyName: companyMappings[0].companyName,
    primaryCompanyCode: companyMappings[0].companyCode,
    locations: Array.from(allStates),
    companyMappings
  };
};

// Helper to generate a unique, clean SKU for products missing SKU in uploaded sheet
export const generateUniqueSku = (name, brand, rowIndex, usedSkusSet = null) => {
  const brandPrefix = (brand || 'PRD')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4) || 'PRD';

  const cleanName = (name || 'ITEM')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim();

  // Extract initials or word chunks
  const words = cleanName.split(/\s+/).filter(Boolean);
  let namePart = '';
  if (words.length === 1) {
    namePart = words[0].slice(0, 6);
  } else if (words.length === 2) {
    namePart = `${words[0].slice(0, 4)}-${words[1].slice(0, 4)}`;
  } else {
    namePart = words.slice(0, 3).map((w) => w.slice(0, 3)).join('');
  }
  if (!namePart) namePart = 'ITEM';

  let candidate = `${brandPrefix}-${namePart}-${String(rowIndex + 1).padStart(3, '0')}`.toUpperCase();

  let counter = 1;
  while (usedSkusSet && usedSkusSet.has(candidate)) {
    candidate = `${brandPrefix}-${namePart}-${String(rowIndex + 1).padStart(3, '0')}-${counter}`.toUpperCase();
    counter++;
  }

  if (usedSkusSet) {
    usedSkusSet.add(candidate);
  }
  return candidate;
};

// Clean and normalize incoming row data from parsed Excel sheet
const mapExcelRow = (rawRow, rowIndex, companies = [], brandMatrix = [], usedSkusSet = null, categories = []) => {
  const row = {};
  Object.keys(rawRow).forEach((k) => {
    row[normalizeKey(k)] = rawRow[k];
  });

  // Extract Product Name
  const name = String(
    row.productname ||
    row.name ||
    row.title ||
    row.producttitle ||
    row.itemname ||
    ''
  ).trim();

  // Extract Brand
  const brand = String(
    row.brand ||
    row.brandname ||
    row.make ||
    ''
  ).trim() || 'Realme';

  // Extract SKU
  let rawSku = String(
    row.sku ||
    row.skucode ||
    row.productcode ||
    row.itemcode ||
    row.code ||
    ''
  ).trim().toUpperCase();

  // Auto-generate unique SKU if empty/missing in sheet
  let sku = rawSku;
  let isSkuAutoGenerated = false;
  if (!sku) {
    sku = generateUniqueSku(name, brand, rowIndex, usedSkusSet);
    isSkuAutoGenerated = true;
  } else if (usedSkusSet) {
    usedSkusSet.add(sku);
  }

  // Extract Category ID / Name / Code
  const findCategoryValue = () => {
    const directKeys = [
      'categoryid',
      'category',
      'categoryname',
      'categorycode',
      'itemcategory',
      'productcategory',
      'catid',
      'catname',
      'catcode',
      'cat'
    ];
    for (const k of directKeys) {
      if (row[k] !== undefined && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
    }
    // Fuzzy search for any key containing "categor"
    const fuzzyKey = Object.keys(row).find((k) => k.includes('categor'));
    if (fuzzyKey && row[fuzzyKey] !== undefined && String(row[fuzzyKey]).trim() !== '') {
      return String(row[fuzzyKey]).trim();
    }
    return '';
  };

  const rawCat = findCategoryValue();
  let categoryId = '';
  let categoryName = '';
  let categoryCode = '';

  if (rawCat) {
    const matchedCat = matchCategory(rawCat, categories);
    if (matchedCat) {
      categoryId = matchedCat._id;
      categoryName = matchedCat.name;
      categoryCode = matchedCat.code || '';
    } else {
      // Direct 24-character hex ObjectId
      if (/^[a-f\d]{24}$/i.test(rawCat)) {
        categoryId = rawCat;
        categoryName = rawCat;
      } else {
        categoryName = rawCat;
      }
    }
  }

  // Extract Company Code / Name / ID
  const findCompanyValue = () => {
    const directKeys = [
      'companycode',
      'companycodename',
      'companyname',
      'company',
      'companyid',
      'partnercompany',
      'partnercompanycode',
      'tradingcompany',
      'compcode',
      'compname',
      'comp'
    ];
    for (const k of directKeys) {
      if (row[k] !== undefined && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
    }
    // Fuzzy search for any key containing "comp" or "partner"
    const fuzzyKey = Object.keys(row).find(
      (k) => k.includes('comp') || k.includes('partner') || k.includes('trading')
    );
    if (fuzzyKey && row[fuzzyKey] !== undefined && String(row[fuzzyKey]).trim() !== '') {
      return String(row[fuzzyKey]).trim();
    }
    return '';
  };

  const rawComp = findCompanyValue();

  // Resolve routing from brand matrix
  const routed = resolveBrandRoutingForBulk(brand, brandMatrix, companies);

  let companyId = '';
  let companyName = '';
  let companyCode = '';
  let isAutoMappedFromMatrix = false;

  if (rawComp) {
    const matched = matchCompany(rawComp, companies);
    if (matched) {
      companyId = matched._id;
      companyName = matched.name;
      companyCode = matched.code || '';
    } else {
      companyName = rawComp; // Unmatched text
    }
  } else if (routed && routed.primaryCompanyId) {
    // Automatically set company according to brand routing matrix
    companyId = routed.primaryCompanyId;
    companyName = routed.primaryCompanyName;
    companyCode = routed.primaryCompanyCode || '';
    isAutoMappedFromMatrix = true;
  } else if (companies.length > 0) {
    // If no brand matrix match, default to first available partner company
    companyId = companies[0]._id;
    companyName = companies[0].name;
    companyCode = companies[0].code || '';
  }

  // Extract Locations / States
  const rawLocations = String(
    row.locationscommaseparated ||
    row.locations ||
    row.location ||
    row.states ||
    row.territories ||
    row.distributionlocations ||
    ''
  ).trim();

  let locations = parseLocationInput(rawLocations);
  let isAll = isAllKeyword(rawLocations) || (locations.length === INDIAN_STATES.length && locations.length > 0);

  // If locations not specified in sheet, auto-fill from brand routing matrix or default to all states
  if (locations.length === 0) {
    if (routed && Array.isArray(routed.locations) && routed.locations.length > 0) {
      locations = routed.locations;
      isAll = locations.length === INDIAN_STATES.length;
      isAutoMappedFromMatrix = true;
    } else {
      locations = [...INDIAN_STATES];
      isAll = true;
    }
  }

  // Construct companyMappings
  let companyMappings = [];
  if (routed && Array.isArray(routed.companyMappings) && routed.companyMappings.length > 0) {
    if (rawComp && companyId && companyId !== routed.primaryCompanyId) {
      companyMappings = [{ companyId, states: locations }];
    } else {
      companyMappings = routed.companyMappings;
    }
  } else if (companyId) {
    companyMappings = [{ companyId, states: locations }];
  }

  // Extract Unit
  const unit = String(
    row.unit ||
    row.uom ||
    row.measurementunit ||
    'PCS'
  ).trim().toUpperCase() || 'PCS';

  // Extract Description
  const description = String(
    row.description ||
    row.productdescription ||
    row.details ||
    row.desc ||
    ''
  ).trim();

  // Extract Status
  const rawStatus = String(
    row.activestatusyesno ||
    row.status ||
    row.isactive ||
    row.active ||
    ''
  ).toLowerCase().trim();
  const isActive = !(
    rawStatus === 'no' ||
    rawStatus === 'inactive' ||
    rawStatus === 'false' ||
    rawStatus === '0'
  );

  return {
    id: `row-${rowIndex}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    rowIndex: rowIndex + 2, // 1-based index + header row in Excel
    name,
    sku,
    brand,
    categoryId,
    categoryName,
    categoryCode,
    rawCategory: rawCat,
    unit,
    companyId,
    companyName,
    companyCode,
    rawCompany: rawComp,
    locations,
    rawLocationsInput: isAll ? 'ALL' : locations.join(', '),
    companyMappings,
    isAutoMappedFromMatrix,
    routingSourceBrand: routed ? routed.sourceBrand : null,
    description,
    isActive,
    isSkuAutoGenerated,
    errors: [],
    warnings: []
  };
};

// Validate individual row with detailed cell-level issue explanations
const validateRow = (row, allRows = [], existingCatalogSkus = new Set(), companies = [], categories = []) => {
  const errors = [];
  const warnings = [];
  const cellIssues = {};

  // 1. Required: Product Name
  if (!row.name || !row.name.trim()) {
    const issue = {
      field: 'name',
      fieldLabel: 'Product Name',
      excelHeader: 'Product Name*',
      type: 'error',
      message: 'Product name is required.',
      detail: 'The product title was empty or blank in the spreadsheet.',
      fixSuggestion: 'Type a product name in this cell.'
    };
    errors.push(issue.message);
    cellIssues.name = issue;
  } else if (row.name.trim().length < 2) {
    const issue = {
      field: 'name',
      fieldLabel: 'Product Name',
      excelHeader: 'Product Name*',
      type: 'warning',
      message: 'Name is unusually short (less than 2 characters).',
      detail: 'Verify that this is the full product name.',
      fixSuggestion: 'Update the product name if needed.'
    };
    warnings.push(issue.message);
    cellIssues.name = issue;
  }

  // 2. Required: SKU Code
  if (!row.sku || !row.sku.trim()) {
    const issue = {
      field: 'sku',
      fieldLabel: 'SKU Code',
      excelHeader: 'SKU',
      type: 'error',
      message: 'SKU code is required.',
      detail: 'SKU was missing and could not be determined.',
      fixSuggestion: 'Click "⚡ Fix SKU" to generate a clean, unique SKU code.',
      actionType: 'auto_generate_sku'
    };
    errors.push(issue.message);
    cellIssues.sku = issue;
  } else {
    // Check duplicates in uploaded sheet
    const duplicateInFile = allRows.filter(
      (r) => r.id !== row.id && r.sku && r.sku.trim().toUpperCase() === row.sku.trim().toUpperCase()
    );
    if (duplicateInFile.length > 0) {
      const dupRows = duplicateInFile.map((d) => d.rowIndex).join(', ');
      const issue = {
        field: 'sku',
        fieldLabel: 'SKU Code',
        excelHeader: 'SKU',
        type: 'error',
        message: `Duplicate SKU "${row.sku}" found in sheet (Row ${dupRows}).`,
        detail: `This SKU is already used in row ${dupRows} of this file. Each product must have a unique SKU.`,
        fixSuggestion: 'Click "⚡ Fix SKU" to generate a non-colliding unique SKU code.',
        actionType: 'auto_generate_sku'
      };
      errors.push(issue.message);
      cellIssues.sku = issue;
    } else if (!row.isSkuAutoGenerated && existingCatalogSkus.has(row.sku.trim().toUpperCase())) {
      // Check duplicates in existing database catalog
      const issue = {
        field: 'sku',
        fieldLabel: 'SKU Code',
        excelHeader: 'SKU',
        type: 'warning',
        message: `SKU "${row.sku}" already exists in catalog.`,
        detail: 'A product with this SKU already exists in your catalog. Creating may fail or overwrite existing data.',
        fixSuggestion: 'Keep if updating existing product, or click "⚡ Fix SKU" to generate a new SKU.',
        actionType: 'auto_generate_sku'
      };
      warnings.push(issue.message);
      cellIssues.sku = issue;
    }
  }

  // 3. Brand
  if (!row.brand || !row.brand.trim()) {
    const issue = {
      field: 'brand',
      fieldLabel: 'Brand',
      excelHeader: 'Brand*',
      type: 'warning',
      message: 'Brand is blank (defaulted to Realme).',
      detail: 'Brand is used for auto-routing companies and states.',
      fixSuggestion: 'Specify the brand name if different from Realme.'
    };
    warnings.push(issue.message);
    cellIssues.brand = issue;
  }

  // 4. Category
  if (row.rawCategory && !row.categoryId) {
    const issue = {
      field: 'categoryId',
      fieldLabel: 'Category',
      excelHeader: 'Category',
      type: 'warning',
      message: `Category "${row.rawCategory}" could not be matched.`,
      detail: `"${row.rawCategory}" in the sheet does not match any registered product category. It will import with no category unless selected.`,
      fixSuggestion: 'Select an existing category from the dropdown.'
    };
    warnings.push(issue.message);
    cellIssues.categoryId = issue;
  }

  // 5. Required: Company
  if (!row.companyId) {
    let matched = null;
    if (row.rawCompany && companies && companies.length > 0) {
      matched = matchCompany(row.rawCompany, companies);
    }
    if (matched) {
      row.companyId = matched._id;
      row.companyName = matched.name;
      row.companyCode = matched.code || '';
    } else if (companies.length === 0) {
      const issue = {
        field: 'companyId',
        fieldLabel: 'Partner Company',
        excelHeader: 'Company Code',
        type: 'warning',
        message: 'No partner companies loaded to verify company.',
        detail: 'Company list is still loading or empty.',
        fixSuggestion: 'Wait for companies to load or select manually.'
      };
      warnings.push(issue.message);
      cellIssues.companyId = issue;
    } else {
      const issue = {
        field: 'companyId',
        fieldLabel: 'Partner Company',
        excelHeader: 'Company Code',
        type: 'error',
        message: row.rawCompany
          ? `Company "${row.rawCompany}" could not be matched.`
          : 'Partner company is required.',
        detail: row.rawCompany
          ? `"${row.rawCompany}" does not match any registered partner company code or name.`
          : 'Every product must have a partner company assigned for billing and routing.',
        fixSuggestion: 'Select a valid partner company from the dropdown.'
      };
      errors.push(issue.message);
      cellIssues.companyId = issue;
    }
  }

  // 6. Locations
  if (!row.locations || row.locations.length === 0) {
    const issue = {
      field: 'locations',
      fieldLabel: 'Covered Locations',
      excelHeader: 'Locations',
      type: 'warning',
      message: 'No distribution locations specified.',
      detail: 'This product will have no distribution states assigned.',
      fixSuggestion: 'Click "✓ Fix" to cover all Indian states, or enter states.',
      actionType: 'set_all_states'
    };
    warnings.push(issue.message);
    cellIssues.locations = issue;
  }

  // 7. Unit
  if (row.unit && !COMMON_UNITS.includes(row.unit.toUpperCase())) {
    const issue = {
      field: 'unit',
      fieldLabel: 'Measurement Unit',
      excelHeader: 'Unit',
      type: 'warning',
      message: `Non-standard unit "${row.unit}".`,
      detail: `Standard units are ${COMMON_UNITS.join(', ')}.`,
      fixSuggestion: 'Select standard unit like PCS or SET if desired.'
    };
    warnings.push(issue.message);
    cellIssues.unit = issue;
  }

  return {
    ...row,
    errors,
    warnings,
    cellIssues,
    isValid: errors.length === 0
  };
};

// Standalone template generator exported for direct use across the app
export const downloadProductExcelTemplate = (companies = [], categories = []) => {
  const wb = XLSX.utils.book_new();

  const sampleCat = categories[0]?.name || 'Electronics';

  // Sheet 1: Products Template (Minimal format: SKU, Company Code, Category, and Locations are completely optional!)
  const templateData = [
    {
      'Product Name*': 'Whatnot NitroCharge 65W GaN Fast Charger',
      'Brand*': 'Whatnot',
      'Category (Optional)': sampleCat,
      'Unit': 'PCS',
      'Description': 'Ultra-compact 65W GaN adapter',
      'Active Status (Yes/No)': 'Yes',
      'SKU (Optional)': '',
      'Company Code (Optional)': '',
      'Locations (Optional)': ''
    },
    {
      'Product Name*': 'Realme Buds Wireless 3',
      'Brand*': 'Realme',
      'Category (Optional)': categories[1]?.name || 'Audio',
      'Unit': 'PCS',
      'Description': '30dB Active Noise Cancellation Neckband',
      'Active Status (Yes/No)': 'Yes',
      'SKU (Optional)': '',
      'Company Code (Optional)': '',
      'Locations (Optional)': ''
    },
    {
      'Product Name*': 'Realme Buds Air 5 Pro',
      'Brand*': 'Realme',
      'Category (Optional)': categories[1]?.name || 'Audio',
      'Unit': 'PCS',
      'Description': '50dB Deep Sea Noise Cancellation 2.0 Earbuds',
      'Active Status (Yes/No)': 'Yes',
      'SKU (Optional)': '',
      'Company Code (Optional)': '',
      'Locations (Optional)': ''
    }
  ];

  const wsProducts = XLSX.utils.json_to_sheet(templateData);

  // Auto-fit column widths
  wsProducts['!cols'] = [
    { wch: 42 }, // Product Name
    { wch: 16 }, // Brand
    { wch: 22 }, // Category (Optional)
    { wch: 10 }, // Unit
    { wch: 45 }, // Description
    { wch: 22 }, // Active Status
    { wch: 22 }, // SKU (Optional)
    { wch: 26 }, // Company Code (Optional)
    { wch: 28 }  // Locations (Optional)
  ];

  XLSX.utils.book_append_sheet(wb, wsProducts, 'Products Import');

  // Sheet 2: Instructions
  const instructionsData = [
    { Instruction: '⚡ MINIMAL FORMAT: Only "Product Name" and "Brand" are required in your Excel sheet.' },
    { Instruction: 'SKU: Leave blank or omit. Unique, non-colliding SKUs are generated automatically on upload.' },
    { Instruction: 'Company Code: Leave blank or omit. Automatically matched to your partner billing company based on Brand (Brand Routing Matrix).' },
    { Instruction: 'Locations: Leave blank or omit. Automatically filled with covered Indian states mapped to that Brand.' },
    { Instruction: 'Category: Optional. Provide Category Name, Category Code, or Category ID. Matched automatically against your product categories.' },
    { Instruction: 'Unit: Optional. Recommended values: PCS, SET, BOX, PAIR, KG, MTR. Defaults to PCS.' },
    { Instruction: 'Active Status: Optional. Enter "Yes" or "No". Defaults to Yes.' },
    { Instruction: 'Manual Overrides: You can still provide custom SKU, Company Code, or Locations if you need specific overrides.' }
  ];
  const wsInstructions = XLSX.utils.json_to_sheet(instructionsData);
  wsInstructions['!cols'] = [{ wch: 105 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  // Sheet 3: Company Reference List (Optional for manual overrides)
  if (companies && companies.length > 0) {
    const compReferenceData = companies.map((c) => ({
      'Company Code': c.code || '',
      'Company Name': c.name,
      'Company ID': c._id
    }));
    const wsCompanies = XLSX.utils.json_to_sheet(compReferenceData);
    wsCompanies['!cols'] = [{ wch: 18 }, { wch: 35 }, { wch: 32 }];
    XLSX.utils.book_append_sheet(wb, wsCompanies, 'Company Reference (Optional)');
  }

  // Sheet 4: Category Reference List (Optional for manual overrides)
  if (categories && categories.length > 0) {
    const catReferenceData = categories.map((c) => ({
      'Category Code': c.code || '',
      'Category Name': c.name,
      'Category ID': c._id
    }));
    const wsCategories = XLSX.utils.json_to_sheet(catReferenceData);
    wsCategories['!cols'] = [{ wch: 18 }, { wch: 35 }, { wch: 32 }];
    XLSX.utils.book_append_sheet(wb, wsCategories, 'Category Reference (Optional)');
  }

  XLSX.writeFile(wb, 'Products_Bulk_Import_Template.xlsx');
};

// Interactive Cell Issue Indicator & Explanation Popover Component
const CellIssueTag = ({ issue, onQuickAction }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!issue) return null;

  const isError = issue.type === 'error';

  return (
    <div className="relative inline-block w-full mt-1">
      <div
        className={`flex items-center justify-between gap-1 px-2 py-0.5 rounded-md text-[10px] leading-tight border transition-all ${
          isError
            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25'
        }`}
      >
        <div
          className="flex items-center gap-1 min-w-0 cursor-pointer flex-1"
          onClick={() => setShowTooltip(!showTooltip)}
          title="Click to view why this cell has an issue and how to resolve it"
        >
          {isError ? (
            <FiAlertCircle className="shrink-0 text-rose-500 text-[11px]" />
          ) : (
            <FiAlertTriangle className="shrink-0 text-amber-500 text-[11px]" />
          )}
          <span className="truncate font-semibold">{issue.message}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {issue.actionType && onQuickAction && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickAction(issue.actionType);
              }}
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                isError
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                  : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
              }`}
              title={issue.fixSuggestion}
            >
              {issue.actionType === 'auto_generate_sku' ? '⚡ Fix SKU' : '✓ Fix'}
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(!showTooltip);
            }}
            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            title="Explain issue"
          >
            <FiInfo className="text-[11px]" />
          </button>
        </div>
      </div>

      {/* Floating Detailed Explanation Card */}
      {showTooltip && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowTooltip(false)}
          />
          <div className="absolute left-0 bottom-full mb-1.5 z-50 w-72 p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 text-left animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-white/10">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {issue.excelHeader}
                </span>
                <h5 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  {isError ? (
                    <span className="text-rose-500 flex items-center gap-1">
                      <FiAlertCircle /> Cell Error
                    </span>
                  ) : (
                    <span className="text-amber-500 flex items-center gap-1">
                      <FiAlertTriangle /> Cell Warning
                    </span>
                  )}
                  <span>• {issue.fieldLabel}</span>
                </h5>
              </div>
              <button
                type="button"
                onClick={() => setShowTooltip(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <FiX className="text-xs" />
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
              {issue.message}
            </p>
            {issue.detail && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                {issue.detail}
              </p>
            )}

            {issue.fixSuggestion && (
              <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 text-[11px] text-slate-600 dark:text-slate-300 mb-2.5">
                <span className="font-semibold text-slate-700 dark:text-slate-200 block mb-0.5">How to resolve:</span>
                {issue.fixSuggestion}
              </div>
            )}

            {issue.actionType && onQuickAction && (
              <button
                type="button"
                onClick={() => {
                  onQuickAction(issue.actionType);
                  setShowTooltip(false);
                }}
                className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isError
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                    : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                }`}
              >
                {issue.actionType === 'auto_generate_sku' ? (
                  <>
                    <FiZap />
                    <span>Auto-Generate Unique SKU</span>
                  </>
                ) : issue.actionType === 'set_all_states' ? (
                  <>
                    <FiCheck />
                    <span>Cover All Indian States</span>
                  </>
                ) : (
                  <span>Apply Quick Fix</span>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const BulkProductImportModal = ({
  isOpen,
  onClose,
  companies = [],
  categories = [],
  brandMatrix = [],
  existingProducts = [],
  onImportComplete
}) => {
  const fileInputRef = useRef(null);
  const [fetchedCompanies, setFetchedCompanies] = useState([]);
  const [fetchedBrandMatrix, setFetchedBrandMatrix] = useState([]);
  const [fetchedCategories, setFetchedCategories] = useState([]);

  // Auto-fetch categories if not passed from parent
  useEffect(() => {
    if (isOpen && (!categories || categories.length === 0)) {
      getCategoryApi()
        .then((res) => {
          const catData = res?.data?.data || (Array.isArray(res?.data) ? res.data : []);
          setFetchedCategories(catData);
        })
        .catch(() => {});
    }
  }, [categories, isOpen]);

  // Auto-fetch companies if not passed from parent
  useEffect(() => {
    if (!companies || companies.length === 0) {
      getCompaniesApi()
        .then((res) => {
          const compData = res?.data?.data || (Array.isArray(res?.data) ? res.data : []);
          setFetchedCompanies(compData);
        })
        .catch(() => {});
    }
  }, [companies, isOpen]);

  // Auto-fetch brand routing matrix if not passed from parent
  useEffect(() => {
    if (isOpen && (!brandMatrix || brandMatrix.length === 0)) {
      getBrandRoutingMatrixApi()
        .then((res) => {
          const matrix = res?.data?.data || (Array.isArray(res?.data) ? res.data : []);
          setFetchedBrandMatrix(matrix);
        })
        .catch(() => {});
    }
  }, [brandMatrix, isOpen]);

  // Normalize available categories list
  const resolvedCategories = useMemo(() => {
    if (categories && categories.length > 0) return categories;
    return fetchedCategories;
  }, [categories, fetchedCategories]);

  // Normalize available companies list
  const resolvedCompanies = useMemo(() => {
    if (companies && companies.length > 0) return companies;
    if (fetchedCompanies && fetchedCompanies.length > 0) return fetchedCompanies;
    return [];
  }, [companies, fetchedCompanies]);

  // Normalize available brand routing matrix
  const resolvedBrandMatrix = useMemo(() => {
    if (Array.isArray(brandMatrix) && brandMatrix.length > 0) return brandMatrix;
    return fetchedBrandMatrix;
  }, [brandMatrix, fetchedBrandMatrix]);

  // Steps: 'upload' | 'preview' | 'importing' | 'completed'
  const [step, setStep] = useState('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');

  // Data rows
  const [parsedRows, setParsedRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'valid' | 'issues'
  const [searchQuery, setSearchQuery] = useState('');

  // Import execution states
  const [progress, setProgress] = useState(0);
  const [currentImportIndex, setCurrentImportIndex] = useState(0);
  const [importResults, setImportResults] = useState({
    total: 0,
    successCount: 0,
    failedCount: 0,
    failedItems: []
  });

  // Set of existing catalog SKUs for instant lookups
  const existingCatalogSkus = useMemo(() => {
    return new Set(
      existingProducts
        .map((p) => (p.sku ? String(p.sku).trim().toUpperCase() : ''))
        .filter(Boolean)
    );
  }, [existingProducts]);

  // Re-run validation across all rows whenever parsedRows or resolvedCompanies change
  const validatedRows = useMemo(() => {
    return parsedRows.map((r) => {
      let rowCopy = { ...r };
      // If company was unmatched before but companies are now loaded, attempt re-matching
      if (!rowCopy.companyId && rowCopy.rawCompany && resolvedCompanies.length > 0) {
        const matched = matchCompany(rowCopy.rawCompany, resolvedCompanies);
        if (matched) {
          rowCopy.companyId = matched._id;
          rowCopy.companyName = matched.name;
          rowCopy.companyCode = matched.code || '';
        }
      }
      // If category was unmatched before but categories are now loaded, attempt re-matching
      if (!rowCopy.categoryId && rowCopy.rawCategory && resolvedCategories.length > 0) {
        const matchedCat = matchCategory(rowCopy.rawCategory, resolvedCategories);
        if (matchedCat) {
          rowCopy.categoryId = matchedCat._id;
          rowCopy.categoryName = matchedCat.name;
          rowCopy.categoryCode = matchedCat.code || '';
        }
      }
      return validateRow(rowCopy, parsedRows, existingCatalogSkus, resolvedCompanies, resolvedCategories);
    });
  }, [parsedRows, existingCatalogSkus, resolvedCompanies, resolvedCategories]);

  // Row Inspection state for deep-dive cell explanation modal
  const [inspectingRowId, setInspectingRowId] = useState(null);

  // Counts
  const validCount = useMemo(() => validatedRows.filter((r) => r.isValid).length, [validatedRows]);
  const issueCount = useMemo(() => validatedRows.filter((r) => !r.isValid || r.warnings.length > 0).length, [validatedRows]);
  const errorCount = useMemo(() => validatedRows.filter((r) => !r.isValid).length, [validatedRows]);
  const skuIssueCount = useMemo(() => validatedRows.filter((r) => r.cellIssues?.sku?.type === 'error').length, [validatedRows]);

  const inspectingRow = useMemo(() => {
    if (!inspectingRowId) return null;
    return validatedRows.find((r) => r.id === inspectingRowId) || null;
  }, [inspectingRowId, validatedRows]);

  // Filtered rows for the review table
  const displayRows = useMemo(() => {
    return validatedRows.filter((r) => {
      // Tab filter
      if (statusFilter === 'valid' && !r.isValid) return false;
      if (statusFilter === 'issues' && r.isValid && r.warnings.length === 0) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.name.toLowerCase().includes(q);
        const matchSku = r.sku.toLowerCase().includes(q);
        const matchBrand = r.brand.toLowerCase().includes(q);
        const matchCat = (r.categoryName || r.categoryCode || r.rawCategory || '').toLowerCase().includes(q);
        const matchComp = (r.companyName || r.companyCode || r.rawCompany || '').toLowerCase().includes(q);
        const matchLoc = (r.rawLocationsInput || '').toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchBrand && !matchCat && !matchComp && !matchLoc) return false;
      }

      return true;
    });
  }, [validatedRows, statusFilter, searchQuery]);

  // Reset modal state
  const handleReset = useCallback(() => {
    setStep('upload');
    setParsedRows([]);
    setFileName('');
    setFileSize('');
    setProgress(0);
    setCurrentImportIndex(0);
    setStatusFilter('all');
    setSearchQuery('');
    setInspectingRowId(null);
    setImportResults({
      total: 0,
      successCount: 0,
      failedCount: 0,
      failedItems: []
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleCloseModal = () => {
    if (step === 'importing') {
      const confirmAbort = window.confirm('Import is currently in progress. Are you sure you want to cancel?');
      if (!confirmAbort) return;
    }
    handleReset();
    onClose();
  };

  // Download Sample Excel Template
  const handleDownloadTemplate = async () => {
    let comps = resolvedCompanies;
    if (comps.length === 0) {
      try {
        const res = await getCompaniesApi();
        comps = res?.data?.data || (Array.isArray(res?.data) ? res.data : []);
        setFetchedCompanies(comps);
      } catch {
        // Ignore
      }
    }
    let cats = resolvedCategories;
    if (cats.length === 0) {
      try {
        const cRes = await getCategoryApi();
        cats = cRes?.data?.data || (Array.isArray(cRes?.data) ? cRes.data : []);
        setFetchedCategories(cats);
      } catch {
        // Ignore
      }
    }
    downloadProductExcelTemplate(comps, cats);
  };

  // Parse Excel or CSV file
  const processUploadedFile = async (file) => {
    if (!file) return;

    // Check extension
    const extension = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(extension)) {
      alert('Please upload a valid Excel (.xlsx, .xls) or CSV file.');
      return;
    }

    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');

    try {
      let comps = resolvedCompanies;
      if (comps.length === 0) {
        try {
          const res = await getCompaniesApi();
          comps = res?.data?.data || (Array.isArray(res?.data) ? res.data : []);
          setFetchedCompanies(comps);
        } catch {
          // Ignore
        }
      }

      let cats = resolvedCategories;
      if (cats.length === 0) {
        try {
          const cRes = await getCategoryApi();
          cats = cRes?.data?.data || (Array.isArray(cRes?.data) ? cRes.data : []);
          setFetchedCategories(cats);
        } catch {
          // Ignore
        }
      }

      let bMatrix = resolvedBrandMatrix;
      if (!bMatrix || bMatrix.length === 0) {
        try {
          const mRes = await getBrandRoutingMatrixApi();
          bMatrix = mRes?.data?.data || (Array.isArray(mRes?.data) ? mRes.data : []);
          setFetchedBrandMatrix(bMatrix);
        } catch {
          // Ignore
        }
      }

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (rawRows.length === 0) {
        alert('The uploaded spreadsheet appears to be empty.');
        return;
      }

      const usedSkusSet = new Set(existingCatalogSkus);
      const rows = rawRows.map((row, idx) => mapExcelRow(row, idx, comps, bMatrix, usedSkusSet, cats));
      setParsedRows(rows);
      setStep('preview');
    } catch (err) {
      console.error('Failed to parse spreadsheet:', err);
      alert('Failed to read the Excel file. Please ensure it is not corrupted or password protected.');
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  // Row editing handlers
  const handleRowChange = (id, field, value) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'sku') {
          updated.isSkuAutoGenerated = false;
        }
        if (field === 'brand') {
          // When brand changes, re-resolve from brand matrix
          const routed = resolveBrandRoutingForBulk(value, resolvedBrandMatrix, resolvedCompanies);
          if (routed) {
            updated.companyId = routed.primaryCompanyId;
            updated.companyName = routed.primaryCompanyName;
            updated.companyCode = routed.primaryCompanyCode;
            updated.locations = routed.locations;
            updated.rawLocationsInput = routed.locations.length === INDIAN_STATES.length ? 'ALL' : routed.locations.join(', ');
            updated.companyMappings = routed.companyMappings;
            updated.isAutoMappedFromMatrix = true;
            updated.routingSourceBrand = routed.sourceBrand;
          }
        }
        if (field === 'categoryId') {
          const selectedCat = resolvedCategories.find((c) => c._id === value);
          updated.categoryId = value;
          updated.categoryName = selectedCat ? selectedCat.name : '';
          updated.categoryCode = selectedCat ? (selectedCat.code || '') : '';
          updated.rawCategory = selectedCat ? (selectedCat.name || selectedCat.code) : '';
        }
        if (field === 'companyId') {
          const selectedComp = resolvedCompanies.find((c) => c._id === value);
          updated.companyName = selectedComp ? selectedComp.name : '';
          updated.companyCode = selectedComp ? (selectedComp.code || '') : '';
          updated.rawCompany = selectedComp ? (selectedComp.code || selectedComp.name) : '';
          updated.isAutoMappedFromMatrix = false;
          if (updated.companyMappings && updated.companyMappings.length > 0) {
            updated.companyMappings = updated.companyMappings.map((m, mIdx) =>
              mIdx === 0 ? { ...m, companyId: value } : m
            );
          } else {
            updated.companyMappings = [{ companyId: value, states: updated.locations || [] }];
          }
        }
        if (field === 'rawLocationsInput') {
          if (isAllKeyword(value)) {
            updated.locations = [...INDIAN_STATES];
            updated.rawLocationsInput = value;
          } else {
            updated.locations = parseLocationInput(value);
            updated.rawLocationsInput = value;
          }
          if (updated.companyMappings && updated.companyMappings.length > 0) {
            updated.companyMappings = updated.companyMappings.map((m, mIdx) =>
              mIdx === 0 ? { ...m, states: updated.locations } : m
            );
          }
        }
        return updated;
      })
    );
  };

  const handleSetRowLocationsAll = (rowId) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const isCurrentlyAll = r.locations.length === INDIAN_STATES.length;
        const nextLocs = isCurrentlyAll ? [] : [...INDIAN_STATES];
        const nextInput = isCurrentlyAll ? '' : 'ALL';
        const nextMappings = r.companyMappings && r.companyMappings.length > 0
          ? r.companyMappings.map((m, mIdx) => (mIdx === 0 ? { ...m, states: nextLocs } : m))
          : [{ companyId: r.companyId, states: nextLocs }];
        return {
          ...r,
          locations: nextLocs,
          rawLocationsInput: nextInput,
          companyMappings: nextMappings
        };
      })
    );
  };

  const handleSetAllRowsAllLocations = () => {
    setParsedRows((prev) =>
      prev.map((r) => ({
        ...r,
        locations: [...INDIAN_STATES],
        rawLocationsInput: 'ALL',
        companyMappings: r.companyMappings && r.companyMappings.length > 0
          ? r.companyMappings.map((m, mIdx) => (mIdx === 0 ? { ...m, states: [...INDIAN_STATES] } : m))
          : [{ companyId: r.companyId, states: [...INDIAN_STATES] }]
      }))
    );
  };

  // Re-map all rows according to their brands via Brand Routing Matrix
  const handleAutoMapAllByMatrix = () => {
    setParsedRows((prev) =>
      prev.map((r) => {
        const routed = resolveBrandRoutingForBulk(r.brand, resolvedBrandMatrix, resolvedCompanies);
        if (routed) {
          return {
            ...r,
            companyId: routed.primaryCompanyId,
            companyName: routed.primaryCompanyName,
            companyCode: routed.primaryCompanyCode,
            locations: routed.locations,
            rawLocationsInput: routed.locations.length === INDIAN_STATES.length ? 'ALL' : routed.locations.join(', '),
            companyMappings: routed.companyMappings,
            isAutoMappedFromMatrix: true,
            routingSourceBrand: routed.sourceBrand
          };
        }
        return r;
      })
    );
  };

  // Auto-generate clean unique SKU for a specific row
  const handleAutoGenerateSkuForRow = (rowId) => {
    setParsedRows((prev) => {
      const existingSet = new Set(existingCatalogSkus);
      prev.forEach((r) => {
        if (r.id !== rowId && r.sku) existingSet.add(r.sku.trim().toUpperCase());
      });
      return prev.map((r, idx) => {
        if (r.id !== rowId) return r;
        const newSku = generateUniqueSku(r.name, r.brand, idx, existingSet);
        return {
          ...r,
          sku: newSku,
          isSkuAutoGenerated: true
        };
      });
    });
  };

  // Auto-fix all rows that have duplicate or missing SKUs
  const handleAutoFixAllSkus = () => {
    setParsedRows((prev) => {
      const existingSet = new Set(existingCatalogSkus);
      const seen = new Set();
      const rowsToRegenerate = new Set();

      prev.forEach((r) => {
        const s = (r.sku || '').trim().toUpperCase();
        if (!s || seen.has(s)) {
          rowsToRegenerate.add(r.id);
        } else {
          seen.add(s);
          existingSet.add(s);
        }
      });

      return prev.map((r, idx) => {
        if (!rowsToRegenerate.has(r.id)) return r;
        const newSku = generateUniqueSku(r.name, r.brand, idx, existingSet);
        return {
          ...r,
          sku: newSku,
          isSkuAutoGenerated: true
        };
      });
    });
  };

  const handleDeleteRow = (id) => {
    setParsedRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddNewRow = () => {
    const newIndex = parsedRows.length;
    const defaultComp = resolvedCompanies[0] || null;
    const newRow = {
      id: `manual-row-${Date.now()}`,
      rowIndex: newIndex + 1,
      name: '',
      sku: '',
      brand: 'Realme',
      categoryId: '',
      categoryName: '',
      categoryCode: '',
      rawCategory: '',
      unit: 'PCS',
      companyId: defaultComp?._id || '',
      companyName: defaultComp?.name || '',
      companyCode: defaultComp?.code || '',
      rawCompany: defaultComp?.code || defaultComp?.name || '',
      locations: [],
      rawLocationsInput: '',
      description: '',
      isActive: true,
      isSkuAutoGenerated: false,
      errors: [],
      warnings: []
    };
    setParsedRows((prev) => [...prev, newRow]);
    setStatusFilter('all');
  };

  // Start Batch Import
  const handleStartImport = async () => {
    const rowsToImport = validatedRows.filter((r) => r.isValid);

    if (rowsToImport.length === 0) {
      alert('There are no valid products to import. Please review and fix the errors highlighted below.');
      return;
    }

    setStep('importing');
    setProgress(0);
    setCurrentImportIndex(0);

    const total = rowsToImport.length;
    let successCount = 0;
    let failedCount = 0;
    const failedItems = [];

    // Attempt backend bulk API first if available, else process in batches
    let bulkSuccess = false;
    try {
      const payloadArray = rowsToImport.map((r) => ({
        name: r.name.trim(),
        sku: r.sku.trim().toUpperCase(),
        brand: r.brand.trim() || 'Realme',
        categoryId: r.categoryId || undefined,
        companyId: r.companyId,
        locations: Array.isArray(r.locations) ? r.locations : [],
        companyMappings: Array.isArray(r.companyMappings) && r.companyMappings.length > 0
          ? r.companyMappings.map((m) => ({ companyId: m.companyId, states: m.states || [] }))
          : [{ companyId: r.companyId, states: Array.isArray(r.locations) ? r.locations : [] }],
        unit: r.unit.trim() || 'PCS',
        description: r.description.trim(),
        isActive: Boolean(r.isActive)
      }));

      const res = await bulkCreateProductsApi(payloadArray);
      if (res?.status === 200 || res?.status === 201) {
        bulkSuccess = true;
        successCount = total;
        setProgress(100);
      }
    } catch {
      bulkSuccess = false;
    }

    if (!bulkSuccess) {
      const CONCURRENCY = 3;
      for (let i = 0; i < total; i += CONCURRENCY) {
        const chunk = rowsToImport.slice(i, i + CONCURRENCY);
        await Promise.all(
          chunk.map(async (row, chunkIdx) => {
            const currentNumber = i + chunkIdx + 1;
            setCurrentImportIndex(currentNumber);
            try {
              const payload = {
                name: row.name.trim(),
                sku: row.sku.trim().toUpperCase(),
                brand: row.brand.trim() || 'Realme',
                categoryId: row.categoryId || undefined,
                companyId: row.companyId,
                locations: Array.isArray(row.locations) ? row.locations : [],
                companyMappings: Array.isArray(row.companyMappings) && row.companyMappings.length > 0
                  ? row.companyMappings.map((m) => ({ companyId: m.companyId, states: m.states || [] }))
                  : [{ companyId: row.companyId, states: Array.isArray(row.locations) ? row.locations : [] }],
                unit: row.unit.trim() || 'PCS',
                description: row.description.trim(),
                isActive: Boolean(row.isActive)
              };

              await createProductApi(payload);
              successCount++;
            } catch (err) {
              failedCount++;
              const errorMessage =
                err.response?.data?.message ||
                err.response?.data?.error ||
                'Server error creating product.';
              failedItems.push({
                ...row,
                errorMessage
              });
            }
          })
        );

        const currentProgress = Math.min(100, Math.round(((i + chunk.length) / total) * 100));
        setProgress(currentProgress);
      }
    }

    setImportResults({
      total,
      successCount,
      failedCount,
      failedItems
    });

    setStep('completed');
    if (onImportComplete && successCount > 0) {
      onImportComplete(successCount);
    }
  };

  // Export failed rows as Excel for correction
  const handleExportFailedRows = () => {
    if (importResults.failedItems.length === 0) return;
    const exportData = importResults.failedItems.map((item) => ({
      'Product Name*': item.name,
      'SKU*': item.sku,
      'Brand*': item.brand,
      'Company Code*': item.companyCode || item.companyName || item.rawCompany,
      'Locations (comma-separated)': item.rawLocationsInput,
      'Unit': item.unit,
      'Description': item.description,
      'Active Status (Yes/No)': item.isActive ? 'Yes' : 'No',
      'Import Failure Reason': item.errorMessage
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 35 },
      { wch: 20 },
      { wch: 16 },
      { wch: 20 },
      { wch: 40 },
      { wch: 10 },
      { wch: 35 },
      { wch: 20 },
      { wch: 45 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Failed Items');
    XLSX.writeFile(wb, `Import_Errors_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* ================= MODAL HEADER ================= */}
        <div className="p-5 sm:px-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <FiUploadCloud className="text-xl" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Bulk Products Import
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20">
                  Excel (.xlsx / .csv)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Upload catalog spreadsheets mapped to trading company codes and distribution territories.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        {/* ================= STEP 1: UPLOAD ================= */}
        {step === 'upload' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Quick Template Download Banner */}
            <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-indigo-500/10 rounded-2xl border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FiFileText className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Need the formatted Excel template?
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl">
                  Download our ready-to-use template pre-filled with sample product rows and reference list of partner company codes.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer shrink-0"
              >
                <FiDownload className="text-sm" />
                <span>Download Excel Template</span>
              </button>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[0.99]'
                  : 'border-slate-300 dark:border-white/15 bg-slate-50/50 dark:bg-white/5 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl shadow-inner">
                <FiUploadCloud />
              </div>

              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Drag and drop your spreadsheet here, or <span className="text-emerald-600 dark:text-emerald-400 underline">browse</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv) up to 25MB
                </p>
              </div>

              <div className="flex items-center gap-4 mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex-wrap justify-center">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <FiZap /> Minimal 2-column format supported
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <FiZap /> SKU auto-generated
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <FiZap /> Company auto-matched
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <FiZap /> States auto-filled
                </span>
              </div>
            </div>

            {/* Instruction Checklist */}
            <div className="bg-slate-100/40 dark:bg-white/5 rounded-2xl p-4 border border-slate-200/60 dark:border-white/5">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                <FiInfo className="text-blue-500" />
                <span>Spreadsheet Column Guidelines</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-400">
                <div className="space-y-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Product Name*</span>
                  <p className="text-[11px]">Full title of the product (e.g. Realme Buds Wireless 3).</p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Brand*</span>
                  <p className="text-[11px]">Brand name (e.g. Realme) used to route company & covered states.</p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <FiZap className="text-xs" /> SKU (Auto-Generated)
                  </span>
                  <p className="text-[11px]">Not needed in Excel. Unique, clean SKUs are generated automatically.</p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <FiZap className="text-xs" /> Company (Auto-Matched)
                  </span>
                  <p className="text-[11px]">Not needed in Excel. Automatically resolved from Brand Routing Matrix.</p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <FiZap className="text-xs" /> States (Auto-Filled)
                  </span>
                  <p className="text-[11px]">Not needed in Excel. Automatically mapped with states assigned to the brand.</p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Unit & Description</span>
                  <p className="text-[11px]">Unit defaults to "PCS". Description is optional.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 2: PREVIEW & INLINE EDITING ================= */}
        {step === 'preview' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Top Stats & Filters Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    All Rows ({validatedRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('valid')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === 'valid'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600'
                    }`}
                  >
                    <FiCheckCircle className="text-emerald-500" />
                    <span>Valid ({validCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('issues')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === 'issues'
                        ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-rose-600'
                    }`}
                  >
                    <FiAlertTriangle className="text-amber-500" />
                    <span>Needs Attention ({issueCount})</span>
                  </button>
                </div>

                <span className="text-xs text-slate-400 hidden sm:inline">
                  File: <strong className="text-slate-700 dark:text-slate-200">{fileName}</strong> ({fileSize})
                </span>
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                {/* Search */}
                <div className="relative w-full md:w-48">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter preview..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {skuIssueCount > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoFixAllSkus}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0"
                    title="Automatically generate non-colliding unique SKUs for all rows with duplicate or missing SKUs"
                  >
                    <FiZap className="text-xs" />
                    <span>Auto-Fix SKUs ({skuIssueCount})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleAutoMapAllByMatrix}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0"
                  title="Auto-map partner company and state coverage for all rows based on their brand from the Brand Routing Matrix"
                >
                  <FiZap className="text-xs" />
                  <span>Auto-Map Matrix</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddNewRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0"
                >
                  <FiPlus />
                  <span>Add Row</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0"
                  title="Upload a different file"
                >
                  <FiRefreshCw className="text-xs" />
                  <span className="hidden sm:inline">Change File</span>
                </button>
              </div>
            </div>

            {/* Notification alert if there are errors */}
            {errorCount > 0 && (
              <div className="px-5 py-2.5 bg-rose-500/10 border-b border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-between gap-4 text-xs font-medium">
                <div className="flex items-center gap-2">
                  <FiAlertCircle className="text-sm shrink-0" />
                  <span>
                    <strong>{errorCount} row{errorCount > 1 ? 's have' : ' has'} validation errors.</strong> Each problematic cell is highlighted with an explanation badge. Click any cell badge or row status to view explanations and quick fixes.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {skuIssueCount > 0 && (
                    <button
                      type="button"
                      onClick={handleAutoFixAllSkus}
                      className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 text-white text-[11px] font-bold rounded-lg hover:bg-rose-700 transition-all cursor-pointer shadow-xs"
                      title="Auto-generate non-colliding SKUs for all rows with duplicate or missing SKUs"
                    >
                      <FiZap />
                      <span>Fix {skuIssueCount} SKU{skuIssueCount > 1 ? 's' : ''}</span>
                    </button>
                  )}
                  {statusFilter !== 'issues' && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('issues')}
                      className="text-xs font-bold underline hover:no-underline cursor-pointer"
                    >
                      View Issues
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Review Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-white/10">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3 w-24">Status</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Product Name*</th>
                    <th className="py-2.5 px-3 min-w-[130px]">SKU Code*</th>
                    <th className="py-2.5 px-3 min-w-[100px]">Brand*</th>
                    <th className="py-2.5 px-3 min-w-[150px]">Category</th>
                    <th className="py-2.5 px-3 min-w-[150px]">Company*</th>
                    <th className="py-2.5 px-3 min-w-[190px]">
                      <div className="flex items-center justify-between gap-1.5">
                        <span>Covered Locations</span>
                        <button
                          type="button"
                          onClick={handleSetAllRowsAllLocations}
                          className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 transition-all cursor-pointer"
                          title="Set all imported products to ALL Indian states"
                        >
                          All ({INDIAN_STATES.length})
                        </button>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[80px]">Unit</th>
                    <th className="py-2.5 px-3 w-20 text-center">Active</th>
                    <th className="py-2.5 px-3 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {displayRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        No rows found matching current filter or search criteria.
                      </td>
                    </tr>
                  ) : (
                    displayRows.map((row) => {
                      const hasErrors = row.errors.length > 0;
                      const hasWarnings = row.warnings.length > 0;

                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors ${
                            hasErrors
                              ? 'bg-rose-500/5'
                              : hasWarnings
                              ? 'bg-amber-500/5'
                              : ''
                          }`}
                        >
                          {/* Row Number */}
                          <td className="py-2 px-3 text-center font-mono text-slate-400 text-[11px]">
                            {row.rowIndex}
                          </td>

                          {/* Status Badge */}
                          <td className="py-2 px-3">
                            <button
                              type="button"
                              onClick={() => setInspectingRowId(row.id)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-[10px] transition-all cursor-pointer shadow-xs ${
                                hasErrors
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                  : hasWarnings
                                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              }`}
                              title="Click to view cell issues breakdown for this row"
                            >
                              {hasErrors ? (
                                <>
                                  <FiAlertCircle className="shrink-0 text-rose-500" />
                                  <span>{row.errors.length} {row.errors.length === 1 ? 'Error' : 'Errors'}</span>
                                </>
                              ) : hasWarnings ? (
                                <>
                                  <FiAlertTriangle className="shrink-0 text-amber-500" />
                                  <span>{row.warnings.length} {row.warnings.length === 1 ? 'Warning' : 'Warnings'}</span>
                                </>
                              ) : (
                                <>
                                  <FiCheck className="shrink-0 text-emerald-500" />
                                  <span>Ready</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Product Name */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => handleRowChange(row.id, 'name', e.target.value)}
                              placeholder="Product Title..."
                              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-hidden transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white ${
                                row.cellIssues?.name?.type === 'error'
                                  ? 'border-rose-500 bg-rose-500/[0.03] focus:ring-1 focus:ring-rose-500'
                                  : row.cellIssues?.name?.type === 'warning'
                                  ? 'border-amber-400 bg-amber-500/[0.03] focus:ring-1 focus:ring-amber-400'
                                  : 'border-slate-200 dark:border-white/10 focus:border-emerald-500'
                              }`}
                            />
                            <CellIssueTag issue={row.cellIssues?.name} />
                          </td>

                          {/* SKU */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.sku}
                              onChange={(e) => handleRowChange(row.id, 'sku', e.target.value.toUpperCase())}
                              placeholder="SKU-CODE"
                              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono uppercase focus:outline-hidden transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white ${
                                row.cellIssues?.sku?.type === 'error'
                                  ? 'border-rose-500 bg-rose-500/[0.03] focus:ring-1 focus:ring-rose-500'
                                  : row.cellIssues?.sku?.type === 'warning'
                                  ? 'border-amber-400 bg-amber-500/[0.03] focus:ring-1 focus:ring-amber-400'
                                  : 'border-slate-200 dark:border-white/10 focus:border-emerald-500'
                              }`}
                            />
                            {row.cellIssues?.sku ? (
                              <CellIssueTag
                                issue={row.cellIssues.sku}
                                onQuickAction={(action) => {
                                  if (action === 'auto_generate_sku') handleAutoGenerateSkuForRow(row.id);
                                }}
                              />
                            ) : row.isSkuAutoGenerated ? (
                              <span
                                className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5 mt-0.5"
                                title="Unique SKU auto-generated from Brand and Product Name"
                              >
                                <FiZap className="text-[9px] shrink-0 text-emerald-500" /> Auto-generated
                              </span>
                            ) : null}
                          </td>

                          {/* Brand */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.brand}
                              onChange={(e) => handleRowChange(row.id, 'brand', e.target.value)}
                              placeholder="Realme"
                              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden transition-all ${
                                row.cellIssues?.brand?.type === 'error'
                                  ? 'border-rose-500 bg-rose-500/[0.03]'
                                  : row.cellIssues?.brand?.type === 'warning'
                                  ? 'border-amber-400 bg-amber-500/[0.03]'
                                  : 'border-slate-200 dark:border-white/10 focus:border-emerald-500'
                              }`}
                            />
                            {row.cellIssues?.brand ? (
                              <CellIssueTag issue={row.cellIssues.brand} />
                            ) : row.isAutoMappedFromMatrix ? (
                              <span
                                className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-0.5 mt-0.5"
                                title={`Matrix rule matched: ${row.routingSourceBrand || 'ALL'}`}
                              >
                                <FiZap className="text-[9px] shrink-0 text-indigo-500" /> Matrix rule
                              </span>
                            ) : null}
                          </td>

                          {/* Category Dropdown */}
                          <td className="py-2 px-3">
                            <CustomDropdown
                              value={row.categoryId || ''}
                              onChange={(val) => handleRowChange(row.id, 'categoryId', val)}
                              defaultLabel="No Category"
                              options={[
                                { value: '', label: 'No Category (None)' },
                                ...resolvedCategories.map((c) => ({
                                  value: c._id,
                                  label: `${c.name} ${c.code ? `(${c.code})` : ''}`
                                }))
                              ]}
                              statusColor={`!px-2 !py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 ${
                                row.cellIssues?.categoryId?.type === 'error'
                                  ? '!border-rose-500 bg-rose-500/[0.03]'
                                  : row.cellIssues?.categoryId?.type === 'warning'
                                  ? '!border-amber-400 bg-amber-500/[0.03]'
                                  : '!border-slate-200 dark:!border-white/10'
                              }`}
                            />
                            <CellIssueTag issue={row.cellIssues?.categoryId} />
                          </td>

                          {/* Company Dropdown */}
                          <td className="py-2 px-3">
                            <CustomDropdown
                              value={row.companyId || ''}
                              onChange={(val) => handleRowChange(row.id, 'companyId', val)}
                              defaultLabel="Select Company"
                              options={[
                                { value: '', label: 'Select Company' },
                                ...resolvedCompanies.map((c) => ({
                                  value: c._id,
                                  label: `${c.name} ${c.code ? `(${c.code})` : ''}`
                                }))
                              ]}
                              statusColor={`!px-2 !py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 ${
                                row.cellIssues?.companyId?.type === 'error'
                                  ? '!border-rose-500 bg-rose-500/[0.03]'
                                  : row.cellIssues?.companyId?.type === 'warning'
                                  ? '!border-amber-400 bg-amber-500/[0.03]'
                                  : '!border-slate-200 dark:!border-white/10'
                              }`}
                            />
                            {row.cellIssues?.companyId ? (
                              <CellIssueTag issue={row.cellIssues.companyId} />
                            ) : row.isAutoMappedFromMatrix && row.companyId ? (
                              <span
                                className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5 truncate"
                                title={`Auto-routed by Brand Routing Matrix (Source: ${row.routingSourceBrand || 'Brand'})`}
                              >
                                <FiZap className="text-[9px] shrink-0 text-emerald-500" /> Auto-routed by brand
                              </span>
                            ) : null}
                          </td>

                          {/* Covered Locations */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={row.rawLocationsInput || ''}
                                onChange={(e) => handleRowChange(row.id, 'rawLocationsInput', e.target.value)}
                                placeholder='e.g. ALL or Delhi, Haryana'
                                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden ${
                                  row.cellIssues?.locations?.type === 'error'
                                    ? 'border-rose-500 bg-rose-500/[0.03]'
                                    : row.cellIssues?.locations?.type === 'warning'
                                    ? 'border-amber-400 bg-amber-500/[0.03]'
                                    : 'border-slate-200 dark:border-white/10 focus:border-emerald-500'
                                }`}
                                title='Comma-separated distribution locations, or type "ALL" for all states'
                              />
                              <button
                                type="button"
                                onClick={() => handleSetRowLocationsAll(row.id)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer shrink-0 ${
                                  row.locations.length === INDIAN_STATES.length
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                                }`}
                                title={row.locations.length === INDIAN_STATES.length ? 'Clear all locations' : 'Set to ALL states'}
                              >
                                {row.locations.length === INDIAN_STATES.length ? '✓ All' : 'All'}
                              </button>
                            </div>
                            {row.cellIssues?.locations ? (
                              <CellIssueTag
                                issue={row.cellIssues.locations}
                                onQuickAction={(action) => {
                                  if (action === 'set_all_states') handleSetRowLocationsAll(row.id);
                                }}
                              />
                            ) : row.locations.length === INDIAN_STATES.length ? (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block mt-0.5">
                                ✓ All states covered ({row.locations.length})
                              </span>
                            ) : row.locations.length > 0 ? (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {row.locations.length} {row.locations.length === 1 ? 'state' : 'states'} mapped
                              </span>
                            ) : null}
                          </td>

                          {/* Unit */}
                          <td className="py-2 px-3">
                            <CustomDropdown
                              value={row.unit}
                              onChange={(val) => handleRowChange(row.id, 'unit', val)}
                              options={[
                                ...COMMON_UNITS.map((u) => ({ value: u, label: u })),
                                ...(!COMMON_UNITS.includes(row.unit) && row.unit ? [{ value: row.unit, label: row.unit }] : [])
                              ]}
                              statusColor={`!px-2 !py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 ${
                                row.cellIssues?.unit?.type === 'error'
                                  ? '!border-rose-500 bg-rose-500/[0.03]'
                                  : row.cellIssues?.unit?.type === 'warning'
                                  ? '!border-amber-400 bg-amber-500/[0.03]'
                                  : '!border-slate-200 dark:!border-white/10'
                              }`}
                            />
                            <CellIssueTag issue={row.cellIssues?.unit} />
                          </td>

                          {/* Active Toggle */}
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRowChange(row.id, 'isActive', !row.isActive)}
                              className={`w-9 h-5 inline-flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                                row.isActive ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                              }`}
                            >
                              <div
                                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                                  row.isActive ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>

                          {/* Action (Delete row) */}
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all cursor-pointer"
                              title="Remove from import"
                            >
                              <FiTrash2 className="text-xs" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Action Footer for Preview */}
            <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Ready to import: <strong className="text-emerald-600 dark:text-emerald-400">{validCount}</strong> products
                </span>
                {errorCount > 0 && (
                  <span className="ml-2 text-rose-500 font-semibold">
                    ({errorCount} invalid rows will be skipped)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartImport}
                  disabled={validCount === 0}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Import {validCount} Product{validCount !== 1 ? 's' : ''}</span>
                  <FiArrowRight className="text-sm" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: IMPORTING PROGRESS ================= */}
        {step === 'importing' && (
          <div className="flex-1 p-10 flex flex-col items-center justify-center space-y-6 text-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl animate-pulse">
                <FiPackage />
              </div>
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
              </span>
            </div>

            <div className="space-y-1 max-w-sm">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Importing Catalog Products...
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Processing item {currentImportIndex} of {validCount}. Please do not close or refresh this window.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md space-y-2">
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/80 dark:border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                <span>{progress}% Completed</span>
                <span>{validCount} Total Valid Rows</span>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 4: COMPLETED SUMMARY ================= */}
        {step === 'completed' && (
          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center space-y-6 text-center">
            <div
              className={`w-20 h-20 rounded-3xl flex items-center justify-center text-3xl shadow-xl ${
                importResults.failedCount === 0
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}
            >
              {importResults.failedCount === 0 ? <FiCheckCircle /> : <FiAlertTriangle />}
            </div>

            <div className="space-y-1 max-w-md">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                {importResults.failedCount === 0
                  ? 'Bulk Import Completed Successfully!'
                  : 'Import Completed with Some Issues'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {importResults.successCount} product{importResults.successCount !== 1 ? 's were' : ' was'} successfully added to the catalog.
              </p>
            </div>

            {/* Scorecard */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-md">
              <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-center">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                  Successfully Imported
                </span>
                <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {importResults.successCount}
                </span>
              </div>
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/10 text-center">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Failed Items
                </span>
                <span
                  className={`text-2xl font-extrabold mt-1 block ${
                    importResults.failedCount > 0 ? 'text-rose-500' : 'text-slate-400'
                  }`}
                >
                  {importResults.failedCount}
                </span>
              </div>
            </div>

            {/* Failed Items List & Export Button */}
            {importResults.failedCount > 0 && (
              <div className="w-full max-w-md space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Failed Products Breakdown:
                  </span>
                  <button
                    type="button"
                    onClick={handleExportFailedRows}
                    className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <FiDownload />
                    <span>Download Failed Rows (.xlsx)</span>
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 p-3 bg-rose-500/5 rounded-2xl border border-rose-500/20 text-xs">
                  {importResults.failedItems.map((fail, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {fail.name} ({fail.sku})
                      </span>
                      <span className="text-rose-500 shrink-0 text-[10px]">
                        {fail.errorMessage}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Import Another File
              </button>
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/25 cursor-pointer"
              >
                Done & View Catalog
              </button>
            </div>
          </div>
        )}

        {/* ================= ROW CELL ISSUES INSPECTOR MODAL ================= */}
        {inspectingRow && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="p-4 px-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
                <div className="flex items-center gap-3">
                  <span className={`p-2 rounded-xl text-lg ${
                    inspectingRow.errors.length > 0
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : inspectingRow.warnings.length > 0
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {inspectingRow.errors.length > 0 ? (
                      <FiAlertCircle />
                    ) : inspectingRow.warnings.length > 0 ? (
                      <FiAlertTriangle />
                    ) : (
                      <FiCheckCircle />
                    )}
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      Row #{inspectingRow.rowIndex} • Cell Issues Inspector
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                      {inspectingRow.name || '<Untitled Product>'} ({inspectingRow.sku || 'No SKU'})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingRowId(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              {/* Issues Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {Object.keys(inspectingRow.cellIssues || {}).length === 0 ? (
                  <div className="text-center py-8">
                    <FiCheckCircle className="text-4xl text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-800 dark:text-white">All cells in this row are valid!</p>
                    <p className="text-xs text-slate-500 mt-1">Ready to be imported into the product catalog.</p>
                  </div>
                ) : (
                  Object.values(inspectingRow.cellIssues).map((issue, idx) => {
                    const isErr = issue.type === 'error';
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition-all ${
                          isErr
                            ? 'bg-rose-500/5 border-rose-500/25'
                            : 'bg-amber-500/5 border-amber-500/25'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                                  isErr
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {isErr ? 'Error' : 'Warning'}
                              </span>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {issue.fieldLabel}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                (Column: {issue.excelHeader})
                              </span>
                            </div>

                            <p className="text-xs font-semibold text-slate-900 dark:text-white pt-1">
                              {issue.message}
                            </p>

                            {issue.detail && (
                              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                {issue.detail}
                              </p>
                            )}

                            {issue.fixSuggestion && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 italic">
                                💡 Suggestion: {issue.fixSuggestion}
                              </p>
                            )}
                          </div>

                          {issue.actionType && (
                            <div className="shrink-0 pt-1">
                              {issue.actionType === 'auto_generate_sku' && (
                                <button
                                  type="button"
                                  onClick={() => handleAutoGenerateSkuForRow(inspectingRow.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                                >
                                  <FiZap className="text-xs" />
                                  <span>Fix SKU</span>
                                </button>
                              )}
                              {issue.actionType === 'set_all_states' && (
                                <button
                                  type="button"
                                  onClick={() => handleSetRowLocationsAll(inspectingRow.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                                >
                                  <FiCheck className="text-xs" />
                                  <span>Set All States</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 px-6 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  You can edit values directly in the preview table.
                </span>
                <button
                  type="button"
                  onClick={() => setInspectingRowId(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkProductImportModal;
