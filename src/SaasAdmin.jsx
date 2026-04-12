import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogIn, CreditCard, Settings, LayoutDashboard,
  ArrowLeft, Sparkles, Wallet, User, Store
} from 'lucide-react';
import PricingPage from './components/PricingPage';
import TeamSettingsPage from './components/TeamSettings';
import SuperAdminPage from './components/SuperAdminPage';
import PaymentAdminPage from './components/PaymentAdminPage';
import MarketplaceAdminPage from './components/MarketplaceAdminPage';
import UserMyPage from './components/UserMyPage';
import useAuthStore from './store/useAuthStore';

export default function SaasAdmin() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const userRole = user?.role || 'free_viewer';
  const isAdmin = userRole === 'admin';

  const [currentPage, setCurrentPage] = useState(() => isAdmin ? 'admin' : 'mypage');
  const [viewMode, setViewMode] = useState('admin'); // 'admin' | 'user'

  const adminNavItems = [
    { id: 'admin', label: '대시보드', icon: LayoutDashboard },
    { id: 'marketplace', label: '마켓플레이스', icon: Store },
    { id: 'payments', label: '결제 관리', icon: Wallet },
    { id: 'pricing', label: '요금제 관리', icon: CreditCard },
    { id: 'settings', label: '워크스페이스', icon: Settings },
  ];

  const userNavItems = [
    { id: 'pricing', label: '요금제', icon: CreditCard },
    { id: 'settings', label: '워크스페이스', icon: Settings },
  ];

  // 유저 뷰 모드일 때는 UserMyPage 전체 렌더
  const showUserView = viewMode === 'user';
  const navItems = showUserView ? userNavItems : (isAdmin ? adminNavItems : userNavItems);

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* ── Top Nav ── */}
      <header className="h-12 border-b border-[#374766]/30 bg-[#111827]/80 flex items-center px-4 gap-4 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 min-w-[160px]">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles size={11} className="text-white" />
          </div>
          <span className="text-xs font-bold text-white">LivedPulse</span>
          {isAdmin && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">ADMIN</span>
          )}
        </div>

        {/* View Toggle — center */}
        {isAdmin && (
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-1 bg-[#1a2035]/80 border border-[#374766]/40 rounded-xl p-1">
              <button
                onClick={() => setViewMode('admin')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'admin'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutDashboard size={11} />
                관리자 뷰
              </button>
              <button
                onClick={() => setViewMode('user')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'user'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User size={11} />
                유저 뷰
              </button>
            </div>
          </div>
        )}

        {/* Right: user info + logout */}
        <div className={`flex items-center gap-3 ${isAdmin ? '' : 'ml-auto'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${isAdmin ? 'bg-gradient-to-br from-amber-500/40 to-orange-500/40' : 'bg-gradient-to-br from-indigo-500/40 to-purple-500/40'}`}>
            {isAdmin ? 'A' : 'K'}
          </div>
          <span className="text-[10px] text-slate-400">{isAdmin ? '시스템 관리자' : '사용자'}</span>
          <button
            onClick={logout}
            className="p-1 rounded hover:bg-[#374766]/30 transition-colors"
            title="로그아웃"
          >
            <LogIn size={12} className="text-slate-500" />
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — 유저 뷰일 때는 숨김 (UserMyPage 내부 사이드바 사용) */}
        {!showUserView && (
          <aside className="w-[220px] min-w-[220px] border-r border-[#374766]/30 bg-[#111827]/50 flex flex-col">
            <nav className="flex-1 p-3 space-y-1 pt-4">
              {navItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      currentPage === item.id
                        ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                        : 'text-slate-400 hover:bg-[#1a2035] hover:text-slate-200'
                    }`}
                  >
                    <Icon size={15} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-[#374766]/30">
              <button
                onClick={() => navigate('/')}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-indigo-400 hover:bg-indigo-500/10 transition-colors"
              >
                <ArrowLeft size={14} />
                대시보드로 이동
              </button>
            </div>
          </aside>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {showUserView ? (
            <div>
              <div className="p-4 border-b border-[#374766]/30">
                <button onClick={() => navigate('/')} className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition">
                  <ArrowLeft size={14} /> 홈으로 돌아가기
                </button>
              </div>
              <UserMyPage />
            </div>
          ) : (
            <>
              {currentPage === 'pricing' && (
                <PricingPage onSelectPlan={() => setCurrentPage('settings')} />
              )}
              {currentPage === 'settings' && <TeamSettingsPage />}
              {currentPage === 'admin' && <SuperAdminPage />}
              {currentPage === 'marketplace' && <MarketplaceAdminPage />}
              {currentPage === 'payments' && <PaymentAdminPage />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
