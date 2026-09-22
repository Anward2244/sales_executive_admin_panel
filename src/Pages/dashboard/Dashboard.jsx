import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  FiTrendingUp,
  FiShoppingBag,
  FiUsers,
  FiBriefcase,
  FiLayers,
  FiBox,
  FiClock,
  FiCheckCircle,
  FiTruck,
  FiXCircle,
  FiAward,
  FiPackage,
  FiRefreshCcw,
  FiArrowUpRight,
  FiCalendar,
  FiEye,
  FiX,
  FiFileText,
  FiMapPin,
  FiUser,
  FiTag,
  FiAlertCircle,
  FiLoader,
  FiPieChart,
  FiActivity,
  FiFilter
} from 'react-icons/fi';
import VisxTrendChart from '@/components/dashboard/VisxTrendChart';
import VisxPipelineDonut from '@/components/dashboard/VisxPipelineDonut';
import { useTheme } from '@/Context/ThemeContext';
import { getDashboardMetricsApi, getReportsApi } from '@/api/axios';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import CopyButton from '@/components/ui/CopyButton';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';
import { BiRupee } from 'react-icons/bi';

const Dashboard = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [dashboardData, setDashboardData] = useState(null);
  const [reportsData, setReportsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Chart 1 controls - Mixed Chart series toggles & range
  const [visibleSeries, setVisibleSeries] = useState({ revenue: true, orders: true });
  const [trendRange, setTrendRange] = useState('30d'); // '7d' | '30d' | 'all'

  const toggleSeries = (key) => {
    setVisibleSeries((prev) => {
      // Keep at least one series visible
      if (prev[key] && Object.values(prev).filter(Boolean).length <= 1) {
        return prev;
      }
      return { ...prev, [key]: !prev[key] };
    });
  };

  // Fetch dashboard and analytics reports data
  const fetchDashboardMetrics = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [dashRes, repRes] = await Promise.allSettled([
        getDashboardMetricsApi(),
        getReportsApi({ limit: 30 })
      ]);

      if (dashRes.status === 'fulfilled') {
        const resData = dashRes.value?.data?.data || dashRes.value?.data || {};
        setDashboardData(resData);
      } else {
        throw dashRes.reason;
      }

      if (repRes.status === 'fulfilled') {
        const repData = repRes.value?.data?.data || repRes.value?.data || {};
        setReportsData(repData);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard metrics. Please check network connectivity.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardMetrics();

    // Auto-refresh every 30 seconds
    const intervalId = setInterval(() => {
      fetchDashboardMetrics(true);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [fetchDashboardMetrics]);

  // Derived Summary & Active Entities Metrics
  const summary = dashboardData?.summary || {};
  const activeEntities = summary.activeEntities || {};
  const totalOrders = summary.totalOrders ?? 0;
  const totalOrderValue = summary.totalOrderValue ?? 0;

  const totalUsers = activeEntities.users ?? 0;
  const totalCompanies = activeEntities.companies ?? 0;
  const totalFirms = activeEntities.firms ?? 0;
  const totalProducts = activeEntities.products ?? 0;

  // Status Breakdown
  const statusBreakdown = summary.statusBreakdown || {
    PENDING: { count: 0, value: 0 },
    APPROVED: { count: 0, value: 0 },
    DISPATCHED: { count: 0, value: 0 },
    REJECTED: { count: 0, value: 0 }
  };

  const totalStatusCount =
    (statusBreakdown.PENDING?.count || 0) +
    (statusBreakdown.APPROVED?.count || 0) +
    (statusBreakdown.DISPATCHED?.count || 0) +
    (statusBreakdown.REJECTED?.count || 0) || totalOrders || 1;

  // Company Breakdown & Top Sales Executives
  const companyBreakdown = Array.isArray(dashboardData?.companyBreakdown)
    ? dashboardData.companyBreakdown
    : [];

  const topSalesExecutives = Array.isArray(dashboardData?.topSalesExecutives)
    ? dashboardData.topSalesExecutives
    : [];

  const recentOrders = Array.isArray(dashboardData?.recentOrders)
    ? dashboardData.recentOrders
    : [];

  // Process daily trend data for Chart 1
  const processedTrendData = useMemo(() => {
    let rawTrend = [];
    if (Array.isArray(reportsData?.dailyTrend) && reportsData.dailyTrend.length > 0) {
      rawTrend = reportsData.dailyTrend.map((d) => ({
        date: d._id || d.date,
        revenue: Number(d.totalAmount) || 0,
        orders: Number(d.orderCount) || 0
      }));
    } else if (Array.isArray(recentOrders) && recentOrders.length > 0) {
      const dateMap = {};
      recentOrders.forEach((o) => {
        if (!o.createdAt) return;
        const d = new Date(o.createdAt).toISOString().split('T')[0];
        if (!dateMap[d]) {
          dateMap[d] = { date: d, revenue: 0, orders: 0 };
        }
        dateMap[d].revenue += Number(o.totalAmount || o.totalValue || 0);
        dateMap[d].orders += 1;
      });
      rawTrend = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
    }

    if (rawTrend.length === 0) {
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        rawTrend.push({
          date: d.toISOString().split('T')[0],
          revenue: 0,
          orders: 0
        });
      }
    }

    if (trendRange === '7d') {
      return rawTrend.slice(-7);
    } else if (trendRange === '30d') {
      return rawTrend.slice(-30);
    }
    return rawTrend;
  }, [reportsData, recentOrders, trendRange]);

  // Aggregate metrics for Chart 1 stat footer
  const trendSummary = useMemo(() => {
    const totalRev = processedTrendData.reduce((acc, cur) => acc + cur.revenue, 0);
    const totalOrd = processedTrendData.reduce((acc, cur) => acc + cur.orders, 0);
    const peakRev = Math.max(...processedTrendData.map((d) => d.revenue), 0);
    const avgRev = processedTrendData.length ? Math.round(totalRev / processedTrendData.length) : 0;
    const avgOrderValue = totalOrd > 0 ? Math.round(totalRev / totalOrd) : 0;
    return { totalRev, totalOrd, peakRev, avgRev, avgOrderValue };
  }, [processedTrendData]);


  // Top Metric Cards Config
  const metricCards = [
    {
      title: 'Total Revenue',
      value: `₹${totalOrderValue.toLocaleString('en-IN')}`,
      icon: BiRupee,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/15',
      hoverBorder: 'hover:border-emerald-500/30',
      path: '/purchase-orders',
      subtitle: 'Consolidated order booking value'
    },
    {
      title: 'Total Orders',
      value: totalOrders,
      icon: FiShoppingBag,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/15',
      hoverBorder: 'hover:border-blue-500/30',
      path: '/purchase-orders',
      subtitle: 'Issued purchase orders'
    },
    {
      title: 'Active Users',
      value: totalUsers,
      icon: FiUsers,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/15',
      hoverBorder: 'hover:border-amber-500/30',
      path: '/users',
      subtitle: 'Registered staff & agents'
    },
    {
      title: 'Partner Companies',
      value: totalCompanies,
      icon: FiBriefcase,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-500/15',
      hoverBorder: 'hover:border-indigo-500/30',
      path: '/companies',
      subtitle: 'Parent trading companies'
    },
    {
      title: 'Associated Firms',
      value: totalFirms,
      icon: FiLayers,
      color: 'text-cyan-600 dark:text-cyan-400',
      bg: 'bg-cyan-500/15',
      hoverBorder: 'hover:border-cyan-500/30',
      path: '/firms',
      subtitle: 'Retailers & wholesale buyers'
    },
    {
      title: 'Active Products',
      value: totalProducts,
      icon: FiBox,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-500/15',
      hoverBorder: 'hover:border-purple-500/30',
      path: '/products',
      subtitle: 'Live catalog items'
    }
  ];

  // Helper for Status Badge styling
  const getStatusBadge = (status) => {
    const s = (status || 'PENDING').toUpperCase();
    switch (s) {
      case 'APPROVED':
        return {
          label: 'Approved',
          icon: FiCheckCircle,
          className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
        };
      case 'DISPATCHED':
        return {
          label: 'Dispatched',
          icon: FiTruck,
          className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
        };
      case 'REJECTED':
        return {
          label: 'Rejected',
          icon: FiXCircle,
          className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
        };
      case 'PENDING':
      default:
        return {
          label: 'Pending',
          icon: FiClock,
          className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
        };
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <PageHeader
        title="Dashboard Overview"
        subtitle="Real-time performance analytics, order lifecycle pipeline, partner performance, and recent procurement stream."
        badgeText="Live Sync"
        badgeIcon={FiTrendingUp}
        actions={
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{formatDateDDMMYYYY(new Date())}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchDashboardMetrics(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Refresh Metrics"
            >
              <FiRefreshCcw className={`text-sm ${refreshing ? 'animate-spin text-blue-500' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        }
      />

      {/* Error Alert if API failed */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-200 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <FiAlertCircle className="text-xl text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboardMetrics(true)}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. Core KPIs & Active Entities Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {metricCards.map((card, idx) => (
          <div
            key={idx}
            onClick={() => {
              if (card.path) navigate(card.path);
            }}
            className={`bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs transition-all flex flex-col justify-between ${
              card.path ? 'cursor-pointer hover:-translate-y-1 hover:shadow-md hover:border-blue-500/30' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${card.bg} ${card.color}`}>
                <card.icon />
              </div>
              {card.path && (
                <FiArrowUpRight className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate" title={card.title}>
                {card.title}
              </p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight truncate">
                {loading ? <span className="animate-pulse opacity-50">...</span> : card.value}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">
                {card.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Order Lifecycle & Status Breakdown Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <FiShoppingBag className="text-blue-500" /> Order Lifecycle & Pipeline Status
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Current breakdown of orders, fulfillment pipeline, and monetary commitments.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/purchase-orders')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer self-start sm:self-auto"
          >
            <span>Manage Orders</span>
            <FiArrowUpRight size={13} />
          </button>
        </div>

        {/* 4 Status Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* PENDING */}
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-amber-500/20 dark:border-amber-500/20 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                <FiClock className="text-xs" /> Pending Approval
              </span>
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                {totalStatusCount > 0
                  ? `${Math.round(((statusBreakdown.PENDING?.count || 0) / totalStatusCount) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {statusBreakdown.PENDING?.count || 0} <span className="text-xs font-normal text-slate-400">orders</span>
            </p>
            <p className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 mt-1">
              ₹{(statusBreakdown.PENDING?.value || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Awaiting managerial review</p>
          </div>

          {/* APPROVED */}
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-blue-500/20 dark:border-blue-500/20 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                <FiCheckCircle className="text-xs" /> Approved
              </span>
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                {totalStatusCount > 0
                  ? `${Math.round(((statusBreakdown.APPROVED?.count || 0) / totalStatusCount) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {statusBreakdown.APPROVED?.count || 0} <span className="text-xs font-normal text-slate-400">orders</span>
            </p>
            <p className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mt-1">
              ₹{(statusBreakdown.APPROVED?.value || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Ready for fulfillment & dispatch</p>
          </div>

          {/* DISPATCHED */}
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-emerald-500/20 dark:border-emerald-500/20 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <FiTruck className="text-xs" /> Dispatched
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {totalStatusCount > 0
                  ? `${Math.round(((statusBreakdown.DISPATCHED?.count || 0) / totalStatusCount) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {statusBreakdown.DISPATCHED?.count || 0} <span className="text-xs font-normal text-slate-400">orders</span>
            </p>
            <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              ₹{(statusBreakdown.DISPATCHED?.value || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">In transit to destination firms</p>
          </div>

          {/* REJECTED */}
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-rose-500/20 dark:border-rose-500/20 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                <FiXCircle className="text-xs" /> Rejected
              </span>
              <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                {totalStatusCount > 0
                  ? `${Math.round(((statusBreakdown.REJECTED?.count || 0) / totalStatusCount) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {statusBreakdown.REJECTED?.count || 0} <span className="text-xs font-normal text-slate-400">orders</span>
            </p>
            <p className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 mt-1">
              ₹{(statusBreakdown.REJECTED?.value || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Cancelled or declined requests</p>
          </div>
        </div>

        {/* Visual Multi-Segment Pipeline Progress Bar */}
        <div className="w-full h-2.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${((statusBreakdown.PENDING?.count || 0) / totalStatusCount) * 100}%` }}
            className="bg-amber-500 transition-all duration-500"
            title={`Pending: ${statusBreakdown.PENDING?.count || 0}`}
          />
          <div
            style={{ width: `${((statusBreakdown.APPROVED?.count || 0) / totalStatusCount) * 100}%` }}
            className="bg-blue-500 transition-all duration-500"
            title={`Approved: ${statusBreakdown.APPROVED?.count || 0}`}
          />
          <div
            style={{ width: `${((statusBreakdown.DISPATCHED?.count || 0) / totalStatusCount) * 100}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`Dispatched: ${statusBreakdown.DISPATCHED?.count || 0}`}
          />
          <div
            style={{ width: `${((statusBreakdown.REJECTED?.count || 0) / totalStatusCount) * 100}%` }}
            className="bg-rose-500 transition-all duration-500"
            title={`Rejected: ${statusBreakdown.REJECTED?.count || 0}`}
          />
        </div>
      </div>

      {/* 3. Two-Column Analytics: Company Breakdown & Top Sales Executives */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Company Breakdown Card */}
        <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/80 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg border border-blue-500/20">
                <FiBriefcase />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Company Performance
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Order share & revenue per partner organization</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {companyBreakdown.length} {companyBreakdown.length === 1 ? 'Company' : 'Companies'}
            </span>
          </div>

          {companyBreakdown.length > 0 ? (
            <div className="space-y-3 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
              {companyBreakdown.map((comp, idx) => {
                const orderNum = comp.orderCount !== undefined ? comp.orderCount : (comp.ordersCount || 0);
                const val = comp.totalValue || 0;
                const percentage = totalOrderValue > 0 ? Math.round((val / totalOrderValue) * 100) : 0;

                return (
                  <div
                    key={comp._id || comp.companyId || idx}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/5 flex flex-col gap-2.5 transition-all hover:border-blue-500/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {comp.companyName || comp.name || 'Company'}
                          </p>
                          {comp.companyCode && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 shrink-0">
                              {comp.companyCode}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">
                          {orderNum} {orderNum === 1 ? 'order' : 'orders'} • {percentage}% of total volume
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-mono font-black text-blue-600 dark:text-blue-400 block">
                          ₹{val.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Progress representation */}
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${percentage}%` }}
                        className="h-full bg-blue-600 dark:bg-blue-400 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <FiBriefcase className="text-xl" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">No company metrics available</p>
              <p className="text-xs text-slate-400 mt-0.5">Partner company breakdowns will appear as purchase orders are placed.</p>
            </div>
          )}
        </div>

        {/* Top Sales Executives Card */}
        <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/80 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg border border-amber-500/20">
                <FiAward />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Top Sales Executives
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Representative rankings by fulfilled order sales</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {topSalesExecutives.length} {topSalesExecutives.length === 1 ? 'Leader' : 'Leaders'}
            </span>
          </div>

          {topSalesExecutives.length > 0 ? (
            <div className="space-y-3 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
              {topSalesExecutives.map((exec, idx) => {
                const orderNum = exec.orderCount !== undefined ? exec.orderCount : (exec.ordersCount || 0);
                const val = exec.totalValue !== undefined ? exec.totalValue : (exec.totalSales || 0);

                return (
                  <div
                    key={exec._id || exec.salesExecutiveId || idx}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/5 flex items-center justify-between gap-3 hover:border-amber-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                          idx === 0
                            ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-800'
                            : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {exec.name || `${exec.firstName || ''} ${exec.lastName || ''}`.trim() || 'Representative'}
                          </p>
                          {exec.employeeCode && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                              {exec.employeeCode}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {orderNum} completed {orderNum === 1 ? 'order' : 'orders'}
                          {exec.email && <span className="text-slate-400 font-normal"> • {exec.email}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400 block">
                        ₹{val.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <FiAward className="text-xl" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">No sales leader metrics yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Executive rankings will populate as orders are completed.</p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Full-Width Recent Orders Stream Table */}
      <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg border border-emerald-500/20">
              <FiPackage />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Recent Purchase Orders
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live incoming procurement requests with line items and snapshot quotes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/purchase-orders')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer self-start sm:self-auto"
          >
            <span>View All Orders</span>
            <FiArrowUpRight className="text-sm" />
          </button>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-white/60 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/10 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3.5">PO Number</th>
                <th className="px-5 py-3.5">Company</th>
                <th className="px-5 py-3.5">Purchasing Firm</th>
                <th className="px-4 py-3.5">Sales Executive</th>
                <th className="px-4 py-3.5 text-center">Items</th>
                <th className="px-4 py-3.5 text-right">Total Amount</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5">Date Created</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-white/5 text-xs">
              {recentOrders.length > 0 ? (
                recentOrders.map((order, idx) => {
                  const orderNum = order.poNumber || order.orderNumber || order.orderId || `#ORD-${order._id?.slice(-6) || idx + 1}`;
                  const companyTitle = order.companyId?.name || 'Company';
                  const companyCode = order.companyId?.code;
                  const firmTitle = order.firmId?.firmName || 'Firm Buyer';
                  const firmCity = order.firmId?.city;
                  const repName = order.salesExecutiveId
                    ? `${order.salesExecutiveId.firstName || ''} ${order.salesExecutiveId.lastName || ''}`.trim() || order.salesExecutiveId.name || 'Sales Rep'
                    : 'N/A';
                  const repEmail = order.salesExecutiveId?.email;
                  const itemCount = Array.isArray(order.items) ? order.items.length : 0;
                  const totalUnits = Array.isArray(order.items) ? order.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0) : 0;
                  const badge = getStatusBadge(order.status);
                  const BadgeIcon = badge.icon;

                  return (
                    <tr key={order._id || idx} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                      {/* PO Number */}
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{orderNum}</span>
                          <CopyButton text={orderNum} />
                        </div>
                      </td>

                      {/* Company */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{companyTitle}</span>
                          {companyCode && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                              {companyCode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Purchasing Firm */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 dark:text-white">{firmTitle}</span>
                          {firmCity && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <FiMapPin className="text-[10px]" /> {firmCity}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Sales Executive */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{repName}</span>
                          {repEmail && <span className="text-[10px] text-slate-400 truncate">{repEmail}</span>}
                        </div>
                      </td>

                      {/* Items */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          <FiBox className="text-blue-500 text-[10px]" />
                          <span>{itemCount} ({totalUnits})</span>
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="px-4 py-3.5 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                        ₹{(order.totalAmount || order.totalValue || order.subtotal || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${badge.className}`}>
                          <BadgeIcon className="text-[11px]" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Date Created */}
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">
                        {formatDateTimeDDMMYYYY(order.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-xs inline-flex items-center gap-1 transition-all cursor-pointer"
                          title="View order item snapshot"
                        >
                          <FiEye className="text-xs" />
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <FiPackage className="text-xl" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">No recent orders recorded</p>
                    <p className="text-xs text-slate-400 mt-1">Incoming purchase orders from sales reps will appear here automatically.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Performance Analytics & Order Pipeline Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
        {/* Chart 1: Revenue & Orders Mixed Combo Chart */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            {/* Header with Title, Series Legend Toggles, and Range Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg border border-emerald-500/20 shadow-xs">
                  <FiTrendingUp />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      Revenue & Orders Mix
                    </h2>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Mixed Chart
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Dual-axis view of gross revenue (₹) and daily order count
                  </p>
                </div>
              </div>

              {/* Controls: Series Legend Toggles & Time Range */}
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {/* Series Legend Toggles */}
                <div className="inline-flex p-1 rounded-xl bg-slate-100/90 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs font-semibold gap-1">
                  <button
                    type="button"
                    onClick={() => toggleSeries('revenue')}
                    className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      visibleSeries.revenue
                        ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-60'
                    }`}
                    title="Toggle Revenue series"
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        visibleSeries.revenue ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                    <span>Revenue (₹)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSeries('orders')}
                    className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      visibleSeries.orders
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-60'
                    }`}
                    title="Toggle Orders series"
                  >
                    <span
                      className={`w-2 h-2 rounded-sm ${
                        visibleSeries.orders ? 'bg-blue-500' : 'bg-slate-400'
                      }`}
                    />
                    <span>Orders</span>
                  </button>
                </div>

                {/* Range Filter */}
                <div className="inline-flex p-1 rounded-xl bg-slate-100/90 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs font-semibold">
                  {['7d', '30d', 'all'].map((rng) => (
                    <button
                      key={rng}
                      type="button"
                      onClick={() => setTrendRange(rng)}
                      className={`px-2.5 py-1 rounded-lg transition-all uppercase text-[11px] cursor-pointer ${
                        trendRange === rng
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {rng === 'all' ? 'All' : rng}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart Canvas */}
            <div className="pt-4 min-h-[320px]">
              {loading ? (
                <div className="h-[320px] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <FiLoader className="text-2xl animate-spin text-emerald-500" />
                    <span className="text-xs">Loading analytics trend...</span>
                  </div>
                </div>
              ) : (
                <VisxTrendChart
                  data={processedTrendData}
                  visibleSeries={visibleSeries}
                  height={320}
                  isDark={isDark}
                />
              )}
            </div>
          </div>

          {/* Comprehensive 4-Metric Quick Stat Highlights Footer */}
          <div className="pt-4 mt-2 border-t border-slate-200/80 dark:border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center sm:text-left">
            <div className="px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
              <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 block">Period Revenue</span>
              <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                ₹{trendSummary.totalRev.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
              <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 block">Total Orders</span>
              <span className="text-sm sm:text-base font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                {trendSummary.totalOrd} Orders
              </span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
              <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 block">Avg Order Value</span>
              <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-mono">
                ₹{trendSummary.avgOrderValue.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
              <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 block">Peak Day Revenue</span>
              <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-mono">
                ₹{trendSummary.peakRev.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Chart 2: Order Lifecycle & Pipeline Breakdown (Donut) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 dark:bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg border border-amber-500/20 shadow-xs">
                  <FiPieChart />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Order Pipeline
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Status lifecycle & fulfillment stage
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/10">
                4 Stages
              </span>
            </div>

            {/* Donut Chart Canvas */}
            <div className="py-2 flex items-center justify-center min-h-[220px]">
              {loading ? (
                <div className="h-[220px] flex items-center justify-center">
                  <FiLoader className="text-2xl animate-spin text-amber-500" />
                </div>
              ) : totalStatusCount === 0 ? (
                <div className="h-[220px] flex flex-col items-center justify-center text-slate-400 text-xs">
                  <FiPackage className="text-3xl mb-2 opacity-50" />
                  <span>No orders in pipeline yet</span>
                </div>
              ) : (
                <div className="w-full">
                  <VisxPipelineDonut
                    statusBreakdown={statusBreakdown}
                    totalCount={totalStatusCount}
                    height={230}
                    isDark={isDark}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Interactive Status Breakdown List */}
          <div className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-white/10">
            {[
              {
                key: 'PENDING',
                label: 'Pending Approval',
                badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                dotColor: 'bg-amber-500',
                barColor: 'bg-amber-500',
                count: statusBreakdown.PENDING?.count || 0,
                value: statusBreakdown.PENDING?.value || 0
              },
              {
                key: 'APPROVED',
                label: 'Approved',
                badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                dotColor: 'bg-blue-500',
                barColor: 'bg-blue-500',
                count: statusBreakdown.APPROVED?.count || 0,
                value: statusBreakdown.APPROVED?.value || 0
              },
              {
                key: 'DISPATCHED',
                label: 'Dispatched / Fulfilled',
                badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                dotColor: 'bg-emerald-500',
                barColor: 'bg-emerald-500',
                count: statusBreakdown.DISPATCHED?.count || 0,
                value: statusBreakdown.DISPATCHED?.value || 0
              },
              {
                key: 'REJECTED',
                label: 'Rejected',
                badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                dotColor: 'bg-rose-500',
                barColor: 'bg-rose-500',
                count: statusBreakdown.REJECTED?.count || 0,
                value: statusBreakdown.REJECTED?.value || 0
              }
            ].map((st) => {
              const pct = totalStatusCount > 0 ? Math.round((st.count / totalStatusCount) * 100) : 0;
              return (
                <div
                  key={st.key}
                  className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-all"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${st.dotColor}`} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{st.label}</span>
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                        {st.count}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900 dark:text-white font-mono">
                        ₹{Number(st.value).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1 font-medium">({pct}%)</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-200/60 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${st.barColor} rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 6. Order Snapshot Details Modal */}
      {selectedOrder && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 dark:bg-slate-950/50 backdrop-blur-lg animate-fade-in"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="relative bg-white/40 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl border border-blue-500/20">
                  <FiPackage />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono">
                      {selectedOrder.poNumber || selectedOrder.orderNumber || 'Order Details'}
                    </h3>
                    <CopyButton text={selectedOrder.poNumber || selectedOrder.orderNumber || selectedOrder._id} />
                  </div>
                  <p className="text-xs text-slate-400">
                    Created on {formatDateTimeDDMMYYYY(selectedOrder.createdAt)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Order Entity Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Trading Company</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedOrder.companyId?.name || 'Whatnot India'}
                </span>
                {selectedOrder.companyId?.code && (
                  <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 block">
                    Code: {selectedOrder.companyId.code}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Purchasing Firm</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedOrder.firmId?.firmName || 'Retailer Firm'}
                </span>
                {selectedOrder.firmId?.city && (
                  <span className="text-[10px] text-slate-400 block">
                    City: {selectedOrder.firmId.city}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Sales Executive</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedOrder.salesExecutiveId
                    ? `${selectedOrder.salesExecutiveId.firstName || ''} ${selectedOrder.salesExecutiveId.lastName || ''}`.trim() || selectedOrder.salesExecutiveId.name
                    : 'N/A'}
                </span>
                {selectedOrder.salesExecutiveId?.email && (
                  <span className="text-[10px] text-slate-400 block">
                    {selectedOrder.salesExecutiveId.email}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Status</span>
                <div className="mt-1">
                  {(() => {
                    const badge = getStatusBadge(selectedOrder.status);
                    const BadgeIcon = badge.icon;
                    return (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${badge.className}`}>
                        <BadgeIcon className="text-[11px]" />
                        <span>{badge.label}</span>
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Delivery Notes */}
            {selectedOrder.notes && (
              <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs">
                <span className="font-bold text-amber-700 dark:text-amber-300 block mb-0.5">Order Notes:</span>
                <p className="text-slate-700 dark:text-slate-200 italic">"{selectedOrder.notes}"</p>
              </div>
            )}

            {/* Line Items Snapshot Table */}
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
                            <p className="font-bold text-slate-900 dark:text-white">{item.productNameSnapshot || 'Product'}</p>
                            <p className="font-mono text-[10px] text-blue-600 dark:text-blue-400">{item.skuSnapshot}</p>
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold">{item.quantity}</td>
                          <td className="p-2.5 text-right font-mono">₹{(item.unitPrice || 0).toLocaleString('en-IN')}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                            ₹{(item.totalPrice || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="p-4 text-center text-slate-400">No snapshot items found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Total Order Amount</span>
              <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                ₹{(selectedOrder.totalAmount || selectedOrder.totalValue || selectedOrder.subtotal || 0).toLocaleString('en-IN')}
              </span>
            </div>

            {/* Modal Actions */}
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedOrder(null);
                  navigate('/purchase-orders');
                }}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/25 cursor-pointer"
              >
                <span>Go to Purchase Orders</span>
                <FiArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Dashboard;