import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock, Image as ImageIcon } from 'lucide-react';
import { GlassCard } from '../../../components/ui';
import { CustomTooltip } from '../../../components/charts';

export default function TimelineTab({ data }) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <GlassCard className="!p-5">
        <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
          <Clock size={16} className="text-purple-400" /> 방송 타임라인 & 감정 변화
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data.viewerTimeline} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="sentiment" stroke="#f59e0b" fill="url(#sentGrad)" strokeWidth={2} name="감성 지수" />
          </AreaChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* Timeline Events */}
      <GlassCard>
        <h3 className="text-sm font-bold text-slate-200 mb-4">핵심 이벤트</h3>
        <div className="space-y-0">
          {data.timelineEvents.map((ev, i) => {
            const typeStyles = {
              info: { bg: 'bg-slate-500/20', border: 'border-slate-500/30', dot: 'bg-slate-400' },
              highlight: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', dot: 'bg-indigo-400' },
              positive: { bg: 'bg-green-500/20', border: 'border-green-500/30', dot: 'bg-green-400' },
              negative: { bg: 'bg-red-500/20', border: 'border-red-500/30', dot: 'bg-red-400' },
              bug: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', dot: 'bg-orange-400' },
            };
            const style = typeStyles[ev.type] || typeStyles.info;
            return (
              <div key={i} className="flex gap-4 group">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full ${style.dot} ring-2 ring-dark-800 z-10`} />
                  {i < data.timelineEvents.length - 1 && <div className="w-[2px] flex-1 bg-dark-600" />}
                </div>
                <div className={`flex-1 mb-3 p-3 rounded-lg ${style.bg} border ${style.border} group-hover:scale-[1.01] transition-transform`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-slate-500">{ev.time}</span>
                    {ev.chatPeak && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                        🔥 채팅 피크
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-200">{ev.event}</p>
                  <div className="mt-2 w-full h-16 rounded bg-dark-700/60 border border-dark-600/30 flex items-center justify-center">
                    <ImageIcon size={16} className="text-slate-600" />
                    <span className="text-[10px] text-slate-600 ml-1">하이라이트 캡처</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
