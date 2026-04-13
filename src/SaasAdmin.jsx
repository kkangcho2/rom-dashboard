import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogIn, CreditCard, Settings, LayoutDashboard,
  ArrowLeft, Sparkles, Wallet, User, Store,
  Activity, Megaphone, Eye, Monitor, FileText, Server, Mail
} from 'lucide-react';
import PricingPage from './components/PricingPage';
import TeamSettingsPage from './components/TeamSettings';
import SuperAdminPage from './components/SuperAdminPage';
import PaymentAdminPage from './components/PaymentAdminPage';
import MarketplaceAdminPage from './components/MarketplaceAdminPage';
import UserMyPage from './components/UserMyPage';
import {
  AdminDashboardPage,
  AdminCampaignListPage,
  AdminCampaignDetailPage,
  AdminReviewQueuePage,
  AdminJobQueuePage,
  AdminStreamMonitorPage,
  AdminReportCenterPage,
  AdminReportDetailPage,
  AdminEmailDeliveryPage,
  AdminCreatorsPage,
  AdminSettingsPage,
  AdminBroadcastsPage,
} from './pages/Admin';
import useAuthStore from './store/useAuthStore';

export default function SaasAdmin() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const userRole = user?.role || 'free_viewer';
  const isAdmin = userRole === 'admin';
  const isAdvertiser = userRole === 'advertiser';
  // 관리 콘솔 접근 허용 역할
  const canAccessAdminConsole = isAdmin || isAdvertiser;

  // advertiser는 자신 뷰 토글 불필요 (전용 뷰)
  const defaultPage = isAdmin ? 'automation-dashboard' : (isAdvertiser ? 'campaigns' : 'mypage');
  const [currentPage, setCurrentPage] = useState(defaultPage);
  const [viewMode, setViewMode] = useState('admin'); // 'admin' | 'user'
  const [pageParams, setPageParams] = useState({});

  // Navigation handler for child pages
  const handleNavigate = useCallback((pageId, params = {}) => {
    setCurrentPage(pageId);
    setPageParams(params);
  }, []);

  // 관리자 전용 전체 메뉴
  const adminNavItems = [
    // ─── 캠페인 자동화 (운영 관제) ───
    { id: 'automation-dashboard', label: '운영 관제실', icon: Activity, group: 'automation' },
    { id: 'campaigns', label: '캠페인', icon: Megaphone, group: 'automation' },
    { id: 'stream-monitor', label: '방송 모니터링', icon: Monitor, group: 'automation' },
    { id: 'broadcasts', label: '방송 처리', icon: Monitor, group: 'automation' },
    { id: 'review-queue', label: '검수 큐', icon: Eye, group: 'automation' },
    { id: 'report-center', label: '리포트 센터', icon: FileText, group: 'automation' },
    { id: 'job-queue', label: '작업 큐', icon: Server, group: 'automation' },
    { id: 'email-delivery', label: '이메일 발송', icon: Mail, group: 'automation' },
    { id: 'admin-creators', label: '크리에이터', icon: User, group: 'automation' },
    { id: 'admin-settings', label: '시스템 설정', icon: Settings, group: 'automation' },
    // ─── 기존 관리 ───
    { id: 'admin', label: '유저 관리', icon: LayoutDashboard, group: 'system' },
    { id: 'marketplace', label: '마켓플레이스', icon: Store, group: 'system' },
    { id: 'payments', label: '결제 관리', icon: Wallet, group: 'system' },
    { id: 'pricing', label: '요금제 관리', icon: CreditCard, group: 'system' },
    { id: 'settings', label: '워크스페이스', icon: Settings, group: 'system' },
  ];

  // 캠페인 담당자(광고주/대행사) 제한 메뉴
  const advertiserNavItems = [
    { id: 'campaigns', label: '내 캠페인', icon: Megaphone, group: 'advertiser' },
    { id: 'stream-monitor', label: '방송 모니터링', icon: Monitor, group: 'advertiser' },
    { id: 'report-center', label: '리포트 센터', icon: FileText, group: 'advertiser' },
    { id: 'email-delivery', label: '이메일 발송', icon: Mail, group: 'advertiser' },
    { id: 'settings', label: '워크스페이스', icon: Settings, group: 'system' },
  ];

  const userNavItems = [
    { id: 'pricing', label: '요금제', icon: CreditCard },
    { id: 'settings', label: '워크스페이스', icon: Settings },
  ];

  // 뷰 모드에 따른 메뉴 선택
  const showUserView = viewMode === 'user';
  let navItems;
  if (showUserView) navItems = userNavItems;
  else if (isAdmin) navItems = adminNavItems;
  else if (isAdvertiser) navItems = advertiserNavItems;
  else navItems = userNavItems;

  // Group nav items
  const automationItems = navItems.filter(i => i.group === 'automation');
  const advertiserItems = navItems.filter(i => i.group === 'advertiser');
  const systemItems = navItems.filter(i => i.group === 'system');
  const ungrouped = navItems.filter(i => !i.group);

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
          {isAdvertiser && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">캠페인 담당자</span>
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
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${isAdmin ? 'bg-gradient-to-br from-amber-500/40 to-orange-500/40' : isAdvertiser ? 'bg-gradient-to-br from-cyan-500/40 to-teal-500/40' : 'bg-gradient-to-br from-indigo-500/40 to-purple-500/40'}`}>
            {isAdmin ? 'A' : isAdvertiser ? '광' : 'K'}
          </div>
          <span className="text-[10px] text-slate-400">{isAdmin ? '시스템 관리자' : isAdvertiser ? '캠페인 담당자' : '사용자'}</span>
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
        {/* Sidebar — 유저 뷰일 때는 숨김 */}
        {!showUserView && (
          <aside className="w-[220px] min-w-[220px] border-r border-[#374766]/30 bg-[#111827]/50 flex flex-col overflow-y-auto">
            <nav className="flex-1 p-3 space-y-0.5 pt-4">
              {/* Advertiser (캠페인 담당자) group */}
              {advertiserItems.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[9px] font-bold text-cyan-500/70 uppercase tracking-wider">캠페인 담당자 콘솔</div>
                  {advertiserItems.map(item => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id || (item.id === 'campaigns' && currentPage === 'campaign-detail') || (item.id === 'report-center' && currentPage === 'report-detail');
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20'
                            : 'text-slate-400 hover:bg-[#1a2035] hover:text-slate-200'
                        }`}
                      >
                        <Icon size={14} />
                        {item.label}
                      </button>
                    );
                  })}
                </>
              )}

              {/* Automation group */}
              {automationItems.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[9px] font-bold text-slate-600 uppercase tracking-wider">캠페인 운영</div>
                  {automationItems.map(item => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id || (item.id === 'campaigns' && currentPage === 'campaign-detail');
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                            : 'text-slate-400 hover:bg-[#1a2035] hover:text-slate-200'
                        }`}
                      >
                        <Icon size={14} />
                        {item.label}
                      </button>
                    );
                  })}
                </>
              )}

              {/* System group */}
              {systemItems.length > 0 && (
                <>
                  <div className="px-3 py-1.5 mt-4 text-[9px] font-bold text-slate-600 uppercase tracking-wider">시스템 관리</div>
                  {systemItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          currentPage === item.id
                            ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                            : 'text-slate-400 hover:bg-[#1a2035] hover:text-slate-200'
                        }`}
                      >
                        <Icon size={14} />
                        {item.label}
                      </button>
                    );
                  })}
                </>
              )}

              {/* Ungrouped (user view) */}
              {ungrouped.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
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
              {/* ─── 캠페인 자동화 페이지 ─── */}
              {currentPage === 'automation-dashboard' && <AdminDashboardPage onNavigate={handleNavigate} />}
              {currentPage === 'campaigns' && <AdminCampaignListPage onNavigate={handleNavigate} />}
              {currentPage === 'campaign-detail' && <AdminCampaignDetailPage campaignId={pageParams.campaignId} onNavigate={handleNavigate} />}
              {currentPage === 'review-queue' && <AdminReviewQueuePage onNavigate={handleNavigate} />}
              {currentPage === 'job-queue' && <AdminJobQueuePage />}
              {currentPage === 'stream-monitor' && <AdminStreamMonitorPage onNavigate={handleNavigate} />}
              {currentPage === 'broadcasts' && <AdminBroadcastsPage />}
              {currentPage === 'report-center' && <AdminReportCenterPage onNavigate={handleNavigate} />}
              {currentPage === 'report-detail' && <AdminReportDetailPage reportId={pageParams.reportId} onNavigate={handleNavigate} />}
              {currentPage === 'email-delivery' && <AdminEmailDeliveryPage />}
              {currentPage === 'admin-creators' && <AdminCreatorsPage onNavigate={handleNavigate} />}
              {currentPage === 'admin-settings' && <AdminSettingsPage />}

              {/* ─── 기존 관리 페이지 ─── */}
              {currentPage === 'pricing' && <PricingPage onSelectPlan={() => handleNavigate('settings')} />}
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
