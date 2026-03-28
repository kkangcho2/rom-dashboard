import { useState } from 'react';
import {
  Mail, Receipt, Users, Zap, Plus, Trash2
} from 'lucide-react';
import { GlassCard } from './shared';

export default function TeamSettingsPage() {
  const [inviteEmail, setInviteEmail] = useState('');
  const [members, setMembers] = useState([]);

  const roleColors = { admin: 'bg-red-500/20 text-red-400', editor: 'bg-blue-500/20 text-blue-400', viewer: 'bg-slate-500/20 text-slate-400' };
  const roleLabels = { admin: '관리자', editor: '에디터', viewer: '뷰어' };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Plan Info */}
      <GlassCard className="p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Receipt size={16} className="text-indigo-400" /> 내 플랜 정보</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-[#1a2035]/50 rounded-lg p-4">
            <div className="text-[10px] text-slate-500 mb-1">현재 플랜</div>
            <div className="flex items-center gap-2"><Zap size={14} className="text-indigo-400" /><span className="text-sm font-bold text-white">-</span></div>
          </div>
          <div className="bg-[#1a2035]/50 rounded-lg p-4">
            <div className="text-[10px] text-slate-500 mb-1">다음 결제일</div>
            <div className="text-sm font-bold text-white">-</div>
            <div className="text-[10px] text-slate-500">결제 연동 후 표시</div>
          </div>
          <div className="bg-[#1a2035]/50 rounded-lg p-4">
            <div className="text-[10px] text-slate-500 mb-1">팀원</div>
            <div className="text-sm font-bold text-white">{members.length}명</div>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">분석 사용량</span><span className="text-slate-500">- / -</span></div>
            <div className="h-2 bg-[#1a2035] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: '0%' }} /></div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">API 호출</span><span className="text-slate-500">- / -</span></div>
            <div className="h-2 bg-[#1a2035] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" style={{ width: '0%' }} /></div>
          </div>
        </div>
      </GlassCard>

      {/* Team Members */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Users size={16} className="text-blue-400" /> 팀원 관리</h3>
        </div>
        {/* Invite */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="email" placeholder="이메일 주소로 초대" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full bg-[#1a2035] border border-[#374766]/50 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
          </div>
          <select className="bg-[#1a2035] border border-[#374766]/50 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none">
            <option>에디터</option><option>뷰어</option>
          </select>
          <button onClick={() => { if (inviteEmail) { setMembers([...members, { id: Date.now(), name: inviteEmail.split('@')[0], email: inviteEmail, role: 'editor', avatar: inviteEmail[0].toUpperCase() }]); setInviteEmail(''); }}} className="px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors flex items-center gap-1">
            <Plus size={12} /> 초대
          </button>
        </div>
        {/* Members List */}
        <div className="space-y-2">
          {members.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-slate-500 text-xs">
              팀원이 없습니다. 이메일로 초대하세요.
            </div>
          ) : members.map(m => (
            <div key={m.id} className="flex items-center justify-between bg-[#1a2035]/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center text-xs font-bold text-white">{m.avatar}</div>
                <div>
                  <div className="text-xs font-medium text-white">{m.name}</div>
                  <div className="text-[10px] text-slate-500">{m.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${roleColors[m.role]}`}>{roleLabels[m.role]}</span>
                {m.role !== 'admin' && (
                  <button onClick={() => setMembers(members.filter(x => x.id !== m.id))} className="p-1 rounded hover:bg-red-500/20 transition-colors"><Trash2 size={12} className="text-slate-500 hover:text-red-400" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
