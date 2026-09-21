import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FiPackage, FiX, FiChevronDown, FiChevronUp, FiLoader, FiAlertCircle, FiEdit2
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { api, BASE_URL } from '@/api/axios';
import { formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import CopyButton from './CopyButton';
import { getImageUrl, DEFAULT_FALLBACK_IMAGE } from '@/utils/imageUtils';
import OptimizedImage from './OptimizedImage';

const ProductDetailsModal = ({
  isOpen,
  onClose,
  productId,
  product: initialProduct = null,
  showEditButton = false
}) => {
  const navigate = useNavigate();
  const [product, setProduct] = useState(initialProduct);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVariantsExpanded, setIsVariantsExpanded] = useState(false);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);

  // Fetch product and brand/category metadata when modal opens
  useEffect(() => {
    if (!isOpen) {
      setProduct(null);
      setError('');
      setIsVariantsExpanded(false);
      return;
    }

    const currentId = productId || initialProduct?._id;
    if (!currentId && !initialProduct) return;

    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        const requests = [
          api.get('/brands/').catch(() => ({ data: [] })),
          api.get('/categories/').catch(() => ({ data: [] }))
        ];

        if (currentId) {
          requests.unshift(api.get(`/products/${currentId}`));
        }

        const responses = await Promise.all(requests);

        if (!isMounted) return;

        if (currentId) {
          const prodRes = responses[0];
          const brandRes = responses[1];
          const catRes = responses[2];

          setProduct(prodRes.data || initialProduct);
          setBrands(brandRes.data || []);
          setCategories(catRes.data || []);
        } else {
          setProduct(initialProduct);
          setBrands(responses[0].data || []);
          setCategories(responses[1].data || []);
        }
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

  const getBrandName = useCallback((brand) => {
    if (!brand) return 'N/A';
    if (typeof brand === 'object' && brand.name) return brand.name;
    const found = brands.find(b => b._id === brand);
    return found?.name || brand;
  }, [brands]);

  const getCategoryName = useCallback((category) => {
    if (!category) return 'N/A';
    if (typeof category === 'object' && category.name) return category.name;
    const found = categories.find(c => c._id === category);
    return found?.name || category;
  }, [categories]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 dark:bg-slate-950/50 backdrop-blur-lg"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-transparent dark:bg-slate-950/25 border border-white/20 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] md:h-[85vh] max-h-[95vh] z-10 animate-in fade-in zoom-in-95 duration-200 text-left">
        {/* Floating Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-30 p-2 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-white/10 rounded-full transition-all shadow-lg cursor-pointer"
          title="Close"
        >
          <FiX className="text-xl" />
        </button>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
              <FiLoader className="animate-spin text-3xl text-blue-400" />
              <p className="text-xs font-semibold uppercase tracking-wider">Loading product details...</p>
            </div>
          ) : error && !product ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-rose-400">
              <FiAlertCircle className="text-3xl" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : product ? (
            <>
              {/* General Information */}
              <div className="bg-white/60 dark:bg-white/[0.03] p-5 rounded-2xl border border-white/15">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Product Name</p>
                      <p className="text-white font-semibold text-lg">{product.name || 'N/A'}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-slate-500 font-mono">{product._id}</span>
                        <CopyButton text={product._id} className="text-slate-500 hover:text-slate-300" size={10} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Brand</p>
                        <p className="text-white font-medium">{getBrandName(product.brand)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category</p>
                        <p className="text-white font-medium">{getCategoryName(product.category)}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${product.isActive !== false ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                            {product.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Created At</p>
                        <p className="text-white font-medium text-sm">{formatDateTimeDDMMYYYY(product.createdAt)}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">EAN Number</p>
                        <p className="text-white font-medium">{product.eanNumber || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Updated At</p>
                        <p className="text-white font-medium text-sm">{formatDateTimeDDMMYYYY(product.updatedAt)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Main Product Image */}
                  <div className="flex flex-col items-center justify-start">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 self-start">Product Image</p>
                    <div className="w-full h-44 sm:h-52 md:h-full max-h-56 rounded-2xl border border-white/15 overflow-hidden bg-white p-2 flex items-center justify-center shadow-inner">
                      {(() => {
                        const firstImage = (product.images && product.images.length > 0 && product.images[0]) ||
                          (product.variants && product.variants.length > 0 && product.variants[0]?.images && product.variants[0]?.images[0]);
                        return firstImage ? (
                          <img
                            src={getImageUrl(firstImage, { isOriginal: true })}
                            alt={product.name || 'Product Image'}
                            className="max-w-full max-h-full object-contain rounded-xl"
                            onError={(e) => {
                              e.target.src = DEFAULT_FALLBACK_IMAGE;
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                            <FiPackage className="text-3xl text-slate-600" />
                            <span className="text-xs italic">No image available</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing & Inventory */}
              <div className="bg-white/60 dark:bg-white/[0.03] p-5 rounded-2xl border border-white/15">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-white/15 pb-2">
                  <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span> Pricing & Inventory
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-5">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Quantity</p>
                    <p className="text-white font-medium">{product.totalQuantity || '0'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Base Price</p>
                    <p className="text-white font-medium">₹{product.basePrice || '0'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Offer Price</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-emerald-400 font-bold">₹{product.offerPrice || '0'}</p>
                      {(() => {
                        const base = Number(product.basePrice);
                        const offer = Number(product.offerPrice);
                        if (base > 0 && offer > 0 && base > offer) {
                          const off = Math.round(((base - offer) / base) * 100);
                          return (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                              {off}% off
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">L1 Price</p>
                    <p className="text-blue-300 font-medium">₹{product.l1Price || '0'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">L2 Price</p>
                    <p className="text-blue-300 font-medium">₹{product.l2Price || '0'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">L3 Price</p>
                    <p className="text-blue-300 font-medium">₹{product.l3Price || '0'}</p>
                  </div>
                </div>
              </div>

              {/* Extended Details & Policies */}
              <div className="bg-white/60 dark:bg-white/[0.03] p-5 rounded-2xl border border-white/15 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-white/15 pb-2">
                  <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span> Descriptions & Policies
                </h3>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">{product.description || 'N/A'}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Details</p>
                    <p className="text-slate-300 text-sm whitespace-pre-wrap">{product.details || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Expert Notes</p>
                    <p className="text-slate-300 text-sm whitespace-pre-wrap">{product.expertNotes || 'N/A'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/15 pt-4">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Warranty</p>
                    <p className="text-slate-300 text-sm">{product.warranty || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Return Policy</p>
                    <p className="text-slate-300 text-sm">{product.sevenDaysReturn || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cancellation Policy</p>
                    <p className="text-slate-300 text-sm">{product.cancellationPolicy || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Product Images */}
              <div className="bg-white/60 dark:bg-white/[0.03] p-5 rounded-2xl border border-white/15">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-white/15 pb-2">
                  <span className="w-1.5 h-4 bg-purple-500 rounded-full"></span> Product Images
                </h3>
                {product.images && product.images.length > 0 ? (
                  <div className="flex flex-wrap gap-4">
                    {product.images.map((url, i) => (
                      <div key={i} className="relative w-24 h-24 border border-white/15 rounded-xl overflow-hidden bg-slate-800 flex items-center justify-center">
                        <img
                          src={getImageUrl(url)}
                          alt={`Image ${i + 1}`}
                          className="max-w-full max-h-full object-contain bg-white p-2"
                          onError={(e) => { e.target.src = 'https://placehold.co/150x150?text=Error'; }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm italic">No images available.</p>
                )}
              </div>

              {/* Variants Section */}
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setIsVariantsExpanded(!isVariantsExpanded)}
                  className="w-full flex items-center justify-between px-5 py-4 bg-white/60 dark:bg-white/[0.03] border border-white/15 rounded-2xl hover:bg-white/90 dark:hover:bg-slate-900/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-white/60 dark:bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm border border-blue-500/30">
                      {product.variants?.length || 0}
                    </span>
                    <span className="font-bold !text-black dark:text-white text-base">Product Variants</span>
                  </div>
                  {isVariantsExpanded ? <FiChevronUp className="text-slate-400 text-xl" /> : <FiChevronDown className="text-slate-400 text-xl" />}
                </button>

                {isVariantsExpanded && (
                  <div className="mt-3 space-y-3">
                    {product.variants && product.variants.length > 0 ? (
                      product.variants.map((variant, idx) => (
                        <div key={idx} className="p-5 bg-white/60 dark:bg-white/[0.03] border border-white/15 rounded-2xl space-y-4">
                          <div className="flex justify-between items-center border-b border-white/15 pb-2 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white uppercase tracking-wider">Variant #{idx + 1}</span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${variant.isActive !== false ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                {variant.isActive !== false ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-bold">Variant Name</p>
                              <p className="text-sm text-white font-medium">{variant.name || 'N/A'}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-xs text-slate-600 font-mono">{variant._id}</span>
                                <CopyButton text={variant._id} className="text-slate-600 hover:text-slate-300" size={10} />
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-bold">Quantity</p>
                              <p className="text-sm text-white font-medium">{variant.quantity || '0'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-bold">Price</p>
                              <p className="text-sm text-white font-medium">₹{variant.price || '0'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-bold">Offer Price</p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm text-emerald-400 font-bold">₹{variant.offerPrice || '0'}</p>
                                {(() => {
                                  const base = Number(variant.price || variant.basePrice);
                                  const offer = Number(variant.offerPrice);
                                  if (base > 0 && offer > 0 && base > offer) {
                                    const off = Math.round(((base - offer) / base) * 100);
                                    return (
                                      <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 whitespace-nowrap">
                                        {off}% off
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 pt-3 border-t border-white/15">
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-bold">L1 Price</p>
                              <p className="text-sm text-blue-300 font-medium">₹{variant.l1Price || '0'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-bold">L2 Price</p>
                              <p className="text-sm text-blue-300 font-medium">₹{variant.l2Price || '0'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-bold">L3 Price</p>
                              <p className="text-sm text-blue-300 font-medium">₹{variant.l3Price || '0'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-bold">Quantity Pricing Slabs</p>
                              {variant.quantityPricing && variant.quantityPricing.length > 0 ? (
                                <div className="text-xs text-slate-300 space-y-1">
                                  {variant.quantityPricing.map((qp, qpi) => (
                                    <div key={qpi}>Qty: {qp.minQty}+ → ₹{qp.price}</div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 italic">None</p>
                              )}
                            </div>
                          </div>

                          {/* Variant Images */}
                          <div className="pt-3 border-t border-white/15">
                            {(() => {
                              let variantImgs = [];
                              if (Array.isArray(variant.images)) {
                                variantImgs = variant.images;
                              } else if (typeof variant.images === 'string') {
                                variantImgs = variant.images.split(',').map(url => url.trim()).filter(Boolean);
                              } else if (typeof variant.image_urls === 'string') {
                                variantImgs = variant.image_urls.split(',').map(url => url.trim()).filter(Boolean);
                              } else if (Array.isArray(variant.image_urls)) {
                                variantImgs = variant.image_urls;
                              } else if (variant.image) {
                                variantImgs = [variant.image];
                              }

                              return (
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Variant Images</p>
                                    {variantImgs.length > 0 && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                        {variantImgs.length} {variantImgs.length === 1 ? 'image' : 'images'}
                                      </span>
                                    )}
                                  </div>
                                  {variantImgs.length > 0 ? (
                                    <div className="flex flex-wrap gap-3">
                                      {variantImgs.map((url, imgIdx) => (
                                        <div
                                          key={imgIdx}
                                          className="relative w-16 h-16 sm:w-20 sm:h-20 border border-white/15 rounded-xl overflow-hidden bg-slate-800 flex items-center justify-center shrink-0 shadow-sm"
                                        >
                                          <OptimizedImage
                                            src={url}
                                            alt={`${variant.name || 'Variant'} image ${imgIdx + 1}`}
                                            width={160}
                                            quality={60}
                                            className="max-w-full max-h-full object-contain bg-white p-1.5"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-500 italic">No images for this variant.</p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-slate-400 bg-slate-800/30 rounded-2xl border border-white/15 text-xs">
                        No variants added for this product.
                      </div>
                    )}
                  </div>
                )}
              </div>
              {showEditButton && product?._id && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose?.();
                      navigate(`/products/variants/${product._id}`);
                    }}
                    className="w-full sm:w-auto flex items-center justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30 cursor-pointer text-sm"
                  >
                    <FiEdit2 className="mr-2" />
                    Edit Product & Variants
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProductDetailsModal;
