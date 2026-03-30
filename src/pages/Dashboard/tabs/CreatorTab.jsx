import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar
} from 'recharts';
import { Monitor, Tv, Target } from 'lucide-react';
import { GlassCard } from '../../../components/ui';
import { CustomTooltip } from '../../../components/charts';

export default function CreatorTab({ data }) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Videos Chart */}
        <GlassCard className="!p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
            <Monitor size={16} className="text-blue-400" /> 최근 10개 영상 지표
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.recentVideos.slice(0, 10)} margin={{ top: 5, right: 5, bottom: 30, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="title" tick={{ fill: '#64748b', fontSize: 9 }} angle={-35} textAnchor="end" interval={0} height={60} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#1e293b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="views" fill="#6366f1" name="조회수" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* LIVE vs VOD */}
        <GlassCard className="!p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
            <Tv size={16} className="text-purple-400" /> LIVE vs VOD 비교
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.liveVsVod} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#1e293b' }} />
              <YAxis type="category" dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="live" fill="#ef4444" name="LIVE" radius={[0, 4, 4, 0]} />
              <Bar dataKey="vod" fill="#3b82f6" name="VOD" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Content Radar */}
      <GlassCard className="!p-5">
        <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
          <Target size={16} className="text-accent-light" /> 콘텐츠 전파력 레이더
        </h3>
        <div className="flex items-center gap-8">
          <ResponsiveContainer width="50%" height={280}>
            <RadarChart data={data.contentRadar}>
              <PolarGrid stroke="#1e293b" />
              <PolarAngleAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fill: '#475569', fontSize: 9 }} />
              <Radar name="점수" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {data.contentRadar.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-28">{d.category}</span>
                <div className="flex-1 h-2 bg-dark-600 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${d.score}%` }} />
                </div>
                <span className="text-xs font-bold text-slate-200 w-8">{d.score}</span>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
