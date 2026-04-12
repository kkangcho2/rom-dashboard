import { X } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Modal - glass-panel 스타일 모달
 */
export default function Modal({ open, onClose, title, icon: Icon, children, maxWidth = 'max-w-lg' }) {
  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Content */}
      <div
        className={`relative glass-panel rounded-2xl ${maxWidth} w-full max-h-[85vh] overflow-y-auto animate-fade-in-up shadow-2xl shadow-black/30`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 pb-4 border-b border-dark-600/30 bg-dark-800/90 backdrop-blur-xl rounded-t-2xl">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5 text-accent-light" />}
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-dark-600/50 text-slate-500 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
