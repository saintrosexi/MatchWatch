import { AlertTriangle, CheckCircle2, Info, X } from './icons.js';

const ICONS = { info: Info, success: CheckCircle2, error: AlertTriangle };

export function Toasts({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-layer" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone] ?? Info;
        return (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <Icon size={16} style={{ flex: '0 0 auto' }} />
            <span className="grow">{toast.message}</span>
            {toast.action && (
              <button type="button" className="btn btn--sm btn--quiet" onClick={toast.action.onClick}>
                {toast.action.label}
              </button>
            )}
            <button type="button" aria-label="Закрыть" onClick={() => onDismiss(toast.id)}>
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
