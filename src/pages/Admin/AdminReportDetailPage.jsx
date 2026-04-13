/**
 * AdminReportDetailPage — 검증 리포트 풀 상세 뷰
 * report_data JSON을 파싱하여 AI 분석 / 크리에이터별 성과 / 방송 리스트 시각화
 */
import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, FileText, Users, Video, Eye, ThumbsUp, MessageCircle,
  TrendingUp, ExternalLink, Star, Calendar, Award, AlertTriangle,
  Clock, BarChart3, RefreshCw
} from 'lucide-react';
import { GlassCard } from '../../components/shared';
import { getReportDetail, regenerateReport } from '../../services/admin-automation-api';

const RATING_COLORS = {
  good: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  normal: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  poor: 'bg-red-500/20 text-red-400 border-red-500/30',
};
const RATING_LABELS = { good: '우수', normal: '보통', poor: '미흡' };

export default function AdminReportDetailPage({ reportId, onNavigate }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    getReportDetail(reportId)
      .then(r => setReport(r.report))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [reportId]);

  // Parse report_data JSON
  const parsed = useMemo(() => {
    if (!report?.report_data) return null;
    try {
      return typeof report.report_data === 'string'
        ? JSON.parse(report.report_data)
        : report.report_data;
    } catch {
      return null;
    }
  }, [report]);

  // AI 평가 집계
  const ratingStats = useMemo(() => {
    if (!parsed?.gridRows) return { good: 0, normal: 0, poor: 0, total: 0 };
    const stats = { good: 0, normal: 0, poor: 0, total: 0 };
    for (const row of parsed.gridRows) {
      for (const cell of Object.values(row.dateCells || {})) {
        if (cell?.status === 'broadcast' && cell.video?.aiAnalysis) {
          const rating = cell.video.aiAnalysis.rating || 'normal';
          stats[rating] = (stats[rating] || 0) + 1;
          stats.total++;
        }
      }
    }
    return stats;
  }, [parsed]);

  const handleRegen = async () => {
    if (!report) return;
    await regenerateReport(report.campaign_id);
    setActionMsg('리포트 재생성 등록됨');
    setTimeout(() => setActionMsg(''), 2000);
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-500 text-xs animate-pulse">리포트 로딩 중...</div>;
  }
  if (!report) {
    return <div className="p-6 text-center text-slate-500 text-xs">리포트를 찾을 수 없습니다</div>;
  }

  const summary = parsed?.summary || {};
  const gridRows = parsed?.gridRows || [];

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate?.('report-center')} className="p-1.5 rounded-lg hover:bg-[#1a2035] transition">
          <ArrowLeft size={16} className="text-slate-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText size={18} className="text-emerald-400" />
            {report.campaign_title || '검증 리포트'}
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-slate-500">{report.brand_name}</span>
            <span className="text-[10px] text-slate-500">· 타겟: {report.target_game}</span>
            <span className="text-[10px] text-slate-500">· {summary.dateRange || '기간 미정'}</span>
            <span className="text-[10px] text-slate-600">· 생성: {formatDate(report.created_at)}</span>
          </div>
        </div>
        {actionMsg && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">{actionMsg}</span>}
        <button onClick={handleRegen} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/20 transition">
          <RefreshCw size={12} /> 재생성
        </button>
        {report.pdf_url && (
          <a href={report.pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-indigo-400 hover:bg-indigo-500/10 border border-indigo-500/20 transition">
            <ExternalLink size={12} /> PDF
          </a>
        )}
      </div>

      {/* 핵심 KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: '크리에이터', value: summary.totalCreators || gridRows.length, icon: Users, color: 'text-indigo-400' },
          { label: '총 영상', value: summary.totalVideos || 0, icon: Video, color: 'text-cyan-400' },
          { label: '총 조회수', value: (summary.totalViews || 0).toLocaleString(), icon: Eye, color: 'text-emerald-400' },
          { label: '평균 조회수', value: (summary.avgViews || 0).toLocaleString(), icon: TrendingUp, color: 'text-purple-400' },
          { label: '방송시간', value: `${report.total_stream_minutes || 0}분`, icon: Clock, color: 'text-amber-400' },
          { label: '임프레션', value: (report.total_impressions || 0).toLocaleString(), icon: BarChart3, color: 'text-pink-400' },
        ].map((s, i) => (
          <GlassCard key={i} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</span>
              <s.icon size={14} className={s.color} />
            </div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
          </GlassCard>
        ))}
      </div>

      {/* AI 평가 집계 */}
      {ratingStats.total > 0 && (
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Star size={14} className="text-amber-400" /> AI 방송 평가 분포
            <span className="text-[10px] text-slate-500 font-normal">(총 {ratingStats.total}건 분석)</span>
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <RatingCard label="우수" value={ratingStats.good} total={ratingStats.total} color="emerald" />
            <RatingCard label="보통" value={ratingStats.normal} total={ratingStats.total} color="slate" />
            <RatingCard label="미흡" value={ratingStats.poor} total={ratingStats.total} color="red" />
          </div>
        </GlassCard>
      )}

      {/* 크리에이터별 성과 */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-[#374766]/20">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users size={14} className="text-indigo-400" /> 크리에이터별 성과 ({gridRows.length}명)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 text-[10px] uppercase border-b border-[#374766]/20 bg-[#0a0e1a]/30">
                <th className="text-left py-3 px-4">크리에이터</th>
                <th className="text-center py-3 px-3">구독자</th>
                <th className="text-center py-3 px-3">방송 수</th>
                <th className="text-center py-3 px-3">총 영상</th>
                <th className="text-center py-3 px-3">총 조회수</th>
                <th className="text-center py-3 px-3">평균 조회수</th>
                <th className="text-center py-3 px-3">서버/캐릭</th>
                <th className="text-left py-3 px-3">상태</th>
                <th className="text-center py-3 px-3">상세</th>
              </tr>
            </thead>
            <tbody>
              {gridRows.map(row => {
                const expanded = selectedCreator === row.creatorId;
                return (
                  <>
                    <tr
                      key={row.creatorId}
                      onClick={() => setSelectedCreator(expanded ? null : row.creatorId)}
                      className={`border-b border-[#374766]/10 cursor-pointer transition ${expanded ? 'bg-indigo-500/5' : 'hover:bg-[#1a2035]/50'}`}
                    >
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">{row.creatorName}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[160px]">{row.channelId}</div>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-300">{(row.subscribers || 0).toLocaleString()}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-indigo-400 font-bold">{row.broadcastCount || 0}</span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-300">{row.totalVideos || 0}</td>
                      <td className="py-3 px-3 text-center text-emerald-400 font-bold">{(row.totalViews || 0).toLocaleString()}</td>
                      <td className="py-3 px-3 text-center text-slate-300">{(row.avgViews || 0).toLocaleString()}</td>
                      <td className="py-3 px-3 text-center text-slate-400 text-[10px]">
                        {row.serverName || '-'}
                        {row.characterName ? ` / ${row.characterName}` : ''}
                      </td>
                      <td className="py-3 px-3">
                        {row.error ? (
                          <span className="text-red-400 text-[10px]">{row.error}</span>
                        ) : (
                          <span className="text-emerald-400 text-[10px]">분석 완료</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-[10px] text-indigo-400">{expanded ? '닫기' : '펼치기 →'}</span>
                      </td>
                    </tr>

                    {/* 펼친 상세: 방송 리스트 + AI 분석 */}
                    {expanded && (
                      <tr key={`${row.creatorId}-expanded`}>
                        <td colSpan={9} className="bg-[#0a0e1a]/50 p-5">
                          <CreatorBroadcastDetail row={row} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Rating Card ────────────────────────────────────────────────
function RatingCard({ label, value, total, color }) {
  const pct = total > 0 ? (value / total * 100).toFixed(0) : 0;
  const colorMap = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', bar: 'bg-emerald-500' },
    slate: { bg: 'bg-slate-500/10', text: 'text-slate-400', bar: 'bg-slate-500' },
    red: { bg: 'bg-red-500/10', text: 'text-red-400', bar: 'bg-red-500' },
  };
  const c = colorMap[color];
  return (
    <div className={`${c.bg} rounded-lg p-4 border border-${color}-500/20`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold ${c.text}`}>{label}</span>
        <span className={`text-xl font-bold ${c.text}`}>{value}</span>
      </div>
      <div className="h-1 bg-[#0a0e1a] rounded-full overflow-hidden">
        <div className={`h-full ${c.bar} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] text-slate-500 mt-1.5">{pct}%</div>
    </div>
  );
}

// ─── Creator Broadcast Detail (펼친 상세) ───────────────────────
function CreatorBroadcastDetail({ row }) {
  const broadcasts = useMemo(() => {
    const list = [];
    for (const [date, cell] of Object.entries(row.dateCells || {})) {
      if (cell?.status === 'broadcast' && cell.video) {
        list.push({ date, ...cell.video });
      }
    }
    // 최근순 정렬
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [row]);

  if (broadcasts.length === 0) {
    return <div className="text-center py-6 text-slate-500 text-xs">방송 기록이 없습니다</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Video size={12} className="text-indigo-400" />
        <span className="text-xs text-slate-300 font-bold">방송 이력 ({broadcasts.length}건)</span>
        {row.broadcastUrl && (
          <a href={row.broadcastUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] text-indigo-400 hover:underline flex items-center gap-1">
            <ExternalLink size={10} /> 고정 방송 URL
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {broadcasts.map((b, i) => (
          <div key={i} className="bg-[#111827]/60 rounded-lg border border-[#374766]/20 overflow-hidden hover:border-indigo-500/30 transition">
            {/* Thumbnail */}
            {b.thumbnail && (
              <div className="relative">
                <img src={b.thumbnail} alt="" className="w-full h-24 object-cover" />
                {b.aiAnalysis?.rating && (
                  <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${RATING_COLORS[b.aiAnalysis.rating]}`}>
                    {RATING_LABELS[b.aiAnalysis.rating]}
                  </span>
                )}
                {b.isLive && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/90 text-white">LIVE</span>
                )}
              </div>
            )}

            {/* Info */}
            <div className="p-3 space-y-2">
              <div>
                <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-xs text-white font-medium hover:text-indigo-300 line-clamp-2">
                  {b.title}
                </a>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                  <Calendar size={9} /> {b.date}
                  {b.durationText && <span>· {b.durationText}</span>}
                  {b.broadcastNumber && <span>· #{b.broadcastNumber}</span>}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-1 text-center">
                <div className="bg-[#0a0e1a]/50 rounded p-1.5">
                  <div className="text-[10px] text-emerald-400 font-bold flex items-center justify-center gap-1">
                    <Eye size={8} /> {(b.viewCount || 0).toLocaleString()}
                  </div>
                  <div className="text-[9px] text-slate-600">조회</div>
                </div>
                <div className="bg-[#0a0e1a]/50 rounded p-1.5">
                  <div className="text-[10px] text-indigo-400 font-bold flex items-center justify-center gap-1">
                    <ThumbsUp size={8} /> {b.likeCount || 0}
                  </div>
                  <div className="text-[9px] text-slate-600">좋아요</div>
                </div>
                <div className="bg-[#0a0e1a]/50 rounded p-1.5">
                  <div className="text-[10px] text-amber-400 font-bold flex items-center justify-center gap-1">
                    <MessageCircle size={8} /> {b.commentCount || 0}
                  </div>
                  <div className="text-[9px] text-slate-600">댓글</div>
                </div>
              </div>

              {/* AI Analysis */}
              {b.aiAnalysis && (
                <div className="pt-2 border-t border-[#374766]/20 space-y-1">
                  {b.aiAnalysis.summary && (
                    <div className="flex items-start gap-1.5">
                      <Award size={10} className="text-indigo-400 mt-0.5 shrink-0" />
                      <span className="text-[10px] text-slate-300">{b.aiAnalysis.summary}</span>
                    </div>
                  )}
                  {b.aiAnalysis.viewerReaction && (
                    <div className="flex items-start gap-1.5">
                      <Users size={10} className="text-cyan-400 mt-0.5 shrink-0" />
                      <span className="text-[10px] text-slate-400">{b.aiAnalysis.viewerReaction}</span>
                    </div>
                  )}
                  {b.aiAnalysis.highlights && (
                    <div className="flex items-start gap-1.5">
                      <Star size={10} className="text-amber-400 mt-0.5 shrink-0" />
                      <span className="text-[10px] text-slate-400">{b.aiAnalysis.highlights}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
