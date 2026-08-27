/**
 * GET /api/tmdb/title?id=<tmdbId>
 * Полная карточка: детали + keywords + актёры + трейлер.
 * Keywords — основа системы тегов, поэтому берутся именно здесь.
 */

import { withHandler, badRequest, notFound } from '../_lib/http.js';
import { getImageBase, tmdbFetch } from '../_lib/tmdb.js';
import { cached, storeTitles, loadOverlays, TTL } from '../_lib/cache.js';
import { normalizeTmdbMovie, TITLE_SCHEMA_VERSION } from '../../shared/model/title.js';
import { applyMarkup } from '../../shared/ai/markup.js';
import { applyCurated } from '../../shared/model/curated.js';
import { isExcluded } from '../../shared/config/excluded.js';
import { MODULE } from '../../shared/telemetry/events.js';
import { toInt } from '../_lib/util.js';

/**
 * Карточка без наложенных слоёв.
 *
 * Отделена от `loadFullTitle` ради обогащения пачкой. Раньше пачка из
 * двадцати четырёх фильмов звала полную загрузку двадцать четыре раза,
 * и каждая шла в базу за своей разметкой — по одной строке за запрос.
 * В час пик это давало шестнадцать тысяч обращений к каталогу за пять
 * минут, из которых РАЗНЫХ было полторы сотни, и база отвечала
 * таймаутами уже всему приложению, включая загрузку личных списков.
 */
export async function loadRawTitle(tmdbId, { language = 'ru-RU' } = {}) {
  const key = `v${TITLE_SCHEMA_VERSION}_title_${tmdbId}_${language}`;
  const { value, source } = await cached(key, TTL.TITLE, async () => {
    const [raw, imageBase] = await Promise.all([
      tmdbFetch(`/movie/${tmdbId}`, { language, append_to_response: 'keywords,credits,videos' }),
      getImageBase(),
    ]);
    if (!raw) return null;
    const title = normalizeTmdbMovie(raw, { imageBase });
    // Исключённое не кэшируем и не отдаём даже по прямой ссылке.
    if (title && isExcluded(title, Object.keys(raw?.keywords?.keywords ?? {}).length
      ? (raw.keywords.keywords ?? []).map((k) => k.name) : null)) {
      return null;
    }
    if (title) {
      title.enriched = true;
      storeTitles([title]);
    }
    return title;
  });
  return { title: value, source };
}

/**
 * Накладывает уже прочитанные слои на карточку.
 *
 * Слои читаются отдельно и пачкой — здесь только применение, без
 * единого обращения к базе.
 */
export function withOverlays(title, { markup, curated }) {
  if (!title) return title;
  const withModel = markup.has(title.id) ? applyMarkup(title, markup.get(title.id)) : title;
  return curated.has(title.id) ? applyCurated(withModel, curated.get(title.id)) : withModel;
}

/**
 * Полная карточка со слоями — для одиночного запроса.
 *
 * Разметка накладывается на выходе из кэша: карточка держится неделю,
 * и внутри кэша разметка ждала бы столько же, прежде чем что-то
 * изменить.
 */
export async function loadFullTitle(tmdbId, { language = 'ru-RU' } = {}) {
  const { title, source } = await loadRawTitle(tmdbId, { language });
  if (!title) return { title, source };

  const overlays = await loadOverlays([title.id]);
  return { title: withOverlays(title, overlays), source };
}

export default withHandler({ methods: ['GET'], module: MODULE.TMDB_PROXY, cacheSeconds: 3600 }, async ({ query }) => {
  const id = toInt(query.get('id'));
  if (!id) throw badRequest('id_required', 'Не указан id фильма');

  const { title, source } = await loadFullTitle(id, { language: query.get('language') ?? 'ru-RU' });
  if (!title) throw notFound('title_not_found', 'Фильм не найден в каталоге TMDB', { tmdbId: id });

  return { title, cacheSource: source };
});
