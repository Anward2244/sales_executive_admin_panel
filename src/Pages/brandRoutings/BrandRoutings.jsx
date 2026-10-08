import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FiGitBranch,
  FiMapPin,
  FiLayers,
  FiCheck,
  FiX,
  FiPlus,
  FiTrash2,
  FiSearch,
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiEdit2,
  FiArrowRight,
  FiShield,
  FiBriefcase,
  FiBox,
  FiSliders,
  FiEye,
  FiZap,
  FiChevronDown,
  FiChevronUp,
  FiUploadCloud,
  FiActivity,
  FiFilter,
  FiGlobe,
  FiPlay,
  FiList,
  FiGrid
} from 'react-icons/fi';
import {
  getBrandRoutingMatrixApi,
  getBrandRoutingByBrandApi,
  updateBrandRoutingMatrixApi,
  bulkUpdateBrandRoutingMatrixApi,
  resolveBrandRoutingApi,
  deleteBrandRoutingApi,
  getCompaniesApi
} from '@/api/axios';
import { INDIAN_STATES } from '@/utils/indianStates';
import PageHeader from '@/components/ui/PageHeader';
import CustomDropdown from '@/components/ui/CustomDropdown';
import CopyButton from '@/components/ui/CopyButton';
import { useDebounce } from '@/hooks/useDebounce';
import { SkeletonPulse } from '@/components/ui/Skeleton';

