/**
 * Прокси-клиент TMDB. Живёт ТОЛЬКО на сервере — ключ никогда не покидает
 * серверлес-функцию и не попадает в браузерный бандл.
 *
 * Умеет: ретраи с экспоненциальной паузой, распознавание rate-limit,
 * явный бизнес-лог при пустом ответе, кэш /configuration.
 */

import { BIZ, LEVEL, MODULE } from '../../shared/telemetry/events.js';
import { logBusinessEvent } from './telemetry.js';
import { ApiError } from './http.js';

const BASE = 'https://api.themoviedb.org/3';
const DEFAULT_IMAGE_BASE = 'https://image.tmdb.org/t/p';

let configCache = null; // { imageBase, expiresAt }

export const hasTmdbCredentials = () =>
  Boolean(process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY);

function authFor(url) {
  const bearer = process.env.TMDB_ACCESS_TOKEN;
  if (bearer) return { headers: { authorization: `Bearer ${bearer}` } };
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new ApiError(503, 'tmdb_not_configured',
      'TMDB не настроен: задайте TMDB_ACCESS_TOKEN или TMDB_API_KEY в переменных окружения',
      { level: LEVEL.CRITICAL });
  }
  url.searchParams.set('api_key', key);
  return { headers: {} };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Запрос к TMDB с ретраями.
 * @param {string} path например `/movie/popular`
 * @param {object} params query-параметры
 */
export async function tmdbFetch(path, params = {}, { retries = 3, timeoutMs = 9000 } = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('language', params.language ?? 'ru-RU');
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  const { headers } = authFor(url);

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after') ?? 1);
        logBusinessEvent(BIZ.TMDB_RATE_LIMITED, {
          module: MODULE.TMDB_PROXY,
          context: { path, attempt, retryAfter },
        });
        if (attempt === retries) {
          throw new ApiError(429, 'tmdb_rate_limited', 'TMDB временно ограничил запросы. Повторите через несколько секунд.');
        }
        await sleep(Math.min(retryAfter * 1000, 4000) + attempt * 250);
        continue;
      }

      if (res.status === 404) {
        return null;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        lastError = new Error(`TMDB ${path} -> ${res.status} ${text.slice(0, 180)}`);
        if (res.status < 500 || attempt === retries) {
          logBusinessEvent(BIZ.TMDB_UPSTREAM_ERROR, {
            module: MODULE.TMDB_PROXY,
            level: LEVEL.ERROR,
            context: { path, status: res.status, body: text.slice(0, 300) },
          });
          throw new ApiError(502, 'tmdb_upstream_error', 'Каталог TMDB сейчас недоступен. Попробуйте ещё раз.');
        }
        await sleep(250 * 2 ** attempt);
        continue;
      }

      return await res.json();
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof ApiError) throw error;
      lastError = error;
      if (attempt === retries) break;
      await sleep(250 * 2 ** attempt);
    }
  }

  logBusinessEvent(BIZ.TMDB_UPSTREAM_ERROR, {
    module: MODULE.TMDB_PROXY,
    level: LEVEL.ERROR,
    context: { path, reason: lastError?.message ?? 'unknown' },
  });
  throw new ApiError(502, 'tmdb_unreachable', 'Не удалось связаться с TMDB. Проверьте соединение и повторите.');
}

/** База URL картинок из `/configuration` — не хардкодим, TMDB её меняет. */
export async function getImageBase() {
  if (configCache && configCache.expiresAt > Date.now()) return configCache.imageBase;
  try {
    const conf = await tmdbFetch('/configuration', {}, { retries: 1 });
    const base = conf?.images?.secure_base_url?.replace(/\/$/, '') ?? DEFAULT_IMAGE_BASE;
    configCache = { imageBase: base, expiresAt: Date.now() + 24 * 3600_000 };
    return base;
  } catch {
    // Заглушка лучше, чем падение всего каталога.
    configCache = { imageBase: DEFAULT_IMAGE_BASE, expiresAt: Date.now() + 3600_000 };
    return DEFAULT_IMAGE_BASE;
  }
}

/** Пустой ответ TMDB — не исключение, но сбой логики. Логируем явно. */
export function assertNonEmpty(results, { path, params, module: mod = MODULE.TMDB_PROXY }) {
  if (Array.isArray(results) && results.length > 0) return results;
  logBusinessEvent(BIZ.TMDB_EMPTY_RESULT, { module: mod, context: { path, params } });
  return [];
}
