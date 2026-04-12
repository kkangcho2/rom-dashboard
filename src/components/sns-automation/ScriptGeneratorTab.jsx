import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Edit3, Check, X, Copy, Sparkles, FileText, Hash, ClipboardCheck
} from 'lucide-react';
import { GlassCard } from '../shared';
import { getScripts, createScript, updateScript, deleteScript, getIndustryTemplates } from '../../api';

const STATUS_MAP = {
  draft: { label: '초안', color: 'bg-slate-500/20 text-slate-300' },
  review: { label: '검토 중', color: 'bg-amber-500/20 text-amber-300' },
  approved: { label: '승인', color: 'bg-green-500/20 text-green-300' },
  used: { label: '사용 완료', color: 'bg-indigo-500/20 text-indigo-300' },
};

export default function ScriptGeneratorTab({ selectedIndustry }) {
  const [scripts, setScripts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [form, setForm] = useState({
    title: '', prompt_template: '', generated_script: '', hashtags: '', status: 'draft',
  });

  const loadScripts = async () => {
    const params = {};
    if (selectedIndustry) params.industry = selectedIndustry;
    const data = await getScripts(params);
    setScripts(Array.isArray(data) ? data : []);
  };

  const loadTemplates = async () => {
    if (!selectedIndustry) return;
    const data = await getIndustryTemplates({ industry: selectedIndustry });
    setTemplates(Array.isArray(data) ? data : []);
  };

  useEffect(() => { loadScripts(); }, [selectedIndustry]);
  useEffect(() => { loadTemplates(); }, [selectedIndustry]);

  const handleSubmit = async () => {
    if (!form.title.trim() && !form.generated_script.trim()) return;
    if (editingId) {
      await updateScript(editingId, form);
    } else {
      await createScript({ ...form, industry: selectedIndustry || 'beauty_salon' });
    }
    setForm({ title: '', prompt_template: '', generated_script: '', hashtags: '', status: 'draft' });
    setShowForm(false);
    setEditingId(null);
    loadScripts();
  };

  const handleEdit = (script) => {
    setEditingId(script.id);
    setForm({
      title: script.title || '', prompt_template: script.prompt_template || '',
      generated_script: script.generated_script || '', hashtags: script.hashtags || '', status: script.status,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    await deleteScript(id);
    loadScripts();
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const applyTemplate = (tpl) => {
    setForm(f => ({ ...f, prompt_template: tpl.prompt_content, title: f.title || tpl.name }));
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      {/* 프롬프트 템플릿 선택 */}
      {templates.length > 0 && (
        <GlassCard className="p-4">
          <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" />
            프롬프트 템플릿 (클릭하여 적용)
          </h3>
          <div className="flex flex-wrap gap-2">
            {templates.map(tpl => (
              <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                className="px-3 py-1.5 rounded-lg bg-dark-700/60 border border-dark-600/40 text-[11px] text-slate-300 hover:border-purple-500/40 hover:text-purple-300 transition-all">
                {tpl.name}
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{scripts.length}개 스크립트</p>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ title: '', prompt_template: '', generated_script: '', hashtags: '', status: 'draft' }); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-medium hover:bg-purple-500/30 transition-all">
          <Plus size={13} /> 스크립트 작성
        </button>
      </div>

      {/* 입력 폼 */}
      {showForm && (
        <GlassCard className="p-4 space-y-3 border-purple-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white">{editingId ? '스크립트 수정' : '새 스크립트'}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-slate-500 hover:text-white"><X size={14} /></button>
          </div>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="제목 (영상 제목)"
            className="w-full bg-dark-700 border border-dark-600/40 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500/50" />
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">AI 프롬프트 (ChatGPT/Claude에 전달할 지시문)</label>
            <textarea value={form.prompt_template} onChange={e => setForm(f => ({ ...f, prompt_template: e.target.value }))} placeholder="프롬프트를 입력하세요..." rows={4}
              className="w-full bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500/50 resize-none font-mono" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">생성된 스크립트</label>
            <textarea value={form.generated_script} onChange={e => setForm(f => ({ ...f, generated_script: e.target.value }))} placeholder="AI가 생성한 스크립트 또는 직접 작성..." rows={6}
              className="w-full bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500/50 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))} placeholder="#해시태그 #입력"
              className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500/50" />
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-500/50">
              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <button onClick={handleSubmit}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-500 text-white rounded-lg text-xs font-semibold hover:bg-purple-600 transition-all">
            <Check size={13} /> {editingId ? '수정 완료' : '저장'}
          </button>
        </GlassCard>
      )}

      {/* 스크립트 목록 */}
      <div className="space-y-2">
        {scripts.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xs">
            스크립트가 없습니다. 템플릿을 선택하거나 직접 작성하세요.
          </div>
        )}
        {scripts.map(script => {
          const st = STATUS_MAP[script.status] || STATUS_MAP.draft;
          return (
            <GlassCard key={script.id} className="p-4 space-y-2 group hover:border-purple-500/30 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    {script.plan_title && <span className="text-[10px] text-slate-500">({script.plan_title})</span>}
                  </div>
                  <h4 className="text-sm font-semibold text-white">{script.title || '제목 없음'}</h4>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => handleEdit(script)} className="p-1.5 rounded-md hover:bg-dark-600/60 text-slate-400 hover:text-white"><Edit3 size={12} /></button>
                  <button onClick={() => handleDelete(script.id)} className="p-1.5 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-400"><Trash2 size={12} /></button>
                </div>
              </div>
              {script.prompt_template && (
                <div className="relative">
                  <p className="text-[10px] text-slate-500 mb-1">프롬프트:</p>
                  <div className="bg-dark-700/80 rounded-lg p-2 text-[11px] text-slate-400 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {script.prompt_template}
                  </div>
                  <button onClick={() => handleCopy(script.prompt_template, `p-${script.id}`)}
                    className="absolute top-6 right-2 p-1 rounded hover:bg-dark-600 text-slate-500 hover:text-white">
                    {copiedId === `p-${script.id}` ? <ClipboardCheck size={11} className="text-green-400" /> : <Copy size={11} />}
                  </button>
                </div>
              )}
              {script.generated_script && (
                <div className="relative">
                  <p className="text-[10px] text-slate-500 mb-1">스크립트:</p>
                  <div className="bg-dark-700/80 rounded-lg p-2 text-[11px] text-slate-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {script.generated_script}
                  </div>
                  <button onClick={() => handleCopy(script.generated_script, `s-${script.id}`)}
                    className="absolute top-6 right-2 p-1 rounded hover:bg-dark-600 text-slate-500 hover:text-white">
                    {copiedId === `s-${script.id}` ? <ClipboardCheck size={11} className="text-green-400" /> : <Copy size={11} />}
                  </button>
                </div>
              )}
              {script.hashtags && (
                <div className="flex items-center gap-1.5 text-[10px] text-indigo-300">
                  <Hash size={10} /> {script.hashtags}
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
