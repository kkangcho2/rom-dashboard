import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { searchYouTubeChannels, searchYouTubeVideos } from './api';
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
  FileSpreadsheet
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
  // Smaller channels tend to have higher engagement rates
  if (subscribers > 100000) return 2.5;
  if (subscribers > 50000) return 3.8;
  if (subscribers > 10000) return 5.2;
  if (subscribers > 1000) return 7.0;
  return 9.5;
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
export default function CreatorSearch({ onSelectCreator, onGoToAdmin, onGoToReport }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('channel');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [sortBy, setSortBy] = useState('subscribers');
  const [compareList, setCompareList] = useState([]);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [showCompare, setShowCompare] = useState(false);
  const [activeTab, setActiveTab] = useState('live');

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

  const toggleCompare = useCallback((id) => {
    setCompareList(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }, []);

  const compareCreators = useMemo(
    () => compareList.map(id => liveResults.find(c => c.id === id)).filter(Boolean),
    [compareList, liveResults]
  );

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
        <div className="bg-dark-800 border border-dark-600/50 rounded-2xl w-[720px] max-h-[85vh] overflow-y-auto shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
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
                  <span className="flex items-center gap-1"><Activity size={12} /> 참여율 {creator.engagement}%</span>
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
              onClick={() => { onClose(); onSelectCreator(creator); }}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles size={16} /> 이 크리에이터로 분석 시작
            </button>
            <button
              onClick={() => { toggleCompare(creator.id); onClose(); }}
              className="px-6 py-3 rounded-xl text-sm font-medium border border-dark-600 text-slate-300 hover:border-indigo-500/30 transition-all flex items-center gap-2"
            >
              <ArrowLeftRight size={16} /> {compareList.includes(creator.id) ? '비교 해제' : '비교 추가'}
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
      {/* Header */}
      <header className="border-b border-dark-600/50 bg-dark-800/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">Promo Insight</h1>
              <p className="text-[10px] text-slate-500">크리에이터 종합 분석 및 비교 대시보드</p>
            </div>
          {onGoToReport && (
            <button onClick={onGoToReport} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-dark-700/50 transition-all">
              <FileSpreadsheet size={14} /> 리포트 작성
            </button>
          )}
          {onGoToAdmin && (
            <button onClick={onGoToAdmin} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-dark-700/50 transition-all">
              <Settings size={14} /> 관리 콘솔
            </button>
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

      {/* ═══ Landing State ═══ */}
      {showLanding && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-dark-600/30 flex items-center justify-center mx-auto mb-6">
              <Search size={32} className="text-indigo-400/60" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">YouTube 채널 또는 키워드를 검색하세요</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              채널 모드에서 크리에이터를 검색하고 비교 분석하거나,
              키워드 모드에서 관련 동영상을 탐색할 수 있습니다.
            </p>
            <div className="flex gap-3 justify-center mt-6">
              {['게임 리뷰', '먹방', '테크', 'ASMR', '여행'].map(tag => (
                <button
                  key={tag}
                  onClick={() => setSearchQuery(tag)}
                  className="text-xs px-4 py-2 rounded-lg bg-dark-800 border border-dark-600/50 text-slate-400 hover:text-indigo-300 hover:border-indigo-500/30 transition-all"
                >
                  {tag}
                </button>
              ))}
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
