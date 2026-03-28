// ─── Shared Components ───────────────────────────────────────
import { MonitorPlay, Tv } from 'lucide-react';

export const COLORS_COMPARE = ['#6366f1', '#f59e0b', '#22c55e'];

export function GlassCard({ children, className = '' }) {
  return (
    <div className={`bg-gradient-to-br from-[#111827]/90 to-[#1a2035]/80 border border-[#374766]/50 backdrop-blur-xl rounded-xl ${className}`}>
      {children}
    </div>
  );
}

export const MiniTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#1a2035] border border-[#374766]/50 rounded-lg p-2 text-[10px] shadow-xl">
        <p className="text-slate-300 font-medium">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-slate-200">{p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export function GradeTag({ grade }) {
  const map = {
    S: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
    A: 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white',
    B: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
    C: 'bg-gradient-to-r from-slate-500 to-slate-600 text-white',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${map[grade]}`}>{grade}등급</span>
  );
}

export function PlatformIcon({ platform, size = 14 }) {
  if (platform === 'youtube') return <MonitorPlay size={size} className="text-red-400" />;
  return <Tv size={size} className="text-blue-400" />;
}
