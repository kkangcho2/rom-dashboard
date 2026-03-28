import { useState, useEffect } from 'react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Users, Edit3, MoreVertical, Activity, Database,
  AlertTriangle, CheckCircle2, TrendingUp,
  Server, FileText, Trash2, Pause, Loader2
} from 'lucide-react';
import { GlassCard, MiniTooltip } from './shared';

export default function SuperAdminPage() {
  const [memberAction, setMemberAction] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/stats`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch stats:', err);
        setError('API 연결 실패');
        setLoading(false);
      });
  }, []);

  const totalJobs = stats?.totalJobs ?? 0;
  const completedJobs = stats?.completedJobs ?? 0;
  const failedJobs = stats?.failedJobs ?? 0;
  const totalChannels = stats?.totalChannels ?? 0;
  const totalVideos = stats?.totalVideos ?? 0;
  const recentJobs = stats?.recentJobs ?? [];

  return (
    <div className="p-8 space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '총 MRR', value: loading ? '-' : '실제 API 연동 후 표시', icon: TrendingUp, color: 'text-green-400', sub: '결제 시스템 연동 대기' },
          { label: '총 채널 / 영상', value: loading ? '-' : `${totalChannels} / ${totalVideos}`, icon: Users, color: 'text-blue-400', sub: '수집된 데이터' },
          { label: '완료된 작업', value: loading ? '-' : `${completedJobs}건`, icon: FileText, color: 'text-indigo-400', sub: `전체 ${totalJobs}건 중` },
          { label: '실패한 작업', value: loading ? '-' : `${failedJobs}건`, icon: AlertTriangle, color: failedJobs > 0 ? 'text-red-400' : 'text-green-400', sub: failedJobs > 0 ? '확인 필요' : '정상' },
        ].map((s, i) => (
          <GlassCard key={i} className="p-4">
            <div className="flex items-center gap-2 mb-2"><s.icon size={14} className={s.color} /><span className="text-[10px] text-slate-500 uppercase">{s.label}</span></div>
            <div className="text-xl font-bold text-white">{s.value}</div>
            <div className="text-[10px] text-slate-500">{s.sub}</div>
          </GlassCard>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Users size={14} className="text-blue-400" /> 일일 신규 가입자</h3>
          <div className="flex items-center justify-center h-[200px] text-slate-500 text-xs">
            실제 API 연동 후 표시
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-green-400" /> MRR 추이</h3>
          <div className="flex items-center justify-center h-[200px] text-slate-500 text-xs">
            실제 API 연동 후 표시
          </div>
        </GlassCard>
      </div>

      {/* Crawl Jobs Table */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Database size={14} className="text-amber-400" /> 최근 크롤링 작업</h3>
        <div className="overflow-hidden rounded-lg border border-[#374766]/30">
          <table className="w-full text-xs">
            <thead><tr className="bg-[#1a2035]/50">
              <th className="px-4 py-2.5 text-left text-slate-400 font-medium">URL</th>
              <th className="px-4 py-2.5 text-left text-slate-400 font-medium">플랫폼</th>
              <th className="px-4 py-2.5 text-center text-slate-400 font-medium">상태</th>
              <th className="px-4 py-2.5 text-center text-slate-400 font-medium">생성일</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  <Loader2 size={16} className="animate-spin inline-block mr-2" />데이터 로딩 중...
                </td></tr>
              ) : error ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-red-400">{error}</td></tr>
              ) : recentJobs.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">크롤링 작업이 없습니다</td></tr>
              ) : recentJobs.map((job, i) => (
                <tr key={job.id || i} className={i % 2 === 0 ? 'bg-[#1a2035]/20' : ''}>
                  <td className="px-4 py-2.5 text-slate-200 font-medium truncate max-w-[300px]">{job.url || job.channelUrl || '-'}</td>
                  <td className="px-4 py-2.5 text-slate-300">{job.platform || '-'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      job.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {job.status || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-400 text-[10px]">{job.createdAt ? new Date(job.createdAt).toLocaleString('ko-KR') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* System Logs (from recent jobs) */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Server size={14} className="text-cyan-400" /> 시스템 로그</h3>
        <div className="space-y-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-slate-500 text-xs">
              <Loader2 size={16} className="animate-spin inline-block mr-2" />로딩 중...
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-slate-500 text-xs">
              로그가 없습니다
            </div>
          ) : recentJobs.map((job, i) => (
            <div key={job.id || i} className="flex items-center gap-3 bg-[#1a2035]/30 rounded-lg px-3 py-2">
              <span className="text-[10px] font-mono text-slate-500 w-16 shrink-0">{job.createdAt ? new Date(job.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
              {job.status === 'completed' && <CheckCircle2 size={12} className="text-green-400" />}
              {job.status === 'failed' && <AlertTriangle size={12} className="text-red-400" />}
              {job.status !== 'completed' && job.status !== 'failed' && <Activity size={12} className="text-blue-400" />}
              <span className="text-xs text-slate-200 flex-1">{job.status === 'completed' ? '크롤링 완료' : job.status === 'failed' ? '크롤링 실패' : `크롤링 ${job.status || '대기'}`}</span>
              <span className="text-[10px] text-slate-500 truncate max-w-[200px]">{job.url || job.channelUrl || ''}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
