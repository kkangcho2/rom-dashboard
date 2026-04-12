/**
 * MetricBox - glass-panel 스타일 지표 박스
 * 기존 StatCard 패턴 + 마켓플레이스 컴팩트 버전
 */
export default function MetricBox({ icon: Icon, label, value, sub, color = 'from-indigo-500 to-blue-500', delay = 0 }) {
  return (
    <div
      className="glass-panel rounded-xl p-4 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {Icon && (
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-2.5`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      )}
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-slate-600 mt-1">{sub}</div>}
    </div>
  );
}
