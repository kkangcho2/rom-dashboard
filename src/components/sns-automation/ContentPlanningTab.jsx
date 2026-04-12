import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Edit3, Check, X, Filter, Music2,
  Lightbulb, FileText, Video, Image as ImageIcon, Calendar
} from 'lucide-react';
import { GlassCard } from '../shared';
import { getContentPlans, createContentPlan, updateContentPlan, deleteContentPlan, getIndustryTemplates } from '../../api';

const INDUSTRIES = [
  { id: 'beauty_salon', label: '미용실', color: 'pink' },
  { id: 'hospital', label: '병원', color: 'blue' },
  { id: 'fitness', label: '헬스/PT', color: 'green' },
  { id: 'restaurant', label: '카페/레스토랑', color: 'amber' },
  { id: 'education', label: '학원/교육', color: 'purple' },
];

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'blog', label: '블로그' },
];

const STATUS_MAP = {
  idea: { label: '아이디어', color: 'bg-slate-500/20 text-slate-300' },
  planned: { label: '기획 완료', color: 'bg-blue-500/20 text-blue-300' },
  in_production: { label: '제작 중', color: 'bg-amber-500/20 text-amber-300' },
  ready: { label: '업로드 대기', color: 'bg-green-500/20 text-green-300' },
  published: { label: '게시 완료', color: 'bg-indigo-500/20 text-indigo-300' },
};

const CONTENT_TYPES = [
  { id: 'video', label: '영상', icon: Video },
  { id: 'image', label: '이미지', icon: ImageIcon },
  { id: 'text', label: '텍스트', icon: FileText },
  { id: 'reel', label: '릴스/숏츠', icon: Music2 },
];

export default function ContentPlanningTab({ selectedIndustry }) {
  const [plans, setPlans] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '', description: '', content_type: 'video', target_platform: 'instagram',
    status: 'idea', tags: '', scheduled_date: '',
  });

  const loadPlans = async () => {
    const params = {};
    if (selectedIndustry) params.industry = selectedIndustry;
    if (filterStatus) params.status = filterStatus;
    const data = await getContentPlans(params);
    setPlans(Array.isArray(data) ? data : []);
  };

  const loadTemplates = async () => {
    if (!selectedIndustry) return;
    const data = await getIndustryTemplates({ industry: selectedIndustry, template_type: 'content_planning' });
    setTemplates(Array.isArray(data) ? data : []);
  };

  useEffect(() => { loadPlans(); }, [selectedIndustry, filterStatus]);
  useEffect(() => { loadTemplates(); }, [selectedIndustry]);

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    if (editingId) {
      await updateContentPlan(editingId, form);
    } else {
      await createContentPlan({ ...form, industry: selectedIndustry || 'beauty_salon' });
    }
    setForm({ title: '', description: '', content_type: 'video', target_platform: 'instagram', status: 'idea', tags: '', scheduled_date: '' });
    setShowForm(false);
    setEditingId(null);
    loadPlans();
  };

  const handleEdit = (plan) => {
    setEditingId(plan.id);
    setForm({
      title: plan.title, description: plan.description || '', content_type: plan.content_type,
      target_platform: plan.target_platform, status: plan.status, tags: plan.tags || '', scheduled_date: plan.scheduled_date || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    await deleteContentPlan(id);
    loadPlans();
  };

  const applyTemplate = (tpl) => {
    setForm(f => ({ ...f, description: tpl.prompt_content, title: f.title || tpl.name }));
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      {/* 업종별 프롬프트 템플릿 */}
      {templates.length > 0 && (
        <GlassCard className="p-4">
          <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Lightbulb size={14} className="text-amber-400" />
            업종 프롬프트 템플릿
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {templates.map(tpl => (
              <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                className="text-left p-3 rounded-lg bg-dark-700/60 border border-dark-600/40 hover:border-indigo-500/40 transition-all group">
                <p className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors">{tpl.name}</p>
                <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{tpl.prompt_content.substring(0, 80)}...</p>
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* 필터 + 추가 버튼 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-slate-400" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500/50">
            <option value="">전체 상태</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ title: '', description: '', content_type: 'video', target_platform: 'instagram', status: 'idea', tags: '', scheduled_date: '' }); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-medium hover:bg-indigo-500/30 transition-all">
          <Plus size={13} /> 콘텐츠 추가
        </button>
      </div>

      {/* 입력 폼 */}
      {showForm && (
        <GlassCard className="p-4 space-y-3 border-indigo-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white">{editingId ? '콘텐츠 수정' : '새 콘텐츠 기획'}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-slate-500 hover:text-white"><X size={14} /></button>
          </div>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="콘텐츠 제목"
            className="w-full bg-dark-700 border border-dark-600/40 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500/50" />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="설명 / 프롬프트" rows={4}
            className="w-full bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500/50 resize-none" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select value={form.content_type} onChange={e => setForm(f => ({ ...f, content_type: e.target.value }))}
              className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500/50">
              {CONTENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <select value={form.target_platform} onChange={e => setForm(f => ({ ...f, target_platform: e.target.value }))}
              className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500/50">
              {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500/50">
              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
              className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500/50" />
          </div>
          <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="태그 (쉼표 구분)"
            className="w-full bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500/50" />
          <button onClick={handleSubmit}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 text-white rounded-lg text-xs font-semibold hover:bg-indigo-600 transition-all">
            <Check size={13} /> {editingId ? '수정 완료' : '추가'}
          </button>
        </GlassCard>
      )}

      {/* 콘텐츠 목록 */}
      <div className="space-y-2">
        {plans.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xs">
            아직 콘텐츠 기획이 없습니다. 위 버튼으로 추가하세요.
          </div>
        )}
        {plans.map(plan => {
          const st = STATUS_MAP[plan.status] || STATUS_MAP.idea;
          return (
            <GlassCard key={plan.id} className="p-3 flex items-start gap-3 group hover:border-indigo-500/30 transition-all">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                  <span className="text-[10px] text-slate-500">{plan.target_platform}</span>
                  <span className="text-[10px] text-slate-600">{plan.content_type}</span>
                </div>
                <h4 className="text-sm font-semibold text-white truncate">{plan.title}</h4>
                {plan.description && <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{plan.description}</p>}
                {plan.tags && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {plan.tags.split(',').filter(Boolean).map((tag, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-300 rounded">{tag.trim()}</span>
                    ))}
                  </div>
                )}
                {plan.scheduled_date && (
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-500">
                    <Calendar size={10} /> {plan.scheduled_date}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => handleEdit(plan)} className="p-1.5 rounded-md hover:bg-dark-600/60 text-slate-400 hover:text-white"><Edit3 size={12} /></button>
                <button onClick={() => handleDelete(plan.id)} className="p-1.5 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-400"><Trash2 size={12} /></button>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
