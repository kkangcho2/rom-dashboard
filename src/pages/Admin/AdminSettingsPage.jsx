/**
 * AdminSettingsPage — 시스템 설정 (threshold, retry, keywords 등)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Settings, Save, RefreshCw, Zap, Clock, Mail, Hash, Plus, X, Radar, Play, Cookie, Upload, AlertTriangle
} from 'lucide-react';
import { GlassCard } from '../../components/shared';
import { getSettings, updateSettings, triggerScanNow } from '../../services/admin-automation-api';
import { authFetch } from '../../store/useAuthStore';

// ─── 8 Matching Signals Meta ────────────────────────────────────
const SIGNAL_META = [
  { key: 'channel_match', label: '채널 일치', defaultWeight: 0.25,
    description: '스트림 채널이 계약된 크리에이터의 플랫폼 채널 ID와 정확히 일치하는가. 가장 강한 신호.' },
  { key: 'target_game_title_match', label: '제목에 타겟 게임명', defaultWeight: 0.20,
    description: '방송 제목에 캠페인의 target_game 키워드가 포함되어 있는가 (정규화된 문자열 비교).' },
  { key: 'banner_detected', label: '배너 검출', defaultWeight: 0.15,
    description: '배너 검증(banner_verifications) 결과가 존재하고 positive confidence인가. 광고 노출 직접 증거.' },
  { key: 'date_window', label: '방송 기간', defaultWeight: 0.15,
    description: '방송 시작일이 캠페인 기간 (±2일 버퍼) 내에 있는가. 외부/이전 방송 배제.' },
  { key: 'detected_game_match', label: '게임 자동 탐지 일치', defaultWeight: 0.10,
    description: 'game-detection 유틸이 탐지한 게임이 target_game과 일치하는가. 제목 정규화 보조.' },
  { key: 'sponsor_pattern', label: '광고/협찬 패턴', defaultWeight: 0.08,
    description: "제목에 '[광고]', '#AD', '유료광고', 'paid promotion' 등 26개 스폰서 패턴이 포함되었는가." },
  { key: 'transcript_target_mention', label: '자막 내 타겟 언급', defaultWeight: 0.05,
    description: '영상 자막에 target_game 키워드가 언급된 횟수. 약한 positive signal.' },
  { key: 'chat_target_mention', label: '채팅 내 타겟 언급', defaultWeight: 0.02,
    description: '최근 300~500개 채팅 메시지에 키워드 매칭 비율. 매우 약한 보조 신호.' },
];

function computeWeightSum(customWeights) {
  let sum = 0;
  for (const sig of SIGNAL_META) {
    sum += customWeights[sig.key] != null ? customWeights[sig.key] : sig.defaultWeight;
  }
  return sum;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getSettings().then(r => setSettings(r.settings)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(settings);
      setMsg('저장되었습니다');
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg('저장 실패: ' + err.message);
    }
    setSaving(false);
  };

  if (loading || !settings) {
    return <div className="p-6 text-center text-slate-500 text-xs animate-pulse">로딩 중...</div>;
  }

  const updateField = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  const gameKeywords = parseJsonArray(settings.game_keywords_json);
  const sponsorKeywords = parseJsonArray(settings.sponsor_keywords_json);
  const customWeights = parseJsonObj(settings.custom_weights_json);

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Settings size={18} className="text-slate-400" />
          시스템 설정
        </h1>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-[10px] px-3 py-1 rounded-lg ${msg.includes('실패') ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>{msg}</span>}
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#1a2035] border border-[#374766]/30 transition">
            <RefreshCw size={12} /> 새로고침
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/25 transition disabled:opacity-50">
            <Save size={12} /> {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 매칭 설정 */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Zap size={14} className="text-indigo-400" /> 매칭 설정
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Match threshold */}
          <div className="p-3 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/20">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-white font-medium">기본 매칭 임계값</label>
              <span className="text-sm font-bold text-amber-400">{(settings.default_match_threshold * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0.3" max="1.0" step="0.05"
              value={settings.default_match_threshold}
              onChange={e => updateField('default_match_threshold', parseFloat(e.target.value))}
              className="w-full accent-indigo-500" />
            <div className="text-[10px] text-slate-500 mt-1">이 값 이상일 때 자동으로 매칭 성공 처리</div>
          </div>

          {/* Review threshold */}
          <div className="p-3 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/20">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-white font-medium">검수 임계값</label>
              <span className="text-sm font-bold text-amber-400">{(settings.default_review_threshold * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0.2" max="0.8" step="0.05"
              value={settings.default_review_threshold}
              onChange={e => updateField('default_review_threshold', parseFloat(e.target.value))}
              className="w-full accent-amber-500" />
            <div className="text-[10px] text-slate-500 mt-1">이 값 이상 & 매칭 임계값 미만이면 검수 큐로</div>
          </div>
        </div>

        {/* Custom weights */}
        <div className="mt-4 p-4 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs text-white font-medium">매칭 시그널 가중치 커스터마이징</div>
              <div className="text-[10px] text-slate-500 mt-0.5">8개 시그널 합계가 confidence 점수 (0 ~ 1.0). 기본 합계 = 1.0</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-slate-500">현재 합계</div>
              <div className={`text-sm font-bold ${computeWeightSum(customWeights) > 1.05 || computeWeightSum(customWeights) < 0.95 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {computeWeightSum(customWeights).toFixed(2)}
              </div>
            </div>
          </div>

          {/* 사용 설명 박스 */}
          <div className="mb-3 p-3 rounded bg-indigo-500/5 border border-indigo-500/20 text-[10px] text-slate-300 leading-relaxed">
            <div className="font-bold text-indigo-300 mb-1">📖 사용 설명</div>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>각 시그널은 0~1 사이 값으로 가중치를 부여합니다. 합계가 1.0에 가까워야 정상 confidence가 나옵니다.</li>
              <li>빈 값 (default)은 시스템 기본값을 사용합니다.</li>
              <li>특정 시그널을 중요하게 여기려면 값을 올리고, 무시하려면 0으로 설정하세요.</li>
              <li>총 confidence ≥ <b className="text-emerald-400">80%</b> = 자동 매칭 / <b className="text-amber-400">50~80%</b> = 검수 큐 / <b className="text-red-400">&lt; 50%</b> = 거절</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {SIGNAL_META.map(sig => (
              <div key={sig.key} className="flex items-center gap-3 p-2 rounded bg-[#111827]/40 border border-[#374766]/15 hover:border-[#374766]/40 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">{sig.label}</span>
                    <code className="text-[9px] text-slate-500 font-mono">{sig.key}</code>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{sig.description}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] text-slate-600">기본</span>
                  <span className="text-[10px] text-slate-400 font-mono">{sig.defaultWeight.toFixed(2)}</span>
                  <span className="text-slate-600">→</span>
                  <input
                    type="number" step="0.01" min="0" max="1"
                    value={customWeights[sig.key] ?? ''}
                    placeholder={sig.defaultWeight.toFixed(2)}
                    onChange={e => {
                      const newWeights = { ...customWeights };
                      if (e.target.value === '') delete newWeights[sig.key];
                      else newWeights[sig.key] = parseFloat(e.target.value);
                      updateField('custom_weights_json', JSON.stringify(newWeights));
                    }}
                    className="w-20 px-2 py-1 rounded bg-[#0a0e1a] border border-[#374766]/40 text-[10px] text-white font-mono focus:outline-none focus:border-indigo-500/60"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* 프리셋 버튼 */}
          <div className="mt-3 flex items-center gap-2 pt-3 border-t border-[#374766]/20">
            <span className="text-[10px] text-slate-500">프리셋:</span>
            <button
              onClick={() => updateField('custom_weights_json', '{}')}
              className="px-2.5 py-1 rounded text-[10px] text-slate-400 hover:text-white hover:bg-[#1a2035] border border-[#374766]/30 transition"
            >기본값 복원</button>
            <button
              onClick={() => updateField('custom_weights_json', JSON.stringify({
                channel_match: 0.30, date_window: 0.15, target_game_title_match: 0.25,
                detected_game_match: 0.10, sponsor_pattern: 0.05, banner_detected: 0.10,
                transcript_target_mention: 0.03, chat_target_mention: 0.02,
              }))}
              className="px-2.5 py-1 rounded text-[10px] text-indigo-400 hover:bg-indigo-500/10 border border-indigo-500/20 transition"
            >제목 중심형</button>
            <button
              onClick={() => updateField('custom_weights_json', JSON.stringify({
                channel_match: 0.20, date_window: 0.10, target_game_title_match: 0.15,
                detected_game_match: 0.08, sponsor_pattern: 0.07, banner_detected: 0.35,
                transcript_target_mention: 0.03, chat_target_mention: 0.02,
              }))}
              className="px-2.5 py-1 rounded text-[10px] text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition"
            >배너 중심형</button>
            <button
              onClick={() => updateField('custom_weights_json', JSON.stringify({
                channel_match: 0.25, date_window: 0.15, target_game_title_match: 0.15,
                detected_game_match: 0.10, sponsor_pattern: 0.05, banner_detected: 0.10,
                transcript_target_mention: 0.15, chat_target_mention: 0.05,
              }))}
              className="px-2.5 py-1 rounded text-[10px] text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 transition"
            >콘텐츠 중심형</button>
          </div>
        </div>
      </GlassCard>

      {/* 주기 스캔 설정 */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Radar size={14} className="text-emerald-400" /> 주기 방송 스캔
        </h3>
        <p className="text-[10px] text-slate-500 mb-4">
          LIVE 상태 캠페인의 방송을 주기적으로 자동 감지합니다. 캠페인별 자동 모니터링이 꺼져있으면 스캔 제외됩니다.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/20">
            <label className="text-xs text-white font-medium block mb-2">스캔 간격 (분)</label>
            <input type="number" min="10" max="1440"
              value={settings.scan_interval_min ?? 60}
              onChange={e => updateField('scan_interval_min', parseInt(e.target.value) || 60)}
              className="w-full px-2 py-1.5 rounded bg-[#111827] border border-[#374766]/40 text-xs text-white focus:outline-none focus:border-indigo-500/60" />
            <div className="text-[10px] text-slate-500 mt-1">최소 10분 (rate limit 안전). 기본 60분</div>
          </div>
          <div className="p-3 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/20 flex flex-col justify-between">
            <div>
              <label className="text-xs text-white font-medium block mb-1">즉시 스캔</label>
              <div className="text-[10px] text-slate-500">모든 LIVE 캠페인에 대해 지금 바로 스캔 실행</div>
            </div>
            <button
              onClick={async () => {
                try {
                  const r = await triggerScanNow();
                  setMsg(`스캔 등록: ${r.stats?.enqueued || 0}건 (live: ${r.stats?.totalLiveCampaigns || 0}, skipped: ${r.stats?.skipped || 0})`);
                  setTimeout(() => setMsg(''), 4000);
                } catch (err) {
                  setMsg('스캔 실패: ' + err.message);
                }
              }}
              className="mt-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/25 transition text-xs"
            >
              <Play size={12} /> 즉시 스캔 실행
            </button>
          </div>
        </div>
      </GlassCard>

      {/* 큐 설정 */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Clock size={14} className="text-cyan-400" /> 잡 큐 설정
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/20">
            <label className="text-xs text-white font-medium block mb-2">기본 재시도 횟수</label>
            <input type="number" min="0" max="10"
              value={settings.default_retry_attempts}
              onChange={e => updateField('default_retry_attempts', parseInt(e.target.value) || 0)}
              className="w-full px-2 py-1.5 rounded bg-[#111827] border border-[#374766]/40 text-xs text-white focus:outline-none focus:border-indigo-500/60" />
            <div className="text-[10px] text-slate-500 mt-1">잡 실패 시 최대 재시도 횟수</div>
          </div>

          <div className="p-3 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/20">
            <label className="text-xs text-white font-medium block mb-2">폴링 간격 (초)</label>
            <input type="number" min="1" max="60"
              value={settings.polling_interval_sec}
              onChange={e => updateField('polling_interval_sec', parseInt(e.target.value) || 5)}
              className="w-full px-2 py-1.5 rounded bg-[#111827] border border-[#374766]/40 text-xs text-white focus:outline-none focus:border-indigo-500/60" />
            <div className="text-[10px] text-slate-500 mt-1">워커가 큐를 확인하는 주기</div>
          </div>
        </div>
      </GlassCard>

      {/* 이메일 설정 */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Mail size={14} className="text-amber-400" /> 이메일 설정
        </h3>
        <div className="flex items-center justify-between p-3 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/20">
          <div>
            <div className="text-xs text-white font-medium">자동 이메일 발송 (전역)</div>
            <div className="text-[10px] text-slate-500">꺼두면 모든 캠페인의 자동 발송이 비활성화됩니다</div>
          </div>
          <button
            onClick={() => updateField('auto_email_globally_enabled', settings.auto_email_globally_enabled ? 0 : 1)}
            className={`relative w-10 h-5 rounded-full transition ${settings.auto_email_globally_enabled ? 'bg-emerald-500/60' : 'bg-slate-600'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${settings.auto_email_globally_enabled ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
      </GlassCard>

      {/* YouTube 쿠키 업로드 */}
      <YoutubeCookieSection />

      {/* 키워드 관리 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <KeywordManager
          title="게임 키워드"
          icon={<Hash size={14} className="text-indigo-400" />}
          description="매칭 시그널에서 인식할 게임 이름 (추가 확장용)"
          keywords={gameKeywords}
          onChange={kws => updateField('game_keywords_json', JSON.stringify(kws))}
          color="indigo"
        />
        <KeywordManager
          title="스폰서 키워드"
          icon={<Hash size={14} className="text-amber-400" />}
          description="광고/협찬 패턴 추가 (기본 26개 패턴 외)"
          keywords={sponsorKeywords}
          onChange={kws => updateField('sponsor_keywords_json', JSON.stringify(kws))}
          color="amber"
        />
      </div>

      {/* Info footer */}
      <div className="text-[10px] text-slate-600 text-center">
        마지막 업데이트: {formatDate(settings.updated_at)}
      </div>
    </div>
  );
}

// ─── YouTube 쿠키 섹션 ─────────────────────────────────────────
function YoutubeCookieSection() {
  const [status, setStatus] = useState({ hasCookies: false, loading: true });
  const [cookieText, setCookieText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  const loadStatus = async () => {
    try {
      const res = await authFetch('/yt/status');
      const j = await res.json();
      setStatus({ hasCookies: !!j.hasCookies, loading: false });
    } catch { setStatus({ hasCookies: false, loading: false }); }
  };
  useEffect(() => { loadStatus(); }, []);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCookieText(ev.target.result);
    reader.readAsText(f);
  };

  const upload = async () => {
    if (!cookieText || cookieText.length < 50) {
      setMsg('쿠키 내용이 너무 짧습니다');
      return;
    }
    setUploading(true);
    try {
      const res = await authFetch('/yt/upload-cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: cookieText,
      });
      const j = await res.json();
      setMsg(j.ok ? '✅ 쿠키 업로드 성공!' : '❌ ' + j.error);
      if (j.ok) loadStatus();
    } catch (e) { setMsg('❌ ' + e.message); }
    setUploading(false);
    setTimeout(() => setMsg(''), 5000);
  };

  return (
    <GlassCard className="p-5">
      <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
        <Cookie size={14} className="text-amber-400" /> YouTube 쿠키 (Transcript 봇 차단 우회)
      </h3>
      <p className="text-[10px] text-slate-500 mb-4">
        YouTube가 데이터센터 IP에서의 자막 다운로드를 차단합니다. 본인 YouTube 로그인 쿠키를 업로드하면
        Transcript 자동 추출이 정상 작동합니다.
      </p>

      {/* 현재 상태 */}
      <div className={`mb-4 p-3 rounded-lg border flex items-center gap-3 ${status.hasCookies ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
        {status.hasCookies ? (
          <>
            <Cookie size={14} className="text-emerald-400" />
            <span className="text-xs text-emerald-300">쿠키 등록됨 (Transcript 자동 추출 가능)</span>
          </>
        ) : (
          <>
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-xs text-amber-300">쿠키 없음 — Transcript 자동 추출이 봇 차단으로 실패할 수 있습니다</span>
          </>
        )}
      </div>

      {/* 가이드 */}
      <details className="mb-3 p-3 rounded bg-[#0a0e1a]/50 border border-[#374766]/20 text-[10px] text-slate-400">
        <summary className="cursor-pointer text-slate-300 font-medium">📖 쿠키 추출 방법</summary>
        <ol className="mt-2 ml-4 space-y-1 list-decimal">
          <li>크롬 확장 <a className="text-indigo-400 underline" href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc" target="_blank" rel="noopener noreferrer">"Get cookies.txt LOCALLY"</a> 설치</li>
          <li>YouTube에 로그인된 상태에서 youtube.com 접속</li>
          <li>확장 아이콘 클릭 → "Export" → cookies.txt 다운로드</li>
          <li>아래 파일 선택 또는 텍스트 붙여넣기 → "업로드"</li>
        </ol>
      </details>

      {/* 업로드 영역 */}
      <div className="space-y-2">
        <input
          type="file"
          accept=".txt"
          onChange={handleFile}
          className="block w-full text-[10px] text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-indigo-500/20 file:text-indigo-300 file:text-[10px] hover:file:bg-indigo-500/30"
        />
        <textarea
          value={cookieText}
          onChange={e => setCookieText(e.target.value)}
          placeholder="또는 cookies.txt 내용을 직접 붙여넣기..."
          rows={4}
          className="w-full px-2.5 py-1.5 rounded bg-[#111827] border border-[#374766]/40 text-[10px] text-slate-300 font-mono focus:outline-none focus:border-indigo-500/60"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={upload}
            disabled={uploading || !cookieText}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/25 disabled:opacity-50"
          >
            <Upload size={12} /> {uploading ? '업로드 중...' : '쿠키 업로드'}
          </button>
          {msg && <span className="text-[10px] text-slate-300">{msg}</span>}
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Keyword Manager ─────────────────────────────────────────
function KeywordManager({ title, icon, description, keywords, onChange, color }) {
  const [input, setInput] = useState('');

  const add = () => {
    const k = input.trim();
    if (!k) return;
    if (keywords.includes(k)) return;
    onChange([...keywords, k]);
    setInput('');
  };

  const remove = (idx) => onChange(keywords.filter((_, i) => i !== idx));

  const colorMap = {
    indigo: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  };

  return (
    <GlassCard className="p-5">
      <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
        {icon} {title}
      </h3>
      <div className="text-[10px] text-slate-500 mb-3">{description}</div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="키워드 입력 후 Enter"
          className="flex-1 px-2 py-1.5 rounded bg-[#111827] border border-[#374766]/40 text-xs text-white focus:outline-none focus:border-indigo-500/60"
        />
        <button onClick={add} className="px-3 py-1.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/25 transition">
          <Plus size={12} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 min-h-[60px]">
        {keywords.length === 0 ? (
          <span className="text-[10px] text-slate-600">추가된 키워드 없음</span>
        ) : keywords.map((k, i) => (
          <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${colorMap[color]}`}>
            {k}
            <button onClick={() => remove(i)} className="hover:text-white transition">
              <X size={9} />
            </button>
          </span>
        ))}
      </div>
    </GlassCard>
  );
}

function parseJsonArray(str) {
  try { return JSON.parse(str || '[]'); } catch { return []; }
}
function parseJsonObj(str) {
  try { return JSON.parse(str || '{}'); } catch { return {}; }
}
function formatDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
