/**
 * AdminEmailDeliveryPage — 이메일 발송 관리
 */
import { useState, useEffect, useCallback } from 'react';
import { Mail, RefreshCw, RotateCcw } from 'lucide-react';
import { GlassCard } from '../../components/shared';
import { getEmails, resendEmail } from '../../services/admin-automation-api';

const STATUS_COLORS = {
  sent: 'bg-emerald-500/20 text-emerald-400',
  pending: 'bg-amber-500/20 text-amber-400',
  failed: 'bg-red-500/20 text-red-400',
};

export default function AdminEmailDeliveryPage() {
  const [emails, setEmails] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getEmails({ page, limit: 20 })
      .then(r => { setEmails(r.emails); setPagination(r.pagination); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleResend = async (campaignId) => {
    await resendEmail(campaignId);
    setActionMsg('재발송 등록됨');
    setTimeout(() => setActionMsg(''), 2000);
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Mail size={18} className="text-amber-400" />
          이메일 발송 관리
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
        ) : emails.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">발송 기록이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase border-b border-[#374766]/30 bg-[#0a0e1a]/30">
                  <th className="text-left py-3 px-4">ID</th>
                  <th className="text-left py-3 px-3">캠페인</th>
                  <th className="text-left py-3 px-3">수신자</th>
                  <th className="text-left py-3 px-3">제목</th>
                  <th className="text-center py-3 px-3">상태</th>
                  <th className="text-center py-3 px-3">시도</th>
                  <th className="text-left py-3 px-3">발송일</th>
                  <th className="text-left py-3 px-3">오류</th>
                  <th className="text-center py-3 px-3">액션</th>
                </tr>
              </thead>
              <tbody>
                {emails.map(e => (
                  <tr key={e.id} className="border-b border-[#374766]/10 hover:bg-[#1a2035]/50">
                    <td className="py-3 px-4 text-slate-400">#{e.id}</td>
                    <td className="py-3 px-3 text-indigo-400 truncate max-w-[120px]">{e.campaign_title || e.campaign_id?.slice(0,8) || '-'}</td>
                    <td className="py-3 px-3 text-slate-300">{e.recipient_email}</td>
                    <td className="py-3 px-3 text-slate-400 truncate max-w-[200px]">{e.subject || '-'}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLORS[e.status] || ''}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-400">{e.attempts}</td>
                    <td className="py-3 px-3 text-slate-500 text-[10px]">{formatDate(e.sent_at || e.created_at)}</td>
                    <td className="py-3 px-3 text-red-400 text-[10px] truncate max-w-[150px]">{e.error_message || '-'}</td>
                    <td className="py-3 px-3 text-center">
                      {e.status === 'failed' && e.campaign_id && (
                        <button onClick={() => handleResend(e.campaign_id)} className="p-1 rounded hover:bg-cyan-500/20 transition" title="재발송">
                          <RotateCcw size={12} className="text-cyan-400" />
                        </button>
                      )}
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
