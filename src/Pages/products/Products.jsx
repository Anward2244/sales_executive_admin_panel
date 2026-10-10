import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiX,
  FiSave,
  FiPackage,
  FiEye,
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiDownload,
  FiTag,
  FiLayers,
  FiFilter,
  FiChevronDown,
  FiFileText,
  FiUploadCloud,
  FiBriefcase,
  FiMapPin,
  FiGlobe,
  FiChevronLeft,
  FiChevronRight,
  FiGitBranch,
  FiZap,
  FiExternalLink,
  FiCalendar,
  FiLoader
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import BulkProductImportModal, { downloadProductExcelTemplate } from './BulkProductImportModal';
import PageHeader from '@/components/ui/PageHeader';
import { TableSkeleton } from '@/components/ui/Skeleton';
import CopyButton from '@/components/ui/CopyButton';
import CustomDropdown from '@/components/ui/CustomDropdown';
import { BulkActionBar, BatchProgressModal } from '@/components/ui';
import { useDisplayPreferences } from '@/utils/displayPreferences';
import {
  getProductsApi,
  createProductApi,
  updateProductApi,
  deleteProductApi,
  getCompaniesApi,
  getBrandRoutingMatrixApi,
  getBrandRoutingByBrandApi,
  getCategoryApi
} from '@/api/axios';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import { useDebounce } from '@/hooks/useDebounce';
import { formatEntityCode } from '@/utils/formatters';
import { validateEntityCode } from '@/utils/validators';
import { INDIAN_STATES, POPULAR_STATES, isAllKeyword } from '@/utils/indianStates';


// Initial form state for Add/Edit product according to new schema
const INITIAL_PRODUCT_FORM = {
  name: '',
  sku: '',
  brand: 'Realme',
  categoryId: '',
  companyId: '',
  price: '',
  locations: [],
  companyMappings: [],
  unit: 'PCS',
  description: '',
  isActive: true
};

