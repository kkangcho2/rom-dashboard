import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/useAuthStore';
import { ErrorBoundary, ToastContainer } from './components/ui';
import './index.css';

// Code splitting - lazy load pages
const CreatorSearch = lazy(() => import('./CreatorSearch'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DailyReportPage = lazy(() => import('./pages/Report'));
const SaasAdmin = lazy(() => import('./SaasAdmin'));

// Page loading fallback
function PageLoader() {
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto animate-pulse">
          <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-xs text-slate-500">로딩 중...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { isLoggedIn, userRole, login, logout } = useAuthStore();

  return (
    <BrowserRouter>
      <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <div id="main-content">
            <Routes>
            <Route
              path="/"
              element={
                <CreatorSearch
                  onSelectCreator={() => {}}
                  onGoToAdmin={() => {}}
                  onGoToReport={() => {}}
                  isLoggedIn={isLoggedIn}
                  onLogin={login}
                  onLogout={logout}
                />
              }
            />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/report" element={<DailyReportPage inline={true} />} />
            <Route
              path="/admin/*"
              element={
                <SaasAdmin
                  onGoToDashboard={() => {}}
                  isLoggedIn={isLoggedIn}
                  userRole={userRole}
                  onLogin={login}
                  onLogout={logout}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Suspense>
        <ToastContainer />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
