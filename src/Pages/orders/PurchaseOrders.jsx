import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  FiShoppingCart,
  FiPlus,
  FiSearch,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiPackage,
  FiTruck,
  FiXCircle,
  FiCheck,
  FiX,
  FiEye,
  FiTrash2,
  FiAlertCircle,
  FiRefreshCcw,
  FiMapPin,
  FiCalendar,
  FiSend,
  FiUser,
  FiBriefcase,
  FiActivity,
  FiLoader,
  FiTag,
  FiBox,
  FiLayers,
  FiDownload,
  FiMail,
  FiPhone,
  FiHash,
  FiShield,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import {
  getPurchaseOrdersApi,
  createPurchaseOrderApi,
  getPurchaseOrderByIdApi,
  approvePurchaseOrderApi,
  rejectPurchaseOrderApi,
  dispatchPurchaseOrderApi,
  getCompaniesApi,
  getFirmsApi,
  getProductsApi
} from '@/api/axios';
import { useAuth } from '@/Context/AuthContext';
import { useConfirm } from '@/Context/ConfirmationContext';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import PageHeader from '@/components/ui/PageHeader';
import CopyButton from '@/components/ui/CopyButton';
import CustomDropdown from '@/components/ui/CustomDropdown';
import { BulkActionBar, BatchProgressModal } from '@/components/ui';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useDisplayPreferences } from '@/utils/displayPreferences';

const STATUS_TABS = [
  { key: 'all', label: 'All Orders' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'DISPATCHED', label: 'Dispatched' },
  { key: 'REJECTED', label: 'Rejected' }
];

const getStatusBadge = (status) => {
  switch ((status || 'PENDING').toUpperCase()) {
    case 'APPROVED':
      return {
        label: 'Approved',
        icon: FiCheckCircle,
        className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        dot: 'bg-emerald-500'
      };
    case 'DISPATCHED':
      return {
        label: 'Dispatched',
        icon: FiTruck,
        className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        dot: 'bg-blue-500'
      };
    case 'REJECTED':
      return {
        label: 'Rejected',
        icon: FiXCircle,
        className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        dot: 'bg-rose-500'
      };
    default:
      return {
        label: 'Pending',
        icon: FiClock,
        className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        dot: 'bg-amber-500 animate-pulse'
      };
  }
};

const getEmailStatusBadge = (emailStatus) => {
  const isSent = emailStatus?.isSent;
  const status = (emailStatus?.status || (isSent ? 'SENT' : 'PENDING')).toUpperCase();

  if (status === 'SENT') {
    return {
      label: 'Sent',
      icon: FiMail,
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
      dot: 'bg-emerald-500'
    };
  }
  if (status === 'FAILED') {
    return {
      label: 'Failed',
      icon: FiAlertCircle,
      className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
      dot: 'bg-rose-500'
    };
  }
  return {
    label: 'Pending',
    icon: FiClock,
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
    dot: 'bg-amber-500'
  };
};

const SAMPLE_PO_BODY = {
  companyId: '65f1a2b3c4d5e6f7a8b9c0d2',
  firmId: '65f1a2b3c4d5e6f7a8b9c0d3',
  notes: 'Urgent festival delivery requested',
  items: [
    {
      productId: '65f1a2b3c4d5e6f7a8b9c0d5',
      quantity: 50,
      unitPrice: 1699
    }
  ]
};

