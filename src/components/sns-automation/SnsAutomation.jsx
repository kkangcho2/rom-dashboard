import { useState, useEffect } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Sparkles, ArrowLeft, Lightbulb, FileText, Upload, MessageSquare,
  Users, CreditCard, BarChart3, TrendingUp, Calendar, Zap,
  ChevronDown
} from 'lucide-react';
import { GlassCard, MiniTooltip } from '../shared';
import { getSnsStats } from '../../api';
import ContentPlanningTab from './ContentPlanningTab';
import ScriptGeneratorTab from './ScriptGeneratorTab';
import UploadSchedulerTab from './UploadSchedulerTab';
import AutoResponseTab from './AutoResponseTab';
import LeadManagementTab from './LeadManagementTab';
import PricingPackagesTab from './PricingPackagesTab';

const INDUSTRIES = [
  { id: 'beauty_salon', label: '미용실', emoji: '💇' },
  { id: 'hospital', label: '병원', emoji: '🏥' },
  { id: 'fitness', label: '헬스/PT', emoji: '💪' },
  { id: 'restaurant', label: '카페/레스토랑', emoji: '☕' },
  { id: 'education', label: '학원/교육', emoji: '📚' },
];

const TABS = [
  { id: 'dashboard', label: '대시보드', icon: BarChart3, color: 'indigo' },
  { id: 'planning', label: '콘텐츠 기획', icon: Lightbulb, color: 'indigo' },
  { id: 'scripts', label: '스크립트 생성', icon: FileText, color: 'purple' },
  { id: 'schedule', label: '업로드 자동화', icon: Upload, color: 'cyan' },
  { id: 'responses', label: '자동응대', icon: MessageSquare, color: 'amber' },
  { id: 'leads', label: '리드 관리', icon: Users, color: 'green' },
  { id: 'packages', label: '패키지 관리', icon: CreditCard, color: 'pink' },
];

