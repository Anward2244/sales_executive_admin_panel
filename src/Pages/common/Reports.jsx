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
} from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Skeleton from '@/components/ui/Skeleton';
import CopyButton from '@/components/ui/CopyButton';
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

const Reports = () => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters & State
  const [selectedRange, setSelectedRange] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Fetch report data
  const fetchReportData = useCallback(async (isSilent = false) => {
    if (isSilent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await getReportsApi();
      const resData = response?.data?.data || response?.data || {};
      setReportData(resData);
    } catch (err) {
      console.error('Failed to load reports data:', err);
      setError(err.response?.data?.message || 'Failed to load report analytics. Please check your network or try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Derived summaries
  const summary = reportData?.summary || {
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
  };

  const statusBreakdown = useMemo(() => {
    return Array.isArray(reportData?.statusBreakdown) ? reportData.statusBreakdown : [];
  }, [reportData]);

  const dailyTrend = useMemo(() => {
    return Array.isArray(reportData?.dailyTrend) ? reportData.dailyTrend : [];
  }, [reportData]);

  const productPerformance = useMemo(() => {
    return Array.isArray(reportData?.productPerformance) ? reportData.productPerformance : [];
  }, [reportData]);

  const orders = useMemo(() => {
    return Array.isArray(reportData?.orders) ? reportData.orders : [];
  }, [reportData]);

  // Total quantity sold across all products
  const totalUnitsSold = useMemo(() => {
    return productPerformance.reduce((acc, p) => acc + (Number(p.totalQuantity) || 0), 0);
  }, [productPerformance]);

  // Max daily revenue for relative trend visualization
  const maxDailyRevenue = useMemo(() => {
    if (!dailyTrend.length) return 1;
    return Math.max(...dailyTrend.map((d) => Number(d.totalAmount) || 0), 1);
  }, [dailyTrend]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === 'ALL' || String(order.status || '').toUpperCase() === statusFilter;

      if (!matchesStatus) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const poNum = String(order.poNumber || '').toLowerCase();
      const compName = String(order.companyId?.name || '').toLowerCase();
      const compCode = String(order.companyId?.code || '').toLowerCase();
      const firmName = String(order.firmId?.firmName || '').toLowerCase();
      const firmCity = String(order.firmId?.city || '').toLowerCase();
      const execName = `${order.salesExecutiveId?.firstName || ''} ${order.salesExecutiveId?.lastName || ''}`.toLowerCase();
      const execCode = String(order.salesExecutiveId?.employeeCode || '').toLowerCase();

      return (
        poNum.includes(q) ||
        compName.includes(q) ||
        compCode.includes(q) ||
        firmName.includes(q) ||
        firmCity.includes(q) ||
        execName.includes(q) ||
        execCode.includes(q)
      );
    });
  }, [orders, searchQuery, statusFilter]);

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
    if (!orders.length) return;
    const headers = [
      'PO Number',
      'Status',
      'Company Name',
      'Company Code',
      'Firm Name',
      'City',
      'Sales Executive',
      'Employee Code',
      'Items Count',
      'Subtotal (INR)',
      'Total Amount (INR)',
      'Notes',
      'Order Date',
    ];
    const rows = [headers];
    orders.forEach((o) => {
      const itemsCount = (o.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0);
      const salesRep = `${o.salesExecutiveId?.firstName || ''} ${o.salesExecutiveId?.lastName || ''}`.trim();
      rows.push([
        o.poNumber || '',
        o.status || '',
        o.companyId?.name || '',
        o.companyId?.code || '',
        o.firmId?.firmName || '',
        o.firmId?.city || '',
        salesRep,
        o.salesExecutiveId?.employeeCode || '',
        itemsCount,
        o.subtotal || 0,
        o.totalAmount || 0,
        o.notes || '',
        o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN') : '',
      ]);
    });
    exportToCSV('orders_report', rows);
  };

  const handleExportProductsCSV = () => {
    if (!productPerformance.length) return;
    const headers = ['Product Name', 'SKU', 'Units Sold', 'Total Revenue (INR)', 'Contribution (%)'];
    const rows = [headers];
    const totalRev = Number(summary.totalRevenue) || 1;
    productPerformance.forEach((p) => {
      const share = (((Number(p.totalRevenue) || 0) / totalRev) * 100).toFixed(2);
      rows.push([p.productName || '', p.sku || '', p.totalQuantity || 0, p.totalRevenue || 0, `${share}%`]);
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
        badgeText="Financial BI"
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
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'all', label: 'All Recorded Data' },
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'Last 7 Days' },
            { id: 'month', label: 'This Month' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedRange(item.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
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
        {/* Status Breakdown Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <FiLayers className="text-lg" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Order Status Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Distribution of order volume and financial commitments
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-600 dark:text-slate-300">
                {statusBreakdown.length} Stages
              </span>
            </div>

            {loading ? (
              <div className="space-y-4 my-4">
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
            ) : statusBreakdown.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No order statuses recorded yet.
              </div>
            ) : (
              <div className="space-y-3.5 mt-4">
                {statusBreakdown.map((item, idx) => {
                  const badge = getStatusBadge(item._id);
                  const Icon = badge.icon;
                  const totalRev = Number(summary.totalRevenue) || 1;
                  const percent = Math.min(
                    100,
                    Math.round(((Number(item.totalAmount) || 0) / totalRev) * 100)
                  );

                  return (
                    <div
                      key={item._id || idx}
                      className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${badge.bg}`}
                          >
                            <Icon className="text-xs" />
                            <span>{item._id}</span>
                          </span>
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {item.count} {item.count === 1 ? 'order' : 'orders'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {formatCurrency(item.totalAmount || 0)}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400 ml-1.5">
                            ({percent}%)
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-slate-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${badge.barColor} transition-all duration-500 rounded-full`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Aggregated from backend pipeline</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Total: {formatCurrency(summary.totalRevenue || 0)}
            </span>
          </div>
        </div>

        {/* Daily Trend Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FiTrendingUp className="text-lg" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Daily Velocity & Trend
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Day-by-day order generation and intake amounts
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-600 dark:text-slate-300">
                {dailyTrend.length} Days
              </span>
            </div>

            {loading ? (
              <div className="space-y-4 my-4">
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
            ) : dailyTrend.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No daily trends recorded yet.
              </div>
            ) : (
              <div className="space-y-3.5 mt-4">
                {dailyTrend.map((trend, idx) => {
                  const rev = Number(trend.totalAmount) || 0;
                  const relativePct = Math.min(100, Math.round((rev / maxDailyRevenue) * 100));

                  return (
                    <div
                      key={trend._id || idx}
                      className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FiCalendar className="text-xs text-slate-400" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {formatDate(trend._id)}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            {trend.orderCount} {trend.orderCount === 1 ? 'order' : 'orders'}
                          </span>
                        </div>
                        <div className="text-right font-extrabold text-sm text-slate-900 dark:text-white">
                          {formatCurrency(rev)}
                        </div>
                      </div>

                      {/* Bar indicator */}
                      <div className="w-full bg-slate-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                          style={{ width: `${relativePct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Continuous tracking</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Peak Day: {formatCurrency(maxDailyRevenue)}
            </span>
          </div>
        </div>
      </div>

      {/* Product Performance Section */}
      <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl">
              <FiBox className="text-xl" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Product Sales Performance
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Units ordered, revenue generated, and contribution ranking per SKU
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportProductsCSV}
            disabled={productPerformance.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl transition-all cursor-pointer self-start sm:self-auto disabled:opacity-50"
          >
            <FiDownload className="text-sm" />
            <span>Export Product CSV</span>
          </button>
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-200/60 dark:border-white/5">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Rank</th>
                  <th className="py-3 px-4">Product Name & Identifier</th>
                  <th className="py-3 px-4 text-center">Units Sold</th>
                  <th className="py-3 px-4 text-right">Revenue Generated</th>
                  <th className="py-3 px-4 w-48 text-right">Revenue Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                {productPerformance.map((product, index) => {
                  const rev = Number(product.totalRevenue) || 0;
                  const totalRev = Number(summary.totalRevenue) || 1;
                  const sharePct = Math.min(100, ((rev / totalRev) * 100).toFixed(1));

                  return (
                    <tr
                      key={product._id || index}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                            index === 0
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : index === 1
                              ? 'bg-slate-400/20 text-slate-700 dark:text-slate-300'
                              : index === 2
                              ? 'bg-amber-700/20 text-amber-700 dark:text-amber-500'
                              : 'text-slate-400 font-medium'
                          }`}
                        >
                          #{index + 1}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {product.productName}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                            {product.sku}
                          </span>
                          <CopyButton text={product.sku} />
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl text-xs">
                          <FiBox className="text-slate-400 text-xs" />
                          {(product.totalQuantity || 0).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {formatCurrency(rev)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {product.totalQuantity ? `₹${Math.round(rev / product.totalQuantity)}/unit avg` : ''}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2.5">
                          <div className="w-24 bg-slate-100 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full transition-all duration-500"
                              style={{ width: `${sharePct}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-10 text-right">
                            {sharePct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-200/60 dark:border-white/5">
                <tr>
                  <th className="py-3 px-4">PO Number & Date</th>
                  <th className="py-3 px-4">Client Company & Firm</th>
                  <th className="py-3 px-4">Sales Executive</th>
                  <th className="py-3 px-4 text-center">Items Ordered</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                {filteredOrders.map((order) => {
                  const badge = getStatusBadge(order.status);
                  const StatusIcon = badge.icon;
                  const totalUnits = (order.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0);
                  const execName = `${order.salesExecutiveId?.firstName || ''} ${
                    order.salesExecutiveId?.lastName || ''
                  }`.trim() || 'Unassigned';

                  return (
                    <tr
                      key={order._id}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* PO Number & Date */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white font-mono text-xs">
                            {order.poNumber || 'N/A'}
                          </span>
                          {order.poNumber && <CopyButton text={order.poNumber} />}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <FiCalendar className="text-[10px]" />
                          <span>{formatDate(order.createdAt)}</span>
                        </div>
                      </td>

                      {/* Company & Firm */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900 dark:text-white text-xs">
                          {order.companyId?.name || 'Unknown Company'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {order.firmId?.firmName || 'N/A'}
                          </span>
                          {order.firmId?.city && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-0.5 text-slate-400">
                                <FiMapPin className="text-[10px]" />
                                {order.firmId.city}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Sales Executive */}
                      <td className="py-4 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                          <FiUser className="text-slate-400 text-xs" />
                          <span>{execName}</span>
                        </div>
                        {order.salesExecutiveId?.employeeCode && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {order.salesExecutiveId.employeeCode}
                          </div>
                        )}
                      </td>

                      {/* Items */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          <FiBox className="text-slate-400 text-xs" />
                          <span>
                            {(order.items || []).length} SKUs ({totalUnits} pcs)
                          </span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${badge.bg}`}
                        >
                          <StatusIcon className="text-xs" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="py-4 px-4 text-right">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {formatCurrency(order.totalAmount || order.subtotal || 0)}
                        </div>
                        <div className="text-[11px] text-slate-400">GST Inclusive</div>
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

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 dark:bg-slate-950/50 backdrop-blur-lg animate-in fade-in duration-200">
          <div className="bg-white/20 dark:bg-slate-950/25 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                  <FiFileText className="text-xl" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                      {selectedOrder.poNumber}
                    </h3>
                    <CopyButton text={selectedOrder.poNumber} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Created on {formatDateTime(selectedOrder.createdAt)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Status and Entity Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-white/5">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Company & Client
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
                    {selectedOrder.companyId?.name || 'N/A'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedOrder.firmId?.firmName} • {selectedOrder.firmId?.city}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Sales Executive
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
                    {`${selectedOrder.salesExecutiveId?.firstName || ''} ${
                      selectedOrder.salesExecutiveId?.lastName || ''
                    }`.trim() || 'N/A'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedOrder.salesExecutiveId?.email}
                  </div>
                </div>
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
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatCurrency(selectedOrder.subtotal || selectedOrder.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-900 dark:text-white font-extrabold text-sm pt-2 border-t border-slate-200 dark:border-white/10">
                  <span>Grand Total</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {formatCurrency(selectedOrder.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
