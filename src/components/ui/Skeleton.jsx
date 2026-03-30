export function SkeletonBox({ className = '' }) {
  return (
    <div className={`animate-pulse bg-dark-700/60 rounded-lg ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="glass-panel rounded-xl p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-dark-700/60" />
        <div className="h-3 w-24 rounded bg-dark-700/60" />
      </div>
      <div className="h-8 w-20 rounded bg-dark-700/60" />
      <div className="h-2 w-32 rounded bg-dark-700/60" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="glass-panel rounded-xl p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-4 h-4 rounded bg-dark-700/60" />
        <div className="h-4 w-40 rounded bg-dark-700/60" />
      </div>
      <div className="h-[280px] rounded-lg bg-dark-700/40 flex items-end gap-1 p-4">
        {[40, 65, 45, 80, 55, 70, 60, 75, 50, 85].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-dark-600/60" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonChart />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="glass-panel rounded-xl overflow-hidden animate-pulse">
      <div className="h-10 bg-dark-700/60 border-b border-dark-600/30" />
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-dark-600/20">
          <div className="h-3 flex-1 rounded bg-dark-700/40" />
          <div className="h-3 w-16 rounded bg-dark-700/40" />
          <div className="h-3 w-16 rounded bg-dark-700/40" />
        </div>
      ))}
    </div>
  );
}
