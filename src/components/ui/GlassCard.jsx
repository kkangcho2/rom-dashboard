export default function GlassCard({ children, className = '', animate = true }) {
  return (
    <div className={`glass-panel rounded-xl p-4 ${animate ? 'animate-fade-in-up' : ''} ${className}`}>
      {children}
    </div>
  );
}
