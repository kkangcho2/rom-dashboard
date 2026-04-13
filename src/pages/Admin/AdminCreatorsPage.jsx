/**
 * AdminCreatorsPage — 크리에이터 관리 (목록 + 상세)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, RefreshCw, Filter, ArrowLeft, ExternalLink,
  Award, TrendingUp, Eye, Video, Megaphone, Star, Monitor
} from 'lucide-react';
import { GlassCard } from '../../components/shared';
import { getCreators, getCreatorDetail } from '../../services/admin-automation-api';

const GRADE_COLORS = {
  S: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  A: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  B: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  C: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const PLATFORM_COLORS = {
  youtube: 'bg-red-500/20 text-red-400',
  chzzk: 'bg-green-500/20 text-green-400',
  afreeca: 'bg-blue-500/20 text-blue-400',
};

export default function AdminCreatorsPage({ onNavigate }) {
  const [creators, setCreators] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 30 };
    if (search) params.search = search;
    if (platform) params.platform = platform;
    getCreators(params)
      .then(r => { setCreators(r.creators); setPagination(r.pagination); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [page, platform, search]);

  useEffect(() => { load(); }, [load]);

  if (selectedId) {
    return <CreatorDetail creatorId={selectedId} onBack={() => setSelectedId(null)} onNavigate={onNavigate} />;
  }

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Users size={18} className="text-indigo-400" />
          크리에이터 관리
        </h1>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#1a2035] border border-[#374766]/30 transition">
          <RefreshCw size={12} /> 새로고침
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="크리에이터 이름 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (setPage(1), load())}
            className="pl-8 pr-3 py-1.5 rounded-lg bg-[#111827] border border-[#374766]/40 text-xs text-white focus:outline-none focus:border-indigo-500/60 w-60"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={12} className="text-slate-500" />
          {['', 'youtube', 'chzzk', 'afreeca'].map(p => (
            <button key={p} onClick={() => { setPlatform(p); setPage(1); }}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition ${platform === p ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25' : 'text-slate-500 hover:text-slate-300'}`}
            >{p || '전체'}</button>
          ))}
        </div>
        <span className="text-[10px] text-slate-600 ml-auto">총 {pagination.total || 0}명</span>
      </div>

      {/* List */}
      <GlassCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-500 text-xs animate-pulse">로딩 중...</div>
        ) : creators.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">크리에이터가 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase border-b border-[#374766]/30 bg-[#0a0e1a]/30">
                  <th className="text-left py-3 px-4">크리에이터</th>
                  <th className="text-center py-3 px-3">등급</th>
                  <th className="text-center py-3 px-3">평균 시청자</th>
                  <th className="text-center py-3 px-3">최대 시청</th>
                  <th className="text-center py-3 px-3">구독자</th>
                  <th className="text-center py-3 px-3">플랫폼</th>
                  <th className="text-center py-3 px-3">캠페인</th>
                  <th className="text-center py-3 px-3">신뢰도</th>
                  <th className="text-left py-3 px-3">가입일</th>
                </tr>
              </thead>
              <tbody>
                {creators.map(c => {
                  const topGames = (() => {
                    try { return JSON.parse(c.top_games_json || '[]').slice(0, 2); }
                    catch { return []; }
                  })();
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className="border-b border-[#374766]/10 hover:bg-[#1a2035]/50 cursor-pointer transition"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {c.thumbnail_url && (
                            <img src={c.thumbnail_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          )}
                          <div>
                            <div className="text-white font-medium">{c.display_name}</div>
                            <div className="text-[10px] text-slate-500">{c.email}</div>
                            {topGames.length > 0 && (
                              <div className="text-[9px] text-slate-600 mt-0.5">
                                {topGames.map(g => typeof g === 'string' ? g : g.game).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {c.engagement_grade && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${GRADE_COLORS[c.engagement_grade] || ''}`}>
                            {c.engagement_grade}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center text-cyan-400 font-bold">{(c.avg_concurrent_viewers || 0).toLocaleString()}</td>
                      <td className="py-3 px-3 text-center text-indigo-400">{(c.peak_viewers || 0).toLocaleString()}</td>
                      <td className="py-3 px-3 text-center text-slate-300">{(c.subscriber_count || 0).toLocaleString()}</td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {c.youtube_channel_id && <span className="text-[9px] px-1 rounded bg-red-500/20 text-red-400">YT</span>}
                          {c.chzzk_channel_id && <span className="text-[9px] px-1 rounded bg-green-500/20 text-green-400">CZ</span>}
                          {c.afreeca_channel_id && <span className="text-[9px] px-1 rounded bg-blue-500/20 text-blue-400">AF</span>}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-indigo-400 font-bold">{c.campaigns_joined}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`font-bold text-[10px] ${c.trust_score >= 0.7 ? 'text-emerald-400' : c.trust_score >= 0.4 ? 'text-amber-400' : 'text-red-400'}`}>
                          {((c.trust_score || 0) * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[10px]">{formatDate(c.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: Math.min(pagination.totalPages, 10) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-7 h-7 rounded text-[10px] font-bold transition ${p === page ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500 hover:text-white'}`}
            >{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Creator Detail ──────────────────────────────────────────
function CreatorDetail({ creatorId, onBack, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCreatorDetail(creatorId)
      .then(r => setData(r))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [creatorId]);

  if (loading) return <div className="p-6 text-center text-slate-500 text-xs animate-pulse">로딩 중...</div>;
  if (!data) return null;

  const { creator, campaigns, analysisReports, recentStreams } = data;
  const topGames = (() => {
    try { return JSON.parse(creator.top_games_json || '[]'); } catch { return []; }
  })();
  const audienceKeywords = (() => {
    try { return JSON.parse(creator.audience_keywords_json || '[]'); } catch { return []; }
  })();

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[#1a2035] transition">
          <ArrowLeft size={16} className="text-slate-400" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          {creator.thumbnail_url && (
            <img src={creator.thumbnail_url} className="w-12 h-12 rounded-full object-cover" alt="" />
          )}
          <div>
            <h1 className="text-lg font-bold text-white">{creator.display_name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {creator.engagement_grade && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${GRADE_COLORS[creator.engagement_grade] || ''}`}>
                  {creator.engagement_grade}급
                </span>
              )}
              <span className="text-[10px] text-slate-500">{creator.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: '평균 시청자', value: (creator.avg_concurrent_viewers || 0).toLocaleString(), icon: Eye, color: 'text-cyan-400' },
          { label: '최대 시청', value: (creator.peak_viewers || 0).toLocaleString(), icon: TrendingUp, color: 'text-indigo-400' },
          { label: '구독자', value: (creator.subscriber_count || 0).toLocaleString(), icon: Users, color: 'text-emerald-400' },
          { label: '캠페인 참여', value: campaigns.length, icon: Megaphone, color: 'text-amber-400' },
          { label: '신뢰도', value: `${((creator.trust_score || 0) * 100).toFixed(0)}%`, icon: Award, color: creator.trust_score >= 0.7 ? 'text-emerald-400' : 'text-amber-400' },
        ].map((s, i) => (
          <GlassCard key={i} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</span>
              <s.icon size={14} className={s.color} />
            </div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 프로필 정보 */}
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3">프로필 정보</h3>
          <div className="space-y-2.5 text-xs">
            <Row label="소개" value={creator.bio || '-'} />
            <Row label="카테고리" value={
              (() => { try { return JSON.parse(creator.categories || '[]').join(', ') || '-'; } catch { return '-'; } })()
            } />
            <Row label="YouTube" value={creator.youtube_channel_id || '-'} verified={!!creator.youtube_verified} />
            <Row label="Chzzk" value={creator.chzzk_channel_id || '-'} verified={!!creator.chzzk_verified} />
            <Row label="AfreecaTV" value={creator.afreeca_channel_id || '-'} verified={!!creator.afreeca_verified} />
            <Row label="방송 분석 수" value={creator.total_streams_analyzed} />
            <Row label="완료 캠페인" value={creator.total_campaigns_completed} />
          </div>
        </GlassCard>

        {/* 주요 게임 + 시청자 키워드 */}
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3">주요 게임 & 시청자 키워드</h3>
          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-slate-500 uppercase mb-1.5">주요 게임</div>
              <div className="flex flex-wrap gap-1.5">
                {topGames.length === 0 ? <span className="text-[10px] text-slate-600">데이터 없음</span> :
                  topGames.slice(0, 10).map((g, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300">
                      {typeof g === 'string' ? g : `${g.game} ${g.count ? `(${g.count})` : ''}`}
                    </span>
                  ))
                }
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase mb-1.5">시청자 키워드</div>
              <div className="flex flex-wrap gap-1.5">
                {audienceKeywords.length === 0 ? <span className="text-[10px] text-slate-600">데이터 없음</span> :
                  audienceKeywords.slice(0, 15).map((k, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-slate-700/50 text-slate-300">
                      {typeof k === 'string' ? k : k.keyword || k.word}
                    </span>
                  ))
                }
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* 캠페인 참여 이력 */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Megaphone size={14} className="text-amber-400" /> 캠페인 참여 이력 ({campaigns.length})
        </h3>
        {campaigns.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">참여한 캠페인이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase border-b border-[#374766]/20">
                  <th className="text-left py-2 px-2">캠페인</th>
                  <th className="text-left py-2 px-2">브랜드</th>
                  <th className="text-left py-2 px-2">타겟 게임</th>
                  <th className="text-left py-2 px-2">상태</th>
                  <th className="text-center py-2 px-2">제안 단가</th>
                  <th className="text-left py-2 px-2">참여일</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.id} className="border-b border-[#374766]/10 hover:bg-[#1a2035]/30 cursor-pointer"
                      onClick={() => onNavigate?.('campaign-detail', { campaignId: c.campaign_id })}>
                    <td className="py-2 px-2 text-indigo-400">{c.campaign_title || c.campaign_id?.slice(0,8)}</td>
                    <td className="py-2 px-2 text-slate-400">{c.brand_name || '-'}</td>
                    <td className="py-2 px-2 text-slate-400">{c.target_game || '-'}</td>
                    <td className="py-2 px-2 text-slate-400">{c.state}</td>
                    <td className="py-2 px-2 text-center text-slate-300">{c.proposed_fee ? c.proposed_fee.toLocaleString() : '-'}</td>
                    <td className="py-2 px-2 text-slate-500 text-[10px]">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* 최근 분석 리포트 + 최근 감지 방송 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Star size={14} className="text-emerald-400" /> 최근 분석 리포트
          </h3>
          {analysisReports.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-xs">분석 리포트 없음</div>
          ) : (
            <div className="space-y-2">
              {analysisReports.map(r => (
                <div key={r.id} className="flex items-center gap-2 p-2 rounded bg-[#0a0e1a]/50">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                    {r.status}
                  </span>
                  <span className="text-[10px] text-white truncate">{r.channel_name || r.platform}</span>
                  <span className="text-[10px] text-slate-500 ml-auto">{formatDate(r.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Monitor size={14} className="text-cyan-400" /> 최근 감지 방송
          </h3>
          {recentStreams.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-xs">감지된 방송 없음</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentStreams.map(s => (
                <div key={s.id} className="p-2 rounded bg-[#0a0e1a]/50">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${PLATFORM_COLORS[s.platform] || ''}`}>{s.platform}</span>
                    <span className="text-[10px] text-white truncate flex-1">{s.title}</span>
                    <span className="text-[10px] text-slate-500">{formatDate(s.discovered_at)}</span>
                  </div>
                  {s.campaign_title && (
                    <div className="text-[9px] text-slate-500 mt-0.5 ml-1">캠페인: {s.campaign_title}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function Row({ label, value, verified }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[10px] text-slate-500 w-20 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-slate-300 break-all flex-1">{value}</span>
      {verified !== undefined && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded ${verified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-500'}`}>
          {verified ? '인증됨' : '미인증'}
        </span>
      )}
    </div>
  );
}

function formatDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
