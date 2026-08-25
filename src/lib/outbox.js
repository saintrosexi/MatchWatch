/**
 * Очередь отложенной записи.
 *
 * Проблема, которую она решает: пользователь отмечает фильм, интерфейс
 * показывает отметку сразу, а запись в базу не проходит — сеть моргнула,
 * приложение свернули, вкладку закрыли. После перезагрузки отметки нет,
 * и выглядит это как потеря данных.
 *
 * Поэтому каждая неудачная запись складывается в очередь в localStorage
 * и повторяется: при возврате сети, при запуске приложения и по таймеру.
 * localStorage здесь не хранилище данных, а буфер доставки — источником
 * правды остаётся база.
 */

import { loadLocal, saveLocal } from './storage.js';
import { subscribeNetwork, isOnline } from './network.js';
import { trackBusiness, trackError } from './telemetry.js';
import { BIZ, LEVEL, MODULE } from '../../shared/telemetry/events.js';

const KEY = 'outbox';
const MAX_ITEMS = 500;
const MAX_ATTEMPTS = 8;
const RETRY_DELAY = 15_000;

/** Обработчики операций: имя -> функция, выполняющая запись. */
const handlers = new Map();
const listeners = new Set();

let flushing = false;
let timer = null;

const read = () => loadLocal(KEY, []);
const write = (items) => saveLocal(KEY, items.slice(-MAX_ITEMS));

export const pendingCount = () => read().length;

export function subscribeOutbox(fn) {
  listeners.add(fn);
  fn(pendingCount());
  return () => listeners.delete(fn);
}

const notify = () => {
  const count = pendingCount();
  for (const fn of listeners) {
    try { fn(count); } catch { /* слушатель не должен ломать доставку */ }
  }
};

/**
 * Регистрирует обработчик операции.
 * @param {string} kind  имя операции
 * @param {(payload: object) => Promise<void>} handler
 */
export const registerHandler = (kind, handler) => handlers.set(kind, handler);

/**
 * Выполняет операцию, а при неудаче кладёт её в очередь.
 *
 * Вызывающий код не обязан знать про очередь: он просто просит записать,
 * а доставка гарантируется здесь.
 */
export async function durableWrite(kind, payload, { key } = {}) {
  const handler = handlers.get(kind);
  if (!handler) throw new Error(`Нет обработчика записи «${kind}»`);

  try {
    if (!isOnline()) throw new Error('offline');
    await handler(payload);
    return { delivered: true };
  } catch (error) {
    enqueue({ kind, payload, key: key ?? `${kind}:${Date.now()}` });
    trackBusiness(BIZ.OFFLINE_DEGRADED, {
      module: MODULE.TASTE,
      level: LEVEL.INFO,
      context: { kind, queued: pendingCount(), reason: error?.message?.slice(0, 80) },
    });
    scheduleFlush();
    return { delivered: false, queued: true };
  }
}

function enqueue(item) {
  const items = read();
  // Повторная операция по тому же объекту заменяет прежнюю: в очереди
  // должно лежать последнее решение, а не его история.
  const existing = items.findIndex((i) => i.key === item.key);
  const record = { ...item, attempts: 0, at: Date.now() };
  if (existing >= 0) items[existing] = record;
  else items.push(record);
  write(items);
  notify();
}

/** Пытается доставить всё, что накопилось. */
export async function flushOutbox() {
  if (flushing || !isOnline()) return { sent: 0, left: pendingCount() };

  flushing = true;
  let sent = 0;

  try {
    let items = read();
    const survivors = [];

    for (const item of items) {
      const handler = handlers.get(item.kind);
      if (!handler) continue; // обработчик пропал — операция устарела

      try {
        await handler(item.payload);
        sent += 1;
      } catch (error) {
        const attempts = (item.attempts ?? 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          // Дальше повторять бессмысленно: это не сеть, а неверные данные.
          trackError('Операция не доставлена после всех попыток', {
            module: MODULE.TASTE,
            level: LEVEL.ERROR,
            error,
            context: { kind: item.kind, attempts },
          });
          continue;
        }
        survivors.push({ ...item, attempts });
      }
    }

    write(survivors);
    notify();
    if (survivors.length) scheduleFlush();
    return { sent, left: survivors.length };
  } finally {
    flushing = false;
  }
}

function scheduleFlush() {
  clearTimeout(timer);
  timer = setTimeout(() => { flushOutbox().catch(() => {}); }, RETRY_DELAY);
}

/** Подключает автоматическую доставку: при возврате сети и при запуске. */
export function startOutbox() {
  const stop = subscribeNetwork((state) => {
    if (state.online && pendingCount() > 0) flushOutbox().catch(() => {});
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') flushOutbox().catch(() => {});
    });
  }

  flushOutbox().catch(() => {});
  return () => { stop(); clearTimeout(timer); };
}

export function __resetOutbox() {
  write([]);
  notify();
}
