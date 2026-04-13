import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from './store/useAuthStore';
import { searchYouTubeChannels, searchYouTubeVideos, getFeaturedCreators, getCreatorRoster } from './services/api';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Search, Users, Eye, TrendingUp, TrendingDown, Star, Zap, Shield,
  ChevronDown, ChevronRight, X, Play, MonitorPlay, Tv, Filter, ArrowRight,
  BarChart3, Activity, Heart, MessageSquare, Clock, CheckCircle2,
  Sparkles, Globe, Target, Hash, Award, Crown, Flame, UserCheck,
  ArrowLeftRight, ExternalLink, ThumbsUp, ThumbsDown, Minus, Settings, RefreshCw,
  FileSpreadsheet, User
} from 'lucide-react';
import { GradeTag, PlatformIcon, MiniTooltip, COLORS_COMPARE } from './components/shared';
import CreatorCardsTab from './components/CreatorCards';
import ChannelCompareTab from './components/ChannelCompare';
import SentimentTab from './components/SentimentTab';

// ─── Helpers ────────────────────────────────────────────────
function getAdGrade(subscribers) {
  if (subscribers > 100000) return 'S';
  if (subscribers > 50000) return 'A';
  if (subscribers > 10000) return 'B';
  return 'C';
}

function estimateEngagement(subscribers) {
  // 구독자 수 기반 인게이지먼트 추정 (결정적 변동)
  const seed = (subscribers % 100) / 100; // 0.00~0.99
  if (subscribers > 1000000) return +(1.2 + seed * 0.8).toFixed(1);   // 1.2~2.0%
  if (subscribers > 500000) return +(1.8 + seed * 1.2).toFixed(1);    // 1.8~3.0%
  if (subscribers > 100000) return +(2.5 + seed * 1.5).toFixed(1);    // 2.5~4.0%
  if (subscribers > 50000) return +(3.5 + seed * 2.0).toFixed(1);     // 3.5~5.5%
  if (subscribers > 10000) return +(4.5 + seed * 2.5).toFixed(1);     // 4.5~7.0%
  if (subscribers > 1000) return +(6.0 + seed * 3.0).toFixed(1);      // 6.0~9.0%
  return +(8.0 + seed * 4.0).toFixed(1);
}

function mapChannelToCreator(r, query) {
  const subs = r.subscribers || 0;
  return {
    id: `yt_${r.channelId}`,
    name: r.name,
    platform: 'youtube',
    game: '',
    avatar: r.thumbnail,
    subscribers: subs,
    avgViews: Math.round(subs * 0.05),
    avgLiveViewers: 0,
    engagement: estimateEngagement(subs),
    adScore: null,
    adGrade: getAdGrade(subs),
    sentiment: null,
    recentVideos: r.videoCount || 0,
    tags: query ? [query] : [],
    weeklyGrowth: { subs: 0, views: 0, avgViewers: 0 },
    audience: { male: 50, female: 50, age18: 25, age25: 25, age35: 25, age45: 25 },
    recentVideoList: [],
    viewTrend: [],
    sentimentData: [
      { name: '미분석', value: 100, color: '#475569' },
    ],
    daily: [],
    liveTimeline: [],
    radarData: [],
    _isLive: true,
    _channelUrl: r.url,
    _thumbnail: r.thumbnail,
    _sentimentLabel: '분석 필요',
    _adScoreLabel: '분석 필요',
  };
}

// ─── Main Component ──────────────────────────────────────────
// (Featured creators are now loaded from API - no hardcoded data)

