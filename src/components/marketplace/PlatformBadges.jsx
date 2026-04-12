const PLATFORMS = [
  { key: 'youtube',  label: 'YouTube',  color: 'bg-red-500/15 text-red-400 border-red-500/20' },
  { key: 'twitch',   label: 'Twitch',   color: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
  { key: 'chzzk',    label: 'Chzzk',    color: 'bg-green-500/15 text-green-400 border-green-500/20' },
  { key: 'afreeca',  label: 'Afreeca',  color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
];

export default function PlatformBadges({ youtube, twitch, chzzk, afreeca }) {
  const flags = { youtube, twitch, chzzk, afreeca };
  const active = PLATFORMS.filter(p => flags[p.key]);
  if (active.length === 0) return null;

  return (
    <div className="flex gap-1 flex-wrap">
      {active.map(p => (
        <span key={p.key} className={`text-[10px] px-1.5 py-0.5 rounded border ${p.color}`}>
          {p.label}
        </span>
      ))}
    </div>
  );
}
