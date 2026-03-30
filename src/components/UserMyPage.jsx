import { useState } from 'react';
import {
  User, Building2, Mail, PlayCircle, Tv, CreditCard, Download,
  AlertCircle, Zap, TrendingUp, Settings, BarChart3, Receipt
} from 'lucide-react';
import { GlassCard } from './shared';

const RECEIPT_DATA = [
  { id: 'INV-2026-03', date: '2026-03-29', plan: 'Professional', amount: 99000, method: '신한카드 ****1234' },
  { id: 'INV-2026-02', date: '2026-02-29', plan: 'Professional', amount: 99000, method: '신한카드 ****1234' },
  { id: 'INV-2026-01', date: '2026-01-29', plan: 'Professional', amount: 99000, method: '신한카드 ****1234' },
];

function ProgressBar({ value, max, color, label, sublabel }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const isHigh = pct >= 80;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-slate-300">{label}</span>
        <span className={`font-mono ${isHigh ? 'text-amber-400' : 'text-slate-400'}`}>
          {typeof value === 'number' && value < 100 ? value.toLocaleString() : value.toLocaleString()} / {max.toLocaleString()} {sublabel}
        </span>
      </div>
      <div className="h-2.5 bg-[#1a2035] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${isHigh ? 'bg-gradient-to-r from-amber-500 to-orange-500' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-end mt-0.5">
        <span className={`text-[10px] ${isHigh ? 'text-amber-400' : 'text-slate-500'}`}>{pct}% 사용</span>
      </div>
    </div>
  );
}

