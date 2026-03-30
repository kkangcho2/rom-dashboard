import { useEffect } from 'react';
import { create } from 'zustand';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

// Toast store
export const useToastStore = create((set) => ({
  toasts: [],
  addToast: (toast) => set((state) => ({
    toasts: [...state.toasts, { id: Date.now(), ...toast }],
  })),
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  })),
}));

// Helper functions
export const toast = {
  success: (message) => useToastStore.getState().addToast({ type: 'success', message }),
  error: (message) => useToastStore.getState().addToast({ type: 'error', message }),
  info: (message) => useToastStore.getState().addToast({ type: 'info', message }),
  warning: (message) => useToastStore.getState().addToast({ type: 'warning', message }),
};

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
  warning: AlertTriangle,
};

const STYLES = {
  success: 'bg-green-500/15 border-green-500/30 text-green-400',
  error: 'bg-red-500/15 border-red-500/30 text-red-400',
  info: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
  warning: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
};

function ToastItem({ toast: t, onRemove }) {
  const Icon = ICONS[t.type] || Info;

  useEffect(() => {
    const timer = setTimeout(() => onRemove(t.id), t.duration || 3000);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, onRemove]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-lg shadow-2xl animate-fade-in-up ${STYLES[t.type]}`}
    >
      <Icon size={16} className="flex-shrink-0" />
      <span className="text-xs font-medium flex-1">{t.message}</span>
      <button
        onClick={() => onRemove(t.id)}
        className="p-0.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
}
