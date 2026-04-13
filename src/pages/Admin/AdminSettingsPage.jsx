/**
 * AdminSettingsPage — 시스템 설정 (threshold, retry, keywords 등)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Settings, Save, RefreshCw, Zap, Clock, Mail, Hash, Plus, X
} from 'lucide-react';
import { GlassCard } from '../../components/shared';
import { getSettings, updateSettings } from '../../services/admin-automation-api';

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
        <div className="mt-4 p-3 rounded-lg bg-[#0a0e1a]/50 border border-[#374766]/20">
          <div className="text-xs text-white font-medium mb-3">매칭 시그널 가중치 커스터마이징</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {['channel_match','date_window','target_game_title_match','detected_game_match','sponsor_pattern','banner_detected','transcript_target_mention','chat_target_mention'].map(sig => (
              <div key={sig}>
                <label className="text-[10px] text-slate-400">{sig}</label>
                <input
                  type="number" step="0.01" min="0" max="1"
                  value={customWeights[sig] ?? ''}
                  placeholder="default"
                  onChange={e => {
                    const newWeights = { ...customWeights };
                    if (e.target.value === '') delete newWeights[sig];
                    else newWeights[sig] = parseFloat(e.target.value);
                    updateField('custom_weights_json', JSON.stringify(newWeights));
                  }}
                  className="w-full px-2 py-1 rounded bg-[#111827] border border-[#374766]/40 text-[10px] text-white focus:outline-none focus:border-indigo-500/60"
                />
              </div>
            ))}
          </div>
          <div className="text-[9px] text-slate-600 mt-2">
            빈 값 = 기본 가중치 사용 (channel:0.25, date:0.15, title:0.20, game:0.10, sponsor:0.08, banner:0.15, transcript:0.05, chat:0.02)
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