export default function UserMyPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [ytToggle, setYtToggle] = useState(true);
  const [afToggle, setAfToggle] = useState(false);
  const [autoRenew, setAutoRenew] = useState(true);

  const tabs = [
    { id: 'profile', label: '프로필 설정', icon: User },
    { id: 'subscription', label: '구독 및 결제', icon: CreditCard },
    { id: 'usage', label: '사용량 확인', icon: BarChart3 },
  ];

  const reportPct = 23 / 50;
  const apiPct = 1234 / 5000;
  const isUpgradeNeeded = reportPct >= 0.8 || apiPct >= 0.8;

  return (
    <div className="flex min-h-full">
      {/* Inner Sidebar */}
      <aside className="w-[196px] min-w-[196px] border-r border-[#374766]/30 p-3 space-y-1">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider px-3 mb-3">마이페이지</p>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                  : 'text-slate-400 hover:bg-[#1a2035] hover:text-slate-200'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl space-y-5">

          {/* ── 프로필 설정 ── */}
          {activeTab === 'profile' && (
            <>
              <div>
                <h2 className="text-base font-bold text-white">프로필 설정</h2>
                <p className="text-xs text-slate-500 mt-0.5">계정 정보 및 API 연동을 관리합니다</p>
              </div>

              <GlassCard className="p-6 space-y-5">
                <div className="flex items-center gap-4 pb-5 border-b border-[#374766]/30">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500/40 to-purple-500/40 flex items-center justify-center text-xl font-bold text-white">강</div>
                  <div>
                    <div className="text-sm font-bold text-white">강은충</div>
                    <div className="text-xs text-slate-400">kangeun1@naver.com</div>
                    <span className="mt-1.5 inline-block text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">Professional 플랜</span>
                  </div>
                </div>
                {[
                  { label: '이름', value: '강은충', icon: User },
                  { label: '회사명', value: '더블엠컴퍼니', icon: Building2 },
                  { label: '이메일', value: 'kangeun1@naver.com', icon: Mail },
                ].map((field, i) => (
                  <div key={i}>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                    <div className="relative">
                      <field.icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        defaultValue={field.value}
                        className="w-full bg-[#1a2035] border border-[#374766]/50 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
                      />
                    </div>
                  </div>
                ))}
                <button className="px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors">
                  변경사항 저장
                </button>
              </GlassCard>

              <GlassCard className="p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Settings size={14} className="text-slate-400" /> API 연동 관리
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'YouTube Data API', desc: 'YouTube 채널 & 영상 분석', icon: PlayCircle, iconColor: 'text-red-400', value: ytToggle, set: setYtToggle },
                    { label: 'AfreecaTV API', desc: '아프리카TV BJ 데이터 연동', icon: Tv, iconColor: 'text-blue-400', value: afToggle, set: setAfToggle },
                  ].map((api, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#1a2035]/50 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#0a0e1a] flex items-center justify-center">
                          <api.icon size={16} className={api.iconColor} />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-white">{api.label}</div>
                          <div className="text-[10px] text-slate-500">{api.desc}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => api.set(!api.value)}
                        className={`relative w-11 h-6 rounded-full transition-all duration-300 ${api.value ? 'bg-indigo-500' : 'bg-[#374766]'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${api.value ? 'left-[22px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </>
          )}

          {/* ── 구독 및 결제 ── */}
          {activeTab === 'subscription' && (
            <>
              <div>
                <h2 className="text-base font-bold text-white">구독 및 결제</h2>
                <p className="text-xs text-slate-500 mt-0.5">플랜 및 결제 정보를 관리합니다</p>
              </div>

              <GlassCard className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Zap size={16} className="text-indigo-400" />
                      <span className="text-sm font-bold text-white">Professional 플랜</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">활성</span>
                    </div>
                    <p className="text-xs text-slate-400">월 50 리포트 · API 5,000회 · 팀원 5명</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-white">₩99,000</div>
                    <div className="text-[10px] text-slate-500">/월 (VAT 포함)</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-[#374766]/30 grid grid-cols-3 gap-4">
                  {[
                    { label: '다음 결제일', value: '2026년 4월 29일' },
                    { label: '결제 수단', value: '신한카드 ****1234' },
                    { label: '자동 갱신', value: autoRenew ? '켜짐' : '꺼짐' },
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="text-[10px] text-slate-500 mb-0.5">{item.label}</div>
                      <div className="text-xs font-medium text-white">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors">
                    플랜 업그레이드
                  </button>
                  <button
                    onClick={() => setAutoRenew(!autoRenew)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 border border-[#374766]/50 hover:text-slate-200 transition-colors"
                  >
                    자동갱신 {autoRenew ? '해제' : '설정'}
                  </button>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <CreditCard size={14} className="text-blue-400" /> 결제 수단
                </h3>
                <div className="flex items-center justify-between bg-[#1a2035]/60 rounded-xl p-4 border border-[#374766]/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 rounded bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
                      <span className="text-white font-bold text-[8px]">VISA</span>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-white">신한카드 Visa</div>
                      <div className="text-[10px] text-slate-400">**** **** **** 1234 · 유효기간 08/28</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">기본</span>
                    <button className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">변경</button>
                  </div>
                </div>
                <button className="mt-3 text-xs text-indigo-400 hover:underline">+ 새 결제 수단 추가</button>
              </GlassCard>

              <GlassCard className="p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Receipt size={14} className="text-amber-400" /> 영수증 내역
                </h3>
                <div className="overflow-hidden rounded-lg border border-[#374766]/30">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#1a2035]/50">
                        <th className="px-4 py-2.5 text-left text-slate-400 font-medium">날짜</th>
                        <th className="px-4 py-2.5 text-left text-slate-400 font-medium">플랜</th>
                        <th className="px-4 py-2.5 text-right text-slate-400 font-medium">금액</th>
                        <th className="px-4 py-2.5 text-center text-slate-400 font-medium">상태</th>
                        <th className="px-4 py-2.5 text-center text-slate-400 font-medium">영수증</th>
                      </tr>
                    </thead>
                    <tbody>
                      {RECEIPT_DATA.map((r, i) => (
                        <tr key={r.id} className={i % 2 === 0 ? 'bg-[#1a2035]/20' : ''}>
                          <td className="px-4 py-2.5 text-slate-300">{r.date}</td>
                          <td className="px-4 py-2.5 text-slate-200">{r.plan}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-200">₩{r.amount.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">완료</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors mx-auto">
                              <Download size={11} /> PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </>
          )}

          {/* ── 사용량 확인 ── */}
          {activeTab === 'usage' && (
            <>
              <div>
                <h2 className="text-base font-bold text-white">사용량 확인</h2>
                <p className="text-xs text-slate-500 mt-0.5">이번 달 플랜 사용 현황 (2026년 3월)</p>
              </div>

              {isUpgradeNeeded && (
                <div className="bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle size={18} className="text-amber-400 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-amber-300">사용량이 80%를 초과했습니다</div>
                      <div className="text-xs text-amber-400/70 mt-0.5">업그레이드하면 제한 없이 사용할 수 있습니다</div>
                    </div>
                  </div>
                  <button className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg hover:shadow-amber-500/20 transition-all whitespace-nowrap">
                    업그레이드
                  </button>
                </div>
              )}

              <GlassCard className="p-6 space-y-6">
                <ProgressBar value={23} max={50} color="bg-gradient-to-r from-indigo-500 to-purple-500" label="리포트 생성" sublabel="건" />
                <ProgressBar value={1234} max={5000} color="bg-gradient-to-r from-emerald-500 to-cyan-500" label="API 호출" sublabel="회" />
                <ProgressBar value={3.2} max={10} color="bg-gradient-to-r from-blue-500 to-indigo-500" label="데이터 저장 (GB)" sublabel="GB" />
              </GlassCard>

              <GlassCard className="p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp size={14} className="text-green-400" /> 플랜 한도 요약
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: '리포트 생성', used: 23, max: 50, unit: '건', from: 'from-indigo-500/20', to: 'to-purple-500/20', border: 'border-indigo-500/20', text: 'text-indigo-300' },
                    { label: 'API 호출', used: 1234, max: 5000, unit: '회', from: 'from-emerald-500/20', to: 'to-cyan-500/20', border: 'border-emerald-500/20', text: 'text-emerald-300' },
                    { label: '팀원', used: 2, max: 5, unit: '명', from: 'from-blue-500/20', to: 'to-indigo-500/20', border: 'border-blue-500/20', text: 'text-blue-300' },
                  ].map((item, i) => (
                    <div key={i} className={`bg-gradient-to-br ${item.from} ${item.to} border ${item.border} rounded-xl p-4`}>
                      <div className="text-[10px] text-slate-400 mb-2">{item.label}</div>
                      <div className={`text-xl font-bold ${item.text}`}>
                        {item.used.toLocaleString()}
                        <span className="text-xs font-normal text-slate-500 ml-1">{item.unit}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">한도 {item.max.toLocaleString()}{item.unit}</div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
