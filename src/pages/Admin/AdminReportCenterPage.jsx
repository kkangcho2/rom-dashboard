/**
 * AdminReportCenterPage — 리포트 센터
 * 기존 verification_reports + 신규 delivery_reports + 이메일 발송 내역 통합 조회
 */
import { useState, useEffect, useCallback } from 'react';
import {
  FileText, RefreshCw, RotateCcw, ChevronDown, ExternalLink, Mail, Eye,
  CheckCircle2, AlertTriangle, Users, Monitor, BarChart3, Trash2
} from 'lucide-react';
import { GlassCard } from '../../components/shared';
import { getReports, getReportDetail, regenerateReport, deleteVerificationReport, deleteDeliveryReport } from '../../services/admin-automation-api';

const STATUS_COLORS = {
  completed: 'bg-emerald-500/20 text-emerald-400',
  success: 'bg-emerald-500/20 text-emerald-400',
  generating: 'bg-cyan-500/20 text-cyan-400',
  pending: 'bg-amber-500/20 text-amber-400',
  failed: 'bg-red-500/20 text-red-400',
};

export default function AdminReportCenterPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getReports({ page, limit: 20 })
      .then(r => setData(r))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setReportDetail(null);
      return;
    }
    setExpandedId(id);
    try {
      const r = await getReportDetail(id);
      setReportDetail(r.report);
    } catch (err) {
      console.error(err);
      setReportDetail(null);
    }
  };

  const openFullDetail = (id) => {
    onNavigate?.('report-detail', { reportId: id });
  };

  const handleRegen = async (campaignId) => {
    await regenerateReport(campaignId);
    setActionMsg('리포트 재생성 등록됨');
    setTimeout(() => setActionMsg(''), 2000);
  };
  const handleDeleteVR = async (id, e) => {
    e.stopPropagation();
    if (!confirm(`검증 리포트 ${id}을(를) 영구 삭제합니다. 계속?`)) return;
    try { await deleteVerificationReport(id); setActionMsg('삭제됨'); load(); }
    catch (err) { alert('삭제 실패: ' + err.message); }
    setTimeout(() => setActionMsg(''), 2000);
  };

  const verificationReports = data?.verificationReports || [];
  const deliveryReports = data?.deliveryReports || [];
  const counts = data?.counts || {};
  const pagination = data?.pagination || {};

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <FileText size={18} className="text-emerald-400" />
          리포트 센터
        </h1>
        <div className="flex items-center gap-2">
          {actionMsg && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">{actionMsg}</span>}
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#1a2035] border border-[#374766]/30 transition">
            <RefreshCw size={12} /> 새로고침
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard className="p-4">
          <div className="text-[10px] text-slate-500 uppercase">검증 리포트</div>
          <div className="text-2xl font-bold text-white mt-1">{counts.verification || 0}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-[10px] text-slate-500 uppercase">배송 리포트</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">{counts.delivery || 0}</div>
        </GlassCard>
        <GlassCard className="p-4 col-span-2">
          <div className="text-[10px] text-slate-500 uppercase mb-1">배송 리포트 (자동화)</div>
          {deliveryReports.length === 0 ? (
            <div className="text-xs text-slate-500">아직 자동화 리포트 없음</div>
          ) : deliveryReports.slice(0, 3).map(dr => (
            <div key={dr.id} className="flex items-center gap-2 py-0.5">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${STATUS_COLORS[dr.status] || ''}`}>{dr.status}</span>
              <span className="text-[10px] text-slate-400 truncate">{dr.campaign_title || dr.campaign_id}</span>
              <span className="text-[10px] text-slate-600 ml-auto">{formatDate(dr.created_at)}</span>
            </div>
          ))}
        </GlassCard>
      </div>

      {/* 검증 리포트 목록 */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-[#374766]/20 bg-[#0a0e1a]/30">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 size={14} className="text-emerald-400" /> 검증 리포트 (verification_reports)
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">캠페인별 크리에이터 성과 분석 리포트</p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-500 text-xs animate-pulse">로딩 중...</div>
        ) : verificationReports.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">검증 리포트가 없습니다</div>
        ) : (
          <div>
            {verificationReports.map(r => {
              const expanded = expandedId === r.id;
              return (
                <div key={r.id} className="border-b border-[#374766]/10">
                  {/* Summary row */}
                  <div
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-[#1a2035]/30 transition"
                    onClick={() => openFullDetail(r.id)}
                  >
                    <FileText size={14} className={r.status === 'generating' ? 'text-emerald-400' : r.status === 'failed' ? 'text-red-400' : 'text-indigo-400'} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white font-medium truncate">{r.campaign_title || r.campaign_id}</span>
                        <span className="text-[10px] text-slate-500">{r.creator_name || ''}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {r.brand_name} {r.target_game ? `· ${r.target_game}` : ''}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLORS[r.status] || 'bg-slate-500/20 text-slate-400'}`}>
                      {r.status}
                    </span>
                    {r.total_stream_minutes > 0 && (
                      <span className="text-[10px] text-slate-400">{r.total_stream_minutes}분</span>
                    )}
                    <span className="text-[10px] text-slate-600">{formatDate(r.created_at)}</span>
                    <button
                      onClick={(e) => handleDeleteVR(r.id, e)}
                      className="p-1 rounded hover:bg-red-500/20 transition"
                      title="리포트 영구 삭제"
                    >
                      <Trash2 size={11} className="text-red-400" />
                    </button>
                    <ChevronDown size={14} className={`text-slate-500 transition ${expanded ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Expanded detail */}
                  {expanded && (
                    <div className="px-5 pb-4 bg-[#0a0e1a]/20">
                      {reportDetail && reportDetail.id === r.id ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          {/* 성과 지표 */}
                          <div>
                            <h4 className="text-[10px] text-slate-500 uppercase mb-2">성과 지표</h4>
                            <div className="space-y-1.5">
                              {[
                                ['총 방송 시간', `${reportDetail.total_stream_minutes || 0}분`],
                                ['배너 노출 시간', `${reportDetail.banner_exposed_minutes || 0}분`],
                                ['노출률', `${((reportDetail.exposure_rate || 0) * 100).toFixed(1)}%`],
                                ['평균 시청자', reportDetail.avg_viewers_during || 0],
                                ['최대 시청자', reportDetail.peak_viewers || 0],
                                ['총 임프레션', (reportDetail.total_impressions || 0).toLocaleString()],
                              ].map(([label, value], i) => (
                                <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-[#111827]/50">
                                  <span className="text-[10px] text-slate-400">{label}</span>
                                  <span className="text-xs font-bold text-white">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* 메타 & 링크 */}
                          <div>
                            <h4 className="text-[10px] text-slate-500 uppercase mb-2">상세 정보</h4>
                            <div className="space-y-1.5 text-[10px]">
                              <div><span className="text-slate-500">캠페인:</span> <span className="text-slate-300 ml-1">{reportDetail.campaign_title}</span></div>
                              <div><span className="text-slate-500">크리에이터:</span> <span className="text-slate-300 ml-1">{reportDetail.creator_name || '-'}</span></div>
                              <div><span className="text-slate-500">기간:</span> <span className="text-slate-300 ml-1">{reportDetail.campaign_start_date?.slice(0,10)} ~ {reportDetail.campaign_end_date?.slice(0,10)}</span></div>
                              <div><span className="text-slate-500">채널:</span> <span className="text-slate-300 ml-1">{reportDetail.youtube_channel_id || reportDetail.chzzk_channel_id || reportDetail.afreeca_channel_id || '-'}</span></div>
                              {reportDetail.pdf_url && (
                                <a href={reportDetail.pdf_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1 mt-1">
                                  <ExternalLink size={10} /> PDF 다운로드
                                </a>
                              )}
                              {reportDetail.web_url && (
                                <a href={reportDetail.web_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1">
                                  <ExternalLink size={10} /> 웹 리포트
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                              <button
                                onClick={() => handleRegen(reportDetail.campaign_id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded text-[10px] text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/20 transition"
                              >
                                <RotateCcw size={10} /> 재생성
                              </button>
                              <button
                                onClick={() => onNavigate?.('campaign-detail', { campaignId: reportDetail.campaign_id })}
                                className="flex items-center gap-1 px-3 py-1.5 rounded text-[10px] text-slate-400 hover:bg-[#1a2035] transition"
                              >
                                캠페인 상세 →
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-slate-500 text-xs animate-pulse">상세 정보 로딩 중...</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Pagination */}
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
