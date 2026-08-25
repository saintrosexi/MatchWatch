/**
 * GET /api/tmdb/search?q=...&type=movie|person
 * Поиск по каталогу и по актёрам (Star Hub).
 */

import { withHandler, badRequest } from '../_lib/http.js';
import { assertNonEmpty, getImageBase, tmdbFetch } from '../_lib/tmdb.js';
import { cached, cacheKeyFor, storeTitles, TTL } from '../_lib/cache.js';
import { normalizeTmdbMovie, posterUrl } from '../../shared/model/title.js';
import { MODULE } from '../../shared/telemetry/events.js';
import { clampInt } from '../_lib/util.js';

export default withHandler({ methods: ['GET'], module: MODULE.TMDB_PROXY, cacheSeconds: 300 }, async ({ query }) => {
  const q = (query.get('q') ?? '').trim().slice(0, 120);
  if (q.length < 2) throw badRequest('query_too_short', 'Запрос должен быть длиннее одного символа');

  const type = query.get('type') === 'person' ? 'person' : 'movie';
  const page = clampInt(query.get('page'), 1, 100, 1);
  const language = query.get('language') ?? 'ru-RU';
  const key = `catalog/search/${cacheKeyFor(type, { q: q.toLowerCase(), page, language })}`;

  const { value, source } = await cached(key, TTL.SEARCH, async () => {
    const path = type === 'person' ? '/search/person' : '/search/movie';
    const [payload, imageBase] = await Promise.all([
      tmdbFetch(path, { query: q, page, language, include_adult: false }),
      getImageBase(),
    ]);
    const results = assertNonEmpty(payload?.results ?? [], { path, params: { q, page } });

    if (type === 'person') {
      return {
        people: results.slice(0, 20).map((p) => ({
          id: p.id,
          name: p.name,
          photo: p.profile_path ? posterUrl(p.profile_path, 'w342', imageBase) : null,
          knownFor: (p.known_for ?? []).map((k) => k.title ?? k.name).filter(Boolean).slice(0, 3),
          popularity: p.popularity ?? 0,
        })),
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    const titles = results
      .filter((raw) => raw.release_date && raw.release_date <= today)
      .map((raw) => normalizeTmdbMovie(raw, { imageBase }))
      .filter((t) => t && t.poster);
    storeTitles(titles);
    return { titles, totalPages: Math.min(payload?.total_pages ?? 1, 100) };
  });

  return { ...value, cacheSource: source };
});
