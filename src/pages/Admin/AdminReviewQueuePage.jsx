/**
 * AdminReviewQueuePage — 검수 큐 (핵심 운영 화면)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Eye, CheckCircle2, XCircle, RefreshCw, Filter, ChevronDown, ExternalLink, AlertTriangle
} from 'lucide-react';
import { GlassCard } from '../../components/shared';
import { getReviewQueue, approveReview, rejectReview } from '../../services/admin-automation-api';

export default function AdminReviewQueuePage({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getReviewQueue({ status, page, limit: 20 })
      .then(r => { setItems(r.items); setPagination(r.pagination); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    await approveReview(id);
    setActionMsg('승인 완료');
    setTimeout(() => setActionMsg(''), 2000);
    load();
  };

  const handleReject = async (id) => {
    await rejectReview(id);
    setActionMsg('거절 완료');
    setTimeout(() => setActionMsg(''), 2000);
    load();
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Eye size={18} className="text-amber-400" />
          검수 큐
        </h1>
        <div className="flex items-center gap-2">
          {actionMsg && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">{actionMsg}</span>}
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#1a2035] border border-[#374766]/30 transition">
            <RefreshCw size={12} /> 새로고침
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter size={12} className="text-slate-500" />
        {['pending', 'approved', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition ${status === s ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {s === 'pending' ? '대기중' : s === 'approved' ? '승인됨' : '거절됨'}
          </button>
        ))}
        <span className="text-[10px] text-slate-600 ml-2">총 {pagination.total || 0}건</span>
      </div>

      {/* Items */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-xs animate-pulse">로딩 중...</div>
      ) : items.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500/50" />
          <div className="text-xs text-slate-500">검수 대기 항목이 없습니다</div>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const payload = item.payload || {};
            const expanded = expandedId === item.id;
            const conf = payload.confidence || payload.result?.confidence;

            return (
              <GlassCard key={item.id} className={`p-0 overflow-hidden ${status === 'pending' ? 'border-amber-500/20' : ''}`}>
                {/* Summary Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#1a2035]/30 transition"
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                >
                  <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white font-medium truncate">{item.campaign_title || `캠페인 ${item.campaign_id}`}</span>
                      <span className="text-[10px] text-slate-500">{item.creator_name || ''}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{item.stream_title || item.queue_type}</div>
                  </div>
                  {conf != null && (
                    <span className={`text-xs font-bold ${conf >= 0.7 ? 'text-amber-400' : 'text-orange-400'}`}>
                      {(conf * 100).toFixed(0)}%
                    </span>
                  )}
                  {item.platform && <PlatformBadge platform={item.platform} />}
                  <span className="text-[10px] text-slate-600">{formatDate(item.created_at)}</span>
                  <ChevronDown size={14} className={`text-slate-500 transition ${expanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Expanded Detail */}
                {expanded && (
                  <div className="px-4 pb-4 border-t border-[#374766]/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      {/* Left: 매칭 근거 */}
                      <div>
                        <h4 className="text-[10px] text-slate-500 uppercase mb-2">매칭 근거 점수</h4>
                        {payload.result?.reasons?.map((r, i) => (
                          <div key={i} className="flex items-center gap-2 py-1">
                            <span className={`w-3 h-3 rounded-full ${r.matched ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                            <span className="text-[10px] text-slate-400 flex-1">{r.type}</span>
                            <span className={`text-[10px] font-bold ${r.matched ? 'text-emerald-400' : 'text-slate-600'}`}>
                              {(r.score * 100).toFixed(0)}%
                            </span>
                          </div>
                        )) || <span className="text-[10px] text-slate-500">상세 데이터 없음</span>}
                      </div>

                      {/* Right: 메타데이터 */}
                      <div>
                        <h4 className="text-[10px] text-slate-500 uppercase mb-2">세부 정보</h4>
                        <div className="space-y-1 text-[10px]">
                          <div><span className="text-slate-500">타입:</span> <span className="text-slate-300 ml-1">{item.queue_type}</span></div>
                          <div><span className="text-slate-500">캠페인:</span> <span className="text-slate-300 ml-1">{item.campaign_title}</span></div>
                          <div><span className="text-slate-500">크리에이터:</span> <span className="text-slate-300 ml-1">{item.creator_name || '-'}</span></div>
                          <div><span className="text-slate-500">방송:</span> <span className="text-slate-300 ml-1">{item.stream_title || '-'}</span></div>
                          {item.stream_url && (
                            <a href={item.stream_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1">
                              <ExternalLink size={9} /> 방송 링크
                            </a>
                          )}
                          <div><span className="text-slate-500">사유:</span> <span className="text-amber-300 ml-1">{payload.reason || '-'}</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {status === 'pending' && (
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#374766]/20">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApprove(item.id); }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/25 transition"
                        >
                          <CheckCircle2 size={13} /> 승인
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReject(item.id); }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/25 transition"
                        >
                          <XCircle size={13} /> 제외
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onNavigate?.('campaign-detail', { campaignId: item.campaign_id }); }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#1a2035] transition ml-auto"
                        >
                          캠페인 상세 →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p} onClick={() => setPage(p)}
              className={`w-7 h-7 rounded text-[10px] font-bold transition ${p === page ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500 hover:text-white'}`}
            >{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function PlatformBadge({ platform }) {
  const colors = { youtube: 'bg-red-500/20 text-red-400', chzzk: 'bg-green-500/20 text-green-400', afreeca: 'bg-blue-500/20 text-blue-400' };
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${colors[platform] || 'bg-slate-500/20 text-slate-400'}`}>{platform}</span>;
}

function formatDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
