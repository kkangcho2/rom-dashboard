import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Users, TrendingUp, DollarSign, FileText,
  MoreVertical, Edit3, Pause, Trash2, CheckCircle2, AlertTriangle, UserX
} from 'lucide-react';
import { GlassCard } from './shared';

// ─── Dummy 30-day trend data ──────────────────────────────────
const TREND_DATA = Array.from({ length: 30 }, (_, i) => {
  const d = new Date('2026-03-01');
  d.setDate(d.getDate() + i);
  const label = `${d.getMonth() + 1}/${d.getDate()}`;
  return {
    date: label,
    가입자: Math.round(72 + i * 0.43 + Math.sin(i * 0.6) * 1.8),
    MRR: Math.round(3200000 + i * 32000 + Math.sin(i * 0.4) * 40000),
    리포트: Math.round(7 + i * 0.17 + Math.sin(i * 0.8) * 2.5),
  };
});

// ─── Dummy member data ────────────────────────────────────────
const MEMBERS = [
  {
    id: 1, joinDate: '2026-01-12', company: '더블엠컴퍼니', name: '강은충',
    email: 'kangeun1@naver.com', plan: 'Professional', usage: 234, status: 'active',
  },
  {
    id: 2, joinDate: '2026-01-28', company: 'ROM 프로모션팀', name: '이지현',
    email: 'jh.lee@rom.co.kr', plan: 'Enterprise', usage: 891, status: 'active',
  },
  {
    id: 3, joinDate: '2026-02-05', company: '크리에이터 에이전시', name: '박준호',
    email: 'juno@creator-agency.kr', plan: 'Professional', usage: 156, status: 'active',
  },
  {
    id: 4, joinDate: '2026-02-19', company: '모바일게임마케팅', name: '김수연',
    email: 'suyeon.kim@mgm.kr', plan: 'Starter', usage: 45, status: 'active',
  },
  {
    id: 5, joinDate: '2026-03-03', company: 'BJ 엔터테인먼트', name: '최민재',
    email: 'mj.choi@bje.co.kr', plan: 'Professional', usage: 312, status: 'suspended',
  },
];

