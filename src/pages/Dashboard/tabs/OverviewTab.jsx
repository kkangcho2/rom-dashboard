import { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Line
} from 'recharts';
import { Eye, Users, Clock, MessageSquare, Target, Activity, Flame, BarChart3 } from 'lucide-react';
import { GlassCard, StatCard } from '../../../components/ui';
import { CustomTooltip } from '../../../components/charts';

export default function OverviewTab({ data }) {
  const [viewerTimeRange, setViewerTimeRange] = useState('hourly');

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={Eye} label="최고 시청자" value={data.stats.maxViewers} sub="피크 시점" color="text-indigo-400" delay={0} />
        <StatCard icon={Users} label="평균 시청자" value={data.stats.avgViewers} color="text-blue-400" delay={100} />
        <StatCard icon={Clock} label="총 방송 시간" value={data.stats.totalTime} sub={data.stats.timeRange} color="text-purple-400" delay={200} />
        <StatCard icon={MessageSquare} label="CPM (채팅 밀도)" value={data.stats.cpm} sub="분당 평균 채팅" color="text-emerald-400" delay={300} />
        <StatCard icon={Target} label="광고 도달률" value={data.stats.adScore} sub="예상 점수" color="text-amber-400" delay={400} />
      </div>

      {/* Main Chart */}
      <GlassCard className="!p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Activity size={16} className="text-accent-light" />
            시청자 & 채팅 추이
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-dark-700 rounded-lg p-0.5 border border-dark-600/50">
              {[
                { id: 'hourly', label: '시간별' },
                { id: 'daily', label: '일별' },
                { id: 'monthly', label: '월별' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setViewerTimeRange(opt.id)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                    viewerTimeRange === opt.id
                      ? 'bg-accent/20 text-accent-light border border-accent/30'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400" /> 시청자</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> 채팅수</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> 감성</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={viewerTimeRange === 'hourly' ? data.viewerTimeline : viewerTimeRange === 'daily' ? data.dailyTimeline : data.monthlyTimeline} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="viewerGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="chatGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} />
            <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} />
            <Tooltip content={<CustomTooltip />} />
            <Area yAxisId="left" type="monotone" dataKey="viewers" stroke="#6366f1" fill="url(#viewerGrad)" strokeWidth={2} name="시청자" dot={false} />
            <Area yAxisId="right" type="monotone" dataKey="chat" stroke="#22c55e" fill="url(#chatGrad)" strokeWidth={2} name="채팅수" dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="sentiment" stroke="#f59e0b" strokeWidth={2} name="감성" dot={false} strokeDasharray="5 5" />
          </AreaChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* Content Preference Analysis */}
      <GlassCard>
        <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
          <Flame size={16} className="text-orange-400" /> 콘텐츠 선호도 분석
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="overflow-hidden rounded-lg border border-dark-600/30">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-dark-700/60 text-slate-400">
                    <th className="px-3 py-2 text-left font-medium">게임명</th>
                    <th className="px-3 py-2 text-center font-medium">방송 횟수</th>
                    <th className="px-3 py-2 text-center font-medium">평균 시청자</th>
                    <th className="px-3 py-2 text-center font-medium">평균 채팅</th>
                    <th className="px-3 py-2 text-center font-medium">종합 점수</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.contentByGame || []).map((g, i) => (
                    <tr key={i} className={`${i % 2 === 0 ? 'bg-dark-700/30' : ''} text-slate-200`}>
                      <td className="px-3 py-2 font-medium">{g.game}</td>
                      <td className="px-3 py-2 text-center">{g.broadcasts}회</td>
                      <td className="px-3 py-2 text-center">{g.avgViewers.toLocaleString()}</td>
                      <td className="px-3 py-2 text-center">{g.avgChat.toLocaleString()}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-bold ${g.score >= 80 ? 'text-green-400' : g.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{g.score}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={[
                { subject: '시청자', ...(data.contentByGame || []).reduce((acc, g) => ({ ...acc, [g.game]: Math.min(100, Math.round(g.avgViewers / 60)) }), {}) },
                { subject: '채팅', ...(data.contentByGame || []).reduce((acc, g) => ({ ...acc, [g.game]: Math.min(100, Math.round(g.avgChat / 5)) }), {}) },
                { subject: '방송수', ...(data.contentByGame || []).reduce((acc, g) => ({ ...acc, [g.game]: Math.min(100, g.broadcasts * 3.5) }), {}) },
                { subject: '종합', ...(data.contentByGame || []).reduce((acc, g) => ({ ...acc, [g.game]: g.score }), {}) },
              ]}>
                <PolarGrid stroke="#1e293b" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <PolarRadiusAxis tick={{ fill: '#475569', fontSize: 9 }} domain={[0, 100]} />
                {(data.contentByGame || []).map((g, i) => (
                  <Radar key={g.game} name={g.game} dataKey={g.game} stroke={['#6366f1','#22c55e','#f59e0b'][i]} fill={['#6366f1','#22c55e','#f59e0b'][i]} fillOpacity={0.15} strokeWidth={2} />
                ))}
                <Legend wrapperStyle={{ fontSize: '10px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
