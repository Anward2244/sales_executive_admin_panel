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
import { getProductByIdApi, getCompaniesApi } from '@/api/axios';
import { formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import CopyButton from './CopyButton';

const ProductDetailsModal = ({
  isOpen,
  onClose,
  productId,
  product: initialProduct = null,
  showEditButton = false,
  onEdit = null
}) => {
  const navigate = useNavigate();
  const [product, setProduct] = useState(initialProduct);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companies, setCompanies] = useState([]);

  // Fetch product and companies metadata when modal opens
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
        const [prodRes, compRes] = await Promise.all([
          currentId
            ? getProductByIdApi(currentId).catch(() => ({ data: initialProduct }))
            : Promise.resolve({ data: initialProduct }),
          getCompaniesApi().catch(() => ({ data: [] }))
        ]);

        if (!isMounted) return;

        const resolvedProd = prodRes.data?.data || prodRes.data || initialProduct;
        setProduct(resolvedProd);

        const compData = compRes.data?.data || (Array.isArray(compRes.data) ? compRes.data : []);
        setCompanies(compData);
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

  if (!isOpen) return null;

  const company = getCompanyDetails();
  const locations = Array.isArray(product?.locations) ? product.locations : [];

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-200 text-left">
        {/* Floating Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-white/10 rounded-full transition-all shadow-md cursor-pointer"
          title="Close"
        >
          <FiX className="text-lg" />
        </button>

        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/40 pr-16">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-xs">
              <FiPackage className="text-2xl" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">
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
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Brand</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {product.brand || 'N/A'}
                    </p>
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

                <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400">Product System ID:</span>
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{product._id}</span>
                  <CopyButton text={product._id} size={10} />
                </div>
              </div>

              {/* Trading / Partner Company */}
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

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Close
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
    </div>,
    document.body
  );
};

export default ProductDetailsModal;
