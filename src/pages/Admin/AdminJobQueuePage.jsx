/**
 * AdminJobQueuePage — 작업 큐 관리
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Server, RefreshCw, Filter, Play, XCircle, RotateCcw, Clock, Trash2
} from 'lucide-react';
import { GlassCard } from '../../components/shared';
import { getJobs, retryJob, cancelJob, deleteJob, bulkDeleteJobs } from '../../services/admin-automation-api';

const JOB_TYPE_LABELS = {
  monitor_campaign: '캠페인 모니터',
  sync_campaign_streams: '스트림 동기화',
  match_campaign_broadcast: '방송 매칭',
  generate_campaign_report: '리포트 생성',
  send_campaign_email: '이메일 발송',
};
const STATUS_COLORS = {
  pending: 'bg-amber-500/20 text-amber-400',
  running: 'bg-cyan-500/20 text-cyan-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400',
};

export default function AdminJobQueuePage() {
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 30 };
    if (statusFilter) params.status = statusFilter;
    getJobs(params)
      .then(r => { setJobs(r.jobs); setPagination(r.pagination); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const showAction = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 2000); };

  const handleRetry = async (id) => {
    await retryJob(id); showAction('재시도 등록됨'); load();
  };
  const handleCancel = async (id) => {
    await cancelJob(id); showAction('취소됨'); load();
  };
  const handleDelete = async (id) => {
    if (!confirm(`잡 #${id}을(를) 완전히 삭제합니다. 이 동작은 되돌릴 수 없습니다. 계속하시겠습니까?`)) return;
    await deleteJob(id); showAction('삭제됨'); load();
  };
  const handleBulkDeleteFailed = async () => {
    if (!confirm('실패한 모든 잡을 영구 삭제합니다. 계속?')) return;
    const r = await bulkDeleteJobs({ status: 'failed' });
    showAction(`${r.deleted}건 삭제됨`); load();
  };
  const handleBulkDeleteCompleted = async () => {
    if (!confirm('완료된 모든 잡을 영구 삭제합니다. 큐 정리용. 계속?')) return;
    const r = await bulkDeleteJobs({ status: 'completed' });
    showAction(`${r.deleted}건 삭제됨`); load();
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Server size={18} className="text-indigo-400" />
          작업 큐 관리
        </h1>
        <div className="flex items-center gap-2">
          {actionMsg && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">{actionMsg}</span>}
          <button onClick={handleBulkDeleteCompleted}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-[#374766]/30 transition"
            title="완료된 잡 정리">
            <Trash2 size={12} /> 완료 정리
          </button>
          <button onClick={handleBulkDeleteFailed}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/25 transition"
            title="실패한 잡 모두 삭제">
            <Trash2 size={12} /> 실패 일괄 삭제
          </button>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#1a2035] border border-[#374766]/30 transition">
            <RefreshCw size={12} /> 새로고침
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter size={12} className="text-slate-500" />
        {['', 'pending', 'running', 'completed', 'failed'].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition ${statusFilter === s ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {s === '' ? '전체' : s === 'pending' ? '대기' : s === 'running' ? '실행중' : s === 'completed' ? '완료' : '실패'}
          </button>
        ))}
        <span className="text-[10px] text-slate-600 ml-2">총 {pagination.total || 0}건</span>
      </div>

      {/* Table */}
      <GlassCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-500 text-xs animate-pulse">로딩 중...</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">작업이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase border-b border-[#374766]/30 bg-[#0a0e1a]/30">
                  <th className="text-left py-3 px-3">ID</th>
                  <th className="text-left py-3 px-3">타입</th>
                  <th className="text-left py-3 px-3">상태</th>
                  <th className="text-center py-3 px-3">우선순위</th>
                  <th className="text-center py-3 px-3">시도</th>
                  <th className="text-left py-3 px-3">실행 예정</th>
                  <th className="text-left py-3 px-3">잠금</th>
                  <th className="text-left py-3 px-3">생성일</th>
                  <th className="text-left py-3 px-3">캠페인</th>
                  <th className="text-center py-3 px-3">액션</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id} className="border-b border-[#374766]/10 hover:bg-[#1a2035]/50">
                    <td className="py-2.5 px-3 text-slate-400">#{j.id}</td>
                    <td className="py-2.5 px-3 text-white">{JOB_TYPE_LABELS[j.job_type] || j.job_type}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLORS[j.status] || ''}`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-400">{j.priority}</td>
                    <td className="py-2.5 px-3 text-center text-slate-400">{j.attempts}/{j.max_attempts}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-[10px]">{formatDate(j.run_at)}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-[10px]">{j.locked_by || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-[10px]">{formatDate(j.created_at)}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-[10px]">{j.payload?.campaignId?.slice(0, 8) || '-'}</td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        {(j.status === 'failed' || j.status === 'pending') && (
                          <button onClick={() => handleRetry(j.id)} className="p-1 rounded hover:bg-cyan-500/20 transition" title="재시도">
                            <RotateCcw size={12} className="text-cyan-400" />
                          </button>
                        )}
                        {j.status === 'pending' && (
                          <button onClick={() => handleCancel(j.id)} className="p-1 rounded hover:bg-amber-500/20 transition" title="취소 (failed로 마크)">
                            <XCircle size={12} className="text-amber-400" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(j.id)} className="p-1 rounded hover:bg-red-500/20 transition" title="영구 삭제">
                          <Trash2 size={12} className="text-red-400" />
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
