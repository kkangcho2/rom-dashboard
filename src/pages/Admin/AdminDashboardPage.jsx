/**
 * AdminDashboardPage — 캠페인 자동 운영 관제실 (운영 상태판)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Mail, MailX,
  Monitor, FileText, Megaphone, Eye, RefreshCw, Zap, Server
} from 'lucide-react';
import { GlassCard } from '../../components/shared';
import { getDashboard } from '../../services/admin-automation-api';

const JOB_TYPE_LABELS = {
  monitor_campaign: '캠페인 모니터',
  sync_campaign_streams: '스트림 동기화',
  match_campaign_broadcast: '방송 매칭',
  generate_campaign_report: '리포트 생성',
  send_campaign_email: '이메일 발송',
};

const STATE_LABELS = {
  draft: '작성중', published: '공개', matching: '매칭중', negotiating: '협의중',
  accepted: '수락', confirmed: '확정', live: 'LIVE', completed: '완료',
  verified: '검증완료', closed: '종료',
};
const STATE_COLORS = {
  draft: 'text-slate-400', published: 'text-blue-400', matching: 'text-amber-400',
  confirmed: 'text-cyan-400', live: 'text-red-400', completed: 'text-emerald-400',
  verified: 'text-green-400', closed: 'text-slate-500',
};

export default function AdminDashboardPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getDashboard()
      .then(r => setData(r.data))
      .catch(err => console.error('Dashboard load error:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return <div className="p-6 text-center text-slate-500 text-xs animate-pulse">운영 현황 로딩 중...</div>;
  }
  if (!data) return null;

  const { kpi, queueStats, recentFailedJobs, recentCampaigns, orchestrator, tableCounts, verificationReportStats, emailStats, campaignsByState } = data;

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity size={18} className="text-indigo-400" />
            캠페인 운영 관제실
          </h1>
          <p className="text-[10px] text-slate-500 mt-0.5">Campaign Automation Control Center</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#1a2035] border border-[#374766]/30 transition">
          <RefreshCw size={12} /> 새로고침
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: '진행 캠페인', value: kpi.activeCampaigns, icon: Megaphone, color: 'text-indigo-400', bg: 'from-indigo-500/10' },
          { label: '오늘 감지 방송', value: kpi.todayStreams, icon: Monitor, color: 'text-cyan-400', bg: 'from-cyan-500/10' },
          { label: '매칭 성공', value: kpi.matchedCount, icon: CheckCircle2, color: 'text-emerald-400', bg: 'from-emerald-500/10' },
          { label: '검수 대기', value: kpi.reviewPending, icon: Eye, color: kpi.reviewPending > 0 ? 'text-amber-400' : 'text-slate-500', bg: 'from-amber-500/10', alert: kpi.reviewPending > 0 },
          { label: '리포트 실패', value: kpi.reportFailed, icon: FileText, color: kpi.reportFailed > 0 ? 'text-red-400' : 'text-slate-500', bg: 'from-red-500/10', alert: kpi.reportFailed > 0 },
          { label: '이메일 실패', value: kpi.emailFailed, icon: MailX, color: kpi.emailFailed > 0 ? 'text-red-400' : 'text-slate-500', bg: 'from-red-500/10', alert: kpi.emailFailed > 0 },
        ].map((s, i) => (
          <GlassCard key={i} className={`p-4 bg-gradient-to-br ${s.bg} to-transparent ${s.alert ? 'border-amber-500/30' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</span>
              <s.icon size={14} className={s.color} />
            </div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 검수 대기 + 실패 작업 */}
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" /> 즉시 대응 필요
          </h3>

          {kpi.reviewPending > 0 && (
            <button
              onClick={() => onNavigate?.('review-queue')}
              className="w-full mb-2 flex items-center justify-between px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition"
            >
              <span className="text-xs text-amber-300 flex items-center gap-2">
                <Eye size={13} /> 검수 대기 {kpi.reviewPending}건
              </span>
              <span className="text-[10px] text-amber-400">바로가기 →</span>
            </button>
          )}

          {kpi.reportFailed > 0 && (
            <button
              onClick={() => onNavigate?.('report-center')}
              className="w-full mb-2 flex items-center justify-between px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition"
            >
              <span className="text-xs text-red-300 flex items-center gap-2">
                <FileText size={13} /> 리포트 생성 실패 {kpi.reportFailed}건
              </span>
              <span className="text-[10px] text-red-400">바로가기 →</span>
            </button>
          )}

          {kpi.emailFailed > 0 && (
            <button
              onClick={() => onNavigate?.('email-delivery')}
              className="w-full mb-2 flex items-center justify-between px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition"
            >
              <span className="text-xs text-red-300 flex items-center gap-2">
                <MailX size={13} /> 이메일 발송 실패 {kpi.emailFailed}건
              </span>
              <span className="text-[10px] text-red-400">바로가기 →</span>
            </button>
          )}

          {kpi.reviewPending === 0 && kpi.reportFailed === 0 && kpi.emailFailed === 0 && (
            <div className="text-center py-4 text-slate-500 text-xs">
              <CheckCircle2 size={20} className="mx-auto mb-2 text-emerald-500/50" />
              모든 항목 정상
            </div>
          )}
        </GlassCard>

        {/* Job Queue Status */}
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Server size={14} className="text-indigo-400" /> 작업 큐 상태
          </h3>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: '대기', value: queueStats.pending, color: 'text-amber-400' },
              { label: '실행중', value: queueStats.running, color: 'text-cyan-400' },
              { label: '완료', value: queueStats.completed, color: 'text-emerald-400' },
              { label: '실패', value: queueStats.failed, color: 'text-red-400' },
            ].map((s, i) => (
              <div key={i} className="text-center p-2 rounded-lg bg-[#0a0e1a]/50">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[9px] text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Orchestrator status */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/20">
            <div className={`w-2 h-2 rounded-full ${orchestrator.running ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-[10px] text-slate-400">
              오케스트레이터: {orchestrator.running ? '실행중' : '중지됨'}
            </span>
            <span className="text-[10px] text-slate-600 ml-auto">
              핸들러 {orchestrator.handlers?.length || 0}개
            </span>
          </div>

          {/* Periodic scan status */}
          {orchestrator.periodicScan && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/20">
              <div className={`w-2 h-2 rounded-full ${orchestrator.periodicScan.active ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-[10px] text-slate-400">
                주기 스캔: {orchestrator.periodicScan.active ? `${orchestrator.periodicScan.intervalMin}분 주기` : '비활성'}
              </span>
              {orchestrator.periodicScan.lastScanAt && (
                <span className="text-[10px] text-slate-600 ml-auto">
                  마지막: {formatDate(orchestrator.periodicScan.lastScanAt)}
                  {orchestrator.periodicScan.lastScanStats && ` (${orchestrator.periodicScan.lastScanStats.enqueued}건 등록)`}
                </span>
              )}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Recent Failed Jobs */}
      {recentFailedJobs.length > 0 && (
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400" /> 최근 실패 작업
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase border-b border-[#374766]/20">
                  <th className="text-left py-2 px-2">ID</th>
                  <th className="text-left py-2 px-2">타입</th>
                  <th className="text-left py-2 px-2">시도</th>
                  <th className="text-left py-2 px-2">생성일</th>
                  <th className="text-left py-2 px-2">실패일</th>
                </tr>
              </thead>
              <tbody>
                {recentFailedJobs.map(j => (
                  <tr key={j.id} className="border-b border-[#374766]/10 hover:bg-[#1a2035]/50">
                    <td className="py-2 px-2 text-slate-400">#{j.id}</td>
                    <td className="py-2 px-2 text-red-300">{JOB_TYPE_LABELS[j.job_type] || j.job_type}</td>
                    <td className="py-2 px-2 text-slate-400">{j.attempts}/{j.max_attempts}</td>
                    <td className="py-2 px-2 text-slate-500">{formatDate(j.created_at)}</td>
                    <td className="py-2 px-2 text-slate-500">{formatDate(j.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => onNavigate?.('job-queue')}
            className="mt-2 text-[10px] text-indigo-400 hover:text-indigo-300 transition"
          >
            작업 큐 전체 보기 →
          </button>
        </GlassCard>
      )}

      {/* 리포트 & 이메일 현황 + 캠페인 상태 분포 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 리포트 현황 */}
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <FileText size={14} className="text-emerald-400" /> 검증 리포트 현황
          </h3>
          {verificationReportStats ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0a0e1a]/50">
                <span className="text-[10px] text-slate-400">전체 리포트</span>
                <span className="text-sm font-bold text-white">{verificationReportStats.total}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0a0e1a]/50">
                <span className="text-[10px] text-slate-400">완료</span>
                <span className="text-sm font-bold text-emerald-400">{verificationReportStats.completed || 0}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0a0e1a]/50">
                <span className="text-[10px] text-slate-400">생성중</span>
                <span className="text-sm font-bold text-cyan-400">{verificationReportStats.generating || 0}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0a0e1a]/50">
                <span className="text-[10px] text-slate-400">실패</span>
                <span className="text-sm font-bold text-red-400">{verificationReportStats.failed || 0}</span>
              </div>
            </div>
          ) : <div className="text-[10px] text-slate-500">데이터 없음</div>}
          <button onClick={() => onNavigate?.('report-center')} className="mt-2 text-[10px] text-indigo-400 hover:text-indigo-300 transition">
            리포트 센터 →
          </button>
        </GlassCard>

        {/* 이메일 현황 */}
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Mail size={14} className="text-amber-400" /> 이메일 발송 현황
          </h3>
          {emailStats ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0a0e1a]/50">
                <span className="text-[10px] text-slate-400">전체 발송</span>
                <span className="text-sm font-bold text-white">{emailStats.total}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0a0e1a]/50">
                <span className="text-[10px] text-slate-400">발송 완료</span>
                <span className="text-sm font-bold text-emerald-400">{emailStats.sent || 0}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0a0e1a]/50">
                <span className="text-[10px] text-slate-400">대기중</span>
                <span className="text-sm font-bold text-amber-400">{emailStats.pending || 0}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0a0e1a]/50">
                <span className="text-[10px] text-slate-400">실패</span>
                <span className="text-sm font-bold text-red-400">{emailStats.failed || 0}</span>
              </div>
            </div>
          ) : <div className="text-[10px] text-slate-500">데이터 없음</div>}
          <button onClick={() => onNavigate?.('email-delivery')} className="mt-2 text-[10px] text-indigo-400 hover:text-indigo-300 transition">
            이메일 발송 관리 →
          </button>
        </GlassCard>

        {/* 캠페인 상태 분포 */}
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Megaphone size={14} className="text-indigo-400" /> 캠페인 상태 분포
          </h3>
          {campaignsByState && Object.keys(campaignsByState).length > 0 ? (
            <div className="space-y-1.5">
              {Object.entries(campaignsByState).map(([state, count]) => (
                <div key={state} className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0a0e1a]/50">
                  <span className={`text-[10px] font-medium ${STATE_COLORS[state] || 'text-slate-400'}`}>
                    {STATE_LABELS[state] || state}
                  </span>
                  <span className="text-sm font-bold text-white">{count}</span>
                </div>
              ))}
            </div>
          ) : <div className="text-[10px] text-slate-500">캠페인 없음</div>}
          <button onClick={() => onNavigate?.('campaigns')} className="mt-2 text-[10px] text-indigo-400 hover:text-indigo-300 transition">
            캠페인 관리 →
          </button>
        </GlassCard>
      </div>

      {/* 데이터 테이블 현황 */}
      {tableCounts && (
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Server size={14} className="text-slate-400" /> 시스템 데이터 현황
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            {[
              { key: 'campaigns', label: '캠페인' },
              { key: 'campaign_creators', label: '계약 크리에이터' },
              { key: 'creator_profiles', label: '크리에이터' },
              { key: 'verification_reports', label: '검증 리포트' },
              { key: 'banner_verifications', label: '배너 검증' },
              { key: 'videos', label: '수집 영상' },
              { key: 'transcripts', label: '자막' },
              { key: 'chat_messages', label: '채팅 메시지' },
              { key: 'stream_sessions', label: '감지 방송' },
              { key: 'campaign_broadcast_matches', label: '방송 매칭' },
              { key: 'notifications', label: '알림' },
              { key: 'audit_logs', label: '감사 로그' },
            ].map(t => (
              <div key={t.key} className="text-center p-2 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/10">
                <div className="text-sm font-bold text-white">{tableCounts[t.key] ?? 0}</div>
                <div className="text-[8px] text-slate-500 mt-0.5">{t.label}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Recent Campaigns Timeline */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Clock size={14} className="text-indigo-400" /> 최근 캠페인 상태 변화
        </h3>
        <div className="space-y-1.5">
          {recentCampaigns.map(c => (
            <button
              key={c.id}
              onClick={() => onNavigate?.('campaign-detail', { campaignId: c.id })}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1a2035]/50 transition text-left"
            >
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATE_COLORS[c.state] || 'text-slate-400'} bg-current/10`}>
                {STATE_LABELS[c.state] || c.state}
              </span>
              <span className="text-xs text-white truncate flex-1">{c.title}</span>
              <span className="text-[10px] text-slate-600">{c.target_game}</span>
              <span className="text-[10px] text-slate-600">{formatDate(c.updated_at)}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => onNavigate?.('campaigns')}
          className="mt-2 text-[10px] text-indigo-400 hover:text-indigo-300 transition"
        >
          캠페인 전체 보기 →
        </button>
      </GlassCard>
    </div>
  );
}

function formatDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