const Products = () => {
  // Data States
  const [products, setProducts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brandMatrix, setBrandMatrix] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('ALL');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'name-asc'

  // Pagination State
  const { preferences: displayPrefs } = useDisplayPreferences();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = displayPrefs.rowsPerPage || 10;

  // Drawer, Form & Modal States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('overview'); // 'overview' | 'edit'
  const [drawerProduct, setDrawerProduct] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const actionsDropdownRef = useRef(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(INITIAL_PRODUCT_FORM);
  const [customLocationInput, setCustomLocationInput] = useState('');
  const [customMappingInputs, setCustomMappingInputs] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-Mapping from Brand Routing Matrix States
  const [isAutoMappingBrand, setIsAutoMappingBrand] = useState(false);
  const [autoMappedBanner, setAutoMappedBanner] = useState(null);

  // Delete Confirm Modal
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk Operations State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isBulkCompanyModalOpen, setIsBulkCompanyModalOpen] = useState(false);
  const [bulkTargetCompanyId, setBulkTargetCompanyId] = useState('');
  const [isBulkLocationModalOpen, setIsBulkLocationModalOpen] = useState(false);
  const [bulkLocationMode, setBulkLocationMode] = useState('sync-matrix'); // 'sync-matrix' | 'replace' | 'append' | 'all' | 'clear'
  const [bulkLocations, setBulkLocations] = useState([]);
  const [bulkCustomLocationInput, setBulkCustomLocationInput] = useState('');
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState({
    updateCategory: false,
    categoryId: '',
    updateBrand: false,
    brand: '',
    updatePrice: false,
    priceMode: 'fixed',
    priceValue: '',
    updateUnit: false,
    unit: 'PCS',
    updateStatus: false,
    isActive: true,
    syncLocationsWithMatrix: false
  });
  const [batchProgress, setBatchProgress] = useState(null);
  const abortBatchRef = useRef(false);

  // Toast State
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleImportComplete = (count) => {
    fetchData(true);
    showToast(`Successfully imported ${count} products into catalog!`);
  };

  // Close Actions Dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(e.target)) {
        setIsActionsOpen(false);
      }
    };
    if (isActionsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isActionsOpen]);

  // Fetch products, companies, categories & brand routing matrix
  const fetchData = useCallback(async (isSilent = false) => {
    if (isSilent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [prodRes, compRes, matrixRes, catRes] = await Promise.all([
        getProductsApi(),
        getCompaniesApi().catch(() => ({ data: [] })),
        getBrandRoutingMatrixApi().catch(() => ({ data: [] })),
        getCategoryApi().catch(() => ({ data: [] }))
      ]);

      const prodData = prodRes?.data?.data || (Array.isArray(prodRes?.data) ? prodRes?.data : []);
      const compData = compRes?.data?.data || (Array.isArray(compRes?.data) ? compRes?.data : []);
      const matrixData = matrixRes?.data?.data || (Array.isArray(matrixRes?.data) ? matrixRes?.data : []);
      const catData = catRes?.data?.data || (Array.isArray(catRes?.data) ? catRes?.data : []);

      setProducts(prodData);
      setCompanies(compData);
      setBrandMatrix(matrixData);
      setCategories(catData);
    } catch (err) {
      console.error('Failed to load products:', err);
      setError(err.response?.data?.message || 'Failed to fetch catalog products. Please check network connectivity.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive unique brands from products
  const uniqueBrands = useMemo(() => {
    const brandsSet = new Set();
    products.forEach((p) => {
      if (p.brand && typeof p.brand === 'string') {
        brandsSet.add(p.brand.trim());
      }
    });
    return Array.from(brandsSet).sort();
  }, [products]);

  // Derive matrix brands (brands configured in brand routing matrix)
  const matrixBrands = useMemo(() => {
    const list = [];
    (brandMatrix || []).forEach((item) => {
      if (item.brand && item.brand.toUpperCase() !== 'ALL') {
        list.push({
          brand: item.brand,
          rulesCount: item.rulesCount || item.rules?.length || 0,
          rules: item.rules || []
        });
      }
    });
    return list.sort((a, b) => a.brand.localeCompare(b.brand));
  }, [brandMatrix]);

  // Combined list of all known brands (from matrix + products)
  const allKnownBrands = useMemo(() => {
    const brandMap = new Map();
    (brandMatrix || []).forEach((item) => {
      if (item.brand) {
        brandMap.set(item.brand.trim(), {
          brand: item.brand.trim(),
          hasMatrix: true,
          rulesCount: item.rulesCount || item.rules?.length || 0
        });
      }
    });
    uniqueBrands.forEach((b) => {
      if (!brandMap.has(b)) {
        brandMap.set(b, {
          brand: b,
          hasMatrix: false,
          rulesCount: 0
        });
      }
    });
    return Array.from(brandMap.values()).sort((a, b) => {
      if (a.brand === 'ALL') return 1;
      if (b.brand === 'ALL') return -1;
      return a.brand.localeCompare(b.brand);
    });
  }, [brandMatrix, uniqueBrands]);

  // Options for brand dropdown in product form
  const brandOptions = useMemo(() => {
    const list = allKnownBrands
      .filter((b) => b.brand && b.brand !== 'ALL')
      .map((b) => ({
        value: b.brand,
        label: b.hasMatrix && b.rulesCount > 0 ? `${b.brand} (${b.rulesCount} routing rules)` : b.brand
      }));
    if (formData.brand && !list.some((o) => o.value.trim().toLowerCase() === formData.brand.trim().toLowerCase())) {
      list.unshift({ value: formData.brand, label: formData.brand });
    }
    return list;
  }, [allKnownBrands, formData.brand]);

  // Options for brand dropdown in bulk edit modal
  const bulkBrandOptions = useMemo(() => {
    return allKnownBrands
      .filter((b) => b.brand && b.brand !== 'ALL')
      .map((b) => ({
        value: b.brand,
        label: b.hasMatrix && b.rulesCount > 0 ? `${b.brand} (${b.rulesCount} routing rules)` : b.brand
      }));
  }, [allKnownBrands]);

  // Check if current form brand has active rules in the routing matrix
  const activeBrandGroup = useMemo(() => {
    const curBrand = (formData.brand || '').trim().toLowerCase();
    if (!curBrand) return null;
    return (brandMatrix || []).find((m) => (m.brand || '').trim().toLowerCase() === curBrand);
  }, [formData.brand, brandMatrix]);
  const uniqueLocations = useMemo(() => {
    const locSet = new Set();
    products.forEach((p) => {
      const locList = Array.isArray(p.locations) && p.locations.length > 0
        ? p.locations
        : (Array.isArray(p.companyMappings)
            ? p.companyMappings.flatMap((m) => m?.states || [])
            : []);
      locList.forEach((loc) => {
        if (loc && typeof loc === 'string') {
          locSet.add(loc.trim());
        }
      });
    });
    return Array.from(locSet).sort();
  }, [products]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        // Status Filter
        if (selectedStatusFilter === 'ACTIVE' && !product.isActive) return false;
        if (selectedStatusFilter === 'INACTIVE' && product.isActive) return false;

        // Company Filter
        if (selectedCompanyFilter !== 'ALL') {
          const pCompId = typeof product.companyId === 'object' ? product.companyId?._id : product.companyId;
          if (pCompId !== selectedCompanyFilter) return false;
        }

        // Location Filter
        if (selectedLocationFilter !== 'ALL') {
          const productLocs = Array.isArray(product.locations) && product.locations.length > 0
            ? product.locations
            : (Array.isArray(product.companyMappings)
                ? product.companyMappings.flatMap((m) => m?.states || [])
                : []);
          if (!productLocs.includes(selectedLocationFilter)) {
            return false;
          }
        }

        // Brand Filter
        if (selectedBrandFilter !== 'ALL') {
          if (product.brand !== selectedBrandFilter) return false;
        }

        // Category Filter
        if (selectedCategoryFilter !== 'ALL') {
          const pCatId = typeof product.categoryId === 'object' ? product.categoryId?._id : product.categoryId;
          if (pCatId !== selectedCategoryFilter) return false;
        }

        // Search Query (name, sku, brand, description, category, company name, company code, locations)
        if (debouncedSearchQuery.trim()) {
          const q = debouncedSearchQuery.toLowerCase().trim();
          const name = String(product.name || '').toLowerCase();
          const sku = String(product.sku || '').toLowerCase();
          const brand = String(product.brand || '').toLowerCase();
          const desc = String(product.description || '').toLowerCase();
          const catName = typeof product.categoryId === 'object'
            ? String(product.categoryId?.name || '').toLowerCase()
            : String(categories.find((c) => c._id === product.categoryId)?.name || '').toLowerCase();
          const catCode = typeof product.categoryId === 'object'
            ? String(product.categoryId?.code || '').toLowerCase()
            : String(categories.find((c) => c._id === product.categoryId)?.code || '').toLowerCase();
          const compName = typeof product.companyId === 'object' ? String(product.companyId?.name || '').toLowerCase() : '';
          const compCode = typeof product.companyId === 'object' ? String(product.companyId?.code || '').toLowerCase() : '';
          const locsList = Array.isArray(product.locations) && product.locations.length > 0
            ? product.locations
            : (Array.isArray(product.companyMappings)
                ? product.companyMappings.flatMap((m) => m?.states || [])
                : []);
          const locsStr = locsList.join(' ').toLowerCase();

          return (
            name.includes(q) ||
            sku.includes(q) ||
            brand.includes(q) ||
            desc.includes(q) ||
            catName.includes(q) ||
            catCode.includes(q) ||
            compName.includes(q) ||
            compCode.includes(q) ||
            locsStr.includes(q)
          );
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name-asc') return String(a.name || '').localeCompare(String(b.name || ''));
        if (sortBy === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [products, debouncedSearchQuery, selectedCompanyFilter, selectedCategoryFilter, selectedLocationFilter, selectedBrandFilter, selectedStatusFilter, sortBy, categories]);

  // Product count statistics
  const { activeCount, inactiveCount } = useMemo(() => {
    let active = 0;
    let inactive = 0;
    products.forEach((p) => {
      if (p.isActive) active++;
      else inactive++;
    });
    return { activeCount: active, inactiveCount: inactive };
  }, [products]);

  // Reset pagination on filter or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedCompanyFilter, selectedCategoryFilter, selectedLocationFilter, selectedBrandFilter, selectedStatusFilter, sortBy, itemsPerPage]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(indexOfFirstItem, indexOfLastItem);
  }, [filteredProducts, indexOfFirstItem, indexOfLastItem]);

  const paginationPages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }, [totalPages, currentPage]);

  // Resolve brand routing rules from matrix or live backend
  const resolveBrandRoutingRules = useCallback(
    async (brandName) => {
      if (!brandName || typeof brandName !== 'string') return null;
      const target = brandName.trim();
      if (!target) return null;

      // 1. Check local loaded matrix first (case-insensitive)
      let matchedGroup = (brandMatrix || []).find(
        (item) => item.brand && item.brand.trim().toLowerCase() === target.toLowerCase()
      );

      // 2. If not found in loaded matrix, query backend API
      if (!matchedGroup) {
        try {
          const res = await getBrandRoutingByBrandApi(target);
          const data = res?.data?.data || res?.data;
          if (data) {
            if (Array.isArray(data.rules) && data.rules.length > 0) {
              matchedGroup = data;
            } else if (Array.isArray(data) && data.length > 0) {
              matchedGroup = { brand: target, rules: data };
            }
          }
        } catch {
          // Ignore error and fall through to global ALL fallback
        }
      }

      // 3. Fallback to global "ALL" brand rules if no brand-specific rules
      if (!matchedGroup || !Array.isArray(matchedGroup.rules) || matchedGroup.rules.length === 0) {
        matchedGroup = (brandMatrix || []).find(
          (item) => item.brand && item.brand.trim().toUpperCase() === 'ALL'
        );
      }

      if (matchedGroup && Array.isArray(matchedGroup.rules) && matchedGroup.rules.length > 0) {
        return {
          brand: matchedGroup.brand,
          rules: matchedGroup.rules,
          isFallback: matchedGroup.brand?.toUpperCase() === 'ALL' && target.toUpperCase() !== 'ALL'
        };
      }

      return null;
    },
    [brandMatrix]
  );

  // Apply brand routing rules to form state
  const applyBrandRoutingToForm = useCallback(
    (routingResult, options = { notify: true }) => {
      if (!routingResult || !Array.isArray(routingResult.rules) || routingResult.rules.length === 0) {
        return false;
      }

      const { rules, brand: sourceBrand, isFallback } = routingResult;

      const newMappings = rules
        .map((r) => {
          const cId = typeof r.companyId === 'object' ? r.companyId?._id : (r.companyId || '');
          const rawStates = Array.isArray(r.states) ? r.states : [];
          // Wildcard '*' or 'ALL' expands to all 36 Indian states
          const states =
            rawStates.includes('*') || rawStates.some((s) => String(s).toUpperCase() === 'ALL')
              ? [...INDIAN_STATES]
              : rawStates;
          return {
            companyId: cId,
            states
          };
        })
        .filter((m) => Boolean(m.companyId));

      if (newMappings.length === 0) return false;

      // Extract all unique states
      const stateSet = new Set();
      newMappings.forEach((m) => {
        m.states.forEach((s) => stateSet.add(s));
      });

      setFormData((prev) => ({
        ...prev,
        companyId: newMappings[0].companyId,
        locations: Array.from(stateSet),
        companyMappings: newMappings
      }));

      const bannerText = isFallback
        ? `Applied global standard routing rules (ALL) for brand "${sourceBrand}" (${newMappings.length} partner company mapped)`
        : `Automatically mapped ${newMappings.length} partner ${newMappings.length === 1 ? 'company' : 'companies'} & ${stateSet.size} states from Brand Routing Matrix for "${sourceBrand}"`;

      setAutoMappedBanner(bannerText);

      if (options.notify) {
        showToast(bannerText, 'success');
      }

      return true;
    },
    [showToast]
  );

  // Brand selection handler (triggered when picking a brand or changing brand input)
  const handleBrandSelect = async (newBrand) => {
    if (!newBrand) {
      setFormData((prev) => ({ ...prev, brand: '' }));
      setAutoMappedBanner(null);
      return;
    }
    const targetBrand = newBrand.trim();

    // Update form data brand & auto-generate SKU if needed
    setFormData((prev) => {
      const updated = { ...prev, brand: targetBrand };
      if (!editingProduct && !prev.skuManual) {
        const prefix = targetBrand.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        const namePart = (prev.name || '')
          .toUpperCase()
          .replace(/[^A-Z0-9\s]/g, '')
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .join('-');
        if (namePart) {
          updated.sku = `${prefix}-${namePart}`.slice(0, 18);
        }
      }
      return updated;
    });

    // Automatically resolve and map companies & states from brand routings
    setIsAutoMappingBrand(true);
    try {
      const resolved = await resolveBrandRoutingRules(targetBrand);
      if (resolved) {
        applyBrandRoutingToForm(resolved, { notify: true });
      } else {
        setAutoMappedBanner(null);
      }
    } finally {
      setIsAutoMappingBrand(false);
    }
  };

  // Manual trigger to re-sync current brand with Brand Routing Matrix
  const handleManualSyncBrandRouting = async () => {
    const brandToSync = formData.brand?.trim();
    if (!brandToSync) {
      showToast('Please enter a brand name first.', 'error');
      return;
    }
    setIsAutoMappingBrand(true);
    try {
      const resolved = await resolveBrandRoutingRules(brandToSync);
      if (resolved) {
        applyBrandRoutingToForm(resolved, { notify: true });
      } else {
        showToast(`No routing rules found for "${brandToSync}" in Brand Routing Matrix.`, 'error');
      }
    } finally {
      setIsAutoMappingBrand(false);
    }
  };

  // Resolve Company details for Drawer
  const getDrawerCompanyDetails = useCallback((prod) => {
    if (!prod) return { name: 'Unassigned', code: null, id: null };
    if (typeof prod.companyId === 'object' && prod.companyId !== null) {
      return {
        name: prod.companyId.name || 'Unassigned',
        code: prod.companyId.code || null,
        id: prod.companyId._id || null
      };
    }
    const found = companies.find((c) => c._id === prod.companyId);
    if (found) {
      return {
        name: found.name || 'Unassigned',
        code: found.code || null,
        id: found._id || null
      };
    }
    return {
      name: prod.companyId || 'Unassigned',
      code: null,
      id: typeof prod.companyId === 'string' ? prod.companyId : null
    };
  }, [companies]);

  // Resolve Category details for Drawer
  const getDrawerCategoryDetails = useCallback((prod) => {
    if (!prod || !prod.categoryId) return null;
    if (typeof prod.categoryId === 'object' && prod.categoryId !== null) {
      return {
        name: prod.categoryId.name || 'Unassigned',
        code: prod.categoryId.code || null,
        id: prod.categoryId._id || null
      };
    }
    const found = categories.find((c) => c._id === prod.categoryId);
    if (found) {
      return {
        name: found.name || 'Unassigned',
        code: found.code || null,
        id: found._id || null
      };
    }
    return {
      name: prod.categoryId,
      code: null,
      id: typeof prod.categoryId === 'string' ? prod.categoryId : null
    };
  }, [categories]);

  // Populate form with product attributes
  const populateProductForm = (product) => {
    if (!product) return;
    setEditingProduct(product);
    const compId = typeof product.companyId === 'object' ? product.companyId?._id : (product.companyId || '');
    const catId = typeof product.categoryId === 'object' ? product.categoryId?._id : (product.categoryId || '');

    // Parse existing companyMappings if present
    let initialMappings = [];
    if (Array.isArray(product.companyMappings) && product.companyMappings.length > 0) {
      initialMappings = product.companyMappings.map((m) => ({
        companyId: typeof m.companyId === 'object' ? m.companyId?._id : (m.companyId || ''),
        states: Array.isArray(m.states) ? [...m.states] : []
      }));
    } else if (compId) {
      initialMappings = [{
        companyId: compId,
        states: Array.isArray(product.locations) ? [...product.locations] : []
      }];
    }

    // Determine initial locations
    let initialLocations = Array.isArray(product.locations) ? [...product.locations] : [];
    if (initialLocations.length === 0 && initialMappings.length > 0) {
      const stateSet = new Set();
      initialMappings.forEach((m) => (m.states || []).forEach((st) => stateSet.add(st)));
      initialLocations = Array.from(stateSet);
    }

    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      brand: product.brand || 'Realme',
      categoryId: catId || '',
      companyId: compId || (companies.length > 0 ? companies[0]._id : ''),
      price: product.price !== undefined && product.price !== null ? product.price : '',
      locations: initialLocations,
      companyMappings: initialMappings,
      unit: product.unit || 'PCS',
      description: product.description || '',
      isActive: product.isActive !== undefined ? Boolean(product.isActive) : true
    });
    setCustomLocationInput('');
    setCustomMappingInputs({});
    setFormError('');
    setAutoMappedBanner(null);
  };

  // Open Drawer for Add Product
  const handleOpenAdd = async () => {
    setDrawerProduct(null);
    setEditingProduct(null);
    setDrawerTab('edit');
    const initialBrand = matrixBrands.length > 0 ? matrixBrands[0].brand : (uniqueBrands[0] || 'Realme');
    const initialCompId = companies.length > 0 ? companies[0]._id : '';

    setFormData({
      ...INITIAL_PRODUCT_FORM,
      brand: initialBrand,
      companyId: initialCompId,
      price: '',
      locations: [],
      companyMappings: initialCompId ? [{ companyId: initialCompId, states: [] }] : []
    });
    setCustomLocationInput('');
    setCustomMappingInputs({});
    setFormError('');
    setAutoMappedBanner(null);
    setIsDrawerOpen(true);

    // Automatically map companies and states for initial brand
    if (initialBrand) {
      setIsAutoMappingBrand(true);
      try {
        const resolved = await resolveBrandRoutingRules(initialBrand);
        if (resolved) {
          applyBrandRoutingToForm(resolved, { notify: false });
        }
      } finally {
        setIsAutoMappingBrand(false);
      }
    }
  };

  // Open Drawer for Details View
  const handleOpenDetails = (product) => {
    setDrawerProduct(product);
    setDrawerTab('overview');
    populateProductForm(product);
    setIsDrawerOpen(true);
  };

  // Open Drawer for Edit
  const handleOpenEdit = (product, e) => {
    if (e) e.stopPropagation();
    setDrawerProduct(product);
    setDrawerTab('edit');
    populateProductForm(product);
    setIsDrawerOpen(true);
  };

  // Close Drawer
  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setDrawerProduct(null);
    setEditingProduct(null);
    setFormError('');
  };

  // Stepping navigation across products in drawer
  const selectedProductIndex = useMemo(() => {
    if (!drawerProduct) return -1;
    return filteredProducts.findIndex((p) => p._id === drawerProduct._id);
  }, [drawerProduct, filteredProducts]);

  const canGoPrevProduct = selectedProductIndex > 0;
  const canGoNextProduct = selectedProductIndex >= 0 && selectedProductIndex < filteredProducts.length - 1;

  const handlePrevProduct = useCallback(() => {
    if (canGoPrevProduct) {
      const prevProd = filteredProducts[selectedProductIndex - 1];
      setDrawerProduct(prevProd);
      populateProductForm(prevProd);
    }
  }, [canGoPrevProduct, selectedProductIndex, filteredProducts]);

  const handleNextProduct = useCallback(() => {
    if (canGoNextProduct) {
      const nextProd = filteredProducts[selectedProductIndex + 1];
      setDrawerProduct(nextProd);
      populateProductForm(nextProd);
    }
  }, [canGoNextProduct, selectedProductIndex, filteredProducts]);

  // Keyboard navigation for product drawer (Left/Right arrow keys)
  useEffect(() => {
    if (!isDrawerOpen || !drawerProduct) return;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        if (canGoPrevProduct) handlePrevProduct();
      } else if (e.key === 'ArrowRight') {
        if (canGoNextProduct) handleNextProduct();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, drawerProduct, canGoPrevProduct, canGoNextProduct, handlePrevProduct, handleNextProduct]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  // Handle escape key to close drawer
  useEffect(() => {
    if (!isDrawerOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !deleteConfirmProduct) {
        handleCloseDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, deleteConfirmProduct]);

  // Direct Product Location Handlers
  const handleToggleProductLocation = (locName) => {
    setFormData((prev) => {
      const currentLocs = Array.isArray(prev.locations) ? prev.locations : [];
      const updatedLocs = currentLocs.includes(locName)
        ? currentLocs.filter((l) => l !== locName)
        : [...currentLocs, locName];

      // Keep single companyMapping in sync if present
      let updatedMappings = prev.companyMappings || [];
      if (updatedMappings.length <= 1) {
        const compId = updatedMappings[0]?.companyId || prev.companyId;
        updatedMappings = [{ companyId: compId, states: updatedLocs }];
      }

      return {
        ...prev,
        locations: updatedLocs,
        companyMappings: updatedMappings
      };
    });
  };

  const handleSelectAllProductLocations = () => {
    setFormData((prev) => {
      const updatedLocs = [...INDIAN_STATES];
      let updatedMappings = prev.companyMappings || [];
      if (updatedMappings.length <= 1) {
        const compId = updatedMappings[0]?.companyId || prev.companyId;
        updatedMappings = [{ companyId: compId, states: updatedLocs }];
      }
      return {
        ...prev,
        locations: updatedLocs,
        companyMappings: updatedMappings
      };
    });
  };

  const handleClearProductLocations = () => {
    setFormData((prev) => {
      let updatedMappings = prev.companyMappings || [];
      if (updatedMappings.length <= 1) {
        const compId = updatedMappings[0]?.companyId || prev.companyId;
        updatedMappings = [{ companyId: compId, states: [] }];
      }
      return {
        ...prev,
        locations: [],
        companyMappings: updatedMappings
      };
    });
  };

  const handleAddCustomProductLocation = (val) => {
    const trimmed = (val || '').trim();
    if (!trimmed) return;
    if (isAllKeyword(trimmed)) {
      handleSelectAllProductLocations();
      return;
    }
    setFormData((prev) => {
      const currentLocs = Array.isArray(prev.locations) ? prev.locations : [];
      if (currentLocs.includes(trimmed)) return prev;
      const updatedLocs = [...currentLocs, trimmed];
      let updatedMappings = prev.companyMappings || [];
      if (updatedMappings.length <= 1) {
        const compId = updatedMappings[0]?.companyId || prev.companyId;
        updatedMappings = [{ companyId: compId, states: updatedLocs }];
      }
      return {
        ...prev,
        locations: updatedLocs,
        companyMappings: updatedMappings
      };
    });
  };

  // Auto-generate SKU from name
  const handleNameChange = (nameVal) => {
    const updated = { ...formData, name: nameVal };
    if (!editingProduct && !formData.skuManual) {
      const prefix = (formData.brand || 'PRD').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      const namePart = nameVal
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .join('-');
      if (namePart) {
        updated.sku = `${prefix}-${namePart}`.slice(0, 18);
      }
    }
    setFormData(updated);
  };

  // Company Mappings Handlers for Multi-Company Territory Routing
  const handleAddCompanyMapping = () => {
    const existingCompIds = new Set((formData.companyMappings || []).map((m) => m.companyId));
    const nextUnusedComp = companies.find((c) => !existingCompIds.has(c._id));
    const compToAssign = nextUnusedComp ? nextUnusedComp._id : (companies[0]?._id || '');

    setFormData((prev) => ({
      ...prev,
      companyMappings: [
        ...(prev.companyMappings || []),
        { companyId: compToAssign, states: [] }
      ]
    }));
  };

  const handleRemoveCompanyMapping = (index) => {
    setFormData((prev) => {
      const updated = (prev.companyMappings || []).filter((_, idx) => idx !== index);
      const stateSet = new Set();
      updated.forEach((m) => (m.states || []).forEach((st) => stateSet.add(st)));
      return {
        ...prev,
        companyMappings: updated,
        companyId: updated.length > 0 ? updated[0].companyId : prev.companyId,
        locations: Array.from(stateSet)
      };
    });
  };

  const handleUpdateCompanyMappingCompany = (index, newCompanyId) => {
    setFormData((prev) => {
      const updated = [...(prev.companyMappings || [])];
      if (updated[index]) {
        updated[index] = { ...updated[index], companyId: newCompanyId };
      }
      return {
        ...prev,
        companyMappings: updated,
        companyId: index === 0 ? newCompanyId : prev.companyId
      };
    });
  };

  const handleToggleMappingState = (mappingIndex, stateName) => {
    setFormData((prev) => {
      const updated = [...(prev.companyMappings || [])];
      if (!updated[mappingIndex]) return prev;
      const currentStates = (updated[mappingIndex].states || []).filter((s) => s !== '*');
      const nextStates = currentStates.includes(stateName)
        ? currentStates.filter((s) => s !== stateName)
        : [...currentStates, stateName];
      updated[mappingIndex] = { ...updated[mappingIndex], states: nextStates };

      // Keep union of states in formData.locations
      const stateSet = new Set();
      updated.forEach((m) => (m.states || []).forEach((st) => stateSet.add(st)));

      return {
        ...prev,
        companyMappings: updated,
        locations: Array.from(stateSet)
      };
    });
  };

  const handleToggleWildcardMapping = (mappingIndex) => {
    setFormData((prev) => {
      const updated = [...(prev.companyMappings || [])];
      if (!updated[mappingIndex]) return prev;
      const currentStates = updated[mappingIndex].states || [];
      const hasWildcard = currentStates.includes('*');
      const nextStates = hasWildcard ? [] : ['*'];
      updated[mappingIndex] = { ...updated[mappingIndex], states: nextStates };

      const stateSet = new Set();
      updated.forEach((m) => (m.states || []).forEach((st) => stateSet.add(st)));

      return {
        ...prev,
        companyMappings: updated,
        locations: Array.from(stateSet)
      };
    });
  };

  const handleSelectAllStatesForMapping = (mappingIndex) => {
    setFormData((prev) => {
      const updated = [...(prev.companyMappings || [])];
      if (!updated[mappingIndex]) return prev;
      updated[mappingIndex] = { ...updated[mappingIndex], states: [...INDIAN_STATES] };

      const stateSet = new Set();
      updated.forEach((m) => (m.states || []).forEach((st) => stateSet.add(st)));

      return {
        ...prev,
        companyMappings: updated,
        locations: Array.from(stateSet)
      };
    });
  };

  const handleClearStatesForMapping = (mappingIndex) => {
    setFormData((prev) => {
      const updated = [...(prev.companyMappings || [])];
      if (!updated[mappingIndex]) return prev;
      updated[mappingIndex] = { ...updated[mappingIndex], states: [] };

      const stateSet = new Set();
      updated.forEach((m) => (m.states || []).forEach((st) => stateSet.add(st)));

      return {
        ...prev,
        companyMappings: updated,
        locations: Array.from(stateSet)
      };
    });
  };

  const handleAddCustomLocationToMapping = (mappingIndex, text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    if (trimmed === '*') {
      handleToggleWildcardMapping(mappingIndex);
      return;
    }
    if (isAllKeyword(trimmed)) {
      handleSelectAllStatesForMapping(mappingIndex);
      return;
    }
    setFormData((prev) => {
      const updated = [...(prev.companyMappings || [])];
      if (!updated[mappingIndex]) return prev;
      const currentStates = updated[mappingIndex].states || [];
      if (!currentStates.includes(trimmed)) {
        updated[mappingIndex] = { ...updated[mappingIndex], states: [...currentStates, trimmed] };
      }

      const stateSet = new Set();
      updated.forEach((m) => (m.states || []).forEach((st) => stateSet.add(st)));

      return {
        ...prev,
        companyMappings: updated,
        locations: Array.from(stateSet)
      };
    });
  };

  // Save Product (Create or Update)
  const handleSaveProduct = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Product name is required.');
      return;
    }
    const skuVal = validateEntityCode(formData.sku);
    if (!skuVal.isValid) {
      setFormError(`Product SKU: ${skuVal.error}`);
      return;
    }
    if (!formData.brand.trim()) {
      setFormError('Brand name is required.');
      return;
    }

    // Format & sanitize companyMappings
    let cleanMappings = [];
    if (Array.isArray(formData.companyMappings) && formData.companyMappings.length > 0) {
      cleanMappings = formData.companyMappings
        .filter((m) => m && m.companyId)
        .map((m) => ({
          companyId: typeof m.companyId === 'object' ? m.companyId?._id : m.companyId,
          states: Array.isArray(m.states) ? m.states : []
        }));
    }

    const effectiveCompanyId = cleanMappings.length > 0
      ? cleanMappings[0].companyId
      : (typeof formData.companyId === 'object' ? formData.companyId?._id : (formData.companyId || companies[0]?._id));

    if (!effectiveCompanyId) {
      setFormError('Please select at least one partner company.');
      return;
    }

    // Determine effective locations
    let effectiveLocations = Array.isArray(formData.locations) ? [...formData.locations] : [];

    // If multi-company mappings are explicitly configured, compute union
    if (cleanMappings.length > 1) {
      const stateSet = new Set();
      cleanMappings.forEach((m) => (m.states || []).forEach((st) => stateSet.add(st)));
      effectiveLocations = Array.from(stateSet);
    } else if (cleanMappings.length === 1) {
      if (cleanMappings[0].states && cleanMappings[0].states.length > 0) {
        effectiveLocations = cleanMappings[0].states;
      } else {
        cleanMappings[0].states = effectiveLocations;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim().toUpperCase(),
        brand: formData.brand.trim(),
        categoryId: formData.categoryId ? formData.categoryId : undefined,
        companyId: effectiveCompanyId,
        price: formData.price !== undefined && formData.price !== '' && !isNaN(Number(formData.price))
          ? Number(formData.price)
          : 0,
        unit: formData.unit.trim() || 'PCS',
        description: formData.description.trim(),
        locations: effectiveLocations,
        companyMappings: cleanMappings,
        isActive: Boolean(formData.isActive)
      };

      const targetProd = editingProduct || drawerProduct;

      if (targetProd?._id) {
        const res = await updateProductApi(targetProd._id, payload);
        const serverData = res.data?.data || (res.data?._id ? res.data : {});
        const matchedComp = companies.find((c) => c._id === payload.companyId);
        const matchedCat = categories.find((c) => c._id === payload.categoryId);

        const updatedMerged = {
          ...targetProd,
          ...payload,
          ...serverData,
          companyId: matchedComp || serverData.companyId || payload.companyId,
          categoryId: matchedCat || serverData.categoryId || payload.categoryId,
          locations: payload.locations,
          companyMappings: payload.companyMappings
        };

        setProducts((prev) =>
          prev.map((p) => (p._id === targetProd._id ? updatedMerged : p))
        );
        setDrawerProduct(updatedMerged);
        setEditingProduct(updatedMerged);
        setDrawerTab('overview');
        showToast(`Product "${payload.name}" updated successfully!`);
      } else {
        const res = await createProductApi(payload);
        const serverData = res.data?.data || (res.data?._id ? res.data : null);
        const matchedComp = companies.find((c) => c._id === payload.companyId);
        const matchedCat = categories.find((c) => c._id === payload.categoryId);
        const completeCreated = {
          ...payload,
          ...(serverData || {}),
          _id: serverData?._id || ('prod_' + Date.now()),
          companyId: matchedComp || serverData?.companyId || payload.companyId,
          categoryId: matchedCat || serverData?.categoryId || payload.categoryId,
          locations: payload.locations,
          companyMappings: payload.companyMappings
        };

        setProducts((prev) => [completeCreated, ...prev]);
        setDrawerProduct(completeCreated);
        setEditingProduct(completeCreated);
        setDrawerTab('overview');
        showToast(`Product "${payload.name}" created successfully!`);
      }
    } catch (err) {
      console.error('Failed to save product:', err);
      setFormError(err.response?.data?.message || 'Failed to save product. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async () => {
    if (!deleteConfirmProduct) return;
    setDeleting(true);
    try {
      await deleteProductApi(deleteConfirmProduct._id);
      setProducts((prev) => prev.filter((p) => p._id !== deleteConfirmProduct._id));
      showToast(`Product "${deleteConfirmProduct.name}" removed from catalog.`);
      if (drawerProduct?._id === deleteConfirmProduct._id) {
        handleCloseDrawer();
      }
      setDeleteConfirmProduct(null);
    } catch (err) {
      console.error('Failed to delete product:', err);
      alert(err.response?.data?.message || 'Failed to delete product.');
    } finally {
      setDeleting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredProducts.length) return;
    const headers = ['Product Name', 'SKU', 'Brand', 'Company Name', 'Company Code', 'Covered Locations', 'Unit', 'Status', 'Date Added'];
    const rows = [headers];
    filteredProducts.forEach((p) => {
      const compName = typeof p.companyId === 'object' ? p.companyId?.name : '';
      const compCode = typeof p.companyId === 'object' ? p.companyId?.code : '';
      const locStr = Array.isArray(p.locations) ? p.locations.join('; ') : '';
      rows.push([
        p.name || '',
        p.sku || '',
        p.brand || '',
        compName || '',
        compCode || '',
        locStr || '',
        p.unit || 'PCS',
        p.isActive ? 'Active' : 'Inactive',
        p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : ''
      ]);
    });

    const processRow = (row) =>
      row
        .map((val) => {
          let str = val === null || val === undefined ? '' : String(val);
          str = str.replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',');

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(processRow).join('\r\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `products_catalog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk Selection Helpers
  const toggleSelectProduct = (productId) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map((p) => p._id));
    }
  };

  // Helper to build a complete product payload for the single product update API:
  // PUT or PATCH /api/v1/products/:id
  const buildProductPayload = useCallback((prod, overrides = {}) => {
    if (!prod) return {};
    const compId = typeof prod.companyId === 'object' ? prod.companyId?._id : (prod.companyId || companies[0]?._id);
    const catId = typeof prod.categoryId === 'object' ? prod.categoryId?._id : prod.categoryId;

    let cleanMappings = [];
    if (Array.isArray(overrides.companyMappings)) {
      cleanMappings = overrides.companyMappings.map((m) => ({
        companyId: typeof m.companyId === 'object' ? m.companyId?._id : m.companyId,
        states: Array.isArray(m.states) ? m.states : []
      }));
    } else if (Array.isArray(prod.companyMappings) && prod.companyMappings.length > 0) {
      cleanMappings = prod.companyMappings.map((m) => ({
        companyId: typeof m.companyId === 'object' ? m.companyId?._id : m.companyId,
        states: Array.isArray(m.states) ? m.states : []
      }));
    } else {
      cleanMappings = [{
        companyId: overrides.companyId || compId,
        states: Array.isArray(overrides.locations || prod.locations) ? (overrides.locations || prod.locations) : []
      }];
    }

    let effectiveLocations = [];
    if (Array.isArray(overrides.locations)) {
      effectiveLocations = overrides.locations;
    } else if (Array.isArray(prod.locations)) {
      effectiveLocations = prod.locations;
    } else {
      const stateSet = new Set();
      cleanMappings.forEach((m) => (m.states || []).forEach((st) => stateSet.add(st)));
      effectiveLocations = Array.from(stateSet);
    }

    const effectiveCompanyId = overrides.companyId !== undefined
      ? overrides.companyId
      : (cleanMappings.length > 0 ? cleanMappings[0].companyId : compId);

    const priceVal = overrides.price !== undefined
      ? overrides.price
      : prod.price;

    return {
      name: (overrides.name !== undefined ? overrides.name : (prod.name || '')).trim(),
      sku: (overrides.sku !== undefined ? overrides.sku : (prod.sku || '')).trim().toUpperCase(),
      categoryId: overrides.categoryId !== undefined
        ? overrides.categoryId
        : (catId ? catId : undefined),
      brand: (overrides.brand !== undefined ? overrides.brand : (prod.brand || '')).trim(),
      price: priceVal !== undefined && priceVal !== '' && !isNaN(Number(priceVal))
        ? Number(priceVal)
        : 0,
      unit: (overrides.unit !== undefined ? overrides.unit : (prod.unit || 'PCS')).trim() || 'PCS',
      description: (overrides.description !== undefined ? overrides.description : (prod.description || '')).trim(),
      companyId: effectiveCompanyId,
      locations: effectiveLocations,
      companyMappings: cleanMappings,
      isActive: overrides.isActive !== undefined ? Boolean(overrides.isActive) : Boolean(prod.isActive !== false)
    };
  }, [companies]);

  const handleBulkStatusChange = async (targetActive) => {
    if (selectedProductIds.length === 0) return;
    const actionLabel = targetActive ? 'Activating' : 'Deactivating';
    abortBatchRef.current = false;
    setBatchProgress({
      isOpen: true,
      title: `Bulk ${targetActive ? 'Activate' : 'Deactivate'} Products`,
      current: 0,
      total: selectedProductIds.length,
      percentage: 0,
      status: 'processing',
      isFinished: false,
      logs: [`Starting bulk ${actionLabel.toLowerCase()} for ${selectedProductIds.length} products...`]
    });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedProductIds.length; i++) {
      if (abortBatchRef.current) {
        setBatchProgress((prev) => ({
          ...prev,
          status: 'error',
          isFinished: true,
          logs: [...prev.logs, 'Batch execution aborted by user.']
        }));
        break;
      }

      const prodId = selectedProductIds[i];
      const prod = products.find((p) => p._id === prodId);
      const name = prod ? prod.name : prodId;

      try {
        const payload = buildProductPayload(prod, { isActive: targetActive });
        await updateProductApi(prodId, payload);
        successCount++;
        setBatchProgress((prev) => {
          const current = i + 1;
          return {
            ...prev,
            current,
            percentage: Math.round((current / prev.total) * 100),
            logs: [...prev.logs, `✓ Product "${name}" set to ${targetActive ? 'Active' : 'Inactive'}`]
          };
        });
      } catch (err) {
        failCount++;
        setBatchProgress((prev) => {
          const current = i + 1;
          return {
            ...prev,
            current,
            percentage: Math.round((current / prev.total) * 100),
            logs: [...prev.logs, `✗ Failed to update "${name}": ${err?.response?.data?.message || err.message}`]
          };
        });
      }
    }

    setBatchProgress((prev) => ({
      ...prev,
      status: prev.status === 'error' ? 'error' : 'completed',
      isFinished: true,
      logs: [...prev.logs, `Finished! Success: ${successCount}, Failed: ${failCount}`]
    }));

    await fetchData(true);
    showToast(`Bulk update complete: ${successCount} updated, ${failCount} failed`);
  };

  const handleBulkMoveCompany = async () => {
    if (!bulkTargetCompanyId || selectedProductIds.length === 0) return;
    const targetComp = companies.find((c) => c._id === bulkTargetCompanyId);
    const compName = targetComp ? targetComp.name : 'Selected Company';

    setIsBulkCompanyModalOpen(false);
    abortBatchRef.current = false;
    setBatchProgress({
      isOpen: true,
      title: `Bulk Reassign Company to "${compName}"`,
      current: 0,
      total: selectedProductIds.length,
      percentage: 0,
      status: 'processing',
      isFinished: false,
      logs: [`Starting company reassignment to "${compName}" for ${selectedProductIds.length} products...`]
    });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedProductIds.length; i++) {
      if (abortBatchRef.current) {
        setBatchProgress((prev) => ({
          ...prev,
          status: 'error',
          isFinished: true,
          logs: [...prev.logs, 'Batch execution aborted by user.']
        }));
        break;
      }

      const prodId = selectedProductIds[i];
      const prod = products.find((p) => p._id === prodId);
      const name = prod ? prod.name : prodId;

      try {
        const nextMappings = Array.isArray(prod?.companyMappings) && prod.companyMappings.length > 0
          ? prod.companyMappings.map((m, idx) => (idx === 0 ? { ...m, companyId: bulkTargetCompanyId } : m))
          : [{ companyId: bulkTargetCompanyId, states: Array.isArray(prod?.locations) ? prod.locations : [] }];

        const payload = buildProductPayload(prod, {
          companyId: bulkTargetCompanyId,
          companyMappings: nextMappings
        });

        await updateProductApi(prodId, payload);
        successCount++;
        setBatchProgress((prev) => {
          const current = i + 1;
          return {
            ...prev,
            current,
            percentage: Math.round((current / prev.total) * 100),
            logs: [...prev.logs, `✓ Product "${name}" mapped to "${compName}"`]
          };
        });
      } catch (err) {
        failCount++;
        setBatchProgress((prev) => {
          const current = i + 1;
          return {
            ...prev,
            current,
            percentage: Math.round((current / prev.total) * 100),
            logs: [...prev.logs, `✗ Failed to reassign "${name}": ${err?.response?.data?.message || err.message}`]
          };
        });
      }
    }

    setBatchProgress((prev) => ({
      ...prev,
      status: prev.status === 'error' ? 'error' : 'completed',
      isFinished: true,
      logs: [...prev.logs, `Finished! Success: ${successCount}, Failed: ${failCount}`]
    }));

    await fetchData(true);
    showToast(`Reassigned ${successCount} products to ${compName}`);
  };

  const handleBulkReassignLocations = async () => {
    if (selectedProductIds.length === 0) return;
    setIsBulkLocationModalOpen(false);
    abortBatchRef.current = false;

    let modeLabel = '';
    if (bulkLocationMode === 'sync-matrix') {
      modeLabel = 'Sync Matrix (Brand Routing)';
    } else if (bulkLocationMode === 'all') {
      modeLabel = 'All 36 States';
    } else if (bulkLocationMode === 'clear') {
      modeLabel = 'Clear All Locations';
    } else if (bulkLocationMode === 'replace') {
      modeLabel = `Replace (${bulkLocations.length} states)`;
    } else if (bulkLocationMode === 'append') {
      modeLabel = `Append (${bulkLocations.length} states)`;
    }

    setBatchProgress({
      isOpen: true,
      title: `Bulk Reassign Locations: ${modeLabel}`,
      current: 0,
      total: selectedProductIds.length,
      percentage: 0,
      status: 'processing',
      isFinished: false,
      logs: [`Starting bulk location reassignment (${bulkLocationMode}) for ${selectedProductIds.length} products...`]
    });

    let successCount = 0;
    let failCount = 0;
    const updatedProdMap = new Map();

    for (let i = 0; i < selectedProductIds.length; i++) {
      if (abortBatchRef.current) {
        setBatchProgress((prev) => ({
          ...prev,
          status: 'error',
          isFinished: true,
          logs: [...prev.logs, 'Batch execution aborted by user.']
        }));
        break;
      }

      const prodId = selectedProductIds[i];
      const prod = products.find((p) => p._id === prodId);
      const name = prod ? prod.name : prodId;
      const brand = prod ? (prod.brand || '').trim() : '';

      try {
        let nextLocations = [];
        let nextMappings = [];
        let targetCompanyId = typeof prod?.companyId === 'object' ? prod.companyId?._id : (prod?.companyId || companies[0]?._id);

        if (bulkLocationMode === 'sync-matrix') {
          // Resolve brand routing rules for this product's brand
          const routingResult = await resolveBrandRoutingRules(brand);

          if (routingResult && Array.isArray(routingResult.rules) && routingResult.rules.length > 0) {
            nextMappings = routingResult.rules
              .map((r) => {
                const cId = typeof r.companyId === 'object' ? r.companyId?._id : (r.companyId || '');
                const rawStates = Array.isArray(r.states) ? r.states : [];
                return {
                  companyId: cId,
                  states: rawStates
                };
              })
              .filter((m) => Boolean(m.companyId));

            if (nextMappings.length > 0) {
              targetCompanyId = nextMappings[0].companyId;
              const stateSet = new Set();
              nextMappings.forEach((m) => (m.states || []).forEach((st) => stateSet.add(st)));
              nextLocations = Array.from(stateSet);
              if (nextLocations.includes('*') || nextLocations.some((s) => String(s).toUpperCase() === 'ALL')) {
                nextLocations = [...INDIAN_STATES];
              }
            } else {
              nextLocations = Array.isArray(prod?.locations) ? prod.locations : [];
              nextMappings = [{ companyId: targetCompanyId, states: nextLocations }];
            }
          } else {
            // No matrix routing rules found for this brand, retain existing or fallback
            nextLocations = Array.isArray(prod?.locations) ? prod.locations : [];
            nextMappings = Array.isArray(prod?.companyMappings) && prod.companyMappings.length > 0
              ? prod.companyMappings
              : [{ companyId: targetCompanyId, states: nextLocations }];
          }
        } else if (bulkLocationMode === 'all') {
          nextLocations = [...INDIAN_STATES];
          nextMappings = [{
            companyId: targetCompanyId,
            states: nextLocations
          }];
        } else if (bulkLocationMode === 'clear') {
          nextLocations = [];
          nextMappings = [{
            companyId: targetCompanyId,
            states: []
          }];
        } else if (bulkLocationMode === 'replace') {
          nextLocations = [...bulkLocations];
          nextMappings = [{
            companyId: targetCompanyId,
            states: nextLocations
          }];
        } else if (bulkLocationMode === 'append') {
          const existing = Array.isArray(prod?.locations) ? prod.locations : [];
          nextLocations = Array.from(new Set([...existing, ...bulkLocations]));
          nextMappings = [{
            companyId: targetCompanyId,
            states: nextLocations
          }];
        }

        // Build the single product API payload matching PUT/PATCH /api/v1/products/:id
        const payload = buildProductPayload(prod || { _id: prodId }, {
          companyId: targetCompanyId,
          locations: nextLocations,
          companyMappings: nextMappings
        });

        // Use the same single product API: PUT or PATCH /api/v1/products/:id
        await updateProductApi(prodId, payload);
        successCount++;
        updatedProdMap.set(prodId, payload);

        setBatchProgress((prev) => {
          const current = i + 1;
          const detail = bulkLocationMode === 'sync-matrix'
            ? `matrix-synced for brand "${brand}" (${nextMappings.length} partners, ${nextLocations.length} locations)`
            : `${nextLocations.length} locations configured`;
          return {
            ...prev,
            current,
            percentage: Math.round((current / prev.total) * 100),
            logs: [...prev.logs, `✓ Product "${name}": ${detail}`]
          };
        });
      } catch (err) {
        failCount++;
        setBatchProgress((prev) => {
          const current = i + 1;
          return {
            ...prev,
            current,
            percentage: Math.round((current / prev.total) * 100),
            logs: [...prev.logs, `✗ Failed for "${name}": ${err?.response?.data?.message || err.message}`]
          };
        });
      }
    }

    setBatchProgress((prev) => ({
      ...prev,
      status: prev.status === 'error' ? 'error' : 'completed',
      isFinished: true,
      logs: [...prev.logs, `Finished! Success: ${successCount}, Failed: ${failCount}`]
    }));

    if (updatedProdMap.size > 0) {
      setProducts((prev) =>
        prev.map((p) => {
          if (updatedProdMap.has(p._id)) {
            const updates = updatedProdMap.get(p._id);
            const matchedComp = companies.find((c) => c._id === updates.companyId);
            return {
              ...p,
              ...updates,
              companyId: matchedComp || p.companyId
            };
          }
          return p;
        })
      );
    }

    await fetchData(true);
    showToast(`Bulk locations update complete: ${successCount} updated, ${failCount} failed`);
  };

  const resetBulkEditForm = () => {
    setBulkEditFields({
      updateCategory: false,
      categoryId: categories[0]?._id || '',
      updateBrand: false,
      brand: '',
      updatePrice: false,
      priceMode: 'fixed',
      priceValue: '',
      updateUnit: false,
      unit: 'PCS',
      updateStatus: false,
      isActive: true,
      syncLocationsWithMatrix: false
    });
  };

  const handleBulkEditSubmit = async () => {
    if (selectedProductIds.length === 0) return;
    setIsBulkEditModalOpen(false);
    abortBatchRef.current = false;

    setBatchProgress({
      isOpen: true,
      title: `Bulk Edit ${selectedProductIds.length} Products`,
      current: 0,
      total: selectedProductIds.length,
      percentage: 0,
      status: 'processing',
      isFinished: false,
      logs: [`Starting bulk product update for ${selectedProductIds.length} products using single product API...`]
    });

    let successCount = 0;
    let failCount = 0;
    const updatedProdMap = new Map();

    for (let i = 0; i < selectedProductIds.length; i++) {
      if (abortBatchRef.current) {
        setBatchProgress((prev) => ({
          ...prev,
          status: 'error',
          isFinished: true,
          logs: [...prev.logs, 'Batch execution aborted by user.']
        }));
        break;
      }

      const prodId = selectedProductIds[i];
      const prod = products.find((p) => p._id === prodId);
      const name = prod ? prod.name : prodId;
      const effectiveBrand = (bulkEditFields.updateBrand ? bulkEditFields.brand : (prod?.brand || '')).trim();

      try {
        const overrides = {};

        if (bulkEditFields.updateCategory && bulkEditFields.categoryId) {
          overrides.categoryId = bulkEditFields.categoryId;
        }

        if (bulkEditFields.updateBrand) {
          overrides.brand = bulkEditFields.brand.trim();
        }

        if (bulkEditFields.updatePrice && bulkEditFields.priceValue !== '') {
          const val = Number(bulkEditFields.priceValue) || 0;
          const currentPrice = Number(prod?.price) || 0;
          if (bulkEditFields.priceMode === 'fixed') {
            overrides.price = Math.max(0, val);
          } else if (bulkEditFields.priceMode === 'increase_percent') {
            overrides.price = Math.round(currentPrice * (1 + val / 100));
          } else if (bulkEditFields.priceMode === 'decrease_percent') {
            overrides.price = Math.max(0, Math.round(currentPrice * (1 - val / 100)));
          }
        }

        if (bulkEditFields.updateUnit && bulkEditFields.unit) {
          overrides.unit = bulkEditFields.unit;
        }

        if (bulkEditFields.updateStatus) {
          overrides.isActive = bulkEditFields.isActive;
        }

        if (bulkEditFields.syncLocationsWithMatrix) {
          const routingResult = await resolveBrandRoutingRules(effectiveBrand);
          if (routingResult && Array.isArray(routingResult.rules) && routingResult.rules.length > 0) {
            const nextMappings = routingResult.rules
              .map((r) => ({
                companyId: typeof r.companyId === 'object' ? r.companyId?._id : (r.companyId || ''),
                states: Array.isArray(r.states) ? r.states : []
              }))
              .filter((m) => Boolean(m.companyId));

            if (nextMappings.length > 0) {
              overrides.companyMappings = nextMappings;
              overrides.companyId = nextMappings[0].companyId;
              const stateSet = new Set();
              nextMappings.forEach((m) => (m.states || []).forEach((st) => stateSet.add(st)));
              let locs = Array.from(stateSet);
              if (locs.includes('*') || locs.some((s) => String(s).toUpperCase() === 'ALL')) {
                locs = [...INDIAN_STATES];
              }
              overrides.locations = locs;
            }
          }
        }

        const payload = buildProductPayload(prod || { _id: prodId }, overrides);
        await updateProductApi(prodId, payload);
        successCount++;
        updatedProdMap.set(prodId, payload);

        setBatchProgress((prev) => {
          const current = i + 1;
          return {
            ...prev,
            current,
            percentage: Math.round((current / prev.total) * 100),
            logs: [...prev.logs, `✓ Product "${name}" updated successfully`]
          };
        });
      } catch (err) {
        failCount++;
        setBatchProgress((prev) => {
          const current = i + 1;
          return {
            ...prev,
            current,
            percentage: Math.round((current / prev.total) * 100),
            logs: [...prev.logs, `✗ Failed for "${name}": ${err?.response?.data?.message || err.message}`]
          };
        });
      }
    }

    setBatchProgress((prev) => ({
      ...prev,
      status: prev.status === 'error' ? 'error' : 'completed',
      isFinished: true,
      logs: [...prev.logs, `Finished! Success: ${successCount}, Failed: ${failCount}`]
    }));

    if (updatedProdMap.size > 0) {
      setProducts((prev) =>
        prev.map((p) => {
          if (updatedProdMap.has(p._id)) {
            const updates = updatedProdMap.get(p._id);
            const matchedComp = companies.find((c) => c._id === updates.companyId);
            const matchedCat = categories.find((c) => c._id === updates.categoryId);
            return {
              ...p,
              ...updates,
              companyId: matchedComp || p.companyId,
              categoryId: matchedCat || p.categoryId
            };
          }
          return p;
        })
      );
    }

    await fetchData(true);
    showToast(`Bulk edit complete: ${successCount} updated, ${failCount} failed`);
  };

  const handleBulkExportProducts = () => {
    const selectedProds = products.filter((p) => selectedProductIds.includes(p._id));
    if (selectedProds.length === 0) return;

    const exportRows = selectedProds.map((prod, idx) => {
      const compName = typeof prod.companyId === 'object' ? prod.companyId?.name : '';
      const compCode = typeof prod.companyId === 'object' ? prod.companyId?.code : '';
      const locStr = Array.isArray(prod.locations) ? prod.locations.join(', ') : '';
      return {
        'S.No.': idx + 1,
        'SKU': prod.sku || '',
        'Product Name': prod.name || '',
        'Brand': prod.brand || 'Realme',
        'Company Name': compName || '',
        'Company Code': compCode || '',
        'Covered Locations': locStr || '',
        'Unit': prod.unit || 'PCS',
        'Status': prod.isActive ? 'Active' : 'Inactive',
        'Description': prod.description || '',
        'Created At': prod.createdAt ? formatDateDDMMYYYY(prod.createdAt) : ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    XLSX.writeFile(workbook, `Products_Bulk_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(`Exported ${selectedProds.length} products to Excel.`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xl border border-slate-700/50 dark:border-slate-200 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <FiCheckCircle className="text-emerald-500 text-lg shrink-0" />
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Products Catalog"
        subtitle="Manage product portfolio, SKU inventory, brand collections, and distribution territories."
        badgeIcon={FiPackage}
        actions={
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, SKU, brand, company, location..."
                className="w-full pl-9 pr-8 py-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <FiX size={12} />
                </button>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={loading || refreshing}
              title="Refresh Products"
              className="p-2.5 bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:border-blue-500/40 transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
            >
              <FiRefreshCw className={`text-base ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        }
      />

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FiAlertCircle className="text-xl shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Actions & Filters Bar */}
      <div className="bg-white/40 dark:bg-slate-900/60 p-4 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {/* Actions Dropdown */}
          <div className="relative" ref={actionsDropdownRef}>
            <button
              type="button"
              onClick={() => setIsActionsOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-white/10 hover:border-blue-500/40 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer active:scale-95"
            >
              <span>Actions</span>
              <FiChevronDown className={`text-xs transition-transform duration-200 ${isActionsOpen ? 'rotate-180' : ''}`} />
            </button>

            {isActionsOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-white/40 dark:bg-slate-900/25 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-from-top-2 duration-150">
                {/* Option 1: Import Products via Excel */}
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsOpen(false);
                    setIsImportModalOpen(true);
                  }}
                  className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 text-left transition-colors cursor-pointer group"
                >
                  <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors shrink-0">
                    <FiUploadCloud className="text-base" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      Import Products
                    </div>
                    <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                      Bulk import via Excel or CSV
                    </div>
                  </div>
                </button>

                {/* Option 2: Download Sample File */}
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsOpen(false);
                    downloadProductExcelTemplate(companies);
                    showToast('Sample Excel template downloaded.');
                  }}
                  className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-blue-50/80 dark:hover:bg-blue-950/30 text-left transition-colors cursor-pointer group"
                >
                  <span className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                    <FiFileText className="text-base" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Download Sample File
                    </div>
                    <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                      Pre-formatted .xlsx with companies
                    </div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-white/5" />

                {/* Option 3: Export Catalog CSV */}
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsOpen(false);
                    handleExportCSV();
                  }}
                  disabled={products.length === 0}
                  className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-left transition-colors cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 group-hover:bg-slate-700 group-hover:text-white transition-colors shrink-0">
                    <FiDownload className="text-base" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Export Catalog CSV
                    </div>
                    <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                      Download current inventory list
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Add Product Button */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/25 cursor-pointer active:scale-95"
          >
            <FiPlus className="text-base" />
            <span>Add Product</span>
          </button>

          {/* Bulk Operations Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setIsBulkMode((prev) => !prev);
              if (isBulkMode) setSelectedProductIds([]);
            }}
            className={`flex items-center gap-2 px-3.5 py-2.5 border text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer active:scale-95 ${
              isBulkMode
                ? 'bg-blue-600 border-blue-600 text-white shadow-blue-500/20 shadow-md'
                : 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-white/10 hover:border-blue-500/40 text-slate-700 dark:text-slate-200'
            }`}
          >
            <FiLayers className={`text-sm ${isBulkMode ? 'text-white' : 'text-blue-500'}`} />
            <span>Bulk Operations</span>
            {selectedProductIds.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-blue-700 text-white text-[10px] rounded-full font-bold">
                {selectedProductIds.length}
              </span>
            )}
          </button>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-start">
          {/* Company Filter */}
          <div className="min-w-[140px]">
            <CustomDropdown
              value={selectedCompanyFilter}
              onChange={(val) => setSelectedCompanyFilter(val)}
              options={[
                { value: 'ALL', label: 'All Companies' },
                ...companies.map((c) => ({
                  value: c._id,
                  label: c.code ? `${c.code} - ${c.name}` : c.name
                }))
              ]}
              statusColor="!px-3 !py-1.5 text-xs font-semibold rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200"
            />
          </div>

          {/* Location Filter */}
          {uniqueLocations.length > 0 && (
            <div className="min-w-[130px]">
              <CustomDropdown
                value={selectedLocationFilter}
                onChange={(val) => setSelectedLocationFilter(val)}
                options={[
                  { value: 'ALL', label: 'All Locations' },
                  ...uniqueLocations.map((loc) => ({ value: loc, label: loc }))
                ]}
                statusColor="!px-3 !py-1.5 text-xs font-semibold rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200"
              />
            </div>
          )}

          {/* Brand Filter */}
          {uniqueBrands.length > 0 && (
            <div className="min-w-[120px]">
              <CustomDropdown
                value={selectedBrandFilter}
                onChange={(val) => setSelectedBrandFilter(val)}
                options={[
                  { value: 'ALL', label: 'All Brands' },
                  ...uniqueBrands.map((b) => ({ value: b, label: b }))
                ]}
                statusColor="!px-3 !py-1.5 text-xs font-semibold rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200"
              />
            </div>
          )}

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="min-w-[140px]">
              <CustomDropdown
                value={selectedCategoryFilter}
                onChange={(val) => setSelectedCategoryFilter(val)}
                options={[
                  { value: 'ALL', label: 'All Categories' },
                  ...categories.map((c) => ({
                    value: c._id,
                    label: c.name || c.code
                  }))
                ]}
                statusColor="!px-3 !py-1.5 text-xs font-semibold rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200"
              />
            </div>
          )}

          {/* Status Filter */}
          <div className="min-w-[120px]">
            <CustomDropdown
              value={selectedStatusFilter}
              onChange={(val) => setSelectedStatusFilter(val)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'ACTIVE', label: 'Active Only' },
                { value: 'INACTIVE', label: 'Inactive Only' }
              ]}
              statusColor="!px-3 !py-1.5 text-xs font-semibold rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200"
            />
          </div>

          {/* Sort By */}
          <div className="min-w-[130px]">
            <CustomDropdown
              value={sortBy}
              onChange={(val) => setSortBy(val)}
              options={[
                { value: 'newest', label: 'Newest Added' },
                { value: 'oldest', label: 'Oldest First' },
                { value: 'name-asc', label: 'Name: A to Z' }
              ]}
              statusColor="!px-3 !py-1.5 text-xs font-semibold rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200"
            />
          </div>

          {/* Reset Filters */}
          {(searchQuery || selectedCompanyFilter !== 'ALL' || selectedCategoryFilter !== 'ALL' || selectedLocationFilter !== 'ALL' || selectedBrandFilter !== 'ALL' || selectedStatusFilter !== 'ALL' || sortBy !== 'newest') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCompanyFilter('ALL');
                setSelectedCategoryFilter('ALL');
                setSelectedLocationFilter('ALL');
                setSelectedBrandFilter('ALL');
                setSelectedStatusFilter('ALL');
                setSortBy('newest');
              }}
              className="px-2.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Product Counts & Summary Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-800 dark:text-slate-200">
            Total: {products.length} products
          </span>
          <span className="inline-block w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {activeCount} Active
          </span>
          <span className="inline-block w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
          <span className="text-slate-500 font-semibold">
            {inactiveCount} Inactive
          </span>
          {filteredProducts.length !== products.length && (
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-bold">
              {filteredProducts.length} filtered
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <TableSkeleton
          columns={isBulkMode ? 11 : 10}
          rows={8}
          tableClassName="min-w-[1200px]"
        />
      ) : filteredProducts.length === 0 ? (
        <div className="py-20 text-center bg-white/60 dark:bg-slate-900/40 rounded-3xl border border-slate-200/80 dark:border-white/10 p-8">
          <FiPackage className="text-4xl text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No products found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery || selectedCompanyFilter !== 'ALL' || selectedLocationFilter !== 'ALL' || selectedBrandFilter !== 'ALL' || selectedStatusFilter !== 'ALL'
              ? 'No products match your current search filters. Try clearing some filters.'
              : 'There are currently no products registered in your catalog.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-600/25"
            >
              <FiUploadCloud />
              <span>Import via Excel</span>
            </button>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-600/25"
            >
              <FiPlus />
              <span>Add First Product</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white/40 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[1200px]">
              <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-200/60 dark:border-white/5 select-none">
                <tr>
                  {isBulkMode && (
                    <th className="py-4 px-3 text-center w-12 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length}
                        onChange={handleSelectAllFiltered}
                        className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-4 px-5 text-center w-16 whitespace-nowrap">S.No.</th>
                  <th className="py-4 px-5 whitespace-nowrap">Product Details</th>
                  <th className="py-4 px-5 whitespace-nowrap">Brand</th>
                  <th className="py-4 px-5 whitespace-nowrap">Category</th>
                  <th className="py-4 px-5 whitespace-nowrap">Partner Company</th>
                  <th className="py-4 px-5 whitespace-nowrap">Covered Locations</th>
                  <th className="py-4 px-5 text-center whitespace-nowrap">Unit</th>
                  <th className="py-4 px-5 whitespace-nowrap">Description</th>
                  <th className="py-4 px-5 text-center whitespace-nowrap">Status</th>
                  <th className="py-4 px-5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                {paginatedProducts.map((product, idx) => {
                  const compName = typeof product.companyId === 'object' ? product.companyId?.name : '';
                  const compCode = typeof product.companyId === 'object' ? product.companyId?.code : '';
                  const serialNumber = indexOfFirstItem + idx + 1;
                  const isSelected = selectedProductIds.includes(product._id);
                  const pCatId = typeof product.categoryId === 'object' ? product.categoryId?._id : product.categoryId;
                  const locations = Array.isArray(product.locations) && product.locations.length > 0
                    ? product.locations
                    : (Array.isArray(product.companyMappings)
                        ? Array.from(new Set(product.companyMappings.flatMap((m) => m?.states || [])))
                        : []);
                  const matchedCat = categories.find((c) => c._id === pCatId);
                  const categoryName = typeof product.categoryId === 'object' && product.categoryId?.name
                    ? product.categoryId.name
                    : (matchedCat ? matchedCat.name : '');
                  const categoryCode = typeof product.categoryId === 'object' && product.categoryId?.code
                    ? product.categoryId.code
                    : (matchedCat ? matchedCat.code : '');

                  return (
                    <tr
                      key={product._id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors ${
                        isBulkMode && isSelected
                          ? 'bg-blue-50/60 dark:bg-blue-900/10'
                          : ''
                      }`}
                    >
                      {isBulkMode && (
                        <td className="py-4 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectProduct(product._id)}
                            className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                        </td>
                      )}
                      {/* S.No. */}
                      <td className="py-4 px-5 text-center font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {serialNumber}
                      </td>

                      {/* Product Name & SKU */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                            <FiPackage className="text-base" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap">
                              {product.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5" onClick={(e) => e.stopPropagation()}>
                              <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                {product.sku}
                              </span>
                              <CopyButton text={product.sku} size={10} />
                              {/* {product.price !== undefined && product.price !== null && product.price !== '' && (
                                <span className="font-semibold text-[11px] text-emerald-600 dark:text-emerald-400 ml-1">
                                  ₹{Number(product.price).toLocaleString('en-IN')}
                                </span>
                              )} */}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Brand */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                          {product.brand || 'N/A'}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        {categoryName ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                              <FiTag className="text-[10px]" />
                              <span>{categoryName}</span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Partner Company */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        {compName ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {compName}
                              </span>
                              {compCode && (
                                <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  {compCode}
                                </span>
                              )}
                            </div>
                            {Array.isArray(product.companyMappings) && product.companyMappings.length > 1 && (
                              <div className="flex items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                  +{product.companyMappings.length - 1} more partner{product.companyMappings.length > 2 ? 's' : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Covered Locations */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        {locations.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            {locations.slice(0, 3).map((loc, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/5 whitespace-nowrap"
                              >
                                <FiMapPin className="text-[10px] text-blue-500 shrink-0" />
                                <span>{loc}</span>
                              </span>
                            ))}
                            {locations.length > 3 && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 cursor-help whitespace-nowrap"
                                title={locations.join(', ')}
                              >
                                +{locations.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">All Territories</span>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="py-4 px-5 text-center whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                          {product.unit || 'PCS'}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-4 px-5 max-w-[220px]">
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]" title={product.description}>
                          {product.description || '—'}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            product.isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                          }`}
                        >
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(product)}
                            className="inline-flex items-center gap-1.5 px-1.5 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 border border-blue-200/60 dark:border-blue-500/20 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                            title="View product details"
                          >
                            <FiEye className="text-base" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEdit(product, e)}
                            className="inline-flex items-center gap-1.5 px-1.5 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 border border-amber-200/60 dark:border-amber-500/20 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                            title="Edit"
                          >
                            <FiEdit2 className="text-sm" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmProduct(product);
                            }}
                            className="inline-flex items-center gap-1.5 px-1.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-200/60 dark:border-rose-500/20 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                            title="Delete"
                          >
                            <FiTrash2 className="text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ================= ATTACHED PAGINATION CONTROLS ================= */}
          {filteredProducts.length > 0 && (
            <div className="p-4 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Showing <strong className="text-slate-800 dark:text-slate-200">{indexOfFirstItem + 1}</strong> to{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {Math.min(indexOfLastItem, filteredProducts.length)}
                  </strong>{' '}
                  of <strong className="text-slate-800 dark:text-slate-200">{filteredProducts.length}</strong> products
                </span>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer shadow-xs"
                  >
                    <FiChevronLeft className="inline text-xs mr-0.5" /> Previous
                  </button>

                  {paginationPages.map((page, idx) =>
                    page === '...' ? (
                      <span key={idx} className="px-2 py-1 text-slate-400 text-xs">
                        ...
                      </span>
                    ) : (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          currentPage === page
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                            : 'border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer shadow-xs"
                  >
                    Next <FiChevronRight className="inline text-xs ml-0.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= PRODUCT DETAILS & EDIT SLIDE-OVER DRAWER ================= */}
      {isDrawerOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] overflow-hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 dark:bg-slate-950/60 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
              onClick={handleCloseDrawer}
            />

            {/* Slide-over Container (Pinned to Right) */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-6 md:pl-10">
              <div className="w-screen max-w-full sm:max-w-2xl md:max-w-3xl bg-white/20 dark:bg-slate-900/25 border-l border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 z-10 text-left">
                {/* Sticky Drawer Header */}
                <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 shrink-0 space-y-3">
                  {/* Top Bar: Icon + Title + Close Button */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-xs">
                        <FiPackage className="text-xl sm:text-2xl" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                            {drawerProduct ? drawerProduct.name : 'Add New Product'}
                          </h2>
                          {drawerProduct && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold ${
                                drawerProduct.isActive !== false
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                              }`}
                            >
                              {drawerProduct.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                          {drawerProduct ? (
                            <>
                              <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                                {drawerProduct.sku}
                              </span>
                              <CopyButton text={drawerProduct.sku} size={11} />
                            </>
                          ) : (
                            <p className="text-xs text-slate-400 truncate">Configure new catalog product with pricing and routing</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCloseDrawer}
                      className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
                      title="Close drawer (Esc)"
                    >
                      <FiX size={18} />
                    </button>
                  </div>

                  {/* Bottom Sub-Bar: Mode Selector Tabs & Stepper Navigation */}
                  {drawerProduct && (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/40 dark:border-white/5 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center p-0.5 sm:p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerTab('overview');
                            setFormError('');
                          }}
                          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            drawerTab === 'overview'
                              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          <FiEye className="text-xs" />
                          <span>Overview</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerTab('edit');
                            setFormError('');
                          }}
                          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            drawerTab === 'edit'
                              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          <FiEdit2 className="text-xs" />
                          <span>Edit</span>
                        </button>
                      </div>

                      {/* Product Stepper Navigation */}
                      {selectedProductIndex >= 0 && filteredProducts.length > 1 && (
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl p-0.5 sm:p-1 text-xs">
                          <button
                            type="button"
                            onClick={handlePrevProduct}
                            disabled={!canGoPrevProduct}
                            title="Previous Product (Left Arrow)"
                            className="p-1 sm:p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          >
                            <FiChevronLeft size={15} />
                          </button>
                          <span className="px-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 font-semibold select-none">
                            {selectedProductIndex + 1} of {filteredProducts.length}
                          </span>
                          <button
                            type="button"
                            onClick={handleNextProduct}
                            disabled={!canGoNextProduct}
                            title="Next Product (Right Arrow)"
                            className="p-1 sm:p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          >
                            <FiChevronRight size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Scrollable Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-7 custom-scrollbar space-y-5 sm:space-y-6">
                  {drawerTab === 'overview' && drawerProduct ? (
                    <>
                      {/* Product Specifications Grid */}
                      <div className="bg-slate-50/80 dark:bg-white/[0.03] p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-4">
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <FiTag className="text-blue-500" />
                          <span>General Information</span>
                        </h3>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Brand</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                              {drawerProduct.brand || 'N/A'}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</p>
                            {(() => {
                              const cat = getDrawerCategoryDetails(drawerProduct);
                              return cat ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                    {cat.name}
                                  </span>
                                  {cat.code && (
                                    <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                                      {cat.code}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-slate-400 italic">Unassigned</p>
                              );
                            })()}
                          </div>

                          {/* <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Price (INR)</p>
                            <p className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {drawerProduct.price !== undefined && drawerProduct.price !== null && drawerProduct.price !== ''
                                ? `₹${Number(drawerProduct.price).toLocaleString('en-IN')}`
                                : '₹0'}
                            </p>
                          </div> */}

                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Measurement Unit</p>
                            <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100">
                              {drawerProduct.unit || 'PCS'}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Catalog Status</p>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                drawerProduct.isActive !== false
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                              }`}
                            >
                              {drawerProduct.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          </div>

                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Created Date</p>
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              {formatDateTimeDDMMYYYY(drawerProduct.createdAt)}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Updated</p>
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              {formatDateTimeDDMMYYYY(drawerProduct.updatedAt)}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-400">Product System ID:</span>
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{drawerProduct._id}</span>
                            <CopyButton text={drawerProduct._id} size={10} />
                          </div>
                          {(() => {
                            const cat = getDrawerCategoryDetails(drawerProduct);
                            return cat?.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-slate-400">Category ID:</span>
                                <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{cat.id}</span>
                                <CopyButton text={cat.id} size={10} />
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </div>

                      {/* Company Territory Routing (companyMappings) */}
                      {Array.isArray(drawerProduct.companyMappings) && drawerProduct.companyMappings.length > 0 ? (
                        <div className="bg-slate-50/80 dark:bg-white/[0.03] p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                              <FiBriefcase className="text-blue-500" />
                              <span>Company Territory Routing ({drawerProduct.companyMappings.length})</span>
                            </h3>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              companyMappings
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            {drawerProduct.companyMappings.map((mapping, idx) => {
                              const compObj =
                                typeof mapping.companyId === 'object' && mapping.companyId !== null
                                  ? mapping.companyId
                                  : companies.find((c) => c._id === mapping.companyId);
                              const compName = compObj?.name || (typeof mapping.companyId === 'string' ? mapping.companyId : 'Unassigned');
                              const compCode = compObj?.code || null;
                              const states = Array.isArray(mapping.states) ? mapping.states : [];
                              const isWildcard = states.includes('*');

                              return (
                                <div
                                  key={idx}
                                  className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-white/5 space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                                        {idx + 1}
                                      </span>
                                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                                        {compName}
                                      </span>
                                      {compCode && (
                                        <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                          {compCode}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                      {isWildcard
                                        ? 'Pan-India Wildcard'
                                        : `${states.length} ${states.length === 1 ? 'state' : 'states'}`}
                                    </span>
                                  </div>

                                  {states.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {states.map((st, sIdx) =>
                                        st === '*' ? (
                                          <span
                                            key={sIdx}
                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold border border-purple-500/20"
                                          >
                                            ★ Pan-India / All Territories (*)
                                          </span>
                                        ) : (
                                          <span
                                            key={sIdx}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-[10px] font-medium border border-slate-200/60 dark:border-white/5"
                                          >
                                            <FiMapPin className="text-[9px] text-blue-500 shrink-0" />
                                            <span>{st}</span>
                                          </span>
                                        )
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">No specific states assigned (All territories fallback)</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        /* Single Trading / Partner Company Fallback */
                        <div className="bg-slate-50/80 dark:bg-white/[0.03] p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-3">
                          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <FiBriefcase className="text-emerald-500" />
                            <span>Partner / Trading Company</span>
                          </h3>

                          {(() => {
                            const comp = getDrawerCompanyDetails(drawerProduct);
                            return (
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-white/5">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                                      {comp.name}
                                    </span>
                                    {comp.code && (
                                      <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md border border-blue-500/20">
                                        {comp.code}
                                      </span>
                                    )}
                                  </div>
                                  {comp.id && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                                      <span>ID: {comp.id}</span>
                                      <CopyButton text={comp.id} size={10} />
                                    </div>
                                  )}
                                </div>

                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                                  <FiCheckCircle className="text-xs" />
                                  <span>Mapped Company</span>
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Covered Distribution Locations */}
                      <div className="bg-slate-50/80 dark:bg-white/[0.03] p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <FiMapPin className="text-rose-500" />
                            <span>Covered Locations / Territories</span>
                          </h3>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                            {(drawerProduct.locations || []).length} Locations
                          </span>
                        </div>

                        {Array.isArray(drawerProduct.locations) && drawerProduct.locations.length > 0 ? (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {drawerProduct.locations.map((loc, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 shadow-2xs"
                              >
                                <FiGlobe className="text-blue-500 text-xs shrink-0" />
                                <span>{loc}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-slate-400 text-xs italic bg-white/40 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-white/10">
                            No specific locations assigned. This product can be distributed across all territories.
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <div className="bg-slate-50/80 dark:bg-white/[0.03] p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-2">
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Product Description
                        </h3>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {drawerProduct.description || 'No detailed description provided for this product.'}
                        </p>
                      </div>
                    </>
                  ) : (
                    /* Edit or Create Form */
                    <form onSubmit={handleSaveProduct} className="space-y-4">
                      {formError && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                          <FiAlertCircle className="shrink-0 text-sm" />
                          <span>{formError}</span>
                        </div>
                      )}

                      {/* Product Name */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Product Name *
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => handleNameChange(e.target.value)}
                          placeholder="e.g. Whatnot NitroCharge 65W GaN Fast Charger Pro"
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
                          required
                        />
                      </div>

                      {/* SKU, Brand, Category & Unit Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            SKU Code *
                          </label>
                          <input
                            type="text"
                            value={formData.sku}
                            onChange={(e) => setFormData({ ...formData, sku: formatEntityCode(e.target.value), skuManual: true })}
                            placeholder="e.g. WNOT-CHG-065"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 uppercase"
                            required
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                              Brand Name *
                            </label>
                            {activeBrandGroup && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-md border border-emerald-500/20">
                                <FiZap className="text-[10px]" />
                                <span>Matrix</span>
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <CustomDropdown
                              value={formData.brand || ''}
                              onChange={(val) => handleBrandSelect(val)}
                              placeholder="Select or enter Brand"
                              defaultLabel="Select Brand"
                              searchable={true}
                              allowCustom={true}
                              options={brandOptions}
                              statusColor="!px-3 !py-2 !bg-slate-50 dark:!bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                              Category
                            </label>
                            <span className="text-[10px] font-mono text-slate-400">categoryId</span>
                          </div>
                          <CustomDropdown
                            value={formData.categoryId || ''}
                            onChange={(val) => setFormData({ ...formData, categoryId: val })}
                            placeholder="Select Category (None)"
                            defaultLabel="Select Category (None)"
                            searchable={true}
                            options={[
                              { value: '', label: 'Select Category (None)' },
                              ...categories.map((c) => ({
                                value: c._id,
                                label: `${c.name}${c.code ? ` (${c.code})` : ''}`
                              }))
                            ]}
                            statusColor="!px-3 !py-2 !bg-slate-50 dark:!bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                          />
                        </div>

                        {/* Price (INR) Field */}
                        {/* <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                              Price (₹)
                            </label>
                            <span className="text-[10px] font-mono text-slate-400">price</span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            placeholder="e.g. 1499"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/40"
                          />
                        </div> */}

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Unit *
                          </label>
                          <input
                            type="text"
                            value={formData.unit}
                            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                            placeholder="e.g. PCS, BOX"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden uppercase"
                            required
                          />
                        </div>
                      </div>

                      {/* Product Distribution Locations (locations) */}
                      <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-white/10">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <FiMapPin className="text-blue-500" />
                              <span>Product Distribution Locations</span>
                              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                {(formData.locations || []).length} Selected
                              </span>
                            </label>
                            <p className="text-[11px] text-slate-400">
                              Distribution states and territories where this product is actively covered.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              onClick={handleSelectAllProductLocations}
                              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              All 36 States
                            </button>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <button
                              type="button"
                              onClick={handleClearProductLocations}
                              className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>

                        {/* Selected Locations Tags */}
                        {Array.isArray(formData.locations) && formData.locations.length > 0 && (
                          <div className="flex flex-wrap gap-1 p-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/5 max-h-24 overflow-y-auto">
                            {formData.locations.map((loc, lIdx) => (
                              <span
                                key={lIdx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold border border-blue-500/20"
                              >
                                <span>{loc}</span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleProductLocation(loc)}
                                  className="hover:text-rose-500 ml-0.5 cursor-pointer"
                                >
                                  <FiX size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Quick Indian States Pills */}
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
                          {INDIAN_STATES.map((st) => {
                            const isSelected = (formData.locations || []).includes(st);
                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => handleToggleProductLocation(st)}
                                className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                    : 'bg-white hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10'
                                }`}
                              >
                                {isSelected ? '✓ ' : '+ '}{st}
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom Location / State Entry */}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={customLocationInput}
                            onChange={(e) => setCustomLocationInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomProductLocation(customLocationInput);
                                setCustomLocationInput('');
                              }
                            }}
                            placeholder="Type state/region or 'ALL' and press Enter..."
                            className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleAddCustomProductLocation(customLocationInput);
                              setCustomLocationInput('');
                            }}
                            disabled={!customLocationInput.trim()}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-40"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {/* Company Territory Routing (companyMappings) */}
                      <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-white/10">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <FiBriefcase className="text-blue-500" />
                              <span>Company Territory Routing</span>
                              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                companyMappings
                              </span>
                            </label>
                            <p className="text-[11px] text-slate-400">
                              Auto-mapped from Brand Routing Matrix or customize manually per trading partner.
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleManualSyncBrandRouting}
                              disabled={isAutoMappingBrand || !formData.brand}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-500/20 transition-all cursor-pointer disabled:opacity-40"
                              title="Fetch and re-apply routing matrix rules for this brand"
                            >
                              <FiZap className={`text-xs ${isAutoMappingBrand ? 'animate-spin' : ''}`} />
                              <span>Sync Matrix</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleAddCompanyMapping}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-500/20 transition-all cursor-pointer"
                            >
                              <FiPlus className="text-xs" />
                              <span>Add Partner</span>
                            </button>
                          </div>
                        </div>

                        {/* Auto-Mapped Notification Banner */}
                        {autoMappedBanner && (
                          <div className="flex items-center justify-between p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-700 dark:text-blue-300 text-xs animate-in fade-in duration-200">
                            <div className="flex items-center gap-2">
                              <FiZap className="text-sm shrink-0 text-blue-500" />
                              <span className="font-medium">{autoMappedBanner}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAutoMappedBanner(null)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer ml-2"
                            >
                              <FiX size={12} />
                            </button>
                          </div>
                        )}

                        {/* Mapping Cards */}
                        <div className="space-y-3">
                          {(formData.companyMappings || []).map((mapping, mIdx) => {
                            const compCount = (formData.companyMappings || []).length;
                            const isWildcard = (mapping.states || []).includes('*');

                            return (
                              <div
                                key={mIdx}
                                className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-3"
                              >
                                {/* Header of mapping: Company dropdown + Delete */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                                      {mIdx + 1}
                                    </span>
                                    <div className="flex-1">
                                      <CustomDropdown
                                        value={mapping.companyId}
                                        onChange={(val) => handleUpdateCompanyMappingCompany(mIdx, val)}
                                        defaultLabel="Select Trading Company"
                                        options={companies.map((c) => ({
                                          value: c._id,
                                          label: `${c.name} ${c.code ? `(${c.code})` : ''}`
                                        }))}
                                        statusColor="!px-3 !py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                                      />
                                    </div>
                                  </div>

                                  {compCount > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCompanyMapping(mIdx)}
                                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all cursor-pointer shrink-0"
                                      title="Remove this company mapping"
                                    >
                                      <FiTrash2 className="text-sm" />
                                    </button>
                                  )}
                                </div>

                                {/* Assigned States */}
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                      <FiMapPin className="text-[10px] text-blue-500" />
                                      <span>
                                        Covered States ({isWildcard ? 'All / Wildcard' : mapping.states?.length || 0})
                                      </span>
                                    </span>
                                    <div className="flex items-center gap-2 text-[10px]">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleWildcardMapping(mIdx)}
                                        className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                                          isWildcard
                                            ? 'bg-purple-600 text-white font-bold'
                                            : 'text-purple-600 dark:text-purple-400 hover:underline'
                                        }`}
                                        title="Assign pan-India / all territories wildcard (*)"
                                      >
                                        ★ Pan-India (*)
                                      </button>
                                      <span className="text-slate-300 dark:text-slate-600">|</span>
                                      <button
                                        type="button"
                                        onClick={() => handleSelectAllStatesForMapping(mIdx)}
                                        className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                                      >
                                        All 36 States
                                      </button>
                                      <span className="text-slate-300 dark:text-slate-600">|</span>
                                      <button
                                        type="button"
                                        onClick={() => handleClearStatesForMapping(mIdx)}
                                        className="text-slate-500 hover:text-rose-500 font-semibold cursor-pointer"
                                      >
                                        Clear
                                      </button>
                                    </div>
                                  </div>

                                  {/* Selected States Tags */}
                                  {mapping.states && mapping.states.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2 p-1.5 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-white/5 max-h-24 overflow-y-auto">
                                      {mapping.states.map((st, sIdx) =>
                                        st === '*' ? (
                                          <span
                                            key={sIdx}
                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold border border-purple-500/20"
                                          >
                                            <span>★ Pan-India Wildcard (*)</span>
                                            <button
                                              type="button"
                                              onClick={() => handleToggleWildcardMapping(mIdx)}
                                              className="hover:text-rose-500 ml-0.5 cursor-pointer"
                                            >
                                              <FiX size={10} />
                                            </button>
                                          </span>
                                        ) : (
                                          <span
                                            key={sIdx}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold border border-blue-500/20"
                                          >
                                            <span>{st}</span>
                                            <button
                                              type="button"
                                              onClick={() => handleToggleMappingState(mIdx, st)}
                                              className="hover:text-rose-500 ml-0.5 cursor-pointer"
                                            >
                                              <FiX size={10} />
                                            </button>
                                          </span>
                                        )
                                      )}
                                    </div>
                                  )}

                                  {/* Quick Indian States Pills */}
                                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 rounded-xl border border-slate-200/60 dark:border-white/5 bg-white/50 dark:bg-black/20 mb-2">
                                    {INDIAN_STATES.map((st) => {
                                      const isSelected = mapping.states?.includes(st);
                                      return (
                                        <button
                                          key={st}
                                          type="button"
                                          onClick={() => handleToggleMappingState(mIdx, st)}
                                          className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                                            isSelected
                                              ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                              : 'bg-white hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10'
                                          }`}
                                        >
                                          {isSelected ? '✓ ' : '+ '}{st}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* Custom Location / State Entry */}
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={customMappingInputs[mIdx] || ''}
                                      onChange={(e) =>
                                        setCustomMappingInputs((prev) => ({ ...prev, [mIdx]: e.target.value }))
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          const val = customMappingInputs[mIdx] || '';
                                          handleAddCustomLocationToMapping(mIdx, val);
                                          setCustomMappingInputs((prev) => ({ ...prev, [mIdx]: '' }));
                                        }
                                      }}
                                      placeholder="Type state/region, '*' for all, or 'ALL'..."
                                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const val = customMappingInputs[mIdx] || '';
                                        handleAddCustomLocationToMapping(mIdx, val);
                                        setCustomMappingInputs((prev) => ({ ...prev, [mIdx]: '' }));
                                      }}
                                      disabled={!(customMappingInputs[mIdx] || '').trim()}
                                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-40"
                                    >
                                      Add
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {(!formData.companyMappings || formData.companyMappings.length === 0) && (
                            <div className="p-4 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
                              <p className="text-xs text-slate-400 mb-2">No company routing mappings configured.</p>
                              <button
                                type="button"
                                onClick={handleAddCompanyMapping}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors"
                              >
                                + Add Partner Company
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Product Description
                        </label>
                        <textarea
                          rows={3}
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="e.g. Updated ultra-compact 65W GaN fast charger"
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden resize-none"
                        />
                      </div>

                      {/* Status Toggle */}
                      <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10">
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Catalog Active Status</div>
                          <div className="text-[11px] text-slate-400">
                            Active products appear in sales order booking screens.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                          className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                            formData.isActive ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                              formData.isActive ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Sticky Drawer Footer */}
                <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
                  {drawerTab === 'overview' && drawerProduct ? (
                    <>
                      <button
                        type="button"
                        onClick={handleCloseDrawer}
                        className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        Close Drawer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDrawerTab('edit');
                          populateProductForm(drawerProduct);
                        }}
                        className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-600/25 cursor-pointer"
                      >
                        <FiEdit2 className="text-xs" />
                        <span>Edit Product</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (drawerProduct) {
                            setDrawerTab('overview');
                            setFormError('');
                          } else {
                            handleCloseDrawer();
                          }
                        }}
                        disabled={submitting}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        {drawerProduct ? 'Back to Overview' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveProduct}
                        disabled={submitting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-600/25 cursor-pointer disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <FiLoader className="text-sm animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <FiSave className="text-sm" />
                            <span>{drawerProduct ? 'Update Product' : 'Create Product'}</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ================= DELETE CONFIRM MODAL ================= */}
      {deleteConfirmProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 dark:bg-slate-950/50 backdrop-blur-lg animate-in fade-in duration-200">
          <div className="bg-white/40 dark:bg-slate-950/25 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center text-2xl mb-4">
              <FiTrash2 />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Catalog Product?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-slate-200">"{deleteConfirmProduct.name}"</span>? This will permanently remove the product from the catalog.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmProduct(null)}
                disabled={deleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-rose-600/25 cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= BULK EXCEL IMPORT MODAL ================= */}
      <BulkProductImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        companies={companies}
        categories={categories}
        brandMatrix={brandMatrix}
        existingProducts={products}
        onImportComplete={handleImportComplete}
      />

      {/* Floating Bulk Action Bar */}
      {isBulkMode && !isBulkCompanyModalOpen && !isBulkLocationModalOpen && !isBulkEditModalOpen && !batchProgress && !isDrawerOpen && (
        <BulkActionBar
          selectedCount={selectedProductIds.length}
          totalCount={filteredProducts.length}
          onClearSelection={() => setSelectedProductIds([])}
          onSelectAll={handleSelectAllFiltered}
          isAllSelected={selectedProductIds.length > 0 && selectedProductIds.length === filteredProducts.length}
          onExitBulkMode={() => {
            setIsBulkMode(false);
            setSelectedProductIds([]);
          }}
          actions={[
            {
              id: 'activate',
              label: 'Set Active',
              icon: FiCheckCircle,
              variant: 'primary',
              disabled: selectedProductIds.length === 0,
              onClick: () => handleBulkStatusChange(true)
            },
            {
              id: 'deactivate',
              label: 'Set Inactive',
              icon: FiAlertCircle,
              variant: 'danger',
              disabled: selectedProductIds.length === 0,
              onClick: () => handleBulkStatusChange(false)
            },
            {
              id: 'move-comp',
              label: 'Reassign Company',
              icon: FiBriefcase,
              variant: 'warning',
              disabled: selectedProductIds.length === 0,
              onClick: () => {
                setBulkTargetCompanyId(companies[0]?._id || '');
                setIsBulkCompanyModalOpen(true);
              }
            },
            {
              id: 'bulk-edit',
              label: 'Bulk Edit',
              icon: FiEdit2,
              variant: 'purple',
              disabled: selectedProductIds.length === 0,
              onClick: () => {
                resetBulkEditForm();
                setIsBulkEditModalOpen(true);
              }
            },
            {
              id: 'reassign-locations',
              label: 'Sync / Edit Locations',
              icon: FiMapPin,
              variant: 'info',
              disabled: selectedProductIds.length === 0,
              onClick: () => {
                setBulkLocations([]);
                setBulkLocationMode('sync-matrix');
                setBulkCustomLocationInput('');
                setIsBulkLocationModalOpen(true);
              }
            },
            {
              id: 'export',
              label: 'Export Excel',
              icon: FiDownload,
              variant: 'secondary',
              disabled: selectedProductIds.length === 0,
              onClick: handleBulkExportProducts
            }
          ]}
        />
      )}

      {/* ================= BULK COMPANY MODAL ================= */}
      {isBulkCompanyModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 dark:bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white/40 dark:bg-slate-950/25 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200 my-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-2xl mb-4 border border-amber-500/20">
                <FiBriefcase />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Reassign Products to Company</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Reassign <span className="font-bold text-slate-800 dark:text-slate-200">{selectedProductIds.length}</span> selected products to the following partner company:
              </p>

              <div className="mt-4">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Target Partner Company
                </label>
                <CustomDropdown
                  value={bulkTargetCompanyId}
                  onChange={(val) => setBulkTargetCompanyId(val)}
                  defaultLabel="Select Target Partner Company"
                  placeholder="Select Target Partner Company"
                  searchable={true}
                  options={companies.map((c) => ({
                    value: c._id,
                    label: `${c.name}${c.code ? ` (${c.code})` : ''}`
                  }))}
                  statusColor="!px-3.5 !py-2.5 !bg-slate-50 dark:!bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkCompanyModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkMoveCompany}
                  disabled={!bulkTargetCompanyId}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-amber-600/25 cursor-pointer disabled:opacity-50"
                >
                  Apply Reassignment
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ================= BULK LOCATION REASSIGNMENT MODAL ================= */}
      {isBulkLocationModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 dark:bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white/40 dark:bg-slate-950/25 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-xl p-6 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] my-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl shrink-0 border border-blue-500/20">
                  <FiMapPin />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Bulk Reassign Distribution Locations
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Update covered territories for <span className="font-bold text-slate-800 dark:text-slate-200">{selectedProductIds.length}</span> selected products.
                  </p>
                </div>
              </div>

              {/* Mode Selector Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl">
                {[
                  { id: 'sync-matrix', label: 'Sync Matrix', desc: 'By Brand', icon: FiZap },
                  { id: 'replace', label: 'Replace', desc: 'Overwrite' },
                  { id: 'append', label: 'Append', desc: 'Add to existing' },
                  { id: 'all', label: 'All 36 States', desc: 'Pan-India' },
                  { id: 'clear', label: 'Clear All', desc: 'Remove' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setBulkLocationMode(tab.id)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      bulkLocationMode === tab.id
                        ? tab.id === 'sync-matrix'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                          : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="truncate flex items-center justify-center gap-1">
                      {tab.icon && <tab.icon className="text-xs shrink-0" />}
                      <span>{tab.label}</span>
                    </div>
                    <div className="text-[10px] font-normal opacity-70 truncate">{tab.desc}</div>
                  </button>
                ))}
              </div>

              {/* Sync Matrix View */}
              {bulkLocationMode === 'sync-matrix' && (
                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs text-blue-800 dark:text-blue-300 space-y-1.5">
                    <p className="font-bold flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400">
                      <FiZap className="text-base" /> Sync Locations According to Brand Matrix
                    </p>
                    <p className="leading-relaxed">
                      Each selected product will be evaluated against the configured rules in the <strong>Brand Routing Matrix</strong>. The product's covered distribution locations and trading partner mappings will be automatically assigned based on its specific brand.
                    </p>
                  </div>

                  {/* Selected products brand summary */}
                  {(() => {
                    const selectedProds = products.filter((p) => selectedProductIds.includes(p._id));
                    const brandCounts = {};
                    selectedProds.forEach((p) => {
                      const b = (p.brand || 'Unassigned').trim();
                      brandCounts[b] = (brandCounts[b] || 0) + 1;
                    });
                    const uniqueBrandList = Object.entries(brandCounts);

                    return (
                      <div className="space-y-2 p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <span>Brands in Selection ({uniqueBrandList.length})</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {selectedProductIds.length} Total Products
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                          {uniqueBrandList.map(([bName, count]) => {
                            const hasMatrixRule = (brandMatrix || []).some(
                              (bm) => bm.brand && bm.brand.trim().toLowerCase() === bName.toLowerCase()
                            );
                            return (
                              <span
                                key={bName}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
                                  hasMatrixRule
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                }`}
                              >
                                <FiZap className="text-[11px]" />
                                <span>{bName}</span>
                                <span className="text-[10px] font-mono opacity-80">({count})</span>
                                {hasMatrixRule ? (
                                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                    ✓ Configured
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                                    (Fallback)
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* State selection UI for 'replace' and 'append' */}
              {(bulkLocationMode === 'replace' || bulkLocationMode === 'append') && (
                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Selected States ({bulkLocations.length})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBulkLocations([...INDIAN_STATES])}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Select All 36
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <button
                        type="button"
                        onClick={() => setBulkLocations([])}
                        className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Selected pills */}
                  {bulkLocations.length > 0 && (
                    <div className="flex flex-wrap gap-1 p-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/5 max-h-28 overflow-y-auto">
                      {bulkLocations.map((st, sIdx) => (
                        <span
                          key={sIdx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-semibold border border-blue-500/20"
                        >
                          <span>{st}</span>
                          <button
                            type="button"
                            onClick={() => setBulkLocations((prev) => prev.filter((s) => s !== st))}
                            className="hover:text-rose-500 cursor-pointer"
                          >
                            <FiX size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Custom input */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={bulkCustomLocationInput}
                      onChange={(e) => setBulkCustomLocationInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = bulkCustomLocationInput.trim();
                          if (val) {
                            if (isAllKeyword(val)) {
                              setBulkLocations([...INDIAN_STATES]);
                            } else if (!bulkLocations.includes(val)) {
                              setBulkLocations((prev) => [...prev, val]);
                            }
                            setBulkCustomLocationInput('');
                          }
                        }
                      }}
                      placeholder="Type state/region name and press Enter..."
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = bulkCustomLocationInput.trim();
                        if (val) {
                          if (isAllKeyword(val)) {
                            setBulkLocations([...INDIAN_STATES]);
                          } else if (!bulkLocations.includes(val)) {
                            setBulkLocations((prev) => [...prev, val]);
                          }
                          setBulkCustomLocationInput('');
                        }
                      }}
                      disabled={!bulkCustomLocationInput.trim()}
                      className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>

                  {/* Quick Indian States Pills */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Quick Pick (All 36 Indian States & UTs):
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto p-2 rounded-xl border border-slate-200/80 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
                      {INDIAN_STATES.map((st) => {
                        const isSelected = bulkLocations.includes(st);
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              setBulkLocations((prev) =>
                                prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
                              );
                            }}
                            className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                : 'bg-white hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}{st}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {bulkLocationMode === 'all' && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs text-blue-700 dark:text-blue-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1">
                    <FiGlobe className="text-sm" /> All 36 States & Union Territories
                  </p>
                  <p>
                    Every selected product will be configured for pan-India distribution across all 28 states and 8 union territories.
                  </p>
                </div>
              )}

              {bulkLocationMode === 'clear' && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-700 dark:text-rose-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1">
                    <FiAlertCircle className="text-sm" /> Clear All Covered Locations
                  </p>
                  <p>
                    All location and territory associations will be removed from the {selectedProductIds.length} selected products.
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsBulkLocationModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkReassignLocations}
                  disabled={
                    (bulkLocationMode === 'replace' || bulkLocationMode === 'append') &&
                    bulkLocations.length === 0
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-600/25 cursor-pointer disabled:opacity-50"
                >
                  {bulkLocationMode === 'sync-matrix'
                    ? `Sync ${selectedProductIds.length} Products with Matrix`
                    : `Apply to ${selectedProductIds.length} Products`}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ================= BULK PRODUCT EDIT MODAL ================= */}
      {isBulkEditModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 dark:bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white/40 dark:bg-slate-950/25 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-xl p-6 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] my-auto">
              <div className="flex items-center gap-3 mb-4 shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-2xl shrink-0 border border-purple-500/20">
                  <FiEdit2 />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Bulk Edit Products
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Update common properties across <span className="font-bold text-slate-800 dark:text-slate-200">{selectedProductIds.length}</span> selected products using the single product API.
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Category */}
                <div className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkEditFields.updateCategory}
                      onChange={(e) =>
                        setBulkEditFields((prev) => ({ ...prev, updateCategory: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Update Category
                    </span>
                  </label>
                  {bulkEditFields.updateCategory && (
                    <CustomDropdown
                      value={bulkEditFields.categoryId}
                      onChange={(val) =>
                        setBulkEditFields((prev) => ({ ...prev, categoryId: val }))
                      }
                      placeholder="Select Category"
                      defaultLabel="Select Category"
                      searchable={true}
                      options={categories.map((c) => ({
                        value: c._id,
                        label: `${c.name}${c.code ? ` (${c.code})` : ''}`
                      }))}
                      statusColor="!px-3.5 !py-2 !bg-white dark:!bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                  )}
                </div>

                {/* Brand */}
                <div className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkEditFields.updateBrand}
                      onChange={(e) =>
                        setBulkEditFields((prev) => ({ ...prev, updateBrand: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Update Brand
                    </span>
                  </label>
                  {bulkEditFields.updateBrand && (
                    <CustomDropdown
                      value={bulkEditFields.brand}
                      onChange={(val) =>
                        setBulkEditFields((prev) => ({ ...prev, brand: val }))
                      }
                      placeholder="Select or enter Brand"
                      defaultLabel="Select Brand"
                      searchable={true}
                      allowCustom={true}
                      options={bulkBrandOptions}
                      statusColor="!px-3.5 !py-2 !bg-white dark:!bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                  )}
                </div>

                {/* Price */}
                {/* <div className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkEditFields.updatePrice}
                      onChange={(e) =>
                        setBulkEditFields((prev) => ({ ...prev, updatePrice: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Update Price
                    </span>
                  </label>
                  {bulkEditFields.updatePrice && (
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={bulkEditFields.priceMode}
                        onChange={(e) =>
                          setBulkEditFields((prev) => ({ ...prev, priceMode: e.target.value }))
                        }
                        className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-hidden"
                      >
                        <option value="fixed">Set Fixed Price (₹)</option>
                        <option value="increase_percent">Increase by (%)</option>
                        <option value="decrease_percent">Decrease by (%)</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={bulkEditFields.priceValue}
                        onChange={(e) =>
                          setBulkEditFields((prev) => ({ ...prev, priceValue: e.target.value }))
                        }
                        placeholder={bulkEditFields.priceMode === 'fixed' ? 'e.g. 1499' : 'e.g. 10'}
                        className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-hidden"
                      />
                    </div>
                  )}
                </div> */}

                {/* Unit */}
                <div className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkEditFields.updateUnit}
                      onChange={(e) =>
                        setBulkEditFields((prev) => ({ ...prev, updateUnit: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Update Unit of Measurement
                    </span>
                  </label>
                  {bulkEditFields.updateUnit && (
                    <CustomDropdown
                      value={bulkEditFields.unit}
                      onChange={(val) =>
                        setBulkEditFields((prev) => ({ ...prev, unit: val }))
                      }
                      defaultLabel="Select Unit"
                      placeholder="Select Unit"
                      options={['PCS', 'BOX', 'SET', 'MTR', 'KG', 'L', 'PACK', 'DOZEN'].map((u) => ({
                        value: u,
                        label: u
                      }))}
                      statusColor="!px-3.5 !py-2 !bg-white dark:!bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                  )}
                </div>

                {/* Status */}
                <div className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkEditFields.updateStatus}
                      onChange={(e) =>
                        setBulkEditFields((prev) => ({ ...prev, updateStatus: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Update Catalog Status
                    </span>
                  </label>
                  {bulkEditFields.updateStatus && (
                    <div className="flex items-center gap-4 pt-1">
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="bulkStatus"
                          checked={bulkEditFields.isActive === true}
                          onChange={() =>
                            setBulkEditFields((prev) => ({ ...prev, isActive: true }))
                          }
                          className="text-emerald-600 cursor-pointer"
                        />
                        <span>Active</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="bulkStatus"
                          checked={bulkEditFields.isActive === false}
                          onChange={() =>
                            setBulkEditFields((prev) => ({ ...prev, isActive: false }))
                          }
                          className="text-rose-600 cursor-pointer"
                        />
                        <span>Inactive</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Sync Locations with Matrix */}
                <div className="p-3.5 bg-blue-500/10 dark:bg-blue-500/5 rounded-2xl border border-blue-500/20 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkEditFields.syncLocationsWithMatrix}
                      onChange={(e) =>
                        setBulkEditFields((prev) => ({
                          ...prev,
                          syncLocationsWithMatrix: e.target.checked
                        }))
                      }
                      className="w-4 h-4 mt-0.5 rounded text-blue-600 cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                        <FiZap className="text-blue-500 shrink-0" /> Sync Locations According to Brand Matrix
                      </span>
                      <p className="text-[11px] text-blue-800/80 dark:text-blue-400 mt-0.5 leading-relaxed">
                        Automatically evaluate the Brand Routing Matrix for each product's brand and sync covered distribution locations and trading partner mappings.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsBulkEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkEditSubmit}
                  disabled={
                    !bulkEditFields.updateCategory &&
                    !bulkEditFields.updateBrand &&
                    !bulkEditFields.updatePrice &&
                    !bulkEditFields.updateUnit &&
                    !bulkEditFields.updateStatus &&
                    !bulkEditFields.syncLocationsWithMatrix
                  }
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-purple-600/25 cursor-pointer disabled:opacity-50"
                >
                  Update {selectedProductIds.length} Products
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Batch Progress Modal */}
      {batchProgress && (
        <BatchProgressModal
          isOpen={batchProgress.isOpen}
          title={batchProgress.title}
          current={batchProgress.current}
          total={batchProgress.total}
          percentage={batchProgress.percentage}
          status={batchProgress.status}
          isFinished={batchProgress.isFinished}
          logs={batchProgress.logs}
          onAbort={() => { abortBatchRef.current = true; }}
          onClose={() => setBatchProgress(null)}
        />
      )}
    </div>
  );
};

export default Products;