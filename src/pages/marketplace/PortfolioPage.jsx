import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Star, TrendingUp, Clock, Award, Eye, Sparkles, Users, Gamepad2, BarChart3, ExternalLink, Megaphone, Shield } from 'lucide-react';
import { getPortfolio, getPortfolioList } from '../../services/marketplace-api';
import { startCreatorAnalysis, startDeepAnalysis, getDeepAnalysis } from '../../services/api';
import { VerifiedBadge, GradeBadge, PlatformBadges, CreatorCard, MetricBox, EmptyState } from '../../components/marketplace';

function formatSubs(n) {
  if (!n) return '-';
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
  return String(n);
}

// ─── Deep Analysis Section ──────────────────────────────────
function DeepAnalysisSection({ channelId, channelName, deepData: initialDeep }) {
  const [deep, setDeep] = useState(initialDeep || null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const navigate = useNavigate();

  const handleStart = async () => {
    const token = localStorage.getItem('lp_accessToken');
    if (!token) { navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`); return; }
    if (!channelId) return;

    setLoading(true);
    try {
      await startDeepAnalysis(channelId, 5);
      setPolling(true);
      // 폴링: 10초 간격, 최대 6회 (1분)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const result = await getDeepAnalysis(channelId);
          if (result.hasDeepAnalysis) {
            clearInterval(poll);
            setDeep(result.deepAnalysis);
            setPolling(false);
            setLoading(false);
          } else if (attempts >= 6) {
            clearInterval(poll);
            setPolling(false);
            setLoading(false);
          }
        } catch { if (attempts >= 6) { clearInterval(poll); setPolling(false); setLoading(false); } }
      }, 10000);
    } catch { setLoading(false); }
  };

  if (!deep && !loading) {
    return (
      <div className="glass-panel rounded-xl p-5 text-center border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-indigo-500/5 animate-fade-in-up" style={{ animationDelay: '350ms' }}>
        <Sparkles className="w-7 h-7 text-purple-400/60 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-white mb-1">딥 분석</h3>
        <p className="text-[11px] text-slate-500 mb-4">영상 Transcript 분석으로 크리에이터 성격, 게임 집중도, 광고 적합도를 평가합니다. (5개 영상, 약 1분 소요)</p>
        <button onClick={handleStart} className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:shadow-lg hover:shadow-purple-500/20 transition">
          딥 분석 시작
        </button>
      </div>
    );
  }

  if (loading || polling) {
    return (
      <div className="glass-panel rounded-xl p-6 text-center animate-fade-in-up">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto animate-pulse mb-3">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <p className="text-xs text-slate-400">영상 Transcript 수집 + 분석 중...</p>
        <p className="text-[10px] text-slate-600 mt-1">약 1분 정도 소요됩니다</p>
      </div>
    );
  }

  // 딥 분석 결과 표시
  const p = deep.personality || {};
  const gf = deep.gameFocus || {};
  const ad = deep.adSuitability || {};
  const ve = deep.viewerEngagement || deep.commentSentiment || {};
  const vs = deep.videoStats || {};
  const style = deep.speakingStyle || {};

  return (
    <div className="space-y-5 animate-fade-in-up" style={{ animationDelay: '350ms' }}>
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-400" /> 딥 분석 결과
        <span className="text-[10px] text-slate-500 font-normal">{deep.videosAnalyzed || 0}개 영상 Transcript 분석</span>
      </h3>

      {/* 성격 + 광고적합도 + 게임집중도 3열 */}
      <div className="grid grid-cols-3 gap-3">
        {/* 성격 */}
        <div className="glass-panel rounded-xl p-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">크리에이터 성격</div>
          <div className="text-lg font-bold text-white mb-2 capitalize">
            {{friendly:'친근형',energetic:'에너제틱형',analytical:'분석형',educational:'교육형',humorous:'유머형',aggressive:'공격형'}[p.dominant] || '분석 필요'}
          </div>
          {p.traits && Object.entries(p.traits).filter(([,v]) => v > 5).sort((a,b) => b[1]-a[1]).slice(0,4).map(([trait, pct]) => (
            <div key={trait} className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] text-slate-400 w-12 capitalize">{{friendly:'친근',energetic:'열정',analytical:'분석',educational:'교육',humorous:'유머',aggressive:'공격'}[trait] || trait}</span>
              <div className="flex-1 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-slate-500 w-8 text-right">{pct}%</span>
            </div>
          ))}
        </div>

        {/* 광고 적합도 */}
        <div className="glass-panel rounded-xl p-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">광고 적합도</div>
          <div className="flex items-center gap-3 mb-3">
            <div className={`text-3xl font-extrabold ${
              ad.grade === 'S' ? 'text-amber-400' : ad.grade === 'A' ? 'text-indigo-400' :
              ad.grade === 'B' ? 'text-blue-400' : 'text-slate-400'
            }`}>{ad.grade || '-'}</div>
            <div className="text-xl font-bold text-white">{ad.score || 0}점</div>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">{ad.recommendation || ''}</p>
          {deep.paidPromotion?.count > 0 && (
            <div className="mt-2 px-2 py-1.5 rounded bg-amber-500/10 border border-amber-500/20">
              <span className="text-[10px] text-amber-400 font-bold">유료광고 {deep.paidPromotion.count}건</span>
              <span className="text-[10px] text-slate-500 ml-1">/ {deep.paidPromotion.total}건 ({deep.paidPromotion.rate}%)</span>
            </div>
          )}
        </div>

        {/* 게임 집중도 */}
        <div className="glass-panel rounded-xl p-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">게임 집중도</div>
          <div className="text-3xl font-extrabold text-white mb-1">{gf.focusScore || 0}<span className="text-base text-slate-500">%</span></div>
          <p className="text-[10px] text-slate-400 mb-3">{gf.description || ''}</p>
          <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${gf.focusScore >= 60 ? 'bg-emerald-500' : gf.focusScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${gf.focusScore || 0}%` }} />
          </div>
        </div>
      </div>

      {/* 영상 통계 + 댓글 감성 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel rounded-xl p-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">영상 통계 (최근 {vs.totalVideos}개)</div>
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-sm font-bold text-white">{(vs.avgViews || 0).toLocaleString()}</div><div className="text-[10px] text-slate-500">평균 조회수</div></div>
            <div><div className="text-sm font-bold text-white">{(vs.maxViews || 0).toLocaleString()}</div><div className="text-[10px] text-slate-500">최고 조회수</div></div>
            <div><div className="text-sm font-bold text-white">{(vs.avgLikes || 0).toLocaleString()}</div><div className="text-[10px] text-slate-500">평균 좋아요</div></div>
            <div><div className="text-sm font-bold text-white">{vs.engagementRate || 0}%</div><div className="text-[10px] text-slate-500">인게이지먼트</div></div>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">시청자 참여도</div>
          <div className="text-xl font-bold text-white mb-1">{ve.engagementLevel || '분석 중'}</div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="text-center bg-indigo-500/10 rounded-lg p-2">
              <div className="text-sm font-bold text-indigo-400">{ve.likeRate || 0}%</div>
              <div className="text-[10px] text-slate-500">좋아요율</div>
            </div>
            <div className="text-center bg-emerald-500/10 rounded-lg p-2">
              <div className="text-sm font-bold text-emerald-400">{ve.commentRate || 0}%</div>
              <div className="text-[10px] text-slate-500">댓글율</div>
            </div>
            <div className="text-center bg-purple-500/10 rounded-lg p-2">
              <div className="text-sm font-bold text-purple-400">{(ve.totalComments || 0).toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">총 댓글</div>
            </div>
          </div>
        </div>
      </div>

      {/* AI 종합 인사이트 */}
      {deep.aiInsight && (
        <div className="glass-panel rounded-xl p-5 border border-purple-500/15 bg-gradient-to-br from-purple-500/5 to-indigo-500/5">
          <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-purple-400" /> AI 종합 인사이트
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">{deep.aiInsight}</p>
        </div>
      )}
    </div>
  );
}

