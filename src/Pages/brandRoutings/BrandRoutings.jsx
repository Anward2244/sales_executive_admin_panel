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
  FiFileText,
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
  getCompaniesApi
} from '@/api/axios';
import { INDIAN_STATES } from '@/utils/indianStates';
import PageHeader from '@/components/ui/PageHeader';
import CustomDropdown from '@/components/ui/CustomDropdown';
import CopyButton from '@/components/ui/CopyButton';
import { useDebounce } from '@/hooks/useDebounce';

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
  const [resolvingApi, setResolvingApi] = useState(false);
  const [liveResolvedResult, setLiveResolvedResult] = useState(null);
  const [liveResolveError, setLiveResolveError] = useState(null);

  // Bulk Matrix Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState('interactive'); // 'interactive' | 'json'
  const [bulkPayloadJson, setBulkPayloadJson] = useState('');
  const [bulkBrands, setBulkBrands] = useState([
    {
      brand: '',
      replaceExisting: true,
      mappings: [
        {
          states: ['*'],
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
      setCompanies(compList);
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
      if (Array.isArray(group.rules)) {
        group.rules.forEach((rule) => {
          list.push({
            ...rule,
            brand: rule.brand || brandName
          });
        });
      }
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
        if (debouncedSearchBrand.trim()) {
          const q = debouncedSearchBrand.toLowerCase().trim();
          const matchBrand = (group.brand || '').toLowerCase().includes(q);
          const matchRuleDesc = Array.isArray(group.rules) && group.rules.some((r) =>
            (r.description || '').toLowerCase().includes(q) ||
            (typeof r.companyId === 'object' && ((r.companyId?.name || '').toLowerCase().includes(q) || (r.companyId?.code || '').toLowerCase().includes(q)))
          );
          if (!matchBrand && !matchRuleDesc) return false;
        }

        if (selectedCompanyFilter !== 'ALL') {
          const hasCompany = Array.isArray(group.rules) && group.rules.some((r) => {
            const cId = typeof r.companyId === 'object' ? r.companyId?._id : r.companyId;
            return cId === selectedCompanyFilter;
          });
          if (!hasCompany) return false;
        }

        if (selectedStateFilter !== 'ALL') {
          const hasState = Array.isArray(group.rules) && group.rules.some((r) => {
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
  }, [matrixData, debouncedSearchBrand, selectedCompanyFilter, selectedStateFilter]);

  // Filtered Flat Rules for Table
  const filteredFlatRules = useMemo(() => {
    return allRulesFlat.filter((rule) => {
      if (debouncedSearchBrand.trim()) {
        const q = debouncedSearchBrand.toLowerCase().trim();
        const matchBrand = (rule.brand || '').toLowerCase().includes(q);
        const matchDesc = (rule.description || '').toLowerCase().includes(q);
        const compName = typeof rule.companyId === 'object' ? (rule.companyId?.name || '').toLowerCase() : '';
        const compCode = typeof rule.companyId === 'object' ? (rule.companyId?.code || '').toLowerCase() : '';
        if (!matchBrand && !matchDesc && !compName.includes(q) && !compCode.includes(q)) {
          return false;
        }
      }

      if (selectedCompanyFilter !== 'ALL') {
        const cId = typeof rule.companyId === 'object' ? rule.companyId?._id : rule.companyId;
        if (cId !== selectedCompanyFilter) return false;
      }

      if (selectedStateFilter !== 'ALL') {
        if (!Array.isArray(rule.states) || !rule.states.includes(selectedStateFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [allRulesFlat, debouncedSearchBrand, selectedCompanyFilter, selectedStateFilter]);

  // Live Backend Resolution Call
  const handleResolveLiveRoute = useCallback(async (brand, state) => {
    if (!brand || !brand.trim()) {
      setLiveResolvedResult(null);
      setLiveResolveError(null);
      return;
    }

    setResolvingApi(true);
    setLiveResolveError(null);
    try {
      const res = await resolveBrandRoutingApi(brand.trim(), state ? state.trim() : '*');
      const data = res?.data?.data || res?.data;
      setLiveResolvedResult(data || null);
    } catch (err) {
      console.warn('Backend live resolve returned error:', err);
      setLiveResolveError(err.response?.data?.message || 'No matching route found.');
      setLiveResolvedResult(null);
    } finally {
      setResolvingApi(false);
    }
  }, []);

  const openTestModal = (brand = '') => {
    const targetBrand = brand || (allBrands.length > 0 ? (allBrands.find((b) => b !== 'ALL') || allBrands[0]) : '');
    setSimBrand(targetBrand);
    setSimState('*');
    setIsTestModalOpen(true);
    if (targetBrand) {
      handleResolveLiveRoute(targetBrand, '*');
    }
  };

  // Open Configure Modal
  const handleOpenConfigure = async (brandGroup = null) => {
    setModalError(null);
    setStateSearchPerRule({});

    if (brandGroup) {
      const bName = brandGroup.brand || '';
      setModalBrand(bName);
      setReplaceExisting(true);

      if (Array.isArray(brandGroup.rules) && brandGroup.rules.length > 0) {
        setMappings(
          brandGroup.rules.map((r) => ({
            states: Array.isArray(r.states) ? [...r.states] : ['*'],
            companyId: typeof r.companyId === 'object' ? r.companyId?._id : (r.companyId || ''),
            description: r.description || '',
            priority: r.priority !== undefined ? r.priority : 10,
            isActive: r.isActive !== undefined ? Boolean(r.isActive) : true
          }))
        );
      } else {
        setMappings([
          {
            states: ['*'],
            companyId: companies[0]?._id || '',
            description: '',
            priority: 10,
            isActive: true
          }
        ]);
      }
      setIsModalOpen(true);

      if (bName) {
        setLoadingBrandDetails(true);
        try {
          const freshRes = await getBrandRoutingByBrandApi(bName);
          const freshData = freshRes?.data?.data || freshRes?.data;
          const freshRules = freshData?.rules || (Array.isArray(freshData) ? freshData : null);
          if (Array.isArray(freshRules) && freshRules.length > 0) {
            setMappings(
              freshRules.map((r) => ({
                states: Array.isArray(r.states) ? [...r.states] : ['*'],
                companyId: typeof r.companyId === 'object' ? r.companyId?._id : (r.companyId || ''),
                description: r.description || '',
                priority: r.priority !== undefined ? r.priority : 10,
                isActive: r.isActive !== undefined ? Boolean(r.isActive) : true
              }))
            );
          }
        } catch (err) {
          console.warn(`GET /brand-routings/matrix/${bName} fallback to local:`, err);
        } finally {
          setLoadingBrandDetails(false);
        }
      }
    } else {
      setModalBrand('');
      setReplaceExisting(true);
      setMappings([
        {
          states: ['*'],
          companyId: companies[0]?._id || '',
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
    setBulkMode('interactive');
    setBulkBrands([
      {
        brand: '',
        replaceExisting: true,
        mappings: [
          {
            states: ['*'],
            companyId: companies[0]?._id || '',
            description: '',
            priority: 10,
            isActive: true
          }
        ]
      }
    ]);

    setBulkPayloadJson(
      JSON.stringify(
        {
          replaceExisting: true,
          brands: [
            {
              brand: 'Realme',
              mappings: [
                {
                  states: ['Andhra Pradesh', 'Telangana', 'Delhi'],
                  companyId: companies[0]?._id || 'COMPANY_ID_1',
                  description: 'Realme in AP, TG, Delhi',
                  priority: 10,
                  isActive: true
                },
                {
                  states: ['*'],
                  companyId: companies[1]?._id || companies[0]?._id || 'COMPANY_ID_2',
                  description: 'Realme in remaining states',
                  priority: 1,
                  isActive: true
                }
              ]
            }
          ]
        },
        null,
        2
      )
    );
    setIsBulkModalOpen(true);
  };

  // Rule mutations
  const handleAddMapping = () => {
    setMappings((prev) => [
      ...prev,
      {
        states: ['*'],
        companyId: companies[0]?._id || '',
        description: '',
        priority: 10,
        isActive: true
      }
    ]);
  };

  const handleRemoveMapping = (index) => {
    if (mappings.length === 1) {
      setModalError('At least one mapping rule is required for this brand.');
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
      if (!m.companyId) {
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
      mappings: mappings.map((m) => ({
        states: m.states,
        companyId: m.companyId,
        description: (m.description || '').trim(),
        priority: Number(m.priority) || 0,
        isActive: Boolean(m.isActive)
      }))
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
    let payload;

    if (bulkMode === 'json') {
      try {
        payload = JSON.parse(bulkPayloadJson);
      } catch (err) {
        setBulkModalError(`Invalid JSON: ${err.message}`);
        return;
      }
    } else {
      const validBrands = bulkBrands.filter((b) => b.brand.trim());
      if (validBrands.length === 0) {
        setBulkModalError('Please specify at least one brand in the batch.');
        return;
      }

      payload = {
        replaceExisting: true,
        brands: validBrands.map((b) => ({
          brand: b.brand.trim(),
          mappings: b.mappings.map((m) => ({
            states: m.states,
            companyId: m.companyId,
            description: (m.description || '').trim(),
            priority: Number(m.priority) || 0,
            isActive: Boolean(m.isActive)
          }))
        }))
      };
    }

    setBulkSubmitting(true);
    try {
      await bulkUpdateBrandRoutingMatrixApi(payload);
      setSuccessToast('Bulk brand routing matrix deployed successfully.');
      setIsBulkModalOpen(false);
      await fetchData(true);
    } catch (err) {
      console.error('Failed to deploy bulk brand routing matrix:', err);
      setBulkModalError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to deploy bulk matrix.'
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
    const comp = allBrand?.rules?.[0]?.companyId;
    return comp?.name || comp?.code || 'Inizio (Global)';
  }, [matrixData]);

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
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 animate-pulse flex items-center justify-between"
            >
              <div className="h-6 w-36 bg-slate-200 dark:bg-white/10 rounded-lg" />
              <div className="h-6 w-64 bg-slate-100 dark:bg-white/5 rounded-lg" />
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
                          ({rules.length} {rules.length === 1 ? 'rule' : 'rules'})
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
                    const company = rule.companyId;
                    const compName = typeof company === 'object' ? company?.name : 'Corporate Partner';
                    const compCode = typeof company === 'object' ? company?.code : '';
                    const compLogo = typeof company === 'object' ? company?.logo : null;
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
                  const company = rule.companyId;
                  const compName = typeof company === 'object' ? company?.name : 'Corporate Partner';
                  const compCode = typeof company === 'object' ? company?.code : '';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 dark:bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white/40 dark:bg-slate-950/25 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <FiPlay />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Live Route Resolver Sandbox
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Resolves through GET /api/v1/brand-routings/resolve
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <FiX size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Brand Name
                </label>
                <input
                  type="text"
                  value={simBrand}
                  onChange={(e) => {
                    setSimBrand(e.target.value);
                    handleResolveLiveRoute(e.target.value, simState);
                  }}
                  placeholder="e.g. Realme"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Destination State
                </label>
                <select
                  value={simState}
                  onChange={(e) => {
                    setSimState(e.target.value);
                    handleResolveLiveRoute(simBrand, e.target.value);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="*">* Wildcard / Any Other State</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Result Box */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Resolution Result
                </span>

                {resolvingApi ? (
                  <div className="py-2 text-xs font-medium text-blue-500 flex items-center gap-2">
                    <FiRefreshCw className="animate-spin text-xs" />
                    <span>Resolving routing rules...</span>
                  </div>
                ) : liveResolvedResult ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Destination Company:</span>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                        {typeof liveResolvedResult.company === 'object'
                          ? liveResolvedResult.company?.name || liveResolvedResult.company?.code
                          : typeof liveResolvedResult.companyId === 'object'
                          ? liveResolvedResult.companyId?.name || liveResolvedResult.companyId?.code
                          : liveResolvedResult.companyName || liveResolvedResult.companyId || 'Partner Entity'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Evaluated Priority:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        P{liveResolvedResult.priority || 10}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Status:</span>
                      <span className="text-emerald-600 font-bold">✓ Active Route</span>
                    </div>
                  </div>
                ) : liveResolveError ? (
                  <div className="py-2 text-xs text-rose-500 flex items-center gap-1.5 font-semibold">
                    <FiAlertCircle className="shrink-0" />
                    <span>{liveResolveError}</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">Enter brand to resolve.</span>
                )}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/40 text-right">
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
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

              {/* Brand and Policy */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Brand Name *
                  </label>
                  <input
                    type="text"
                    value={modalBrand}
                    onChange={(e) => setModalBrand(e.target.value)}
                    placeholder='e.g. Realme or "ALL" for global fallback'
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] text-slate-400">Quick set:</span>
                    <button
                      type="button"
                      onClick={() => setModalBrand('ALL')}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-500/20 transition-colors cursor-pointer"
                    >
                      ALL (Global Fallback)
                    </button>
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

                          {mappings.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMapping(mIdx)}
                              className="p-1 rounded text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                              title="Delete rule"
                            >
                              <FiTrash2 size={13} />
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
                            value={mapping.companyId}
                            onChange={(val) => handleUpdateMappingField(mIdx, 'companyId', val)}
                            defaultLabel="Select Corporate Partner..."
                            options={[
                              { value: '', label: 'Select Company...' },
                              ...companies.map((c) => ({
                                value: c._id,
                                label: getCompanyLabel(c)
                              }))
                            ]}
                            statusColor="!px-3 !py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Priority
                          </label>
                          <input
                            type="number"
                            value={mapping.priority}
                            onChange={(e) => handleUpdateMappingField(mIdx, 'priority', e.target.value)}
                            placeholder="10"
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          />
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

            {/* Mode Selector */}
            <div className="px-6 pt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBulkMode('interactive')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  bulkMode === 'interactive'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                }`}
              >
                Interactive
              </button>
              <button
                type="button"
                onClick={() => setBulkMode('json')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  bulkMode === 'json'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                }`}
              >
                JSON Payload
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

              {bulkMode === 'json' ? (
                <textarea
                  rows={13}
                  value={bulkPayloadJson}
                  onChange={(e) => setBulkPayloadJson(e.target.value)}
                  className="w-full p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl border border-slate-700 focus:outline-hidden"
                />
              ) : (
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
                          value={bItem.mappings[0]?.companyId || ''}
                          onChange={(val) => {
                            setBulkBrands((prev) =>
                              prev.map((item, i) => {
                                if (i !== bIdx) return item;
                                return {
                                  ...item,
                                  mappings: [{ ...item.mappings[0], companyId: val }]
                                };
                              })
                            );
                          }}
                          options={[
                            { value: '', label: 'Select Company...' },
                            ...companies.map((c) => ({
                              value: c._id,
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
              )}
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
