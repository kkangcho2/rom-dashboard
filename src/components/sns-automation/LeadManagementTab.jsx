import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Edit3, Check, X, Users, UserCheck, UserPlus, Phone,
  MessageCircle, Star, ArrowRight, Filter, Download
} from 'lucide-react';
import { GlassCard } from '../shared';
import { getLeads, createLead, updateLead, deleteLead } from '../../api';

const LEAD_STATUS = {
  new: { label: '신규', color: 'bg-blue-500/20 text-blue-300', icon: UserPlus },
  contacted: { label: '연락 완료', color: 'bg-amber-500/20 text-amber-300', icon: Phone },
  negotiating: { label: '상담 중', color: 'bg-purple-500/20 text-purple-300', icon: MessageCircle },
  converted: { label: '고객 전환', color: 'bg-green-500/20 text-green-300', icon: UserCheck },
  lost: { label: '이탈', color: 'bg-red-500/20 text-red-300', icon: X },
};

const INQUIRY_TYPES = [
  { id: 'price', label: '가격 문의' },
  { id: 'reservation', label: '예약 문의' },
  { id: 'info', label: '정보 문의' },
  { id: 'complaint', label: '불만/클레임' },
  { id: 'other', label: '기타' },
];

const PLATFORM_OPTIONS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'kakao', label: '카카오톡' },
  { id: 'phone', label: '전화' },
  { id: 'other', label: '기타' },
];

