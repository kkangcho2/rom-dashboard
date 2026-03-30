export function SeverityBadge({ severity }) {
  const map = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase ${map[severity]}`}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status }) {
  const map = {
    open: 'bg-red-500/20 text-red-400',
    investigating: 'bg-yellow-500/20 text-yellow-400',
    resolved: 'bg-green-500/20 text-green-400',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${map[status]}`}>
      {status}
    </span>
  );
}

export function SentimentBadge({ sentiment }) {
  const cls = sentiment === 'positive' ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : sentiment === 'negative' ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
  const label = sentiment === 'positive' ? '긍정' : sentiment === 'negative' ? '부정' : '중립';
  return <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${cls}`}>{label}</span>;
}
