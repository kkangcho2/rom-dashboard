import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

export function ProtectedRoute({ children }) {
  const { user, initialized } = useAuthStore();
  const location = useLocation();
  if (!initialized) return null;
  if (!user) {
    // 로그인 후 원래 페이지로 돌아올 수 있도록 returnUrl 전달
    return <Navigate to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return children;
}

export function AdminRoute({ children }) {
  const { user, initialized } = useAuthStore();
  const location = useLocation();
  if (!initialized) return null;
  if (!user) return <Navigate to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`} replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
