import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Edit3, Check, X, MessageSquare, Mail, ToggleLeft, ToggleRight,
  Copy, ClipboardCheck, Zap, AlertCircle
} from 'lucide-react';
import { GlassCard } from '../shared';
import { getAutoResponses, createAutoResponse, updateAutoResponse, deleteAutoResponse, getIndustryTemplates } from '../../api';

const TRIGGER_TYPES = [
  { id: 'comment', label: '댓글', icon: MessageSquare, desc: '게시물 댓글에 자동 응답' },
  { id: 'dm', label: 'DM', icon: Mail, desc: '다이렉트 메시지에 자동 응답' },
  { id: 'mention', label: '멘션', icon: Zap, desc: '멘션/태그 시 자동 응답' },
];

const PLATFORM_OPTIONS = [
  { id: 'all', label: '전체' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'tiktok', label: 'TikTok' },
];

export default function AutoResponseTab({ selectedIndustry }) {
  const [responses, setResponses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [form, setForm] = useState({
    trigger_type: 'comment', trigger_keywords: '', response_template: '', platform: 'all', is_active: 1,
  });

  const loadResponses = async () => {
    const params = {};
    if (selectedIndustry) params.industry = selectedIndustry;
    if (filterType) params.trigger_type = filterType;
    const data = await getAutoResponses(params);
    setResponses(Array.isArray(data) ? data : []);
  };

  const loadTemplates = async () => {
    if (!selectedIndustry) return;
    const data = await getIndustryTemplates({ industry: selectedIndustry, template_type: 'customer_response' });
    setTemplates(Array.isArray(data) ? data : []);
  };

  useEffect(() => { loadResponses(); }, [selectedIndustry, filterType]);
  useEffect(() => { loadTemplates(); }, [selectedIndustry]);

  const handleSubmit = async () => {
    if (!form.response_template.trim()) return;
    if (editingId) {
      await updateAutoResponse(editingId, form);
    } else {
      await createAutoResponse({ ...form, industry: selectedIndustry || 'beauty_salon' });
    }
    setForm({ trigger_type: 'comment', trigger_keywords: '', response_template: '', platform: 'all', is_active: 1 });
    setShowForm(false);
    setEditingId(null);
    loadResponses();
  };

  const handleEdit = (r) => {
    setEditingId(r.id);
    setForm({
      trigger_type: r.trigger_type, trigger_keywords: r.trigger_keywords || '',
      response_template: r.response_template, platform: r.platform || 'all', is_active: r.is_active,
    });
    setShowForm(true);
  };

  const handleToggleActive = async (r) => {
    await updateAutoResponse(r.id, { is_active: r.is_active ? 0 : 1 });
    loadResponses();
  };

  const handleDelete = async (id) => {
    await deleteAutoResponse(id);
    loadResponses();
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const applyTemplate = (tpl) => {
    setForm(f => ({ ...f, response_template: tpl.prompt_content }));
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      {/* 고객응대 템플릿 */}
      {templates.length > 0 && (
        <GlassCard className="p-4">
          <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Zap size={14} className="text-amber-400" />
            고객응대 프롬프트 템플릿
          </h3>
          <div className="flex flex-wrap gap-2">
            {templates.map(tpl => (
              <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                className="px-3 py-1.5 rounded-lg bg-dark-700/60 border border-dark-600/40 text-[11px] text-slate-300 hover:border-amber-500/40 hover:text-amber-300 transition-all">
                {tpl.name}
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* 시나리오 안내 */}
      <GlassCard className="p-3 border-amber-500/20">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <div className="text-[11px] text-slate-400">
            <p className="font-semibold text-amber-300 mb-1">Zapier 연동 시나리오</p>
            <p>1. Instagram/TikTok 댓글 발생 → 2. 키워드 분석 → 3. ChatGPT 답변 생성 → 4. 자동/승인 후 댓글 등록</p>
            <p className="mt-1">DM 수신 → 키워드 분석 (가격, 예약 등) → ChatGPT 답변 생성 → Google Sheets 고객 정보 저장</p>
          </div>
        </div>
      </GlassCard>

      {/* 필터 + 추가 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {TRIGGER_TYPES.map(t => (
            <button key={t.id} onClick={() => setFilterType(f => f === t.id ? '' : t.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${filterType === t.id ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-dark-700/60 border-dark-600/40 text-slate-400 hover:text-white'}`}>
              <t.icon size={11} /> {t.label}
            </button>
          ))}
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ trigger_type: 'comment', trigger_keywords: '', response_template: '', platform: 'all', is_active: 1 }); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium hover:bg-amber-500/30 transition-all">
          <Plus size={13} /> 응대 규칙 추가
        </button>
      </div>

      {/* 입력 폼 */}
      {showForm && (
        <GlassCard className="p-4 space-y-3 border-amber-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white">{editingId ? '응대 규칙 수정' : '새 자동응대 규칙'}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-slate-500 hover:text-white"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <select value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))}
              className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500/50">
              {TRIGGER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label} - {t.desc}</option>)}
            </select>
            <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
              className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500/50">
              {PLATFORM_OPTIONS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <input value={form.trigger_keywords} onChange={e => setForm(f => ({ ...f, trigger_keywords: e.target.value }))} placeholder="트리거 키워드 (쉼표 구분: 가격, 예약, 위치, 시간)"
            className="w-full bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/50" />
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">응대 템플릿 (변수: {'{고객 문의}'}, {'{고객명}'})</label>
            <textarea value={form.response_template} onChange={e => setForm(f => ({ ...f, response_template: e.target.value }))} placeholder="자동 응대 메시지 템플릿..." rows={5}
              className="w-full bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/50 resize-none" />
          </div>
          <button onClick={handleSubmit}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition-all">
            <Check size={13} /> {editingId ? '수정 완료' : '추가'}
          </button>
        </GlassCard>
      )}

      {/* 응대 규칙 목록 */}
      <div className="space-y-2">
        {responses.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xs">자동응대 규칙이 없습니다.</div>
        )}
        {responses.map(r => {
          const triggerInfo = TRIGGER_TYPES.find(t => t.id === r.trigger_type) || TRIGGER_TYPES[0];
          const TriggerIcon = triggerInfo.icon;
          return (
            <GlassCard key={r.id} className={`p-3 group transition-all ${r.is_active ? 'hover:border-amber-500/30' : 'opacity-50'}`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${r.is_active ? 'bg-amber-500/10' : 'bg-dark-700/60'}`}>
                  <TriggerIcon size={16} className={r.is_active ? 'text-amber-400' : 'text-slate-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-slate-300">{triggerInfo.label}</span>
                    <span className="text-[10px] text-slate-500">{r.platform}</span>
                    {r.use_count > 0 && <span className="text-[10px] text-slate-600">{r.use_count}회 사용</span>}
                  </div>
                  {r.trigger_keywords && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {r.trigger_keywords.split(',').filter(Boolean).map((kw, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-300 rounded">{kw.trim()}</span>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <div className="bg-dark-700/80 rounded-lg p-2 text-[11px] text-slate-300 whitespace-pre-wrap max-h-24 overflow-y-auto">
                      {r.response_template}
                    </div>
                    <button onClick={() => handleCopy(r.response_template, r.id)}
                      className="absolute top-1 right-1 p-1 rounded hover:bg-dark-600 text-slate-500 hover:text-white">
                      {copiedId === r.id ? <ClipboardCheck size={11} className="text-green-400" /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <button onClick={() => handleToggleActive(r)} className="p-1 text-slate-400 hover:text-white" title={r.is_active ? '비활성화' : '활성화'}>
                    {r.is_active ? <ToggleRight size={18} className="text-green-400" /> : <ToggleLeft size={18} />}
                  </button>
                  <button onClick={() => handleEdit(r)} className="p-1.5 rounded-md hover:bg-dark-600/60 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><Edit3 size={12} /></button>
                  <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
