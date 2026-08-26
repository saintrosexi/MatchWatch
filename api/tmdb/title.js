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
import { MODULE } from '../../shared/telemetry/events.js';
import { toInt } from '../_lib/util.js';

export async function loadFullTitle(tmdbId, { language = 'ru-RU' } = {}) {
  const key = `v${TITLE_SCHEMA_VERSION}_title_${tmdbId}_${language}`;
  const { value, source } = await cached(key, TTL.TITLE, async () => {
    const [raw, imageBase] = await Promise.all([
      tmdbFetch(`/movie/${tmdbId}`, { language, append_to_response: 'keywords,credits,videos' }),
      getImageBase(),
    ]);
    if (!raw) return null;
    const title = normalizeTmdbMovie(raw, { imageBase });
    if (title) {
      title.enriched = true;
      storeTitles([title]);
    }
    return title;
  });
  /*
   * Разметка накладывается на выходе из кэша: карточка держится неделю,
   * и внутри кэша разметка ждала бы столько же, прежде чем что-то
   * изменить.
   */
  if (!value) return { title: value, source };

  const { markup, curated } = await loadOverlays([value.id]);
  const withModel = markup.has(value.id) ? applyMarkup(value, markup.get(value.id)) : value;

  return {
    title: curated.has(value.id) ? applyCurated(withModel, curated.get(value.id)) : withModel,
    source,
  };
}

export default withHandler({ methods: ['GET'], module: MODULE.TMDB_PROXY, cacheSeconds: 3600 }, async ({ query }) => {
  const id = toInt(query.get('id'));
  if (!id) throw badRequest('id_required', 'Не указан id фильма');

  const { title, source } = await loadFullTitle(id, { language: query.get('language') ?? 'ru-RU' });
  if (!title) throw notFound('title_not_found', 'Фильм не найден в каталоге TMDB', { tmdbId: id });

  return { title, cacheSource: source };
});
