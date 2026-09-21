import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/Context/AuthContext';

const ProtectedRoute = () => {
  const { user } = useAuth();

  // If not logged in, send to login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If authorized, render the child routes
  return <Outlet />;
};

export default ProtectedRoute;