function DashboardOverview({ stats }) {
  const planStatusData = (stats?.plansByStatus || []).map(s => {
    const labels = { idea: '아이디어', planned: '기획 완료', in_production: '제작 중', ready: '대기', published: '게시' };
    return { name: labels[s.status] || s.status, value: s.cnt };
  });

  const leadPlatformData = (stats?.leadsByPlatform || []).map(s => ({
    name: s.platform, value: s.cnt,
  }));

  const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <div className="space-y-4">
      {/* KPI 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '콘텐츠 기획', value: stats?.totalPlans || 0, icon: Lightbulb, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { label: '스크립트', value: stats?.totalScripts || 0, icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: '업로드 예약', value: stats?.scheduledPending || 0, icon: Calendar, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: '활성 자동응대', value: stats?.activeResponses || 0, icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <GlassCard key={i} className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${kpi.bg}`}>
                  <Icon size={16} className={kpi.color} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{kpi.value}</p>
                  <p className="text-[10px] text-slate-500">{kpi.label}</p>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* 리드 전환 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-400">총 리드</p>
            <Users size={14} className="text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white">{stats?.totalLeads || 0}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-blue-300">신규 {stats?.newLeads || 0}</span>
            <span className="text-[10px] text-green-300">전환 {stats?.convertedLeads || 0}</span>
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-400">전환율</p>
            <TrendingUp size={14} className="text-green-400" />
          </div>
          <p className="text-2xl font-bold text-green-400">{stats?.conversionRate || 0}%</p>
          <p className="text-[10px] text-slate-500 mt-1">리드 → 고객 전환</p>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-400">총 스케줄</p>
            <Upload size={14} className="text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white">{stats?.totalSchedules || 0}</p>
          <p className="text-[10px] text-slate-500 mt-1">예약 대기 {stats?.scheduledPending || 0}건</p>
        </GlassCard>
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {planStatusData.length > 0 && (
          <GlassCard className="p-4">
            <h3 className="text-xs font-bold text-slate-300 mb-3">콘텐츠 상태 분포</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planStatusData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip content={<MiniTooltip />} />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        )}
        {leadPlatformData.length > 0 && (
          <GlassCard className="p-4">
            <h3 className="text-xs font-bold text-slate-300 mb-3">플랫폼별 리드</h3>
            <div className="h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={leadPlatformData} cx="50%" cy="50%" outerRadius={60} innerRadius={30} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {leadPlatformData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<MiniTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        )}
      </div>

      {/* 시스템 구조 다이어그램 */}
      <GlassCard className="p-4">
        <h3 className="text-xs font-bold text-white mb-3">전체 자동화 파이프라인</h3>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {[
            { label: '콘텐츠 기획', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
            { label: '→', color: 'text-slate-500' },
            { label: '스크립트 생성', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
            { label: '→', color: 'text-slate-500' },
            { label: '영상 제작', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
            { label: '→', color: 'text-slate-500' },
            { label: '업로드 자동화', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
            { label: '→', color: 'text-slate-500' },
            { label: '댓글/DM 자동응대', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
            { label: '→', color: 'text-slate-500' },
            { label: '리드 → 고객 전환', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
          ].map((step, i) => (
            step.label === '→'
              ? <span key={i} className={step.color}>→</span>
              : <span key={i} className={`px-2.5 py-1 rounded-lg border font-medium ${step.color}`}>{step.label}</span>
          ))}
        </div>
      </GlassCard>

      {/* Zapier 시나리오 가이드 */}
      <GlassCard className="p-4">
        <h3 className="text-xs font-bold text-white mb-3">Zapier 자동화 시나리오</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: '콘텐츠 자동 생성', trigger: 'Google Sheets에 주제 입력', actions: ['ChatGPT → 스크립트 생성', 'ChatGPT → 제목 + 해시태그 생성', 'Notion / Airtable 저장'] },
            { title: '영상 제작 연동', trigger: 'Notion에 "영상 제작" 상태 변경', actions: ['스크립트 → 영상 툴 전송', '완성 영상 Google Drive 저장'] },
            { title: '업로드 자동화', trigger: 'Google Drive에 영상 업로드', actions: ['Buffer / SNS 툴 예약 업로드', '제목/해시태그 자동 입력'] },
            { title: 'DM → 리드 전환', trigger: 'DM 수신', actions: ['키워드 분석 (가격, 예약 등)', 'ChatGPT 답변 생성', 'Google Sheets 고객 정보 저장'] },
          ].map((scenario, i) => (
            <div key={i} className="p-3 bg-dark-700/40 rounded-lg border border-dark-600/30">
              <h4 className="text-xs font-bold text-indigo-300 mb-1.5">{scenario.title}</h4>
              <p className="text-[10px] text-slate-500 mb-1.5">Trigger: {scenario.trigger}</p>
              <div className="space-y-0.5">
                {scenario.actions.map((a, j) => (
                  <p key={j} className="text-[10px] text-slate-400">{j + 1}. {a}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

export default function SnsAutomation({ onBack }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedIndustry, setSelectedIndustry] = useState('beauty_salon');
  const [stats, setStats] = useState(null);
  const [showIndustryMenu, setShowIndustryMenu] = useState(false);

  useEffect(() => {
    getSnsStats().then(setStats).catch(() => {});
  }, [activeTab]);

  const currentIndustry = INDUSTRIES.find(i => i.id === selectedIndustry);

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 bg-[#0a0e1a]/90 backdrop-blur-xl border-b border-[#374766]/30">
        <div className="max-w-[1400px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-dark-700/60 text-slate-400 hover:text-white transition-all">
                <ArrowLeft size={16} />
              </button>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center">
                <Sparkles size={15} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white">SNS 자동화 시스템</h1>
                <p className="text-[10px] text-slate-500">콘텐츠 제작 → 업로드 → 고객응대 자동화</p>
              </div>
            </div>

            {/* 업종 선택 */}
            <div className="relative">
              <button onClick={() => setShowIndustryMenu(!showIndustryMenu)}
                className="flex items-center gap-2 px-3 py-1.5 bg-dark-700/60 border border-dark-600/40 rounded-lg text-xs text-slate-300 hover:border-indigo-500/40 transition-all">
                <span>{currentIndustry?.emoji}</span>
                <span className="font-medium">{currentIndustry?.label}</span>
                <ChevronDown size={12} className={`transition-transform ${showIndustryMenu ? 'rotate-180' : ''}`} />
              </button>
              {showIndustryMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-[#1a2035] border border-[#374766]/50 rounded-lg shadow-xl z-40 py-1">
                  {INDUSTRIES.map(ind => (
                    <button key={ind.id} onClick={() => { setSelectedIndustry(ind.id); setShowIndustryMenu(false); }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-dark-700/60 transition-colors ${selectedIndustry === ind.id ? 'text-indigo-300 bg-indigo-500/10' : 'text-slate-300'}`}>
                      <span>{ind.emoji}</span> {ind.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <nav className="flex items-center gap-1 mt-3 overflow-x-auto pb-1 scrollbar-thin">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? `bg-${tab.color}-500/20 text-${tab.color}-300 border border-${tab.color}-500/30`
                      : 'text-slate-400 hover:text-white hover:bg-dark-700/60 border border-transparent'
                  }`}>
                  <Icon size={12} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* 콘텐츠 영역 */}
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        {activeTab === 'dashboard' && <DashboardOverview stats={stats} />}
        {activeTab === 'planning' && <ContentPlanningTab selectedIndustry={selectedIndustry} />}
        {activeTab === 'scripts' && <ScriptGeneratorTab selectedIndustry={selectedIndustry} />}
        {activeTab === 'schedule' && <UploadSchedulerTab />}
        {activeTab === 'responses' && <AutoResponseTab selectedIndustry={selectedIndustry} />}
        {activeTab === 'leads' && <LeadManagementTab />}
        {activeTab === 'packages' && <PricingPackagesTab />}
      </main>
    </div>
  );
}
