import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FiPackage,
  FiX,
  FiLoader,
  FiAlertCircle,
  FiEdit2,
  FiMapPin,
  FiBriefcase,
  FiTag,
  FiCalendar,
  FiCheckCircle,
  FiLayers,
  FiGlobe
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { getProductByIdApi, getCompaniesApi, getCategoryApi } from '@/api/axios';
import { formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import CopyButton from './CopyButton';

const ProductDetailsModal = ({
  isOpen,
  onClose,
  productId,
  product: initialProduct = null,
  showEditButton = false,
  onEdit = null,
  categories: initialCategories = []
}) => {
  const navigate = useNavigate();
  const [product, setProduct] = useState(initialProduct);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companies, setCompanies] = useState([]);
  const [categories, setCategories] = useState(initialCategories);

  // Fetch product and metadata when modal opens
  useEffect(() => {
    if (!isOpen) {
      setProduct(null);
      setError('');
      return;
    }

    const currentId = productId || initialProduct?._id;
    if (!currentId && !initialProduct) return;

    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        const [prodRes, compRes, catRes] = await Promise.all([
          currentId
            ? getProductByIdApi(currentId).catch(() => ({ data: initialProduct }))
            : Promise.resolve({ data: initialProduct }),
          getCompaniesApi().catch(() => ({ data: [] })),
          initialCategories.length === 0
            ? getCategoryApi().catch(() => ({ data: [] }))
            : Promise.resolve({ data: initialCategories })
        ]);

        if (!isMounted) return;

        const resolvedProd = prodRes.data?.data || prodRes.data || initialProduct;
        setProduct(resolvedProd);

        const compData = compRes.data?.data || (Array.isArray(compRes.data) ? compRes.data : []);
        setCompanies(compData);

        const catData = catRes.data?.data || (Array.isArray(catRes.data) ? catRes.data : initialCategories);
        setCategories(catData);
      } catch (err) {
        console.error('Failed to load product details:', err);
        if (isMounted) {
          if (initialProduct) {
            setProduct(initialProduct);
          } else {
            setError('Failed to load product details. Please try again.');
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, productId, initialProduct]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Resolve Company details (object or ID)
  const getCompanyDetails = useCallback(() => {
    if (!product) return { name: 'Unassigned', code: null, id: null };
    if (typeof product.companyId === 'object' && product.companyId !== null) {
      return {
        name: product.companyId.name || 'Unassigned',
        code: product.companyId.code || null,
        id: product.companyId._id || null
      };
    }
    const found = companies.find((c) => c._id === product.companyId);
    if (found) {
      return {
        name: found.name || 'Unassigned',
        code: found.code || null,
        id: found._id || null
      };
    }
    return {
      name: product.companyId || 'Unassigned',
      code: null,
      id: typeof product.companyId === 'string' ? product.companyId : null
    };
  }, [product, companies]);

  // Resolve Category details (object or ID)
  const getCategoryDetails = useCallback(() => {
    if (!product || !product.categoryId) return null;
    if (typeof product.categoryId === 'object' && product.categoryId !== null) {
      return {
        name: product.categoryId.name || 'Unassigned',
        code: product.categoryId.code || null,
        id: product.categoryId._id || null
      };
    }
    const catList = categories.length > 0 ? categories : initialCategories;
    const found = catList.find((c) => c._id === product.categoryId);
    if (found) {
      return {
        name: found.name || 'Unassigned',
        code: found.code || null,
        id: found._id || null
      };
    }
    return {
      name: product.categoryId,
      code: null,
      id: typeof product.categoryId === 'string' ? product.categoryId : null
    };
  }, [product, categories, initialCategories]);

  if (!isOpen) return null;

  const company = getCompanyDetails();
  const category = getCategoryDetails();
  const locations = Array.isArray(product?.locations) ? product.locations : [];

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 dark:bg-slate-950/60 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Slide-Over Drawer Container (Pinned to Right) */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-2xl sm:max-w-3xl bg-white/40 dark:bg-slate-950/25 border-l border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 z-10 text-left">
          {/* Sticky Drawer Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0 pr-4">
              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-xs">
                <FiPackage className="text-2xl" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white line-clamp-1">
                    {product?.name || 'Product Details'}
                  </h2>
                  {product && (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        product.isActive !== false
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                      }`}
                    >
                      {product.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </div>
                {product && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                      {product.sku}
                    </span>
                    <CopyButton text={product.sku} size={11} />
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Close drawer (Esc)"
            >
              <FiX size={18} />
            </button>
          </div>

          {/* Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 custom-scrollbar space-y-6">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
              <FiLoader className="animate-spin text-3xl text-blue-500" />
              <p className="text-xs font-semibold uppercase tracking-wider">Loading product details...</p>
            </div>
          ) : error && !product ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-rose-500">
              <FiAlertCircle className="text-3xl" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : product ? (
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
                      {product.brand || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</p>
                    {category ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {category.name}
                        </span>
                        {category.code && (
                          <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                            {category.code}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Unassigned</p>
                    )}
                  </div>

                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Measurement Unit</p>
                    <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100">
                      {product.unit || 'PCS'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Created Date</p>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {formatDateTimeDDMMYYYY(product.createdAt)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Updated</p>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {formatDateTimeDDMMYYYY(product.updatedAt)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400">Product System ID:</span>
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{product._id}</span>
                    <CopyButton text={product._id} size={10} />
                  </div>
                  {category?.id && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400">Category ID:</span>
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{category.id}</span>
                      <CopyButton text={category.id} size={10} />
                    </div>
                  )}
                </div>
              </div>

              {/* Company Territory Mappings (if present) */}
              {Array.isArray(product.companyMappings) && product.companyMappings.length > 0 ? (
                <div className="bg-slate-50/80 dark:bg-white/[0.03] p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <FiBriefcase className="text-blue-500" />
                      <span>Company Territory Mappings ({product.companyMappings.length})</span>
                    </h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      companyMappings
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {product.companyMappings.map((mapping, idx) => {
                      const compObj = typeof mapping.companyId === 'object' && mapping.companyId !== null
                        ? mapping.companyId
                        : companies.find((c) => c._id === mapping.companyId);
                      const compName = compObj?.name || (typeof mapping.companyId === 'string' ? mapping.companyId : 'Unassigned');
                      const compCode = compObj?.code || null;
                      const states = Array.isArray(mapping.states) ? mapping.states : [];

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
                              {states.length} {states.length === 1 ? 'state' : 'states'}
                            </span>
                          </div>

                          {states.length > 0 ? (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {states.map((st, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-[10px] font-medium border border-slate-200/60 dark:border-white/5"
                                >
                                  <FiMapPin className="text-[9px] text-blue-500 shrink-0" />
                                  <span>{st}</span>
                                </span>
                              ))}
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

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-white/5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {company.name}
                        </span>
                        {company.code && (
                          <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md border border-blue-500/20">
                            {company.code}
                          </span>
                        )}
                      </div>
                      {company.id && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                          <span>ID: {company.id}</span>
                          <CopyButton text={company.id} size={10} />
                        </div>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      <FiCheckCircle className="text-xs" />
                      <span>Mapped Company</span>
                    </span>
                  </div>
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
                    {locations.length} {locations.length === 1 ? 'Location' : 'Locations'}
                  </span>
                </div>

                {locations.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {locations.map((loc, idx) => (
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
                  {product.description || 'No detailed description provided for this product.'}
                </p>
              </div>
            </>
          ) : null}
          </div>

          {/* Sticky Drawer Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Close Drawer
            </button>

            {(showEditButton || onEdit) && product && (
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  if (onEdit) {
                    onEdit(product);
                  } else {
                    navigate(`/products/edit/${product._id}`);
                  }
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-600/25 cursor-pointer"
              >
                <FiEdit2 className="text-xs" />
                <span>Edit Product</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProductDetailsModal;
