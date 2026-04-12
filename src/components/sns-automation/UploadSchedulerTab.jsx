import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Check, X, Calendar, Clock, Upload, ExternalLink,
  Music2, Globe
} from 'lucide-react';
import { GlassCard } from '../shared';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule } from '../../api';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', color: 'text-pink-400' },
  { id: 'youtube', label: 'YouTube', color: 'text-red-400' },
  { id: 'tiktok', label: 'TikTok', color: 'text-cyan-400' },
  { id: 'blog', label: '블로그', color: 'text-green-400' },
];

const STATUS_MAP = {
  scheduled: { label: '예약됨', color: 'bg-blue-500/20 text-blue-300' },
  uploading: { label: '업로드 중', color: 'bg-amber-500/20 text-amber-300' },
  published: { label: '게시 완료', color: 'bg-green-500/20 text-green-300' },
  failed: { label: '실패', color: 'bg-red-500/20 text-red-300' },
};

export default function UploadSchedulerTab() {
  const [schedules, setSchedules] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState('');
  const [form, setForm] = useState({
    platform: 'instagram', title: '', description: '', hashtags: '',
    scheduled_at: '', video_url: '',
  });

  const loadSchedules = async () => {
    const params = {};
    if (filterPlatform) params.platform = filterPlatform;
    const data = await getSchedules(params);
    setSchedules(Array.isArray(data) ? data : []);
  };

  useEffect(() => { loadSchedules(); }, [filterPlatform]);

  const handleSubmit = async () => {
    if (!form.scheduled_at) return;
    await createSchedule(form);
    setForm({ platform: 'instagram', title: '', description: '', hashtags: '', scheduled_at: '', video_url: '' });
    setShowForm(false);
    loadSchedules();
  };

  const handleStatusChange = async (id, status) => {
    await updateSchedule(id, { status });
    loadSchedules();
  };

  const handleDelete = async (id) => {
    await deleteSchedule(id);
    loadSchedules();
  };

  // 날짜별 그룹
  const grouped = schedules.reduce((acc, s) => {
    const date = s.scheduled_at?.split('T')[0] || '미정';
    if (!acc[date]) acc[date] = [];
    acc[date].push(s);
    return acc;
  }, {});

  const getPlatformColor = (p) => PLATFORMS.find(pl => pl.id === p)?.color || 'text-slate-400';

  return (
    <div className="space-y-4">
      {/* 필터 + 추가 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {PLATFORMS.map(p => (
            <button key={p.id} onClick={() => setFilterPlatform(f => f === p.id ? '' : p.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${filterPlatform === p.id ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-dark-700/60 border-dark-600/40 text-slate-400 hover:text-white'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-medium hover:bg-cyan-500/30 transition-all">
          <Plus size={13} /> 업로드 예약
        </button>
      </div>

      {/* 입력 폼 */}
      {showForm && (
        <GlassCard className="p-4 space-y-3 border-cyan-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white">업로드 예약 등록</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white"><X size={14} /></button>
          </div>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="게시물 제목"
            className="w-full bg-dark-700 border border-dark-600/40 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500/50" />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="게시물 설명" rows={3}
            className="w-full bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500/50 resize-none" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
              className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500/50">
              {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
              className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500/50" />
            <input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} placeholder="영상 URL (Google Drive 등)"
              className="bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500/50" />
          </div>
          <input value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))} placeholder="#해시태그"
            className="w-full bg-dark-700 border border-dark-600/40 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500/50" />
          <button onClick={handleSubmit}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500 text-white rounded-lg text-xs font-semibold hover:bg-cyan-600 transition-all">
            <Check size={13} /> 예약 등록
          </button>
        </GlassCard>
      )}

      {/* 타임라인 뷰 */}
      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-12 text-slate-500 text-xs">업로드 예약이 없습니다.</div>
      )}
      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={12} className="text-cyan-400" />
            <span className="text-xs font-bold text-white">{date}</span>
            <span className="text-[10px] text-slate-500">{items.length}건</span>
          </div>
          <div className="space-y-2 ml-5 border-l border-dark-600/40 pl-4">
            {items.map(item => {
              const st = STATUS_MAP[item.status] || STATUS_MAP.scheduled;
              return (
                <GlassCard key={item.id} className="p-3 group hover:border-cyan-500/30 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold ${getPlatformColor(item.platform)}`}>{item.platform}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Clock size={9} /> {item.scheduled_at?.split('T')[1]?.substring(0, 5) || ''}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-white">{item.title || '제목 없음'}</h4>
                      {item.description && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{item.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.status === 'scheduled' && (
                        <button onClick={() => handleStatusChange(item.id, 'published')}
                          className="p-1.5 rounded-md hover:bg-green-500/20 text-slate-400 hover:text-green-400" title="게시 완료로 변경">
                          <Upload size={12} />
                        </button>
                      )}
                      {item.post_url && (
                        <a href={item.post_url} target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-md hover:bg-dark-600/60 text-slate-400 hover:text-white">
                          <ExternalLink size={12} />
                        </a>
                      )}
                      <button onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