const PurchaseOrders = () => {
  const { user } = useAuth();
  const { confirm: confirmDialog, showAlert } = useConfirm() || {};
  const isAdmin = !user?.role || String(user?.role).toLowerCase() === 'admin';

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Extract target order identifiers from navigation state or URL query parameters
  const navTargetId =
    location.state?.orderId ||
    location.state?.highlightOrderId ||
    location.state?.poId ||
    searchParams.get('orderId') ||
    searchParams.get('id') ||
    searchParams.get('poId') ||
    searchParams.get('highlightOrderId') ||
    null;

  const navTargetPoNum =
    location.state?.poNumber ||
    searchParams.get('poNumber') ||
    null;

  const isMongoId = useCallback(
    (val) => typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val.trim()),
    []
  );

  const effectiveTargetId = isMongoId(navTargetId) ? String(navTargetId).trim() : null;
  const effectiveTargetPoNum = navTargetPoNum
    ? String(navTargetPoNum).trim()
    : navTargetId && !isMongoId(navTargetId)
    ? String(navTargetId).trim()
    : null;

  const handleCloseDetailsDrawer = useCallback(() => {
    setSelectedOrder(null);
    if (navTargetId || navTargetPoNum) {
      navigate('/purchase-orders', { replace: true, state: {} });
    }
  }, [navTargetId, navTargetPoNum, navigate]);

  // Orders state
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');

  // Pagination
  const { preferences: displayPrefs } = useDisplayPreferences();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = displayPrefs.rowsPerPage || 10;

  // Selection / Details Modal (GET /purchase-orders/{id})
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Action Loading tracking
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Create Order Modal (POST /purchase-orders)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState('form'); // 'form' | 'raw_json'
  const [rawJsonText, setRawJsonText] = useState(JSON.stringify(SAMPLE_PO_BODY, null, 2));
  const [companiesList, setCompaniesList] = useState([]);
  const [firmsList, setFirmsList] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    companyId: '',
    firmId: '',
    notes: '',
    items: [{ productId: '', quantity: 1, unitPrice: 0, productNameSnapshot: '', skuSnapshot: '' }]
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState(null);

  const handleFillSample = () => {
    setCreateForm({
      companyId: SAMPLE_PO_BODY.companyId,
      firmId: SAMPLE_PO_BODY.firmId,
      notes: SAMPLE_PO_BODY.notes,
      items: SAMPLE_PO_BODY.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        productNameSnapshot: 'Festival Bulk Product',
        skuSnapshot: 'SKU-FEST-50'
      }))
    });
    setRawJsonText(JSON.stringify(SAMPLE_PO_BODY, null, 2));
    setCreateError(null);
  };


  // Reject Modal State (PATCH /purchase-orders/{id}/reject)
  const [rejectModalOrder, setRejectModalOrder] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState(null);

  // Dispatch Modal State (PATCH /purchase-orders/{id}/dispatch)
  const [dispatchModalOrder, setDispatchModalOrder] = useState(null);
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);

  // Show Toast Helper
  const triggerToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // 1. Fetch Orders (GET /purchase-orders)
  const fetchOrders = useCallback(async (isSilent = false) => {
    if (isSilent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await getPurchaseOrdersApi();
      const resData = response.data || {};
      const orderList = Array.isArray(resData.data)
        ? resData.data
        : Array.isArray(resData)
          ? resData
          : [];
      setOrders(orderList);
    } catch (err) {
      console.error('Error fetching purchase orders:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load purchase orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(false);
  }, [fetchOrders]);

  // Load companies, firms, products for Create Modal
  const loadSelectableEntities = async () => {
    if (companiesList.length > 0 && firmsList.length > 0 && productsList.length > 0) return;
    setLoadingEntities(true);
    try {
      const [compRes, firmRes, prodRes] = await Promise.allSettled([
        getCompaniesApi(),
        getFirmsApi(),
        getProductsApi()
      ]);

      if (compRes.status === 'fulfilled') {
        const cData = compRes.value.data?.data || compRes.value.data || [];
        setCompaniesList(Array.isArray(cData) ? cData : []);
      }
      if (firmRes.status === 'fulfilled') {
        const fData = firmRes.value.data?.data || firmRes.value.data || [];
        setFirmsList(Array.isArray(fData) ? fData : []);
      }
      if (prodRes.status === 'fulfilled') {
        const pData = prodRes.value.data?.data || prodRes.value.data || [];
        setProductsList(Array.isArray(pData) ? pData : []);
      }
    } catch (err) {
      console.error('Failed to load entity options:', err);
    } finally {
      setLoadingEntities(false);
    }
  };

  const handleOpenCreateModal = () => {
    loadSelectableEntities();
    setCreateForm({
      companyId: companiesList[0]?._id || '',
      firmId: firmsList[0]?._id || '',
      notes: '',
      items: [{ productId: '', quantity: 1, unitPrice: 0, productNameSnapshot: '', skuSnapshot: '' }]
    });
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  // 2. View Order Details with Status History (GET /purchase-orders/{id})
  const handleViewOrderDetails = useCallback(async (orderOrId, fallbackPoNum = '') => {
    if (!orderOrId) return;

    const isObj = typeof orderOrId === 'object' && orderOrId !== null;
    const targetOrder = isObj ? orderOrId : null;
    const targetId = isObj ? (orderOrId._id || orderOrId.id) : String(orderOrId).trim();

    if (targetOrder) {
      setSelectedOrder(targetOrder);
    } else {
      // Temporary placeholder while loading details
      setSelectedOrder({
        _id: targetId,
        poNumber: fallbackPoNum || 'Loading...',
        status: 'PENDING'
      });
    }

    setLoadingDetails(true);

    if (targetId && isMongoId(targetId)) {
      try {
        const res = await getPurchaseOrderByIdApi(targetId);
        const fullData = res.data?.data || res.data;
        if (fullData && typeof fullData === 'object') {
          setSelectedOrder(fullData);
          // Also update the list instance with fresh details
          setOrders((prev) => {
            const exists = prev.some((o) => (o._id || o.id) === targetId);
            if (exists) {
              return prev.map((o) => ((o._id || o.id) === targetId ? fullData : o));
            }
            return [fullData, ...prev];
          });
        }
      } catch (err) {
        console.warn('Could not fetch full order details, displaying cached item:', err);
      } finally {
        setLoadingDetails(false);
      }
    } else {
      setLoadingDetails(false);
    }
  }, [isMongoId]);

  // Auto-open drawer when navigating from Notifications, Email Logs, or direct URL with PO param
  const lastHandledNavRef = useRef(null);

  useEffect(() => {
    if (!effectiveTargetId && !effectiveTargetPoNum) return;

    const navKey = `${effectiveTargetId || ''}::${effectiveTargetPoNum || ''}`;
    if (lastHandledNavRef.current === navKey) return;

    // 1. Try finding matching order in current orders state
    const matchedOrder = orders.find((o) => {
      const oId = o._id || o.id;
      const oPo = o.poNumber || o.orderNumber;
      if (effectiveTargetId && oId === effectiveTargetId) return true;
      if (
        effectiveTargetPoNum &&
        oPo &&
        String(oPo).trim().toLowerCase() === effectiveTargetPoNum.toLowerCase()
      ) {
        return true;
      }
      return false;
    });

    if (matchedOrder) {
      lastHandledNavRef.current = navKey;
      setStatusFilter('all');
      handleViewOrderDetails(matchedOrder);
      return;
    }

    // 2. If valid MongoDB ID is available, directly fetch by ID and open drawer
    if (effectiveTargetId) {
      lastHandledNavRef.current = navKey;
      setStatusFilter('all');
      handleViewOrderDetails(effectiveTargetId, effectiveTargetPoNum);
      return;
    }

    // 3. If only PO number is available and initial orders fetch has completed
    if (effectiveTargetPoNum && !loading) {
      lastHandledNavRef.current = navKey;
      setStatusFilter('all');
      setSearchTerm(effectiveTargetPoNum);
    }
  }, [effectiveTargetId, effectiveTargetPoNum, orders, loading, handleViewOrderDetails]);

  // 3. Create PO Handler (POST /purchase-orders)
  const handleAddItemRow = () => {
    setCreateForm((prev) => ({
      ...prev,
      items: [...prev.items, { productId: '', quantity: 1, unitPrice: 0, productNameSnapshot: '', skuSnapshot: '' }]
    }));
  };

  const handleRemoveItemRow = (index) => {
    setCreateForm((prev) => {
      if (prev.items.length <= 1) return prev;
      const updated = prev.items.filter((_, idx) => idx !== index);
      return { ...prev, items: updated };
    });
  };

  const handleItemChange = (index, field, value) => {
    setCreateForm((prev) => {
      const updatedItems = [...prev.items];
      const target = { ...updatedItems[index] };

      if (field === 'productId') {
        const selectedProd = productsList.find((p) => p._id === value);
        target.productId = value;
        target.productNameSnapshot = selectedProd?.name || '';
        target.skuSnapshot = selectedProd?.sku || '';
        target.unitPrice = Number(selectedProd?.defaultPrice || selectedProd?.price || 0);
      } else if (field === 'quantity') {
        target.quantity = Math.max(1, parseInt(value, 10) || 1);
      } else if (field === 'unitPrice') {
        target.unitPrice = Math.max(0, parseFloat(value) || 0);
      }

      updatedItems[index] = target;
      return { ...prev, items: updatedItems };
    });
  };

  const handleCreateOrderSubmit = async (e) => {
    e.preventDefault();
    setCreateError(null);

    let payload;

    if (createMode === 'raw_json') {
      try {
        const parsed = JSON.parse(rawJsonText);
        if (!parsed.companyId) throw new Error('companyId is required in JSON payload.');
        if (!parsed.firmId) throw new Error('firmId is required in JSON payload.');
        if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
          throw new Error('items array with at least one product object is required.');
        }

        payload = {
          companyId: String(parsed.companyId).trim(),
          firmId: String(parsed.firmId).trim(),
          ...(parsed.notes ? { notes: String(parsed.notes).trim() } : {}),
          items: parsed.items.map((it, idx) => {
            if (!it.productId) throw new Error(`Product ID missing in item #${idx + 1}`);
            return {
              productId: String(it.productId).trim(),
              quantity: Number(it.quantity) || 1,
              unitPrice: Number(it.unitPrice) || 0
            };
          })
        };
      } catch (parseErr) {
        setCreateError(parseErr.message || 'Invalid JSON format.');
        return;
      }
    } else {
      if (!createForm.companyId) {
        setCreateError('Please select or enter a trading company ID.');
        return;
      }
      if (!createForm.firmId) {
        setCreateError('Please select or enter a purchasing firm ID.');
        return;
      }

      const validItems = createForm.items.filter((it) => it.productId);
      if (validItems.length === 0) {
        setCreateError('Please add at least one valid product line item.');
        return;
      }

      payload = {
        companyId: String(createForm.companyId).trim(),
        firmId: String(createForm.firmId).trim(),
        ...(createForm.notes?.trim() ? { notes: createForm.notes.trim() } : {}),
        items: validItems.map((it) => ({
          productId: String(it.productId).trim(),
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0
        }))
      };
    }

    setCreateSubmitting(true);

    try {
      const response = await createPurchaseOrderApi(payload);
      const newOrder = response.data?.data || response.data || payload;
      setOrders((prev) => [newOrder, ...prev]);
      setIsCreateModalOpen(false);
      triggerToast(`Purchase Order created successfully!`);
    } catch (err) {
      console.error('Failed to create purchase order:', err);
      setCreateError(err.response?.data?.message || err.message || 'Failed to create purchase order.');
    } finally {
      setCreateSubmitting(false);
    }
  };


  // 4. Approve PO (PATCH /purchase-orders/{id}/approve)
  const handleApproveOrder = async (order) => {
    if (!order) return;
    const poNum = order.poNumber || order.orderNumber || order._id;
    const message = `Are you sure you want to approve Purchase Order "${poNum}"? This advances the order status to APPROVED.`;

    let isConfirmed = false;
    if (confirmDialog) {
      isConfirmed = await confirmDialog(message);
    } else {
      isConfirmed = window.confirm(message);
    }
    if (!isConfirmed) return;

    setActionLoadingId(order._id);
    try {
      const response = await approvePurchaseOrderApi(order._id);
      const updatedOrder = response.data?.data || response.data || { ...order, status: 'APPROVED' };

      setOrders((prev) =>
        prev.map((o) => (o._id === order._id ? { ...o, ...updatedOrder, status: 'APPROVED' } : o))
      );
      if (selectedOrder?._id === order._id) {
        setSelectedOrder((prev) => ({ ...prev, ...updatedOrder, status: 'APPROVED' }));
      }
      triggerToast(`Purchase Order "${poNum}" approved successfully!`);
    } catch (err) {
      console.error('Approve order error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to approve order.';
      if (showAlert) showAlert(errMsg, 'error');
      else alert(errMsg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // 5. Reject PO (PATCH /purchase-orders/{id}/reject)
  const handleOpenRejectModal = (order) => {
    setRejectModalOrder(order);
    setRejectionReason('');
    setRejectError(null);
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectModalOrder) return;
    const reasonTrimmed = rejectionReason.trim();

    if (!reasonTrimmed) {
      setRejectError('A reason for rejection is mandatory.');
      return;
    }

    setRejectSubmitting(true);
    setRejectError(null);
    const orderId = rejectModalOrder._id;
    const poNum = rejectModalOrder.poNumber || rejectModalOrder.orderNumber || orderId;

    try {
      const response = await rejectPurchaseOrderApi(orderId, { reason: reasonTrimmed });
      const updatedOrder = response.data?.data || response.data || {
        ...rejectModalOrder,
        status: 'REJECTED',
        rejectionReason: reasonTrimmed
      };

      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, ...updatedOrder, status: 'REJECTED' } : o))
      );
      if (selectedOrder?._id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, ...updatedOrder, status: 'REJECTED', rejectionReason: reasonTrimmed }));
      }
      setRejectModalOrder(null);
      triggerToast(`Purchase Order "${poNum}" was rejected.`);
    } catch (err) {
      console.error('Reject order error:', err);
      setRejectError(err.response?.data?.message || err.message || 'Failed to reject purchase order.');
    } finally {
      setRejectSubmitting(false);
    }
  };

  // 6. Dispatch PO (PATCH /purchase-orders/{id}/dispatch)
  const handleOpenDispatchModal = (order) => {
    setDispatchModalOrder(order);
    setDispatchNotes('');
  };

  const handleConfirmDispatch = async (e) => {
    e.preventDefault();
    if (!dispatchModalOrder) return;

    setDispatchSubmitting(true);
    const orderId = dispatchModalOrder._id;
    const poNum = dispatchModalOrder.poNumber || dispatchModalOrder.orderNumber || orderId;

    try {
      const payload = dispatchNotes.trim() ? { notes: dispatchNotes.trim() } : {};
      const response = await dispatchPurchaseOrderApi(orderId, payload);
      const updatedOrder = response.data?.data || response.data || { ...dispatchModalOrder, status: 'DISPATCHED' };

      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, ...updatedOrder, status: 'DISPATCHED' } : o))
      );
      if (selectedOrder?._id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, ...updatedOrder, status: 'DISPATCHED' }));
      }
      setDispatchModalOrder(null);
      triggerToast(`Purchase Order "${poNum}" marked as dispatched!`);
    } catch (err) {
      console.error('Dispatch order error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to dispatch purchase order.';
      if (showAlert) showAlert(errMsg, 'error');
      else alert(errMsg);
    } finally {
      setDispatchSubmitting(false);
    }
  };

  // Filtered and Sorted Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const statusMatch =
        statusFilter === 'all' || (o.status || 'PENDING').toUpperCase() === statusFilter.toUpperCase();

      const companyId = o.companyId?._id || o.companyId;
      const companyMatch = companyFilter === 'all' || companyId === companyFilter;

      const poNum = (o.poNumber || o.orderNumber || o._id || '').toLowerCase();
      const compName = (o.companyId?.name || '').toLowerCase();
      const compCode = (o.companyId?.code || '').toLowerCase();
      const firmName = (o.firmId?.firmName || '').toLowerCase();
      const firmCode = (o.firmId?.firmCode || '').toLowerCase();
      const contactPerson = (o.firmId?.contactPerson || '').toLowerCase();
      const city = (o.firmId?.city || '').toLowerCase();
      const repName = (
        o.salesExecutiveId?.name ||
        `${o.salesExecutiveId?.firstName || ''} ${o.salesExecutiveId?.lastName || ''}`
      ).toLowerCase();
      const repEmpCode = (o.salesExecutiveId?.employeeCode || '').toLowerCase();
      const repEmail = (o.salesExecutiveId?.email || '').toLowerCase();
      const emailStatus = (o.emailStatus?.status || '').toLowerCase();

      const term = searchTerm.toLowerCase();
      const searchMatch =
        !term ||
        poNum.includes(term) ||
        compName.includes(term) ||
        compCode.includes(term) ||
        firmName.includes(term) ||
        firmCode.includes(term) ||
        contactPerson.includes(term) ||
        city.includes(term) ||
        repName.includes(term) ||
        repEmpCode.includes(term) ||
        repEmail.includes(term) ||
        emailStatus.includes(term);

      return statusMatch && companyMatch && searchMatch;
    });
  }, [orders, statusFilter, companyFilter, searchTerm]);

  // Statistics calculation
  const stats = useMemo(() => {
    let pendingCount = 0;
    let approvedCount = 0;
    let dispatchedCount = 0;
    let rejectedCount = 0;
    let totalVal = 0;

    orders.forEach((o) => {
      const st = (o.status || 'PENDING').toUpperCase();
      if (st === 'PENDING') pendingCount++;
      else if (st === 'APPROVED') approvedCount++;
      else if (st === 'DISPATCHED') dispatchedCount++;
      else if (st === 'REJECTED') rejectedCount++;

      const val = Number(o.totalAmount || o.totalValue || o.subtotal || 0);
      totalVal += isNaN(val) ? 0 : val;
    });

    return {
      total: orders.length,
      pending: pendingCount,
      approved: approvedCount,
      dispatched: dispatchedCount,
      rejected: rejectedCount,
      totalValue: totalVal
    };
  }, [orders]);

  // Pagination slicing
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  const currentOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage]);

  // Slide-Over Detail Drawer navigation
  const selectedOrderIndex = useMemo(() => {
    if (!selectedOrder) return -1;
    return filteredOrders.findIndex((o) => o._id === selectedOrder._id);
  }, [selectedOrder, filteredOrders]);

  const canGoPrevOrder = selectedOrderIndex > 0;
  const canGoNextOrder = selectedOrderIndex >= 0 && selectedOrderIndex < filteredOrders.length - 1;

  const handlePrevOrder = useCallback(() => {
    if (selectedOrderIndex > 0) {
      handleViewOrderDetails(filteredOrders[selectedOrderIndex - 1]);
    }
  }, [selectedOrderIndex, filteredOrders]);

  const handleNextOrder = useCallback(() => {
    if (selectedOrderIndex >= 0 && selectedOrderIndex < filteredOrders.length - 1) {
      handleViewOrderDetails(filteredOrders[selectedOrderIndex + 1]);
    }
  }, [selectedOrderIndex, filteredOrders]);

  // Keyboard navigation & Esc listener for Slide-Over Drawer
  useEffect(() => {
    if (!selectedOrder) return;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      if (e.key === 'Escape') {
        handleCloseDetailsDrawer();
      } else if (e.key === 'ArrowLeft') {
        if (canGoPrevOrder) handlePrevOrder();
      } else if (e.key === 'ArrowRight') {
        if (canGoNextOrder) handleNextOrder();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrder, canGoPrevOrder, canGoNextOrder, handlePrevOrder, handleNextOrder]);

  // Prevent background scroll when Drawer is open
  useEffect(() => {
    if (selectedOrder) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedOrder]);

  // Bulk Operations State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [bulkActionModal, setBulkActionModal] = useState(null); // 'approve' | 'dispatch' | 'reject'
  const [bulkApproveRemarks, setBulkApproveRemarks] = useState('');
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [bulkDispatchData, setBulkDispatchData] = useState({
    carrier: 'Blue Dart Express',
    trackingPrefix: 'AURIC-DISP',
    notes: ''
  });
  const [batchProgress, setBatchProgress] = useState({
    isOpen: false,
    taskTitle: '',
    total: 0,
    current: 0,
    successCount: 0,
    failureCount: 0,
    logs: [],
    isFinished: false
  });
  const abortBatchRef = useRef(false);

  // Toggle order selection
  const toggleSelectOrder = (id) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllCurrentPageOrders = () => {
    const pageIds = currentOrders.map((o) => o._id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedOrderIds.has(id));
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectAllPendingOrders = () => {
    const pendingIds = filteredOrders
      .filter((o) => (o.status || '').toUpperCase() === 'PENDING')
      .map((o) => o._id);
    setSelectedOrderIds(new Set(pendingIds));
  };

  const selectAllApprovedOrders = () => {
    const approvedIds = filteredOrders
      .filter((o) => (o.status || '').toUpperCase() === 'APPROVED')
      .map((o) => o._id);
    setSelectedOrderIds(new Set(approvedIds));
  };

  const selectAllPageOrders = () => {
    setSelectedOrderIds(new Set(currentOrders.map((o) => o._id)));
  };

  // Batch Execution Engine
  const runBatchTask = async ({ taskTitle, items, processItemFn }) => {
    abortBatchRef.current = false;
    setBatchProgress({
      isOpen: true,
      taskTitle,
      total: items.length,
      current: 0,
      successCount: 0,
      failureCount: 0,
      logs: [
        {
          time: new Date().toLocaleTimeString(),
          text: `Starting "${taskTitle}" on ${items.length} orders...`,
          type: 'info'
        }
      ],
      isFinished: false
    });

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < items.length; i++) {
      if (abortBatchRef.current) {
        setBatchProgress((p) => ({
          ...p,
          logs: [
            ...p.logs,
            { time: new Date().toLocaleTimeString(), text: 'Batch execution halted by user.', type: 'error' }
          ]
        }));
        break;
      }

      const item = items[i];
      try {
        await processItemFn(item, i);
        successCount++;
        setBatchProgress((p) => ({
          ...p,
          current: i + 1,
          successCount,
          logs: [
            ...p.logs,
            {
              time: new Date().toLocaleTimeString(),
              text: `Success: ${item.poNumber || item.orderNumber || item._id}`,
              type: 'success'
            }
          ]
        }));
      } catch (err) {
        failureCount++;
        setBatchProgress((p) => ({
          ...p,
          current: i + 1,
          failureCount,
          logs: [
            ...p.logs,
            {
              time: new Date().toLocaleTimeString(),
              text: `Error on ${item.poNumber || item._id}: ${err.response?.data?.message || err.message}`,
              type: 'error'
            }
          ]
        }));
      }
      await new Promise((r) => setTimeout(r, 40));
    }

    setBatchProgress((p) => ({ ...p, isFinished: true }));
    await fetchOrders(true);
    setSelectedOrderIds(new Set());
  };

  // Bulk Approve Execution
  const executeBulkApprove = async () => {
    const selectedOrders = orders.filter((o) => selectedOrderIds.has(o._id));
    const pendingOrders = selectedOrders.filter((o) => (o.status || '').toUpperCase() === 'PENDING');
    if (pendingOrders.length === 0) {
      if (showAlert) showAlert('None of the selected orders are in PENDING status.', 'error');
      else alert('None of the selected orders are in PENDING status.');
      return;
    }
    setBulkActionModal(null);
    await runBatchTask({
      taskTitle: `Bulk Approve ${pendingOrders.length} Orders`,
      items: pendingOrders,
      processItemFn: async (order) => {
        await approvePurchaseOrderApi(order._id, { remarks: bulkApproveRemarks || 'Bulk approved via Order Operations' });
      }
    });
  };

  // Bulk Dispatch Execution
  const executeBulkDispatch = async () => {
    const selectedOrders = orders.filter((o) => selectedOrderIds.has(o._id));
    const approvedOrders = selectedOrders.filter((o) => (o.status || '').toUpperCase() === 'APPROVED');
    if (approvedOrders.length === 0) {
      if (showAlert) showAlert('Only orders in APPROVED status can be dispatched.', 'error');
      else alert('Only orders in APPROVED status can be dispatched.');
      return;
    }
    setBulkActionModal(null);
    await runBatchTask({
      taskTitle: `Bulk Dispatch ${approvedOrders.length} Orders`,
      items: approvedOrders,
      processItemFn: async (order, idx) => {
        const trackingNum = `${bulkDispatchData.trackingPrefix || 'TRK'}-${Date.now().toString().slice(-5)}-${idx + 1}`;
        await dispatchPurchaseOrderApi(order._id, {
          trackingNumber: trackingNum,
          carrier: bulkDispatchData.carrier || 'Express Logistics',
          notes: bulkDispatchData.notes || 'Bulk dispatched via Order Operations'
        });
      }
    });
  };

  // Bulk Reject Execution
  const executeBulkReject = async () => {
    if (!bulkRejectReason.trim()) {
      if (showAlert) showAlert('A rejection reason is required.', 'error');
      else alert('A rejection reason is required.');
      return;
    }
    const selectedOrders = orders.filter((o) => selectedOrderIds.has(o._id));
    setBulkActionModal(null);
    await runBatchTask({
      taskTitle: `Bulk Reject ${selectedOrders.length} Orders`,
      items: selectedOrders,
      processItemFn: async (order) => {
        await rejectPurchaseOrderApi(order._id, bulkRejectReason.trim());
      }
    });
  };

  // Bulk Export Execution
  const executeBulkExport = () => {
    const listToExport =
      selectedOrderIds.size > 0 ? orders.filter((o) => selectedOrderIds.has(o._id)) : filteredOrders;
    if (listToExport.length === 0) {
      if (showAlert) showAlert('No orders available to export.', 'info');
      else alert('No orders available to export.');
      return;
    }
    const rows = listToExport.map((o, idx) => ({
      'S.No': idx + 1,
      'PO Number': o.poNumber || o.orderNumber || o._id,
      'Order Date': formatDateDDMMYYYY(o.createdAt || o.orderDate),
      'Company Name': o.companyId?.name || o.companyName || '-',
      'Company Code': o.companyId?.code || '-',
      'Buyer Firm': o.firmId?.firmName || o.firmName || '-',
      'Firm Code': o.firmId?.firmCode || '-',
      'Firm Contact': o.firmId?.contactPerson || '-',
      'Firm City': o.firmId?.city || '-',
      'Sales Executive': o.salesExecutiveId
        ? `${o.salesExecutiveId.firstName || ''} ${o.salesExecutiveId.lastName || ''}`.trim()
        : '-',
      'Sales Rep Code': o.salesExecutiveId?.employeeCode || '-',
      'Sales Rep Email': o.salesExecutiveId?.email || '-',
      'Items Count': Array.isArray(o.items) ? o.items.length : 0,
      'Total Amount (INR)': Number(o.totalAmount || o.orderTotal || 0),
      Status: (o.status || 'PENDING').toUpperCase(),
      'Approved By': o.approvedBy ? `${o.approvedBy.firstName || ''} ${o.approvedBy.lastName || ''}`.trim() : '-',
      'Approved At': o.approvedAt ? formatDateTimeDDMMYYYY(o.approvedAt) : '-',
      'Email Status': o.emailStatus?.status || (o.emailStatus?.isSent ? 'SENT' : 'PENDING'),
      'Email Last Sent': o.emailStatus?.lastSentAt ? formatDateTimeDDMMYYYY(o.emailStatus.lastSentAt) : '-',
      'Email Recipients': Array.isArray(o.emailStatus?.recipients) ? o.emailStatus.recipients.join(', ') : '-'
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Orders');
    XLSX.writeFile(wb, `Auric_Orders_Export_${Date.now()}.xlsx`);
  };

  // Estimated create PO total
  const estimatedCreateTotal = useMemo(() => {
    return createForm.items.reduce((sum, it) => {
      return sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
    }, 0);
  }, [createForm.items]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-[10001] flex items-center gap-2.5 px-4 py-3 bg-emerald-600 text-white text-xs font-bold rounded-2xl shadow-xl shadow-emerald-600/30 animate-in fade-in slide-in-from-bottom-5">
          <FiCheckCircle className="text-base shrink-0" />
          <span>{successToast}</span>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="ml-2 hover:bg-emerald-700/50 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <FiX className="text-sm" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Purchase Orders"
        subtitle="Issue vendor purchase orders, review incoming procurement, approve orders, and manage warehouse dispatching."
        badgeIcon={FiShoppingCart}
        actions={
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="text"
                placeholder="Search PO #, company, firm, rep..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-9 py-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-white placeholder-slate-400 shadow-xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <FiX size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => fetchOrders(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl border border-slate-200/80 dark:border-white/10 transition-all shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
              title="Refresh Orders"
            >
              <FiRefreshCcw className={`text-sm ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        }
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total POs */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Total POs</p>
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <FiShoppingCart className="text-base" />
            </span>
          </div>
          <p className="text-2xl font-black text-blue-600 mt-2 font-mono">
            {stats.total}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">All recorded procurement orders</p>
        </div>

        {/* Pending Review */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-amber-500/20 dark:border-amber-500/20 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pending</p>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FiClock className="text-base" />
            </span>
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2 font-mono">
            {stats.pending}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting manager approval</p>
        </div>

        {/* Approved */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-blue-500/20 dark:border-blue-500/20 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Approved</p>
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <FiCheckCircle className="text-base" />
            </span>
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2 font-mono">
            {stats.approved}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Ready for warehouse dispatch</p>
        </div>

        {/* Dispatched */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-emerald-500/20 dark:border-emerald-500/20 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Dispatched</p>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FiTruck className="text-base" />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {stats.dispatched}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Shipped & in transit to firms</p>
        </div>

        {/* Total PO Value */}
        <div className="col-span-2 sm:col-span-1 lg:col-span-1 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Total Value</p>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FiActivity className="text-base" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono truncate">
            ₹{stats.totalValue.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Total procurement volume</p>
        </div>
      </div>

      {/* Filter, Search & Status Bar */}
      <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-4 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar w-full md:w-auto pb-1 md:pb-0">
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.key);
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 ${
                    active
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-slate-100/80 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                  {tab.key === 'PENDING' && stats.pending > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                      {stats.pending}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
            <button
              type="button"
              onClick={() => {
                setIsBulkMode((prev) => !prev);
                if (isBulkMode) setSelectedOrderIds(new Set());
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                isBulkMode
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
                  : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-blue-500/40 shadow-xs'
              }`}
            >
              <FiLayers className="text-sm" />
              <span>{isBulkMode ? 'Exit Bulk Mode' : 'Bulk Operations'}</span>
              {isBulkMode && selectedOrderIds.size > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-mono">
                  {selectedOrderIds.size}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-600/25 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <FiPlus className="text-base" />
              <span>Create Purchase Order</span>
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table Card */}
      <div className="bg-white/40 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-hidden">
        {/* Loading State */}
        {loading && (
          <TableSkeleton columns={9} rows={8} className="border-0 shadow-none rounded-none" />
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <FiAlertCircle className="text-xl" />
            </div>
            <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">Failed to load purchase orders</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={() => fetchOrders(false)}
              className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Orders Table */}
        {!loading && !error && (
          <>
            <div className="overflow-x-auto custom-scrollbar max-h-[70vh]">
              <table className="w-full text-left border-collapse whitespace-nowrap min-w-[900px]">
                <thead className="sticky top-0 z-20 bg-white/70 dark:bg-slate-900/80 backdrop-blur-md shadow-xs border-b border-slate-200/80 dark:border-white/10">
                  <tr className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold">
                    {isBulkMode && (
                      <th className="px-4 py-3.5 pl-5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={currentOrders.length > 0 && currentOrders.every((o) => selectedOrderIds.has(o._id))}
                          onChange={toggleSelectAllCurrentPageOrders}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="px-5 py-3.5">PO Number</th>
                    <th className="px-5 py-3.5">Company</th>
                    <th className="px-5 py-3.5">Purchasing Firm</th>
                    <th className="px-4 py-3.5">Sales Executive</th>
                    <th className="px-4 py-3.5 text-center">Items</th>
                    <th className="px-4 py-3.5 text-right">Total Amount</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-center">Email</th>
                    <th className="px-5 py-3.5 text-center">Date</th>
                    <th className="px-5 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200/80 dark:divide-white/5 text-xs">
                  {currentOrders.length > 0 ? (
                    currentOrders.map((order, idx) => {
                      const poNum =
                        order.poNumber || order.orderNumber || order.orderId || `#ORD-${order._id?.slice(-6) || idx + 1}`;
                      const companyName = order.companyId?.name || 'Company';
                      const companyCode = order.companyId?.code;
                      const companyLogo = order.companyId?.logo;
                      const firmName = order.firmId?.firmName || 'Firm Buyer';
                      const firmCode = order.firmId?.firmCode;
                      const firmCity = order.firmId?.city;
                      const contactPerson = order.firmId?.contactPerson;
                      const repName = order.salesExecutiveId
                        ? `${order.salesExecutiveId.firstName || ''} ${order.salesExecutiveId.lastName || ''}`.trim() ||
                          order.salesExecutiveId.name ||
                          'Sales Rep'
                        : 'N/A';
                      const repEmpCode = order.salesExecutiveId?.employeeCode;
                      const repEmail = order.salesExecutiveId?.email;
                      const itemCount = Array.isArray(order.items) ? order.items.length : 0;
                      const totalUnits = Array.isArray(order.items)
                        ? order.items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)
                        : 0;
                      const status = (order.status || 'PENDING').toUpperCase();
                      const badge = getStatusBadge(status);
                      const BadgeIcon = badge.icon;
                      const isPending = status === 'PENDING';
                      const isApproved = status === 'APPROVED';

                      return (
                        <tr
                          key={order._id || idx}
                          className={`hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors ${
                            selectedOrderIds.has(order._id) ? 'bg-blue-500/[0.06] dark:bg-blue-500/10' : ''
                          }`}
                        >
                          {isBulkMode && (
                            <td className="px-4 py-3.5 pl-5 text-center">
                              <input
                                type="checkbox"
                                checked={selectedOrderIds.has(order._id)}
                                onChange={() => toggleSelectOrder(order._id)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                          )}
                          {/* PO Number */}
                          <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              <span
                                onClick={() => handleViewOrderDetails(order)}
                                className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title="Click to view full PO details"
                              >
                                {poNum}
                              </span>
                              <CopyButton text={poNum} />
                            </div>
                          </td>

                          {/* Company */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              {companyLogo ? (
                                <img
                                  src={companyLogo}
                                  alt={companyName}
                                  className="w-6 h-6 rounded-md object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200/80 dark:border-white/10 shrink-0"
                                />
                              ) : (
                                <FiBriefcase className="text-slate-400 text-xs shrink-0" />
                              )}
                              <div>
                                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                                  {companyName}
                                </span>
                                {companyCode && (
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                                    {companyCode}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Purchasing Firm */}
                          <td className="px-5 py-3.5">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {firmName}
                                </span>
                                {firmCode && (
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                                    {firmCode}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                {firmCity && (
                                  <span className="flex items-center gap-0.5">
                                    <FiMapPin className="text-[10px]" /> {firmCity}
                                  </span>
                                )}
                                {contactPerson && (
                                  <span className="truncate max-w-[120px]">• {contactPerson}</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Sales Executive */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {repName}
                                </span>
                                {repEmpCode && (
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                    {repEmpCode}
                                  </span>
                                )}
                              </div>
                              {repEmail && (
                                <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={repEmail}>
                                  {repEmail}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Items Count & Units */}
                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              <FiBox className="text-blue-500 text-[10px]" />
                              <span>
                                {itemCount} {itemCount === 1 ? 'item' : 'items'} ({totalUnits})
                              </span>
                            </span>
                          </td>

                          {/* Total Amount */}
                          <td className="px-4 py-3.5 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                            ₹{(order.totalAmount || order.totalValue || order.subtotal || 0).toLocaleString('en-IN')}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex flex-col items-center">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${badge.className}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                <BadgeIcon className="text-[11px]" />
                                <span>{badge.label}</span>
                              </span>
                              {order.approvedBy && (
                                <span className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[110px]" title={`Approved by ${order.approvedBy.firstName || ''} ${order.approvedBy.lastName || ''}`}>
                                  by {order.approvedBy.firstName}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Email Status */}
                          <td className="px-4 py-3.5 text-center">
                            {(() => {
                              const eb = getEmailStatusBadge(order.emailStatus);
                              const EbIcon = eb.icon;
                              const recCount = order.emailStatus?.recipients?.length || 0;
                              return (
                                <div className="flex flex-col items-center">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${eb.className}`}
                                    title={
                                      order.emailStatus?.lastSentAt
                                        ? `Last sent: ${formatDateTimeDDMMYYYY(order.emailStatus.lastSentAt)} (${recCount} recipients)`
                                        : `Email ${eb.label}`
                                    }
                                  >
                                    <EbIcon className="text-[10px]" />
                                    <span>{eb.label}</span>
                                  </span>
                                  {recCount > 0 && (
                                    <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                                      {recCount} recipient{recCount === 1 ? '' : 's'}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Date */}
                          <td className="px-5 py-3.5 text-center text-slate-500 dark:text-slate-400 text-xs font-mono">
                            {formatDateDDMMYYYY(order.createdAt)}
                          </td>

                          {/* Action Buttons */}
                          <td className="px-5 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Details (GET /purchase-orders/{id}) */}
                              <button
                                type="button"
                                onClick={() => handleViewOrderDetails(order)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 border border-blue-200/60 dark:border-blue-500/20 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                                title="View Complete Order Details & Audit History"
                              >
                                <FiEye size={12} />
                                <span>Details</span>
                              </button>

                              {/* Admin Status Transitions */}
                              {isAdmin && isPending && (
                                <>
                                  {/* Approve (PATCH /purchase-orders/{id}/approve) */}
                                  <button
                                    type="button"
                                    onClick={() => handleApproveOrder(order)}
                                    disabled={actionLoadingId === order._id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 border border-emerald-200/60 dark:border-emerald-500/20 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                    title="Approve Purchase Order (PATCH /approve)"
                                  >
                                    {actionLoadingId === order._id ? (
                                      <FiLoader className="text-xs animate-spin" />
                                    ) : (
                                      <FiCheck size={12} />
                                    )}
                                    <span>Approve</span>
                                  </button>

                                  {/* Reject (PATCH /purchase-orders/{id}/reject) */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRejectModal(order)}
                                    disabled={actionLoadingId === order._id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-200/60 dark:border-rose-500/20 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                    title="Reject Purchase Order with Reason (PATCH /reject)"
                                  >
                                    <FiX size={12} />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}

                              {isAdmin && isApproved && (
                                /* Dispatch (PATCH /purchase-orders/{id}/dispatch) */
                                <button
                                  type="button"
                                  onClick={() => handleOpenDispatchModal(order)}
                                  disabled={actionLoadingId === order._id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20 border border-cyan-200/60 dark:border-cyan-500/20 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                  title="Dispatch Purchase Order (PATCH /dispatch)"
                                >
                                  <FiTruck size={12} />
                                  <span>Dispatch</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={isBulkMode ? 11 : 10} className="p-16 text-center text-slate-500 dark:text-slate-400">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
                          <FiShoppingCart className="text-2xl" />
                        </div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-white">
                          No matching purchase orders
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                          {searchTerm || statusFilter !== 'all'
                            ? 'No purchase orders matched your search or status criteria.'
                            : 'No purchase orders have been created yet.'}
                        </p>
                        {!searchTerm && statusFilter === 'all' && (
                          <button
                            type="button"
                            onClick={handleOpenCreateModal}
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer hover:bg-blue-700"
                          >
                            <FiPlus />
                            <span>Create First PO</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredOrders.length > 0 && (
              <div className="p-4 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-white/[0.02]">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Showing <span className="font-bold text-slate-800 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="font-bold text-slate-800 dark:text-white">
                    {Math.min(currentPage * itemsPerPage, filteredOrders.length)}
                  </span>{' '}
                  of <span className="font-bold text-slate-800 dark:text-white">{filteredOrders.length}</span> orders
                </span>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl disabled:opacity-40 transition-all text-xs font-bold border border-slate-200/80 dark:border-white/10 cursor-pointer disabled:cursor-not-allowed"
                  >
                    &larr; Prev
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCurrentPage(num)}
                        className={`w-7 h-7 flex items-center justify-center rounded-xl text-xs font-bold cursor-pointer ${
                          currentPage === num
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl disabled:opacity-40 transition-all text-xs font-bold border border-slate-200/80 dark:border-white/10 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* =========================================================================
          SLIDE-OVER DETAIL DRAWER: ORDER DETAILS & COMPLETE AUDIT LOG (GET /purchase-orders/{id})
         ========================================================================= */}
      {selectedOrder &&
        createPortal(
          <div className="fixed inset-0 z-[10000] overflow-hidden">
            {/* Backdrop Blur Overlay */}
            <div
              className="fixed inset-0 dark:bg-slate-950/60 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
              onClick={handleCloseDetailsDrawer}
            />

            {/* Slide-Over Drawer Container (Pinned to Right) */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-6 md:pl-10">
              <div className="w-screen max-w-full sm:max-w-2xl md:max-w-3xl bg-white/40 dark:bg-slate-950/25 border-l border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 z-10">
                {/* 1. Sticky Drawer Header */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shrink-0 gap-2 sm:gap-4">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-base sm:text-lg border border-blue-500/20 shrink-0">
                      <FiPackage />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono truncate">
                          {selectedOrder.poNumber || selectedOrder.orderNumber || 'Purchase Order'}
                        </h3>
                        <CopyButton text={selectedOrder.poNumber || selectedOrder.orderNumber || selectedOrder._id} />
                        {loadingDetails && <FiLoader className="text-blue-500 animate-spin text-sm" />}
                        {(() => {
                          const badge = getStatusBadge(selectedOrder.status);
                          const BadgeIcon = badge.icon;
                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${badge.className}`}
                            >
                              <BadgeIcon className="text-[11px]" />
                              <span>{badge.label}</span>
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        Created on {formatDateTimeDDMMYYYY(selectedOrder.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Header Actions: Quick Order Stepping + Close */}
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    {selectedOrderIndex >= 0 && (
                      <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl p-0.5 sm:p-1 text-xs">
                        <button
                          type="button"
                          onClick={handlePrevOrder}
                          disabled={!canGoPrevOrder}
                          title="Previous Order (Left Arrow)"
                          className="p-1 sm:p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <FiChevronLeft size={15} />
                        </button>
                        <span className="px-1.5 font-mono text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-semibold select-none">
                          {selectedOrderIndex + 1} of {filteredOrders.length}
                        </span>
                        <button
                          type="button"
                          onClick={handleNextOrder}
                          disabled={!canGoNextOrder}
                          title="Next Order (Right Arrow)"
                          className="p-1 sm:p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <FiChevronRight size={15} />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleCloseDetailsDrawer}
                      title="Close drawer (Esc)"
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                    >
                      <FiX size={18} />
                    </button>
                  </div>
                </div>

                {/* 2. Scrollable Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-7 custom-scrollbar space-y-4 sm:space-y-5">
                  {/* Order Overview Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-xs">
                {/* Trading Company */}
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Trading Company</span>
                  <div className="flex items-center gap-2">
                    {selectedOrder.companyId?.logo ? (
                      <img
                        src={selectedOrder.companyId.logo}
                        alt={selectedOrder.companyId?.name || 'Company'}
                        className="w-8 h-8 rounded-lg object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200/80 dark:border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                        <FiBriefcase className="text-sm" />
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-sm block">
                        {selectedOrder.companyId?.name || 'Company Entity'}
                      </span>
                      {selectedOrder.companyId?.code && (
                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold">
                          Code: {selectedOrder.companyId.code}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Purchasing Firm */}
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Purchasing Firm</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {selectedOrder.firmId?.firmName || 'Retailer Firm'}
                      </span>
                      {selectedOrder.firmId?.firmCode && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                          {selectedOrder.firmId.firmCode}
                        </span>
                      )}
                    </div>
                    {selectedOrder.firmId?.contactPerson && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
                        <FiUser className="text-[10px] text-slate-400" />
                        <span>{selectedOrder.firmId.contactPerson}</span>
                        {selectedOrder.firmId.phone && (
                          <a href={`tel:${selectedOrder.firmId.phone}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline">
                            ({selectedOrder.firmId.phone})
                          </a>
                        )}
                      </p>
                    )}
                    {(selectedOrder.firmId?.address || selectedOrder.firmId?.city) && (
                      <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <FiMapPin className="text-[10px] text-rose-500 shrink-0" />
                        <span>
                          {[selectedOrder.firmId.address, selectedOrder.firmId.city, selectedOrder.firmId.state].filter(Boolean).join(', ')}
                        </span>
                      </p>
                    )}
                    {selectedOrder.firmId?.gstin && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                        <span>GSTIN: {selectedOrder.firmId.gstin}</span>
                        <CopyButton text={selectedOrder.firmId.gstin} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Sales Executive */}
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Sales Executive</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900 dark:text-white text-xs">
                        {selectedOrder.salesExecutiveId
                          ? `${selectedOrder.salesExecutiveId.firstName || ''} ${selectedOrder.salesExecutiveId.lastName || ''}`.trim() ||
                            selectedOrder.salesExecutiveId.name
                          : 'Self / System Generated'}
                      </span>
                      {selectedOrder.salesExecutiveId?.employeeCode && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {selectedOrder.salesExecutiveId.employeeCode}
                        </span>
                      )}
                    </div>
                    {selectedOrder.salesExecutiveId?.email && (
                      <a href={`mailto:${selectedOrder.salesExecutiveId.email}`} className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline block mt-0.5">
                        {selectedOrder.salesExecutiveId.email}
                      </a>
                    )}
                    {selectedOrder.salesExecutiveId?.phone && (
                      <a href={`tel:${selectedOrder.salesExecutiveId.phone}`} className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block">
                        {selectedOrder.salesExecutiveId.phone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Current Status & Approval Audit */}
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Current Lifecycle Status</span>
                  <div>
                    {(() => {
                      const badge = getStatusBadge(selectedOrder.status);
                      const BadgeIcon = badge.icon;
                      return (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${badge.className}`}
                        >
                          <BadgeIcon className="text-[11px]" />
                          <span>{badge.label}</span>
                        </span>
                      );
                    })()}
                    {selectedOrder.approvedBy && (
                      <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400">Approved By: </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedOrder.approvedBy.firstName || ''} {selectedOrder.approvedBy.lastName || ''}
                        </span>
                        {selectedOrder.approvedAt && (
                          <span className="block text-[10px] font-mono text-slate-400">
                            {formatDateTimeDDMMYYYY(selectedOrder.approvedAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notification Email Status Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-xs mb-5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FiMail className="text-blue-500" /> Delivery Email Dispatch
                  </span>
                  {(() => {
                    const eb = getEmailStatusBadge(selectedOrder.emailStatus);
                    const EbIcon = eb.icon;
                    return (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${eb.className}`}>
                        <EbIcon className="text-[10px]" />
                        <span>{eb.label}</span>
                      </span>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Sent Timestamp</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {selectedOrder.emailStatus?.lastSentAt
                        ? formatDateTimeDDMMYYYY(selectedOrder.emailStatus.lastSentAt)
                        : 'Not Dispatched Yet'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Message ID</span>
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate block max-w-full" title={selectedOrder.emailStatus?.messageId}>
                      {selectedOrder.emailStatus?.messageId || '-'}
                    </span>
                  </div>
                </div>
                {Array.isArray(selectedOrder.emailStatus?.recipients) && selectedOrder.emailStatus.recipients.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-white/10">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1.5">
                      Recipients ({selectedOrder.emailStatus.recipients.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedOrder.emailStatus.recipients.map((rec, rIdx) => (
                        <span
                          key={rIdx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 text-[11px] font-mono text-slate-700 dark:text-slate-300"
                        >
                          <FiMail className="text-slate-400 text-[10px]" />
                          <span>{rec}</span>
                          <CopyButton text={rec} />
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Order Notes / Rejection Reason */}
              {selectedOrder.notes && (
                <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs">
                  <span className="font-bold text-amber-700 dark:text-amber-300 block mb-0.5">Order Notes:</span>
                  <p className="text-slate-700 dark:text-slate-200 italic">"{selectedOrder.notes}"</p>
                </div>
              )}

              {selectedOrder.rejectionReason && (
                <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs">
                  <span className="font-bold text-rose-700 dark:text-rose-300 block mb-0.5 flex items-center gap-1.5">
                    <FiXCircle /> Rejection Reason:
                  </span>
                  <p className="text-slate-700 dark:text-slate-200 italic">"{selectedOrder.rejectionReason}"</p>
                </div>
              )}

              {/* Line Items Snapshot */}
              <div className="space-y-2 mb-5">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FiFileText /> Item Snapshots ({Array.isArray(selectedOrder.items) ? selectedOrder.items.length : 0})
                </h4>
                <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="p-2.5">Product & SKU</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Unit Price</th>
                        <th className="p-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                        selectedOrder.items.map((item, i) => (
                          <tr key={item.productId || i} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                            <td className="p-2.5">
                              <p className="font-bold text-slate-900 dark:text-white">
                                {item.productNameSnapshot || item.productId?.name || 'Product Item'}
                              </p>
                              <p className="font-mono text-[10px] text-blue-600 dark:text-blue-400">
                                {item.skuSnapshot || item.productId?.sku}
                              </p>
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold">{item.quantity}</td>
                            <td className="p-2.5 text-right font-mono">
                              ₹{(item.unitPrice || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                              ₹{((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="p-4 text-center text-slate-400">
                            No snapshot items found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Order Amount */}
              <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 mb-5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                  Total Order Amount
                </span>
                <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                  ₹{(selectedOrder.totalAmount || selectedOrder.totalValue || selectedOrder.subtotal || 0).toLocaleString('en-IN')}
                </span>
              </div>

              {/* Status History & Complete Audit Log */}
              <div className="mb-5 p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FiActivity className="text-blue-500" /> Complete Status History & Audit Log
                </h4>

                {Array.isArray(selectedOrder.statusHistory) && selectedOrder.statusHistory.length > 0 ? (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-white/10">
                    {selectedOrder.statusHistory.map((historyItem, hIdx) => {
                      const st = historyItem.newStatus || historyItem.status || 'PENDING';
                      const badge = getStatusBadge(st);
                      const BadgeIcon = badge.icon;
                      const changer = historyItem.changedBy;
                      const changerName = changer
                        ? typeof changer === 'object'
                          ? `${changer.firstName || ''} ${changer.lastName || ''}`.trim() || changer.name || changer.email
                          : changer
                        : 'System';
                      const changerRole = typeof changer === 'object' ? changer.role : null;
                      const changerEmail = typeof changer === 'object' ? changer.email : null;

                      return (
                        <div key={hIdx} className="relative">
                          <span
                            className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 ${badge.dot}`}
                          />
                          <div className="text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full font-bold uppercase text-[9px] border ${badge.className}`}
                              >
                                <BadgeIcon className="text-[10px]" />
                                {st}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {formatDateTimeDDMMYYYY(historyItem.createdAt || historyItem.timestamp || historyItem.date)}
                              </span>
                            </div>
                            {changer && (
                              <p className="text-slate-600 dark:text-slate-300 mt-1">
                                Action by:{' '}
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {changerName}
                                </span>
                                {changerRole && (
                                  <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-400">
                                    {changerRole}
                                  </span>
                                )}
                                {changerEmail && changerEmail !== changerName && (
                                  <span className="text-[10px] text-slate-400 ml-1">
                                    ({changerEmail})
                                  </span>
                                )}
                              </p>
                            )}
                            {historyItem.reason && (
                              <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                                <span className="font-semibold text-slate-500">Reason: </span>
                                <span className="italic font-medium">"{historyItem.reason}"</span>
                              </p>
                            )}
                            {historyItem.notes && (
                              <p className="text-slate-500 dark:text-slate-400 mt-0.5 italic">
                                Note: "{historyItem.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 space-y-1.5 py-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Order initiated: {formatDateTimeDDMMYYYY(selectedOrder.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Current Lifecycle Stage: <strong>{selectedOrder.status || 'PENDING'}</strong></span>
                    </div>
                  </div>
                )}
              </div>

                </div>

                {/* 3. Sticky Action Footer */}
                <div className="shrink-0 p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-slate-950/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Close Drawer
                  </button>

                  {/* Workflow Buttons right in details */}
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      {selectedOrder.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const ord = selectedOrder;
                              handleOpenRejectModal(ord);
                            }}
                            className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center gap-1.5 border border-rose-500/20 cursor-pointer"
                          >
                            <FiX />
                            <span>Reject PO</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproveOrder(selectedOrder)}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                          >
                            <FiCheck />
                            <span>Approve PO</span>
                          </button>
                        </>
                      )}

                      {selectedOrder.status === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => {
                            const ord = selectedOrder;
                            handleOpenDispatchModal(ord);
                          }}
                          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/20 cursor-pointer"
                        >
                          <FiTruck />
                          <span>Dispatch Order</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* =========================================================================
          MODAL 2: CREATE PURCHASE ORDER (POST /purchase-orders)
         ========================================================================= */}
      {isCreateModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 dark:bg-slate-950/50 backdrop-blur-lg animate-fade-in"
              onClick={() => !createSubmitting && setIsCreateModalOpen(false)}
            />
            <div className="relative bg-white/40 dark:bg-slate-950/25 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200 z-10">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/80 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl border border-blue-500/20">
                    <FiPlus />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      Create Purchase Order
                    </h3>
                    <p className="text-xs text-slate-400">
                      POST /purchase-orders with structured line items or raw JSON.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFillSample}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    title="Load sample festival delivery PO payload"
                  >
                    <span>⚡ Load Sample</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={createSubmitting}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                  >
                    <FiX size={18} />
                  </button>
                </div>
              </div>

              {/* Mode Selector Tabs */}
              <div className="flex items-center gap-2 mb-4 p-1 rounded-2xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setCreateMode('form')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    createMode === 'form'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Visual Form Builder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateMode('raw_json');
                    // Sync current form to raw JSON if needed
                    const validItems = createForm.items.filter((it) => it.productId);
                    const currentObj = {
                      companyId: createForm.companyId || SAMPLE_PO_BODY.companyId,
                      firmId: createForm.firmId || SAMPLE_PO_BODY.firmId,
                      ...(createForm.notes ? { notes: createForm.notes } : { notes: SAMPLE_PO_BODY.notes }),
                      items: validItems.length > 0
                        ? validItems.map((it) => ({
                            productId: it.productId,
                            quantity: Number(it.quantity) || 1,
                            unitPrice: Number(it.unitPrice) || 0
                          }))
                        : SAMPLE_PO_BODY.items
                    };
                    setRawJsonText(JSON.stringify(currentObj, null, 2));
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    createMode === 'raw_json'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Raw JSON Payload
                </button>
              </div>

              {createError && (
                <div className="p-3.5 mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <FiAlertCircle className="shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <form onSubmit={handleCreateOrderSubmit} className="space-y-4">
                {createMode === 'raw_json' ? (
                  /* Raw JSON Editor */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        JSON Request Body (POST /purchase-orders)
                      </label>
                      <CopyButton text={rawJsonText} title="Copy JSON" />
                    </div>
                    <textarea
                      rows={14}
                      value={rawJsonText}
                      onChange={(e) => setRawJsonText(e.target.value)}
                      disabled={createSubmitting}
                      className="w-full p-4 bg-slate-900 text-emerald-400 border border-slate-700 rounded-2xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 custom-scrollbar leading-relaxed"
                    />
                    <p className="text-[11px] text-slate-400">
                      Edit or paste custom payload. Fields: <code>companyId</code>, <code>firmId</code>, <code>items: [productId, quantity, unitPrice]</code>, <code>notes</code>.
                    </p>
                  </div>
                ) : (
                  /* Visual Form */
                  <>
                    {/* Company & Firm selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Trading Company <span className="text-rose-500">*</span>
                          </label>
                          {createForm.companyId && (
                            <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                              ID: {createForm.companyId}
                            </span>
                          )}
                        </div>
                        <CustomDropdown
                          value={createForm.companyId}
                          onChange={(val) => setCreateForm((prev) => ({ ...prev, companyId: val }))}
                          disabled={createSubmitting || loadingEntities}
                          defaultLabel="Select Trading Company"
                          options={[
                            { value: '', label: 'Select Trading Company' },
                            ...companiesList.map((c) => ({
                              value: c._id,
                              label: `${c.name} ${c.code ? `(${c.code})` : ''}`
                            }))
                          ]}
                          statusColor="!px-3.5 !py-2.5 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white"
                        />
                        <input
                          type="text"
                          placeholder="Or paste custom companyId..."
                          value={createForm.companyId}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, companyId: e.target.value }))}
                          disabled={createSubmitting}
                          className="w-full mt-1.5 px-3 py-1.5 bg-slate-100/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Purchasing Firm <span className="text-rose-500">*</span>
                          </label>
                          {createForm.firmId && (
                            <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                              ID: {createForm.firmId}
                            </span>
                          )}
                        </div>
                        <CustomDropdown
                          value={createForm.firmId}
                          onChange={(val) => setCreateForm((prev) => ({ ...prev, firmId: val }))}
                          disabled={createSubmitting || loadingEntities}
                          defaultLabel="Select Purchasing Firm"
                          options={[
                            { value: '', label: 'Select Purchasing Firm' },
                            ...firmsList.map((f) => ({
                              value: f._id,
                              label: `${f.firmName} ${f.city ? `(${f.city})` : ''}`
                            }))
                          ]}
                          statusColor="!px-3.5 !py-2.5 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white"
                        />
                        <input
                          type="text"
                          placeholder="Or paste custom firmId..."
                          value={createForm.firmId}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, firmId: e.target.value }))}
                          disabled={createSubmitting}
                          className="w-full mt-1.5 px-3 py-1.5 bg-slate-100/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                        />
                      </div>
                    </div>

                    {/* Line Items Section */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Line Items ({createForm.items.length}) <span className="text-rose-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleAddItemRow}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          <FiPlus size={13} />
                          <span>Add Product</span>
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {createForm.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-2xl flex flex-col sm:flex-row items-center gap-3"
                          >
                            {/* Product Selector / Custom ProductId Input */}
                            <div className="flex-1 w-full space-y-1">
                              <CustomDropdown
                                value={item.productId}
                                onChange={(val) => handleItemChange(idx, 'productId', val)}
                                disabled={createSubmitting}
                                defaultLabel="Select Catalog Product"
                                options={[
                                  { value: '', label: 'Select Catalog Product' },
                                  ...productsList.map((p) => ({
                                    value: p._id,
                                    label: `${p.name} ${p.sku ? `[${p.sku}]` : ''} - ₹${p.defaultPrice || p.price || 0}`
                                  }))
                                ]}
                                statusColor="!px-3 !py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white"
                              />
                              <input
                                type="text"
                                placeholder="Or enter productId..."
                                value={item.productId}
                                onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                                disabled={createSubmitting}
                                className="w-full px-2.5 py-1 bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 rounded-lg text-[11px] font-mono text-slate-700 dark:text-slate-300"
                              />
                            </div>

                            {/* Quantity */}
                            <div className="w-full sm:w-24">
                              <label className="text-[10px] text-slate-400 font-bold block mb-0.5 sm:hidden">Qty</label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                disabled={createSubmitting}
                                placeholder="Qty"
                                className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-center font-mono font-bold text-slate-900 dark:text-white"
                              />
                            </div>

                            {/* Unit Price */}
                            <div className="w-full sm:w-28">
                              <label className="text-[10px] text-slate-400 font-bold block mb-0.5 sm:hidden">Unit ₹</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                                disabled={createSubmitting}
                                placeholder="Unit ₹"
                                className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-right font-mono text-slate-900 dark:text-white"
                              />
                            </div>

                            {/* Subtotal */}
                            <div className="w-full sm:w-28 text-right font-mono font-bold text-xs text-slate-900 dark:text-white">
                              ₹{((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString('en-IN')}
                            </div>

                            {/* Remove Row */}
                            {createForm.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                disabled={createSubmitting}
                                className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                                title="Remove product"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Order Remarks / Delivery Notes
                      </label>
                      <textarea
                        rows={2}
                        value={createForm.notes}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
                        disabled={createSubmitting}
                        placeholder="e.g. Urgent festival delivery requested..."
                        className="w-full px-3.5 py-2.5 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                      />
                    </div>

                    {/* Total Calculation */}
                    <div className="flex justify-between items-center p-3.5 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Estimated Order Booking:
                      </span>
                      <span className="text-base font-black font-mono text-blue-600 dark:text-blue-400">
                        ₹{estimatedCreateTotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </>
                )}

                {/* Buttons */}
                <div className="flex gap-3 pt-3 border-t border-slate-200/80 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={createSubmitting}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createSubmitting}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {createSubmitting && <FiLoader className="animate-spin text-xs" />}
                    <span>{createSubmitting ? 'Creating...' : 'Submit Purchase Order'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* =========================================================================
          MODAL 3: REJECT PURCHASE ORDER (PATCH /purchase-orders/{id}/reject)
         ========================================================================= */}
      {rejectModalOrder &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 dark:bg-slate-950/50 backdrop-blur-lg animate-fade-in"
              onClick={() => !rejectSubmitting && setRejectModalOrder(null)}
            />
            <div className="relative bg-white/40 dark:bg-slate-950/25 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200 z-10">
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-200/80 dark:border-white/10">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center text-xl">
                  <FiXCircle />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Reject Purchase Order
                  </h3>
                  <p className="text-xs text-slate-400">
                    Mandatory reason required (PATCH /reject).
                  </p>
                </div>
              </div>

              {rejectError && (
                <div className="p-3 mb-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold">
                  {rejectError}
                </div>
              )}

              <form onSubmit={handleConfirmReject} className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Please provide a detailed justification for rejecting order{' '}
                  <strong className="font-mono text-slate-900 dark:text-white">
                    {rejectModalOrder.poNumber || rejectModalOrder.orderNumber || rejectModalOrder._id}
                  </strong>
                  .
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Rejection Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    disabled={rejectSubmitting}
                    placeholder="e.g. Insufficient credit limit, item unavailable in requested quantity..."
                    className="w-full px-3.5 py-2.5 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setRejectModalOrder(null)}
                    disabled={rejectSubmitting}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={rejectSubmitting}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-rose-600/25 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {rejectSubmitting && <FiLoader className="animate-spin text-xs" />}
                    <span>{rejectSubmitting ? 'Rejecting...' : 'Confirm Reject'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* =========================================================================
          MODAL 4: DISPATCH PURCHASE ORDER (PATCH /purchase-orders/{id}/dispatch)
         ========================================================================= */}
      {dispatchModalOrder &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 dark:bg-slate-950/60 backdrop-blur-lg animate-fade-in"
              onClick={() => !dispatchSubmitting && setDispatchModalOrder(null)}
            />
            <div className="relative bg-white/40 dark:bg-slate-950/25 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200 z-10">
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-200/80 dark:border-white/10">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center text-xl">
                  <FiTruck />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Dispatch Purchase Order
                  </h3>
                  <p className="text-xs text-slate-400">
                    Advance status from APPROVED to DISPATCHED.
                  </p>
                </div>
              </div>

              <form onSubmit={handleConfirmDispatch} className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Confirm shipment and dispatch of Purchase Order{' '}
                  <strong className="font-mono text-slate-900 dark:text-white">
                    {dispatchModalOrder.poNumber || dispatchModalOrder.orderNumber || dispatchModalOrder._id}
                  </strong>
                  .
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Dispatch / Courier Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={dispatchNotes}
                    onChange={(e) => setDispatchNotes(e.target.value)}
                    disabled={dispatchSubmitting}
                    placeholder="e.g. Courier tracking #TRK99241 via BlueDart Logistics..."
                    className="w-full px-3.5 py-2.5 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDispatchModalOrder(null)}
                    disabled={dispatchSubmitting}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={dispatchSubmitting}
                    className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-cyan-600/25 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {dispatchSubmitting && <FiLoader className="animate-spin text-xs" />}
                    <span>{dispatchSubmitting ? 'Dispatching...' : 'Confirm Dispatch'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      {/* ================= BULK ACTION BAR ================= */}
      {isBulkMode && (
        <BulkActionBar
          selectedCount={selectedOrderIds.size}
          totalCount={currentOrders.length}
          onClear={() => setSelectedOrderIds(new Set())}
          onExit={() => {
            setIsBulkMode(false);
            setSelectedOrderIds(new Set());
          }}
          quickSelectors={[
            {
              label: `Select Pending (${stats.pending})`,
              onClick: selectAllPendingOrders
            },
            {
              label: `Select Approved (${stats.approved})`,
              onClick: selectAllApprovedOrders
            },
            {
              label: 'Select Page',
              onClick: selectAllPageOrders
            }
          ]}
          actions={[
            {
              label: 'Approve Selected',
              icon: FiCheckCircle,
              variant: 'primary',
              onClick: () => {
                if (selectedOrderIds.size === 0) return;
                setBulkApproveRemarks('');
                setBulkActionModal('approve');
              }
            },
            {
              label: 'Dispatch Selected',
              icon: FiTruck,
              variant: 'success',
              onClick: () => {
                if (selectedOrderIds.size === 0) return;
                setBulkActionModal('dispatch');
              }
            },
            {
              label: 'Reject Selected',
              icon: FiXCircle,
              variant: 'danger',
              onClick: () => {
                if (selectedOrderIds.size === 0) return;
                setBulkRejectReason('');
                setBulkActionModal('reject');
              }
            },
            {
              label: 'Export Selected',
              icon: FiDownload,
              variant: 'secondary',
              onClick: executeBulkExport
            }
          ]}
        />
      )}

      {/* ================= BATCH PROGRESS TRACKER ================= */}
      <BatchProgressModal
        isOpen={batchProgress.isOpen}
        taskTitle={batchProgress.taskTitle}
        total={batchProgress.total}
        current={batchProgress.current}
        successCount={batchProgress.successCount}
        failureCount={batchProgress.failureCount}
        logs={batchProgress.logs}
        isFinished={batchProgress.isFinished}
        onAbort={() => {
          abortBatchRef.current = true;
        }}
        onClose={() => setBatchProgress((p) => ({ ...p, isOpen: false }))}
      />

      {/* ================= BULK APPROVE REMARKS MODAL ================= */}
      {bulkActionModal === 'approve' &&
        createPortal(
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
                  <FiCheckCircle size={18} />
                  <span className="text-sm">Bulk Approve Orders</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkActionModal(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <FiX size={16} />
                </button>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                You are about to approve <span className="font-bold font-mono text-blue-600">{selectedOrderIds.size}</span> selected order(s).
                Only orders in PENDING status will be updated to APPROVED.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Approval Notes / Remarks (Optional)
                </label>
                <textarea
                  rows={3}
                  value={bulkApproveRemarks}
                  onChange={(e) => setBulkApproveRemarks(e.target.value)}
                  placeholder="e.g. Bulk approved by procurement director."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkActionModal(null)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeBulkApprove}
                  className="flex-1 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Confirm Approval
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ================= BULK DISPATCH MODAL ================= */}
      {bulkActionModal === 'dispatch' &&
        createPortal(
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                  <FiTruck size={18} />
                  <span className="text-sm">Bulk Dispatch Orders</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkActionModal(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <FiX size={16} />
                </button>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Only orders in <span className="font-bold text-blue-500">APPROVED</span> status will be moved to <span className="font-bold text-emerald-500">DISPATCHED</span>.
              </p>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Logistics Carrier Partner
                  </label>
                  <input
                    type="text"
                    value={bulkDispatchData.carrier}
                    onChange={(e) => setBulkDispatchData((p) => ({ ...p, carrier: e.target.value }))}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tracking Number Prefix
                  </label>
                  <input
                    type="text"
                    value={bulkDispatchData.trackingPrefix}
                    onChange={(e) => setBulkDispatchData((p) => ({ ...p, trackingPrefix: e.target.value }))}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Dispatch Notes
                  </label>
                  <input
                    type="text"
                    value={bulkDispatchData.notes}
                    onChange={(e) => setBulkDispatchData((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="e.g. Dispatched from main warehouse"
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkActionModal(null)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeBulkDispatch}
                  className="flex-1 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Confirm Dispatch
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ================= BULK REJECT MODAL ================= */}
      {bulkActionModal === 'reject' &&
        createPortal(
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
                  <FiXCircle size={18} />
                  <span className="text-sm">Bulk Reject Orders</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkActionModal(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <FiX size={16} />
                </button>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                You are about to reject <span className="font-bold font-mono text-rose-600">{selectedOrderIds.size}</span> selected order(s). This is an irreversible status change.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mandatory Rejection Reason *
                </label>
                <textarea
                  rows={3}
                  value={bulkRejectReason}
                  onChange={(e) => setBulkRejectReason(e.target.value)}
                  placeholder="State clear operational reason (e.g. inventory shortage, pricing issue)..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkActionModal(null)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeBulkReject}
                  className="flex-1 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default PurchaseOrders;