// Regional presets for fast territory assignment
const REGION_PRESETS = [
  { name: 'Pan-India (*)', states: ['*'] },
  {
    name: 'North',
    states: ['Delhi', 'Haryana', 'Punjab', 'Himachal Pradesh', 'Jammu and Kashmir', 'Ladakh', 'Rajasthan', 'Uttar Pradesh', 'Uttarakhand', 'Chandigarh']
  },
  {
    name: 'South',
    states: ['Andhra Pradesh', 'Karnataka', 'Kerala', 'Tamil Nadu', 'Telangana', 'Puducherry', 'Lakshadweep']
  },
  {
    name: 'West',
    states: ['Goa', 'Gujarat', 'Maharashtra', 'Dadra and Nagar Haveli and Daman and Diu']
  },
  {
    name: 'East & Central',
    states: ['Bihar', 'Jharkhand', 'Odisha', 'West Bengal', 'Chhattisgarh', 'Madhya Pradesh']
  },
  {
    name: 'North East',
    states: ['Assam', 'Arunachal Pradesh', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura']
  }
];

const BrandRoutings = () => {
  // Main Data States
  const [matrixData, setMatrixData] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filter
  const [searchBrand, setSearchBrand] = useState('');
  const debouncedSearchBrand = useDebounce(searchBrand, 200);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('ALL');
  const [selectedStateFilter, setSelectedStateFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'table'

  // Expand state for state chips in grouped view
  const [expandedStatesByBrand, setExpandedStatesByBrand] = useState({});

  // Single Brand Configuration Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalBrand, setModalBrand] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [mappings, setMappings] = useState([
    {
      states: ['*'],
      cities: [],
      excludedCities: [],
      companyCode: '',
      companyId: '',
      description: '',
      priority: 10,
      isActive: true
    }
  ]);
  const [stateSearchPerRule, setStateSearchPerRule] = useState({});
  const [loadingBrandDetails, setLoadingBrandDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Dedicated Test Route Simulation Modal
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [simBrand, setSimBrand] = useState('');
  const [simState, setSimState] = useState('*');
  const [simCity, setSimCity] = useState('');
  const [resolvingApi, setResolvingApi] = useState(false);
  const [liveResolvedResult, setLiveResolvedResult] = useState(null);
  const [liveResolveError, setLiveResolveError] = useState(null);
  const [deletingRuleId, setDeletingRuleId] = useState(null);

  // Bulk Matrix Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkBrands, setBulkBrands] = useState([
    {
      brand: '',
      replaceExisting: true,
      mappings: [
        {
          states: ['*'],
          cities: [],
          excludedCities: [],
          companyCode: '',
          companyId: '',
          description: '',
          priority: 10,
          isActive: true
        }
      ]
    }
  ]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkModalError, setBulkModalError] = useState(null);

  // Feedback Toast
  const [successToast, setSuccessToast] = useState(null);

  // Fetch Matrix & Companies
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [matrixRes, companiesRes] = await Promise.all([
        getBrandRoutingMatrixApi(),
        getCompaniesApi().catch(() => ({ data: [] }))
      ]);

      const rawMatrix = matrixRes?.data?.data || (Array.isArray(matrixRes?.data) ? matrixRes.data : []);
      setMatrixData(rawMatrix);

      const compList = companiesRes?.data?.data || (Array.isArray(companiesRes?.data) ? companiesRes.data : []);
      const compMap = new Map();
      if (Array.isArray(compList)) {
        compList.forEach((c) => {
          if (c?._id) compMap.set(c._id, c);
        });
      }
      rawMatrix.forEach((group) => {
        const rules = Array.isArray(group.rules) ? group.rules : (Array.isArray(group.mappings) ? group.mappings : []);
        rules.forEach((r) => {
          if (typeof r.companyId === 'object' && r.companyId?._id && !compMap.has(r.companyId._id)) {
            compMap.set(r.companyId._id, r.companyId);
          }
        });
      });
      setCompanies(Array.from(compMap.values()));
    } catch (err) {
      console.error('Failed to fetch brand routing matrix:', err);
      setError(err.response?.data?.message || 'Failed to load brand routing matrix.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toast Auto-dismiss
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Derived Brands List
  const allBrands = useMemo(() => {
    const set = new Set();
    matrixData.forEach((item) => {
      if (item.brand) set.add(item.brand);
    });
    return Array.from(set).sort();
  }, [matrixData]);

  // Flat rules for table
  const allRulesFlat = useMemo(() => {
    const list = [];
    matrixData.forEach((group) => {
      const brandName = group.brand;
      const rules = Array.isArray(group.rules) ? group.rules : (Array.isArray(group.mappings) ? group.mappings : []);
      rules.forEach((rule) => {
        list.push({
          ...rule,
          brand: rule.brand || brandName
        });
      });
    });
    return list;
  }, [matrixData]);

  // Derived list of unique states
  const uniqueRuleStates = useMemo(() => {
    const set = new Set();
    allRulesFlat.forEach((rule) => {
      if (Array.isArray(rule.states)) {
        rule.states.forEach((st) => set.add(st));
      }
    });
    return Array.from(set).sort();
  }, [allRulesFlat]);

  // Filtered Matrix Groups
  const filteredMatrix = useMemo(() => {
    return matrixData
      .filter((group) => {
        const rules = Array.isArray(group.rules) ? group.rules : (Array.isArray(group.mappings) ? group.mappings : []);

        if (debouncedSearchBrand.trim()) {
          const q = debouncedSearchBrand.toLowerCase().trim();
          const matchBrand = (group.brand || '').toLowerCase().includes(q);
          const matchRuleDesc = rules.some((r) => {
            const compObj = typeof r.companyId === 'object' ? r.companyId : null;
            const cCode = (compObj?.code || r.companyCode || '').toLowerCase();
            const cName = (compObj?.name || (companies.find((c) => c.code === r.companyCode || c._id === r.companyId)?.name || '')).toLowerCase();
            const matchCities = Array.isArray(r.cities) && r.cities.some((c) => c.toLowerCase().includes(q));
            const matchEx = Array.isArray(r.excludedCities) && r.excludedCities.some((c) => c.toLowerCase().includes(q));
            const matchStates = Array.isArray(r.states) && r.states.some((s) => s.toLowerCase().includes(q));
            return (
              (r.description || '').toLowerCase().includes(q) ||
              cCode.includes(q) ||
              cName.includes(q) ||
              matchCities ||
              matchEx ||
              matchStates
            );
          });
          if (!matchBrand && !matchRuleDesc) return false;
        }

        if (selectedCompanyFilter !== 'ALL') {
          const hasCompany = rules.some((r) => {
            const compObj = typeof r.companyId === 'object' ? r.companyId : null;
            const cId = compObj?._id || (typeof r.companyId === 'string' ? r.companyId : '');
            const cCode = compObj?.code || r.companyCode || '';
            return cId === selectedCompanyFilter || cCode === selectedCompanyFilter;
          });
          if (!hasCompany) return false;
        }

        if (selectedStateFilter !== 'ALL') {
          const hasState = rules.some((r) => {
            return Array.isArray(r.states) && r.states.includes(selectedStateFilter);
          });
          if (!hasState) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.brand === 'ALL') return -1;
        if (b.brand === 'ALL') return 1;
        return a.brand.localeCompare(b.brand);
      });
  }, [matrixData, debouncedSearchBrand, selectedCompanyFilter, selectedStateFilter, companies]);

  // Filtered Flat Rules for Table
  const filteredFlatRules = useMemo(() => {
    return allRulesFlat.filter((rule) => {
      if (debouncedSearchBrand.trim()) {
        const q = debouncedSearchBrand.toLowerCase().trim();
        const matchBrand = (rule.brand || '').toLowerCase().includes(q);
        const matchDesc = (rule.description || '').toLowerCase().includes(q);
        const compObj = typeof rule.companyId === 'object' ? rule.companyId : null;
        const cCode = (compObj?.code || rule.companyCode || '').toLowerCase();
        const cName = (compObj?.name || (companies.find((c) => c.code === rule.companyCode || c._id === rule.companyId)?.name || '')).toLowerCase();
        const matchCities = Array.isArray(rule.cities) && rule.cities.some((c) => c.toLowerCase().includes(q));
        const matchEx = Array.isArray(rule.excludedCities) && rule.excludedCities.some((c) => c.toLowerCase().includes(q));
        const matchStates = Array.isArray(rule.states) && rule.states.some((s) => s.toLowerCase().includes(q));

        if (!matchBrand && !matchDesc && !cCode.includes(q) && !cName.includes(q) && !matchCities && !matchEx && !matchStates) {
          return false;
        }
      }

      if (selectedCompanyFilter !== 'ALL') {
        const compObj = typeof rule.companyId === 'object' ? rule.companyId : null;
        const cId = compObj?._id || (typeof rule.companyId === 'string' ? rule.companyId : '');
        const cCode = compObj?.code || rule.companyCode || '';
        if (cId !== selectedCompanyFilter && cCode !== selectedCompanyFilter) return false;
      }

      if (selectedStateFilter !== 'ALL') {
        if (!Array.isArray(rule.states) || !rule.states.includes(selectedStateFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [allRulesFlat, debouncedSearchBrand, selectedCompanyFilter, selectedStateFilter, companies]);

  // Live Backend Resolution Call
  const handleResolveLiveRoute = useCallback(async (brand, state, city) => {
    if (!brand || !brand.trim()) {
      setLiveResolvedResult(null);
      setLiveResolveError(null);
      return;
    }

    setResolvingApi(true);
    setLiveResolveError(null);
    try {
      const res = await resolveBrandRoutingApi(
        brand.trim(),
        state ? state.trim() : '*',
        city && city.trim() ? city.trim() : undefined
      );
      const data = res?.data?.data || res?.data;
      if (data && (data.success === false || data.error)) {
        setLiveResolveError(data.message || data.error || 'No matching route found.');
        setLiveResolvedResult(null);
      } else {
        setLiveResolvedResult(data || null);
      }
    } catch (err) {
      console.warn('Backend live resolve returned error:', err);
      setLiveResolveError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'No matching route found for this brand and location.'
      );
      setLiveResolvedResult(null);
    } finally {
      setResolvingApi(false);
    }
  }, []);

  const openTestModal = (brand = '') => {
    const targetBrand = brand || (allBrands.length > 0 ? (allBrands.find((b) => b !== 'ALL') || allBrands[0]) : '');
    setSimBrand(targetBrand);
    setSimState('*');
    setSimCity('');
    setIsTestModalOpen(true);
    if (targetBrand) {
      handleResolveLiveRoute(targetBrand, '*', '');
    }
  };

  // Fetch authoritative rules for brand from GET /brand-routings/matrix/{brand}
  const fetchBrandRules = useCallback(async (brandName) => {
    const clean = brandName?.trim();
    if (!clean) return;

    setLoadingBrandDetails(true);
    setModalError(null);
    try {
      const freshRes = await getBrandRoutingByBrandApi(clean);
      const freshData = freshRes?.data?.data || freshRes?.data;
      const freshRules = Array.isArray(freshData?.rules) && freshData.rules.length > 0
        ? freshData.rules
        : (Array.isArray(freshData?.mappings) && freshData.mappings.length > 0
          ? freshData.mappings
          : (Array.isArray(freshData) ? freshData : null));

      if (freshData?.brand) {
        setModalBrand(freshData.brand);
      }

      if (Array.isArray(freshRules) && freshRules.length > 0) {
        // Register any company objects found in rules into companies list
        setCompanies((prev) => {
          const compMap = new Map();
          prev.forEach((c) => {
            if (c?._id) compMap.set(c._id, c);
            if (c?.code) compMap.set(c.code, c);
          });
          freshRules.forEach((r) => {
            const comp = typeof r.companyId === 'object' ? r.companyId : null;
            if (comp?._id && !compMap.has(comp._id)) compMap.set(comp._id, comp);
            if (comp?.code && !compMap.has(comp.code)) compMap.set(comp.code, comp);
          });
          return Array.from(new Set(compMap.values()));
        });

        // Update matrixData cache
        setMatrixData((prev) => {
          const idx = prev.findIndex((g) => g.brand?.toLowerCase() === clean.toLowerCase());
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], brand: freshData?.brand || clean, rules: freshRules };
            return copy;
          }
          return prev;
        });

        setMappings(
          freshRules.map((r) => {
            const compObj = typeof r.companyId === 'object' ? r.companyId : null;
            const compCode = r.companyCode || compObj?.code || '';
            const compId = compObj?._id || (typeof r.companyId === 'string' ? r.companyId : '');

            return {
              _id: r._id || '',
              states: Array.isArray(r.states) && r.states.length > 0 ? [...r.states] : ['*'],
              cities: Array.isArray(r.cities) ? [...r.cities] : [],
              citiesStr: Array.isArray(r.cities) ? r.cities.join(', ') : '',
              excludedCities: Array.isArray(r.excludedCities) ? [...r.excludedCities] : [],
              excludedCitiesStr: Array.isArray(r.excludedCities) ? r.excludedCities.join(', ') : '',
              companyCode: compCode || '',
              companyId: compId || '',
              description: r.description || '',
              priority: r.priority !== undefined ? r.priority : 10,
              isActive: r.isActive !== undefined ? Boolean(r.isActive) : true
            };
          })
        );
      }
    } catch (err) {
      console.warn(`GET /brand-routings/matrix/${clean} returned:`, err);
      if (err.response?.status !== 404) {
        setModalError(
          err.response?.data?.message ||
          err.response?.data?.error ||
          `Failed to load existing rules for "${clean}".`
        );
      }
    } finally {
      setLoadingBrandDetails(false);
    }
  }, []);

  // Open Configure Modal
  const handleOpenConfigure = async (brandGroup = null) => {
    setModalError(null);
    setStateSearchPerRule({});

    if (brandGroup) {
      const bName = brandGroup.brand || '';
      setModalBrand(bName);
      setReplaceExisting(true);

      const existingRules = Array.isArray(brandGroup.rules) && brandGroup.rules.length > 0
        ? brandGroup.rules
        : (Array.isArray(brandGroup.mappings) && brandGroup.mappings.length > 0 ? brandGroup.mappings : []);

      if (existingRules.length > 0) {
        setMappings(
          existingRules.map((r) => {
            const compObj = typeof r.companyId === 'object' ? r.companyId : null;
            const compCode = r.companyCode || compObj?.code || '';
            const compId = compObj?._id || (typeof r.companyId === 'string' ? r.companyId : '');
            const matchedComp = companies.find((c) => (compCode && c.code === compCode) || (compId && c._id === compId));

            return {
              _id: r._id || '',
              states: Array.isArray(r.states) ? [...r.states] : ['*'],
              cities: Array.isArray(r.cities) ? [...r.cities] : [],
              citiesStr: Array.isArray(r.cities) ? r.cities.join(', ') : '',
              excludedCities: Array.isArray(r.excludedCities) ? [...r.excludedCities] : [],
              excludedCitiesStr: Array.isArray(r.excludedCities) ? r.excludedCities.join(', ') : '',
              companyCode: compCode || matchedComp?.code || compObj?.code || '',
              companyId: compId || matchedComp?._id || compObj?._id || '',
              description: r.description || '',
              priority: r.priority !== undefined ? r.priority : 10,
              isActive: r.isActive !== undefined ? Boolean(r.isActive) : true
            };
          })
        );
      } else {
        const defaultComp = companies[0];
        setMappings([
          {
            states: ['*'],
            cities: [],
            citiesStr: '',
            excludedCities: [],
            excludedCitiesStr: '',
            companyCode: defaultComp?.code || '',
            companyId: defaultComp?._id || '',
            description: '',
            priority: 10,
            isActive: true
          }
        ]);
      }
      setIsModalOpen(true);

      if (bName) {
        fetchBrandRules(bName);
      }
    } else {
      setModalBrand('');
      setReplaceExisting(true);
      const defaultComp = companies[0];
      setMappings([
        {
          states: ['*'],
          cities: [],
          citiesStr: '',
          excludedCities: [],
          excludedCitiesStr: '',
          companyCode: defaultComp?.code || '',
          companyId: defaultComp?._id || '',
          description: '',
          priority: 10,
          isActive: true
        }
      ]);
      setIsModalOpen(true);
    }
  };

  // Open Bulk Matrix Modal
  const handleOpenBulkModal = () => {
    setBulkModalError(null);
    setBulkBrands([
      {
        brand: '',
        replaceExisting: true,
        mappings: [
          {
            states: ['*'],
            cities: [],
            citiesStr: '',
            excludedCities: [],
            excludedCitiesStr: '',
            companyCode: companies[0]?.code || '',
            companyId: companies[0]?._id || '',
            description: '',
            priority: 10,
            isActive: true
          }
        ]
      }
    ]);

    setIsBulkModalOpen(true);
  };

  // Rule mutations
  const handleAddMapping = () => {
    const defaultComp = companies[0];
    setMappings((prev) => [
      ...prev,
      {
        states: ['*'],
        cities: [],
        citiesStr: '',
        excludedCities: [],
        excludedCitiesStr: '',
        companyCode: defaultComp?.code || '',
        companyId: defaultComp?._id || '',
        description: '',
        priority: 10,
        isActive: true
      }
    ]);
  };

  // Delete rule by ID using DELETE /brand-routings/{id}
  const handleDeleteRule = async (ruleId, label = 'this rule') => {
    if (!ruleId) return;
    const confirmed = window.confirm(`Are you sure you want to delete ${label}? This will permanently remove it.`);
    if (!confirmed) return;

    setDeletingRuleId(ruleId);
    try {
      await deleteBrandRoutingApi(ruleId);
      setSuccessToast('Routing rule deleted successfully.');

      setMatrixData((prev) =>
        prev
          .map((group) => {
            const rules = Array.isArray(group.rules) ? group.rules : (Array.isArray(group.mappings) ? group.mappings : []);
            const filtered = rules.filter((r) => r._id !== ruleId);
            return {
              ...group,
              rules: filtered,
              mappings: filtered,
              rulesCount: filtered.length
            };
          })
          .filter((group) => {
            const rules = Array.isArray(group.rules) ? group.rules : (Array.isArray(group.mappings) ? group.mappings : []);
            return rules.length > 0 || group.brand === 'ALL';
          })
      );

      setMappings((prev) => prev.filter((m) => m._id !== ruleId));
      await fetchData(true);
    } catch (err) {
      console.error('Failed to delete routing rule:', err);
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to delete routing rule. Please try again.'
      );
    } finally {
      setDeletingRuleId(null);
    }
  };

  const handleRemoveMapping = async (index) => {
    const m = mappings[index];
    if (m?._id) {
      const confirmed = window.confirm(
        'This rule is saved in the database. Do you want to permanently delete it (DEL /brand-routings/{id})?'
      );
      if (!confirmed) return;

      setDeletingRuleId(m._id);
      try {
        await deleteBrandRoutingApi(m._id);
        setSuccessToast('Routing rule permanently deleted from database.');
        fetchData(true);
      } catch (err) {
        console.error('Failed to delete saved rule:', err);
        setModalError(err.response?.data?.message || 'Failed to delete rule from database.');
        setDeletingRuleId(null);
        return;
      } finally {
        setDeletingRuleId(null);
      }
    }

    if (mappings.length === 1) {
      const defaultComp = companies[0];
      setMappings([
        {
          states: ['*'],
          cities: [],
          citiesStr: '',
          excludedCities: [],
          excludedCitiesStr: '',
          companyCode: defaultComp?.code || '',
          companyId: defaultComp?._id || '',
          description: '',
          priority: 10,
          isActive: true
        }
      ]);
      return;
    }
    setMappings((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateMappingField = (index, field, value) => {
    setMappings((prev) =>
      prev.map((m, idx) => {
        if (idx !== index) return m;
        return { ...m, [field]: value };
      })
    );
  };

  const handleApplyPresetToRule = (ruleIndex, presetStates) => {
    setMappings((prev) =>
      prev.map((m, idx) => {
        if (idx !== ruleIndex) return m;
        return { ...m, states: [...presetStates] };
      })
    );
  };

  const handleToggleStateInMapping = (mappingIndex, stateName) => {
    setMappings((prev) =>
      prev.map((m, idx) => {
        if (idx !== mappingIndex) return m;
        let currentStates = Array.isArray(m.states) ? [...m.states] : [];

        if (stateName === '*') {
          return { ...m, states: currentStates.includes('*') ? [] : ['*'] };
        }

        currentStates = currentStates.filter((s) => s !== '*');
        if (currentStates.includes(stateName)) {
          currentStates = currentStates.filter((s) => s !== stateName);
        } else {
          currentStates.push(stateName);
        }

        return { ...m, states: currentStates };
      })
    );
  };

  // Save Single Brand Matrix
  const handleSaveMatrix = async (e) => {
    e.preventDefault();
    setModalError(null);

    const cleanBrand = modalBrand.trim();
    if (!cleanBrand) {
      setModalError('Brand name is required (use "ALL" for global default).');
      return;
    }

    if (mappings.length === 0) {
      setModalError('Please define at least one routing rule mapping.');
      return;
    }

    for (let i = 0; i < mappings.length; i++) {
      const m = mappings[i];
      const comp = companies.find((c) => c._id === m.companyId || c.code === m.companyCode);
      const code = comp?.code || m.companyCode || (typeof m.companyId === 'string' ? m.companyId : '');
      if (!code) {
        setModalError(`Rule #${i + 1}: Please select a partner billing company.`);
        return;
      }
      if (!Array.isArray(m.states) || m.states.length === 0) {
        setModalError(`Rule #${i + 1}: Please select at least one state or wildcard (*).`);
        return;
      }
    }

    const payload = {
      brand: cleanBrand,
      replaceExisting,
      mappings: mappings.map((m) => {
        const comp = companies.find((c) => c._id === m.companyId || c.code === m.companyCode);
        const companyCode = comp?.code || m.companyCode || m.companyId;

        const cities = m.citiesStr !== undefined
          ? m.citiesStr.split(',').map((s) => s.trim()).filter(Boolean)
          : (Array.isArray(m.cities) ? m.cities.filter(Boolean) : []);

        const excludedCities = m.excludedCitiesStr !== undefined
          ? m.excludedCitiesStr.split(',').map((s) => s.trim()).filter(Boolean)
          : (Array.isArray(m.excludedCities) ? m.excludedCities.filter(Boolean) : []);

        const item = {
          states: m.states,
          companyCode: companyCode
        };

        if (cities.length > 0) {
          item.cities = cities;
        }

        if (excludedCities.length > 0) {
          item.excludedCities = excludedCities;
        }

        if (m.priority !== '' && m.priority !== undefined && !isNaN(Number(m.priority))) {
          item.priority = Number(m.priority);
        }

        return item;
      })
    };

    setSubmitting(true);
    try {
      await updateBrandRoutingMatrixApi(payload);
      setSuccessToast(`Routing matrix for "${cleanBrand}" updated successfully.`);
      setIsModalOpen(false);
      await fetchData(true);
    } catch (err) {
      console.error('Failed to update brand routing matrix:', err);
      setModalError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to save routing matrix. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Save Bulk Matrix
  const handleSaveBulkMatrix = async (e) => {
    e.preventDefault();
    setBulkModalError(null);

    const validBrands = bulkBrands.filter((b) => b.brand.trim());
    if (validBrands.length === 0) {
      setBulkModalError('Please specify at least one brand in the batch.');
      return;
    }

    const payload = {
      replaceExisting: true,
      brands: validBrands.map((b) => ({
        brand: b.brand.trim(),
        mappings: b.mappings.map((m) => {
          const comp = companies.find((c) => c._id === m.companyId || c.code === m.companyCode);
          const companyCode = comp?.code || m.companyCode || m.companyId;

          const cities = m.citiesStr !== undefined
            ? m.citiesStr.split(',').map((s) => s.trim()).filter(Boolean)
            : (Array.isArray(m.cities) ? m.cities.filter(Boolean) : []);

          const excludedCities = m.excludedCitiesStr !== undefined
            ? m.excludedCitiesStr.split(',').map((s) => s.trim()).filter(Boolean)
            : (Array.isArray(m.excludedCities) ? m.excludedCities.filter(Boolean) : []);

          const item = {
            states: m.states,
            companyCode: companyCode
          };

          if (cities.length > 0) item.cities = cities;
          if (excludedCities.length > 0) item.excludedCities = excludedCities;
          if (m.priority !== '' && m.priority !== undefined && !isNaN(Number(m.priority))) {
            item.priority = Number(m.priority);
          }
          return item;
        })
      }))
    };

    setBulkSubmitting(true);
    try {
      if (payload?.brand && Array.isArray(payload?.mappings)) {
        await updateBrandRoutingMatrixApi(payload);
      } else {
        await bulkUpdateBrandRoutingMatrixApi(payload);
      }
      setSuccessToast('Brand routing matrix deployed successfully.');
      setIsBulkModalOpen(false);
      await fetchData(true);
    } catch (err) {
      console.error('Failed to deploy brand routing matrix:', err);
      setBulkModalError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to deploy matrix.'
      );
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Helper to format company label
  const getCompanyLabel = (c) => {
    if (!c) return 'Select Company';
    return `${c.name} ${c.code ? `(${c.code})` : ''}`;
  };

  // Global default company info
  const globalFallbackCompany = useMemo(() => {
    const allBrand = matrixData.find((g) => g.brand === 'ALL');
    const firstRule = (allBrand?.mappings || allBrand?.rules)?.[0];
    const comp = typeof firstRule?.companyId === 'object'
      ? firstRule.companyId
      : companies.find((c) => c._id === firstRule?.companyId || c.code === firstRule?.companyCode);
    return comp?.name || firstRule?.companyCode || comp?.code || 'Inizio (Global)';
  }, [matrixData, companies]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200 relative">
      {/* Top-Left Ambient Glowing Blob */}
      <div className="absolute -top-16 -left-16 w-80 h-80 sm:w-96 sm:h-96 bg-gradient-to-br from-blue-500/25 via-indigo-500/20 to-sky-400/15 rounded-full blur-[90px] pointer-events-none -z-10" />

      {/* ================= PAGE HEADER ================= */}
      <PageHeader
        title="Brand Routing Matrix"
        description="Configure dynamic billing partner allocation rules by brand and Indian territories."
        icon={FiGitBranch}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh Routing Matrix"
          >
            <FiRefreshCw className={`text-xs ${refreshing ? 'animate-spin text-blue-500' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => openTestModal()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-500/20 bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-xs font-bold text-blue-600 dark:text-blue-400 transition-all cursor-pointer shadow-xs"
            title="Test real-time routing resolution"
          >
            <FiPlay className="text-xs" />
            <span>Test Route</span>
          </button>

          <button
            type="button"
            onClick={handleOpenBulkModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-xs"
            title="Bulk batch import/export"
          >
            <FiUploadCloud className="text-xs text-purple-600 dark:text-purple-400" />
            <span>Bulk Batch</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenConfigure()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <FiPlus className="text-sm stroke-[3]" />
            <span>Configure Brand</span>
          </button>
        </div>
      </PageHeader>

      {/* ================= SUCCESS TOAST ================= */}
      {successToast && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 shadow-sm animate-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <FiCheckCircle className="text-base shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="p-1 rounded-md hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
          >
            <FiX size={14} />
          </button>
        </div>
      )}

      {/* ================= ERROR ALERT ================= */}
      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FiAlertCircle className="text-base shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchData(true)}
            className="underline hover:no-underline font-bold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ================= COMPACT EXECUTIVE KPI STRIP ================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white/70 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-xs">
        <div className="px-2 border-r border-slate-100 dark:border-white/5 last:border-none">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
            Brand Keys
          </span>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
            {matrixData.length}
          </div>
        </div>

        <div className="px-2 border-r border-slate-100 dark:border-white/5 last:border-none">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
            Active Rules
          </span>
          <div className="text-xl font-extrabold text-purple-600 dark:text-purple-400 mt-0.5">
            {allRulesFlat.length}
          </div>
        </div>

        <div className="px-2 border-r border-slate-100 dark:border-white/5 last:border-none">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
            Global Fallback
          </span>
          <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 truncate" title={globalFallbackCompany}>
            {globalFallbackCompany}
          </div>
        </div>

        <div className="px-2">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
            Billing Companies
          </span>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
            {companies.length}
          </div>
        </div>
      </div>

      {/* ================= FILTER & SEARCH BAR ================= */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white/40 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-3 rounded-2xl shadow-xs">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <input
            type="text"
            value={searchBrand}
            onChange={(e) => setSearchBrand(e.target.value)}
            placeholder="Filter brands, companies, notes..."
            className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
          {searchBrand && (
            <button
              type="button"
              onClick={() => setSearchBrand('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <FiX size={12} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Company Filter */}
          <div className="min-w-[145px]">
            <CustomDropdown
              value={selectedCompanyFilter}
              onChange={setSelectedCompanyFilter}
              options={[
                { value: 'ALL', label: 'All Companies' },
                ...companies.map((c) => ({
                  value: c._id,
                  label: `${c.name} ${c.code ? `(${c.code})` : ''}`
                }))
              ]}
              statusColor="!px-3 !py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300"
            />
          </div>

          {/* State Filter */}
          <div className="min-w-[135px]">
            <CustomDropdown
              value={selectedStateFilter}
              onChange={setSelectedStateFilter}
              options={[
                { value: 'ALL', label: 'All States' },
                { value: '*', label: '* Wildcard Only' },
                ...uniqueRuleStates
                  .filter((s) => s !== '*')
                  .map((s) => ({ value: s, label: s }))
              ]}
              statusColor="!px-3 !py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200/80 dark:border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FiGrid className="text-xs" />
              <span>By Brand</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FiList className="text-xs" />
              <span>All Rules</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= MAIN CONTENT ================= */}
      {loading ? (
        <div className="space-y-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-slate-900 overflow-hidden shadow-xs animate-pulse"
            >
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <SkeletonPulse className="w-9 h-9 rounded-xl" />
                  <div className="space-y-1.5">
                    <SkeletonPulse className="h-4 w-32" />
                    <SkeletonPulse className="h-3 w-20" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <SkeletonPulse className="h-7 w-20 rounded-lg" />
                  <SkeletonPulse className="h-7 w-24 rounded-lg" />
                </div>
              </div>
              <div className="p-4 space-y-2.5">
                <SkeletonPulse className="h-10 w-full rounded-xl" />
                <SkeletonPulse className="h-10 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredMatrix.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white/40 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-xl mx-auto mb-3">
            <FiGitBranch />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            No brand routing profiles found
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchBrand || selectedCompanyFilter !== 'ALL' || selectedStateFilter !== 'ALL'
              ? 'Try adjusting your search criteria or resetting filters.'
              : 'Configure your first brand routing rule matrix to automate billing allocation.'}
          </p>
        </div>
      ) : viewMode === 'grouped' ? (
        /* ================= GROUPED BRAND VIEW ================= */
        <div className="space-y-3.5">
          {filteredMatrix.map((brandGroup) => {
            const isAllBrand = brandGroup.brand === 'ALL';
            const rules = brandGroup.rules || [];
            const isExpanded = Boolean(expandedStatesByBrand[brandGroup.brand]);

            return (
              <div
                key={brandGroup.brand}
                className={`rounded-2xl border transition-all duration-150 overflow-hidden shadow-xs bg-white/60 dark:bg-slate-900 ${
                  isAllBrand
                    ? 'border-blue-500/40 ring-1 ring-blue-500/10'
                    : 'border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                {/* Brand Bar */}
                <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${
                        isAllBrand
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {isAllBrand ? '★' : brandGroup.brand.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {brandGroup.brand}
                        </span>
                        {isAllBrand && (
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400">
                            Global Default
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 font-medium">
                          ({brandGroup.rulesCount !== undefined ? brandGroup.rulesCount : rules.length} {(brandGroup.rulesCount !== undefined ? brandGroup.rulesCount : rules.length) === 1 ? 'rule' : 'rules'})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openTestModal(brandGroup.brand)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer flex items-center gap-1"
                      title="Test resolution for this brand"
                    >
                      <FiPlay className="text-[10px]" />
                      <span className="hidden sm:inline">Test</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenConfigure(brandGroup)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <FiEdit2 className="text-[10px]" />
                      <span>Edit Rules</span>
                    </button>
                  </div>
                </div>

                {/* Rules Rows inside Brand */}
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {rules.map((rule, idx) => {
                    const company = typeof rule.companyId === 'object'
                      ? rule.companyId
                      : companies.find((c) => c._id === rule.companyId || c.code === rule.companyCode);
                    const compName = company?.name || rule.companyCode || (typeof rule.companyId === 'string' ? rule.companyId : 'Corporate Partner');
                    const compCode = rule.companyCode || company?.code || '';
                    const compLogo = company?.logo || null;
                    const states = Array.isArray(rule.states) ? rule.states : [];
                    const isWildcard = states.includes('*');
                    const isAllStates = states.length === INDIAN_STATES.length;

                    return (
                      <div
                        key={rule._id || idx}
                        className="px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors"
                      >
                        {/* Territory Column */}
                        <div className="md:w-1/2 flex items-center gap-2 flex-wrap">
                          {isWildcard ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                              <FiGlobe className="text-xs" />
                              <span>Pan-India / Wildcard (*)</span>
                            </span>
                          ) : isAllStates ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              <FiCheck className="text-xs" />
                              <span>All 36 States</span>
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                <FiMapPin className="text-xs" />
                                <span>{states.length} {states.length === 1 ? 'State' : 'States'}</span>
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {states.slice(0, 3).join(', ')}
                                {states.length > 3 && ` +${states.length - 3} more`}
                              </span>
                            </div>
                          )}

                          {Array.isArray(rule.cities) && rule.cities.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20" title={rule.cities.join(', ')}>
                              <span>Cities: {rule.cities.slice(0, 2).join(', ')}{rule.cities.length > 2 ? ` +${rule.cities.length - 2}` : ''}</span>
                            </span>
                          )}

                          {Array.isArray(rule.excludedCities) && rule.excludedCities.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20" title={rule.excludedCities.join(', ')}>
                              <span>Excl: {rule.excludedCities.slice(0, 2).join(', ')}{rule.excludedCities.length > 2 ? ` +${rule.excludedCities.length - 2}` : ''}</span>
                            </span>
                          )}

                          {rule.description && (
                            <span className="text-[11px] text-slate-400 italic block sm:inline">
                              &mdash; {rule.description}
                            </span>
                          )}
                        </div>

                        {/* Destination Billing Company Column */}
                        <div className="md:w-1/2 flex items-center justify-between md:justify-end gap-3">
                          <div className="flex items-center gap-2">
                            {compLogo ? (
                              <img
                                src={compLogo}
                                alt="logo"
                                className="w-5 h-5 rounded-md object-contain bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center">
                                <FiBriefcase />
                              </div>
                            )}
                            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                              {compName}
                            </span>
                            {compCode && (
                              <span className="text-[10px] font-mono font-bold text-slate-400">
                                ({compCode})
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                            P{rule.priority !== undefined ? rule.priority : 10}
                          </span>

                          {rule._id && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(rule._id, `Rule for ${rule.brand || brandGroup.brand} (${compName})`)}
                              disabled={deletingRuleId === rule._id}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                              title="Delete this routing rule"
                            >
                              {deletingRuleId === rule._id ? (
                                <FiRefreshCw className="animate-spin text-xs" />
                              ) : (
                                <FiTrash2 size={13} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= FLAT TABLE VIEW ================= */
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Brand</th>
                  <th className="py-3 px-4">Territory Coverage</th>
                  <th className="py-3 px-4">Destination Billing Company</th>
                  <th className="py-3 px-4 text-center">Priority</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredFlatRules.map((rule, idx) => {
                  const company = typeof rule.companyId === 'object'
                    ? rule.companyId
                    : companies.find((c) => c._id === rule.companyId || c.code === rule.companyCode);
                  const compName = company?.name || rule.companyCode || (typeof rule.companyId === 'string' ? rule.companyId : 'Corporate Partner');
                  const compCode = rule.companyCode || company?.code || '';
                  const states = Array.isArray(rule.states) ? rule.states : [];
                  const isWildcard = states.includes('*');

                  return (
                    <tr
                      key={rule._id || idx}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{rule.brand}</span>
                          {rule.brand === 'ALL' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              Default
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isWildcard ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                              ★ Pan-India (*)
                            </span>
                          ) : states.length === INDIAN_STATES.length ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              ✓ All 36 States
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {states.length} {states.length === 1 ? 'state' : 'states'} ({states.slice(0, 2).join(', ')}{states.length > 2 ? '...' : ''})
                            </span>
                          )}

                          {Array.isArray(rule.cities) && rule.cities.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                              Cities: {rule.cities.join(', ')}
                            </span>
                          )}

                          {Array.isArray(rule.excludedCities) && rule.excludedCities.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                              Excl: {rule.excludedCities.join(', ')}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{compName}</span>
                          {compCode && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({compCode})
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10">
                          {rule.priority !== undefined ? rule.priority : 10}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {rule.description || '—'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {rule.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-500 font-bold text-[10px]">
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const group = matrixData.find((g) => g.brand === rule.brand);
                              handleOpenConfigure(group || { brand: rule.brand, rules: [rule] });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-xs transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          {rule._id && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(rule._id, `Rule for ${rule.brand} (${compName})`)}
                              disabled={deletingRuleId === rule._id}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                              title="Delete this routing rule"
                            >
                              {deletingRuleId === rule._id ? (
                                <FiRefreshCw className="animate-spin text-xs" />
                              ) : (
                                <FiTrash2 size={13} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          TEST ROUTING MODAL (DEDICATED RESOLUTION SANDBOX)
          ======================================================== */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 dark:bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white/40 dark:bg-slate-950/25 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 sm:px-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-lg">
                  <FiPlay />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Live Route Resolver Sandbox
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    GET /brand-routings/resolve — Real-time rule evaluation engine
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Query Inputs Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 shadow-xs space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Brand Name *
                    </label>
                    {allBrands.length > 0 && (
                      <div className="flex items-center gap-1 overflow-x-auto max-w-[260px] pb-0.5">
                        <span className="text-[10px] text-slate-400 shrink-0">Quick pick:</span>
                        {allBrands.slice(0, 4).map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => {
                              setSimBrand(b);
                              handleResolveLiveRoute(b, simState, simCity);
                            }}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-500/20 transition-colors cursor-pointer shrink-0"
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={simBrand}
                    onChange={(e) => {
                      setSimBrand(e.target.value);
                      handleResolveLiveRoute(e.target.value, simState, simCity);
                    }}
                    placeholder="e.g. Realme"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Destination State
                    </label>
                    <CustomDropdown
                      value={simState}
                      onChange={(val) => {
                        setSimState(val);
                        handleResolveLiveRoute(simBrand, val, simCity);
                      }}
                      options={[
                        { value: '*', label: '* Wildcard / Any Other State' },
                        ...INDIAN_STATES.map((s) => ({ value: s, label: s }))
                      ]}
                      searchable={true}
                      statusColor="!px-3 !py-2 !bg-slate-50 dark:!bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Destination City (Optional)
                    </label>
                    <input
                      type="text"
                      value={simCity}
                      onChange={(e) => {
                        setSimCity(e.target.value);
                        handleResolveLiveRoute(simBrand, simState, e.target.value);
                      }}
                      placeholder="e.g. Mumbai or Nagpur"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleResolveLiveRoute(simBrand, simState, simCity)}
                    disabled={resolvingApi || !simBrand.trim()}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <FiRefreshCw className={`text-xs ${resolvingApi ? 'animate-spin' : ''}`} />
                    <span>{resolvingApi ? 'Resolving...' : 'Evaluate Route'}</span>
                  </button>
                </div>
              </div>

              {/* Resolution Result Presentation */}
              {resolvingApi ? (
                <div className="p-8 text-center rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-2">
                  <FiRefreshCw className="animate-spin text-xl text-blue-500 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Querying routing engine for <span className="text-blue-600 dark:text-blue-400 font-bold">{simBrand || 'brand'}</span>...
                  </p>
                </div>
              ) : liveResolvedResult ? (
                (() => {
                  const resolvedComp =
                    liveResolvedResult?.resolvedCompany ||
                    (typeof liveResolvedResult?.company === 'object' ? liveResolvedResult.company : null) ||
                    (typeof liveResolvedResult?.companyId === 'object' ? liveResolvedResult.companyId : null);

                  const compName =
                    resolvedComp?.name ||
                    liveResolvedResult?.companyName ||
                    liveResolvedResult?.companyCode ||
                    'Partner Entity';

                  const compCode =
                    resolvedComp?.code ||
                    liveResolvedResult?.companyCode ||
                    '';

                  const compLogo = resolvedComp?.logo || '';
                  const compDescription = resolvedComp?.description || '';
                  const isCompActive =
                    resolvedComp?.isActive !== undefined ? Boolean(resolvedComp.isActive) : true;

                  const ruleApplied = liveResolvedResult?.ruleApplied;
                  const evaluatedPriority =
                    ruleApplied?.priority !== undefined
                      ? ruleApplied.priority
                      : (liveResolvedResult?.priority !== undefined ? liveResolvedResult.priority : 10);

                  const ruleDescription =
                    ruleApplied?.description ||
                    liveResolvedResult?.description ||
                    '';

                  const ruleSource = liveResolvedResult?.source || '';
                  const ruleStates = Array.isArray(ruleApplied?.states) ? ruleApplied.states : [];
                  const ruleCities = Array.isArray(ruleApplied?.cities) ? ruleApplied.cities : [];
                  const ruleExcludedCities = Array.isArray(ruleApplied?.excludedCities) ? ruleApplied.excludedCities : [];

                  return (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      {/* Success Bar & Source */}
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <FiCheckCircle className="text-emerald-600 dark:text-emerald-400 shrink-0 text-base" />
                          <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                            Route Resolved Successfully
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                          <span>{liveResolvedResult.brand || simBrand}</span>
                          <span>•</span>
                          <span>{liveResolvedResult.state || simState}</span>
                          {(liveResolvedResult.city || simCity) && (
                            <>
                              <span>•</span>
                              <span>{liveResolvedResult.city || simCity}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {ruleSource && (
                        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
                          <FiZap className="shrink-0 text-blue-500 text-sm" />
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold">Match Source:</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">{ruleSource}</span>
                          </div>
                        </div>
                      )}

                      {/* Resolved Destination Company Card */}
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 shadow-xs space-y-2.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <FiBriefcase className="text-blue-500" />
                          Resolved Billing Partner Entity
                        </span>

                        <div className="flex items-start gap-3">
                          {compLogo ? (
                            <img
                              src={compLogo}
                              alt={compName}
                              className="w-12 h-12 object-contain rounded-xl p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shrink-0"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg font-black shrink-0">
                              <FiBriefcase />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                                {compName}
                              </h4>
                              {compCode && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  {compCode}
                                </span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isCompActive
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {isCompActive ? '✓ Active Entity' : 'Inactive'}
                              </span>
                            </div>

                            {compDescription && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                {compDescription}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Rule Applied Card */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <FiShield className="text-purple-500" />
                            Rule Applied & Evaluation
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-blue-600 text-white shadow-xs">
                            Priority P{evaluatedPriority}
                          </span>
                        </div>

                        {ruleDescription && (
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {ruleDescription}
                          </div>
                        )}

                        <div className="space-y-1.5 pt-1 text-[11px]">
                          {ruleStates.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-400 font-medium shrink-0">States:</span>
                              {ruleStates.map((st) => (
                                <span
                                  key={st}
                                  className="px-2 py-0.5 rounded-md font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                                >
                                  {st === '*' ? '★ Pan-India (*)' : st}
                                </span>
                              ))}
                            </div>
                          )}

                          {ruleCities.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-400 font-medium shrink-0">Cities:</span>
                              {ruleCities.map((ct) => (
                                <span
                                  key={ct}
                                  className="px-2 py-0.5 rounded-md font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                                >
                                  {ct}
                                </span>
                              ))}
                            </div>
                          )}

                          {ruleExcludedCities.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-400 font-medium shrink-0">Excluded:</span>
                              {ruleExcludedCities.map((ect) => (
                                <span
                                  key={ect}
                                  className="px-2 py-0.5 rounded-md font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                                >
                                  {ect}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : liveResolveError ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-start gap-2.5">
                  <FiAlertCircle className="shrink-0 mt-0.5 text-base" />
                  <div>
                    <div className="font-bold">No Matching Route Found</div>
                    <div className="text-[11px] opacity-90 mt-0.5">{liveResolveError}</div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/10 text-slate-400 text-xs">
                  Enter a brand name above to evaluate the real-time routing resolution.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/40 text-right">
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SINGLE BRAND MATRIX CONFIGURATION MODAL
          ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 dark:bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white/40 dark:bg-slate-950/25 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:px-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-lg">
                  <FiGitBranch />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {modalBrand ? `Configure Routing: ${modalBrand}` : 'Configure New Brand Routing'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define territorial routing rules and billing companies.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveMatrix} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {modalError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <FiAlertCircle className="shrink-0 text-sm" />
                  <span>{modalError}</span>
                </div>
              )}

              {loadingBrandDetails && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-semibold flex items-center gap-2 animate-pulse">
                  <FiRefreshCw className="shrink-0 text-sm animate-spin" />
                  <span>Syncing routing rules for {modalBrand || 'brand'} from server...</span>
                </div>
              )}

              {/* Brand and Policy */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Brand Name *
                    </label>
                    {modalBrand.trim() && (
                      <button
                        type="button"
                        onClick={() => fetchBrandRules(modalBrand.trim())}
                        disabled={loadingBrandDetails}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold hover:bg-purple-500/20 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        title="Fetch existing rules from GET /brand-routings/matrix/{brand}"
                      >
                        <FiRefreshCw className={loadingBrandDetails ? 'animate-spin' : ''} />
                        <span>Load Existing Rules</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={modalBrand}
                    onChange={(e) => setModalBrand(e.target.value)}
                    placeholder='e.g. Realme or "ALL" for global fallback'
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400">Quick set:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setModalBrand('ALL');
                        fetchBrandRules('ALL');
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-500/20 transition-colors cursor-pointer"
                    >
                      ALL (Global Fallback)
                    </button>
                    {allBrands.filter((b) => b !== 'ALL').slice(0, 4).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => {
                          setModalBrand(b);
                          fetchBrandRules(b);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-300 dark:hover:bg-white/20 transition-colors cursor-pointer"
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Replace Policy
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={replaceExisting}
                      onChange={(e) => setReplaceExisting(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs">Replace all old rules</span>
                  </label>
                </div>
              </div>

              {/* Rules List */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    Routing Rules ({mappings.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddMapping}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 cursor-pointer flex items-center gap-1"
                  >
                    <FiPlus />
                    <span>Add Rule</span>
                  </button>
                </div>

                {mappings.map((mapping, mIdx) => {
                  const isWildcardOnly = mapping.states.length === 1 && mapping.states[0] === '*';
                  const ruleSearch = (stateSearchPerRule[mIdx] || '').toLowerCase();
                  const displayedStates = ruleSearch
                    ? INDIAN_STATES.filter((s) => s.toLowerCase().includes(ruleSearch))
                    : INDIAN_STATES;

                  return (
                    <div
                      key={mIdx}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 space-y-3.5 shadow-xs"
                    >
                      {/* Rule Header */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                          Rule #{mIdx + 1}
                        </span>

                        <div className="flex items-center gap-2.5">
                          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={mapping.isActive}
                              onChange={(e) => handleUpdateMappingField(mIdx, 'isActive', e.target.checked)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="text-xs font-semibold">Active</span>
                          </label>

                          {(mappings.length > 1 || mapping._id) && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMapping(mIdx)}
                              disabled={deletingRuleId === mapping._id}
                              className="p-1 rounded text-slate-400 hover:text-rose-500 transition-colors cursor-pointer disabled:opacity-50"
                              title={mapping._id ? 'Permanently delete this rule from database' : 'Remove rule'}
                            >
                              {deletingRuleId === mapping._id ? (
                                <FiRefreshCw className="animate-spin text-xs" />
                              ) : (
                                <FiTrash2 size={13} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Company & Priority */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-8">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Destination Corporate Entity *
                          </label>
                          <CustomDropdown
                            value={mapping.companyCode || mapping.companyId}
                            onChange={(val) => {
                              const comp = companies.find((c) => c.code === val || c._id === val);
                              handleUpdateMappingField(mIdx, 'companyCode', comp?.code || val);
                              handleUpdateMappingField(mIdx, 'companyId', comp?._id || val);
                            }}
                            defaultLabel="Select Corporate Partner..."
                            options={[
                              { value: '', label: 'Select Company...' },
                              ...companies.map((c) => ({
                                value: c.code || c._id,
                                label: getCompanyLabel(c)
                              }))
                            ]}
                            statusColor="!px-3 !py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                          {(() => {
                            const comp = companies.find(
                              (c) => (mapping.companyCode && c.code === mapping.companyCode) || (mapping.companyId && c._id === mapping.companyId)
                            );
                            if (!comp) return null;
                            return (
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                {comp.logo && (
                                  <img
                                    src={comp.logo}
                                    alt={comp.name}
                                    className="w-4 h-4 rounded object-contain bg-white border border-slate-200 dark:border-white/10 p-0.5 shrink-0"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                )}
                                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                                  {comp.name}
                                </span>
                                {comp.code && (
                                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                                    ({comp.code})
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Priority (Optional)
                          </label>
                          <input
                            type="number"
                            value={mapping.priority !== undefined ? mapping.priority : ''}
                            onChange={(e) => handleUpdateMappingField(mIdx, 'priority', e.target.value)}
                            placeholder="e.g. 15, 10, 1"
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* City Restrictions: Specific Cities & Excluded Cities */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Specific Cities (Optional, comma-separated)
                          </label>
                          <input
                            type="text"
                            value={mapping.citiesStr !== undefined ? mapping.citiesStr : (Array.isArray(mapping.cities) ? mapping.cities.join(', ') : '')}
                            onChange={(e) => handleUpdateMappingField(mIdx, 'citiesStr', e.target.value)}
                            placeholder="e.g. Mumbai, Nagpur"
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Rule applies ONLY to these cities in selected states
                          </span>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Excluded Cities (Optional, comma-separated)
                          </label>
                          <input
                            type="text"
                            value={mapping.excludedCitiesStr !== undefined ? mapping.excludedCitiesStr : (Array.isArray(mapping.excludedCities) ? mapping.excludedCities.join(', ') : '')}
                            onChange={(e) => handleUpdateMappingField(mIdx, 'excludedCitiesStr', e.target.value)}
                            placeholder="e.g. Mumbai, Nagpur"
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Rule applies to all cities EXCEPT these in selected states
                          </span>
                        </div>
                      </div>

                      {/* Territory Presets & Selection */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-1.5">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Covered Territories *
                          </label>

                          <div className="flex items-center gap-1 flex-wrap">
                            {REGION_PRESETS.map((p) => (
                              <button
                                key={p.name}
                                type="button"
                                onClick={() => handleApplyPresetToRule(mIdx, p.states)}
                                className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-slate-100 hover:bg-blue-500/10 hover:text-blue-600 dark:bg-white/5 dark:hover:bg-blue-500/20 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                              >
                                {p.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Selected chips */}
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 min-h-[38px] flex flex-wrap gap-1.5 items-center">
                          {isWildcardOnly ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300">
                              ★ Pan-India / Wildcard (*)
                            </span>
                          ) : mapping.states.length === INDIAN_STATES.length ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                              ✓ All 36 States
                            </span>
                          ) : mapping.states.length > 0 ? (
                            mapping.states.map((st) => (
                              <span
                                key={st}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300"
                              >
                                <span>{st}</span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleStateInMapping(mIdx, st)}
                                  className="hover:text-rose-500 cursor-pointer ml-0.5"
                                >
                                  <FiX size={10} />
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Click a preset above or pick states below.
                            </span>
                          )}
                        </div>

                        {/* State Filter Input & Button Grid */}
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={stateSearchPerRule[mIdx] || ''}
                            onChange={(e) =>
                              setStateSearchPerRule((prev) => ({ ...prev, [mIdx]: e.target.value }))
                            }
                            placeholder="Type to filter states..."
                            className="w-full px-3 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          />

                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                            {displayedStates.map((state) => {
                              const isSelected = mapping.states.includes(state);
                              return (
                                <button
                                  key={state}
                                  type="button"
                                  onClick={() => handleToggleStateInMapping(mIdx, state)}
                                  className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                      : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                                  }`}
                                >
                                  {isSelected ? '✓ ' : '+ '}{state}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Note */}
                      <input
                        type="text"
                        value={mapping.description}
                        onChange={(e) => handleUpdateMappingField(mIdx, 'description', e.target.value)}
                        placeholder="Internal description (optional)"
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  );
                })}
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-4 sm:px-6 border-t border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMatrix}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting && <FiRefreshCw className="animate-spin text-xs" />}
                <span>{submitting ? 'Saving...' : 'Save Matrix Rules'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          BULK MATRIX MODAL
          ======================================================== */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 dark:bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white/40 dark:bg-slate-950/25 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 sm:px-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 text-lg">
                  <FiUploadCloud />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Bulk Brand Routing Matrix
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Deploy routing rules for multiple brands in one batch.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {bulkModalError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <FiAlertCircle className="shrink-0 text-sm" />
                  <span>{bulkModalError}</span>
                </div>
              )}

              <div className="space-y-3">
                {bulkBrands.map((bItem, bIdx) => (
                    <div
                      key={bIdx}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-purple-600 dark:text-purple-400">
                          Brand #{bIdx + 1}
                        </span>
                        {bulkBrands.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setBulkBrands((prev) => prev.filter((_, i) => i !== bIdx))}
                            className="text-rose-500 hover:text-rose-700 cursor-pointer p-0.5"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={bItem.brand}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBulkBrands((prev) =>
                              prev.map((item, i) => (i === bIdx ? { ...item, brand: val } : item))
                            );
                          }}
                          placeholder="Brand Name (e.g. Realme)"
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                        />

                        <CustomDropdown
                          value={bItem.mappings[0]?.companyCode || bItem.mappings[0]?.companyId || ''}
                          onChange={(val) => {
                            const comp = companies.find((c) => c.code === val || c._id === val);
                            setBulkBrands((prev) =>
                              prev.map((item, i) => {
                                if (i !== bIdx) return item;
                                return {
                                  ...item,
                                  mappings: [
                                    {
                                      ...item.mappings[0],
                                      companyCode: comp?.code || val,
                                      companyId: comp?._id || val
                                    }
                                  ]
                                };
                              })
                            );
                          }}
                          options={[
                            { value: '', label: 'Select Company...' },
                            ...companies.map((c) => ({
                              value: c.code || c._id,
                              label: getCompanyLabel(c)
                            }))
                          ]}
                          statusColor="!px-3 !py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      setBulkBrands((prev) => [
                        ...prev,
                        {
                          brand: '',
                          replaceExisting: true,
                          mappings: [
                            {
                              states: ['*'],
                              cities: [],
                              citiesStr: '',
                              excludedCities: [],
                              excludedCitiesStr: '',
                              companyCode: companies[0]?.code || '',
                              companyId: companies[0]?._id || '',
                              description: '',
                              priority: 10,
                              isActive: true
                            }
                          ]
                        }
                      ])
                    }
                    className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 cursor-pointer"
                  >
                    <FiPlus />
                    <span>Add Brand to Batch</span>
                  </button>
                </div>
              </div>

            {/* Footer */}
            <div className="p-4 sm:px-6 border-t border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBulkMatrix}
                disabled={bulkSubmitting}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-purple-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {bulkSubmitting && <FiRefreshCw className="animate-spin text-xs" />}
                <span>{bulkSubmitting ? 'Deploying...' : 'Deploy Bulk Matrix'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandRoutings;
