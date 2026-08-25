/**
 * Клиентская телеметрия.
 *
 * Фронтенд и бэкенд — разные источники сбоев, поэтому у клиента свой
 * канал: критичное уходит в Sentry немедленно, всё остальное копится
 * в буфер и уезжает пачкой на /api/ops/events (там же ложится в журнал
 * бизнес-событий и в счётчики дашборда).
 *
 * К каждому событию автоматически прикладывается: модуль, user_id,
 * room_code, состояние сети, платформа, релиз.
 */

import { createSentryTransport } from '../../shared/telemetry/sentryTransport.js';
import { ALERTABLE_LEVELS, LEVEL, resolveEnvironment } from '../../shared/telemetry/events.js';
import { ENV } from './env.js';
import { getNetworkState } from './network.js';

const environment = resolveEnvironment();

const sentry = createSentryTransport({
  dsn: ENV.sentryDsn,
  environment,
  release: `matchwatch@${ENV.release}`,
  platform: 'javascript',
});

let userId = null;
let roomCode = null;
let platform = 'web';

const queue = [];
let flushTimer = null;
const FLUSH_DELAY = 4000;
const MAX_QUEUE = 40;

export function setTelemetryUser(uid, profile) {
  userId = uid ?? null;
  sentry.setUser(uid ? { id: uid, username: profile?.displayName ?? undefined } : null);
}

export function setTelemetryRoom(code) {
  roomCode = code ?? null;
  sentry.setTag('room_code', code ?? undefined);
}

export function setTelemetryPlatform(value) {
  platform = value;
  sentry.setTag('platform', value);
}

const baseContext = () => {
  const net = getNetworkState();
  return {
    online: net.online,
    connection: net.effectiveType,
    saveData: net.saveData,
    viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
  };
};

function enqueue(event) {
  queue.push(event);
  if (queue.length >= MAX_QUEUE) { flush(); return; }
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DELAY);
}

export async function flush({ beacon = false } = {}) {
  clearTimeout(flushTimer);
  flushTimer = null;
  if (!queue.length) return;

  const events = queue.splice(0, queue.length);
  const payload = JSON.stringify({ events, userId, platform, release: ENV.release });
  const url = `${ENV.apiBase}/ops/events`;

  try {
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
      return;
    }
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
    });
  } catch {
    // Офлайн — события теряются намеренно: держать их вечно дороже,
    // чем потерять. Критичное уже ушло в Sentry напрямую.
  }
}

/** Ошибка кода. */
export function trackError(message, { module, level = LEVEL.ERROR, error, context = {} } = {}) {
  const enriched = { ...baseContext(), ...context };
  console.error(`[${level}] ${module}: ${message}`, error ?? '');

  sentry.capture({ message, level, module, error, context: enriched, tags: roomCode ? { room_code: roomCode } : {} });

  enqueue({
    type: 'error',
    message: String(message).slice(0, 400),
    errorName: error?.name,
    stack: error?.stack,
    module, level, roomCode,
    context: enriched,
    online: enriched.online,
    connection: enriched.connection,
  });

  if (ALERTABLE_LEVELS.includes(level)) flush();
}

/** Сбой логики: код не упал, но задуманное не случилось. */
export function trackBusiness(name, { module, level = LEVEL.WARNING, context = {}, room = roomCode } = {}) {
  const enriched = { ...baseContext(), ...context };
  console.warn(`[biz] ${name} @ ${module}`, enriched);
  sentry.capture({
    message: `business:${name}`, level, module, context: { ...enriched, business_event: name },
    tags: { business_event: name, ...(room ? { room_code: room } : {}) },
    fingerprint: ['business', name, module ?? 'unknown'],
  });
  enqueue({
    type: 'biz', name, module, level, roomCode: room,
    context: enriched, online: enriched.online, connection: enriched.connection,
  });
}

/** Продуктовая метрика. */
export function trackMetric(name, { value = 1, context = {}, room = roomCode } = {}) {
  enqueue({ type: 'metric', name, value, roomCode: room, context: { ...context } });
}

/** Хлебная крошка — попадает в Sentry как контекст предыдущих действий. */
export const breadcrumb = (message, data) =>
  sentry.addBreadcrumb({ message, data, category: 'app' });

export const telemetryEnvironment = environment;
export const telemetryEnabled = sentry.enabled;

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => flush({ beacon: true }));
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush({ beacon: true });
  });

  window.addEventListener('error', (e) => {
    if (!e.error) return;
    trackError(e.message ?? 'Необработанная ошибка окна', {
      module: 'ui.render', level: LEVEL.ERROR, error: e.error,
      context: { source: e.filename, line: e.lineno },
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    trackError(reason?.message ?? 'Необработанное отклонение промиса', {
      module: 'ui.render',
      level: LEVEL.ERROR,
      error: reason instanceof Error ? reason : new Error(String(reason)),
    });
  });
}
