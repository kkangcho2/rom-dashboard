/**
 * AdminStreamMonitorPage — 방송 모니터링 전체 현황
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Monitor, RefreshCw, Filter, CheckCircle2, XCircle, RotateCcw, ExternalLink, Eye, Trash2
} from 'lucide-react';
import { GlassCard } from '../../components/shared';
import { getStreams, forceMatchStream, excludeStream, rematchStream, deleteStream } from '../../services/admin-automation-api';

const MATCH_COLORS = {
  matched: 'bg-emerald-500/20 text-emerald-400',
  needs_review: 'bg-amber-500/20 text-amber-400',
  rejected: 'bg-red-500/20 text-red-400',
};
const PLATFORM_COLORS = {
  youtube: 'bg-red-500/20 text-red-400',
  chzzk: 'bg-green-500/20 text-green-400',
  afreeca: 'bg-blue-500/20 text-blue-400',
};

export default function AdminStreamMonitorPage({ onNavigate }) {
  const [streams, setStreams] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('');
  const [matchStatus, setMatchStatus] = useState('');
  const [page, setPage] = useState(1);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 20 };
    if (platform) params.platform = platform;
    if (matchStatus) params.match_status = matchStatus;
    getStreams(params)
      .then(r => { setStreams(r.streams); setPagination(r.pagination); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [page, platform, matchStatus]);

  useEffect(() => { load(); }, [load]);

  const showAction = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 2000); };

  const handleForce = async (id) => { await forceMatchStream(id); showAction('강제 매칭'); load(); };
  const handleExclude = async (id) => { await excludeStream(id); showAction('제외 완료'); load(); };
  const handleRematch = async (id) => { await rematchStream(id); showAction('재매칭 등록'); load(); };
  const handleDelete = async (id) => {
    if (!confirm(`스트림 세션 #${id}을(를) 영구 삭제합니다. 매칭 결과도 함께 삭제됩니다. 계속?`)) return;
    try { await deleteStream(id); showAction('삭제됨'); load(); }
    catch (e) { alert('삭제 실패: ' + e.message); }
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Monitor size={18} className="text-cyan-400" />
          방송 모니터링
        </h1>
        <div className="flex items-center gap-2">
          {actionMsg && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">{actionMsg}</span>}
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#1a2035] border border-[#374766]/30 transition">
            <RefreshCw size={12} /> 새로고침
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">플랫폼:</span>
          {['', 'youtube', 'chzzk', 'afreeca'].map(p => (
            <button key={p} onClick={() => { setPlatform(p); setPage(1); }}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition ${platform === p ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25' : 'text-slate-500 hover:text-slate-300'}`}
            >{p || '전체'}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">매칭:</span>
          {['', 'matched', 'needs_review', 'rejected'].map(s => (
            <button key={s} onClick={() => { setMatchStatus(s); setPage(1); }}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition ${matchStatus === s ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25' : 'text-slate-500 hover:text-slate-300'}`}
            >{s === '' ? '전체' : s === 'matched' ? '매칭' : s === 'needs_review' ? '검수필요' : '거절'}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <GlassCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-500 text-xs animate-pulse">로딩 중...</div>
        ) : streams.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">감지된 방송이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase border-b border-[#374766]/30 bg-[#0a0e1a]/30">
                  <th className="text-left py-3 px-3">감지일</th>
                  <th className="text-left py-3 px-3">캠페인</th>
                  <th className="text-left py-3 px-3">크리에이터</th>
                  <th className="text-left py-3 px-3">플랫폼</th>
                  <th className="text-left py-3 px-3">방송 제목</th>
                  <th className="text-center py-3 px-3">live/vod</th>
                  <th className="text-center py-3 px-3">매칭</th>
                  <th className="text-center py-3 px-3">점수</th>
                  <th className="text-center py-3 px-3">배너</th>
                  <th className="text-center py-3 px-3">검수</th>
                  <th className="text-center py-3 px-3">액션</th>
                </tr>
              </thead>
              <tbody>
                {streams.map(s => (
                  <tr key={s.id} className="border-b border-[#374766]/10 hover:bg-[#1a2035]/50">
                    <td className="py-2.5 px-3 text-slate-500 text-[10px] whitespace-nowrap">{formatDate(s.discovered_at)}</td>
                    <td className="py-2.5 px-3">
                      <button onClick={() => onNavigate?.('campaign-detail', { campaignId: s.campaign_id })}
                        className="text-indigo-400 hover:underline text-left truncate max-w-[120px] block">
                        {s.campaign_title || s.campaign_id?.slice(0,8)}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{s.creator_name || '-'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${PLATFORM_COLORS[s.platform] || ''}`}>
                        {s.platform}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-white max-w-[180px] truncate">
                      {s.stream_url ? (
                        <a href={s.stream_url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-300">
                          {s.title || '(제목없음)'}
                        </a>
                      ) : (s.title || '-')}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-[10px] ${s.live_status === 'live' ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                        {s.live_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {s.match_status && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${MATCH_COLORS[s.match_status] || 'bg-slate-500/20 text-slate-400'}`}>
                          {s.match_status === 'matched' ? '매칭' : s.match_status === 'needs_review' ? '검수' : '거절'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {s.match_confidence != null && (
                        <span className={`font-bold text-[10px] ${s.match_confidence >= 0.8 ? 'text-emerald-400' : s.match_confidence >= 0.5 ? 'text-amber-400' : 'text-red-400'}`}>
                          {(s.match_confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-400">{s.banner_count > 0 ? `${s.banner_count}건` : '-'}</td>
                    <td className="py-2.5 px-3 text-center">
                      {s.review_required ? <Eye size={12} className="text-amber-400 mx-auto" /> : null}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <button onClick={() => handleForce(s.id)} className="p-1 rounded hover:bg-emerald-500/20 transition" title="강제 매칭">
                          <CheckCircle2 size={11} className="text-emerald-400" />
                        </button>
                        <button onClick={() => handleExclude(s.id)} className="p-1 rounded hover:bg-red-500/20 transition" title="제외">
                          <XCircle size={11} className="text-red-400" />
                        </button>
                        <button onClick={() => handleRematch(s.id)} className="p-1 rounded hover:bg-cyan-500/20 transition" title="재분석">
                          <RotateCcw size={11} className="text-cyan-400" />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-1 rounded hover:bg-red-500/20 transition" title="영구 삭제">
                          <Trash2 size={11} className="text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-7 h-7 rounded text-[10px] font-bold transition ${p === page ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500 hover:text-white'}`}
            >{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
