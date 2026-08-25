/**
 * Кэш каталога TMDB в Postgres.
 *
 * Зачем: у TMDB есть rate-limit, а свайп-лента дёргает каталог постоянно.
 * Списки и карточки складываются в таблицы `catalog_cache` / `catalog_titles`
 * и обновляются раз в несколько часов.
 *
 * Двухуровневый: in-memory на время жизни лямбды + общий слой в базе.
 * Если база недоступна — деградируем в прямой запрос к TMDB, а не падаем.
 */

import { hasServiceKey, sbInsert, sbSelect } from './supabaseAdmin.js';
import { TITLE_SCHEMA_VERSION } from '../../shared/model/title.js';

export const TTL = {
  /** Списки (популярное, топ, discover) — обновляем раз в 6 часов. */
  LIST: 6 * 3600_000,
  /** Карточка тайтла меняется редко — держим неделю. */
  TITLE: 7 * 24 * 3600_000,
  /** Профиль персоны — сутки. */
  PERSON: 24 * 3600_000,
  /** Поиск — коротко, запросы разнообразные. */
  SEARCH: 30 * 60_000,
};

const memory = new Map();
const MEMORY_LIMIT = 300;

function memoryGet(key) {
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) { memory.delete(key); return null; }
  memory.delete(key); memory.set(key, hit); // LRU: освежаем позицию
  return hit.value;
}

function memorySet(key, value, ttl) {
  if (memory.size >= MEMORY_LIMIT) memory.delete(memory.keys().next().value);
  memory.set(key, { value, expiresAt: Date.now() + ttl });
}

/**
 * Читает из кэша, при промахе вызывает `producer` и записывает результат.
 * @param {string} key   ключ кэша
 * @param {number} ttl   время жизни в миллисекундах
 * @param {() => Promise<any>} producer
 */
export async function cached(key, ttl, producer) {
  const memHit = memoryGet(key);
  if (memHit) return { value: memHit, source: 'memory' };

  if (hasServiceKey()) {
    try {
      const rows = await sbSelect('catalog_cache', {
        select: 'value,fetched_at', key: `eq.${key}`, limit: 1,
      });
      const row = rows?.[0];
      if (row) {
        const age = Date.now() - new Date(row.fetched_at).getTime();
        if (age < ttl) {
          memorySet(key, row.value, ttl - age);
          return { value: row.value, source: 'db' };
        }
      }
    } catch (error) {
      // Кэш — оптимизация, а не зависимость: промах ведёт к живому запросу.
      console.warn('[cache] чтение не удалось:', error?.message ?? error);
    }
  }

  const value = await producer();
  memorySet(key, value, ttl);

  if (hasServiceKey()) {
    sbInsert('catalog_cache', {
      key, value, fetched_at: new Date().toISOString(),
    }, { upsert: true, onConflict: 'key' })
      .catch((error) => console.warn('[cache] запись не удалась:', error?.message ?? error));
  }

  return { value, source: 'origin' };
}

/** Массовая запись нормализованных тайтлов в общий каталог. */
export async function storeTitles(titles) {
  if (!hasServiceKey() || !titles?.length) return false;

  const rows = titles
    .filter((title) => title?.id)
    .map((title) => ({
      id: title.id,
      data: title,
      enriched: Boolean(title.enriched),
      cached_at: new Date().toISOString(),
    }));

  try {
    await sbInsert('catalog_titles', rows, { upsert: true, onConflict: 'id' });
    return true;
  } catch (error) {
    console.warn('[cache] storeTitles не удалась:', error?.message ?? error);
    return false;
  }
}

/**
 * Ключ кэша включает версию схемы тайтла.
 *
 * Без этого изменение правил нормализации не доходит до пользователей:
 * старые записи живут неделю, и новые теги — франшизы, авторы —
 * появляются только у тех, кто пришёл впервые.
 */
export const cacheKeyFor = (kind, params) => {
  const stable = Object.entries(params ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}-${v}`)
    .join('_');
  return `v${TITLE_SCHEMA_VERSION}_${kind}${stable ? `__${stable}` : ''}`
    .replace(/[^\w-]/g, '_').slice(0, 180);
};

export function __clearMemoryCache() { memory.clear(); }
