import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FiPieChart,
  FiDownload,
  FiTrendingUp,
  FiDollarSign,
  FiBox,
  FiRefreshCw,
  FiCalendar,
  FiSearch,
  FiFilter,
  FiLayers,
  FiUser,
  FiMapPin,
  FiFileText,
  FiCheckCircle,
  FiClock,
  FiTruck,
  FiXCircle,
  FiEye,
  FiAlertCircle,
  FiArrowUpRight,
  FiX,
  FiShoppingBag,
  FiBarChart2,
  FiHash,
  FiMail,
  FiSend,
  FiChevronLeft,
  FiChevronRight,
  FiList
} from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Skeleton from '@/components/ui/Skeleton';
import CopyButton from '@/components/ui/CopyButton';
import OrderStatusBreakdownChart from '@/components/reports/OrderStatusBreakdownChart';
import DailyTrendChart from '@/components/reports/DailyTrendChart';
import ProductPerformanceChart from '@/components/reports/ProductPerformanceChart';
import { useTheme } from '@/Context/ThemeContext';
import { useDisplayPreferences } from '@/utils/displayPreferences';
import { getReportsApi } from '@/api/axios';

// Format Indian Rupee currency
const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
};

// Format standard date
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
};

// Format date & time
const formatDateTime = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
};

// Helper for status badge styling
const getStatusBadge = (status) => {
  const s = String(status || '').toUpperCase();
  switch (s) {
    case 'APPROVED':
      return {
        bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        icon: FiCheckCircle,
        label: 'Approved',
        barColor: 'bg-emerald-500',
      };
    case 'DISPATCHED':
      return {
        bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        icon: FiTruck,
        label: 'Dispatched',
        barColor: 'bg-blue-500',
      };
    case 'REJECTED':
      return {
        bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        icon: FiXCircle,
        label: 'Rejected',
        barColor: 'bg-rose-500',
      };
    case 'PENDING':
    default:
      return {
        bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        icon: FiClock,
        label: 'Pending Approval',
        barColor: 'bg-amber-500',
      };
  }
};

// Helper for Email Notification status badge styling
const getEmailStatusBadge = (emailStatus) => {
  const isSent = emailStatus?.isSent;
  const status = (emailStatus?.status || (isSent ? 'SENT' : 'PENDING')).toUpperCase();

  if (status === 'SENT') {
    return {
      label: 'Sent',
      icon: FiMail,
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
      dot: 'bg-emerald-500',
    };
  }
  if (status === 'FAILED') {
    return {
      label: 'Failed',
      icon: FiAlertCircle,
      className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
      dot: 'bg-rose-500',
    };
  }
  return {
    label: 'Pending',
    icon: FiClock,
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
    dot: 'bg-amber-500',
  };
};

