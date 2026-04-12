import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Search, Megaphone, User, Bell, ChevronLeft, LayoutGrid, LogIn } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import { useState, useEffect } from 'react';
import { getNotifications } from '../../services/marketplace-api';

export default function MarketplaceLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const isLoggedIn = !!user;
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (isLoggedIn) {
      getNotifications(5).then(d => setUnread(d.unreadCount || 0)).catch(() => {});
    }
  }, [isLoggedIn, location.pathname]);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const navItems = [
    { path: '/marketplace', label: '포트폴리오', icon: LayoutGrid, public: true },
    { path: '/marketplace/search', label: 'Smart Search', icon: Search, public: false },
    { path: '/marketplace/campaigns', label: '캠페인', icon: Megaphone, public: false },
  ];

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-dark-600/50 bg-dark-800/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
          {/* Logo + Back */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight">LivedPulse</h1>
                <p className="text-[9px] text-slate-500">Marketplace</p>
              </div>
            </Link>

            {/* Nav tabs */}
            <nav className="flex items-center gap-0.5 ml-4 bg-dark-700/60 rounded-lg p-0.5 border border-dark-600/40">
              {navItems.map(item => {
                if (!item.public && !isLoggedIn) return null;
                const active = item.path === '/marketplace'
                  ? location.pathname === '/marketplace'
                  : isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      active
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-dark-600/60'
                    }`}
                  >
                    <item.icon size={13} />
                    {item.label}
                  </Link>
                );
              })}
              {/* Back to Analytics link */}
              <Link to="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-white hover:bg-dark-600/60 transition-all border-l border-dark-600/40 ml-0.5">
                <ChevronLeft size={13} /> 분석 도구
              </Link>
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <button
                  onClick={() => navigate('/marketplace/campaigns')}
                  className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700 transition"
                >
                  <Bell size={16} />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
                <span className="text-xs text-slate-500 mx-1">{user?.name || user?.email}</span>
                <button onClick={() => { logout(); navigate('/marketplace'); }} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-dark-600 hover:text-white hover:border-slate-500 transition">
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`} className="px-3 py-1.5 rounded-lg text-xs text-slate-300 border border-dark-600 hover:text-white hover:border-indigo-500/30 transition">
                  로그인
                </Link>
                <Link to={`/login?returnUrl=${encodeURIComponent('/marketplace/onboarding')}`} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/20 transition">
                  회원가입
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-600/30 py-6">
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between text-[11px] text-slate-600">
          <span>LivedPulse Marketplace</span>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-slate-400">분석 도구</Link>
            <Link to="/marketplace" className="hover:text-slate-400">마켓플레이스</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