export default function CreatorSearch() {
  const { user, logout, login, register } = useAuthStore();
  const isLoggedIn = !!user;
  const userRole = user?.role || 'free_viewer';
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('channel');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [gameFilter, setGameFilter] = useState('전체');
  const [genreFilter, setGenreFilter] = useState('전체');
  const [sortBy, setSortBy] = useState('subscribers');
  const [compareList, setCompareList] = useState([]);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [showCompare, setShowCompare] = useState(false);
  const [activeTab, setActiveTab] = useState('live');
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [loginTab, setLoginTab] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [featuredCreators, setFeaturedCreators] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [rosterCreators, setRosterCreators] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(true);

  // Live YouTube search results
  const [liveResults, setLiveResults] = useState([]);
  const [videoResults, setVideoResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const searchTimer = useRef(null);

  // Debounced YouTube channel search
  useEffect(() => {
    if (searchMode !== 'channel' || !searchQuery || searchQuery.length < 2) {
      setLiveResults([]);
      setSearchError(null);
      return;
    }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const results = await searchYouTubeChannels(searchQuery, 10);
        const mapped = results
          .filter(r => r.subscribers > 0)
          .map(r => mapChannelToCreator(r, searchQuery));
        setLiveResults(mapped);
      } catch (e) {
        console.log('Live search unavailable:', e.message);
        setLiveResults([]);
        setSearchError('검색 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
      setSearching(false);
    }, 600);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery, searchMode]);

  // Debounced YouTube video/keyword search
  useEffect(() => {
    if (searchMode !== 'keyword' || !searchQuery || searchQuery.length < 2) {
      setVideoResults([]);
      setSearchError(null);
      return;
    }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const results = await searchYouTubeVideos(searchQuery, 20);
        setVideoResults(results);
      } catch (e) {
        console.log('Video search unavailable:', e.message);
        setVideoResults([]);
        setSearchError('키워드 검색 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
      setSearching(false);
    }, 600);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery, searchMode]);

  // Load featured creators + roster on mount (merge all into one list)
  useEffect(() => {
    let cancelled = false;
    setFeaturedLoading(true);

    Promise.all([
      getFeaturedCreators().catch(() => []),
      getCreatorRoster().catch(() => []),
    ]).then(([apiResults, roster]) => {
      if (cancelled) return;

      // 1) Map API results (YouTube-searched creators)
      const validResults = apiResults.filter(r => r.subscribers > 0);
      const mapped = validResults.map(r => mapChannelToCreator(r, r.game || ''));
      for (let i = 0; i < mapped.length; i++) {
        const src = validResults[i];
        if (src?.game) { mapped[i].game = src.game; mapped[i].tags = [src.game, ...(mapped[i].tags || [])]; }
        // 멀티 게임 지원: games 배열이 있으면 tags에 추가
        if (src?.games && Array.isArray(src.games)) {
          mapped[i].games = src.games;
          mapped[i].tags = [...new Set([...src.games, ...(mapped[i].tags || [])])];
        }
        if (src?.genre) mapped[i].genre = src.genre;
        if (src?.tier) mapped[i].tier = src.tier;
      }

      setFeaturedCreators(mapped);
      setRosterCreators(roster);
      setFeaturedLoading(false);
      setRosterLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  // ── Google Play 매출 TOP 20 게임 (고정) ──
  const gameFilters = [
    '전체', '아이온2', '리니지M', '로블록스', '마비노기 모바일', '조선협객전',
    '세븐나이츠 리버스', '스톤에이지 키우기', '메이플 키우기', '두근두근타운',
    '오딘', '승리의 여신: 니케', '창세기전 키우기', '브롤스타즈', '뱀피르',
    '로드나인', '컴투스프로야구', '검은사막 모바일', '리니지2M', '일곱 개의 대죄'
  ];

  // ── Google Play 게임 장르 전체 (17개) ──
  const genreFilters = [
    '전체', '롤플레잉', 'MMORPG', '액션', '어드벤처', '아케이드', '보드', '카드',
    '카지노', '캐주얼', '교육', '음악', '퍼즐', '레이싱', '시뮬레이션',
    '스포츠', '전략', '퀴즈', '단어'
  ];

  // Filter and sort channel results
  const filtered = useMemo(() => {
    if (searchMode === 'keyword') return [];

    if (!liveResults.length) return [];

    let list = [...liveResults];
    if (platformFilter !== 'all') {
      list = list.filter(c => c.platform === platformFilter);
    }
    list.sort((a, b) => {
      if (sortBy === 'subscribers') return b.subscribers - a.subscribers;
      if (sortBy === 'engagement') return b.engagement - a.engagement;
      if (sortBy === 'adScore') return (b.adScore || 0) - (a.adScore || 0);
      if (sortBy === 'sentiment') return (b.sentiment || 0) - (a.sentiment || 0);
      return 0;
    });
    return list;
  }, [searchMode, platformFilter, sortBy, liveResults]);

  // Auth-gated action helper
  const requireAuth = useCallback((action) => {
    if (isLoggedIn) { action(); return; }
    setShowLoginPopup(true);
  }, [isLoggedIn]);

  const toggleCompare = useCallback((id) => {
    setCompareList(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }, []);

  // Merge featured + live results for display
  const allCreators = useMemo(() => {
    if (liveResults.length > 0) return liveResults;
    return [];
  }, [liveResults]);

  const compareCreators = useMemo(
    () => {
      const all = [...allCreators, ...featuredCreators];
      return compareList.map(id => all.find(c => c.id === id)).filter(Boolean);
    },
    [compareList, allCreators]
  );

  // Filter featured creators by game and genre (멀티 게임 지원)
  const filteredFeatured = useMemo(() => {
    let list = [...featuredCreators];
    if (gameFilter !== '전체') {
      list = list.filter(c =>
        c.game === gameFilter ||
        (c.games && c.games.includes(gameFilter)) ||
        (c.tags && c.tags.includes(gameFilter))
      );
    }
    if (genreFilter !== '전체') {
      list = list.filter(c => c.genre === genreFilter);
    }
    list.sort((a, b) => {
      if (sortBy === 'subscribers') return b.subscribers - a.subscribers;
      if (sortBy === 'engagement') return b.engagement - a.engagement;
      if (sortBy === 'adScore') return (b.adScore || 0) - (a.adScore || 0);
      return 0;
    });
    return list;
  }, [featuredCreators, gameFilter, genreFilter, sortBy]);

  // Determine what to show in the main content area
  const hasQuery = searchQuery && searchQuery.length >= 2;
  const showLanding = !hasQuery && !searching;
  const showNoResults = hasQuery && !searching && (
    (searchMode === 'channel' && filtered.length === 0) ||
    (searchMode === 'keyword' && videoResults.length === 0)
  );

  // ─── Video Results Card (for keyword mode) ────────────
  const VideoResultsGrid = () => {
    if (!videoResults.length) return null;
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Play size={16} className="text-red-400" />
          <h3 className="text-sm font-bold text-white">동영상 검색 결과</h3>
          <span className="text-[10px] text-slate-500 ml-2">{videoResults.length}건</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videoResults.map((v, i) => (
            <div key={v.videoId || i} className="glass-panel rounded-xl overflow-hidden hover:border-indigo-500/30 transition-all group cursor-pointer">
              {v.thumbnail && (
                <div className="relative aspect-video bg-dark-700 overflow-hidden">
                  <img
                    src={v.thumbnail}
                    alt={v.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {v.duration && (
                    <span className="absolute bottom-1.5 right-1.5 text-[10px] bg-black/80 text-white px-1.5 py-0.5 rounded">
                      {v.duration}
                    </span>
                  )}
                </div>
              )}
              <div className="p-3">
                <h4 className="text-xs font-semibold text-slate-200 line-clamp-2 mb-2 leading-relaxed">{v.title}</h4>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  {v.channelTitle && (
                    <span className="flex items-center gap-1 truncate">
                      <Users size={10} /> {v.channelTitle}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                  {v.viewCount != null && (
                    <span className="flex items-center gap-1">
                      <Eye size={10} /> {Number(v.viewCount).toLocaleString()}회
                    </span>
                  )}
                  {v.publishedAt && (
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {new Date(v.publishedAt).toLocaleDateString('ko-KR')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── Creator Detail Modal ──────────────────────────────
  const DetailModal = ({ creator, onClose }) => {
    if (!creator) return null;

    const hasViewTrend = creator.viewTrend && creator.viewTrend.length > 0;
    const hasRecentVideos = creator.recentVideoList && creator.recentVideoList.length > 0;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-dark-800 border border-dark-600/50 rounded-2xl w-full max-w-[720px] mx-4 max-h-[85vh] overflow-y-auto shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="p-6 border-b border-dark-600/30 flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-dark-600/50 flex items-center justify-center overflow-hidden">
                {creator.avatar ? (
                  <img src={creator.avatar} alt={creator.name} className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <span className="text-2xl font-bold text-white">{creator.name[0]}</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{creator.name}</h2>
                  <PlatformIcon platform={creator.platform} size={18} />
                  <GradeTag grade={creator.adGrade} />
                </div>
                <div className="flex gap-3 mt-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Users size={12} /> {creator.subscribers.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Eye size={12} /> 평균 {creator.avgViews.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Activity size={12} /> 참여 ~{Math.round(creator.subscribers * (creator.engagement / 100)).toLocaleString()}명 ({creator.engagement}%)</span>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {creator.tags.map((t, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-dark-600/50 text-slate-400 border border-dark-600/30">{t}</span>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-dark-600/50 transition-colors"><X size={18} className="text-slate-400" /></button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-3 p-6 pb-3">
            {[
              { label: '광고 적합도', value: creator._adScoreLabel || creator.adScore || '-', icon: Target, color: 'text-amber-400' },
              { label: '감성 점수', value: creator._sentimentLabel || creator.sentiment || '-', icon: Heart, color: 'text-pink-400' },
              { label: '총 영상 수', value: creator.recentVideos || '-', icon: BarChart3, color: 'text-green-400' },
              { label: '광고 등급', value: creator.adGrade, icon: Award, color: 'text-blue-400' },
            ].map((s, i) => (
              <div key={i} className="glass-panel rounded-lg p-3 text-center">
                <s.icon size={16} className={`${s.color} mx-auto mb-1`} />
                <div className="text-lg font-bold text-white">{s.value}</div>
                <div className="text-[10px] text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* View Trend Chart */}
          {hasViewTrend && (
            <div className="px-6 py-3">
              <h3 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <TrendingUp size={12} className="text-indigo-400" /> 최근 7일 조회수 트렌드
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={creator.viewTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#1e293b' }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#1e293b' }} />
                  <Tooltip content={<MiniTooltip />} />
                  <Line type="monotone" dataKey="views" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} name="조회수" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* No trend data notice */}
          {!hasViewTrend && (
            <div className="px-6 py-6 text-center">
              <div className="glass-panel rounded-xl p-6">
                <BarChart3 size={24} className="text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">트렌드 데이터가 아직 없습니다</p>
                <p className="text-[10px] text-slate-600 mt-1">채널 크롤링 후 상세 분석이 가능합니다</p>
              </div>
            </div>
          )}

          {/* Recent Videos */}
          {hasRecentVideos && (
            <div className="px-6 py-3">
              <h3 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Play size={12} className="text-red-400" /> 최근 영상
              </h3>
              <div className="space-y-1.5">
                {creator.recentVideoList.map((v, i) => (
                  <div key={i} className="flex items-center justify-between bg-dark-700/40 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-4">{i + 1}</span>
                      <span className="text-xs text-slate-200">{v.title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span>{v.views.toLocaleString()}회</span>
                      <span>{v.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="p-6 pt-3 flex gap-3">
            <button
              onClick={() => requireAuth(() => {
                onClose();
                if (creator.channelId) {
                  navigate(`/marketplace/portfolio/${creator.channelId}`);
                } else {
                  navigate(`/analysis?q=${encodeURIComponent(creator.name)}`);
                }
              })}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles size={16} /> 크리에이터 분석
            </button>
            {creator.channelId && (
              <button
                onClick={() => { onClose(); navigate(`/marketplace/search?q=${encodeURIComponent(creator.name)}`); }}
                className="px-5 py-3 rounded-xl text-sm font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-all flex items-center gap-2"
              >
                <Eye size={16} /> 포트폴리오
              </button>
            )}
            <button
              onClick={() => requireAuth(() => { toggleCompare(creator.id); onClose(); })}
              className="px-5 py-3 rounded-xl text-sm font-medium border border-dark-600 text-slate-300 hover:border-indigo-500/30 transition-all flex items-center gap-2"
            >
              <ArrowLeftRight size={16} /> {compareList.includes(creator.id) ? '해제' : '비교'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Compare Modal ─────────────────────────────────────
  const CompareModal = () => {
    if (!showCompare || compareCreators.length < 2) return null;

    const compBarData = compareCreators.map((c, i) => ({
      name: c.name,
      구독자: c.subscribers,
      평균조회수: c.avgViews,
      라이브시청자: c.avgLiveViewers,
      참여율: c.engagement * 1000,
      광고적합도: (c.adScore || 0) * 100,
      감성점수: (c.sentiment || 0) * 100,
    }));

    const hasRadarData = compareCreators.every(c => c.radarData && c.radarData.length > 0);

    const radarMerged = hasRadarData
      ? compareCreators[0].radarData.map((d, i) => {
          const obj = { cat: d.cat };
          compareCreators.forEach((c, ci) => { obj[c.name] = c.radarData[i]?.v || 0; });
          return obj;
        })
      : [];

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCompare(false)}>
        <div className="bg-dark-800 border border-dark-600/50 rounded-2xl w-[900px] max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b border-dark-600/30 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowLeftRight size={20} className="text-indigo-400" />
              크리에이터 비교 분석
            </h2>
            <button onClick={() => setShowCompare(false)} className="p-1.5 rounded-lg hover:bg-dark-600/50"><X size={18} className="text-slate-400" /></button>
          </div>

          {/* Creator Headers */}
          <div className="p-6 pb-3">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${compareCreators.length}, 1fr)` }}>
              {compareCreators.map((c, i) => (
                <div key={c.id} className="glass-panel rounded-xl p-4 text-center" style={{ borderColor: COLORS_COMPARE[i] + '40' }}>
                  <div className="w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center overflow-hidden" style={{ background: COLORS_COMPARE[i] + '30' }}>
                    {c.avatar ? (
                      <img src={c.avatar} alt={c.name} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <span className="text-xl font-bold text-white">{c.name[0]}</span>
                    )}
                  </div>
                  <div className="font-bold text-white text-sm">{c.name}</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <PlatformIcon platform={c.platform} size={12} />
                    <GradeTag grade={c.adGrade} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comparison Metrics Table */}
          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold text-slate-300 mb-2">주요 지표 비교</h3>
            <div className="glass-panel rounded-lg overflow-hidden">
              {[
                { label: '구독자', key: 'subscribers', fmt: v => typeof v === 'number' ? v.toLocaleString() : '-' },
                { label: '평균 조회수', key: 'avgViews', fmt: v => typeof v === 'number' ? v.toLocaleString() : '-' },
                { label: '참여율', key: 'engagement', fmt: v => typeof v === 'number' ? v + '%' : '-' },
                { label: '광고 등급', key: 'adGrade', fmt: v => v || '-' },
                { label: '총 영상 수', key: 'recentVideos', fmt: v => typeof v === 'number' ? v + '개' : '-' },
              ].map((metric, mi) => {
                const values = compareCreators.map(c => typeof c[metric.key] === 'number' ? c[metric.key] : 0);
                const maxVal = Math.max(...values);
                return (
                  <div key={mi} className={`flex items-center text-xs ${mi % 2 === 0 ? 'bg-dark-700/30' : ''}`}>
                    <div className="w-36 px-4 py-2.5 text-slate-400 font-medium">{metric.label}</div>
                    {compareCreators.map((c, ci) => (
                      <div key={ci} className="flex-1 px-4 py-2.5 text-center">
                        <span className={`font-bold ${(typeof c[metric.key] === 'number' && c[metric.key] === maxVal && maxVal > 0) ? 'text-amber-400' : 'text-slate-200'}`}>
                          {metric.fmt(c[metric.key])}
                        </span>
                        {typeof c[metric.key] === 'number' && c[metric.key] === maxVal && maxVal > 0 && (
                          <Crown size={10} className="inline ml-1 text-amber-400" />
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Radar Comparison */}
          {hasRadarData && radarMerged.length > 0 && (
            <div className="px-6 py-3">
              <h3 className="text-xs font-semibold text-slate-300 mb-2">능력치 레이더 비교</h3>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarMerged}>
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
          )}

          {/* No radar data notice */}
          {!hasRadarData && (
            <div className="px-6 py-3">
              <div className="glass-panel rounded-xl p-6 text-center">
                <Activity size={20} className="text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">레이더 분석 데이터가 아직 없습니다</p>
                <p className="text-[10px] text-slate-600 mt-1">채널 크롤링 후 상세 비교가 가능합니다</p>
              </div>
            </div>
          )}

          {/* Audience data */}
          <div className="px-6 py-3 pb-6">
            <h3 className="text-xs font-semibold text-slate-300 mb-2">시청자 정보</h3>
            <div className="glass-panel rounded-xl p-6 text-center">
              <Users size={20} className="text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">시청자 분석 데이터가 아직 없습니다</p>
              <p className="text-[10px] text-slate-600 mt-1">채널 크롤링 후 상세 분석이 가능합니다</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── MAIN RENDER ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* Login Popup Modal */}
      {showLoginPopup && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowLoginPopup(false)}>
          <div className="bg-dark-800 border border-dark-600/50 rounded-2xl w-full max-w-[420px] mx-4 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-dark-600/30 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {loginTab === 'login' ? '로그인' : '회원가입'}
              </h2>
              <button onClick={() => setShowLoginPopup(false)} className="p-1.5 rounded-lg hover:bg-dark-600/50">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex gap-1 mb-6 bg-dark-700/50 rounded-xl p-1">
                <button onClick={() => setLoginTab('login')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${loginTab === 'login' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400'}`}>
                  로그인
                </button>
                <button onClick={() => setLoginTab('signup')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${loginTab === 'signup' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400'}`}>
                  회원가입
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">이메일</label>
                  <input type="email" placeholder="email@example.com" value={loginEmail} onChange={e => { setLoginEmail(e.target.value); setLoginError(''); }}
                    className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">비밀번호</label>
                  <input type="password" placeholder="••••••••" value={loginPassword} onChange={e => { setLoginPassword(e.target.value); setLoginError(''); }}
                    className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all" />
                </div>
                {loginTab === 'signup' && (
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">비밀번호 확인</label>
                    <input type="password" placeholder="••••••••"
                      className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all" />
                  </div>
                )}
                {loginError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{loginError}</p>
                )}
                <button
                  onClick={async () => {
                    if (!loginEmail.trim() || !loginPassword.trim()) {
                      setLoginError('이메일과 비밀번호를 입력해주세요.');
                      return;
                    }
                    setLoginError('');
                    try {
                      if (loginTab === 'login') {
                        const result = await login(loginEmail.trim(), loginPassword);
                        if (!result.ok) { setLoginError(result.error || '로그인 실패'); return; }
                      } else {
                        const result = await register({ email: loginEmail.trim(), password: loginPassword, name: loginEmail.split('@')[0] });
                        if (!result.ok) { setLoginError(result.error || '가입 실패'); return; }
                      }
                      setShowLoginPopup(false);
                      setLoginEmail('');
                      setLoginPassword('');
                    } catch (e) {
                      setLoginError(e.message || '서버 오류');
                    }
                  }}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
                >
                  {loginTab === 'login' ? '로그인' : '가입하기'}
                </button>
              </div>
              {loginTab === 'login' && (
                <p className="text-center text-xs text-slate-500 mt-4">
                  계정이 없으신가요?{' '}
                  <button onClick={() => setLoginTab('signup')} className="text-indigo-400 hover:underline">회원가입</button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-dark-600/50 bg-dark-800/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">LivedPulse</h1>
              <p className="text-[10px] text-slate-500">모바일 게임 크리에이터 분석 플랫폼</p>
            </div>
          <nav className="flex items-center gap-1 ml-4 bg-dark-700/60 rounded-lg p-1 border border-dark-600/40">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition-all">
              <Search size={13} /> 크리에이터 분석
            </button>
            <button onClick={() => navigate('/report')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-dark-600/60 transition-all">
              <FileSpreadsheet size={13} /> 방송 리포트
            </button>
            <button onClick={() => navigate('/marketplace')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-dark-600/60 transition-all">
              <Target size={13} /> 마켓플레이스
            </button>
            {(userRole === 'admin' || userRole === 'advertiser') && (
              <button onClick={() => navigate('/admin')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-dark-600/60 transition-all">
                <User size={13} /> {userRole === 'advertiser' ? '캠페인 콘솔' : '관리콘솔'}
              </button>
            )}
          </nav>
          </div>
          {/* Login/Signup Buttons */}
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <span className="text-xs text-slate-400 mr-2">{user?.name || user?.email}</span>
                <button onClick={() => navigate('/admin')} className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:border-slate-500 transition-all">
                  내 정보
                </button>
                <button onClick={logout}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 border border-dark-600 hover:text-white hover:border-slate-500 transition-all">
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <button onClick={() => navigate('/login')}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 border border-dark-600 hover:text-white hover:border-indigo-500/30 transition-all">
                  로그인
                </button>
                <button onClick={() => navigate('/login')}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/20 transition-all">
                  회원가입
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-indigo-500/10 to-transparent border-b border-dark-600/30">
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <h2 className="text-2xl font-bold text-white mb-1">크리에이터 탐색</h2>
          <p className="text-sm text-slate-400 mb-6">프로모션에 최적화된 크리에이터를 검색하고 비교 분석하세요</p>

          {/* Search & Filters */}
          <div className="flex gap-3 items-center flex-wrap">
            {/* Search Mode Toggle */}
            <div className="flex rounded-xl overflow-hidden border border-dark-600">
              <button onClick={() => setSearchMode('channel')}
                className={`px-4 py-2.5 text-xs font-medium transition-all ${
                  searchMode === 'channel' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-dark-800 text-slate-400'
                }`}>
                <MonitorPlay size={12} className="inline mr-1.5" />채널
              </button>
              <button onClick={() => setSearchMode('keyword')}
                className={`px-4 py-2.5 text-xs font-medium transition-all ${
                  searchMode === 'keyword' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-dark-800 text-slate-400'
                }`}>
                <Hash size={12} className="inline mr-1.5" />키워드
              </button>
            </div>

            <div className="relative flex-1 min-w-[300px]">
              {searching ? (
                <RefreshCw size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" />
              ) : (
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              )}
              <input
                type="text"
                placeholder={searchMode === 'channel'
                  ? 'YouTube 채널명으로 실시간 검색...'
                  : 'YouTube 동영상 키워드 검색...'
                }
                className="w-full bg-dark-800 border border-dark-600 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchMode === 'channel' && liveResults.length > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">LIVE</span>
              )}
              {searchMode === 'keyword' && videoResults.length > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                  {videoResults.length}건
                </span>
              )}
            </div>
            {searchMode === 'channel' && (
              <>
                <div className="flex gap-2">
                  {[
                    { value: 'all', label: '전체', icon: Globe },
                    { value: 'youtube', label: 'YouTube', icon: MonitorPlay },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPlatformFilter(opt.value)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        platformFilter === opt.value
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-dark-800 text-slate-400 border border-dark-600 hover:border-dark-500'
                      }`}
                    >
                      <opt.icon size={14} />
                      {opt.label}
                    </button>
                  ))}
                </div>
                <select
                  className="bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="subscribers">구독자순</option>
                  <option value="engagement">참여율순</option>
                  <option value="adScore">광고적합도순</option>
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs (only in channel mode) */}
      {searchMode === 'channel' && (
        <div className="max-w-[1400px] mx-auto w-full px-6">
          <div className="flex gap-1 mt-4 mb-4 bg-dark-800/60 rounded-xl p-1 border border-dark-600/30 w-fit">
            {[
              { id: 'live', label: '라이브 지표 & 성장 추이', icon: BarChart3 },
              { id: 'compare', label: '채널 비교 & 타겟 분석', icon: ArrowLeftRight },
              { id: 'sentiment', label: '시청자 여론 & 감성', icon: Activity },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-dark-700/50'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Landing State - Featured Game Creators ═══ */}
      {showLanding && (
        <div className="flex-1">
          {/* ── Marketplace CTA Banner ── */}
          <div className="max-w-[1400px] mx-auto px-6 pt-6 pb-2">
            <div
              onClick={() => navigate('/marketplace')}
              className="relative overflow-hidden rounded-2xl cursor-pointer group transition-all hover:shadow-xl hover:shadow-indigo-500/10"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/90 via-purple-600/80 to-pink-600/70" />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M0%2030h60M30%200v60%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.05)%22%20fill%3D%22none%22%2F%3E%3C%2Fsvg%3E')] opacity-40" />
              <div className="relative flex items-center justify-between px-8 py-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white/90 uppercase tracking-wider">New</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 uppercase tracking-wider">Beta</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-white mb-1">크리에이터 마켓플레이스</h3>
                  <p className="text-sm text-white/70 max-w-md">
                    데이터 기반 포트폴리오 자동 생성 + 광고주-크리에이터 직접 매칭 + 캠페인 성과 검증
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="hidden md:flex gap-4">
                    {[
                      { n: '자동 포트폴리오', d: '방송만 하면 생성' },
                      { n: 'Smart Search', d: 'AI 매칭 추천' },
                      { n: '성과 검증', d: '배너 노출 자동 체크' },
                    ].map(f => (
                      <div key={f.n} className="text-center px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm">
                        <div className="text-xs font-bold text-white">{f.n}</div>
                        <div className="text-[10px] text-white/60 mt-0.5">{f.d}</div>
                      </div>
                    ))}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition shrink-0">
                    <ArrowRight size={20} className="text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-[1400px] mx-auto px-6 py-4">
            {/* Genre Filter */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs text-slate-500 mr-1"><Target size={12} className="inline mr-1" />장르</span>
              {genreFilters.map(g => (
                <button key={g} onClick={() => setGenreFilter(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    genreFilter === g
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-dark-800 text-slate-400 border border-dark-600/50 hover:border-dark-500'
                  }`}>
                  {g}
                </button>
              ))}
            </div>

            {/* Game Filter Chips */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <span className="text-xs text-slate-500 mr-1"><Filter size={12} className="inline mr-1" />게임 필터</span>
              {gameFilters.map(g => (
                <button key={g} onClick={() => setGameFilter(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    gameFilter === g
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-dark-800 text-slate-400 border border-dark-600/50 hover:border-dark-500'
                  }`}>
                  {g}
                </button>
              ))}
            </div>

            {/* Section Title */}
            <div className="flex items-center gap-2 mb-4">
              <Flame size={16} className="text-orange-400" />
              <h3 className="text-sm font-bold text-white">인기 모바일 게임 크리에이터 · MMORPG</h3>
              <span className="text-[10px] text-slate-500 ml-2">
                {featuredLoading ? '로딩 중...' : `${filteredFeatured.length}명`}
              </span>
              <span className="text-[9px] text-indigo-400/60 ml-1">YouTube 실시간 검색 기반</span>
            </div>

            {/* Loading State */}
            {featuredLoading && (
              <div className="flex items-center justify-center py-20">
                <RefreshCw size={24} className="text-indigo-400 animate-spin mr-3" />
                <span className="text-sm text-slate-400">YouTube에서 크리에이터를 검색하고 있습니다...</span>
              </div>
            )}

            {/* No Results */}
            {!featuredLoading && filteredFeatured.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <Search size={32} className="text-slate-600 mb-3" />
                <p className="text-sm text-slate-400 mb-2">위 검색바에서 YouTube 채널을 검색해보세요</p>
                <p className="text-xs text-slate-500">채널명 또는 키워드로 검색하면 실시간 결과를 보여드립니다</p>
                <div className="flex gap-2 mt-4 flex-wrap justify-center">
                  {['리니지M', '리니지W', '오딘', '원신', '스타레일', '니케', '로스트아크', '나이트크로우', '블소', '로드나인'].map(q => (
                    <button key={q} onClick={() => { setSearchQuery(q); }}
                      className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-dark-600 hover:border-indigo-500/30 hover:text-indigo-300 transition-all">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Featured Creator Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredFeatured.map(creator => (
                <div key={creator.id}
                  className="glass-panel rounded-xl p-4 hover:border-indigo-500/30 transition-all cursor-pointer group relative"
                  onClick={() => setSelectedCreator(creator)}>
                  {/* Live Badge */}
                  {creator._isLive && (
                    <span className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                      LIVE
                    </span>
                  )}
                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-dark-600/50 flex items-center justify-center shrink-0">
                      {creator.avatar ? (
                        <img src={creator.avatar} alt={creator.name} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <span className="text-lg font-bold text-white">{creator.name[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{creator.name}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <PlatformIcon platform={creator.platform} size={10} />
                        <span>{creator.game}</span>
                        {creator.tier && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            creator.tier === 'S' ? 'bg-amber-500/20 text-amber-400' :
                            creator.tier === 'A' ? 'bg-purple-500/20 text-purple-400' :
                            creator.tier === 'B' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>{creator.tier}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-dark-700/40 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500">구독자</div>
                      <div className="text-xs font-bold text-slate-200">{creator.subscribers >= 10000 ? `${(creator.subscribers / 10000).toFixed(1)}만` : creator.subscribers.toLocaleString()}</div>
                    </div>
                    <div className="bg-dark-700/40 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500">평균조회 <span className="text-[8px] text-amber-400/60">~추정</span></div>
                      <div className="text-xs font-bold text-slate-200">{creator.avgViews >= 10000 ? `${(creator.avgViews / 10000).toFixed(1)}만` : creator.avgViews.toLocaleString()}</div>
                    </div>
                    <div className="bg-dark-700/40 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500">참여율 <span className="text-[8px] text-amber-400/60">~추정</span></div>
                      <div className="text-xs font-bold text-green-400">{creator.engagement}%</div>
                    </div>
                  </div>

                  {/* Grade + Info */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <GradeTag grade={creator.adGrade} />
                      <span className="text-[10px] text-slate-500">광고적합도 <span className="text-[8px] text-amber-400/60">~추정</span></span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400">
                      {creator._sentimentLabel || '분석 필요'}
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="flex gap-1.5 flex-wrap">
                    {(creator.tags || []).slice(0, 4).map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md bg-dark-700/60 text-slate-400 border border-dark-600/30">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* Compare Checkbox */}
                  <div className="mt-3 pt-3 border-t border-dark-600/30 flex items-center justify-between">
                    <button
                      onClick={(e) => { e.stopPropagation(); requireAuth(() => toggleCompare(creator.id)); }}
                      className={`text-[10px] px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                        compareList.includes(creator.id)
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-dark-700/50 text-slate-400 border border-dark-600/30 hover:border-indigo-500/20'
                      }`}>
                      <ArrowLeftRight size={10} />
                      {compareList.includes(creator.id) ? '비교 선택됨' : '비교 추가'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); requireAuth(() => {
                        if (creator.channelId) navigate(`/marketplace/portfolio/${creator.channelId}`);
                        else navigate(`/analysis?q=${encodeURIComponent(creator.name)}`);
                      }); }}
                      className="text-[10px] px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all flex items-center gap-1">
                      <Sparkles size={10} /> 분석 시작
                    </button>
                  </div>
                </div>
              ))}
            </div>


            {/* Quick Search Suggestions */}
            <div className="mt-8 text-center">
              <p className="text-xs text-slate-500 mb-3">또는 직접 검색해보세요</p>
              <div className="flex gap-3 justify-center flex-wrap">
                {['리니지M', '리니지W', '오딘', '원신', '스타레일', '니케', '로스트아크', '나이트크로우', '블소', '로드나인'].map(tag => (
                  <button key={tag} onClick={() => setSearchQuery(tag)}
                    className="text-xs px-4 py-2 rounded-lg bg-dark-800 border border-dark-600/50 text-slate-400 hover:text-indigo-300 hover:border-indigo-500/30 transition-all">
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Loading State ═══ */}
      {searching && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-20">
            <RefreshCw size={32} className="text-indigo-400 animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-400">검색 중...</p>
          </div>
        </div>
      )}

      {/* ═══ Error State ═══ */}
      {searchError && !searching && (
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <div className="glass-panel rounded-xl p-8 text-center">
            <Shield size={24} className="text-red-400/60 mx-auto mb-3" />
            <p className="text-sm text-slate-300 mb-1">{searchError}</p>
            <p className="text-xs text-slate-500">API 서버 연결을 확인해주세요</p>
          </div>
        </div>
      )}

      {/* ═══ No Results State ═══ */}
      {showNoResults && !searchError && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-dark-700/50 border border-dark-600/30 flex items-center justify-center mx-auto mb-4">
              <Search size={24} className="text-slate-600" />
            </div>
            <h3 className="text-base font-bold text-slate-300 mb-1">검색 결과가 없습니다</h3>
            <p className="text-sm text-slate-500">다른 검색어로 시도해보세요</p>
          </div>
        </div>
      )}

      {/* ═══ Channel Mode Results ═══ */}
      {searchMode === 'channel' && !searching && !showLanding && !showNoResults && !searchError && (
        <>
          {activeTab === 'live' && (
            <CreatorCardsTab
              filtered={filtered}
              selectedCreator={selectedCreator}
              setSelectedCreator={setSelectedCreator}
              compareList={compareList}
              toggleCompare={toggleCompare}
            />
          )}

          {activeTab === 'compare' && (
            <ChannelCompareTab
              filtered={filtered}
              compareList={compareList}
              compareCreators={compareCreators}
              toggleCompare={toggleCompare}
              setShowCompare={setShowCompare}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'sentiment' && (
            <SentimentTab
              selectedCreator={selectedCreator}
              filtered={filtered}
            />
          )}
        </>
      )}

      {/* ═══ Keyword Mode Results ═══ */}
      {searchMode === 'keyword' && !searching && !showLanding && !showNoResults && !searchError && (
        <VideoResultsGrid />
      )}

      {/* ═══ Floating Compare Bar ═══ */}
      {compareList.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-dark-800/95 backdrop-blur-lg border-t border-dark-600/50 shadow-2xl animate-fade-in-up">
          <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">비교 선택</span>
              <div className="flex gap-2">
                {compareCreators.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2 bg-dark-700/50 rounded-lg px-3 py-1.5 border border-dark-600/30">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white overflow-hidden" style={{ background: COLORS_COMPARE[i] + '40' }}>
                      {c.avatar ? (
                        <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        c.name[0]
                      )}
                    </div>
                    <span className="text-xs text-white font-medium">{c.name}</span>
                    <button onClick={() => toggleCompare(c.id)} className="p-0.5 rounded hover:bg-dark-600 transition-colors">
                      <X size={12} className="text-slate-500" />
                    </button>
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-slate-500">{compareList.length}/3</span>
            </div>
            <div className="flex gap-2">
              {compareList.length >= 2 && (
                <button
                  onClick={() => { setShowCompare(true); setActiveTab('compare'); }}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center gap-2"
                >
                  <ArrowLeftRight size={14} /> 비교 분석
                </button>
              )}
              <button
                onClick={() => setCompareList([])}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 border border-dark-600 hover:text-white transition-colors"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedCreator && <DetailModal creator={selectedCreator} onClose={() => setSelectedCreator(null)} />}
      <CompareModal />
    </div>
  );
}