const Reports = () => {
  const { isDark } = useTheme();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters & State
  const [selectedRange, setSelectedRange] = useState('1w'); // '1w' | '1m' | '1y' | 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [productViewMode, setProductViewMode] = useState('chart'); // 'chart' | 'table'

  // Fetch report data (supports server-side range param if provided by backend)
  const fetchReportData = useCallback(async (isSilent = false, rangeParam = selectedRange) => {
    if (isSilent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = {};
      if (rangeParam && rangeParam !== 'all') {
        params.range = rangeParam;
      }
      const response = await getReportsApi(params);
      const resData = response?.data?.data || response?.data || {};
      setReportData(resData);
    } catch (err) {
      console.error('Failed to load reports data:', err);
      setError(err.response?.data?.message || 'Failed to load report analytics. Please check your network or try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedRange]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handleRangeChange = (newRange) => {
    setSelectedRange(newRange);
    fetchReportData(true, newRange);
  };

  // Base raw orders strictly deduplicated by _id to avoid any false inflated counts
  const rawOrders = useMemo(() => {
    const list = Array.isArray(reportData?.orders) ? reportData.orders : [];
    const seen = new Set();
    return list.filter((o) => {
      if (!o || !o._id) return true;
      if (seen.has(o._id)) return false;
      seen.add(o._id);
      return true;
    });
  }, [reportData?.orders]);

  // Dynamic filter by Selected Reporting Window
  const rangeFilteredOrders = useMemo(() => {
    if (selectedRange === 'all') return rawOrders;

    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    if (selectedRange === '1w' || selectedRange === 'week' || selectedRange === '7d') {
      // 1 Week: past 7 days (today - 6 to today)
      start.setDate(now.getDate() - 6);
    } else if (selectedRange === '1m' || selectedRange === 'month' || selectedRange === '30d') {
      // 1 Month: past 30 days (today - 29 to today)
      start.setDate(now.getDate() - 29);
    } else if (selectedRange === '1y') {
      // 1 Year: past 365 days
      start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 0, 0, 0, 0);
    }

    return rawOrders.filter((order) => {
      const dateVal = order.createdAt || order.orderDate || order.date;
      if (!dateVal) return false;
      const d = new Date(dateVal);
      return d >= start && d <= end;
    });
  }, [rawOrders, selectedRange]);

  // Derived KPI Summaries dynamically and accurately calculated for the active range
  const summary = useMemo(() => {
    if ((selectedRange === 'all' || rangeFilteredOrders.length === rawOrders.length) && reportData?.summary) {
      return {
        totalOrders: Number(reportData.summary.totalOrders ?? rawOrders.length),
        totalRevenue: Number(reportData.summary.totalRevenue ?? 0),
        avgOrderValue: Number(reportData.summary.avgOrderValue ?? 0),
      };
    }
    const totalOrders = rangeFilteredOrders.length;
    const totalRevenue = rangeFilteredOrders.reduce(
      (sum, o) => sum + (Number(o.totalAmount || o.totalValue || 0)),
      0
    );
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    return { totalOrders, totalRevenue, avgOrderValue };
  }, [rangeFilteredOrders, selectedRange, reportData?.summary, rawOrders.length]);

  // Derived Status Breakdown for the active range
  const statusBreakdown = useMemo(() => {
    if ((selectedRange === 'all' || rangeFilteredOrders.length === rawOrders.length) && Array.isArray(reportData?.statusBreakdown) && reportData.statusBreakdown.length > 0) {
      return reportData.statusBreakdown;
    }
    const map = {};
    rangeFilteredOrders.forEach((o) => {
      const st = (o.status || 'PENDING').toUpperCase();
      if (!map[st]) map[st] = { _id: st, count: 0, totalAmount: 0 };
      map[st].count += 1;
      map[st].totalAmount += Number(o.totalAmount || o.totalValue || 0);
    });
    const list = Object.values(map);
    if (list.length > 0) return list;
    if (Array.isArray(reportData?.statusBreakdown)) {
      return reportData.statusBreakdown;
    }
    return [];
  }, [rangeFilteredOrders, selectedRange, reportData?.statusBreakdown, rawOrders.length]);

  // Derived Daily Velocity & Trend for the active range
  const dailyTrend = useMemo(() => {
    if (selectedRange === 'all' && Array.isArray(reportData?.dailyTrend) && reportData.dailyTrend.length > 0) {
      return reportData.dailyTrend;
    }

    const dateMap = {};
    rangeFilteredOrders.forEach((o) => {
      const dateVal = o.createdAt || o.orderDate || o.date;
      if (!dateVal) return;
      const key = new Date(dateVal).toISOString().split('T')[0];
      if (!dateMap[key]) dateMap[key] = { _id: key, date: key, totalAmount: 0, orderCount: 0 };
      dateMap[key].totalAmount += Number(o.totalAmount || o.totalValue || 0);
      dateMap[key].orderCount += 1;
    });

    const today = new Date();

    if (selectedRange === '1w' || selectedRange === 'week' || selectedRange === '7d') {
      const res = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.toISOString().split('T')[0];
        res.push(dateMap[key] || { _id: key, date: key, totalAmount: 0, orderCount: 0 });
      }
      return res;
    }

    if (selectedRange === '1m' || selectedRange === 'month' || selectedRange === '30d') {
      const res = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.toISOString().split('T')[0];
        if (dateMap[key] || i < 7) {
          res.push(dateMap[key] || { _id: key, date: key, totalAmount: 0, orderCount: 0 });
        }
      }
      return res;
    }

    if (selectedRange === '1y') {
      const res = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        let monthRev = 0;
        let monthOrd = 0;
        Object.keys(dateMap).forEach((dateKey) => {
          if (dateKey.startsWith(yearMonth)) {
            monthRev += dateMap[dateKey].totalAmount;
            monthOrd += dateMap[dateKey].orderCount;
          }
        });
        res.push({
          _id: `${yearMonth}-01`,
          date: `${yearMonth}-01`,
          totalAmount: monthRev,
          orderCount: monthOrd
        });
      }
      return res;
    }

    // 'all'
    if (Object.keys(dateMap).length > 0) {
      return Object.values(dateMap).sort((a, b) => a._id.localeCompare(b._id));
    }

    return Array.isArray(reportData?.dailyTrend) ? reportData.dailyTrend : [];
  }, [rangeFilteredOrders, selectedRange, reportData?.dailyTrend]);

  // Derived Product Performance for the active range
  const productPerformance = useMemo(() => {
    const totalOrdersCount = rangeFilteredOrders.length;
    if (totalOrdersCount > 0) {
      const prodMap = {};
      rangeFilteredOrders.forEach((o) => {
        const orderId = o._id || o.poNumber;
        if (Array.isArray(o.items)) {
          o.items.forEach((item) => {
            const pId = item.productId?._id || item.productId || item.name || 'item';
            const pName = item.productNameSnapshot || item.productId?.name || item.name || 'Catalog Product';
            const sku = item.skuSnapshot || item.productId?.sku || item.sku || 'N/A';
            const qty = Number(item.quantity || 1);
            const uPrice = Number(item.unitPrice || 0);
            const rev = Number(item.totalPrice || (qty * uPrice) || 0);

            if (!prodMap[pId]) {
              prodMap[pId] = {
                _id: pId,
                productName: pName,
                sku,
                totalQuantity: 0,
                totalRevenue: 0,
                orderIds: new Set()
              };
            }
            prodMap[pId].totalQuantity += qty;
            prodMap[pId].totalRevenue += rev;
            if (orderId) prodMap[pId].orderIds.add(orderId);
          });
        }
      });

      const list = Object.values(prodMap).map((p) => ({
        ...p,
        ordersCount: p.orderIds ? p.orderIds.size : 1
      })).sort((a, b) => b.totalRevenue - a.totalRevenue);

      if (list.length > 0) return list;
    }

    if (Array.isArray(reportData?.productPerformance)) {
      return reportData.productPerformance.map((p) => ({
        ...p,
        ordersCount: p.ordersCount || p.orderCount || Math.max(1, Math.round((p.totalQuantity || 1) / 3))
      }));
    }

    return [];
  }, [rangeFilteredOrders, reportData?.productPerformance]);

  // Product Sales Performance Pagination
  const { preferences: displayPrefs } = useDisplayPreferences();
  const [productPage, setProductPage] = useState(1);
  const productRowsPerPage = displayPrefs.rowsPerPage || 10;

  const totalProductPages = Math.ceil(productPerformance.length / productRowsPerPage) || 1;
  const indexOfLastProduct = productPage * productRowsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productRowsPerPage;
  const paginatedProductPerformance = useMemo(() => {
    return productPerformance.slice(indexOfFirstProduct, indexOfLastProduct);
  }, [productPerformance, indexOfFirstProduct, indexOfLastProduct]);

  useEffect(() => {
    if (productPage > totalProductPages && totalProductPages > 0) {
      setProductPage(1);
    }
  }, [totalProductPages, productPage]);

  // Reset product page when report range or data changes
  useEffect(() => {
    setProductPage(1);
  }, [selectedRange, reportData]);

  // Total quantity sold across all products
  const totalUnitsSold = useMemo(() => {
    return productPerformance.reduce((acc, p) => acc + (Number(p.totalQuantity) || 0), 0);
  }, [productPerformance]);

  // Max daily revenue for relative trend visualization
  const maxDailyRevenue = useMemo(() => {
    if (!dailyTrend.length) return 1;
    return Math.max(...dailyTrend.map((d) => Number(d.totalAmount) || 0), 1);
  }, [dailyTrend]);

  // Filtered orders (filtered by range, status, and search query)
  const filteredOrders = useMemo(() => {
    return rangeFilteredOrders.filter((order) => {
      const matchesStatus =
        statusFilter === 'ALL' || String(order.status || '').toUpperCase() === statusFilter;

      if (!matchesStatus) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const poNum = String(order.poNumber || '').toLowerCase();
      const compName = String(order.companyId?.name || '').toLowerCase();
      const compCode = String(order.companyId?.code || '').toLowerCase();
      const firmName = String(order.firmId?.firmName || '').toLowerCase();
      const firmCode = String(order.firmId?.firmCode || '').toLowerCase();
      const firmCity = String(order.firmId?.city || '').toLowerCase();
      const execName = `${order.salesExecutiveId?.firstName || ''} ${order.salesExecutiveId?.lastName || ''}`.toLowerCase();
      const execCode = String(order.salesExecutiveId?.employeeCode || '').toLowerCase();
      const execEmail = String(order.salesExecutiveId?.email || '').toLowerCase();

      return (
        poNum.includes(q) ||
        compName.includes(q) ||
        compCode.includes(q) ||
        firmName.includes(q) ||
        firmCode.includes(q) ||
        firmCity.includes(q) ||
        execName.includes(q) ||
        execCode.includes(q) ||
        execEmail.includes(q)
      );
    });
  }, [rangeFilteredOrders, searchQuery, statusFilter]);

  // Stepper calculations for Order Details Drawer
  const selectedOrderIndex = selectedOrder
    ? filteredOrders.findIndex((o) => (o._id || o.poNumber) === (selectedOrder._id || selectedOrder.poNumber))
    : -1;
  const hasPrevOrder = selectedOrderIndex > 0;
  const hasNextOrder = selectedOrderIndex >= 0 && selectedOrderIndex < filteredOrders.length - 1;

  const handlePrevOrder = () => {
    if (hasPrevOrder) {
      setSelectedOrder(filteredOrders[selectedOrderIndex - 1]);
    }
  };

  const handleNextOrder = () => {
    if (hasNextOrder) {
      setSelectedOrder(filteredOrders[selectedOrderIndex + 1]);
    }
  };

  // Keyboard navigation & body scroll lock for Order Details Drawer
  useEffect(() => {
    if (!selectedOrder) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedOrder(null);
      } else if (e.key === 'ArrowLeft' && hasPrevOrder) {
        handlePrevOrder();
      } else if (e.key === 'ArrowRight' && hasNextOrder) {
        handleNextOrder();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedOrder, hasPrevOrder, hasNextOrder, selectedOrderIndex]);

  // CSV Export Generators
  const exportToCSV = (filename, rows) => {
    if (!rows || !rows.length) return;
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
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportMenuOpen(false);
  };

  const handleExportOrdersCSV = () => {
    const targetOrders = filteredOrders.length > 0 ? filteredOrders : rangeFilteredOrders;
    if (!targetOrders.length) return;
    const headers = [
      'PO Number',
      'Status',
      'Email Status',
      'Email Recipients',
      'Company Name',
      'Company Code',
      'Firm Name',
      'Firm Code',
      'City',
      'Sales Executive',
      'Employee Code',
      'Items Count',
      'Subtotal (INR)',
      'Total Amount (INR)',
      'Notes',
      'Order Date',
      'Approved At',
    ];
    const rows = [headers];
    targetOrders.forEach((o) => {
      const itemsCount = (o.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0);
      const salesRep = `${o.salesExecutiveId?.firstName || ''} ${o.salesExecutiveId?.lastName || ''}`.trim();
      const emailStatus = o.emailStatus?.status || (o.emailStatus?.isSent ? 'SENT' : 'PENDING');
      const recipients = Array.isArray(o.emailStatus?.recipients) ? o.emailStatus.recipients.join('; ') : '';
      rows.push([
        o.poNumber || '',
        o.status || '',
        emailStatus,
        recipients,
        o.companyId?.name || '',
        o.companyId?.code || '',
        o.firmId?.firmName || '',
        o.firmId?.firmCode || '',
        o.firmId?.city || '',
        salesRep,
        o.salesExecutiveId?.employeeCode || '',
        itemsCount,
        o.subtotal || 0,
        o.totalAmount || 0,
        o.notes || '',
        o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN') : '',
        o.approvedAt ? new Date(o.approvedAt).toLocaleString('en-IN') : '',
      ]);
    });
    exportToCSV('orders_report', rows);
  };

  const handleExportProductsCSV = () => {
    if (!productPerformance.length) return;
    const headers = ['Rank', 'Product Name', 'SKU', 'Orders Count', 'Units Sold', 'Avg Unit Price (INR)', 'Total Revenue (INR)', 'Volume Share (%)', 'Revenue Share (%)'];
    const rows = [headers];
    const totalRev = Number(summary.totalRevenue) || 1;
    productPerformance.forEach((p, idx) => {
      const share = (((Number(p.totalRevenue) || 0) / totalRev) * 100).toFixed(2);
      const volShare = totalUnitsSold ? (((Number(p.totalQuantity) || 0) / totalUnitsSold) * 100).toFixed(2) : '0.00';
      const avgPrice = p.totalQuantity ? Math.round((Number(p.totalRevenue) || 0) / p.totalQuantity) : 0;
      rows.push([
        idx + 1,
        p.productName || '',
        p.sku || '',
        p.ordersCount || 1,
        p.totalQuantity || 0,
        avgPrice,
        p.totalRevenue || 0,
        `${volShare}%`,
        `${share}%`
      ]);
    });
    exportToCSV('product_performance_report', rows);
  };

  const handleExportSummaryCSV = () => {
    const headers = ['Metric', 'Value'];
    const rows = [
      headers,
      ['Report Generated At', new Date().toLocaleString('en-IN')],
      ['Total Orders', summary.totalOrders || 0],
      ['Total Revenue (INR)', summary.totalRevenue || 0],
      ['Average Order Value (INR)', summary.avgOrderValue || 0],
      ['Total Units Sold', totalUnitsSold],
      ['Unique Catalog Products Sold', productPerformance.length],
    ];
    statusBreakdown.forEach((s) => {
      rows.push([`Status: ${s._id} Orders Count`, s.count || 0]);
      rows.push([`Status: ${s._id} Total Value (INR)`, s.totalAmount || 0]);
    });
    exportToCSV('business_summary_report', rows);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <PageHeader
        title="Reports & Analytics"
        subtitle="Live metrics, financial summaries, sales trends, and product performance analysis."
        badgeIcon={FiPieChart}
        actions={
          <div className="flex items-center gap-2.5 relative">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchReportData(true)}
              disabled={loading || refreshing}
              title="Refresh Reports"
              className="p-2.5 bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:border-blue-500/40 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <FiRefreshCw className={`text-base ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Export Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/25 cursor-pointer active:scale-95"
              >
                <FiDownload className="text-base" />
                <span>Export Report</span>
              </button>

              {exportMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setExportMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white/40 dark:bg-slate-950/50 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 py-2 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Download CSV Datasets
                    </div>
                    <button
                      type="button"
                      onClick={handleExportOrdersCSV}
                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <FiShoppingBag className="text-sm text-blue-500" />
                      <span>Export All Orders (.csv)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportProductsCSV}
                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <FiBox className="text-sm text-emerald-500" />
                      <span>Export Product Sales (.csv)</span>
                    </button>
                    <div className="h-px bg-slate-200 dark:bg-white/10 my-1" />
                    <button
                      type="button"
                      onClick={handleExportSummaryCSV}
                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <FiPieChart className="text-sm text-purple-500" />
                      <span>Export Executive Summary (.csv)</span>
                    </button>
                  </div>
                </>
              )}
            </div>
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
            onClick={() => fetchReportData()}
            className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Date Range Selector Banner */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs">
        <div className="flex items-center gap-2">
          <FiCalendar className="text-blue-500 text-sm" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Reporting Window:</span>
          {selectedRange !== 'all' && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {rangeFilteredOrders.length} {rangeFilteredOrders.length === 1 ? 'order' : 'orders'} in period
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: '1w', label: '1W' },
            { id: '1m', label: '1M' },
            { id: '1y', label: '1Y' },
            { id: 'all', label: 'All' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleRangeChange(item.id)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                selectedRange === item.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Orders
            </span>
            <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <FiShoppingBag className="text-lg" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-9 w-20 rounded-lg" />
            ) : (
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {summary.totalOrders || 0}
              </div>
            )}
            <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <FiTrendingUp className="text-xs" />
              <span>Active purchase requests</span>
            </div>
          </div>
        </div>

        {/* Gross Revenue */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Gross Revenue
            </span>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <FiDollarSign className="text-lg" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-9 w-32 rounded-lg" />
            ) : (
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {formatCurrency(summary.totalRevenue || 0)}
              </div>
            )}
            <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Cumulative invoice value</span>
            </div>
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Avg. Order Value
            </span>
            <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <FiBarChart2 className="text-lg" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-9 w-28 rounded-lg" />
            ) : (
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {formatCurrency(summary.avgOrderValue || 0)}
              </div>
            )}
            <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Revenue per purchase order</span>
            </div>
          </div>
        </div>

        {/* Units Sold */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Units Dispatched/Sold
            </span>
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <FiBox className="text-lg" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-9 w-24 rounded-lg" />
            ) : (
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {totalUnitsSold.toLocaleString('en-IN')}
              </div>
            )}
            <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Across {productPerformance.length} catalog items</span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: Status Breakdown & Daily Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Breakdown Bar Chart Card */}
        <OrderStatusBreakdownChart
          statusBreakdown={statusBreakdown}
          totalRevenue={summary.totalRevenue}
          totalOrders={summary.totalOrders}
          selectedStatus={statusFilter}
          onSelectStatus={(status) => {
            setStatusFilter((prev) => (prev === status ? 'ALL' : status));
          }}
          isDark={isDark}
          loading={loading}
        />

        {/* Daily Trend Line Chart Card */}
        <DailyTrendChart
          dailyTrend={dailyTrend}
          totalRevenue={summary.totalRevenue}
          totalOrders={summary.totalOrders}
          isDark={isDark}
          loading={loading}
        />
      </div>

      {/* Product Performance Section */}
      <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl">
              <FiBox className="text-xl" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Product Sales Performance</span>
                {productPerformance.length > 0 && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    {productPerformance.length}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Units ordered, revenue generated, and contribution ranking per SKU
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Interactive Dual-Mode: "Table ⇄ Chart" View Toggle */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-inner">
              <button
                type="button"
                onClick={() => setProductViewMode('chart')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  productViewMode === 'chart'
                    ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
                title="View interactive graphical charts"
              >
                <FiBarChart2 className="text-xs" />
                <span>Chart</span>
              </button>
              <button
                type="button"
                onClick={() => setProductViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  productViewMode === 'table'
                    ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
                title="View detailed paginated data table"
              >
                <FiList className="text-xs" />
                <span>Table</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportProductsCSV}
              disabled={productPerformance.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl transition-all cursor-pointer self-start sm:self-auto disabled:opacity-50"
            >
              <FiDownload className="text-sm" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : productPerformance.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No product performance records found.
          </div>
        ) : productViewMode === 'chart' ? (
          <ProductPerformanceChart
            productPerformance={productPerformance}
            totalRevenue={summary.totalRevenue}
            totalUnitsSold={totalUnitsSold}
            isDark={isDark}
            loading={loading}
          />
        ) : (
          <>
            <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[1100px]">
              <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-200/60 dark:border-white/5 select-none">
                <tr>
                  <th className="py-3.5 px-4 w-14 text-center">Rank</th>
                  <th className="py-3.5 px-4 min-w-[240px]">Product Details</th>
                  <th className="py-3.5 px-4 text-center">Orders</th>
                  <th className="py-3.5 px-4 text-center">Units Sold</th>
                  <th className="py-3.5 px-4 text-right">Avg Unit Price</th>
                  <th className="py-3.5 px-4 text-right">Total Revenue</th>
                  <th className="py-3.5 px-4 text-center">Volume Share</th>
                  <th className="py-3.5 px-4 text-right w-44">Revenue Share</th>
                  <th className="py-3.5 px-4 text-center">Sales Velocity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                {paginatedProductPerformance.map((product, index) => {
                  const rev = Number(product.totalRevenue) || 0;
                  const totalRev = Number(summary.totalRevenue) || 1;
                  const sharePct = Math.min(100, ((rev / totalRev) * 100).toFixed(1));
                  const volPct = totalUnitsSold ? Math.min(100, (((product.totalQuantity || 0) / totalUnitsSold) * 100).toFixed(1)) : '0.0';
                  const avgPrice = product.totalQuantity ? Math.round(rev / product.totalQuantity) : 0;
                  const globalRank = indexOfFirstProduct + index + 1;

                  // Velocity status categorization
                  const isTopSeller = globalRank <= 3 || Number(sharePct) >= 20;
                  const isHighDemand = !isTopSeller && (Number(sharePct) >= 5 || (product.totalQuantity || 0) >= 10);
                  const isSteady = !isTopSeller && !isHighDemand && (product.totalQuantity || 0) >= 3;

                  return (
                    <tr
                      key={product._id || index}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Rank */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-xl text-xs font-black ${
                            globalRank === 1
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs'
                              : globalRank === 2
                              ? 'bg-slate-400/20 text-slate-700 dark:text-slate-300 border border-slate-400/30'
                              : globalRank === 3
                              ? 'bg-amber-700/20 text-amber-700 dark:text-amber-500 border border-amber-700/30'
                              : 'text-slate-400 font-bold bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/5'
                          }`}
                        >
                          #{globalRank}
                        </span>
                      </td>

                      {/* Product Name & SKU */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20 font-bold">
                            <FiBox className="text-base" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                              {product.productName}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md font-semibold">
                                {product.sku}
                              </span>
                              <CopyButton text={product.sku} size={10} />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Orders Count */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl text-xs border border-slate-200/60 dark:border-white/5">
                          <FiShoppingBag className="text-blue-500 text-xs" />
                          <span>{product.ordersCount || 1} PO{product.ordersCount === 1 ? '' : 's'}</span>
                        </span>
                      </td>

                      {/* Units Sold */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1.5 font-extrabold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl text-xs border border-slate-200/60 dark:border-white/5">
                          <FiBox className="text-purple-500 text-xs" />
                          <span>{(product.totalQuantity || 0).toLocaleString('en-IN')}</span>
                        </span>
                      </td>

                      {/* Avg Unit Price */}
                      <td className="py-4 px-4 text-center">
                        <div className="font-bold text-slate-900 dark:text-white font-mono text-xs">
                          {formatCurrency(avgPrice)}
                        </div>
                        <div className="text-[10px] text-slate-400">per unit</div>
                      </td>

                      {/* Total Revenue */}
                      <td className="py-4 px-4 text-center">
                        <div className="font-extrabold text-slate-900 dark:text-white font-mono text-xs">
                          {formatCurrency(rev)}
                        </div>
                      </td>

                      {/* Volume Share % */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-slate-100 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${volPct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400 w-10 text-right">
                            {volPct}%
                          </span>
                        </div>
                      </td>

                      {/* Revenue Share % */}
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2.5">
                          <div className="w-20 bg-slate-100 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full transition-all duration-500"
                              style={{ width: `${sharePct}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-10 text-right font-mono">
                            {sharePct}%
                          </span>
                        </div>
                      </td>

                      {/* Velocity / Status Badge */}
                      <td className="py-4 px-4 text-center">
                        {isTopSeller ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                            <FiTrendingUp className="text-[10px]" />
                            <span>Top Seller</span>
                          </span>
                        ) : isHighDemand ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap">
                            <FiCheckCircle className="text-[10px]" />
                            <span>High Demand</span>
                          </span>
                        ) : isSteady ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 whitespace-nowrap">
                            <FiBox className="text-[10px]" />
                            <span>Steady</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 whitespace-nowrap">
                            <FiClock className="text-[10px]" />
                            <span>Low Volume</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Product Performance Attached Pagination Bar */}
          {productPerformance.length > 0 && (
            <div className="p-4 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.02] text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-3">
                <span>
                  Showing <strong className="text-slate-800 dark:text-slate-200">{indexOfFirstProduct + 1}</strong> to{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {Math.min(indexOfLastProduct, productPerformance.length)}
                  </strong>{' '}
                  of <strong className="text-slate-800 dark:text-slate-200">{productPerformance.length}</strong> products
                </span>
              </div>

              {totalProductPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                    disabled={productPage === 1}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer shadow-xs flex items-center gap-1"
                  >
                    <FiChevronLeft size={13} />
                    <span>Prev</span>
                  </button>

                  {Array.from({ length: totalProductPages }, (_, i) => i + 1).map((pg) => {
                    if (
                      pg === 1 ||
                      pg === totalProductPages ||
                      (pg >= productPage - 1 && pg <= productPage + 1)
                    ) {
                      return (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setProductPage(pg)}
                          className={`w-7 h-7 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            productPage === pg
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                          }`}
                        >
                          {pg}
                        </button>
                      );
                    }
                    if (pg === productPage - 2 || pg === productPage + 2) {
                      return <span key={pg} className="px-1 text-slate-400">...</span>;
                    }
                    return null;
                  })}

                  <button
                    type="button"
                    onClick={() => setProductPage((p) => Math.min(totalProductPages, p + 1))}
                    disabled={productPage === totalProductPages}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer shadow-xs flex items-center gap-1"
                  >
                    <span>Next</span>
                    <FiChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>

      {/* Orders Ledger Section */}
      <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200/80 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Orders Audit Ledger</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                {filteredOrders.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verified order transactions, customer company mapping, and fulfillment details
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PO, Company, City..."
                className="w-full pl-9 pr-4 py-2 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <FiX size={12} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-white/5 p-1 rounded-xl border border-slate-200/80 dark:border-white/10 w-full sm:w-auto">
              {['ALL', 'PENDING', 'APPROVED', 'DISPATCHED', 'REJECTED'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    statusFilter === status
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <FiShoppingBag className="text-3xl mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">No purchase orders found</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your search criteria or filter tags.'
                : 'No orders have been recorded in the system yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[1100px]">
              <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-200/60 dark:border-white/5">
                <tr>
                  <th className="py-3.5 px-4 font-mono">PO Number</th>
                  <th className="py-3.5 px-4">Trading Company</th>
                  <th className="py-3.5 px-4">Purchasing Firm</th>
                  <th className="py-3.5 px-4">Sales Executive</th>
                  <th className="py-3.5 px-4 text-center">Items</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Email</th>
                  <th className="py-3.5 px-4 text-right">Total Amount</th>
                  <th className="py-3.5 px-4">Date Created</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                {filteredOrders.map((order) => {
                  const badge = getStatusBadge(order.status);
                  const StatusIcon = badge.icon;
                  const emailBadge = getEmailStatusBadge(order.emailStatus);
                  const EmailBadgeIcon = emailBadge.icon;
                  const emailRecipientsCount = Array.isArray(order.emailStatus?.recipients)
                    ? order.emailStatus.recipients.length
                    : 0;
                  const totalUnits = (order.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0);
                  const execName = `${order.salesExecutiveId?.firstName || ''} ${
                    order.salesExecutiveId?.lastName || ''
                  }`.trim() || 'Unassigned';

                  return (
                    <tr
                      key={order._id}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* PO Number */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white text-xs">
                          <span>{order.poNumber || 'N/A'}</span>
                          {order.poNumber && <CopyButton text={order.poNumber} />}
                        </div>
                      </td>

                      {/* Trading Company */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white text-xs">
                            {order.companyId?.name || 'Unknown Company'}
                          </span>
                          {order.companyId?.code && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shrink-0">
                              {order.companyId.code}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Purchasing Firm */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white text-xs">
                            {order.firmId?.firmName || 'N/A'}
                          </span>
                          {order.firmId?.firmCode && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 shrink-0">
                              {order.firmId.firmCode}
                            </span>
                          )}
                        </div>
                        {order.firmId?.city && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <FiMapPin className="text-[10px]" />
                            <span>{order.firmId.city}</span>
                          </div>
                        )}
                      </td>

                      {/* Sales Executive */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                            {execName}
                          </span>
                          {order.salesExecutiveId?.employeeCode && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                              {order.salesExecutiveId.employeeCode}
                            </span>
                          )}
                        </div>
                        {order.salesExecutiveId?.email && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {order.salesExecutiveId.email}
                          </div>
                        )}
                      </td>

                      {/* Items */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/5 shrink-0">
                          <FiBox className="text-blue-500 text-xs" />
                          <span>
                            {(order.items || []).length} SKU{((order.items || []).length !== 1 ? 's' : '')} ({totalUnits} pcs)
                          </span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border shrink-0 ${badge.bg}`}
                        >
                          <StatusIcon className="text-xs" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Email Status */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border shrink-0 ${emailBadge.className}`}
                          title={
                            order.emailStatus?.isSent
                              ? `Email Sent (${emailRecipientsCount} recipients)`
                              : `Email: ${emailBadge.label}`
                          }
                        >
                          <EmailBadgeIcon className="text-xs" />
                          <span>{emailBadge.label}</span>
                          {emailRecipientsCount > 0 && (
                            <span className="font-mono text-[10px] opacity-80">
                              ({emailRecipientsCount})
                            </span>
                          )}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="py-4 px-4 text-right font-mono">
                        <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                          {formatCurrency(order.totalAmount || order.subtotal || 0)}
                        </div>
                        {order.subtotal !== undefined &&
                          order.totalAmount !== undefined &&
                          Number(order.subtotal) !== Number(order.totalAmount) && (
                            <div className="text-[10px] text-slate-400">
                              Subtotal: {formatCurrency(order.subtotal)}
                            </div>
                          )}
                      </td>

                      {/* Date Created */}
                      <td className="py-4 px-4 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <FiCalendar className="text-[11px] text-slate-400" />
                          <span>{formatDate(order.createdAt)}</span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-all cursor-pointer active:scale-95"
                        >
                          <FiEye className="text-xs" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Slide-Over Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[10000] overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 dark:bg-slate-950/60 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
            onClick={() => setSelectedOrder(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-6 md:pl-10 pointer-events-none">
            <div className="w-screen max-w-full sm:max-w-2xl md:max-w-3xl bg-white/40 dark:bg-slate-950/25 border-l border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col h-full pointer-events-auto animate-in slide-in-from-right duration-300 z-10">
              {/* Sticky Header with Stepper */}
              <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md gap-2 sm:gap-4">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div className="p-2 sm:p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl shrink-0">
                    <FiFileText className="text-lg sm:text-xl" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono truncate">
                        {selectedOrder.poNumber}
                      </h3>
                      <CopyButton text={selectedOrder.poNumber} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      Created on {formatDateTime(selectedOrder.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {/* Stepper Navigation */}
                  {filteredOrders.length > 1 && (
                    <div className="flex items-center bg-slate-100 dark:bg-white/5 rounded-xl p-0.5 border border-slate-200/60 dark:border-white/10">
                      <button
                        type="button"
                        onClick={handlePrevOrder}
                        disabled={!hasPrevOrder}
                        title="Previous order (Left arrow)"
                        className="p-1 sm:p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-white/10 transition-all cursor-pointer"
                      >
                        <FiChevronLeft size={15} />
                      </button>
                      <span className="text-[10px] sm:text-[11px] font-mono px-1.5 sm:px-2 text-slate-500 font-semibold select-none">
                        {selectedOrderIndex >= 0 ? `${selectedOrderIndex + 1} of ${filteredOrders.length}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={handleNextOrder}
                        disabled={!hasNextOrder}
                        title="Next order (Right arrow)"
                        className="p-1 sm:p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-white/10 transition-all cursor-pointer"
                      >
                        <FiChevronRight size={15} />
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                    title="Close (Esc)"
                  >
                    <FiX className="text-lg" />
                  </button>
                </div>
              </div>

              {/* Scrollable Drawer Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 custom-scrollbar">
                {/* Status and Entity Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-white/5">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Company & Client
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {selectedOrder.companyId?.name || 'N/A'}
                      </span>
                      {selectedOrder.companyId?.code && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-200/60 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                          {selectedOrder.companyId.code}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {selectedOrder.firmId?.firmName || 'Retailer Firm'}
                      </span>
                      {selectedOrder.firmId?.firmCode && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                          {selectedOrder.firmId.firmCode}
                        </span>
                      )}
                      {selectedOrder.firmId?.city && (
                        <span>• {selectedOrder.firmId.city}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Sales Executive
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {`${selectedOrder.salesExecutiveId?.firstName || ''} ${
                          selectedOrder.salesExecutiveId?.lastName || ''
                        }`.trim() || 'N/A'}
                      </span>
                      {selectedOrder.salesExecutiveId?.employeeCode && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          {selectedOrder.salesExecutiveId.employeeCode}
                        </span>
                      )}
                    </div>
                    {selectedOrder.salesExecutiveId?.email && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedOrder.salesExecutiveId.email}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {(() => {
                        const badge = getStatusBadge(selectedOrder.status);
                        const BadgeIcon = badge.icon;
                        return (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${badge.bg}`}>
                            <BadgeIcon className="text-[10px]" />
                            <span>{badge.label}</span>
                          </span>
                        );
                      })()}
                      {selectedOrder.approvedAt && (
                        <span className="text-[10px] font-mono text-slate-400">
                          Approved: {formatDateTime(selectedOrder.approvedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Email Dispatch Details Card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/10">
                  <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-200/60 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm border border-blue-500/20">
                        <FiMail />
                      </div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                        Notification Email Delivery
                      </span>
                    </div>
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
                          ? formatDateTime(selectedOrder.emailStatus.lastSentAt)
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

                {/* Order Items Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Itemized Bill ({selectedOrder.items?.length || 0} products)
                  </h4>
                  <div className="border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-200/60 dark:border-white/5">
                        <tr>
                          <th className="py-2.5 px-3">Item / SKU</th>
                          <th className="py-2.5 px-3 text-center">Qty</th>
                          <th className="py-2.5 px-3 text-right">Unit Price</th>
                          <th className="py-2.5 px-3 text-right">Total Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                        {(selectedOrder.items || []).map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900 dark:text-white">
                                {item.productNameSnapshot || 'Product Item'}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400">
                                {item.skuSnapshot}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                              {item.quantity}
                            </td>
                            <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300">
                              {formatCurrency(item.unitPrice)}
                            </td>
                            <td className="py-3 px-3 text-right font-extrabold text-slate-900 dark:text-white">
                              {formatCurrency(item.totalPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Notes & Special Instructions */}
                {selectedOrder.notes && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-700 dark:text-amber-400">
                    <span className="font-bold">Order Note: </span>
                    {selectedOrder.notes}
                  </div>
                )}

                {/* Total Summary */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-white/5 space-y-2 text-xs">
                  {selectedOrder.subtotal !== undefined &&
                    selectedOrder.totalAmount !== undefined &&
                    Number(selectedOrder.subtotal) !== Number(selectedOrder.totalAmount) && (
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Subtotal</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                          {formatCurrency(selectedOrder.subtotal)}
                        </span>
                      </div>
                    )}
                  <div className="flex justify-between text-slate-900 dark:text-white font-extrabold text-sm pt-2 border-t border-slate-200 dark:border-white/10">
                    <span>Grand Total</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">
                      {formatCurrency(selectedOrder.totalAmount || selectedOrder.subtotal || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sticky Drawer Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md">
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300">Esc</kbd> to exit or <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300">→</kbd> to step
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-bold rounded-xl transition-all cursor-pointer ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
