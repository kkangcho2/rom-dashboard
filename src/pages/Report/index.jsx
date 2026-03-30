import { useState } from 'react';
import {
  Calendar, Clock, Monitor, Activity, BarChart3, Megaphone, Quote, FileText,
  ExternalLink, MessageSquare, TrendingUp, ThumbsUp, ThumbsDown, Minus,
  CheckCircle2, Clipboard, Sparkles, Users, Shield, Target
} from 'lucide-react';
import { fetchYtTranscript, fetchYtChat, getVideoInfo } from '../../services/api';
import { analyzeReport } from '../../utils/reportAnalyzer';
import { ACTIVITY_ICONS, ACTIVITY_COLORS } from '../../utils/constants';
import { SentimentBadge } from '../../components/ui/Badges';

export default function DailyReportPage({ inline = false }) {
  const [drUrl, setDrUrl] = useState('');
  const [drDate, setDrDate] = useState(new Date().toISOString().split('T')[0]);
  const [drStart, setDrStart] = useState('');
  const [drEnd, setDrEnd] = useState('');
  const [drPeak, setDrPeak] = useState('');
  const [drAvg, setDrAvg] = useState('');
  const [drTranscript, setDrTranscript] = useState('');
  const [drChat, setDrChat] = useState('');
  const [drStatus, setDrStatus] = useState('');
  const [drStatusColor, setDrStatusColor] = useState('text-slate-500');
  const [drReport, setDrReport] = useState(null);
  const [drCopied, setDrCopied] = useState(null);

  const calcDuration = () => {
    if (!drStart || !drEnd) return '';
    const [sh, sm] = drStart.split(':').map(Number);
    const [eh, em] = drEnd.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 1440;
    return diff + '분';
  };

  const handleFetchTranscript = async () => {
    if (!drUrl) return;
    setDrStatus('Transcript 가져오는 중...');
    setDrStatusColor('text-amber-400');
    try {
      const data = await fetchYtTranscript(drUrl);
      if (data.ok) {
        setDrTranscript(data.transcript);
        setDrStatus(`Transcript 완료 (${data.lines}줄)`);
        setDrStatusColor('text-green-400');
      } else {
        setDrStatus('Transcript 실패: ' + data.error);
        setDrStatusColor('text-red-400');
      }
    } catch { setDrStatus('서버 연결 실패'); setDrStatusColor('text-red-400'); }
  };

  const handleFetchChat = async () => {
    if (!drUrl) return;
    setDrStatus('라이브 채팅 가져오는 중... (최대 30초)');
    setDrStatusColor('text-amber-400');
    try {
      const data = await fetchYtChat(drUrl);
      if (data.ok) {
        setDrChat(data.messages);
        setDrStatus(`채팅 완료 (${data.count}건)`);
        setDrStatusColor('text-green-400');
      } else {
        setDrStatus('채팅 실패: ' + data.error);
        setDrStatusColor('text-red-400');
      }
    } catch { setDrStatus('서버 연결 실패'); setDrStatusColor('text-red-400'); }
  };

  const handleFetchVideoInfo = async () => {
    if (!drUrl) return;
    setDrStatus('방송 정보 가져오는 중...');
    setDrStatusColor('text-amber-400');
    try {
      const data = await getVideoInfo(drUrl);
      if (data.ok) {
        if (data.actualStartTime) {
          const start = new Date(data.actualStartTime);
          setDrStart(`${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);
        }
        if (data.actualEndTime) {
          const end = new Date(data.actualEndTime);
          setDrEnd(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`);
        }
        if (data.isLive && data.concurrentViewers) {
          setDrPeak(String(data.concurrentViewers));
          setDrAvg(String(Math.round(data.concurrentViewers * 0.75)));
        } else if (data.viewCount) {
          const views = data.viewCount;
          const durSec = data.durationSeconds || 0;
          const isLongStream = durSec > 3600;
          let estimatedPeak, estimatedAvg;
          if (isLongStream) {
            const hours = durSec / 3600;
            let ratio;
            if (views < 2000) ratio = 4 + hours * 0.5;
            else if (views < 20000) ratio = 6 + hours * 0.7;
            else ratio = 10 + hours * 1.0;
            estimatedPeak = Math.round(views / ratio * 1.4);
            estimatedAvg = Math.round(views / ratio);
          } else {
            estimatedPeak = views;
            estimatedAvg = Math.round(views * 0.7);
          }
          setDrPeak(String(estimatedPeak));
          setDrAvg(String(estimatedAvg));
        }
        const parts = [];
        if (data.actualStartTime) parts.push('시작/종료 시간');
        if (data.concurrentViewers) parts.push('동시 시청자');
        else if (data.viewCount) parts.push(`조회수 ${data.viewCount}회 기반 추정${data.durationSeconds > 3600 ? ' (라이브)' : ''}`);
        setDrStatus(`방송 정보 완료 (${parts.join(', ') || '기본 정보'})`);
        setDrStatusColor('text-green-400');
      } else {
        setDrStatus('방송 정보 실패: ' + (data.error || 'unknown'));
        setDrStatusColor('text-red-400');
      }
    } catch { setDrStatus('서버 연결 실패'); setDrStatusColor('text-red-400'); }
  };

  const handleGenerate = () => {
    const result = analyzeReport(drTranscript, drChat);
    const d = new Date(drDate);
    setDrReport({
      날짜: `${d.getMonth() + 1}월 ${d.getDate()}일`,
      URL: drUrl,
      '방송 시작': drStart,
      '방송 종료': drEnd,
      '총 방송 시간': calcDuration(),
      '최고 동시': drPeak ? drPeak + '명' : '',
      '평균 시청자': drAvg ? drAvg + '명' : '',
      '방송 내용': result.content,
      '주요 키워드': result.keywords,
      '시청자 반응': result.reaction,
      '특이 사항': result.issues,
      '부정 동향': result.negative,
      _activities: result.activities,
      _overallSentiment: result.overallSentiment,
      _gameSentiment: result.gameSentiment,
      _topQuotes: result.topQuotes,
      _advertiserMetrics: result.advertiserMetrics,
      _suggestions: result.suggestions,
      _contentIssues: result.contentIssues,
      _chatStats: result.chatStats,
    });
  };

  const handleCopyField = (key, value) => {
    navigator.clipboard.writeText(value || '');
    setDrCopied(key);
    setTimeout(() => setDrCopied(null), 1200);
  };

  const handleCopyAll = () => {
    if (!drReport) return;
    const text = Object.entries(drReport)
      .filter(([k]) => !k.startsWith('_'))
      .map(([, v]) => (typeof v === 'string' ? v : '').replace(/\n/g, ' '))
      .join('\t');
    navigator.clipboard.writeText(text);
    setDrCopied('__all__');
    setTimeout(() => setDrCopied(null), 1200);
  };

  const renderEnhancedReport = () => {
    if (!drReport) return null;
    const activities = drReport._activities || [];
    const overallSentiment = drReport._overallSentiment || { positive: 0, negative: 0, neutral: 0, score: 50 };
    const gameSentiment = drReport._gameSentiment || { positive: 0, negative: 0, neutral: 0, score: 50, totalLines: 0 };
    const topQuotes = drReport._topQuotes || [];
    const metrics = drReport._advertiserMetrics || {};
    const suggestions = drReport._suggestions || [];
    const contentIssues = drReport._contentIssues || [];
    const chatStats = drReport._chatStats || {};
    const basicFields = Object.entries(drReport).filter(([k]) => !k.startsWith('_'));
    const sentTotal = overallSentiment.positive + overallSentiment.negative + overallSentiment.neutral || 1;
    const sentPosP = Math.round(overallSentiment.positive / sentTotal * 100);
    const sentNegP = Math.round(overallSentiment.negative / sentTotal * 100);
    const sentNeuP = 100 - sentPosP - sentNegP;
    const gameSentTotal = gameSentiment.positive + gameSentiment.negative + gameSentiment.neutral || 1;

    return (
      <div className="space-y-4">
        {/* Section A: 방송 개요 */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Monitor size={14} className="text-blue-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">방송 개요</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '날짜', value: drReport['날짜'], icon: Calendar },
              { label: '방송 시간', value: `${drReport['방송 시작'] || '-'} ~ ${drReport['방송 종료'] || '-'}`, icon: Clock },
              { label: '최고 동시', value: drReport['최고 동시'] || '-', icon: TrendingUp },
              { label: '평균 시청자', value: drReport['평균 시청자'] || '-', icon: Users },
            ].map((item, i) => (
              <div key={i} className="bg-dark-700/50 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <item.icon size={11} className="text-slate-500" />
                  <span className="text-[9px] text-slate-500 uppercase">{item.label}</span>
                </div>
                <div className="text-xs font-semibold text-slate-200">{item.value}</div>
              </div>
            ))}
          </div>
          {drReport.URL && (
            <div className="mt-2 text-[10px] text-slate-500 truncate">
              <ExternalLink size={10} className="inline mr-1" />
              {drReport.URL}
            </div>
          )}
        </div>

        {/* Section A-2: 채팅 필터링 & 게임 반응 요약 */}
        {chatStats.totalRaw > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={14} className="text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">채팅 분석 요약</h4>
              {chatStats.botFiltered > 0 && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  봇/노이즈 {chatStats.botFiltered}건 필터됨
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <div className="bg-dark-700/40 rounded-lg p-2 text-center">
                <div className="text-[9px] text-slate-500">전체 채팅</div>
                <div className="text-sm font-bold text-slate-200">{chatStats.totalRaw?.toLocaleString()}</div>
              </div>
              <div className="bg-dark-700/40 rounded-lg p-2 text-center">
                <div className="text-[9px] text-slate-500">봇/명령어 제외</div>
                <div className="text-sm font-bold text-red-400">-{chatStats.botFiltered}</div>
              </div>
              <div className="bg-dark-700/40 rounded-lg p-2 text-center">
                <div className="text-[9px] text-slate-500">유효 채팅</div>
                <div className="text-sm font-bold text-slate-200">{chatStats.afterBotFilter?.toLocaleString()}</div>
              </div>
              <div className="bg-dark-700/40 rounded-lg p-2 text-center border border-indigo-500/20">
                <div className="text-[9px] text-indigo-400">게임 관련</div>
                <div className="text-sm font-bold text-indigo-300">{chatStats.gameRelated?.toLocaleString()}</div>
              </div>
              <div className="bg-dark-700/40 rounded-lg p-2 text-center">
                <div className="text-[9px] text-slate-500">일반 잡담</div>
                <div className="text-sm font-bold text-slate-400">{chatStats.generalChat?.toLocaleString()}</div>
              </div>
            </div>

            {/* 게임 반응 감성 vs 전체 감성 비교 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-dark-700/30 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 mb-2">전체 감성</div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold" style={{ color: overallSentiment.score >= 60 ? '#22c55e' : overallSentiment.score >= 40 ? '#eab308' : '#ef4444' }}>
                    {overallSentiment.score}점
                  </div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-dark-600 overflow-hidden flex">
                      <div className="h-full bg-green-500" style={{ width: sentPosP + '%' }} />
                      <div className="h-full bg-slate-500" style={{ width: sentNeuP + '%' }} />
                      <div className="h-full bg-red-500" style={{ width: sentNegP + '%' }} />
                    </div>
                    <div className="flex justify-between mt-1 text-[9px]">
                      <span className="text-green-400">긍정 {sentPosP}%</span>
                      <span className="text-slate-400">중립 {sentNeuP}%</span>
                      <span className="text-red-400">부정 {sentNegP}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-dark-700/30 rounded-lg p-3 border border-indigo-500/10">
                <div className="text-[10px] text-indigo-400 mb-2">🎮 게임 반응만</div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold" style={{ color: gameSentiment.score >= 60 ? '#22c55e' : gameSentiment.score >= 40 ? '#eab308' : '#ef4444' }}>
                    {gameSentiment.score}점
                  </div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-dark-600 overflow-hidden flex">
                      <div className="h-full bg-green-500" style={{ width: Math.round(gameSentiment.positive / gameSentTotal * 100) + '%' }} />
                      <div className="h-full bg-slate-500" style={{ width: Math.round(gameSentiment.neutral / gameSentTotal * 100) + '%' }} />
                      <div className="h-full bg-red-500" style={{ width: Math.round(gameSentiment.negative / gameSentTotal * 100) + '%' }} />
                    </div>
                    <div className="flex justify-between mt-1 text-[9px]">
                      <span className="text-green-400">긍정 {Math.round(gameSentiment.positive / gameSentTotal * 100)}%</span>
                      <span className="text-indigo-300">{gameSentiment.totalLines}건 분석</span>
                      <span className="text-red-400">부정 {Math.round(gameSentiment.negative / gameSentTotal * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section A-3: 컨텐츠별 이슈 트래커 */}
        {contentIssues.length > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target size={14} className="text-red-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">컨텐츠별 이슈 감지</h4>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                {contentIssues.length}건
              </span>
            </div>
            <div className="space-y-2">
              {contentIssues.map((issue, i) => (
                <div key={i} className={`rounded-lg p-3 border ${
                  issue.severity === 'high' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'
                }`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      issue.severity === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {issue.severity === 'high' ? '🔴 주의' : '🟡 관찰'}
                    </span>
                    <span className="text-xs font-medium text-slate-300">{issue.summary}</span>
                  </div>
                  {issue.quotes && issue.quotes.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {issue.quotes.map((q, j) => (
                        <div key={j} className="text-[10px] text-slate-400 pl-3 border-l-2 border-slate-600">
                          "{q}"
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section B: 콘텐츠 활동 타임라인 */}
        {activities.length > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={14} className="text-purple-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">콘텐츠 활동 분석</h4>
              <span className="text-[9px] text-slate-500 ml-auto">{activities.length}개 활동 감지</span>
            </div>
            <div className="space-y-3">
              {activities.slice(0, 6).map((act, i) => {
                const ActIcon = ACTIVITY_ICONS[act.name] || Activity;
                const actColor = ACTIVITY_COLORS[act.name] || '#6366f1';
                const sentT = act.sentiment.positive + act.sentiment.negative + act.sentiment.neutral || 1;
                const posW = Math.round(act.sentiment.positive / sentT * 100);
                const negW = Math.round(act.sentiment.negative / sentT * 100);
                return (
                  <div key={i} className="bg-dark-700/40 rounded-lg overflow-hidden" style={{ borderLeft: `3px solid ${actColor}` }}>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ActIcon size={14} style={{ color: actColor }} />
                          <span className="text-xs font-bold text-slate-200">{act.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-dark-600 text-slate-400 font-medium">
                            {act.mentionCount}회 언급
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-500">
                          <MessageSquare size={10} className="inline mr-1" />
                          채팅 {act.chatReactions}건
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] text-slate-500 w-12">감성</span>
                        <div className="flex-1 h-2 rounded-full bg-dark-600 overflow-hidden flex">
                          {posW > 0 && <div className="h-full" style={{ width: `${posW}%`, backgroundColor: '#22c55e' }} />}
                          {negW > 0 && <div className="h-full" style={{ width: `${negW}%`, backgroundColor: '#ef4444' }} />}
                          <div className="h-full flex-1" style={{ backgroundColor: '#6366f1' }} />
                        </div>
                        <div className="flex gap-1.5 text-[8px]">
                          <span className="text-green-400">{posW}%</span>
                          <span className="text-red-400">{negW}%</span>
                        </div>
                      </div>
                      {act.keyMoments.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {act.keyMoments.map((km, j) => (
                            <div key={j} className="flex items-center gap-1.5 text-[10px]">
                              {km.type === 'success'
                                ? <CheckCircle2 size={10} className="text-green-400" />
                                : <span className="text-red-400">⚠</span>}
                              <span className={km.type === 'success' ? 'text-green-300' : 'text-red-300'}>{km.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {act.topQuotes.length > 0 && (
                        <div className="bg-dark-800/60 rounded-lg p-2 mt-1 space-y-1">
                          <div className="flex items-center gap-1 mb-1">
                            <Quote size={9} className="text-slate-500" />
                            <span className="text-[9px] text-slate-500 font-medium">실제 채팅</span>
                          </div>
                          {act.topQuotes.slice(0, 3).map((q, j) => (
                            <div key={j} className="flex items-start gap-1.5 text-[10px]">
                              <SentimentBadge sentiment={q.sentiment} />
                              <span className="text-slate-400 leading-relaxed">"{q.text}"</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section B-2: 컨텐츠별 채팅 참여도 */}
        {activities.length > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={14} className="text-cyan-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">컨텐츠별 채팅 참여도</h4>
              <span className="text-[9px] text-slate-500 ml-auto">총 채팅 {activities.reduce((sum, a) => sum + a.chatReactions, 0)}건 기준</span>
            </div>
            <div className="space-y-2">
              {(() => {
                const totalChat = activities.reduce((sum, a) => sum + a.chatReactions, 0) || 1;
                const sorted = [...activities].sort((a, b) => b.chatReactions - a.chatReactions);
                const maxChat = sorted[0]?.chatReactions || 1;
                return sorted.slice(0, 8).map((act, i) => {
                  const pct = Math.round(act.chatReactions / totalChat * 100);
                  const barW = Math.round(act.chatReactions / maxChat * 100);
                  const actColor = ACTIVITY_COLORS[act.name] || '#6366f1';
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400 w-24 truncate font-medium">{act.name}</span>
                      <div className="flex-1 h-5 bg-dark-700/50 rounded overflow-hidden relative">
                        <div
                          className="h-full rounded transition-all duration-700 flex items-center px-2"
                          style={{ width: `${barW}%`, backgroundColor: actColor + '40', borderLeft: `3px solid ${actColor}` }}
                        >
                          <span className="text-[9px] font-bold text-slate-300 whitespace-nowrap">{act.chatReactions}건</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold w-10 text-right" style={{ color: actColor }}>{pct}%</span>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="mt-3 pt-3 border-t border-dark-600/30">
              <div className="text-[9px] text-slate-500">
                💡 채팅 참여도가 높은 컨텐츠일수록 시청자 관심이 집중된 구간입니다.
                {(() => {
                  const sorted = [...activities].sort((a, b) => b.chatReactions - a.chatReactions);
                  if (sorted.length >= 2) {
                    return ` "${sorted[0].name}" 컨텐츠에서 가장 높은 참여도를 보였습니다.`;
                  }
                  return '';
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Section C: 시청자 반응 분석 */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-indigo-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">시청자 반응 분석</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-center mb-3">
                <div className="text-center">
                  <div className="relative w-24 h-12 overflow-hidden mx-auto">
                    <svg viewBox="0 0 100 50" className="w-full h-full">
                      <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                      <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none"
                        stroke={overallSentiment.score >= 70 ? '#22c55e' : overallSentiment.score >= 50 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${overallSentiment.score * 1.41} 141`}
                        className="transition-all duration-1000 ease-out" />
                    </svg>
                    <div className="absolute inset-0 flex items-end justify-center pb-0">
                      <span className="text-lg font-bold" style={{ color: overallSentiment.score >= 70 ? '#22c55e' : overallSentiment.score >= 50 ? '#f59e0b' : '#ef4444' }}>
                        {overallSentiment.score}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-500">종합 감성 점수</span>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { icon: ThumbsUp, label: '긍정', value: overallSentiment.positive, pct: sentPosP, color: '#22c55e', textColor: 'text-green-400' },
                  { icon: ThumbsDown, label: '부정', value: overallSentiment.negative, pct: sentNegP, color: '#ef4444', textColor: 'text-red-400' },
                  { icon: Minus, label: '중립', value: overallSentiment.neutral, pct: sentNeuP, color: '#6366f1', textColor: 'text-indigo-400' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <item.icon size={10} className={item.textColor} />
                    <span className="text-[10px] text-slate-400 w-8">{item.label}</span>
                    <div className="flex-1 h-3 rounded-full bg-dark-600 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                    </div>
                    <span className={`text-[10px] ${item.textColor} w-12 text-right font-medium`}>{item.pct}% ({item.value})</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-medium mb-2">활동별 감성 분포</div>
              <div className="space-y-1.5">
                {activities.slice(0, 5).map((act, i) => {
                  const t = act.sentiment.positive + act.sentiment.negative + act.sentiment.neutral || 1;
                  const p = Math.round(act.sentiment.positive / t * 100);
                  const n = Math.round(act.sentiment.negative / t * 100);
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-[9px] text-slate-400 w-20 truncate">{act.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-dark-600 overflow-hidden flex">
                        {p > 0 && <div className="h-full" style={{ width: `${p}%`, backgroundColor: '#22c55e' }} />}
                        {n > 0 && <div className="h-full" style={{ width: `${n}%`, backgroundColor: '#ef4444' }} />}
                        <div className="h-full flex-1" style={{ backgroundColor: '#6366f1' }} />
                      </div>
                      <span className="text-[8px] text-slate-500 w-8">{p}%+</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Section D: 광고주 인사이트 */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone size={14} className="text-amber-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">광고주 인사이트</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="bg-dark-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-accent-light">{metrics.engagementScore || 0}</div>
              <div className="text-[9px] text-slate-500 mt-1">참여도 점수</div>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3 text-center">
              <div className={`text-lg font-bold ${metrics.brandSafety === 'high' ? 'text-green-400' : metrics.brandSafety === 'medium' ? 'text-yellow-400' : 'text-red-400'}`}>
                {metrics.brandSafety === 'high' ? 'HIGH' : metrics.brandSafety === 'medium' ? 'MED' : 'LOW'}
              </div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Shield size={9} className={metrics.brandSafety === 'high' ? 'text-green-400' : metrics.brandSafety === 'medium' ? 'text-yellow-400' : 'text-red-400'} />
                <span className="text-[9px] text-slate-500">브랜드 안전</span>
              </div>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3 text-center">
              <div className="text-sm font-bold text-purple-400 truncate">{metrics.peakActivity || '-'}</div>
              <div className="text-[9px] text-slate-500 mt-1">피크 활동</div>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-400">{metrics.chatDensity || 0}</div>
              <div className="text-[9px] text-slate-500 mt-1">총 채팅 수</div>
            </div>
          </div>
          <div className="bg-dark-800/60 rounded-lg p-3 flex items-start gap-2">
            <Target size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-[9px] text-amber-400 font-bold uppercase tracking-wider mb-1">광고 배치 추천</div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{metrics.adRecommendation || '-'}</p>
            </div>
          </div>
        </div>

        {/* Section E: 실제 채팅 반응 */}
        {topQuotes.length > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Quote size={14} className="text-teal-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">실제 채팅 반응</h4>
              <span className="text-[9px] text-slate-500 ml-auto">{topQuotes.length}건 대표 채팅</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {topQuotes.map((q, i) => (
                <div key={i} className="bg-dark-700/40 rounded-lg p-2.5 flex items-start gap-2"
                  style={{ borderLeft: `2px solid ${q.sentiment === 'positive' ? '#22c55e' : q.sentiment === 'negative' ? '#ef4444' : '#6366f1'}` }}>
                  <div className="flex-1">
                    <div className="text-[11px] text-slate-300 leading-relaxed mb-1">"{q.text}"</div>
                    <div className="flex items-center gap-1.5">
                      <SentimentBadge sentiment={q.sentiment} />
                      <span className="text-[8px] text-slate-600">{q.activity}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section E-2: 시청자 건의사항 */}
        {suggestions.length > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={14} className="text-orange-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">시청자 건의사항 · 피드백</h4>
              <span className="text-[9px] text-slate-500 ml-auto">{suggestions.length}건 감지</span>
            </div>
            {/* Category summary */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(() => {
                const catCounts = {};
                suggestions.forEach(s => { catCounts[s.category] = (catCounts[s.category] || 0) + 1; });
                const catColors = {
                  '버그/오류': 'bg-red-500/20 text-red-400 border-red-500/30',
                  '밸런스': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                  'UI/편의': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                  '콘텐츠 추가': 'bg-green-500/20 text-green-400 border-green-500/30',
                  '이벤트/보상': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                  '일반': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
                };
                return Object.entries(catCounts).map(([cat, count], i) => (
                  <span key={i} className={`text-[9px] px-2 py-0.5 rounded-full border font-medium ${catColors[cat] || catColors['일반']}`}>
                    {cat} {count}건
                  </span>
                ));
              })()}
            </div>
            <div className="space-y-1.5">
              {suggestions.map((s, i) => {
                const catBorderColors = {
                  '버그/오류': '#ef4444',
                  '밸런스': '#f97316',
                  'UI/편의': '#3b82f6',
                  '콘텐츠 추가': '#22c55e',
                  '이벤트/보상': '#a855f7',
                  '일반': '#6366f1',
                };
                return (
                  <div key={i} className="bg-dark-700/40 rounded-lg p-2.5 flex items-start gap-2"
                    style={{ borderLeft: `2px solid ${catBorderColors[s.category] || '#6366f1'}` }}>
                    <div className="flex-1">
                      <div className="text-[11px] text-slate-300 leading-relaxed">"{s.text}"</div>
                      <span className="text-[8px] text-slate-600 mt-0.5 inline-block">{s.category}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section F: 기존 리포트 데이터 */}
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-dark-700/50 border-b border-dark-600/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-slate-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">리포트 원본 데이터</h4>
            </div>
            <button onClick={handleCopyAll}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-accent/20 text-accent-light border border-accent/30 hover:bg-accent/30 transition-all">
              {drCopied === '__all__' ? '복사됨!' : '전체 복사 (탭 구분)'}
            </button>
          </div>
          {basicFields.map(([key, value]) => (
            <div key={key} className="flex items-stretch border-b border-dark-600/30 last:border-b-0">
              <div className="w-[110px] min-w-[110px] px-3 py-2.5 bg-accent/5 text-[11px] font-semibold text-slate-400 flex items-center border-r border-dark-600/30">
                {key}
              </div>
              <div className={`flex-1 px-3 py-2.5 text-xs whitespace-pre-wrap break-words ${value ? 'text-slate-200' : 'text-slate-600 italic'}`}>
                {value || '-'}
              </div>
              <button
                onClick={() => handleCopyField(key, value)}
                className="w-9 min-w-[36px] flex items-center justify-center border-l border-dark-600/30 text-slate-500 hover:text-accent-light hover:bg-accent/10 transition-all"
                title="복사"
              >
                {drCopied === key ? <CheckCircle2 size={12} className="text-green-400" /> : <Clipboard size={12} />}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Inline mode
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 page-enter">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
          <Calendar size={18} className="text-indigo-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">데일리 방송 모니터링 리포트</h2>
          <p className="text-[10px] text-slate-500">URL과 방송 정보를 입력하고 리포트를 생성하세요</p>
        </div>
      </div>

      <div className="glass-panel rounded-lg p-3 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-accent/30 text-white text-[9px] font-bold flex items-center justify-center">1</span> URL 입력 → Transcript/채팅 자동 가져오기</div>
        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-accent/30 text-white text-[9px] font-bold flex items-center justify-center">2</span> 방송 정보 입력 (시간, 시청자 등)</div>
        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-accent/30 text-white text-[9px] font-bold flex items-center justify-center">3</span> "리포트 생성하기" 클릭</div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">유튜브 URL</label>
          <input type="text" placeholder="https://www.youtube.com/watch?v=..." value={drUrl} onChange={e => setDrUrl(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all" />
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">날짜</label>
          <input type="date" value={drDate} onChange={e => setDrDate(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent/50 transition-all" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">방송 시작</label>
            <input type="time" value={drStart} onChange={e => setDrStart(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent/50 transition-all" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">방송 종료</label>
            <input type="time" value={drEnd} onChange={e => setDrEnd(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent/50 transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">최고 동시 시청자</label>
            <input type="number" placeholder="216" value={drPeak} onChange={e => setDrPeak(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">평균 시청자</label>
            <input type="number" placeholder="171" value={drAvg} onChange={e => setDrAvg(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all" />
          </div>
        </div>

        <div className="text-[10px] text-slate-500 uppercase tracking-wider pt-1 pb-1 border-b border-dark-600/50 font-bold">데이터 입력</div>

        <div className="grid grid-cols-3 gap-2">
          <button onClick={handleFetchTranscript} className="py-2 rounded-lg text-xs font-bold text-slate-300 border border-dark-600 hover:border-accent/40 hover:text-accent-light transition-all">
            Transcript 자동
          </button>
          <button onClick={handleFetchChat} className="py-2 rounded-lg text-xs font-bold text-slate-300 border border-dark-600 hover:border-accent/40 hover:text-accent-light transition-all">
            라이브 채팅 자동
          </button>
          <button onClick={handleFetchVideoInfo} className="py-2 rounded-lg text-xs font-bold text-slate-300 border border-dark-600 hover:border-accent/40 hover:text-accent-light transition-all">
            방송 정보 자동
          </button>
        </div>

        {drStatus && <div className={`text-[11px] ${drStatusColor}`}>{drStatus}</div>}

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Transcript</label>
          <textarea rows={4} placeholder="자동 가져오기 또는 수동 붙여넣기..." value={drTranscript} onChange={e => setDrTranscript(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none transition-all" />
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">라이브 채팅</label>
          <textarea rows={4} placeholder="자동 가져오기 또는 수동 붙여넣기..." value={drChat} onChange={e => setDrChat(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none transition-all" />
        </div>

        <button onClick={handleGenerate}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-purple-600 text-white hover:shadow-lg hover:shadow-accent/30 transition-all">
          <Sparkles size={16} /> 리포트 생성하기
        </button>
      </div>

      {drReport && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-accent-light flex items-center gap-2">
              <Sparkles size={14} /> 방송 데일리 리포트
            </h3>
          </div>
          {renderEnhancedReport()}
        </div>
      )}
    </div>
  );
}
