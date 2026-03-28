import { useState, useEffect } from 'react';
import {
  LogIn, CreditCard, Settings, LayoutDashboard,
  ArrowLeft, Sparkles, Wallet
} from 'lucide-react';
import AuthPage from './components/AuthPage';
import PricingPage from './components/PricingPage';
import TeamSettingsPage from './components/TeamSettings';
import SuperAdminPage from './components/SuperAdminPage';
import PaymentAdminPage from './components/PaymentAdminPage';

export default function SaasAdmin({ onGoToDashboard, isLoggedIn, userRole, onLogin, onLogout }) {
  const [currentPage, setCurrentPage] = useState(() => userRole === 'admin' ? 'admin' : 'pricing');
  const [currentPlan, setCurrentPlan] = useState(null);

  // Sync currentPage when role changes (e.g., after login)
  useEffect(() => {
    if (isLoggedIn && userRole === 'admin' && currentPage === 'pricing') {
      setCurrentPage('admin');
    }
  }, [isLoggedIn, userRole]);

  if (!isLoggedIn) {
    return <AuthPage onLogin={(role) => { onLogin(role); }} />;
  }

  const isAdmin = userRole === 'admin';

  const userNavItems = [
    { id: 'pricing', label: '요금제', icon: CreditCard },
    { id: 'settings', label: '워크스페이스', icon: Settings },
  ];

  const adminNavItems = [
    { id: 'admin', label: '대시보드', icon: LayoutDashboard },
    { id: 'payments', label: '결제 관리', icon: Wallet },
    { id: 'pricing', label: '요금제 관리', icon: CreditCard },
    { id: 'settings', label: '워크스페이스', icon: Settings },
  ];

  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex">
      {/* Sidebar */}
      <aside className="w-[220px] min-w-[220px] border-r border-[#374766]/30 bg-[#111827]/50 flex flex-col">
        <div className="p-4 border-b border-[#374766]/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Promo Insight</div>
              <div className="text-[9px] text-slate-500">{isAdmin ? '관리자 콘솔' : '사용자 콘솔'}</div>
            </div>
            {isAdmin && (
              <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">ADMIN</span>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
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
          <button onClick={onGoToDashboard} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-indigo-400 hover:bg-indigo-500/10 transition-colors">
            <ArrowLeft size={14} />
            대시보드로 이동
          </button>
        </div>

        <div className="p-3 border-t border-[#374766]/30">
          <div className="flex items-center gap-2 px-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${isAdmin ? 'bg-gradient-to-br from-amber-500/30 to-orange-500/30' : 'bg-gradient-to-br from-indigo-500/30 to-purple-500/30'}`}>
              {isAdmin ? 'A' : 'K'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium text-white">{isAdmin ? '시스템 관리자' : '김영수'}</div>
              <div className="text-[9px] text-slate-500">{isAdmin ? 'Promo Insight' : '내 워크스페이스'}</div>
            </div>
            <button onClick={onLogout} className="p-1 rounded hover:bg-[#374766]/30 transition-colors" title="로그아웃">
              <LogIn size={12} className="text-slate-500" />
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {currentPage === 'pricing' && <PricingPage onSelectPlan={(plan) => { setCurrentPlan(plan); setCurrentPage('settings'); }} />}
        {currentPage === 'settings' && <TeamSettingsPage />}
        {currentPage === 'admin' && <SuperAdminPage />}
        {currentPage === 'payments' && <PaymentAdminPage />}
      </main>
    </div>
  );
}