export default function LeadManagementTab() {
  const [leads, setLeads] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({
    name: '', contact: '', platform: 'instagram', source: '', inquiry_type: 'info', message: '', status: 'new',
  });
  const [editForm, setEditForm] = useState({ status: '', assigned_to: '', notes: '' });

  const loadLeads = async () => {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    const data = await getLeads(params);
    setLeads(Array.isArray(data) ? data : []);
  };

  useEffect(() => { loadLeads(); }, [filterStatus]);

  const handleSubmit = async () => {
    if (!form.name.trim() && !form.contact.trim()) return;
    await createLead(form);
    setForm({ name: '', contact: '', platform: 'instagram', source: '', inquiry_type: 'info', message: '', status: 'new' });
    setShowForm(false);
    loadLeads();
  };

  const handleUpdateLead = async (id) => {
    const updateData = { ...editForm };
    if (editForm.status === 'converted') updateData.converted_at = new Date().toISOString();
    await updateLead(id, updateData);
    setEditingId(null);
    loadLeads();
  };

  const handleDelete = async (id) => {
    await deleteLead(id);
    loadLeads();
  };

  const startEdit = (lead) => {
    setEditingId(lead.id);
    setEditForm({ status: lead.status, assigned_to: lead.assigned_to || '', notes: lead.notes || '' });
  };

  // 통계
  const stats = Object.entries(LEAD_STATUS).map(([key, val]) => ({
    key, ...val, count: leads.filter(l => l.status === key).length,
  }));

  const handleExportCSV = () => {
    const header = '이름,연락처,플랫폼,유입경로,문의유형,메시지,상태,담당자,메모,생성일\n';
    const rows = leads.map(l =>
      `"${l.name}","${l.contact}","${l.platform}","${l.source}","${l.inquiry_type}","${l.message}","${l.status}","${l.assigned_to || ''}","${l.notes || ''}","${l.created_at}"`
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <button key={s.key} onClick={() => setFilterStatus(f => f === s.key ? '' : s.key)}
              className={`p-3 rounded-xl border transition-all text-left ${filterStatus === s.key ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-dark-700/40 border-dark-600/30 hover:border-dark-500/50'}`}>
              <div className="flex items-center justify-between mb-1">
                <Icon size={14} className="text-slate-400" />
                <span className="text-lg font-bold text-white">{s.count}</span>
              </div>
              <p className="text-[10px] text-slate-400">{s.label}</p>
            </button>
          );
        })}
      </div>

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{leads.length}건 리드</p>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-dark-700/60 border border-dark-600/40 text-slate-400 rounded-lg text-[11px] hover:text-white transition-all">
            <Download size={11} /> CSV 내보내기
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-all">
            <Plus size={13} /> 리드 추가
          </button>
        </div>
      </div>

      {/* 입력 폼 */}
      {showForm && (
        <GlassCard className="p-4 space-y-3 border-green-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white">새 리드 등록</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="고객명"
              className="bg-dark-700 border border-dark-600/40 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-green-500/50" />
            <input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="연락처 (전화/이메일/SNS ID)"
              className="bg-dark-700 border border-dark-600/40 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-green-500/50" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
              className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-green-500/50">
              {PLATFORM_OPTIONS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <select value={form.inquiry_type} onChange={e => setForm(f => ({ ...f, inquiry_type: e.target.value }))}
              className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-green-500/50">
              {INQUIRY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="유입경로 (DM, 댓글 등)"
              className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-green-500/50" />
          </div>
          <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="문의 내용" rows={3}
            className="w-full bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-green-500/50 resize-none" />
          <button onClick={handleSubmit}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600 transition-all">
            <Check size={13} /> 등록
          </button>
        </GlassCard>
      )}

      {/* 리드 목록 */}
      <div className="space-y-2">
        {leads.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xs">리드가 없습니다.</div>
        )}
        {leads.map(lead => {
          const st = LEAD_STATUS[lead.status] || LEAD_STATUS.new;
          const isEditing = editingId === lead.id;
          return (
            <GlassCard key={lead.id} className="p-3 group hover:border-green-500/30 transition-all">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${st.color.replace('text-', 'bg-').replace('300', '500/10')}`}>
                  <Users size={14} className={st.color.split(' ')[1]} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{lead.name || '이름 없음'}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    <span className="text-[10px] text-slate-500">{lead.platform}</span>
                  </div>
                  {lead.contact && <p className="text-[11px] text-slate-400">{lead.contact}</p>}
                  {lead.message && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{lead.message}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-600">
                    {lead.inquiry_type && <span>{INQUIRY_TYPES.find(t => t.id === lead.inquiry_type)?.label || lead.inquiry_type}</span>}
                    {lead.source && <span>via {lead.source}</span>}
                    <span>{lead.created_at?.split('T')[0]}</span>
                  </div>

                  {/* 인라인 편집 */}
                  {isEditing && (
                    <div className="mt-2 p-2 bg-dark-700/60 rounded-lg space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                          className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded px-2 py-1 focus:outline-none">
                          {Object.entries(LEAD_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <input value={editForm.assigned_to} onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="담당자"
                          className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded px-2 py-1 focus:outline-none" />
                      </div>
                      <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="메모" rows={2}
                        className="w-full bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded px-2 py-1 focus:outline-none resize-none" />
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateLead(lead.id)} className="px-3 py-1 bg-green-500 text-white rounded text-[11px] font-medium">저장</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-dark-600 text-slate-300 rounded text-[11px]">취소</button>
                      </div>
                    </div>
                  )}
                  {lead.notes && !isEditing && <p className="text-[10px] text-slate-500 mt-1 italic">memo: {lead.notes}</p>}
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  {!isEditing && (
                    <>
                      <button onClick={() => startEdit(lead)} className="p-1.5 rounded-md hover:bg-dark-600/60 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><Edit3 size={12} /></button>
                      {lead.status !== 'converted' && (
                        <button onClick={async () => { await updateLead(lead.id, { status: 'converted', converted_at: new Date().toISOString() }); loadLeads(); }}
                          className="p-1.5 rounded-md hover:bg-green-500/20 text-slate-400 hover:text-green-400 opacity-0 group-hover:opacity-100 transition-opacity" title="고객 전환">
                          <ArrowRight size={12} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(lead.id)} className="p-1.5 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                    </>
                  )}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
