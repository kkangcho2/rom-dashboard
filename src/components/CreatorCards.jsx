import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, Activity, BarChart3
} from 'lucide-react';
import { PlatformIcon, GradeTag, MiniTooltip } from './shared';

export default function CreatorCardsTab({ filtered, selectedCreator, setSelectedCreator, compareList, toggleCompare }) {
  if (!filtered || filtered.length === 0) return null;

  return (
    <div className="max-w-[1400px] mx-auto w-full px-6 pb-24">
      {/* Creator Cards Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {filtered.map((c, idx) => {
          const isCompared = compareList.includes(c.id);
          const hasSentiment = Array.isArray(c.sentimentData) && c.sentimentData.length > 0;
          const hasTags = Array.isArray(c.tags) && c.tags.length > 0;
          return (
            <div
              key={c.id}
              className={`glass-panel rounded-xl overflow-hidden cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-200 animate-fade-in-up ${isCompared ? 'ring-2 ring-indigo-500/50' : ''}`}
              style={{ animationDelay: `${idx * 50}ms` }}
              onClick={() => setSelectedCreator(c)}
            >
              {/* Card Header */}
              <div className="p-4 pb-3">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {c._thumbnail || c.avatar ? (
                      <img src={c._thumbnail || c.avatar} alt={c.name} className="w-11 h-11 rounded-xl object-cover border border-dark-600/50" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-dark-600/50 flex items-center justify-center text-base font-bold text-white">
                        {c.name[0]}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white">{c.name}</span>
                        <PlatformIcon platform={c.platform} size={12} />
                      </div>
                      <span className="text-[10px] text-slate-500">{(c.subscribers ?? 0).toLocaleString()} 구독자</span>
                    </div>
                  </div>
                  <GradeTag grade={c.adGrade} />
                </div>

                {/* Tags */}
                {hasTags && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {c.tags.slice(0, 3).map((t, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-dark-600/50 text-slate-500">{t}</span>
                    ))}
                    {c._keywordMatchCount != null && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        매칭 {c._keywordMatchCount}건
                      </span>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center">
                    <div className="text-xs font-bold text-white">{((c.avgViews ?? 0) / 1000).toFixed(1)}K</div>
                    <div className="text-[9px] text-slate-500">평균 조회</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-white">{c.engagement ?? 0}%</div>
                    <div className="text-[9px] text-slate-500">참여율</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-white">{c.adScore ?? '-'}</div>
                    <div className="text-[9px] text-slate-500">광고적합</div>
                  </div>
                </div>

                {/* Engagement Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-[9px] mb-0.5">
                    <span className="text-slate-500">참여율</span>
                    <span className="text-slate-400">{c.engagement ?? 0}%</span>
                  </div>
                  <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${Math.min((c.engagement ?? 0) * 8, 100)}%` }} />
                  </div>
                </div>

                {/* Mini Sentiment Donut */}
                {hasSentiment ? (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12">
                      <ResponsiveContainer width={48} height={48}>
                        <PieChart>
                          <Pie data={c.sentimentData} cx="50%" cy="50%" innerRadius={14} outerRadius={22} paddingAngle={2} dataKey="value">
                            {c.sentimentData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
                      {c.sentimentData.map((s, i) => (
                        <span key={i} className="text-[9px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                          <span className="text-slate-500">{s.name}</span>
                          <span className="text-slate-300 font-medium">{s.value}%</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-12 text-[10px] text-slate-500">
                    분석 필요
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="border-t border-dark-600/30 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px]">
                  {c.weeklyGrowth?.subs != null ? (
                    <>
                      <TrendingUp size={10} className="text-green-400" />
                      <span className="text-green-400">+{c.weeklyGrowth.subs.toLocaleString()}</span>
                      <span className="text-slate-500">이번 주</span>
                    </>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleCompare(c.id); }}
                  className={`text-[10px] px-2 py-1 rounded-md transition-all ${
                    isCompared ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300 border border-dark-600/30 hover:border-dark-500'
                  }`}
                >
                  {isCompared ? '✓ 비교중' : '+ 비교'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Timeline & Daily Table for first selected or first creator */}
      {(() => {
        const c = selectedCreator || filtered[0];
        if (!c) return null;
        const hasLiveTimeline = Array.isArray(c.liveTimeline) && c.liveTimeline.length > 0;
        const hasDaily = Array.isArray(c.daily) && c.daily.length > 0;
        return (
          <div className="grid grid-cols-2 gap-4">
            {/* Live Timeline Chart */}
            <div className="glass-panel rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
                <Activity size={16} className="text-indigo-400" />
                시간대별 시청자 (CCV) — {c.name}
              </h3>
              <p className="text-[10px] text-slate-500 mb-3">최근 라이브 방송 시청자 추이</p>
              {hasLiveTimeline ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={c.liveTimeline}>
                    <defs>
                      <linearGradient id="ccvGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#1e293b' }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#1e293b' }} />
                    <Tooltip content={<MiniTooltip />} />
                    <Line type="monotone" dataKey="viewers" stroke="#6366f1" strokeWidth={2} name="시청자" dot={{ r: 3, fill: '#6366f1', stroke: '#6366f1' }} activeDot={{ r: 5, fill: '#818cf8' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-xs text-slate-500">
                  라이브 데이터 없음
                </div>
              )}
            </div>

            {/* Daily Change Table */}
            <div className="glass-panel rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
                <BarChart3 size={16} className="text-green-400" />
                최근 7일 변화량 — {c.name}
              </h3>
              <p className="text-[10px] text-slate-500 mb-3">일자별 구독자, 조회수, 평균 시청자 변동</p>
              {hasDaily ? (
                <div className="overflow-hidden rounded-lg border border-dark-600/30">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-dark-700/50">
                        <th className="px-3 py-2 text-left text-slate-400 font-medium">날짜</th>
                        <th className="px-3 py-2 text-right text-slate-400 font-medium">구독자 증감</th>
                        <th className="px-3 py-2 text-right text-slate-400 font-medium">조회수</th>
                        <th className="px-3 py-2 text-right text-slate-400 font-medium">평균 시청자</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.daily.map((d, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-dark-700/20' : ''}>
                          <td className="px-3 py-2 text-slate-300">{d.day}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={`flex items-center justify-end gap-0.5 ${d.subs > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {d.subs > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                              {d.subs > 0 ? '+' : ''}{d.subs.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-slate-200">{d.views.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-slate-200">{d.avgV.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[180px] text-xs text-slate-500">
                  데이터 수집 중
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
