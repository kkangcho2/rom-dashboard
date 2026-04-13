/**
 * AdminCampaignDetailPage — 캠페인 상세 (탭 5개: 기본정보/크리에이터/감지방송/리포트/자동화로그)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Info, Users, Monitor, FileText, Activity, RefreshCw,
  CheckCircle2, AlertTriangle, ExternalLink, Play, XCircle, Eye, Zap, Mail
} from 'lucide-react';
import { GlassCard } from '../../components/shared';
import {
  getCampaignDetail, getCampaignStreams, getCampaignReports,
  getCampaignJobs, getCampaignMatches, scanCampaignStreams, regenerateReport,
  forceMatchStream, excludeStream, rematchStream, resendEmail,
  updateCampaignAutomation
} from '../../services/admin-automation-api';

const TABS = [
  { id: 'info', label: '기본 정보', icon: Info },
  { id: 'creators', label: '크리에이터', icon: Users },
  { id: 'streams', label: '감지 방송', icon: Monitor },
  { id: 'reports', label: '리포트', icon: FileText },
  { id: 'logs', label: '자동화 로그', icon: Activity },
];

const STATE_LABELS = {
  draft: '작성중', published: '공개', matching: '매칭중', negotiating: '협의중',
  accepted: '수락', confirmed: '확정', live: 'LIVE', completed: '완료',
  verified: '검증완료', closed: '종료',
};
const MATCH_STATUS_COLORS = {
  matched: 'bg-emerald-500/20 text-emerald-400',
  needs_review: 'bg-amber-500/20 text-amber-400',
  rejected: 'bg-red-500/20 text-red-400',
  pending: 'bg-slate-500/20 text-slate-400',
};
const JOB_STATUS_COLORS = {
  pending: 'text-amber-400', running: 'text-cyan-400',
  completed: 'text-emerald-400', failed: 'text-red-400',
};

export default function AdminCampaignDetailPage({ campaignId, onNavigate }) {
  const [tab, setTab] = useState('info');
  const [campaign, setCampaign] = useState(null);
  const [creators, setCreators] = useState([]);
  const [streams, setStreams] = useState([]);
  const [reports, setReports] = useState({ verificationReports: [], deliveryReports: [], emails: [] });
  const [jobs, setJobs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await getCampaignDetail(campaignId);
      setCampaign(detail.campaign);
      setCreators(detail.creators);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  // Load tab data lazily
  useEffect(() => {
    if (tab === 'streams') getCampaignStreams(campaignId).then(r => setStreams(r.streams)).catch(() => {});
    if (tab === 'reports') getCampaignReports(campaignId).then(r => setReports(r)).catch(() => {});
    if (tab === 'logs') getCampaignJobs(campaignId).then(r => setJobs(r.jobs)).catch(() => {});
  }, [tab, campaignId]);

  const showAction = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); };

  const handleScanStreams = async () => {
    await scanCampaignStreams(campaignId);
    showAction('스트림 스캔 잡 등록됨');
  };

  const handleForceMatch = async (streamId) => {
    await forceMatchStream(streamId);
    showAction('강제 매칭 완료');
    getCampaignStreams(campaignId).then(r => setStreams(r.streams));
  };

  const handleExclude = async (streamId) => {
    await excludeStream(streamId);
    showAction('제외 완료');
    getCampaignStreams(campaignId).then(r => setStreams(r.streams));
  };

  const handleRematch = async (streamId) => {
    await rematchStream(streamId);
    showAction('재매칭 잡 등록됨');
  };

  const handleRegenReport = async () => {
    await regenerateReport(campaignId);
    showAction('리포트 재생성 잡 등록됨');
  };

  const handleResendEmail = async () => {
    await resendEmail(campaignId);
    showAction('이메일 재발송 잡 등록됨');
  };

  if (loading && !campaign) {
    return <div className="p-6 text-center text-slate-500 text-xs animate-pulse">로딩 중...</div>;
  }
  if (!campaign) return null;

  const stateHistory = JSON.parse(campaign.state_history || '[]');

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate?.('campaigns')} className="p-1.5 rounded-lg hover:bg-[#1a2035] transition">
          <ArrowLeft size={16} className="text-slate-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">{campaign.title}</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-slate-500">{campaign.brand_name}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${MATCH_STATUS_COLORS[campaign.state] || 'bg-slate-500/20 text-slate-400'}`}>
              {STATE_LABELS[campaign.state] || campaign.state}
            </span>
            <span className="text-[10px] text-slate-600">{campaign.target_game}</span>
          </div>
        </div>
        {actionMsg && (
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg animate-fade-in-up">{actionMsg}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#374766]/30 pb-0">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition ${
                tab === t.id
                  ? 'border-indigo-400 text-indigo-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'info' && <InfoTab campaign={campaign} stateHistory={stateHistory} campaignId={campaignId} onReload={load} />}
      {tab === 'creators' && <CreatorsTab creators={creators} />}
      {tab === 'streams' && (
        <StreamsTab
          streams={streams}
          onScan={handleScanStreams}
          onForceMatch={handleForceMatch}
          onExclude={handleExclude}
          onRematch={handleRematch}
        />
      )}
      {tab === 'reports' && (
        <ReportsTab
          verificationReports={reports.verificationReports || []}
          deliveryReports={reports.deliveryReports || []}
          emails={reports.emails || []}
          onRegen={handleRegenReport}
          onResend={handleResendEmail}
        />
      )}
      {tab === 'logs' && <LogsTab jobs={jobs} />}
    </div>
  );
}

// ─── Tab A: 기본 정보 + 자동화 옵션 ─────────────────────────────
function InfoTab({ campaign, stateHistory, campaignId, onReload }) {
  const [opts, setOpts] = useState({
    auto_monitoring_enabled: campaign.auto_monitoring_enabled ?? 1,
    auto_reporting_enabled: campaign.auto_reporting_enabled ?? 1,
    auto_email_enabled: campaign.auto_email_enabled ?? 0,
    force_review: campaign.force_review ?? 0,
    match_threshold: campaign.match_threshold ?? 0.8,
    report_recipient_email: campaign.report_recipient_email ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const save = async () => {
    setSaving(true);
    try {
      await updateCampaignAutomation(campaignId, opts);
      setSavedMsg('저장됨');
      setTimeout(() => setSavedMsg(''), 2000);
      onReload?.();
    } catch (err) {
      setSavedMsg('저장 실패');
    }
    setSaving(false);
  };

  const fields = [
    ['광고명', campaign.title],
    ['브랜드명', campaign.brand_name],
    ['설명', campaign.description],
    ['타겟 게임', campaign.target_game],
    ['시작일', campaign.campaign_start_date?.slice(0,10)],
    ['종료일', campaign.campaign_end_date?.slice(0,10)],
    ['계약 개월', `${campaign.contract_months || '-'}개월`],
    ['월 방송 횟수', `${campaign.broadcasts_per_month || '-'}회`],
    ['회당 시간', `${campaign.hours_per_broadcast || '-'}시간`],
    ['예산 범위', `${(campaign.budget_min||0).toLocaleString()} ~ ${(campaign.budget_max||0).toLocaleString()} ${campaign.currency}`],
    ['크리에이터당 예산', `${(campaign.budget_per_creator||0).toLocaleString()} ${campaign.currency}`],
    ['최소 평균 시청자', campaign.min_avg_viewers],
    ['최대 크리에이터', campaign.max_creators],
    ['요구사항', campaign.requirements],
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-4">캠페인 정보</h3>
        <div className="space-y-2.5">
          {fields.map(([label, value], i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-[10px] text-slate-500 w-24 shrink-0 pt-0.5">{label}</span>
              <span className="text-xs text-slate-300 break-all">{value || '-'}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="space-y-5">
        {/* 자동화 옵션 */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap size={14} className="text-indigo-400" /> 자동화 옵션
            </h3>
            {savedMsg && <span className="text-[10px] text-emerald-400">{savedMsg}</span>}
          </div>
          <div className="space-y-3">
            {[
              { key: 'auto_monitoring_enabled', label: '자동 방송 모니터링', desc: '확정/LIVE 시 자동 스트림 감지' },
              { key: 'auto_reporting_enabled', label: '자동 리포트 생성', desc: '완료 시 자동 리포트 생성' },
              { key: 'auto_email_enabled', label: '자동 이메일 발송', desc: '검증완료 시 이메일 자동 발송' },
              { key: 'force_review', label: '검수 강제', desc: '모든 매칭 결과를 검수 큐로 보냄' },
            ].map(opt => (
              <div key={opt.key} className="flex items-center justify-between p-3 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/20">
                <div>
                  <div className="text-xs text-white font-medium">{opt.label}</div>
                  <div className="text-[10px] text-slate-500">{opt.desc}</div>
                </div>
                <button
                  onClick={() => setOpts(o => ({ ...o, [opt.key]: o[opt.key] ? 0 : 1 }))}
                  className={`relative w-10 h-5 rounded-full transition ${opts[opt.key] ? 'bg-emerald-500/60' : 'bg-slate-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${opts[opt.key] ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            ))}

            {/* Match threshold slider */}
            <div className="p-3 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/20">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs text-white font-medium">매칭 임계값 (match_threshold)</div>
                  <div className="text-[10px] text-slate-500">이 값 이상이면 자동 매칭 인정</div>
                </div>
                <span className="text-sm font-bold text-amber-400">{(opts.match_threshold * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.3" max="1.0" step="0.05"
                value={opts.match_threshold}
                onChange={e => setOpts(o => ({ ...o, match_threshold: parseFloat(e.target.value) }))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                <span>30%</span><span>50%</span><span>80%</span><span>100%</span>
              </div>
            </div>

            {/* 수신 이메일 */}
            <div className="p-3 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/20">
              <div className="text-xs text-white font-medium mb-1">리포트 수신 이메일</div>
              <div className="text-[10px] text-slate-500 mb-2">빈 값이면 광고주 기본 이메일 사용</div>
              <input
                type="email"
                value={opts.report_recipient_email}
                onChange={e => setOpts(o => ({ ...o, report_recipient_email: e.target.value }))}
                placeholder="recipient@company.com"
                className="w-full px-2 py-1.5 rounded bg-[#111827] border border-[#374766]/40 text-xs text-white focus:outline-none focus:border-indigo-500/60"
              />
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="w-full px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/25 transition disabled:opacity-50"
            >
              {saving ? '저장 중...' : '옵션 저장'}
            </button>
          </div>
        </GlassCard>

        {/* 상태 이력 */}
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-4">상태 이력</h3>
          <div className="space-y-2">
            {stateHistory.map((h, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#0a0e1a]/50">
                <div className={`w-2 h-2 rounded-full ${i === stateHistory.length - 1 ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                <span className="text-xs text-white font-medium">{STATE_LABELS[h.state] || h.state}</span>
                <span className="text-[10px] text-slate-500 ml-auto">{formatDate(h.at)}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ─── Tab B: 크리에이터 ──────────────────────────────────────────
function CreatorsTab({ creators }) {
  if (creators.length === 0) return <div className="text-center py-16 text-slate-500 text-xs">등록된 크리에이터가 없습니다</div>;

  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 text-[10px] uppercase border-b border-[#374766]/30 bg-[#0a0e1a]/30">
              <th className="text-left py-3 px-4">크리에이터</th>
              <th className="text-left py-3 px-3">등급</th>
              <th className="text-left py-3 px-3">YouTube</th>
              <th className="text-left py-3 px-3">Chzzk</th>
              <th className="text-left py-3 px-3">AfreecaTV</th>
              <th className="text-left py-3 px-3">상태</th>
              <th className="text-left py-3 px-3">단가</th>
              <th className="text-left py-3 px-3">방송 URL</th>
            </tr>
          </thead>
          <tbody>
            {creators.map(c => (
              <tr key={c.id} className="border-b border-[#374766]/10 hover:bg-[#1a2035]/50">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {c.thumbnail_url && <img src={c.thumbnail_url} className="w-6 h-6 rounded-full" alt="" />}
                    <span className="text-white">{c.display_name}</span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span className="text-indigo-400 font-bold">{c.engagement_grade || '-'}</span>
                </td>
                <td className="py-3 px-3 text-slate-400 text-[10px]">{c.youtube_channel_id || '-'}</td>
                <td className="py-3 px-3 text-slate-400 text-[10px]">{c.chzzk_channel_id || '-'}</td>
                <td className="py-3 px-3 text-slate-400 text-[10px]">{c.afreeca_channel_id || '-'}</td>
                <td className="py-3 px-3 text-slate-400">{c.status}</td>
                <td className="py-3 px-3 text-slate-400">{c.proposed_fee ? c.proposed_fee.toLocaleString() : '-'}</td>
                <td className="py-3 px-3">
                  {c.broadcast_url ? (
                    <a href={c.broadcast_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1">
                      <ExternalLink size={10} /> 링크
                    </a>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

// ─── Tab C: 감지 방송 ───────────────────────────────────────────
function StreamsTab({ streams, onScan, onForceMatch, onExclude, onRematch }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{streams.length}개 감지됨</span>
        <button onClick={onScan} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/20 transition">
          <Zap size={12} /> 스캔 실행
        </button>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 text-[10px] uppercase border-b border-[#374766]/30 bg-[#0a0e1a]/30">
                <th className="text-left py-3 px-3">감지일</th>
                <th className="text-left py-3 px-3">플랫폼</th>
                <th className="text-left py-3 px-3">크리에이터</th>
                <th className="text-left py-3 px-3">방송 제목</th>
                <th className="text-center py-3 px-3">상태</th>
                <th className="text-center py-3 px-3">매칭</th>
                <th className="text-center py-3 px-3">점수</th>
                <th className="text-center py-3 px-3">검수</th>
                <th className="text-center py-3 px-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {streams.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-500">감지된 방송이 없습니다</td></tr>
              ) : streams.map(s => (
                <tr key={s.id} className="border-b border-[#374766]/10 hover:bg-[#1a2035]/50">
                  <td className="py-2.5 px-3 text-slate-500 text-[10px] whitespace-nowrap">{formatDate(s.discovered_at)}</td>
                  <td className="py-2.5 px-3">
                    <PlatformBadge platform={s.platform} />
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{s.creator_name || '-'}</td>
                  <td className="py-2.5 px-3 text-white max-w-[200px] truncate">
                    {s.stream_url ? (
                      <a href={s.stream_url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-300 flex items-center gap-1">
                        {s.title || '(제목 없음)'} <ExternalLink size={9} />
                      </a>
                    ) : (s.title || '-')}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`text-[10px] ${s.live_status === 'live' ? 'text-red-400' : 'text-slate-400'}`}>
                      {s.live_status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${MATCH_STATUS_COLORS[s.match_status] || 'bg-slate-500/20 text-slate-500'}`}>
                      {s.match_status || '-'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {s.match_confidence != null ? (
                      <span className={`font-bold text-[10px] ${s.match_confidence >= 0.8 ? 'text-emerald-400' : s.match_confidence >= 0.5 ? 'text-amber-400' : 'text-red-400'}`}>
                        {(s.match_confidence * 100).toFixed(0)}%
                      </span>
                    ) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {s.review_required ? <Eye size={13} className="text-amber-400 mx-auto" /> : null}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <button onClick={() => onForceMatch(s.id)} className="p-1 rounded hover:bg-emerald-500/20 transition" title="강제 매칭">
                        <CheckCircle2 size={12} className="text-emerald-400" />
                      </button>
                      <button onClick={() => onExclude(s.id)} className="p-1 rounded hover:bg-red-500/20 transition" title="제외">
                        <XCircle size={12} className="text-red-400" />
                      </button>
                      <button onClick={() => onRematch(s.id)} className="p-1 rounded hover:bg-cyan-500/20 transition" title="재분석">
                        <RefreshCw size={11} className="text-cyan-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Tab D: 리포트 ──────────────────────────────────────────────
function ReportsTab({ verificationReports, deliveryReports, emails, onRegen, onResend }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={onRegen} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-indigo-400 hover:bg-indigo-500/10 border border-indigo-500/20 transition">
          <RefreshCw size={12} /> 리포트 재생성
        </button>
        <button onClick={onResend} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 transition">
          <Mail size={12} /> 이메일 재발송
        </button>
      </div>

      {/* 검증 리포트 (기존 데이터) */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <FileText size={14} className="text-emerald-400" /> 검증 리포트
          <span className="text-[10px] text-slate-500 font-normal">({verificationReports.length}건)</span>
        </h3>
        {verificationReports.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">검증 리포트가 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase border-b border-[#374766]/20">
                  <th className="text-left py-2 px-2">크리에이터</th>
                  <th className="text-center py-2 px-2">방송시간</th>
                  <th className="text-center py-2 px-2">배너노출</th>
                  <th className="text-center py-2 px-2">노출률</th>
                  <th className="text-center py-2 px-2">평균시청</th>
                  <th className="text-center py-2 px-2">최대시청</th>
                  <th className="text-center py-2 px-2">임프레션</th>
                  <th className="text-center py-2 px-2">상태</th>
                  <th className="text-left py-2 px-2">생성일</th>
                </tr>
              </thead>
              <tbody>
                {verificationReports.map(r => (
                  <tr key={r.id} className="border-b border-[#374766]/10 hover:bg-[#1a2035]/50">
                    <td className="py-2.5 px-2 text-white">{r.creator_name || '-'}</td>
                    <td className="py-2.5 px-2 text-center text-slate-300">{r.total_stream_minutes || 0}분</td>
                    <td className="py-2.5 px-2 text-center text-slate-300">{r.banner_exposed_minutes || 0}분</td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`font-bold ${(r.exposure_rate || 0) > 0.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {((r.exposure_rate || 0) * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-300">{(r.avg_viewers_during || 0).toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-center text-indigo-400 font-bold">{(r.peak_viewers || 0).toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-center text-slate-300">{(r.total_impressions || 0).toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.status === 'generating' ? 'bg-emerald-500/20 text-emerald-400' : r.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-slate-500 text-[10px]">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* 배송 리포트 (자동화) */}
      {deliveryReports.length > 0 && (
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3">배송 리포트 (자동화)</h3>
          <div className="space-y-2">
            {deliveryReports.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/20">
                <FileText size={14} className={r.status === 'completed' ? 'text-emerald-400' : r.status === 'failed' ? 'text-red-400' : 'text-amber-400'} />
                <span className="text-xs text-white">리포트 #{r.id}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${r.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : r.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {r.status}
                </span>
                <span className="text-[10px] text-slate-500 ml-auto">{formatDate(r.created_at)}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* 이메일 발송 이력 */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Mail size={14} className="text-amber-400" /> 이메일 발송 이력
          <span className="text-[10px] text-slate-500 font-normal">({emails.length}건)</span>
        </h3>
        {emails.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">발송 기록이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase border-b border-[#374766]/20">
                  <th className="text-left py-2 px-2">수신자</th>
                  <th className="text-left py-2 px-2">제목</th>
                  <th className="text-center py-2 px-2">상태</th>
                  <th className="text-center py-2 px-2">시도</th>
                  <th className="text-left py-2 px-2">발송일</th>
                  <th className="text-left py-2 px-2">오류</th>
                </tr>
              </thead>
              <tbody>
                {emails.map(e => (
                  <tr key={e.id} className="border-b border-[#374766]/10">
                    <td className="py-2 px-2 text-slate-300">{e.recipient_email}</td>
                    <td className="py-2 px-2 text-slate-400 max-w-[200px] truncate">{e.subject}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${e.status === 'sent' ? 'bg-emerald-500/20 text-emerald-400' : e.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-400">{e.attempts}</td>
                    <td className="py-2 px-2 text-slate-500 text-[10px]">{formatDate(e.sent_at || e.created_at)}</td>
                    <td className="py-2 px-2 text-red-400 text-[10px] truncate max-w-[150px]">{e.error_message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// ─── Tab E: 자동화 로그 ─────────────────────────────────────────
function LogsTab({ jobs }) {
  if (jobs.length === 0) return <div className="text-center py-16 text-slate-500 text-xs">자동화 로그가 없습니다</div>;

  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 text-[10px] uppercase border-b border-[#374766]/30 bg-[#0a0e1a]/30">
              <th className="text-left py-3 px-3">ID</th>
              <th className="text-left py-3 px-3">타입</th>
              <th className="text-left py-3 px-3">상태</th>
              <th className="text-center py-3 px-3">시도</th>
              <th className="text-left py-3 px-3">우선순위</th>
              <th className="text-left py-3 px-3">생성일</th>
              <th className="text-left py-3 px-3">실행일</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id} className="border-b border-[#374766]/10 hover:bg-[#1a2035]/50">
                <td className="py-2.5 px-3 text-slate-400">#{j.id}</td>
                <td className="py-2.5 px-3 text-white">{j.job_type}</td>
                <td className="py-2.5 px-3">
                  <span className={`font-bold ${JOB_STATUS_COLORS[j.status] || 'text-slate-400'}`}>{j.status}</span>
                </td>
                <td className="py-2.5 px-3 text-center text-slate-400">{j.attempts}/{j.max_attempts}</td>
                <td className="py-2.5 px-3 text-slate-400">{j.priority}</td>
                <td className="py-2.5 px-3 text-slate-500 text-[10px]">{formatDate(j.created_at)}</td>
                <td className="py-2.5 px-3 text-slate-500 text-[10px]">{formatDate(j.run_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

// ─── Helpers ────────────────────────────────────────────────────
function PlatformBadge({ platform }) {
  const colors = { youtube: 'bg-red-500/20 text-red-400', chzzk: 'bg-green-500/20 text-green-400', afreeca: 'bg-blue-500/20 text-blue-400' };
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${colors[platform] || 'bg-slate-500/20 text-slate-400'}`}>{platform}</span>;
}

function formatDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
