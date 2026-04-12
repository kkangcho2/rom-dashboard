import { Clock, Megaphone, Users, MessageCircle, CheckCircle, Eye, AlertCircle, ShieldCheck } from 'lucide-react';

const STATES = {
  draft:       { label: '작성 중',   color: 'bg-slate-500/15 text-slate-400 border-slate-500/20',   Icon: Clock },
  published:   { label: '공개',      color: 'bg-blue-500/15 text-blue-400 border-blue-500/20',      Icon: Megaphone },
  matching:    { label: '매칭 중',   color: 'bg-amber-500/15 text-amber-400 border-amber-500/20',   Icon: Users },
  negotiating: { label: '협의 중',   color: 'bg-purple-500/15 text-purple-400 border-purple-500/20', Icon: MessageCircle },
  accepted:    { label: '수락됨',    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', Icon: CheckCircle },
  confirmed:   { label: '확정',      color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20', Icon: CheckCircle },
  live:        { label: 'LIVE',      color: 'bg-red-500/15 text-red-400 border-red-500/20',         Icon: Eye, pulse: true },
  completed:   { label: '완료',      color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', Icon: CheckCircle },
  verified:    { label: '검증 완료', color: 'bg-green-500/15 text-green-400 border-green-500/20',   Icon: ShieldCheck },
  closed:      { label: '종료',      color: 'bg-slate-500/15 text-slate-400 border-slate-500/20',   Icon: AlertCircle },
};

export default function StateBadge({ state }) {
  const s = STATES[state] || STATES.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.color} ${s.pulse ? 'animate-pulse' : ''}`}>
      <s.Icon className="w-3 h-3" /> {s.label}
    </span>
  );
}
