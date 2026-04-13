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

// 관리 콘솔 접근 허용 역할
// - admin: 전체 기능
// - advertiser (캠페인 담당자/광고주/대행사): 본인 캠페인 리포트/이메일만 조회
const ADMIN_CONSOLE_ROLES = ['admin', 'advertiser'];

export function AdminRoute({ children }) {
  const { user, initialized } = useAuthStore();
  const location = useLocation();
  if (!initialized) return null;
  if (!user) return <Navigate to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`} replace />;
  if (!ADMIN_CONSOLE_ROLES.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
