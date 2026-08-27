/**
 * POST /api/tmdb/enrich  { ids: number[] }
 * Догружает детальные теги (TMDB keywords) для пачки фильмов.
 *
 * Свайп-лента показывает карточку сразу по «лёгким» данным, а точные теги
 * приезжают сюда фоном — иначе первая карточка ждала бы 20 запросов к TMDB.
 * Конкурентность ограничена, всё кэшируется в базе, повторный вызов бесплатен.
 */

import { withHandler, badRequest } from '../_lib/http.js';
import { loadRawTitle, withOverlays } from './title.js';
import { loadOverlays } from '../_lib/cache.js';
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
    const { title } = await loadRawTitle(id, { language });
    return title;
  });

  // Постоянное исключение действует и здесь: пачка обогащения
  // приходит по id, минуя список каталога.
  const raw = results.filter((t) => t && !t.__error && !isExcluded(t));

  /*
   * Слои читаются ОДНИМ запросом на всю пачку, а не по одному на фильм.
   *
   * Раньше каждая карточка ходила в базу за своей разметкой отдельно:
   * пачка из двадцати четырёх стоила двадцати четырёх обращений, и при
   * живой ленте это давало шестнадцать тысяч запросов к каталогу за пять
   * минут. База отвечала таймаутами уже всему приложению — переставали
   * грузиться и личные списки, и лента, хотя ломала их именно эта пачка.
   */
  const overlays = raw.length ? await loadOverlays(raw.map((t) => t.id)) : null;
  const titles = overlays ? raw.map((t) => withOverlays(t, overlays)) : raw;
  return {
    titles,
    requested: ids.length,
    resolved: titles.length,
    failed: ids.length - titles.length,
  };
});
