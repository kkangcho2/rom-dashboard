import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Legend, ResponsiveContainer
} from 'recharts';
import { ArrowLeftRight, Users, Target } from 'lucide-react';
import { PlatformIcon, GradeTag, COLORS_COMPARE } from './shared';

export default function ChannelCompareTab({ filtered, compareList, compareCreators, toggleCompare, setShowCompare, setActiveTab }) {
  return (
    <div className="max-w-[1400px] mx-auto w-full px-6 pb-24">
      {compareList.length < 2 ? (
        <div className="text-center py-16">
          <ArrowLeftRight size={48} className="text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-300 mb-2">크리에이터를 2~3명 선택하세요</h3>
          <p className="text-sm text-slate-500 mb-6">카드의 "비교" 버튼을 클릭하여 비교할 크리에이터를 추가하세요</p>
          <div className="grid grid-cols-4 gap-4">
            {(filtered ?? []).slice(0, 4).map((c) => {
              const isCompared = compareList.includes(c.id);
              return (
                <div key={c.id} className="glass-panel rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center text-sm font-bold text-white">
                    {c.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{c.name}</div>
                    <div className="text-[10px] text-slate-500">{(c.subscribers ?? 0).toLocaleString()} 구독자</div>
                  </div>
                  <button
                    onClick={() => toggleCompare(c.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                      isCompared ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-dark-600 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isCompared ? '✓ 선택됨' : '+ 추가'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in-up">
          {/* 1vs1 Side-by-side */}
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${compareCreators.length}, 1fr)` }}>
            {compareCreators.map((c, ci) => {
              const hasAudience = c.audience != null;
              return (
                <div key={c.id} className="glass-panel rounded-xl p-5" style={{ borderColor: COLORS_COMPARE[ci] + '30' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white" style={{ background: COLORS_COMPARE[ci] + '30' }}>
                      {c.name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{c.name}</span>
                        <PlatformIcon platform={c.platform} size={14} />
                        <GradeTag grade={c.adGrade} />
                      </div>
                      <span className="text-[10px] text-slate-400">{(c.subscribers ?? 0).toLocaleString()} 구독자</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { label: '참여율', value: `${c.engagement ?? 0}%` },
                      { label: 'VOD 평균', value: (c.avgViews ?? 0).toLocaleString() },
                      { label: 'LIVE 평균', value: (c.avgLiveViewers ?? 0).toLocaleString() },
                      { label: '감성 점수', value: `${c.sentiment ?? '-'}점` },
                    ].map((s, i) => (
                      <div key={i} className="bg-dark-700/40 rounded-lg p-2 text-center">
                        <div className="text-xs font-bold text-white">{s.value}</div>
                        <div className="text-[9px] text-slate-500">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Audience bars */}
                  {hasAudience ? (
                    <>
                      <div className="space-y-2 mb-3">
                        <div className="text-[10px] text-slate-400 font-medium">연령대 분포</div>
                        {[
                          { label: '18~24', val: c.audience.age18 },
                          { label: '25~34', val: c.audience.age25 },
                          { label: '35~44', val: c.audience.age35 },
                          { label: '45+', val: c.audience.age45 },
                        ].map((a, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-500 w-10">{a.label}</span>
                            <div className="flex-1 h-2 bg-dark-600 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${a.val ?? 0}%`, background: COLORS_COMPARE[ci] }} />
                            </div>
                            <span className="text-[9px] text-slate-400 w-6">{a.val ?? 0}%</span>
                          </div>
                        ))}
                      </div>

                      {/* Gender */}
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-slate-500">성별</span>
                        <div className="flex-1 h-3 bg-dark-600 rounded-full overflow-hidden flex">
                          <div className="h-full" style={{ width: `${c.audience.male ?? 0}%`, background: COLORS_COMPARE[ci] }} />
                          <div className="h-full bg-pink-400" style={{ width: `${c.audience.female ?? 0}%` }} />
                        </div>
                        <span className="text-slate-400">남{c.audience.male ?? 0}% 여{c.audience.female ?? 0}%</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-3 text-[10px] text-slate-500">
                      시청자 데이터 없음
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Overlap */}
          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Users size={16} className="text-indigo-400" /> 시청자층 겹침 분석
              </h3>
              <span className="text-sm font-medium text-slate-400">분석 필요</span>
            </div>
            <div className="text-xs text-slate-400">
              선택된 크리에이터들의 시청자 중 동일 시청자 비율 추정치입니다. 겹침이 낮을수록 다양한 타겟에 도달할 수 있습니다.
            </div>
          </div>

          {/* Radar Comparison */}
          {(() => {
            const hasRadarData = compareCreators.every(
              (c) => Array.isArray(c.radarData) && c.radarData.length > 0
            );
            if (!hasRadarData) {
              return (
                <div className="glass-panel rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <Target size={16} className="text-amber-400" /> 능력치 레이더 비교
                  </h3>
                  <div className="flex items-center justify-center h-[300px] text-xs text-slate-500">
                    분석 데이터 없음
                  </div>
                </div>
              );
            }
            return (
              <div className="glass-panel rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <Target size={16} className="text-amber-400" /> 능력치 레이더 비교
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={compareCreators[0].radarData.map((d, i) => {
                    const obj = { cat: d.cat };
                    compareCreators.forEach((c, ci) => { obj[c.name] = c.radarData[i]?.v ?? 0; });
                    return obj;
                  })}>
                    <PolarGrid stroke="#1e293b" />
                    <PolarAngleAxis dataKey="cat" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fill: '#475569', fontSize: 9 }} domain={[0, 100]} />
                    {compareCreators.map((c, i) => (
                      <Radar key={c.id} name={c.name} dataKey={c.name} stroke={COLORS_COMPARE[i]} fill={COLORS_COMPARE[i]} fillOpacity={0.15} strokeWidth={2} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
