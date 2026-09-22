import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/Context/AuthContext';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Layout from '@/components/layout/Layout';
import { ConfirmationProvider } from '@/Context/ConfirmationContext';
import { ThemeProvider, useTheme } from '@/Context/ThemeContext';
import auricLightLogo from '@/assets/auric_light.png';
import auricDarkLogo from '@/assets/auric_dark.png';

// Lazy Loaded Pages (Clean Architecture)
const Login = lazy(() => import('@/pages/auth/Login'));
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'));
const Categories = lazy(() => import('@/pages/products/Categories'));
const Companies = lazy(() => import('@/pages/companies/Companies'));
const CompanyDetails = lazy(() => import('@/pages/companies/CompanyDetails'));
const Firms = lazy(() => import('@/pages/firms/Firms'));
const Notifications = lazy(() => import('@/pages/notifications/Notifications'));
const Products = lazy(() => import('@/pages/products/Products'));
const PurchaseOrders = lazy(() => import('@/pages/orders/PurchaseOrders'));
const Reports = lazy(() => import('@/pages/common/Reports'));
const Users = lazy(() => import('@/pages/users/Users'));
const UserDetails = lazy(() => import('@/pages/users/UserDetails'));
const Profile = lazy(() => import('@/pages/common/Profile'));
const Settings = lazy(() => import('@/pages/settings/Settings'));

const PageLoadingFallback = () => {
  const { isDark } = useTheme();
  const auricLogo = isDark ? auricDarkLogo : auricLightLogo;

  return (
    <div
      className={`h-screen w-screen flex flex-col justify-center items-center relative overflow-hidden transition-colors duration-300 ${
        isDark ? 'panel-bg-dark text-slate-300' : 'panel-bg-light text-slate-700'
      }`}
    >
      {/* Ambient background lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full filter blur-[120px] opacity-25 dark:opacity-35 bg-blue-400/40 dark:bg-blue-600/40 pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full filter blur-[90px] opacity-20 dark:opacity-25 bg-sky-300/35 dark:bg-indigo-500/30 pointer-events-none" />
      </div>

      {/* Center Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Brand Logo */}
        <div className="mb-6 transform hover:scale-105 transition-transform duration-300">
          <img
            src={auricLogo}
            alt="Auric Logo"
            className="h-60 w-auto object-contain drop-shadow-md select-none"
          />
        </div>

        {/* Dynamic Dual-Ring Spinner */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-12 h-12 rounded-full bg-blue-500/15 dark:bg-blue-500/20 blur-md animate-pulse" />
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500/20 dark:border-blue-400/20 border-t-blue-600 dark:border-t-blue-400 border-b-blue-600 dark:border-b-blue-400" />
        </div>

        {/* Status Text */}
        <p className="text-slate-600 dark:text-slate-400 mt-5 font-semibold text-xs tracking-widest uppercase select-none drop-shadow-sm">
          Loading page elements...
        </p>
      </div>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ConfirmationProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                {/* Public Auth Route */}
                <Route path="/login" element={<Login />} />

                {/* Base Protection */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    {/* Main Target Menus */}
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/companies" element={<Companies />} />
                    <Route path="/companies/:id" element={<CompanyDetails />} />
                    <Route path="/firms" element={<Firms />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/purchase-orders" element={<PurchaseOrders />} />
                    <Route path="/purchaseOrders" element={<Navigate to="/purchase-orders" replace />} />
                    <Route path="/orders" element={<Navigate to="/purchase-orders" replace />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/users/:id" element={<UserDetails />} />

                    {/* Common & Backward-compatible aliases */}
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/panel-settings" element={<Navigate to="/settings" replace />} />
                    <Route path="/users/list" element={<Navigate to="/users" replace />} />
                    <Route path="/users/list/:id" element={<UserDetails />} />
                    <Route path="/products/list" element={<Navigate to="/products" replace />} />
                    <Route path="/products/categories" element={<Navigate to="/categories" replace />} />
                  </Route>
                </Route>

                {/* Catch-all: Redirect unknown URLs to Dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ConfirmationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;