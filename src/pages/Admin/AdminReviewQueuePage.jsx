/**
 * AdminReviewQueuePage — 검수 큐 (핵심 운영 화면)
 * 매칭 근거 breakdown + transcript/chat 샘플 + 키워드 하이라이트
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Eye, CheckCircle2, XCircle, RefreshCw, Filter, ChevronDown, ExternalLink, AlertTriangle,
  Video, Users, MessageCircle, FileText, ImageIcon, Star, Award, Hash, Trash2
} from 'lucide-react';
import { GlassCard } from '../../components/shared';
import { getReviewQueue, getReviewDetail, approveReview, rejectReview, deleteReview } from '../../services/admin-automation-api';

const PLATFORM_COLORS = {
  youtube: 'bg-red-500/20 text-red-400',
  chzzk: 'bg-green-500/20 text-green-400',
  afreeca: 'bg-blue-500/20 text-blue-400',
};

const SIGNAL_LABELS = {
  channel_match: '채널 일치',
  date_window: '방송 기간',
  target_game_title_match: '제목 게임명',
  detected_game_match: '게임 탐지',
  sponsor_pattern: '광고 패턴',
  banner_detected: '배너 검출',
  transcript_target_mention: '자막 언급',
  chat_target_mention: '채팅 언급',
};

export default function AdminReviewQueuePage({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getReviewQueue({ status, page, limit: 20 })
      .then(r => { setItems(r.items); setPagination(r.pagination); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  const handleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    try {
      const d = await getReviewDetail(id);
      setDetail(d);
    } catch (err) {
      console.error(err);
    }
    setDetailLoading(false);
  };

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

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm(`검수 항목 #${id}을(를) 영구 삭제합니다. 계속?`)) return;
    try { await deleteReview(id); setActionMsg('삭제됨'); load(); }
    catch (err) { alert('삭제 실패: ' + err.message); }
    setTimeout(() => setActionMsg(''), 2000);
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
                  onClick={() => handleExpand(item.id)}
                >
                  <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white font-medium truncate">{item.campaign_title || `캠페인 ${item.campaign_id?.slice(0,8)}`}</span>
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
                  <button onClick={(e) => handleDelete(item.id, e)} className="p-1 rounded hover:bg-red-500/20 transition" title="영구 삭제">
                    <Trash2 size={11} className="text-red-400" />
                  </button>
                  <ChevronDown size={14} className={`text-slate-500 transition ${expanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Expanded Detail */}
                {expanded && (
                  <div className="border-t border-[#374766]/20 bg-[#0a0e1a]/50">
                    {detailLoading ? (
                      <div className="p-6 text-center text-slate-500 text-xs animate-pulse">상세 데이터 로딩 중...</div>
                    ) : detail && detail.item.id === item.id ? (
                      <ReviewDetailView
                        detail={detail}
                        campaign={item}
                        onApprove={() => handleApprove(item.id)}
                        onReject={() => handleReject(item.id)}
                        onNavigate={onNavigate}
                        canAct={status === 'pending'}
                      />
                    ) : null}
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

// ─── Review Detail View ────────────────────────────────────────
function ReviewDetailView({ detail, campaign, onApprove, onReject, onNavigate, canAct }) {
  const { campaign: campData, campaignCreator, session, video, transcript, chatSample, bannerVerification, match } = detail;
  const targetGame = campData?.target_game || '';
  const brandName = campData?.brand_name || '';

  // Keywords for highlighting
  const keywords = [targetGame, brandName].filter(k => k && k.length > 0);

  return (
    <div className="p-5 space-y-4">
      {/* Top: 컨텍스트 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Campaign */}
        <div className="bg-[#111827]/60 rounded-lg p-3 border border-[#374766]/20">
          <div className="text-[10px] text-slate-500 uppercase mb-2 flex items-center gap-1">
            <Award size={10} /> 캠페인
          </div>
          <div className="text-xs text-white font-medium">{campData?.title || '-'}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            <div>브랜드: {brandName || '-'}</div>
            <div>타겟 게임: <span className="text-amber-300">{targetGame || '-'}</span></div>
            <div>기간: {campData?.campaign_start_date?.slice(0,10) || '?'} ~ {campData?.campaign_end_date?.slice(0,10) || '?'}</div>
          </div>
        </div>

        {/* Creator */}
        <div className="bg-[#111827]/60 rounded-lg p-3 border border-[#374766]/20">
          <div className="text-[10px] text-slate-500 uppercase mb-2 flex items-center gap-1">
            <Users size={10} /> 크리에이터
          </div>
          <div className="flex items-center gap-2">
            {campaignCreator?.thumbnail_url && (
              <img src={campaignCreator.thumbnail_url} className="w-8 h-8 rounded-full" alt="" />
            )}
            <div>
              <div className="text-xs text-white font-medium">{campaignCreator?.display_name || '-'}</div>
              <div className="text-[9px] text-slate-500">
                {session?.platform === 'youtube' ? campaignCreator?.youtube_channel_id : ''}
                {session?.platform === 'chzzk' ? campaignCreator?.chzzk_channel_id : ''}
                {session?.platform === 'afreeca' ? campaignCreator?.afreeca_channel_id : ''}
              </div>
            </div>
          </div>
          {campaignCreator?.broadcast_url && (
            <a href={campaignCreator.broadcast_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 mt-1">
              <ExternalLink size={8} /> 고정 방송 URL
            </a>
          )}
        </div>

        {/* Stream / Video */}
        <div className="bg-[#111827]/60 rounded-lg p-3 border border-[#374766]/20">
          <div className="text-[10px] text-slate-500 uppercase mb-2 flex items-center gap-1">
            <Video size={10} /> 방송
          </div>
          <div className="text-xs text-white font-medium line-clamp-2 mb-1">{session?.title || video?.title || '-'}</div>
          <div className="text-[10px] text-slate-400 space-y-0.5">
            {session?.platform && <div>플랫폼: <span className="text-slate-300">{session.platform}</span></div>}
            {session?.started_at && <div>시작: {formatDate(session.started_at)}</div>}
            {video?.views != null && <div>조회수: {video.views.toLocaleString()}</div>}
            {session?.stream_url && (
              <a href={session.stream_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1">
                <ExternalLink size={8} /> 방송 링크
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 매칭 근거 Breakdown */}
      {match?.reasons && match.reasons.length > 0 && (
        <div className="bg-[#111827]/60 rounded-lg p-4 border border-[#374766]/20">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <Hash size={12} className="text-indigo-400" /> 매칭 근거 Breakdown
            </div>
            <div className="text-right">
              <div className="text-[9px] text-slate-500 uppercase">confidence</div>
              <div className={`text-lg font-bold ${match.confidence >= 0.8 ? 'text-emerald-400' : match.confidence >= 0.5 ? 'text-amber-400' : 'text-red-400'}`}>
                {(match.confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            {match.reasons.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${r.matched ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                <span className="text-[10px] text-slate-400 w-24 shrink-0">{SIGNAL_LABELS[r.type] || r.type}</span>
                <div className="flex-1 h-1.5 bg-[#0a0e1a] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${r.matched ? 'bg-emerald-500' : 'bg-slate-700'}`}
                    style={{ width: `${Math.max(r.score * 400, r.matched ? 5 : 0)}%` }}
                  />
                </div>
                <span className={`text-[10px] font-bold w-12 text-right ${r.matched ? 'text-emerald-400' : 'text-slate-600'}`}>
                  +{(r.score * 100).toFixed(0)}
                </span>
                <span className="text-[9px] text-slate-500 flex-1 truncate max-w-[300px]">{r.detail}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-[#374766]/20 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">임계값: matched ≥ 80% | review 50~80% | rejected &lt; 50%</span>
            <span className="text-slate-400">total: {match.reasons.reduce((s, r) => s + r.score, 0).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* 배너 검증 + Transcript + Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Banner */}
        <div className="bg-[#111827]/60 rounded-lg p-3 border border-[#374766]/20">
          <div className="text-[10px] text-slate-500 uppercase mb-2 flex items-center gap-1">
            <ImageIcon size={10} /> 배너 검증
          </div>
          {bannerVerification ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                {bannerVerification.banner_detected ? (
                  <>
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span className="text-xs text-emerald-400 font-bold">검출됨</span>
                  </>
                ) : (
                  <>
                    <XCircle size={12} className="text-red-400" />
                    <span className="text-xs text-red-400 font-bold">미검출</span>
                  </>
                )}
                <span className="text-[10px] text-slate-400 ml-auto">
                  {(bannerVerification.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="text-[10px] text-slate-500">방식: {bannerVerification.detection_method}</div>
              <div className="text-[10px] text-slate-500">{formatDate(bannerVerification.checked_at)}</div>
            </div>
          ) : (
            <div className="text-[10px] text-slate-500">배너 검증 기록 없음</div>
          )}
        </div>

        {/* Transcript */}
        <div className="bg-[#111827]/60 rounded-lg p-3 border border-[#374766]/20">
          <div className="text-[10px] text-slate-500 uppercase mb-2 flex items-center gap-1">
            <FileText size={10} /> 자막 샘플
          </div>
          {transcript ? (
            <div className="max-h-40 overflow-y-auto text-[10px] leading-relaxed text-slate-300 whitespace-pre-wrap">
              {highlightKeywords(transcript.slice(0, 800), keywords)}
              {transcript.length > 800 && <span className="text-slate-600">... (계속)</span>}
            </div>
          ) : (
            <div className="text-[10px] text-slate-500">자막 데이터 없음</div>
          )}
        </div>

        {/* Chat */}
        <div className="bg-[#111827]/60 rounded-lg p-3 border border-[#374766]/20">
          <div className="text-[10px] text-slate-500 uppercase mb-2 flex items-center gap-1">
            <MessageCircle size={10} /> 채팅 샘플 ({chatSample.length}개)
          </div>
          {chatSample.length > 0 ? (
            <div className="max-h-40 overflow-y-auto text-[10px] space-y-0.5">
              {chatSample.slice(0, 30).map((c, i) => (
                <div key={i} className="flex gap-1.5">
                  <span className="text-slate-600 shrink-0">{c.username?.slice(0, 8) || '익명'}:</span>
                  <span className="text-slate-300 truncate">{highlightKeywords(c.message, keywords)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-slate-500">채팅 데이터 없음</div>
          )}
        </div>
      </div>

      {/* Actions */}
      {canAct && (
        <div className="flex items-center gap-2 pt-3 border-t border-[#374766]/20">
          <button
            onClick={(e) => { e.stopPropagation(); onApprove(); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/25 transition"
          >
            <CheckCircle2 size={13} /> 승인 (캠페인 방송 인정)
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onReject(); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/25 transition"
          >
            <XCircle size={13} /> 제외
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate?.('campaign-detail', { campaignId: campaign.campaign_id }); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#1a2035] transition ml-auto"
          >
            캠페인 상세 →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Keyword highlight helper ───────────────────────────────────
function highlightKeywords(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return text;

  // Build regex with all keywords (case-insensitive)
  const pattern = new RegExp(
    `(${keywords.filter(k => k).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  );
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    if (i % 2 === 1) {
      // Matched keyword
      return <mark key={i} className="bg-amber-500/30 text-amber-300 px-0.5 rounded">{part}</mark>;
    }
    return <span key={i}>{part}</span>;
  });
}

function PlatformBadge({ platform }) {
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${PLATFORM_COLORS[platform] || 'bg-slate-500/20 text-slate-400'}`}>{platform}</span>;
}

function formatDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
