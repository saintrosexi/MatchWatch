/**
 * Минимальный Sentry-совместимый транспорт (Envelope API v7).
 *
 * Почему не официальный SDK: нужен один и тот же код в браузере и в
 * серверлес-функции, без 100 КБ в бандле и без холодного старта на сервере.
 * Формат конвертов публичный и стабильный, а всё, что нам нужно, — это
 * структурированный контекст: уровень, модуль, user_id/room_code, стек,
 * состояние сети. Если DSN не задан — транспорт молча выключается,
 * приложение продолжает работать.
 */

const uuid = () => {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '');
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
};

export function parseDsn(dsn) {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, '');
    if (!url.username || !projectId) return null;
    return {
      key: url.username,
      projectId,
      envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/?sentry_key=${url.username}&sentry_version=7`,
      dsn,
    };
  } catch {
    return null;
  }
}

export function createSentryTransport({ dsn, environment, release, platform = 'javascript', serverName, maxBreadcrumbs = 30, fetchImpl = globalThis.fetch } = {}) {
  const parsed = parseDsn(dsn);
  const breadcrumbs = [];
  let userContext = null;
  const globalTags = {};

  const enabled = Boolean(parsed && fetchImpl);

  const addBreadcrumb = (crumb) => {
    breadcrumbs.push({ timestamp: Date.now() / 1000, level: 'info', ...crumb });
    if (breadcrumbs.length > maxBreadcrumbs) breadcrumbs.shift();
  };

  const setUser = (user) => { userContext = user ? { ...user } : null; };
  const setTag = (key, value) => {
    if (value === undefined || value === null) delete globalTags[key];
    else globalTags[key] = String(value);
  };

  const send = async (event) => {
    if (!enabled) return false;
    const eventId = uuid();
    const header = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn: parsed.dsn });
    const itemHeader = JSON.stringify({ type: 'event' });
    const payload = JSON.stringify({ ...event, event_id: eventId });
    try {
      const res = await fetchImpl(parsed.envelopeUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-sentry-envelope' },
        body: `${header}\n${itemHeader}\n${payload}\n`,
        keepalive: true,
      });
      return res.ok;
    } catch {
      // Телеметрия не имеет права ронять продукт.
      return false;
    }
  };

  /**
   * @param {object} params
   * @param {string} params.message  человекочитаемое сообщение
   * @param {string} params.level    critical | error | warning | info
   * @param {string} params.module   фича, где произошло (rooms.create, tmdb.proxy, ...)
   * @param {Error}  [params.error]  исходное исключение — из него берётся стек
   * @param {object} [params.context] произвольные структурированные данные
   * @param {object} [params.tags]   дополнительные теги для фильтрации
   */
  const capture = ({ message, level = 'error', module: mod, error, context = {}, tags = {}, user, fingerprint }) => {
    const event = {
      timestamp: Date.now() / 1000,
      platform,
      // Sentry не знает уровня "critical" — маппим на fatal, но сохраняем исходный в теге.
      level: level === 'critical' ? 'fatal' : level,
      environment,
      release,
      server_name: serverName,
      logger: mod ?? 'app',
      message: { formatted: message },
      tags: { ...globalTags, ...tags, module: mod ?? 'unknown', severity: level },
      user: user ?? userContext ?? undefined,
      extra: context,
      breadcrumbs: breadcrumbs.length ? { values: [...breadcrumbs] } : undefined,
      fingerprint,
    };

    if (error) {
      event.exception = {
        values: [{
          type: error.name ?? 'Error',
          value: error.message ?? String(error),
          stacktrace: parseStack(error.stack),
        }],
      };
      if (error.cause) event.extra.cause = String(error.cause?.message ?? error.cause);
    }

    return send(event);
  };

  return { enabled, capture, addBreadcrumb, setUser, setTag, dsn: parsed?.dsn ?? null };
}

/** Грубый, но достаточный парсер стека в формат Sentry (снизу вверх). */
function parseStack(stack) {
  if (!stack) return undefined;
  const frames = String(stack)
    .split('\n')
    .slice(1)
    .map((line) => {
      const m = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
      if (!m) return null;
      return {
        function: m[1] ?? '?',
        filename: m[2],
        lineno: Number(m[3]),
        colno: Number(m[4]),
        in_app: !m[2].includes('node_modules'),
      };
    })
    .filter(Boolean)
    .reverse();
  return frames.length ? { frames } : undefined;
}
