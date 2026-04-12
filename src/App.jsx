import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/useAuthStore';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import { ErrorBoundary, ToastContainer } from './components/ui';
import './index.css';

// Code splitting - lazy load pages
const CreatorSearch = lazy(() => import('./CreatorSearch'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DailyReportPage = lazy(() => import('./pages/Report'));
const SaasAdmin = lazy(() => import('./SaasAdmin'));
const AuthPage = lazy(() => import('./components/AuthPage'));
const AnalysisPage = lazy(() => import('./pages/Analysis'));

// Marketplace pages (lazy loaded)
const MarketplaceLayout = lazy(() => import('./pages/marketplace/MarketplaceLayout'));
const PortfolioPage = lazy(() => import('./pages/marketplace/PortfolioPage'));
const SearchPage = lazy(() => import('./pages/marketplace/SearchPage'));
const CampaignPage = lazy(() => import('./pages/marketplace/CampaignPage'));
const OnboardingPage = lazy(() => import('./pages/marketplace/OnboardingPage'));

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
        <p className="text-xs text-slate-500">...</p>
      </div>
    </div>
  );
}

// Marketplace wrapper with shared layout
function MarketplaceWrapper({ children }) {
  return (
    <MarketplaceLayout>
      {children}
    </MarketplaceLayout>
  );
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!initialized) return <PageLoader />;

  return (
    <BrowserRouter>
      <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <div id="main-content">
            <Routes>
              {/* 공개 페이지 */}
              <Route path="/" element={<CreatorSearch />} />
              <Route path="/login" element={<AuthPage />} />

              {/* ═══ 마켓플레이스 (공유 레이아웃) ═══ */}
              <Route path="/marketplace" element={<MarketplaceWrapper><PortfolioPage /></MarketplaceWrapper>} />
              <Route path="/marketplace/portfolio/:creatorId" element={<MarketplaceWrapper><PortfolioPage /></MarketplaceWrapper>} />
              <Route path="/marketplace/search" element={<ProtectedRoute><MarketplaceWrapper><SearchPage /></MarketplaceWrapper></ProtectedRoute>} />
              <Route path="/marketplace/campaigns" element={<ProtectedRoute><MarketplaceWrapper><CampaignPage /></MarketplaceWrapper></ProtectedRoute>} />
              <Route path="/marketplace/campaigns/:campaignId" element={<ProtectedRoute><MarketplaceWrapper><CampaignPage /></MarketplaceWrapper></ProtectedRoute>} />
              <Route path="/marketplace/onboarding" element={<ProtectedRoute><MarketplaceWrapper><OnboardingPage /></MarketplaceWrapper></ProtectedRoute>} />

              {/* 로그인 필수 */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/report" element={<ProtectedRoute><DailyReportPage inline={true} /></ProtectedRoute>} />

              {/* 크리에이터 분석 */}
              <Route path="/analysis" element={<ProtectedRoute><AnalysisPage /></ProtectedRoute>} />

              {/* 관리자 전용 */}
              <Route path="/admin/*" element={<AdminRoute><SaasAdmin /></AdminRoute>} />

              {/* 폴백 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Suspense>
        <ToastContainer />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
