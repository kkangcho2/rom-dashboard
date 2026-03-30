export default function SentimentGauge({ score }) {
  const getColor = (s) => {
    if (s >= 70) return '#22c55e';
    if (s >= 50) return '#f59e0b';
    return '#ef4444';
  };
  const color = getColor(score);
  const percentage = score;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-16 overflow-hidden">
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
          <path
            d="M 5 50 A 45 45 0 0 1 95 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${percentage * 1.41} 141`}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-0">
          <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
      <span className="text-xs text-slate-400">유저 민심 지수</span>
    </div>
  );
}
