import { Shield } from 'lucide-react';

const CONFIGS = {
  gold:   { bg: 'from-amber-400 to-yellow-500', text: 'text-amber-950', label: 'GOLD' },
  silver: { bg: 'from-slate-300 to-slate-400',   text: 'text-slate-800', label: 'SILVER' },
  bronze: { bg: 'from-orange-400 to-orange-500', text: 'text-orange-950', label: 'BRONZE' },
};

export default function VerifiedBadge({ badge, size = 'sm' }) {
  if (!badge || !CONFIGS[badge]) return null;
  const c = CONFIGS[badge];
  const cls = size === 'lg'
    ? 'px-2.5 py-1 text-[11px] gap-1.5'
    : 'px-1.5 py-0.5 text-[9px] gap-1';

  return (
    <span className={`inline-flex items-center rounded-full font-bold bg-gradient-to-r ${c.bg} ${c.text} ${cls}`}>
      <Shield className={size === 'lg' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
      {c.label}
    </span>
  );
}
