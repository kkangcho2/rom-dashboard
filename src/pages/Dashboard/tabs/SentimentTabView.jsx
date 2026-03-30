import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ThumbsUp, ThumbsDown, Flame, Minus, Hash } from 'lucide-react';
import { GlassCard } from '../../../components/ui';
import { SentimentGauge } from '../../../components/charts';

export default function SentimentTabView({ data, sentimentScore }) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sentiment Gauge */}
        <GlassCard className="flex flex-col items-center justify-center !py-6">
          <SentimentGauge score={sentimentScore} />
          <div className="mt-3 text-xs text-slate-400 text-center">
            <p>전체 감성 지수</p>
            <p className="text-[10px] text-slate-500 mt-1">0(매우 부정) ~ 100(매우 긍정)</p>
          </div>
        </GlassCard>

        {/* Pie Chart */}
        <GlassCard className="flex flex-col items-center justify-center">
          <h3 className="text-xs font-semibold text-slate-300 mb-2">감성 비율</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data.sentimentData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
              >
                {data.sentimentData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-1">
            {data.sentimentData.map((d, i) => (
              <span key={i} className="text-[10px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                <span className="text-slate-400">{d.name}</span>
                <span className="font-bold text-slate-300">{d.value}%</span>
              </span>
            ))}
          </div>
        </GlassCard>

        {/* Quick Stats */}
        <GlassCard>
          <h3 className="text-xs font-semibold text-slate-300 mb-3">감성 요약</h3>
          <div className="space-y-3">
            {(() => {
              const peakPositiveEvent = data.timelineEvents.find(e => e.type === 'positive') || data.timelineEvents[0];
              const peakNegativeEvent = data.timelineEvents.find(e => e.type === 'negative') || data.timelineEvents[0];
              const sortedByChat = [...data.viewerTimeline].sort((a, b) => b.chat - a.chat);
              const hottestTime = sortedByChat[0];
              const coldestTime = sortedByChat[sortedByChat.length - 1];
              const topKw = data.keywords[0];
              const bottomKw = data.keywords[data.keywords.length - 1];
              return [
                { icon: ThumbsUp, label: '긍정 피크', value: `${data.sentimentData[0].value}%`, sub: peakPositiveEvent ? peakPositiveEvent.event : '긍정 이벤트', color: 'text-green-400' },
                { icon: ThumbsDown, label: '부정 피크', value: `${data.sentimentData[1].value}%`, sub: peakNegativeEvent ? peakNegativeEvent.event : '부정 이벤트', color: 'text-red-400' },
                { icon: Flame, label: '가장 뜨거운 반응', value: topKw ? topKw.text : '-', sub: hottestTime ? `분당 ${hottestTime.chat}건 채팅` : '', color: 'text-amber-400' },
                { icon: Minus, label: '가장 차가운 반응', value: bottomKw ? bottomKw.text : '-', sub: coldestTime ? `분당 ${coldestTime.chat}건 채팅` : '', color: 'text-blue-400' },
              ];
            })().map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-dark-700/50 rounded-lg p-2">
                <item.icon size={14} className={item.color} />
                <div className="flex-1">
                  <div className="text-[10px] text-slate-500">{item.label}</div>
                  <div className="text-xs font-bold text-slate-200">{item.value}</div>
                </div>
                <span className="text-[10px] text-slate-500">{item.sub}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Keyword Cloud */}
      <GlassCard>
        <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
          <Hash size={16} className="text-cyan-400" /> 주요 언급 키워드
        </h3>
        <div className="flex flex-wrap gap-2">
          {data.keywords.map((kw, i) => {
            const sizeClass = kw.count > 250 ? 'text-lg px-4 py-2' : kw.count > 150 ? 'text-sm px-3 py-1.5' : 'text-xs px-2.5 py-1';
            const sentimentColor = {
              positive: 'bg-green-500/15 text-green-400 border-green-500/30',
              negative: 'bg-red-500/15 text-red-400 border-red-500/30',
              mixed: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
              neutral: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
            }[kw.sentiment];
            return (
              <span
                key={i}
                className={`${sizeClass} ${sentimentColor} rounded-full border font-medium cursor-default hover:scale-105 transition-transform`}
                title={`${kw.text}: ${kw.count}회 (${kw.sentiment})`}
              >
                {kw.text}
                <span className="text-[9px] ml-1 opacity-60">{kw.count}</span>
              </span>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
