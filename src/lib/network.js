/**
 * Наблюдение за сетью.
 *
 * Нужно двум вещам: UI должен деградировать осмысленно (сообщение + повтор,
 * а не вечный спиннер), а телеметрия — прикладывать состояние сети к каждой
 * ошибке, иначе «не загрузилось» невозможно разобрать постфактум.
 */

const listeners = new Set();

let state = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  effectiveType: navigator?.connection?.effectiveType ?? null,
  saveData: Boolean(navigator?.connection?.saveData),
};

function emit(patch) {
  state = { ...state, ...patch };
  for (const fn of listeners) {
    try { fn(state); } catch { /* слушатель не должен ломать остальных */ }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => emit({ online: true }));
  window.addEventListener('offline', () => emit({ online: false }));
  navigator.connection?.addEventListener?.('change', () => emit({
    effectiveType: navigator.connection.effectiveType,
    saveData: Boolean(navigator.connection.saveData),
  }));
}

export const getNetworkState = () => state;
export const isOnline = () => state.online;

export function subscribeNetwork(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

/** «Медленная» сеть — повод грузить постеры меньшего размера. */
export const isSlowConnection = () =>
  state.saveData || ['slow-2g', '2g'].includes(state.effectiveType);
