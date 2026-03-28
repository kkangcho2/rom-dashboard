import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Heart, Hash, Flame, Activity, RefreshCw, MessageSquare } from 'lucide-react';
import { PlatformIcon, MiniTooltip } from './shared';

export default function SentimentTab({ selectedCreator, filtered, sentimentData, onAnalyze, analyzing }) {
  const c = selectedCreator || filtered[0];
  if (!c) return null;

  /* ── Derive pie chart data ── */
  const pieData = sentimentData
    ? [
        { name: '긍정', value: sentimentData.positive, color: '#22c55e' },
        { name: '부정', value: sentimentData.negative, color: '#ef4444' },
        { name: '중립', value: sentimentData.neutral, color: '#6366f1' },
      ]
    : c.sentimentData; // fall back to creator prop if available

  const keywords = sentimentData?.keywords || [];
  const timeline = sentimentData?.timeline || [];
  const highlights = sentimentData?.highlights || [];
  const hasData = !!(sentimentData || c.sentimentData);

  /* ── Empty / Loading state ── */
  if (!hasData) {
    return (
      <div className="max-w-[1400px] mx-auto w-full px-6 pb-24">
        <div className="space-y-4 animate-fade-in-up">
          {/* Creator header */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm text-slate-400">분석 대상:</span>
            <span className="text-sm font-bold text-white">{c.name}</span>
            <PlatformIcon platform={c.platform} />
          </div>

          {/* Empty state card */}
          <div className="glass-panel rounded-xl p-10 flex flex-col items-center justify-center min-h-[360px] text-center">
            {analyzing ? (
              <>
                <RefreshCw size={36} className="text-indigo-400 animate-spin mb-5" />
                <p className="text-sm text-slate-300 font-medium">댓글 분석 중...</p>
                <p className="text-xs text-slate-500 mt-2">잠시만 기다려 주세요. 분석이 완료되면 결과가 표시됩니다.</p>
              </>
            ) : (
              <>
                <MessageSquare size={36} className="text-slate-500 mb-5" />
                <p className="text-sm text-slate-300 font-medium mb-1">
                  이 크리에이터의 댓글/채팅 데이터가 아직 분석되지 않았습니다
                </p>
                <p className="text-xs text-slate-500 mb-6">분석을 시작하면 댓글 감성, 키워드, 여론 추이를 확인할 수 있습니다.</p>
                {onAnalyze && (
                  <button
                    onClick={() => onAnalyze(c)}
                    className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    분석 시작
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Main analysis view ── */
  return (
    <div className="max-w-[1400px] mx-auto w-full px-6 pb-24">
      <div className="space-y-4 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm text-slate-400">분석 대상:</span>
          <span className="text-sm font-bold text-white">{c.name}</span>
          <PlatformIcon platform={c.platform} />
          {sentimentData?.total != null && (
            <span className="text-xs text-slate-500 ml-2">({sentimentData.total.toLocaleString()}건 분석)</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Donut */}
          <div className="glass-panel rounded-xl p-5 flex flex-col items-center">
            <h3 className="text-xs font-semibold text-slate-300 mb-3 self-start flex items-center gap-1.5">
              <Heart size={12} className="text-pink-400" /> 민심 지수
            </h3>
            {pieData && pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2">
                  {pieData.map((s, i) => (
                    <span key={i} className="text-[10px] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      <span className="text-slate-400">{s.name}</span>
                      <span className="text-white font-bold">{s.value}%</span>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center min-h-[200px] text-xs text-slate-500">데이터 없음</div>
            )}
          </div>

          {/* Word Cloud */}
          <div className="glass-panel rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
              <Hash size={12} className="text-cyan-400" /> 주요 키워드
            </h3>
            <div className="flex flex-wrap gap-2 justify-center items-center min-h-[200px]">
              {keywords.length > 0 ? (
                keywords.map((kw, i) => {
                  const maxCount = Math.max(...keywords.map(k => k.count));
                  const sizeClass = kw.count > maxCount * 0.7
                    ? 'text-xl px-4 py-2'
                    : kw.count > maxCount * 0.4
                      ? 'text-sm px-3 py-1.5'
                      : 'text-xs px-2.5 py-1';
                  const sentColor = {
                    positive: 'bg-green-500/15 text-green-400 border-green-500/30',
                    negative: 'bg-red-500/15 text-red-400 border-red-500/30',
                    mixed: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                    neutral: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
                  }[kw.sentiment] || 'bg-slate-500/15 text-slate-400 border-slate-500/30';
                  return (
                    <span key={i} className={`${sizeClass} ${sentColor} rounded-full border font-medium hover:scale-110 transition-transform cursor-default`}>
                      {kw.text}<span className="text-[9px] ml-1 opacity-60">{kw.count}</span>
                    </span>
                  );
                })
              ) : (
                <span className="text-xs text-slate-500">키워드 데이터 없음</span>
              )}
            </div>
          </div>

          {/* Highlight Tracker */}
          <div className="glass-panel rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
              <Flame size={12} className="text-orange-400" /> 여론 급변 포인트
            </h3>
            <div className="space-y-3">
              {highlights.length > 0 ? (
                highlights.map((ev, i) => (
                  <div key={i} className={`rounded-lg p-3 ${ev.sentiment === 'positive' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-slate-400">{ev.time}</span>
                      <span className={`text-[10px] font-bold ${ev.sentiment === 'positive' ? 'text-green-400' : 'text-red-400'}`}>{ev.delta}</span>
                    </div>
                    <p className="text-xs text-slate-200">{ev.event}</p>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center min-h-[200px] text-xs text-slate-500">이벤트 데이터 없음</div>
              )}
            </div>
          </div>
        </div>

        {/* Sentiment Timeline */}
        <div className="glass-panel rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
            <Activity size={16} className="text-indigo-400" /> 여론 타임라인 (긍정/부정 추이)
          </h3>
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={timeline} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#1e293b' }} unit="%" />
                <Tooltip content={<MiniTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="positive" fill="#22c55e" name="긍정" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="neutral" fill="#6366f1" name="중립" stackId="a" />
                <Bar dataKey="negative" fill="#ef4444" name="부정" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center min-h-[200px] text-xs text-slate-500">타임라인 데이터 없음</div>
          )}
        </div>
      </div>
    </div>
  );
}
