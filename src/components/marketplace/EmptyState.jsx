/**
 * EmptyState - 데이터 없을 때 표시
 */
export default function EmptyState({ icon: Icon, title, description, action, onAction }) {
  return (
    <div className="text-center py-16 animate-fade-in-up">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-dark-700/50 flex items-center justify-center mx-auto mb-4">
          <Icon className="w-8 h-8 text-slate-600" />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-400 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-600 mb-4">{description}</p>}
      {action && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 rounded-lg text-sm font-medium text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/10 transition"
        >
          {action}
        </button>
      )}
    </div>
  );
}
