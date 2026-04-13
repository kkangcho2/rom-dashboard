import { useState, useEffect } from 'react';
import {
  Users, TrendingUp, DollarSign, FileText,
  MoreVertical, Edit3, Pause, Trash2, CheckCircle2, AlertTriangle, UserX,
  Shield, UserCheck, Search, RefreshCw, Activity, Megaphone, Briefcase, User
} from 'lucide-react';
import { GlassCard } from './shared';
import { getAdminUsers, updateUserRole, updateUserStatus, getStats } from '../services/api';
import { authFetch } from '../store/useAuthStore';

const ROLE_LABELS = {
  admin: '관리자',
  advertiser: '캠페인 담당자',
  tester: '테스터',
  paid_user: '유료',
  creator: '크리에이터',
  free_viewer: '무료'
};
const ROLE_COLORS = {
  admin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  advertiser: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  tester: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  paid_user: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  creator: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  free_viewer: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};
const STATUS_COLORS = { active: 'bg-green-500/20 text-green-400', suspended: 'bg-red-500/20 text-red-400' };
const STATUS_LABELS = { active: '활성', suspended: '정지' };

export default function SuperAdminPage() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionOpen, setActionOpen] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState(null);
  const [usageData, setUsageData] = useState(null);

  // 데이터 로드
  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        getAdminUsers(1, 100),
        getStats().catch(() => null),
      ]);
      if (usersRes.ok) setMembers(usersRes.users);
      if (statsRes) setStats(statsRes);

      // 사용량 데이터
      try {
        const usageRes = await authFetch('/admin/usage/summary');
        if (usageRes.ok) setUsageData(await usageRes.json());
      } catch {}
    } catch (e) {
      console.error('관리자 데이터 로드 실패:', e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleRoleChange = async (userId, newRole) => {
    const result = await updateUserRole(userId, newRole);
    if (result.ok) loadData();
    setActionOpen(null);
  };

  const handleStatusChange = async (userId, newStatus) => {
    const result = await updateUserStatus(userId, newStatus);
    if (result.ok) loadData();
    setActionOpen(null);
  };

  const filtered = searchQuery
    ? members.filter(m => m.email?.includes(searchQuery) || m.name?.includes(searchQuery) || m.company?.includes(searchQuery) || m.phone?.includes(searchQuery))
    : members;

  const totalMembers = members.length;
  const activeMembers = members.filter(m => m.status === 'active').length;
  const todayLogins = stats?.todayLogins ?? '-';

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '총 가입자', value: `${totalMembers}명`, icon: Users, color: 'text-blue-400', bg: 'from-blue-500/10 to-blue-500/5' },
          { label: '활성 유저', value: `${activeMembers}명`, icon: CheckCircle2, color: 'text-green-400', bg: 'from-green-500/10 to-green-500/5' },
          { label: '오늘 로그인', value: `${todayLogins}명`, icon: UserCheck, color: 'text-indigo-400', bg: 'from-indigo-500/10 to-indigo-500/5' },
          { label: 'API 사용량', value: usageData?.quotaUsage ? `${usageData.quotaUsage.percent}%` : '-', icon: Activity, color: usageData?.quotaUsage?.percent > 80 ? 'text-red-400' : 'text-amber-400', bg: 'from-amber-500/10 to-amber-500/5' },
        ].map((s, i) => (
          <GlassCard key={i} className={`p-4 bg-gradient-to-br ${s.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</span>
              <s.icon size={13} className={s.color} />
            </div>
            <div className="text-xl font-bold text-white">{s.value}</div>
          </GlassCard>
        ))}
      </div>

      {/* API 할당량 경고 */}
      {usageData?.quotaUsage?.percent > 80 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertTriangle size={14} />
          YouTube API 일일 할당량 {usageData.quotaUsage.percent}% 사용 중 ({usageData.quotaUsage.used.toLocaleString()} / {usageData.quotaUsage.limit.toLocaleString()} units)
        </div>
      )}

      {/* ── Member Table ── */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users size={14} className="text-blue-400" /> 회원 관리
            <span className="text-[10px] text-slate-500 font-normal ml-1">{filtered.length}명</span>
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" placeholder="이름, 이메일, 회사 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="bg-dark-700 border border-dark-600 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-slate-200 placeholder-slate-600 w-52 focus:outline-none focus:border-indigo-500/50" />
            </div>
            <button onClick={loadData} className="p-2 rounded-lg hover:bg-dark-700 text-slate-400 hover:text-white transition-all" title="새로고침">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-500 text-xs">로딩 중...</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#374766]/30">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1a2035]/60">
                  {['가입일', '이름', '이메일', '연락처', '회사/부서', '역할', '상태', '마지막 로그인', '관리'].map(h => (
                    <th key={h} className={`px-3 py-2.5 text-slate-400 font-medium whitespace-nowrap ${h === '관리' || h === '상태' || h === '역할' ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => (
                  <tr key={m.id} className={`border-t border-[#374766]/20 hover:bg-[#1a2035]/30 ${i % 2 ? 'bg-[#1a2035]/10' : ''}`}>
                    <td className="px-3 py-2.5 text-slate-500 text-[10px] whitespace-nowrap">{m.created_at?.split(' ')[0]}</td>
                    <td className="px-3 py-2.5 text-slate-200 font-medium whitespace-nowrap">{m.name || '-'}</td>
                    <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{m.email}</td>
                    <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{m.phone || '-'}</td>
                    <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{[m.company, m.department].filter(Boolean).join(' / ') || '-'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${ROLE_COLORS[m.role] || ROLE_COLORS.free_viewer}`}>
                        {ROLE_LABELS[m.role] || m.role}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[m.status] || STATUS_COLORS.active}`}>
                        {STATUS_LABELS[m.status] || m.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 text-[10px] whitespace-nowrap">{m.last_login_at || '없음'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="relative inline-block">
                        <button onClick={() => setActionOpen(actionOpen === m.id ? null : m.id)}
                          className="p-1.5 rounded-lg hover:bg-[#374766]/40 text-slate-400 hover:text-slate-200">
                          <MoreVertical size={14} />
                        </button>
                        {actionOpen === m.id && (
                          <div className="absolute right-0 top-7 z-20 w-44 bg-[#1a2035] border border-[#374766]/50 rounded-xl shadow-2xl overflow-hidden">
                            {/* 캠페인 담당자 지정/해제 (광고주/대행사) */}
                            {m.role !== 'admin' && (
                              <button onClick={() => handleRoleChange(m.id, m.role === 'advertiser' ? 'free_viewer' : 'advertiser')}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-300 hover:bg-[#374766]/30">
                                <Megaphone size={12} className="text-cyan-400" />
                                {m.role === 'advertiser' ? '담당자 해제' : '캠페인 담당자 지정'}
                              </button>
                            )}
                            {/* 테스터 지정/해제 */}
                            {m.role !== 'admin' && (
                              <button onClick={() => handleRoleChange(m.id, m.role === 'tester' ? 'free_viewer' : 'tester')}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-300 hover:bg-[#374766]/30 border-t border-[#374766]/30">
                                <Shield size={12} className="text-amber-400" />
                                {m.role === 'tester' ? '테스터 해제' : '테스터 지정'}
                              </button>
                            )}
                            {/* 유료 전환 */}
                            {m.role !== 'admin' && m.role !== 'paid_user' && (
                              <button onClick={() => handleRoleChange(m.id, 'paid_user')}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-300 hover:bg-[#374766]/30 border-t border-[#374766]/30">
                                <DollarSign size={12} className="text-indigo-400" /> 유료 전환
                              </button>
                            )}
                            {/* 무료로 되돌리기 */}
                            {m.role !== 'admin' && m.role !== 'free_viewer' && (
                              <button onClick={() => handleRoleChange(m.id, 'free_viewer')}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-300 hover:bg-[#374766]/30 border-t border-[#374766]/30">
                                <User size={12} className="text-slate-400" /> 일반 회원으로
                              </button>
                            )}
                            {/* 정지/활성 */}
                            {m.role !== 'admin' && (
                              <button onClick={() => handleStatusChange(m.id, m.status === 'active' ? 'suspended' : 'active')}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-300 hover:bg-[#374766]/30 border-t border-[#374766]/30">
                                {m.status === 'active'
                                  ? <><Pause size={12} className="text-red-400" /> 계정 정지</>
                                  : <><CheckCircle2 size={12} className="text-green-400" /> 활성 복구</>
                                }
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500 text-xs">검색 결과가 없습니다</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {actionOpen && <div className="fixed inset-0 z-10" onClick={() => setActionOpen(null)} />}
      </GlassCard>

      {/* 유저별 사용량 */}
      {usageData?.byUser?.length > 0 && (
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Activity size={14} className="text-amber-400" /> 오늘 API 사용량 (유저별)
          </h3>
          <div className="space-y-2">
            {usageData.byUser.map((u, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="text-slate-400 w-32 truncate">{u.name || u.email}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${ROLE_COLORS[u.role] || ''}`}>{ROLE_LABELS[u.role]}</span>
                <div className="flex-1 bg-dark-700 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                    style={{ width: `${Math.min(100, (u.units / 500) * 100)}%` }} />
                </div>
                <span className="text-slate-300 font-mono w-16 text-right">{u.requests}회</span>
                <span className="text-slate-500 font-mono w-20 text-right">{u.units} units</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
