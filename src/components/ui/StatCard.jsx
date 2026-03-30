export default function StatCard({ icon: Icon, label, value, sub, color = 'text-accent-light', delay = 0 }) {
  return (
    <div
      className="glass-panel rounded-xl p-4 flex flex-col gap-1 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={color} />
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
