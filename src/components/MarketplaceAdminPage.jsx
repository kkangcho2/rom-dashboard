/**
 * MarketplaceAdminPage - 마켓플레이스 관리자 대시보드
 * 3 Tabs: 통계 / 크리에이터 관리 / 캠페인 관리 + 감사 로그
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Users, Megaphone, TrendingUp, BarChart3, Shield, Search, RefreshCw,
  Eye, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Clock,
  FileText, Activity, Award, Star, Filter, UserCheck, Play, X,
  ThumbsUp, MessageCircle, Monitor, Calendar, ExternalLink, ArrowLeft
} from 'lucide-react';
import { GlassCard } from './shared';
import { authFetch } from '../store/useAuthStore';

// ─── API Helpers ────────────────────────────────────────────
async function fetchAdminMarketplace(path) {
  const res = await authFetch(`/admin/marketplace${path}`);
  if (!res.ok) throw new Error('API 오류');
  return res.json();
}

// ─── Role/State Labels ──────────────────────────────────────
const GRADE_COLORS = {
  S: 'bg-amber-500/20 text-amber-400', A: 'bg-indigo-500/20 text-indigo-400',
  B: 'bg-blue-500/20 text-blue-400', C: 'bg-slate-500/20 text-slate-400',
};
const BADGE_COLORS = {
  gold: 'bg-amber-500/20 text-amber-400', silver: 'bg-slate-400/20 text-slate-300',
  bronze: 'bg-orange-500/20 text-orange-400',
};
const STATE_LABELS = {
  draft: '작성중', published: '공개', matching: '매칭중', negotiating: '협의중',
  accepted: '수락', confirmed: '확정', live: 'LIVE', completed: '완료',
  verified: '검증완료', closed: '종료',
};
const STATE_COLORS = {
  draft: 'text-slate-400', published: 'text-blue-400', matching: 'text-amber-400',
  live: 'text-red-400', completed: 'text-emerald-400', verified: 'text-green-400', closed: 'text-slate-500',
};

// ═══════════════════════════════════════════════════════════
//  Stats Tab
// ═══════════════════════════════════════════════════════════
function StatsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminMarketplace('/stats').then(d => setStats(d.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-16 text-slate-500 text-xs animate-pulse">통계 로딩 중...</div>;
  if (!stats) return null;

  const { overview, trends, campaigns_by_state } = stats;

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '크리에이터', value: overview.total_creators, icon: Users, color: 'text-indigo-400', sub: `+${trends.new_creators_7d} (7일)` },
          { label: '광고주', value: overview.total_advertisers, icon: UserCheck, color: 'text-emerald-400' },
          { label: '캠페인', value: overview.total_campaigns, icon: Megaphone, color: 'text-amber-400', sub: `+${trends.new_campaigns_7d} (7일)` },
          { label: '매칭률', value: `${overview.match_rate}%`, icon: TrendingUp, color: 'text-purple-400', sub: `${overview.accepted_matches}/${overview.total_matches}` },
        ].map((s, i) => (
          <GlassCard key={i} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</span>
              <s.icon size={14} className={s.color} />
            </div>
            <div className="text-xl font-bold text-white">{s.value}</div>
            {s.sub && <div className="text-[10px] text-slate-500 mt-1">{s.sub}</div>}
          </GlassCard>
        ))}
      </div>

      {/* Campaign Distribution */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <BarChart3 size={14} className="text-indigo-400" /> 캠페인 상태 분포
        </h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(campaigns_by_state).map(([state, count]) => (
            <div key={state} className="bg-dark-800/50 rounded-lg px-3 py-2 border border-dark-600/30">
              <span className={`text-xs font-medium ${STATE_COLORS[state] || 'text-slate-400'}`}>{STATE_LABELS[state] || state}</span>
              <span className="text-sm font-bold text-white ml-2">{count}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-indigo-400">{overview.active_campaigns}</div>
          <div className="text-[10px] text-slate-500 mt-1">진행 중 캠페인</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{overview.completed_campaigns}</div>
          <div className="text-[10px] text-slate-500 mt-1">완료 캠페인</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">{overview.total_reports}</div>
          <div className="text-[10px] text-slate-500 mt-1">검증 리포트</div>
        </GlassCard>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Creators Tab
// ═══════════════════════════════════════════════════════════
function CreatorsTab() {
  const [creators, setCreators] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ channel_name: '', channel_handle: '', channel_url: '', games: '', genre: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.set('search', search);
      const data = await fetchAdminMarketplace(`/creators?${params}`);
      setCreators(data.data.creators);
      setPagination(data.data.pagination);
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleSaveQuality = async (creatorId) => {
    try {
      await authFetch(`/admin/marketplace/creators/${creatorId}/quality`, {
        method: 'PUT',
        body: JSON.stringify(editData),
      });
      setEditId(null);
      setEditData({});
      load();
    } catch (e) {
      alert('저장 실패: ' + e.message);
    }
  };

  const handleManualAdd = async () => {
    if (!addForm.channel_name.trim()) { alert('채널명을 입력해주세요'); return; }
    setAddLoading(true);
    try {
      const res = await authFetch('/admin/marketplace/creators/manual', {
        method: 'POST',
        body: JSON.stringify({
          channel_name: addForm.channel_name.trim(),
          channel_handle: addForm.channel_handle.trim(),
          channel_url: addForm.channel_url.trim(),
          games: addForm.games ? addForm.games.split(',').map(g => g.trim()).filter(Boolean) : [],
          genre: addForm.genre.trim() || '게임',
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || '등록 실패'); return; }
      alert(`${data.channel_name || addForm.channel_name} 등록 완료! YouTube에서 채널 정보가 자동으로 수집되었습니다.`);
      setShowAdd(false);
      setAddForm({ channel_name: '', channel_handle: '', channel_url: '', games: '', genre: '' });
      load();
    } catch (e) { alert('에러: ' + e.message); }
    finally { setAddLoading(false); }
  };

  const handleUpdateAll = async () => {
    if (!confirm('등록된 모든 크리에이터의 채널 정보를 YouTube에서 다시 수집합니다.\n약 2-3분 소요됩니다. 진행하시겠습니까?')) return;
    setUpdateLoading(true);
    setUpdateMsg('분석 시작...');
    try {
      const res = await authFetch('/admin/auto-register/analyze-all', { method: 'POST' });
      const data = await res.json();
      setUpdateMsg(`${data.total}명 분석 시작됨. 완료까지 2-3분...`);
      // 폴링
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        setUpdateMsg(`분석 진행 중... (${attempts * 10}초)`);
        if (attempts >= 18) { // 3분
          clearInterval(poll);
          setUpdateLoading(false);
          setUpdateMsg('완료 (새로고침 해주세요)');
          load();
        }
      }, 10000);
      // 2분 후 자동 새로고침
      setTimeout(() => { clearInterval(poll); setUpdateLoading(false); setUpdateMsg(''); load(); }, 120000);
    } catch (e) { setUpdateMsg('에러: ' + e.message); setUpdateLoading(false); }
  };

  const handleRefreshOne = async (creatorId, name) => {
    try {
      const res = await authFetch(`/admin/marketplace/creators/${creatorId}/refresh`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) { alert(`${name}: ${data.subscribers?.toLocaleString()}명, ${data.grade}등급`); load(); }
      else alert(data.error || '업데이트 실패');
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (creatorId, name) => {
    if (!confirm(`"${name}" 크리에이터를 삭제하시겠습니까?`)) return;
    try {
      const res = await authFetch(`/admin/marketplace/creators/${creatorId}`, { method: 'DELETE' });
      if (res.ok) load();
      else { const d = await res.json(); alert(d.error || '삭제 실패'); }
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-4">
      {/* Search + Add Button */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder="크리에이터 이름 또는 이메일 검색..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-3 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30 hover:bg-indigo-500/30 transition whitespace-nowrap">
          + 수동 추가
        </button>
        <button onClick={handleUpdateAll} disabled={updateLoading}
          className="px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition whitespace-nowrap disabled:opacity-50">
          {updateLoading ? '분석 중...' : '전체 업데이트'}
        </button>
        <button onClick={load} className="p-2 rounded-lg hover:bg-dark-700 text-slate-400 hover:text-white transition">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
        {updateMsg && <span className="text-[10px] text-emerald-400">{updateMsg}</span>}
      </div>

      {/* Manual Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="bg-dark-800 border border-dark-600/50 rounded-2xl w-[480px] shadow-2xl p-6 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
              <Users size={14} className="text-indigo-400" /> 크리에이터 수동 추가
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block uppercase tracking-wider">채널명 *</label>
                <input value={addForm.channel_name} onChange={e => setAddForm(f => ({ ...f, channel_name: e.target.value }))}
                  placeholder="예: 김실장" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block uppercase tracking-wider">채널 핸들</label>
                <input value={addForm.channel_handle} onChange={e => setAddForm(f => ({ ...f, channel_handle: e.target.value }))}
                  placeholder="예: @kimsilzang" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block uppercase tracking-wider">채널 링크</label>
                <input value={addForm.channel_url} onChange={e => setAddForm(f => ({ ...f, channel_url: e.target.value }))}
                  placeholder="https://www.youtube.com/@kimsilzang" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block uppercase tracking-wider">게임 (쉼표로 구분)</label>
                <input value={addForm.games} onChange={e => setAddForm(f => ({ ...f, games: e.target.value }))}
                  placeholder="예: 리니지M, 로드나인, 검은사막 모바일" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block uppercase tracking-wider">장르</label>
                <input value={addForm.genre} onChange={e => setAddForm(f => ({ ...f, genre: e.target.value }))}
                  placeholder="예: MMORPG, RPG, 캐주얼" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleManualAdd} disabled={addLoading}
                  className="flex-1 py-2.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30 hover:bg-indigo-500/30 transition disabled:opacity-50">
                  {addLoading ? '등록 중...' : '크리에이터 등록'}
                </button>
                <button onClick={() => setShowAdd(false)}
                  className="px-4 py-2.5 rounded-lg bg-dark-700 text-slate-400 text-xs hover:text-white transition">
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-dark-500/30">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-dark-700/60">
              {['이름', '이메일', '등급', '배지', '평균시청자', 'Trust', '캠페인', '상태', '품질 플래그', '관리'].map(h => (
                <th key={h} className="px-3 py-2.5 text-slate-400 font-medium text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {creators.map((c, i) => {
              const flags = c.internal_quality_flags || {};
              const hasFlags = Object.keys(flags).length > 0;
              const isEditing = editId === c.id;

              return (
                <tr key={c.id} className={`border-t border-dark-500/20 hover:bg-dark-700/30 ${i % 2 ? 'bg-dark-700/10' : ''}`}>
                  <td className="px-3 py-2.5 font-medium text-slate-200 whitespace-nowrap">{c.display_name}</td>
                  <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap" title={c.email}>
                    {c.email && c.email.length > 28 ? c.email.substring(0, 28) + '...' : (c.email || '-')}
                  </td>
                  <td className="px-3 py-2.5">
                    {isEditing ? (
                      <select value={editData.engagement_grade ?? c.engagement_grade ?? ''} onChange={e => setEditData(d => ({ ...d, engagement_grade: e.target.value }))}
                        className="bg-dark-800 border border-dark-600 rounded px-1 py-0.5 text-[10px]">
                        <option value="">-</option>
                        {['S','A','B','C'].map(g => <option key={g}>{g}</option>)}
                      </select>
                    ) : (
                      c.engagement_grade && <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${GRADE_COLORS[c.engagement_grade] || ''}`}>{c.engagement_grade}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isEditing ? (
                      <select value={editData.verified_viewer_badge ?? c.verified_viewer_badge ?? ''} onChange={e => setEditData(d => ({ ...d, verified_viewer_badge: e.target.value }))}
                        className="bg-dark-800 border border-dark-600 rounded px-1 py-0.5 text-[10px]">
                        <option value="">없음</option>
                        {['bronze','silver','gold'].map(b => <option key={b}>{b}</option>)}
                      </select>
                    ) : (
                      c.verified_viewer_badge && <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${BADGE_COLORS[c.verified_viewer_badge] || ''}`}>{c.verified_viewer_badge}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 font-mono">{c.avg_concurrent_viewers?.toLocaleString() || '-'}</td>
                  <td className="px-3 py-2.5">
                    {isEditing ? (
                      <input type="number" min="0" max="1" step="0.1" value={editData.trust_score ?? c.trust_score ?? 0.5}
                        onChange={e => setEditData(d => ({ ...d, trust_score: parseFloat(e.target.value) }))}
                        className="w-14 bg-dark-800 border border-dark-600 rounded px-1 py-0.5 text-[10px]" />
                    ) : (
                      <span className={`font-mono text-[10px] ${c.trust_score < 0.4 ? 'text-red-400' : c.trust_score < 0.7 ? 'text-amber-400' : 'text-green-400'}`}>
                        {c.trust_score?.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300">{c.total_campaigns_completed || 0}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.user_status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {c.user_status === 'active' ? '활성' : '정지'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {hasFlags ? (
                      <span className="text-[10px] text-amber-400 flex items-center gap-1">
                        <AlertTriangle size={10} /> {Object.keys(flags).length}건
                      </span>
                    ) : (
                      <span className="text-[10px] text-green-400">Clean</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleSaveQuality(c.id)} className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] hover:bg-indigo-500/30">저장</button>
                        <button onClick={() => { setEditId(null); setEditData({}); }} className="px-2 py-0.5 rounded bg-dark-700 text-slate-400 text-[10px] hover:bg-dark-600">취소</button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button onClick={() => handleRefreshOne(c.id, c.display_name)}
                          className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400/60 text-[10px] hover:text-emerald-400 hover:bg-emerald-500/20 transition" title="YouTube에서 구독자/등급 갱신">
                          갱신
                        </button>
                        <button onClick={() => { setEditId(c.id); setEditData({}); }}
                          className="px-2 py-0.5 rounded bg-dark-700/60 text-slate-400 text-[10px] hover:text-white hover:bg-dark-600 transition">
                          수정
                        </button>
                        <button onClick={() => handleDelete(c.id, c.display_name)}
                          className="px-2 py-0.5 rounded bg-red-500/10 text-red-400/60 text-[10px] hover:text-red-400 hover:bg-red-500/20 transition">
                          삭제
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-1.5">
          {[...Array(Math.min(pagination.totalPages, 10))].map((_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={`w-7 h-7 rounded text-[10px] font-medium ${page === i + 1 ? 'bg-indigo-500/20 text-indigo-300' : 'bg-dark-700/40 text-slate-500 hover:text-white'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Creator Detail Panel (방송별 상세 + AI 분석)
// ═══════════════════════════════════════════════════════════
function CreatorDetailPanel({ creator, dateColumns, onBack, campaignTitle }) {
  const videos = creator.allVideos || [];
  const RATING_LABELS = { good: { text: '우수', cls: 'bg-emerald-500/20 text-emerald-400' }, normal: { text: '보통', cls: 'bg-slate-500/20 text-slate-400' }, poor: { text: '저조', cls: 'bg-red-500/20 text-red-400' } };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg bg-dark-700/60 hover:bg-dark-600 text-slate-400 hover:text-white transition">
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            {creator.creatorName}
            {creator.channelId && (
              <a href={`https://www.youtube.com/channel/${creator.channelId}`} target="_blank" rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300"><ExternalLink size={12} /></a>
            )}
          </h4>
          <div className="text-[10px] text-slate-500 flex items-center gap-3 mt-0.5">
            {creator.serverName && <span>서버: {creator.serverName}</span>}
            {creator.characterName && <span>캐릭: {creator.characterName}</span>}
            <span>{campaignTitle}</span>
          </div>
        </div>
      </div>

      {/* 크리에이터 요약 KPI */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: '총 방송', value: `${creator.broadcastCount}회`, color: 'text-emerald-400' },
          { label: '총 조회수', value: (creator.totalViews || 0).toLocaleString(), color: 'text-amber-400' },
          { label: '평균 조회수', value: (creator.avgViews || 0).toLocaleString(), color: 'text-purple-400' },
          { label: '방송률', value: dateColumns.length > 0 ? `${Math.round(creator.broadcastCount / dateColumns.length * 100)}%` : '-', color: 'text-indigo-400' },
          { label: '구독자', value: creator.subscribers ? creator.subscribers.toLocaleString() : '-', color: 'text-slate-300' },
        ].map(s => (
          <div key={s.label} className="bg-dark-700/40 rounded-lg p-2.5 text-center border border-dark-600/20">
            <div className={`text-sm font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 방송 타임라인 히트맵 (간단 캘린더) */}
      <div className="bg-dark-700/30 rounded-xl p-3 border border-dark-600/20">
        <h5 className="text-[10px] text-slate-400 font-medium mb-2 flex items-center gap-1.5">
          <Calendar size={11} /> 방송 캘린더
        </h5>
        <div className="flex flex-wrap gap-[3px]">
          {dateColumns.map(date => {
            const cell = creator.dateCells?.[date];
            const isBroadcast = cell?.status === 'broadcast';
            const rating = cell?.video?.aiAnalysis?.rating;
            const bgColor = !isBroadcast ? 'bg-dark-600/30' : rating === 'good' ? 'bg-emerald-500/60' : rating === 'poor' ? 'bg-red-500/40' : 'bg-emerald-500/30';
            return (
              <div key={date} className={`w-[14px] h-[14px] rounded-sm ${bgColor} cursor-default`}
                title={`${date}${isBroadcast ? ' - 방송' : ' - 휴방'}${cell?.video?.title ? '\n' + cell.video.title : ''}`} />
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-2 text-[9px] text-slate-600">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/60 inline-block" /> 우수</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30 inline-block" /> 보통</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/40 inline-block" /> 저조</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-dark-600/30 inline-block" /> 휴방</span>
        </div>
      </div>

      {/* 방송별 상세 리스트 */}
      <div className="space-y-2">
        <h5 className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
          <Play size={11} /> 방송 상세 ({videos.length}건)
        </h5>
        {videos.length === 0 ? (
          <div className="text-center py-8 text-slate-600 text-xs">방송 데이터가 없습니다</div>
        ) : videos.map((v, i) => {
          const rating = RATING_LABELS[v.aiAnalysis?.rating] || RATING_LABELS.normal;
          return (
            <div key={v.videoId || i} className="bg-dark-700/30 rounded-xl p-3 border border-dark-600/20 hover:border-dark-500/40 transition">
              <div className="flex items-start gap-3">
                {/* 방송 번호 */}
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-indigo-400">{v.broadcastNumber || (i + 1)}</span>
                </div>

                {/* 썸네일 */}
                {v.thumbnail && (
                  <a href={v.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                    <img src={v.thumbnail} alt="" className="w-28 h-16 rounded-lg object-cover border border-dark-600/30" />
                  </a>
                )}

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-slate-500">{v.date}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${rating.cls}`}>{rating.text}</span>
                    {v.durationText && v.durationText !== '-' && (
                      <span className="text-[9px] text-slate-600 flex items-center gap-0.5"><Clock size={8} />{v.durationText}</span>
                    )}
                  </div>
                  <a href={v.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-white hover:text-indigo-400 transition font-medium line-clamp-1 block">
                    {v.title}
                  </a>

                  {/* 수치 */}
                  <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                    <span className="text-slate-400 flex items-center gap-1"><Eye size={10} className="text-slate-500" />{(v.viewCount || 0).toLocaleString()}</span>
                    <span className="text-slate-400 flex items-center gap-1"><ThumbsUp size={10} className="text-slate-500" />{(v.likeCount || 0).toLocaleString()}</span>
                    <span className="text-slate-400 flex items-center gap-1"><MessageCircle size={10} className="text-slate-500" />{(v.commentCount || 0).toLocaleString()}</span>
                    {v.concurrentViewers > 0 && (
                      <span className="text-slate-400 flex items-center gap-1"><Monitor size={10} className="text-slate-500" />동접 {v.concurrentViewers.toLocaleString()}</span>
                    )}
                  </div>

                  {/* AI 분석 */}
                  {v.aiAnalysis && (v.aiAnalysis.summary || v.aiAnalysis.viewerReaction || v.aiAnalysis.highlights) && (
                    <div className="mt-2 bg-dark-800/50 rounded-lg p-2 border border-dark-600/20 space-y-1">
                      {v.aiAnalysis.summary && (
                        <div className="text-[10px]"><span className="text-indigo-400 font-medium">내용:</span> <span className="text-slate-300">{v.aiAnalysis.summary}</span></div>
                      )}
                      {v.aiAnalysis.viewerReaction && (
                        <div className="text-[10px]"><span className="text-emerald-400 font-medium">반응:</span> <span className="text-slate-300">{v.aiAnalysis.viewerReaction}</span></div>
                      )}
                      {v.aiAnalysis.highlights && (
                        <div className="text-[10px]"><span className="text-amber-400 font-medium">특이:</span> <span className="text-slate-300">{v.aiAnalysis.highlights}</span></div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Campaigns Tab
// ═══════════════════════════════════════════════════════════
// 광고주 역할 토글 (advertiser 지정/해제)
function AdvertiserRoleToggle({ userId, role, email, onChanged }) {
  const [loading, setLoading] = useState(false);
  const [currentRole, setCurrentRole] = useState(role);
  const isAdvertiser = currentRole === 'advertiser';
  const isAdmin = currentRole === 'admin';

  // role prop이 바뀌면 state 동기화
  useEffect(() => { setCurrentRole(role); }, [role]);

  if (!userId) {
    return <span className="text-[10px] text-slate-600">-</span>;
  }

  const toggle = async () => {
    if (isAdmin) {
      alert('관리자 계정은 여기서 변경할 수 없습니다');
      return;
    }
    const newRole = isAdvertiser ? 'free_viewer' : 'advertiser';
    const confirmMsg = isAdvertiser
      ? `${email}의 캠페인 담당자 권한을 해제하시겠습니까?`
      : `${email}을(를) 캠페인 담당자(광고주/대행사)로 지정하시겠습니까?\n해당 유저는 관리 콘솔에서 본인 캠페인의 리포트/이메일을 볼 수 있게 됩니다.`;
    if (!confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await authFetch(`/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      const j = await res.json();
      if (j.ok) {
        setCurrentRole(newRole);
        onChanged?.();
      } else {
        alert('실패: ' + (j.error || 'unknown'));
      }
    } catch (e) { alert('실패: ' + e.message); }
    setLoading(false);
  };

  if (isAdmin) {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 whitespace-nowrap">관리자</span>;
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-[10px] px-2 py-0.5 rounded whitespace-nowrap transition ${
        isAdvertiser
          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30'
          : 'bg-slate-700/40 text-slate-400 border border-slate-600/30 hover:bg-slate-600/50 hover:text-slate-200'
      }`}
      title={isAdvertiser ? '클릭하여 담당자 해제' : '클릭하여 캠페인 담당자로 지정'}
    >
      {loading ? '...' : (isAdvertiser ? '✓ 담당자' : '+ 담당자 지정')}
    </button>
  );
}

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', brand_name: '', target_game: '', max_creators: '3', contract_months: '1', broadcasts_per_month: '', hours_per_broadcast: '', requirements: '' });
  const [addLoading, setAddLoading] = useState(false);
  // 캠페인 상세 (크리에이터 지정 + 리포트)
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignCreators, setCampaignCreators] = useState([]);
  const [campaignReport, setCampaignReport] = useState(null);
  const [creatorSearch, setCreatorSearch] = useState('');
  const [creatorResults, setCreatorResults] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: 20 });
    if (stateFilter) params.set('state', stateFilter);
    try {
      const data = await fetchAdminMarketplace(`/campaigns?${params}`);
      setCampaigns(data.data.campaigns);
      setPagination(data.data.pagination);
    } finally { setLoading(false); }
  }, [stateFilter]);

  useEffect(() => { load(); }, [load]);

  const handleForceState = async (id, title, newState) => {
    const reason = prompt(`"${title}" 상태를 ${STATE_LABELS[newState]}(으)로 변경하시겠습니까?\n사유를 입력하세요:`);
    if (reason === null) return;
    try {
      await authFetch(`/admin/marketplace/campaigns/${id}/force-state`, {
        method: 'PUT',
        body: JSON.stringify({ state: newState, reason }),
      });
      load();
    } catch (e) { alert('실패: ' + e.message); }
  };

  // 캠페인 상세 로드
  const openCampaignDetail = async (c) => {
    setSelectedCampaign(c);
    try {
      const crRes = await fetchAdminMarketplace(`/campaigns/${c.id}/creators`);
      setCampaignCreators(crRes.data || []);
    } catch { setCampaignCreators([]); }
    try {
      const rpRes = await fetchAdminMarketplace(`/campaigns/${c.id}/report`);
      setCampaignReport(rpRes.hasReport ? rpRes.report : null);
    } catch { setCampaignReport(null); }
  };

  // 크리에이터 검색
  const searchCreatorForCampaign = async () => {
    if (!creatorSearch.trim()) return;
    try {
      const res = await fetchAdminMarketplace(`/creators?search=${encodeURIComponent(creatorSearch)}&limit=10`);
      setCreatorResults(res.data?.creators || []);
    } catch { setCreatorResults([]); }
  };

  // 크리에이터 추가
  const addCreatorToCampaign = async (creatorId) => {
    try {
      const res = await authFetch(`/admin/marketplace/campaigns/${selectedCampaign.id}/creators`, {
        method: 'POST', body: JSON.stringify({ creator_profile_id: creatorId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      openCampaignDetail(selectedCampaign);
    } catch (e) { alert(e.message); }
  };

  // 크리에이터 제거
  const removeCreatorFromCampaign = async (creatorId) => {
    await authFetch(`/admin/marketplace/campaigns/${selectedCampaign.id}/creators/${creatorId}`, { method: 'DELETE' });
    openCampaignDetail(selectedCampaign);
  };

  // 크리에이터 메타 정보 수정 (서버명/캐릭터명/방송URL)
  const updateCreatorMeta = async (creatorId, data) => {
    try {
      await authFetch(`/admin/marketplace/campaigns/${selectedCampaign.id}/creators/${creatorId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch {}
  };

  // 크리에이터 상세 패널
  const [selectedCreator, setSelectedCreator] = useState(null);

  // 리포트 생성 (동기)
  const generateCampaignReport = async () => {
    setReportLoading(true);
    try {
      const res = await authFetch(`/admin/marketplace/campaigns/${selectedCampaign.id}/report`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        // 생성 완료 → 리포트 조회
        const rpRes = await fetchAdminMarketplace(`/campaigns/${selectedCampaign.id}/report`);
        setCampaignReport(rpRes.hasReport ? rpRes.report : null);
      } else {
        alert('리포트 생성 실패: ' + (data.error || ''));
      }
    } catch (e) { alert('리포트 생성 오류: ' + e.message); }
    finally { setReportLoading(false); }
  };

  const handleAddCampaign = async () => {
    if (!addForm.title.trim() || !addForm.brand_name.trim()) { alert('제목과 브랜드명 필수'); return; }
    setAddLoading(true);
    try {
      const res = await authFetch('/marketplace/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          title: addForm.title.trim(),
          brand_name: addForm.brand_name.trim(),
          target_game: addForm.target_game.trim(),
          max_creators: parseInt(addForm.max_creators) || 3,
          contract_months: parseInt(addForm.contract_months) || 1,
          broadcasts_per_month: addForm.broadcasts_per_month.trim(),
          hours_per_broadcast: addForm.hours_per_broadcast.trim(),
          requirements: addForm.requirements.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || '생성 실패'); return; }
      // 바로 published로
      try { await authFetch(`/marketplace/campaigns/${data.id}/state`, { method: 'PUT', body: JSON.stringify({ state: 'published' }) }); } catch {}
      setShowAdd(false);
      setAddForm({ title: '', brand_name: '', target_game: '', max_creators: '3', contract_months: '1', broadcasts_per_month: '', hours_per_broadcast: '', requirements: '' });
      load();
    } catch (e) { alert(e.message); }
    finally { setAddLoading(false); }
  };

  return (
    <div className="space-y-4">
      {/* Filters + Add */}
      <div className="flex items-center gap-3">
        <Filter size={13} className="text-slate-500" />
        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
          className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none">
          <option value="">전체 상태</option>
          {Object.entries(STATE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30 hover:bg-indigo-500/30 transition whitespace-nowrap">
          + 캠페인 추가
        </button>
        <button onClick={load} className="p-2 rounded-lg hover:bg-dark-700 text-slate-400 hover:text-white transition">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
        <span className="text-[10px] text-slate-500 ml-auto">총 {pagination.total || 0}건</span>
      </div>

      {/* Add Campaign Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="bg-dark-800 border border-dark-600/50 rounded-2xl w-[520px] max-w-[95vw] shadow-2xl p-6 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Megaphone size={14} className="text-indigo-400" /> 캠페인 수동 추가
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">캠페인 제목 *</label>
                  <input value={addForm.title} onChange={e => setAddForm(f => ({...f, title: e.target.value}))}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" placeholder="예: 리니지M 신규 업데이트 프로모션" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">브랜드/게임 *</label>
                  <input value={addForm.brand_name} onChange={e => setAddForm(f => ({...f, brand_name: e.target.value}))}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" placeholder="예: 리니지M" />
                </div>
              </div>
              <div><label className="text-[10px] text-slate-500 mb-1 block">타겟 게임</label>
                <input value={addForm.target_game} onChange={e => setAddForm(f => ({...f, target_game: e.target.value}))}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" placeholder="예: 리니지M" /></div>
              <div className="grid grid-cols-4 gap-2">
                <div><label className="text-[10px] text-slate-500 mb-1 block">크리에이터 수</label>
                  <input value={addForm.max_creators} onChange={e => setAddForm(f => ({...f, max_creators: e.target.value}))} type="number"
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50" /></div>
                <div><label className="text-[10px] text-slate-500 mb-1 block">계약 기간(월)</label>
                  <input value={addForm.contract_months} onChange={e => setAddForm(f => ({...f, contract_months: e.target.value}))} type="number"
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50" /></div>
                <div><label className="text-[10px] text-slate-500 mb-1 block">월 방송</label>
                  <input value={addForm.broadcasts_per_month} onChange={e => setAddForm(f => ({...f, broadcasts_per_month: e.target.value}))}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50" placeholder="4회" /></div>
                <div><label className="text-[10px] text-slate-500 mb-1 block">회당 시간</label>
                  <input value={addForm.hours_per_broadcast} onChange={e => setAddForm(f => ({...f, hours_per_broadcast: e.target.value}))}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50" placeholder="2시간" /></div>
              </div>
              <div><label className="text-[10px] text-slate-500 mb-1 block">요구사항</label>
                <textarea value={addForm.requirements} onChange={e => setAddForm(f => ({...f, requirements: e.target.value}))} rows={2}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none" placeholder="배너 위치, 멘트 등" /></div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAddCampaign} disabled={addLoading}
                  className="flex-1 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30 hover:bg-indigo-500/30 transition disabled:opacity-50">
                  {addLoading ? '생성 중...' : '캠페인 생성'}
                </button>
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg bg-dark-700 text-slate-400 text-xs hover:text-white transition">취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-dark-500/30">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-dark-700/60">
              {['제목', '브랜드', '광고주', '역할', '상태', '매칭', '생성일', '리포트', '관리'].map(h => (
                <th key={h} className="px-3 py-2.5 text-slate-400 font-medium text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c, i) => (
              <tr key={c.id} className={`border-t border-dark-500/20 hover:bg-dark-700/30 ${i % 2 ? 'bg-dark-700/10' : ''}`}>
                <td className="px-3 py-2.5 font-medium text-slate-200 whitespace-nowrap max-w-[200px] truncate">{c.title}</td>
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{c.brand_name}</td>
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap text-[10px]" title={c.advertiser_email}>
                  {c.advertiser_email && c.advertiser_email.length > 22 ? c.advertiser_email.substring(0, 22) + '...' : c.advertiser_email}
                </td>
                <td className="px-3 py-2.5">
                  <AdvertiserRoleToggle userId={c.advertiser_id} role={c.advertiser_role} email={c.advertiser_email} onChanged={load} />
                </td>
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] font-medium ${STATE_COLORS[c.state] || 'text-slate-400'}`}>
                    {STATE_LABELS[c.state] || c.state}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-slate-300">{c.accepted_count || 0}</span>
                  <span className="text-slate-600">/{c.match_count || 0}</span>
                </td>
                <td className="px-3 py-2.5 text-slate-500 text-[10px] whitespace-nowrap">{c.created_at?.split('T')[0] || c.created_at?.split(' ')[0]}</td>
                <td className="px-3 py-2.5">
                  <button onClick={() => openCampaignDetail(c)}
                    className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] hover:bg-emerald-500/20 transition">
                    상세
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <select value="" onChange={e => { if (e.target.value) handleForceState(c.id, c.title, e.target.value); }}
                    className="bg-dark-800 border border-dark-600 rounded px-1 py-0.5 text-[10px] text-slate-400 cursor-pointer">
                    <option value="">상태 변경</option>
                    {Object.entries(STATE_LABELS).filter(([k]) => k !== c.state).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══ Campaign Detail Modal ═══ */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedCampaign(null)}>
          <div className="bg-dark-800 border border-dark-600/50 rounded-2xl w-full max-w-[1100px] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 z-10 p-5 border-b border-dark-600/30 bg-dark-800/95 backdrop-blur-xl rounded-t-2xl flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedCampaign.title}</h3>
                <div className="text-[10px] text-slate-500">{selectedCampaign.brand_name} | {selectedCampaign.target_game || '미지정'}</div>
              </div>
              <button onClick={() => setSelectedCampaign(null)} className="text-slate-500 hover:text-white text-lg">×</button>
            </div>

            <div className="p-5 space-y-5">
              {/* 지정된 크리에이터 */}
              <div>
                <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                  <Users size={13} className="text-indigo-400" /> 지정 크리에이터 ({campaignCreators.length}명)
                </h4>
                {campaignCreators.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {campaignCreators.map(c => (
                      <div key={c.id} className="bg-dark-700/40 rounded-lg p-2.5 border border-dark-600/20">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white">{c.display_name}</span>
                            <span className="text-[9px] text-slate-500">{c.subscriber_count?.toLocaleString()}명</span>
                            {c.engagement_grade && <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${GRADE_COLORS[c.engagement_grade]}`}>{c.engagement_grade}</span>}
                          </div>
                          <button onClick={() => removeCreatorFromCampaign(c.id)} className="text-[10px] text-red-400/60 hover:text-red-400 transition">제거</button>
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            defaultValue={c.server_name || ''}
                            placeholder="서버명"
                            onBlur={e => updateCreatorMeta(c.id, { server_name: e.target.value, character_name: e.target.parentElement.querySelector('[data-field="char"]')?.value || c.character_name || '', broadcast_url: e.target.parentElement.querySelector('[data-field="url"]')?.value || c.broadcast_url || '' })}
                            className="w-24 bg-dark-800/60 border border-dark-600/30 rounded px-1.5 py-0.5 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40"
                          />
                          <input
                            data-field="char"
                            defaultValue={c.character_name || ''}
                            placeholder="캐릭터명"
                            onBlur={e => updateCreatorMeta(c.id, { server_name: e.target.parentElement.querySelector('input')?.value || c.server_name || '', character_name: e.target.value, broadcast_url: e.target.parentElement.querySelector('[data-field="url"]')?.value || c.broadcast_url || '' })}
                            className="w-24 bg-dark-800/60 border border-dark-600/30 rounded px-1.5 py-0.5 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40"
                          />
                          <input
                            data-field="url"
                            defaultValue={c.broadcast_url || ''}
                            placeholder="방송 URL"
                            onBlur={e => updateCreatorMeta(c.id, { server_name: e.target.parentElement.querySelector('input')?.value || c.server_name || '', character_name: e.target.parentElement.querySelector('[data-field="char"]')?.value || c.character_name || '', broadcast_url: e.target.value })}
                            className="flex-1 bg-dark-800/60 border border-dark-600/30 rounded px-1.5 py-0.5 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 mb-3 bg-dark-700/30 rounded-lg p-4 text-center">
                    크리에이터가 지정되지 않았습니다. 아래에서 검색하여 추가하세요.
                  </div>
                )}

                {/* 크리에이터 검색 + 추가 */}
                <div className="flex gap-2 mb-2">
                  <input value={creatorSearch} onChange={e => setCreatorSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchCreatorForCampaign()}
                    placeholder="크리에이터 이름 검색..."
                    className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                  <button onClick={searchCreatorForCampaign}
                    className="px-3 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs border border-indigo-500/30 hover:bg-indigo-500/30 transition">검색</button>
                </div>
                {creatorResults.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {creatorResults.map(c => {
                      const already = campaignCreators.some(cc => cc.id === c.id);
                      return (
                        <div key={c.id} className="flex items-center justify-between bg-dark-800/40 rounded p-2 text-xs">
                          <span className="text-slate-200">{c.display_name} <span className="text-slate-500">({c.subscriber_count?.toLocaleString() || '-'}명)</span></span>
                          {already ? <span className="text-slate-600 text-[10px]">추가됨</span> :
                            <button onClick={() => addCreatorToCampaign(c.id)} className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] hover:bg-indigo-500/30">추가</button>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 리포트 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <FileText size={13} className="text-amber-400" /> 방송 리포트
                  </h4>
                  <button onClick={generateCampaignReport} disabled={reportLoading || campaignCreators.length === 0}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-medium border border-amber-500/30 hover:bg-amber-500/30 transition disabled:opacity-50">
                    {reportLoading ? '생성 중...' : '리포트 생성'}
                  </button>
                </div>

                {campaignReport ? (
                  <div className="space-y-3">
                    {/* 크리에이터 상세 패널 */}
                    {selectedCreator ? (
                      <CreatorDetailPanel
                        creator={selectedCreator}
                        dateColumns={campaignReport.dateColumns || []}
                        onBack={() => setSelectedCreator(null)}
                        campaignTitle={selectedCampaign.title}
                      />
                    ) : (
                      <>
                        {/* 요약 KPI */}
                        <div className="grid grid-cols-5 gap-2">
                          {[
                            { label: '크리에이터', value: `${campaignReport.summary?.totalCreators || 0}/${campaignReport.summary?.totalCreatorsAssigned || 0}명`, color: 'text-indigo-400' },
                            { label: '총 방송', value: `${campaignReport.summary?.totalVideos || 0}건`, color: 'text-emerald-400' },
                            { label: '총 조회수', value: (campaignReport.summary?.totalViews || 0).toLocaleString(), color: 'text-amber-400' },
                            { label: '평균 조회수', value: (campaignReport.summary?.avgViews || 0).toLocaleString(), color: 'text-purple-400' },
                            { label: '기간', value: campaignReport.summary?.dateRange || '-', color: 'text-slate-300' },
                          ].map(s => (
                            <div key={s.label} className="bg-dark-700/40 rounded-lg p-2.5 text-center border border-dark-600/20">
                              <div className={`text-sm font-bold ${s.color}`}>{s.value}</div>
                              <div className="text-[9px] text-slate-500 mt-0.5">{s.label}</div>
                            </div>
                          ))}
                        </div>

                        {/* 크리에이터 × 날짜 그리드 테이블 */}
                        <div className="overflow-x-auto rounded-xl border border-dark-500/30">
                          <table className="w-full text-[10px] border-collapse">
                            <thead>
                              <tr className="bg-dark-700/80">
                                <th className="sticky left-0 z-10 bg-dark-700 px-2 py-2 text-slate-400 font-medium text-left whitespace-nowrap border-r border-dark-600/30">BJ닉네임</th>
                                <th className="px-2 py-2 text-slate-400 font-medium text-left whitespace-nowrap border-r border-dark-600/30">방송URL</th>
                                <th className="px-2 py-2 text-slate-400 font-medium text-left whitespace-nowrap border-r border-dark-600/30">서버명</th>
                                <th className="px-2 py-2 text-slate-400 font-medium text-left whitespace-nowrap border-r border-dark-600/30">캐릭터명</th>
                                <th className="px-2 py-2 text-slate-400 font-medium text-center whitespace-nowrap border-r border-dark-600/30">방송<br/>횟수</th>
                                {(campaignReport.dateColumns || []).map(date => {
                                  const d = new Date(date + 'T00:00:00');
                                  const dayNames = ['일','월','화','수','목','금','토'];
                                  const dayName = dayNames[d.getDay()];
                                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                  return (
                                    <th key={date} className={`px-1 py-1.5 text-center whitespace-nowrap border-r border-dark-600/30 min-w-[44px] ${isWeekend ? 'bg-dark-600/20' : ''}`}>
                                      <div className="text-slate-400 font-medium leading-tight">{date.slice(5)}</div>
                                      <div className={`text-[8px] ${isWeekend ? 'text-red-400/60' : 'text-slate-600'}`}>{dayName}</div>
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody>
                              {(campaignReport.gridRows || []).map((row, ri) => {
                                const broadcastRate = (campaignReport.dateColumns || []).length > 0
                                  ? Math.round((row.broadcastCount / (campaignReport.dateColumns || []).length) * 100) : 0;
                                return (
                                  <tr key={row.creatorId || ri} className={`border-t border-dark-500/20 ${ri % 2 ? 'bg-dark-700/10' : ''} hover:bg-indigo-500/5 transition-colors`}>
                                    <td className="sticky left-0 z-10 bg-dark-800 px-2 py-2 whitespace-nowrap border-r border-dark-600/30">
                                      <button onClick={() => setSelectedCreator(row)}
                                        className="text-white font-medium hover:text-indigo-400 transition-colors text-left flex items-center gap-1">
                                        {row.creatorName}
                                        <ChevronRight size={10} className="text-slate-600" />
                                      </button>
                                    </td>
                                    <td className="px-2 py-2 whitespace-nowrap border-r border-dark-600/30">
                                      {row.broadcastUrl ? (
                                        <a href={row.broadcastUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 truncate max-w-[100px] block">
                                          {row.broadcastUrl.replace('https://www.youtube.com/', '').substring(0, 16)}
                                        </a>
                                      ) : row.channelId ? (
                                        <a href={`https://www.youtube.com/channel/${row.channelId}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 truncate max-w-[100px] block">
                                          채널
                                        </a>
                                      ) : <span className="text-slate-600">-</span>}
                                    </td>
                                    <td className="px-2 py-2 text-slate-300 whitespace-nowrap border-r border-dark-600/30">{row.serverName || '-'}</td>
                                    <td className="px-2 py-2 text-slate-300 whitespace-nowrap border-r border-dark-600/30">{row.characterName || '-'}</td>
                                    <td className="px-2 py-2 text-center border-r border-dark-600/30">
                                      <span className="font-bold text-amber-400">{row.broadcastCount}</span>
                                      <span className="text-slate-600">/{(campaignReport.dateColumns || []).length}</span>
                                      <div className="w-full bg-dark-600/40 rounded-full h-1 mt-1">
                                        <div className={`h-1 rounded-full ${broadcastRate >= 70 ? 'bg-emerald-500' : broadcastRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                          style={{ width: `${broadcastRate}%` }} />
                                      </div>
                                    </td>
                                    {(campaignReport.dateColumns || []).map(date => {
                                      const cell = row.dateCells?.[date];
                                      const d = new Date(date + 'T00:00:00');
                                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                      if (cell?.status === 'broadcast' && cell.video) {
                                        const rating = cell.video.aiAnalysis?.rating;
                                        const ratingColor = rating === 'good' ? 'bg-emerald-500/15 border-emerald-500/20' : rating === 'poor' ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/8 border-emerald-500/10';
                                        return (
                                          <td key={date} className={`px-0.5 py-1 text-center border-r border-dark-600/30 ${isWeekend ? 'bg-dark-600/10' : ''}`}>
                                            <a href={cell.video.url} target="_blank" rel="noopener noreferrer"
                                              className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium border ${ratingColor} text-emerald-400 hover:text-emerald-300 transition`}
                                              title={`${cell.video.title}\n조회수: ${(cell.video.viewCount||0).toLocaleString()}`}>
                                              방송
                                            </a>
                                          </td>
                                        );
                                      }
                                      return (
                                        <td key={date} className={`px-0.5 py-1 text-center text-slate-700 border-r border-dark-600/30 ${isWeekend ? 'bg-dark-600/10' : ''}`}>
                                          -
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* 하단 액션 */}
                        <div className="flex items-center gap-3">
                          <button onClick={() => {
                            const blob = new Blob([JSON.stringify(campaignReport, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a'); a.href = url; a.download = `report-${selectedCampaign.title}.json`; a.click();
                          }} className="text-[10px] text-slate-500 hover:text-indigo-400 transition">JSON 다운로드</button>
                          <span className="text-[9px] text-slate-600">생성: {campaignReport.generatedAt ? new Date(campaignReport.generatedAt).toLocaleString('ko-KR') : '-'}</span>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="bg-dark-700/30 rounded-lg p-6 text-center text-xs text-slate-500">
                    {campaignCreators.length === 0 ? '크리에이터를 먼저 지정하세요' : '리포트 생성 버튼을 눌러 크리에이터 영상을 크롤링하세요'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Audit Logs Tab
// ═══════════════════════════════════════════════════════════
function AuditTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminMarketplace('/audit-logs?limit=50').then(d => setLogs(d.data.logs)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-16 text-slate-500 text-xs animate-pulse">로딩 중...</div>;

  return (
    <div className="space-y-3">
      {logs.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-xs">감사 로그가 없습니다</div>
      ) : logs.map(l => (
        <div key={l.id} className="bg-dark-800/40 rounded-lg p-3 border border-dark-600/20 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-indigo-400 font-medium">{l.actor_name || l.actor_email || 'System'}</span>
            <span className="text-slate-500">{l.action}</span>
            <span className="text-slate-600 ml-auto text-[10px]">{new Date(l.created_at).toLocaleString('ko-KR')}</span>
          </div>
          <div className="text-slate-500 text-[10px]">
            {l.resource_type}:{l.resource_id?.substring(0, 8)}
            {l.from_state && l.to_state && <span className="ml-2">{l.from_state} → {l.to_state}</span>}
          </div>
          {l.changes && (
            <pre className="text-[9px] text-slate-600 mt-1 bg-dark-900/50 rounded p-1.5 overflow-x-auto">
              {JSON.stringify(l.changes, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Sponsored Games Tab
// ═══════════════════════════════════════════════════════════
function SponsoredTab() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newGame, setNewGame] = useState('');
  const [newAdvertiser, setNewAdvertiser] = useState('');

  const load = () => {
    setLoading(true);
    fetchAdminMarketplace('/sponsored-games').then(d => setGames(d.data || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newGame.trim()) { alert('게임명을 입력하세요'); return; }
    try {
      const res = await authFetch('/admin/marketplace/sponsored-games', {
        method: 'POST',
        body: JSON.stringify({ game_name: newGame.trim(), advertiser: newAdvertiser.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setNewGame(''); setNewAdvertiser(''); load();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`"${name}" 광고 게임을 삭제하시겠습니까?`)) return;
    await authFetch(`/admin/marketplace/sponsored-games/${id}`, { method: 'DELETE' });
    load();
  };

  const handleToggle = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await authFetch(`/admin/marketplace/sponsored-games/${id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">광고 진행중 게임 관리</h3>
        <p className="text-[11px] text-slate-500 mb-4">여기에 등록된 게임은 크리에이터 포트폴리오에서 "광고" 뱃지가 표시됩니다.</p>

        {/* 추가 폼 */}
        <div className="flex gap-2 mb-4">
          <input value={newGame} onChange={e => setNewGame(e.target.value)} placeholder="게임명 (예: 아키텍트)"
            className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
            onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <input value={newAdvertiser} onChange={e => setNewAdvertiser(e.target.value)} placeholder="광고주 (선택)"
            className="w-40 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
          <button onClick={handleAdd}
            className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium border border-amber-500/30 hover:bg-amber-500/30 transition whitespace-nowrap">
            + 추가
          </button>
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-xs">로딩 중...</div>
        ) : games.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">등록된 광고 게임이 없습니다</div>
        ) : (
          <div className="space-y-1.5">
            {games.map(g => (
              <div key={g.id} className="flex items-center justify-between bg-dark-800/40 rounded-lg p-3 border border-dark-600/20">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${g.status === 'active' ? 'bg-amber-400' : 'bg-slate-600'}`} />
                  <span className="text-xs font-medium text-white">{g.game_name}</span>
                  {g.advertiser && <span className="text-[10px] text-slate-500">({g.advertiser})</span>}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${g.status === 'active' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-500'}`}>
                    {g.status === 'active' ? '진행중' : '종료'}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => handleToggle(g.id, g.status)}
                    className="px-2 py-0.5 rounded text-[10px] bg-dark-700/60 text-slate-400 hover:text-white transition">
                    {g.status === 'active' ? '종료' : '재개'}
                  </button>
                  <button onClick={() => handleDelete(g.id, g.game_name)}
                    className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400/60 hover:text-red-400 transition">
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel rounded-xl p-4">
        <h4 className="text-xs font-bold text-slate-400 mb-2">광고 감지 방식</h4>
        <div className="text-[10px] text-slate-500 space-y-1">
          <p><span className="text-amber-400 font-bold">1. 수동 관리 (이 페이지):</span> 위 목록에 등록된 게임은 포트폴리오에서 "광고" 뱃지 표시</p>
          <p><span className="text-amber-400 font-bold">2. 자동 감지 (영상 분석):</span> 영상 제목/설명에 [AD], [광고], 협찬, 유료광고, #sponsored 등 키워드 감지</p>
          <p><span className="text-amber-400 font-bold">3. YouTube API:</span> YouTube Data API로 영상 description에서 '유료 프로모션 포함', 'paid promotion' 텍스트 감지</p>
        </div>
      </div>
    </div>
  );
}

//  Main Export
// ═══════════════════════════════════════════════════════════
export default function MarketplaceAdminPage() {
  const [tab, setTab] = useState('stats');

  const tabs = [
    { id: 'stats', label: '통계', icon: BarChart3 },
    { id: 'creators', label: '크리에이터', icon: Users },
    { id: 'campaigns', label: '캠페인', icon: Megaphone },
    { id: 'sponsored', label: '광고 게임', icon: Star },
    { id: 'audit', label: '감사 로그', icon: FileText },
  ];

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-dark-700/60 rounded-xl p-1 border border-dark-600/40 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t.id
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-dark-600/40'
            }`}>
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'stats' && <StatsTab />}
      {tab === 'creators' && <CreatorsTab />}
      {tab === 'campaigns' && <CampaignsTab />}
      {tab === 'sponsored' && <SponsoredTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}
