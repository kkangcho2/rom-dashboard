const GRADE_STYLES = {
  S: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
  A: 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white',
  B: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
  C: 'bg-gradient-to-r from-slate-500 to-slate-600 text-white',
};

export default function GradeBadge({ grade, size = 'sm' }) {
  if (!grade) return null;
  const style = GRADE_STYLES[grade] || GRADE_STYLES.C;
  const cls = size === 'lg' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5';

  return (
    <span className={`inline-flex items-center rounded font-bold ${style} ${cls}`}>
      {grade}
    </span>
  );
}
