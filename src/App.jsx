import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/Context/AuthContext';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Layout from '@/components/layout/Layout';
import { ConfirmationProvider } from '@/Context/ConfirmationContext';
import { ThemeProvider } from '@/Context/ThemeContext';

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

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ConfirmationProvider>
          <BrowserRouter>
            <Suspense fallback={
              <div className="h-screen w-screen flex flex-col justify-center items-center bg-slate-950">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                <p className="text-slate-400 mt-4 font-semibold text-xs tracking-wider uppercase">Loading page elements...</p>
              </div>
            }>
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