/**
 * AdminBroadcastsPage — Phase 4 방송 처리 파이프라인 모니터링
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Video, RefreshCw, Filter, Radar, RotateCcw, Trash2, Edit3,
  Play, AlertTriangle, CheckCircle2, XCircle, ExternalLink, Clock,
  FileText, Mic, Save, X
} from 'lucide-react';
import { GlassCard } from '../../components/shared';
import {
  getBroadcasts, getBroadcastDetail, discoverBroadcastsNow,
  retryBroadcast, submitManualTranscript, deleteBroadcast
} from '../../services/admin-automation-api';

const STATE_LABELS = {
  discovered: '발견됨',
  live_detected: 'LIVE 중',
  live_stale: 'LIVE 미응답',
  ended_detected: '종료 감지',
  transcript_fetching: '자막 추출 중',
  audio_downloaded: '오디오 다운로드 완료',
  stt_running: 'STT 실행 중',
  stt_completed: 'STT 완료',
  transcript_fetched: '자막 확보',
  manual_required: '수동 입력 필요',
  report_ready: '리포트 대기',
  report_generated: '리포트 완료',
  delivered: '발송 완료',
  failed: '실패',
};

const STATE_COLORS = {
  discovered: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  live_detected: 'bg-red-500/20 text-red-400 border-red-500/30',
  live_stale: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  ended_detected: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  transcript_fetching: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  audio_downloaded: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  stt_running: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  transcript_fetched: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  manual_required: 'bg-amber-500/30 text-amber-300 border-amber-500/40',
  report_generated: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  delivered: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/30 text-red-300 border-red-500/40',
};

const SOURCE_LABELS = {
  live_tab: '라이브 탭',
  video_tab: '동영상 탭',
  featured: '채널 홈',
  rss: 'RSS',
};

export default function AdminBroadcastsPage() {
  const [data, setData] = useState({ items: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [discoverModal, setDiscoverModal] = useState(false);
  const [discoverInput, setDiscoverInput] = useState({ channelId: '', lookbackHours: 48 });
  const [manualModal, setManualModal] = useState(null); // {videoId}
  const [manualText, setManualText] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit: 100 };
    if (stateFilter) params.state = stateFilter;
    getBroadcasts(params)
      .then(r => setData({ items: r.items || [], counts: r.counts || {} }))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [stateFilter]);

  useEffect(() => { load(); }, [load]);

  const showMsg = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); };

  const handleDiscover = async () => {
    if (!discoverInput.channelId) return alert('channelId 필요');
    try {
      await discoverBroadcastsNow(discoverInput);
      showMsg('디스커버리 잡 등록됨');
      setDiscoverModal(false);
      setTimeout(load, 2000);
    } catch (e) { alert('실패: ' + e.message); }
  };

  const handleRetry = async (videoId) => {
    if (!confirm(`방송 ${videoId} transcript 추출을 재시도합니다. 계속?`)) return;
    try { await retryBroadcast(videoId); showMsg('재시도 등록됨'); load(); }
    catch (e) { alert('실패: ' + e.message); }
  };

  const handleManualSubmit = async () => {
    if (!manualText || manualText.length < 10) return alert('자막이 너무 짧습니다');
    try {
      await submitManualTranscript(manualModal.videoId, manualText);
      showMsg('수동 자막 등록됨');
      setManualModal(null);
      setManualText('');
      load();
    } catch (e) { alert('실패: ' + e.message); }
  };

  const handleDelete = async (videoId) => {
    if (!confirm(`방송 ${videoId} 처리 상태를 영구 삭제합니다. 계속?`)) return;
    try { await deleteBroadcast(videoId); showMsg('삭제됨'); load(); }
    catch (e) { alert('실패: ' + e.message); }
  };

  const counts = data.counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 space-y-5 max-w-[1500px]">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Video size={18} className="text-purple-400" />
          방송 처리 파이프라인
        </h1>
        <div className="flex items-center gap-2">
          {actionMsg && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">{actionMsg}</span>}
          <button onClick={() => setDiscoverModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/25 transition">
            <Radar size={12} /> 디스커버리 실행
          </button>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#1a2035] border border-[#374766]/30 transition">
            <RefreshCw size={12} /> 새로고침
          </button>
        </div>
      </div>

      {/* 상태별 카운트 카드 */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        {[
          { key: '', label: '전체', count: total, color: 'text-white' },
          { key: 'live_detected', label: 'LIVE', count: counts.live_detected || 0, color: 'text-red-400' },
          { key: 'ended_detected', label: '종료', count: counts.ended_detected || 0, color: 'text-amber-400' },
          { key: 'transcript_fetching', label: '추출중', count: counts.transcript_fetching || 0, color: 'text-cyan-400' },
          { key: 'stt_running', label: 'STT중', count: counts.stt_running || 0, color: 'text-purple-400' },
          { key: 'transcript_fetched', label: '자막확보', count: counts.transcript_fetched || 0, color: 'text-emerald-400' },
          { key: 'manual_required', label: '수동필요', count: counts.manual_required || 0, color: 'text-amber-300' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setStateFilter(s.key)}
            className={`p-3 rounded-lg border transition ${stateFilter === s.key ? 'bg-indigo-500/15 border-indigo-500/40' : 'bg-[#0a0e1a]/50 border-[#374766]/20 hover:border-[#374766]/40'}`}
          >
            <div className={`text-xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      {/* 추가 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={12} className="text-slate-500" />
        {['', 'discovered', 'live_detected', 'ended_detected', 'transcript_fetching', 'audio_downloaded', 'stt_running', 'transcript_fetched', 'manual_required', 'report_generated', 'failed'].map(s => (
          <button key={s} onClick={() => setStateFilter(s)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition ${stateFilter === s ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {s === '' ? '전체' : STATE_LABELS[s] || s}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <GlassCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-500 text-xs animate-pulse">로딩 중...</div>
        ) : data.items.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">방송이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase border-b border-[#374766]/30 bg-[#0a0e1a]/30">
                  <th className="text-left py-3 px-3">VideoId</th>
                  <th className="text-left py-3 px-3">제목</th>
                  <th className="text-center py-3 px-3">상태</th>
                  <th className="text-center py-3 px-3">자막</th>
                  <th className="text-center py-3 px-3">소스</th>
                  <th className="text-left py-3 px-3">시작</th>
                  <th className="text-left py-3 px-3">종료</th>
                  <th className="text-center py-3 px-3">시도</th>
                  <th className="text-center py-3 px-3">STT 비용</th>
                  <th className="text-center py-3 px-3">액션</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(b => (
                  <tr key={b.video_id} className="border-b border-[#374766]/10 hover:bg-[#1a2035]/50">
                    <td className="py-2.5 px-3">
                      <a href={`https://www.youtube.com/watch?v=${b.video_id}`} target="_blank" rel="noopener noreferrer"
                        className="text-indigo-400 hover:underline text-[10px] font-mono flex items-center gap-1">
                        {b.video_id?.substring(0, 11)} <ExternalLink size={9} />
                      </a>
                    </td>
                    <td className="py-2.5 px-3 text-white max-w-[280px] truncate" title={b.title}>{b.title || '-'}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${STATE_COLORS[b.state] || ''}`}>
                        {STATE_LABELS[b.state] || b.state}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {b.transcript_id ? (
                        <span className="text-[10px] text-emerald-400" title={`${b.transcript_chars}자, ${b.transcript_source}`}>
                          {b.transcript_source} ({(b.transcript_chars/1000).toFixed(1)}k)
                        </span>
                      ) : <span className="text-[10px] text-slate-600">-</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[9px] text-slate-500">{SOURCE_LABELS[b.discovery_source] || b.discovery_source || '-'}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[10px] whitespace-nowrap">{formatDate(b.actual_start_time)}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-[10px] whitespace-nowrap">{formatDate(b.actual_end_time)}</td>
                    <td className="py-2.5 px-3 text-center text-slate-400 text-[10px]">{b.retry_count}</td>
                    <td className="py-2.5 px-3 text-center text-amber-400 text-[10px]">
                      {b.stt_cost_cents > 0 ? `$${(b.stt_cost_cents/100).toFixed(3)}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        {b.state === 'manual_required' && (
                          <button onClick={() => { setManualModal({ videoId: b.video_id, title: b.title }); setManualText(''); }}
                            className="p-1 rounded hover:bg-amber-500/20 transition" title="수동 자막 입력">
                            <Edit3 size={11} className="text-amber-400" />
                          </button>
                        )}
                        <button onClick={() => handleRetry(b.video_id)} className="p-1 rounded hover:bg-cyan-500/20 transition" title="재시도">
                          <RotateCcw size={11} className="text-cyan-400" />
                        </button>
                        <button onClick={() => handleDelete(b.video_id)} className="p-1 rounded hover:bg-red-500/20 transition" title="영구 삭제">
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

      {/* Discover 모달 */}
      {discoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDiscoverModal(false)}>
          <GlassCard className="p-5 w-[440px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Radar size={14} className="text-cyan-400" /> 방송 디스커버리 실행
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">YouTube 채널 ID</label>
                <input
                  type="text"
                  value={discoverInput.channelId}
                  onChange={e => setDiscoverInput(d => ({ ...d, channelId: e.target.value.trim() }))}
                  placeholder="UCxxxx..."
                  className="w-full px-2.5 py-1.5 rounded bg-[#111827] border border-[#374766]/40 text-xs text-white font-mono focus:outline-none focus:border-indigo-500/60"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">조회 시간 범위 (시간)</label>
                <input
                  type="number"
                  value={discoverInput.lookbackHours}
                  onChange={e => setDiscoverInput(d => ({ ...d, lookbackHours: parseInt(e.target.value) || 48 }))}
                  className="w-full px-2.5 py-1.5 rounded bg-[#111827] border border-[#374766]/40 text-xs text-white focus:outline-none focus:border-indigo-500/60"
                />
                <div className="text-[9px] text-slate-600 mt-1">종료 후 N시간 내 방송만 처리 (기본 48시간)</div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-5 pt-3 border-t border-[#374766]/20">
              <button onClick={handleDiscover} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/25">
                실행
              </button>
              <button onClick={() => setDiscoverModal(false)} className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white border border-[#374766]/30">
                취소
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* 수동 자막 입력 모달 */}
      {manualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setManualModal(null)}>
          <GlassCard className="p-5 w-[700px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <Edit3 size={14} className="text-amber-400" /> 수동 자막 입력
            </h3>
            <p className="text-[10px] text-slate-500 mb-3">
              {manualModal.title} ({manualModal.videoId})
            </p>
            <textarea
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              rows={14}
              placeholder="자막 텍스트를 붙여넣어 주세요..."
              className="w-full px-2.5 py-1.5 rounded bg-[#111827] border border-[#374766]/40 text-xs text-white font-mono focus:outline-none focus:border-indigo-500/60"
            />
            <div className="text-[10px] text-slate-500 mt-2">{manualText.length}자</div>
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#374766]/20">
              <button onClick={handleManualSubmit} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/25">
                <Save size={12} className="inline mr-1" /> 저장 + 리포트 생성
              </button>
              <button onClick={() => setManualModal(null)} className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white border border-[#374766]/30">
                취소
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

function formatDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  if (isNaN(d.getTime())) return '-';
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
