import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  X, Edit3, MoreVertical,
  AlertTriangle, CheckCircle2, TrendingUp,
  RefreshCw, Pause, Receipt,
  DollarSign, Wallet, BadgeCheck, Info
} from 'lucide-react';
import { GlassCard, MiniTooltip } from './shared';

export default function PaymentAdminPage() {
  const [payFilter, setPayFilter] = useState('all');
  const [subAction, setSubAction] = useState(null);

  const subscriptions = [];
  const payments = [];
  const monthlyRevenue = [];

  const filteredPayments = payFilter === 'all' ? payments : payments.filter(p => p.status === payFilter);

  const statusColors = {
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    refunded: 'bg-amber-500/20 text-amber-400',
    free: 'bg-slate-500/20 text-slate-400',
  };

  const subStatusColors = {
    active: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-slate-500/20 text-slate-400',
    overdue: 'bg-red-500/20 text-red-400',
    free: 'bg-blue-500/20 text-blue-400',
  };

  return (
    <div className="p-8 space-y-6">
      {/* Preparation Notice */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4 flex items-center gap-3">
        <Info size={16} className="text-indigo-400 shrink-0" />
        <span className="text-xs text-indigo-300">결제 시스템 연동 준비 중입니다. 현재 표시되는 데이터는 실제 결제 정보가 아닙니다.</span>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '이번 달 MRR', value: '-', icon: DollarSign, color: 'text-green-400', sub: '결제 연동 후 표시' },
          { label: '유료 구독자', value: '0명', icon: BadgeCheck, color: 'text-indigo-400', sub: '구독자 없음' },
          { label: '이번 달 매출', value: '-', icon: Wallet, color: 'text-amber-400', sub: '결제 연동 후 표시' },
          { label: '미수금/연체', value: '0건', icon: AlertTriangle, color: 'text-green-400', sub: '정상' },
        ].map((s, i) => (
          <GlassCard key={i} className="p-4">
            <div className="flex items-center gap-2 mb-2"><s.icon size={14} className={s.color} /><span className="text-[10px] text-slate-500 uppercase">{s.label}</span></div>
            <div className="text-xl font-bold text-white">{s.value}</div>
            <div className="text-[10px] text-slate-500">{s.sub}</div>
          </GlassCard>
        ))}
      </div>

      {/* Revenue Chart */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-green-400" /> 월별 매출 & 구독 추이</h3>
        <div className="flex items-center justify-center h-[220px] text-slate-500 text-xs">
          결제 시스템 연동 준비 중입니다
        </div>
      </GlassCard>

      {/* Subscription Management */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><BadgeCheck size={14} className="text-indigo-400" /> 구독 관리</h3>
        </div>
        <div className="overflow-hidden rounded-lg border border-[#374766]/30">
          <table className="w-full text-xs">
            <thead><tr className="bg-[#1a2035]/50">
              <th className="px-4 py-2.5 text-left text-slate-400 font-medium">회사 / 담당자</th>
              <th className="px-4 py-2.5 text-left text-slate-400 font-medium">플랜</th>
              <th className="px-4 py-2.5 text-right text-slate-400 font-medium">월 금액</th>
              <th className="px-4 py-2.5 text-center text-slate-400 font-medium">시작일</th>
              <th className="px-4 py-2.5 text-center text-slate-400 font-medium">다음 결제</th>
              <th className="px-4 py-2.5 text-center text-slate-400 font-medium">자동갱신</th>
              <th className="px-4 py-2.5 text-center text-slate-400 font-medium">상태</th>
              <th className="px-4 py-2.5 text-center text-slate-400 font-medium">관리</th>
            </tr></thead>
            <tbody>
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                구독 정보가 없습니다
              </td></tr>
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Payment History */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Receipt size={14} className="text-amber-400" /> 결제 내역</h3>
          <div className="flex gap-1">
            {[
              { value: 'all', label: '전체' },
              { value: 'completed', label: '완료' },
              { value: 'failed', label: '실패' },
              { value: 'refunded', label: '환불' },
            ].map(f => (
              <button key={f.value} onClick={() => setPayFilter(f.value)} className={`text-[10px] px-2.5 py-1 rounded-md transition-all ${
                payFilter === f.value ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'
              }`}>{f.label}</button>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-[#374766]/30">
          <table className="w-full text-xs">
            <thead><tr className="bg-[#1a2035]/50">
              <th className="px-4 py-2.5 text-left text-slate-400 font-medium">결제 ID</th>
              <th className="px-4 py-2.5 text-left text-slate-400 font-medium">일자</th>
              <th className="px-4 py-2.5 text-left text-slate-400 font-medium">회사 / 결제자</th>
              <th className="px-4 py-2.5 text-left text-slate-400 font-medium">플랜</th>
              <th className="px-4 py-2.5 text-right text-slate-400 font-medium">금액</th>
              <th className="px-4 py-2.5 text-center text-slate-400 font-medium">결제수단</th>
              <th className="px-4 py-2.5 text-center text-slate-400 font-medium">상태</th>
            </tr></thead>
            <tbody>
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                결제 내역이 없습니다
              </td></tr>
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
