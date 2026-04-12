/**
 * AdminReportCenterPage — 리포트 센터
 */
import { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, RotateCcw } from 'lucide-react';
import { GlassCard } from '../../components/shared';
import { getReports, regenerateReport } from '../../services/admin-automation-api';

const STATUS_COLORS = {
  completed: 'bg-emerald-500/20 text-emerald-400',
  generating: 'bg-cyan-500/20 text-cyan-400',
  pending: 'bg-amber-500/20 text-amber-400',
  failed: 'bg-red-500/20 text-red-400',
};

export default function AdminReportCenterPage({ onNavigate }) {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getReports({ page, limit: 20 })
      .then(r => { setReports(r.reports); setPagination(r.pagination); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleRegen = async (campaignId) => {
    await regenerateReport(campaignId);
    setActionMsg('리포트 재생성 등록됨');
    setTimeout(() => setActionMsg(''), 2000);
  };

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

      <GlassCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-500 text-xs animate-pulse">로딩 중...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">리포트가 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase border-b border-[#374766]/30 bg-[#0a0e1a]/30">
                  <th className="text-left py-3 px-4">ID</th>
                  <th className="text-left py-3 px-3">캠페인</th>
                  <th className="text-left py-3 px-3">브랜드</th>
                  <th className="text-left py-3 px-3">타겟 게임</th>
                  <th className="text-center py-3 px-3">상태</th>
                  <th className="text-left py-3 px-3">생성일</th>
                  <th className="text-center py-3 px-3">액션</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id} className="border-b border-[#374766]/10 hover:bg-[#1a2035]/50">
                    <td className="py-3 px-4 text-slate-400">#{r.id}</td>
                    <td className="py-3 px-3">
                      <button onClick={() => onNavigate?.('campaign-detail', { campaignId: r.campaign_id })}
                        className="text-indigo-400 hover:underline truncate max-w-[200px] block text-left">
                        {r.campaign_title || r.campaign_id}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-slate-400">{r.brand_name || '-'}</td>
                    <td className="py-3 px-3 text-slate-400">{r.target_game || '-'}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLORS[r.status] || ''}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[10px]">{formatDate(r.created_at)}</td>
                    <td className="py-3 px-3 text-center">
                      <button onClick={() => handleRegen(r.campaign_id)} className="p-1 rounded hover:bg-cyan-500/20 transition" title="재생성">
                        <RotateCcw size={12} className="text-cyan-400" />
                      </button>
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
