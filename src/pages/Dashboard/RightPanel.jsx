import { Users, Eye, Clock, MessageSquare, Target, BarChart3, Hash, AlertTriangle, ArrowRight } from 'lucide-react';
import { GlassCard } from '../../components/ui';
import { SentimentGauge } from '../../components/charts';

export default function RightPanel({ data, sentimentScore, url, onGoToQA }) {
  if (!data) {
    return (
      <>
        {/* Desktop sidebar */}
        <aside className="w-[360px] min-w-[360px] border-l border-dark-600/50 bg-dark-800/40 hidden xl:flex flex-col overflow-y-auto" role="complementary" aria-label="크리에이터 요약">
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2 p-6">
              <Users size={28} className="text-slate-600 mx-auto" />
              <p className="text-xs text-slate-500">분석이 완료되면<br />크리에이터 요약이 여기에 표시됩니다</p>
            </div>
          </div>
        </aside>
        {/* Mobile/Tablet compact bar */}
        <div className="xl:hidden w-full border-t border-dark-600/50 bg-dark-800/60">
          <div className="compact-stats-bar">
            <div className="flex-shrink-0 px-3 py-2 text-center min-w-fit">
              <div className="text-[10px] text-slate-500">시청자</div>
              <div className="text-xs font-bold text-blue-400">{data?.stats?.maxViewers || '-'}</div>
            </div>
            <div className="flex-shrink-0 px-3 py-2 text-center min-w-fit">
              <div className="text-[10px] text-slate-500">평균</div>
              <div className="text-xs font-bold text-indigo-400">{data?.stats?.avgViewers || '-'}</div>
            </div>
            <div className="flex-shrink-0 px-3 py-2 text-center min-w-fit">
              <div className="text-[10px] text-slate-500">CPM</div>
              <div className="text-xs font-bold text-emerald-400">{data?.stats?.cpm || '-'}</div>
            </div>
            <div className="flex-shrink-0 px-3 py-2 text-center min-w-fit">
              <div className="text-[10px] text-slate-500">버그</div>
              <div className="text-xs font-bold text-red-400">{data?.bugReports?.length || 0}건</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="w-[360px] min-w-[360px] border-l border-dark-600/50 bg-dark-800/40 hidden xl:flex flex-col overflow-y-auto" role="complementary" aria-label="크리에이터 요약">
      <div className="p-4 space-y-4">
        {/* Creator Summary Header */}
        <GlassCard>
          <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
            <Users size={14} className="text-accent-light" />
            크리에이터 요약
          </h3>
          <div className="text-xs text-slate-400 mb-2">
            {data._channelName || url?.split('@')[1] || '분석 대상 크리에이터'}
          </div>
          {data._crawlSource === 'live' && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">LIVE 데이터</span>
          )}
          {data._crawlSource === 'simulated' && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">시뮬레이션</span>
          )}
        </GlassCard>

        {/* Sentiment Gauge */}
        <GlassCard className="flex flex-col items-center justify-center !py-5" role="region" aria-label="감성 분석 게이지">
          <SentimentGauge score={sentimentScore} />
          <div className="mt-2 flex gap-2" role="img" aria-label={`감성 분석: 긍정 ${data.sentimentData.find(d => d.name === '긍정')?.value || 0}%, 중립 ${data.sentimentData.find(d => d.name === '중립')?.value || 0}%, 부정 ${data.sentimentData.find(d => d.name === '부정')?.value || 0}%`}>
            {data.sentimentData.map((d, i) => (
              <span key={i} className="text-[9px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
                <span className="text-slate-500">{d.name}</span>
                <span className="font-bold text-slate-400">{d.value}%</span>
              </span>
            ))}
          </div>
        </GlassCard>

        {/* Quick Stats */}
        <GlassCard role="region" aria-label="주요 지표">
          <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <BarChart3 size={12} className="text-blue-400" /> 주요 지표
          </h3>
          <div className="space-y-2">
            {[
              { icon: Eye, label: '최고 시청자', value: data.stats.maxViewers, color: 'text-indigo-400' },
              { icon: Users, label: '평균 시청자', value: data.stats.avgViewers, color: 'text-blue-400' },
              { icon: Clock, label: '방송 시간', value: data.stats.totalTime, color: 'text-purple-400' },
              { icon: MessageSquare, label: 'CPM', value: data.stats.cpm, color: 'text-emerald-400' },
              { icon: Target, label: '광고 도달률', value: data.stats.adScore, color: 'text-amber-400' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-dark-700/50 rounded-lg p-2">
                <item.icon size={14} className={item.color} aria-hidden="true" />
                <div className="flex-1">
                  <div className="text-[10px] text-slate-500">{item.label}</div>
                </div>
                <span className="text-xs font-bold text-slate-200">{item.value}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Compact Keyword Cloud */}
        <GlassCard>
          <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Hash size={12} className="text-cyan-400" /> 키워드
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {data.keywords.slice(0, 10).map((kw, i) => {
              const sentimentColor = {
                positive: 'bg-green-500/15 text-green-400 border-green-500/30',
                negative: 'bg-red-500/15 text-red-400 border-red-500/30',
                mixed: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                neutral: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
              }[kw.sentiment];
              return (
                <span
                  key={i}
                  className={`text-[10px] px-2 py-0.5 ${sentimentColor} rounded-full border font-medium`}
                  title={`${kw.text}: ${kw.count}회 (${kw.sentiment})`}
                >
                  {kw.text}
                  <span className="text-[8px] ml-0.5 opacity-60">{kw.count}</span>
                </span>
              );
            })}
          </div>
        </GlassCard>

        {/* Bug Summary */}
        <GlassCard>
          <h3 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
            <AlertTriangle size={12} className="text-red-400" /> QA 요약
          </h3>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">감지된 버그</span>
            <span className="font-bold text-red-400">{data.bugReports.length}건</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-slate-400">심각 (Critical)</span>
            <span className="font-bold text-red-400">{data.bugReports.filter(b => b.severity === 'critical').length}건</span>
          </div>
          <button
            onClick={onGoToQA}
            className="w-full mt-3 py-1.5 rounded-lg text-[10px] font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center gap-1"
          >
            <ArrowRight size={10} /> QA 트래커로 이동
          </button>
        </GlassCard>
      </div>
      </aside>
      {/* Mobile/Tablet compact bar */}
      <div className="xl:hidden w-full border-t border-dark-600/50 bg-dark-800/60">
        <div className="compact-stats-bar">
          <div className="flex-shrink-0 px-3 py-2 text-center min-w-fit">
            <div className="text-[10px] text-slate-500">시청자</div>
            <div className="text-xs font-bold text-blue-400">{data.stats.maxViewers}</div>
          </div>
          <div className="flex-shrink-0 px-3 py-2 text-center min-w-fit">
            <div className="text-[10px] text-slate-500">평균</div>
            <div className="text-xs font-bold text-indigo-400">{data.stats.avgViewers}</div>
          </div>
          <div className="flex-shrink-0 px-3 py-2 text-center min-w-fit">
            <div className="text-[10px] text-slate-500">CPM</div>
            <div className="text-xs font-bold text-emerald-400">{data.stats.cpm}</div>
          </div>
          <div className="flex-shrink-0 px-3 py-2 text-center min-w-fit">
            <div className="text-[10px] text-slate-500">버그</div>
            <div className="text-xs font-bold text-red-400">{data.bugReports.length}건</div>
          </div>
          <div className="flex-shrink-0 px-3 py-2 text-center min-w-fit">
            <div className="text-[10px] text-slate-500">감성</div>
            <div className="text-xs font-bold text-purple-400">{sentimentScore}%</div>
          </div>
        </div>
      </div>
    </>
  );
}
