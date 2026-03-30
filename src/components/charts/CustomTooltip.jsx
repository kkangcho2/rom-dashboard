const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel rounded-lg p-3 text-xs shadow-xl">
        <p className="text-slate-300 font-medium mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-400">{p.name}:</span>
            <span className="font-medium text-slate-200">{p.value?.toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default CustomTooltip;
