import { useCallback, useState } from 'react';

let counter = 0;

/** Короткие уведомления. Ошибка без объяснения — худшее, что может быть в UI. */
export function useToasts() {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message, { tone = 'info', ttl = 3600, action } = {}) => {
    const id = ++counter;
    setToasts((list) => [...list.slice(-2), { id, message, tone, action }]);
    if (ttl > 0) setTimeout(() => dismiss(id), ttl);
    return id;
  }, [dismiss]);

  return {
    toasts,
    push,
    dismiss,
    success: (m, o) => push(m, { ...o, tone: 'success' }),
    error: (m, o) => push(m, { ...o, tone: 'error', ttl: 5200 }),
  };
}
