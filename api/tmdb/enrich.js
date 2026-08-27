/**
 * POST /api/tmdb/enrich  { ids: number[] }
 * Догружает детальные теги (TMDB keywords) для пачки фильмов.
 *
 * Свайп-лента показывает карточку сразу по «лёгким» данным, а точные теги
 * приезжают сюда фоном — иначе первая карточка ждала бы 20 запросов к TMDB.
 * Конкурентность ограничена, всё кэшируется в базе, повторный вызов бесплатен.
 */

import { withHandler, badRequest } from '../_lib/http.js';
import { loadFullTitle } from './title.js';
import { mapWithConcurrency } from '../_lib/util.js';
import { MODULE } from '../../shared/telemetry/events.js';
import { isExcluded } from '../../shared/config/excluded.js';

const MAX_BATCH = 24;
const CONCURRENCY = 6;

export default withHandler({ methods: ['POST'], module: MODULE.TMDB_PROXY }, async ({ body }) => {
  const ids = Array.isArray(body?.ids)
    ? [...new Set(body.ids.map((v) => Number.parseInt(v, 10)).filter(Number.isFinite))].slice(0, MAX_BATCH)
    : null;
  if (!ids?.length) throw badRequest('ids_required', 'Передайте массив ids (максимум 24)');

  const language = body?.language ?? 'ru-RU';
  const results = await mapWithConcurrency(ids, CONCURRENCY, async (id) => {
    const { title } = await loadFullTitle(id, { language });
    return title;
  });

  // Постоянное исключение действует и здесь: пачка обогащения
  // приходит по id, минуя список каталога.
  const titles = results.filter((t) => t && !t.__error && !isExcluded(t));
  return {
    titles,
    requested: ids.length,
    resolved: titles.length,
    failed: ids.length - titles.length,
  };
});