// ─── Portfolio Detail ───────────────────────────────────────
function PortfolioDetail({ creatorId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError(null);
    getPortfolio(creatorId)
      .then(setProfile)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [creatorId]);

  // 분석 시작
  const handleAnalyze = async () => {
    if (!profile?.youtube_channel_id) return;

    // 로그인 체크
    const token = localStorage.getItem('lp_accessToken');
    if (!token) {
      navigate(`/login?returnUrl=${encodeURIComponent(`/marketplace/portfolio/${creatorId}`)}`);
      return;
    }

    setAnalyzing(true);
    try {
      const channelUrl = `https://www.youtube.com/channel/${profile.youtube_channel_id}`;
      await startCreatorAnalysis(channelUrl);
      // 분석 완료까지 폴링 (최대 30초)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const updated = await getPortfolio(creatorId);
          if (updated.analysis || attempts >= 6) {
            clearInterval(poll);
            setProfile(updated);
            setAnalyzing(false);
          }
        } catch {
          if (attempts >= 6) { clearInterval(poll); setAnalyzing(false); }
        }
      }, 5000);
    } catch (e) {
      setAnalyzing(false);
      alert('분석 시작 실패: ' + (e.message || '로그인이 필요합니다'));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto animate-pulse mb-3">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <p className="text-xs text-slate-500">포트폴리오 로딩 중...</p>
      </div>
    </div>
  );

  if (error) return <EmptyState icon={Eye} title="포트폴리오를 찾을 수 없습니다" description={error} />;
  if (!profile) return null;

  const a = profile.analysis; // 분석 데이터 (있으면)
  const subs = profile.subscriber_count || a?.channel?.subscribers || 0;
  const games = profile.top_games || [];
  const categories = profile.categories || [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* ── Header ── */}
      <div className="glass-panel rounded-2xl p-6 mb-5 animate-fade-in-up">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-dark-600/50 flex items-center justify-center text-xl font-bold text-white shrink-0">
            {(a?.channel?.thumbnail || profile.thumbnail_url) ? (
              <img src={a?.channel?.thumbnail || profile.thumbnail_url} alt="" className="w-full h-full rounded-2xl object-cover" />
            ) : profile.display_name?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h1 className="text-xl font-bold text-white">{profile.display_name}</h1>
              <GradeBadge grade={profile.engagement_grade} size="lg" />
              <VerifiedBadge badge={profile.verified_viewer_badge} size="lg" />
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
              <span>구독자 {formatSubs(subs)}명</span>
              {a && <span>영상 {a.titlesAnalyzed || 0}개 분석</span>}
              {a?.sponsorship?.sponsoredCount > 0 && <span>광고 경험 {a.sponsorship.sponsoredCount}건</span>}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {categories.map(c => (
                <span key={c} className="text-[10px] px-2 py-0.5 rounded bg-dark-700/60 text-slate-400 border border-dark-600/30">{c}</span>
              ))}
            </div>
          </div>
          {profile.youtube_channel_id && (
            <a href={`https://www.youtube.com/channel/${profile.youtube_channel_id}`} target="_blank" rel="noopener noreferrer"
              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition shrink-0" title="YouTube 채널">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* ── 분석 데이터가 있을 때 ── */}
      {a ? (
        <>
          {/* Game History */}
          {a.games && (a.games.main?.length > 0 || a.games.sub?.length > 0) && (
            <div className="glass-panel rounded-xl p-5 mb-5 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-indigo-400" /> 게임 히스토리
                <span className="text-[10px] text-slate-500 font-normal ml-1">최근 {a.titlesAnalyzed}개 영상 기준</span>
              </h3>

              {/* Main Games */}
              {a.games.main?.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">주력 게임 (40%+)</div>
                  <div className="space-y-1.5">
                    {a.games.main.map(g => {
                      const isSponsored = (profile.sponsored_games || []).includes(g.game);
                      return (
                      <div key={g.game} className={`flex items-center gap-3 rounded-lg p-2.5 border ${isSponsored ? 'bg-amber-500/5 border-amber-500/15' : 'bg-indigo-500/5 border-indigo-500/10'}`}>
                        <span className="text-xs font-medium text-white flex-1">{g.game}</span>
                        {isSponsored && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">광고</span>}
                        <span className="text-[10px] text-slate-400">{g.genre}</span>
                        <span className="text-[10px] font-bold text-indigo-400">{g.percentage}%</span>
                        <div className="w-20 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${isSponsored ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${g.percentage}%` }} />
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sub Games */}
              {a.games.sub?.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">서브 게임 (10-40%)</div>
                  <div className="flex gap-2 flex-wrap">
                    {a.games.sub.map(g => {
                      const isSponsored = (profile.sponsored_games || []).includes(g.game);
                      return (
                      <span key={g.game} className={`text-xs px-2.5 py-1 rounded-lg border ${isSponsored ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/15'}`}>
                        {g.game} {isSponsored && <span className="text-[9px] font-bold">광고</span>} <span className="opacity-60">{g.percentage}%</span>
                      </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* One-off Games */}
              {a.games.oneOff?.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">단발성 ({'<'}10%)</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {a.games.oneOff.map(g => (
                      <span key={g.game} className="text-[10px] px-2 py-0.5 rounded bg-dark-700/40 text-slate-500">{g.game}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Genre + Sponsorship Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="glass-panel rounded-xl p-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">장르 분포</div>
              {a.genres?.length > 0 ? (
                <div className="space-y-1.5">
                  {a.genres.slice(0, 5).map(g => (
                    <div key={g.genre} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{g.genre}</span>
                      <span className="text-slate-500">{g.count}건</span>
                    </div>
                  ))}
                </div>
              ) : <div className="text-xs text-slate-600">데이터 없음</div>}
            </div>

            <div className="glass-panel rounded-xl p-4 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">광고 이력</div>
              {(() => {
                // sponsored_games DB + 키워드 감지 통합
                const sponsoredGames = profile.sponsored_games || [];
                const allGames = [...(a.games?.main || []), ...(a.games?.sub || []), ...(a.games?.oneOff || [])];
                const adGames = allGames.filter(g => sponsoredGames.includes(g.game));
                const keywordCount = a.sponsorship?.sponsoredCount || 0;
                const totalAds = Math.max(adGames.length, keywordCount);
                return (
                  <>
                    <div className="text-2xl font-bold text-amber-400 mb-1">{totalAds}건</div>
                    {adGames.length > 0 && (
                      <div className="flex gap-1 flex-wrap mb-1">
                        {adGames.map(g => (
                          <span key={g.game} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">{g.game}</span>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-500">
                      DB 등록 광고게임 {adGames.length}건 | 키워드 감지 {keywordCount}건
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="glass-panel rounded-xl p-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">콘텐츠 구성</div>
              {(() => {
                const cb = a.contentBreakdown || {};
                const liveCount = cb.live || 0;
                const vodCount = cb.vod || (a.titlesAnalyzed || 0) - (a.shorts?.count || 0);
                const shortsCount = cb.shorts || a.shorts?.count || 0;
                const total = liveCount + vodCount + shortsCount || a.titlesAnalyzed || 0;
                return (
                  <>
                    <div className="flex gap-2.5 mb-2">
                      {liveCount > 0 && (
                        <div>
                          <div className="text-lg font-bold text-red-400">{liveCount}</div>
                          <div className="text-[10px] text-slate-500">라이브</div>
                        </div>
                      )}
                      {liveCount > 0 && <div className="text-slate-700 self-center text-xs">+</div>}
                      <div>
                        <div className="text-lg font-bold text-indigo-400">{vodCount}</div>
                        <div className="text-[10px] text-slate-500">동영상</div>
                      </div>
                      <div className="text-slate-700 self-center text-xs">+</div>
                      <div>
                        <div className="text-lg font-bold text-pink-400">{shortsCount}</div>
                        <div className="text-[10px] text-slate-500">Shorts</div>
                      </div>
                      <div className="text-slate-700 self-center text-xs">=</div>
                      <div>
                        <div className="text-lg font-bold text-slate-400">{total}</div>
                        <div className="text-[10px] text-slate-500">전체</div>
                      </div>
                    </div>
                    {total > 0 && (
                      <div className="h-2 bg-dark-700 rounded-full overflow-hidden flex">
                        {liveCount > 0 && <div className="h-full bg-red-500" style={{ width: `${Math.round((liveCount / total) * 100)}%` }} />}
                        <div className="h-full bg-indigo-500" style={{ width: `${Math.round((vodCount / total) * 100)}%` }} />
                        <div className="h-full bg-pink-500" style={{ width: `${Math.round((shortsCount / total) * 100)}%` }} />
                      </div>
                    )}
                    <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                      {liveCount > 0 && <span className="text-red-500">라이브 {Math.round((liveCount / total) * 100)}%</span>}
                      <span className="text-indigo-500">동영상 {total > 0 ? Math.round((vodCount / total) * 100) : 0}%</span>
                      <span className="text-pink-500">Shorts {total > 0 ? Math.round((shortsCount / total) * 100) : 0}%</span>
                    </div>
                    {cb.crossPlatform && <div className="text-[9px] text-emerald-400 mt-1">{cb.crossPlatform === 'chzzk' ? '치지직' : '아프리카TV'}에서 라이브 방송 확인됨</div>}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Recent Game Activity */}
          {a.recentAnalysis?.length > 0 && (
            <div className="glass-panel rounded-xl p-5 mb-5 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" /> 최근 활동 분석
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-dark-600/30">
                      <th className="text-left text-slate-500 font-medium py-2 pr-4">게임</th>
                      <th className="text-left text-slate-500 font-medium py-2 pr-4">장르</th>
                      <th className="text-center text-slate-500 font-medium py-2 pr-4">영상 수</th>
                      <th className="text-center text-slate-500 font-medium py-2 pr-4">빈도</th>
                      <th className="text-center text-slate-500 font-medium py-2">광고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.recentAnalysis.map(r => (
                      <tr key={r.game} className="border-b border-dark-600/15">
                        <td className="py-2.5 pr-4 font-medium text-white">{r.game}</td>
                        <td className="py-2.5 pr-4 text-slate-400">{r.genre}</td>
                        <td className="py-2.5 pr-4 text-center text-slate-300">{r.count}</td>
                        <td className="py-2.5 pr-4 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            r.frequency === 'High' ? 'bg-emerald-500/15 text-emerald-400' :
                            r.frequency === 'Medium' ? 'bg-amber-500/15 text-amber-400' :
                            'bg-slate-500/15 text-slate-400'
                          }`}>{r.frequency}</span>
                        </td>
                        <td className="py-2.5 text-center">
                          {(r.hasSponsor || (profile.sponsored_games || []).includes(r.game))
                            ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">광고</span>
                            : <span className="text-slate-600">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Marketing Insight */}
          {(profile.marketing_insight || a.marketingInsight) && (
            <div className="glass-panel rounded-xl p-5 mb-5 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-400" /> 마케팅 인사이트
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">{profile.marketing_insight || a.marketingInsight}</p>
            </div>
          )}

          {/* 성격 + 광고적합도 + 게임집중도 (통합 분석 결과) */}
          {(a.personality || a.adSuitability || a.gameFocus) && (
            <div className="space-y-5 animate-fade-in-up" style={{ animationDelay: '350ms' }}>
              <div className="grid grid-cols-3 gap-3">
                {/* 성격 */}
                {a.personality && (
                  <div className="glass-panel rounded-xl p-4">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">크리에이터 성격</div>
                    <div className="text-lg font-bold text-white mb-2">
                      {{friendly:'친근형',energetic:'에너제틱형',analytical:'분석형',educational:'교육형',humorous:'유머형',aggressive:'공격형',unknown:'분석 중'}[a.personality.dominant] || '분석 중'}
                    </div>
                    {a.personality.traits && Object.entries(a.personality.traits).filter(([,v]) => v > 5).sort((a,b) => b[1]-a[1]).slice(0,4).map(([trait, pct]) => (
                      <div key={trait} className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] text-slate-400 w-12">{{friendly:'친근',energetic:'열정',analytical:'분석',educational:'교육',humorous:'유머',aggressive:'공격'}[trait] || trait}</span>
                        <div className="flex-1 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-500 w-8 text-right">{pct}%</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* 광고 적합도 */}
                {a.adSuitability && (
                  <div className="glass-panel rounded-xl p-4">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">광고 적합도</div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`text-3xl font-extrabold ${
                        a.adSuitability.grade === 'S' ? 'text-amber-400' : a.adSuitability.grade === 'A' ? 'text-indigo-400' :
                        a.adSuitability.grade === 'B' ? 'text-blue-400' : 'text-slate-400'
                      }`}>{a.adSuitability.grade || '-'}</div>
                      <div className="text-xl font-bold text-white">{a.adSuitability.score || 0}점</div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">{a.adSuitability.recommendation || ''}</p>
                  </div>
                )}
                {/* 게임 집중도 */}
                {a.gameFocus && (
                  <div className="glass-panel rounded-xl p-4">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">게임 집중도</div>
                    <div className="text-3xl font-extrabold text-white mb-1">{a.gameFocus.focusScore || 0}<span className="text-base text-slate-500">%</span></div>
                    <p className="text-[10px] text-slate-400 mb-3">{a.gameFocus.description || ''}</p>
                    <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${(a.gameFocus.focusScore||0) >= 60 ? 'bg-emerald-500' : (a.gameFocus.focusScore||0) >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${a.gameFocus.focusScore || 0}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* 실제 인게이지먼트 (통합 분석) */}
              {a.engagement && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-panel rounded-xl p-4">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">실제 인게이지먼트 (90일)</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><div className="text-sm font-bold text-white">{(a.engagement.avgViews || 0).toLocaleString()}</div><div className="text-[10px] text-slate-500">평균 조회수</div></div>
                      <div><div className="text-sm font-bold text-white">{(a.engagement.avgLikes || 0).toLocaleString()}</div><div className="text-[10px] text-slate-500">평균 좋아요</div></div>
                      <div><div className="text-sm font-bold text-white">{(a.engagement.avgComments || 0).toLocaleString()}</div><div className="text-[10px] text-slate-500">평균 댓글</div></div>
                      <div><div className="text-sm font-bold text-indigo-400">{a.engagement.likeRate || 0}%</div><div className="text-[10px] text-slate-500">좋아요율</div></div>
                    </div>
                  </div>
                  <div className="glass-panel rounded-xl p-4">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">영상별 조회수 범위</div>
                    <div className="flex items-end gap-2 mb-2">
                      <div className="text-center">
                        <div className="text-xs text-slate-500">최소</div>
                        <div className="text-sm font-bold text-slate-400">{(a.engagement.minViews || 0).toLocaleString()}</div>
                      </div>
                      <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden relative mx-2">
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-600 via-indigo-500 to-emerald-500 rounded-full" />
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-500">최대</div>
                        <div className="text-sm font-bold text-emerald-400">{(a.engagement.maxViews || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* ── 분석 데이터 없을 때 ── */
        <>
          {/* Basic game tags */}
          {games.length > 0 && (
            <div className="glass-panel rounded-xl p-5 mb-5 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-indigo-400" /> 플레이 게임
              </h3>
              <div className="flex gap-2 flex-wrap">
                {games.map(g => (
                  <span key={g} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{g}</span>
                ))}
              </div>
            </div>
          )}

          {/* Analyze CTA */}
          <div className="glass-panel rounded-xl p-6 text-center border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <BarChart3 className="w-8 h-8 text-indigo-400/60 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">상세 분석이 필요합니다</h3>
            <p className="text-xs text-slate-500 mb-4">채널 크롤링 후 게임 히스토리, 장르 분포, 광고 이력, 마케팅 인사이트를 확인할 수 있습니다.</p>
            {profile.youtube_channel_id && (
              <button onClick={handleAnalyze} disabled={analyzing}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/20 transition disabled:opacity-50">
                {analyzing ? '분석 중...' : '이 크리에이터 분석 시작'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Marketplace Landing ────────────────────────────────────
// 모바일 게임 목록 (이외는 PC로 분류)
const MOBILE_GAMES = new Set([
  '리니지M','리니지W','리니지2M','리니지클래식','로드나인','오딘','검은사막 모바일',
  '마비노기 모바일','나이트크로우','히트2','뮤 오리진','뮤 오리진2','뮤 오리진3',
  '미르M','MIR4','아이온2','아키텍트','세븐나이츠 리버스','스톤에이지 키우기',
  '창세기전 키우기','메이플 키우기','일곱 개의 대죄','뱀피르','그랑사가','메이플스토리M',
  '승리의 여신: 니케','블루 아카이브','원신','붕괴: 스타레일','명일방주','에픽세븐',
  '쿠키런: 킹덤','쿠키런','서머너즈워','브롤스타즈','두근두근타운','컴투스프로야구',
  '모바일 레전드','PUBG 모바일','삼국지 전략판','DX: 각성자들','카운터사이드',
  '가디언 테일즈','와일드 리프트','조선협객전','RF온라인','레이븐2','V4',
  '이카루스M','천애명월도M','아르카','라그나로크','빅보스','기적의검','카이저',
  '다크앤다커 모바일','드래곤빌리지','로블록스',
]);
const GENRE_TABS = ['전체', '모바일', 'PC', 'MMORPG', '롤플레잉', '액션', 'FPS', 'MOBA', '캐주얼'];

function MarketplaceLanding() {
  const [creators, setCreators] = useState([]);
  const [totalCreators, setTotalCreators] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [activeTab, setActiveTab] = useState('전체');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    getPortfolioList(1, 50)
      .then(data => { setCreators(data.creators || []); setTotalCreators(data.pagination?.total || 0); })
      .finally(() => setLoading(false));
  }, []);

  // 탭 필터링
  const filteredCreators = creators.filter(c => {
    if (activeTab === '전체') return true;
    const games = c.top_games || (c.top_games_json ? JSON.parse(c.top_games_json) : []);
    const cats = c.categories || [];

    if (activeTab === '모바일') return games.some(g => MOBILE_GAMES.has(g));
    if (activeTab === 'PC') return games.some(g => !MOBILE_GAMES.has(g)) || games.length === 0;
    // 장르 필터
    return cats.includes(activeTab) || games.some(g => {
      // 간단한 장르 매핑
      if (activeTab === 'MMORPG') return ['MMORPG'].includes(cats[0]) || MOBILE_GAMES.has(g);
      return false;
    });
  });

  // 모바일 게임 크리에이터 우선 정렬
  const sorted = [...filteredCreators].sort((a, b) => {
    const aGames = a.top_games || [];
    const bGames = b.top_games || [];
    const aIsMobile = aGames.some(g => MOBILE_GAMES.has(g)) ? 1 : 0;
    const bIsMobile = bGames.some(g => MOBILE_GAMES.has(g)) ? 1 : 0;
    if (bIsMobile !== aIsMobile) return bIsMobile - aIsMobile;
    return (b.avg_concurrent_viewers || 0) - (a.avg_concurrent_viewers || 0);
  });

  const displayCreators = showAll ? sorted : sorted.slice(0, 16);
  const hasCreators = creators.length > 0;

  return (
    <div className="text-white">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M0%2030h60M30%200v60%22%20stroke%3D%22rgba(99%2C102%2C241%2C0.04)%22%20fill%3D%22none%22%2F%3E%3C%2Fsvg%3E')]" />
        <div className="relative max-w-[1200px] mx-auto px-6 pt-12 pb-10">
          <div className="flex items-center gap-2 mb-4 animate-fade-in-up">
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 uppercase tracking-wider">Beta</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-3 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
            크리에이터 마켓플레이스
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl leading-relaxed animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            방송 데이터가 자동으로 포트폴리오가 됩니다.<br />
            광고주는 데이터 기반으로 크리에이터를 검색하고, 캠페인 성과를 검증받으세요.
          </p>
          <div className="flex gap-3 mt-7 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
            <button onClick={() => navigate('/marketplace/onboarding')}
              className="px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-xl hover:shadow-indigo-500/25 transition-all">
              시작하기
            </button>
            <button onClick={() => navigate('/marketplace/search')}
              className="px-6 py-3 rounded-xl text-sm font-medium text-slate-300 border border-dark-500 hover:border-indigo-500/40 hover:text-white transition-all">
              크리에이터 검색
            </button>
          </div>
        </div>
      </div>

      {/* ── 3 Feature Cards ── */}
      <div className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="grid grid-cols-3 gap-5">
          {[
            {
              icon: '📋', title: '자동 포트폴리오',
              desc: '채널을 연동하면 시청자 수, 인게이지먼트, 인기 게임 등이 자동으로 분석되어 공유 가능한 포트폴리오가 생성됩니다.',
              color: 'from-indigo-500/10 to-indigo-500/5 border-indigo-500/20',
            },
            {
              icon: '🔍', title: 'Smart Search + ROI 시뮬레이션',
              desc: '카테고리, 시청자 규모, 인게이지먼트 등급으로 크리에이터를 검색하고, 캠페인 진행 시 예상 ROI를 미리 확인하세요.',
              color: 'from-purple-500/10 to-purple-500/5 border-purple-500/20',
            },
            {
              icon: '✅', title: '캠페인 성과 검증',
              desc: '방송 중 배너 노출 시간을 AI가 자동으로 체크하고, 약속된 시간 대비 실제 노출률을 검증 리포트로 제공합니다.',
              color: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20',
            },
          ].map((f, i) => (
            <div key={f.title}
              className={`glass-panel rounded-2xl p-6 border bg-gradient-to-br ${f.color} animate-fade-in-up`}
              style={{ animationDelay: `${200 + i * 80}ms` }}>
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="max-w-[1200px] mx-auto px-6 pb-10">
        <h2 className="text-lg font-bold text-white mb-6 text-center animate-fade-in-up">이용 흐름</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { step: '01', title: '회원가입', desc: '크리에이터 또는 광고주로 가입', color: 'text-indigo-400' },
            { step: '02', title: '프로필 생성', desc: '채널 연동 / 회사 정보 입력', color: 'text-purple-400' },
            { step: '03', title: '매칭', desc: '검색 또는 캠페인 제안으로 연결', color: 'text-amber-400' },
            { step: '04', title: '검증 리포트', desc: '방송 후 자동 성과 검증', color: 'text-emerald-400' },
          ].map((s, i) => (
            <div key={s.step} className="glass-panel rounded-xl p-5 text-center animate-fade-in-up" style={{ animationDelay: `${400 + i * 60}ms` }}>
              <div className={`text-2xl font-extrabold ${s.color} mb-2`}>{s.step}</div>
              <div className="text-sm font-bold text-white mb-1">{s.title}</div>
              <div className="text-[11px] text-slate-500">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Creator Grid ── */}
      {hasCreators && (
        <div className="max-w-[1200px] mx-auto px-6 pb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white animate-fade-in-up">
              등록된 크리에이터 <span className="text-sm font-normal text-slate-500 ml-2">{filteredCreators.length}명</span>
            </h2>
          </div>
          {/* 탭 필터 */}
          <div className="flex items-center gap-1.5 mb-5 flex-wrap animate-fade-in-up">
            {GENRE_TABS.map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setShowAll(false); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === tab
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'bg-dark-800/60 text-slate-500 border border-dark-600/30 hover:text-white'
                }`}>
                {tab}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {displayCreators.map((c, i) => {
              const games = c.top_games || (c.top_games_json ? JSON.parse(c.top_games_json) : []);
              // subscriber_count가 있으면 사용, 없으면 avg_concurrent_viewers × 50 역산
              const realSubs = c.subscriber_count || (c.avg_concurrent_viewers ? c.avg_concurrent_viewers * 50 : 0);
              const subsDisplay = realSubs >= 1000000 ? `${(realSubs / 10000).toFixed(0)}만`
                : realSubs >= 10000 ? `${(realSubs / 10000).toFixed(1)}만`
                : realSubs >= 1000 ? `${(realSubs / 1000).toFixed(1)}천`
                : `${realSubs}`;

              return (
                <Link key={c.id} to={`/marketplace/portfolio/${c.id}`}
                  className="glass-panel rounded-xl p-4 hover:border-indigo-500/30 transition-all animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                  {/* Header */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-dark-600/50 flex items-center justify-center text-sm font-bold text-white shrink-0">
                      {c.display_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{c.display_name}</div>
                      <div className="text-[10px] text-slate-500">구독자 {subsDisplay}명</div>
                    </div>
                    {c.engagement_grade && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        c.engagement_grade === 'S' ? 'bg-amber-500/20 text-amber-400' :
                        c.engagement_grade === 'A' ? 'bg-indigo-500/20 text-indigo-400' :
                        c.engagement_grade === 'B' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>{c.engagement_grade}</span>
                    )}
                  </div>
                  {/* Games */}
                  {games.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {games.slice(0, 3).map(g => (
                        <span key={g} className="text-[10px] px-1.5 py-0.5 rounded bg-dark-700/60 text-slate-400">{g}</span>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
          {/* 더보기 */}
          {!showAll && sorted.length > 16 && (
            <div className="text-center mt-6">
              <button onClick={() => setShowAll(true)}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-dark-500 hover:text-white hover:border-indigo-500/40 transition-all">
                더보기 ({sorted.length - 16}명 더)
              </button>
            </div>
          )}
          {showAll && totalCreators > sorted.length && (
            <div className="text-center mt-6">
              <button onClick={() => navigate('/marketplace/search')}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/10 transition-all">
                전체 {totalCreators}명 검색하기
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── CTA Bottom ── */}
      <div className="max-w-[1200px] mx-auto px-6 pb-16">
        <div className="glass-panel rounded-2xl p-8 text-center border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 animate-fade-in-up">
          <h3 className="text-xl font-bold text-white mb-2">지금 시작하세요</h3>
          <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
            크리에이터라면 포트폴리오를, 광고주라면 최적의 크리에이터를 찾아보세요.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/marketplace/onboarding')}
              className="px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-xl hover:shadow-indigo-500/25 transition-all">
              크리에이터로 시작
            </button>
            <button onClick={() => navigate('/marketplace/onboarding')}
              className="px-6 py-3 rounded-xl text-sm font-medium text-slate-300 border border-dark-500 hover:border-indigo-500/40 hover:text-white transition-all">
              광고주로 시작
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────
export default function PortfolioPage() {
  const { creatorId } = useParams();
  return creatorId ? <PortfolioDetail creatorId={creatorId} /> : <MarketplaceLanding />;
}
