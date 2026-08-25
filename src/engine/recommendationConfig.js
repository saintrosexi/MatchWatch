/**
 * Рантайм-конфиг рекомендаций.
 *
 * Дефолты живут в shared/config, но их можно переопределить из таблицы
 * `app_config` без пересборки — это и есть точка A/B-теста: поменяли
 * exploration.rate для половины пользователей и смотрим метрики.
 */

import { RECOMMENDATION_CONFIG, mergeConfig } from '../../shared/config/recommendation.js';
import { supabase, supabaseReady } from '../lib/supabase.js';
import { trackError } from '../lib/telemetry.js';
import { MODULE } from '../../shared/telemetry/events.js';

let active = RECOMMENDATION_CONFIG;
const listeners = new Set();

export const getConfig = () => active;

export function subscribeConfig(fn) {
  listeners.add(fn);
  fn(active);
  return () => listeners.delete(fn);
}

/** Вариант эксперимента выбирается детерминированно по user_id. */
export function assignVariant(uid, variants) {
  if (!variants || !Object.keys(variants).length || !uid) return null;
  const names = Object.keys(variants).sort();
  let hash = 0;
  for (let i = 0; i < uid.length; i += 1) hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  return names[hash % names.length];
}

function apply(remote, uid) {
  try {
    if (!remote) { publish(RECOMMENDATION_CONFIG); return; }

    let next = mergeConfig(RECOMMENDATION_CONFIG, remote.base ?? {});
    const variantName = assignVariant(uid, remote.variants);
    if (variantName && remote.variants[variantName]) {
      next = mergeConfig(next, remote.variants[variantName]);
      next.variant = variantName;
    }
    publish(next);
  } catch (error) {
    trackError('Некорректный удалённый конфиг рекомендаций', { module: MODULE.DECK, error });
  }
}

export function initRemoteConfig({ uid } = {}) {
  if (!supabaseReady()) return () => {};

  supabase
    .from('app_config')
    .select('value')
    .eq('key', 'recommendation')
    .maybeSingle()
    .then(({ data }) => apply(data?.value, uid))
    .catch(() => { /* нет доступа — работаем на дефолтах */ });

  const channel = supabase
    .channel('config:recommendation')
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'app_config', filter: 'key=eq.recommendation',
    }, (payload) => apply(payload.new?.value, uid))
    .subscribe();

  return () => supabase.removeChannel(channel);
}

function publish(next) {
  active = next;
  for (const fn of listeners) {
    try { fn(active); } catch { /* игнорируем сломанного слушателя */ }
  }
}