const PLAN_COLORS = {
  Enterprise: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  Professional: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  Starter: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const STATUS_COLORS = {
  active: 'bg-green-500/20 text-green-400',
  suspended: 'bg-red-500/20 text-red-400',
};

const STATUS_LABELS = { active: '활성', suspended: '정지' };

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a2035] border border-[#374766]/50 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="text-white font-mono">
            {p.name === 'MRR' ? `₩${Number(p.value).toLocaleString()}` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SuperAdminPage() {
  const [actionOpen, setActionOpen] = useState(null);
  const [members, setMembers] = useState(MEMBERS);
  const [chartMode, setChartMode] = useState('가입자');

  const totalMembers = members.length;
  const activeSubscriptions = members.filter(m => m.status === 'active' && m.plan !== 'Starter').length;
  const mrr = 4158000;
  const todayReports = 12;

  const handleAction = (id, action) => {
    if (action === 'suspend') {
      setMembers(prev => prev.map(m => m.id === id ? { ...m, status: m.status === 'active' ? 'suspended' : 'active' } : m));
    } else if (action === 'delete') {
      setMembers(prev => prev.filter(m => m.id !== id));
    }
    setActionOpen(null);
  };

  return (
    <div className="p-8 space-y-6">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '총 가입자', value: `${totalMembers}명`, icon: Users, color: 'text-blue-400', bg: 'from-blue-500/10 to-blue-500/5', sub: '이번 달 +3명', subColor: 'text-blue-400' },
          { label: '활성 구독', value: `${activeSubscriptions}건`, icon: CheckCircle2, color: 'text-green-400', bg: 'from-green-500/10 to-green-500/5', sub: '전월 대비 +8%', subColor: 'text-green-400' },
          { label: '이번 달 MRR', value: `₩${mrr.toLocaleString()}`, icon: DollarSign, color: 'text-indigo-400', bg: 'from-indigo-500/10 to-indigo-500/5', sub: '전월 대비 +12.4%', subColor: 'text-indigo-400' },
          { label: '일일 리포트 생성', value: `${todayReports}건`, icon: FileText, color: 'text-amber-400', bg: 'from-amber-500/10 to-amber-500/5', sub: '오늘 기준', subColor: 'text-slate-500' },
        ].map((s, i) => (
          <GlassCard key={i} className={`p-5 bg-gradient-to-br ${s.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</span>
              <div className={`w-7 h-7 rounded-lg bg-[#1a2035]/60 flex items-center justify-center`}>
                <s.icon size={13} className={s.color} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{s.value}</div>
            <div className={`text-[10px] ${s.subColor}`}>{s.sub}</div>
          </GlassCard>
        ))}
      </div>

      {/* ── Trend Chart ── */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp size={14} className="text-indigo-400" /> 최근 30일 성장 추이
          </h3>
          <div className="flex gap-1">
            {['가입자', 'MRR', '리포트'].map(mode => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-all ${
                  chartMode === mode
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={TREND_DATA} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="gradMain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374766" opacity={0.3} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => chartMode === 'MRR' ? `₩${(v / 10000).toFixed(0)}만` : v}
              width={chartMode === 'MRR' ? 50 : 30}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={chartMode}
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#gradMain)"
              dot={false}
              activeDot={{ r: 4, fill: '#6366f1', stroke: '#0a0e1a', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* ── Member Table ── */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users size={14} className="text-blue-400" /> 회원 관리
          </h3>
          <span className="text-[10px] text-slate-500">{members.length}명</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-[#374766]/30">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#1a2035]/60">
                {['가입일', '소속사', '이름', '이메일', '요금제', '누적사용량', '상태', '관리'].map(h => (
                  <th key={h} className={`px-4 py-3 text-slate-400 font-medium ${h === '관리' || h === '상태' || h === '누적사용량' ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m.id} className={`border-t border-[#374766]/20 transition-colors hover:bg-[#1a2035]/30 ${i % 2 === 0 ? '' : 'bg-[#1a2035]/10'}`}>
                  <td className="px-4 py-3 text-slate-400 text-[10px] whitespace-nowrap">{m.joinDate}</td>
                  <td className="px-4 py-3 text-slate-200 font-medium whitespace-nowrap">{m.company}</td>
                  <td className="px-4 py-3 text-slate-200">{m.name}</td>
                  <td className="px-4 py-3 text-slate-400">{m.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${PLAN_COLORS[m.plan] || PLAN_COLORS.Starter}`}>
                      {m.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-slate-300">{m.usage.toLocaleString()}건</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[m.status]}`}>
                      {STATUS_LABELS[m.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setActionOpen(actionOpen === m.id ? null : m.id)}
                        className="p-1.5 rounded-lg hover:bg-[#374766]/40 transition-colors text-slate-400 hover:text-slate-200"
                      >
                        <MoreVertical size={14} />
                      </button>
                      {actionOpen === m.id && (
                        <div className="absolute right-0 top-7 z-20 w-32 bg-[#1a2035] border border-[#374766]/50 rounded-xl shadow-2xl overflow-hidden">
                          <button
                            onClick={() => { setActionOpen(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-300 hover:bg-[#374766]/30 transition-colors"
                          >
                            <Edit3 size={12} className="text-blue-400" /> 정보 수정
                          </button>
                          <button
                            onClick={() => handleAction(m.id, 'suspend')}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-300 hover:bg-[#374766]/30 transition-colors"
                          >
                            {m.status === 'active'
                              ? <><Pause size={12} className="text-amber-400" /> 계정 정지</>
                              : <><CheckCircle2 size={12} className="text-green-400" /> 활성 복구</>
                            }
                          </button>
                          <button
                            onClick={() => handleAction(m.id, 'delete')}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors border-t border-[#374766]/30"
                          >
                            <Trash2 size={12} /> 계정 삭제
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Close dropdown on outside click overlay */}
        {actionOpen && (
          <div className="fixed inset-0 z-10" onClick={() => setActionOpen(null)} />
        )}
      </GlassCard>
    </div>
  );
}
