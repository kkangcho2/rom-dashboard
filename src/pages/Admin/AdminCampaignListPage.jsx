/**
 * AdminCampaignListPage — 캠페인 목록 (자동화 관점)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Megaphone, Search, Filter, Users, Monitor, FileText, Mail, Eye, RefreshCw
} from 'lucide-react';
import { GlassCard } from '../../components/shared';
import { getCampaigns } from '../../services/admin-automation-api';

const STATE_LABELS = {
  draft: '작성중', published: '공개', matching: '매칭중', negotiating: '협의중',
  accepted: '수락', confirmed: '확정', live: 'LIVE', completed: '완료',
  verified: '검증완료', closed: '종료',
};
const STATE_COLORS = {
  draft: 'bg-slate-500/20 text-slate-400', published: 'bg-blue-500/20 text-blue-400',
  matching: 'bg-amber-500/20 text-amber-400', negotiating: 'bg-orange-500/20 text-orange-400',
  accepted: 'bg-cyan-500/20 text-cyan-400', confirmed: 'bg-indigo-500/20 text-indigo-400',
  live: 'bg-red-500/20 text-red-400', completed: 'bg-emerald-500/20 text-emerald-400',
  verified: 'bg-green-500/20 text-green-400', closed: 'bg-slate-500/20 text-slate-500',
};

export default function AdminCampaignListPage({ onNavigate }) {
  const [campaigns, setCampaigns] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 20 };
    if (stateFilter) params.state = stateFilter;
    getCampaigns(params)
      .then(r => { setCampaigns(r.campaigns); setPagination(r.pagination); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [page, stateFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Megaphone size={18} className="text-indigo-400" />
          캠페인 관리
        </h1>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#1a2035] border border-[#374766]/30 transition">
          <RefreshCw size={12} /> 새로고침
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={12} className="text-slate-500" />
        <button
          onClick={() => { setStateFilter(''); setPage(1); }}
          className={`px-2.5 py-1 rounded text-[10px] font-medium transition ${!stateFilter ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25' : 'text-slate-500 hover:text-slate-300'}`}
        >
          전체
        </button>
        {['confirmed', 'live', 'completed', 'verified'].map(s => (
          <button
            key={s}
            onClick={() => { setStateFilter(s); setPage(1); }}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition ${stateFilter === s ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {STATE_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <GlassCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-500 text-xs animate-pulse">로딩 중...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">캠페인이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase border-b border-[#374766]/30 bg-[#0a0e1a]/30">
                  <th className="text-left py-3 px-4">캠페인</th>
                  <th className="text-left py-3 px-3">상태</th>
                  <th className="text-left py-3 px-3">타겟 게임</th>
                  <th className="text-center py-3 px-3">크리에이터</th>
                  <th className="text-center py-3 px-3">감지 방송</th>
                  <th className="text-center py-3 px-3">매칭</th>
                  <th className="text-center py-3 px-3">리포트</th>
                  <th className="text-center py-3 px-3">발송</th>
                  <th className="text-center py-3 px-3">검수</th>
                  <th className="text-left py-3 px-3">기간</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => onNavigate?.('campaign-detail', { campaignId: c.id })}
                    className="border-b border-[#374766]/10 hover:bg-[#1a2035]/50 cursor-pointer transition"
                  >
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{c.title}</div>
                      <div className="text-[10px] text-slate-500">{c.advertiser_name || c.brand_name}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATE_COLORS[c.state] || 'bg-slate-500/20 text-slate-400'}`}>
                        {STATE_LABELS[c.state] || c.state}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">{c.target_game || '-'}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-slate-300 flex items-center justify-center gap-1">
                        <Users size={11} /> {c.creator_count}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-cyan-400">{c.stream_count}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-emerald-400">{c.matched_count}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-slate-400">{c.report_count}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-slate-400">{c.emails_sent}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {c.review_pending > 0 && (
                        <span className="text-amber-400 font-bold">{c.review_pending}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[10px] whitespace-nowrap">
                      {c.campaign_start_date?.slice(0,10) || '?'} ~ {c.campaign_end_date?.slice(0,10) || '?'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-7 h-7 rounded text-[10px] font-bold transition ${p === page ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25' : 'text-slate-500 hover:text-white'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
