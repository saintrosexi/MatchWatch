/**
 * GET /api/tmdb/catalog
 * Список фильмов под фильтры пользователя. Отдаёт «лёгкие» тайтлы:
 * теги выведены из жанров, детальные keywords подтягивает /api/tmdb/enrich.
 * Так первая карточка появляется быстро, а точность тегов догоняет фоном.
 *
 * Параметры: list, genres, yearFrom, yearTo, minRating, maxRuntime, page, sort
 */

import { withHandler } from '../_lib/http.js';
import { assertNonEmpty, getImageBase, tmdbFetch } from '../_lib/tmdb.js';
import { cached, cacheKeyFor, storeTitles, loadMarkup, TTL } from '../_lib/cache.js';
import { normalizeTmdbMovie } from '../../shared/model/title.js';
import { applyMarkup } from '../../shared/ai/markup.js';
import { MODULE } from '../../shared/telemetry/events.js';
import { clampInt, toFloat } from '../_lib/util.js';

const LISTS = {
  popular: '/movie/popular',
  top_rated: '/movie/top_rated',
  now_playing: '/movie/now_playing',
  upcoming: '/movie/upcoming',
};

const SORTS = {
  popularity: 'popularity.desc',
  rating: 'vote_average.desc',
  newest: 'primary_release_date.desc',
  revenue: 'revenue.desc',
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Продукт отвечает на вопрос «что посмотреть сегодня», поэтому ещё не
 * вышедшие фильмы — это шум: их нельзя включить вечером. TMDB же охотно
 * подмешивает их в «популярное» на волне трейлеров и анонсов.
 *
 * Списочные эндпоинты фильтра по дате не принимают, поэтому отсекаем
 * после получения; в discover ограничение уходит прямо в запрос.
 */
const isReleased = (raw) => {
  const date = raw?.release_date;
  if (!date) return false;
  return date <= today();
};

export default withHandler({ methods: ['GET'], module: MODULE.TMDB_PROXY, cacheSeconds: 900 }, async ({ query }) => {
  const list = query.get('list') ?? 'discover';
  const page = clampInt(query.get('page'), 1, 500, 1);
  const genres = (query.get('genres') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6);
  const yearFrom = clampInt(query.get('yearFrom'), 1900, 2100, null);
  const yearTo = clampInt(query.get('yearTo'), 1900, 2100, null);
  const minRating = toFloat(query.get('minRating'), null);
  /*
   * Потолок длительности. Появился ради запросов словами: «не длиннее
   * двух часов» люди называют часто, и это ровно то жёсткое условие,
   * которое человек выдвинул прямо, а не то, что за него угадали.
   */
  const maxRuntime = clampInt(query.get('maxRuntime'), 40, 400, null);
  const sort = SORTS[query.get('sort')] ?? SORTS.popularity;
  const language = query.get('language') ?? 'ru-RU';

  const isDiscover = !LISTS[list];
  const path = isDiscover ? '/discover/movie' : LISTS[list];

  // Верхняя граница по дате — минимум из «не позже выбранного года»
  // и «уже вышло»: будущие премьеры в выбор не попадают.
  const upperBound = yearTo && `${yearTo}-12-31` < today() ? `${yearTo}-12-31` : today();

  const params = isDiscover
    ? {
        page, language, sort_by: sort,
        include_adult: false,
        with_genres: genres.length ? genres.join(',') : undefined,
        'primary_release_date.gte': yearFrom ? `${yearFrom}-01-01` : undefined,
        'primary_release_date.lte': upperBound,
        'vote_average.gte': minRating ?? undefined,
        'with_runtime.lte': maxRuntime ?? undefined,
        // Без порога голосов discover вытаскивает случайный шум с рейтингом 10.
        'vote_count.gte': minRating ? 200 : 60,
      }
    : { page, language };

  const key = `catalog/lists/${cacheKeyFor(list, params)}`;

  const { value, source } = await cached(key, TTL.LIST, async () => {
    const [payload, imageBase] = await Promise.all([tmdbFetch(path, params), getImageBase()]);
    const results = assertNonEmpty(payload?.results ?? [], { path, params });
    const titles = results
      .filter(isReleased)
      .map((raw) => normalizeTmdbMovie(raw, { imageBase }))
      .filter((t) => t && t.poster);

    // Каталог кладём в общее хранилище: клиенты читают его напрямую из базы.
    storeTitles(titles);

    return {
      titles,
      page: payload?.page ?? page,
      totalPages: Math.min(payload?.total_pages ?? 1, 500),
      totalResults: payload?.total_results ?? titles.length,
    };
  });

  /*
   * Разметка подмешивается ПОСЛЕ кэша, а не внутри него.
   *
   * Список живёт шесть часов. Подмешав внутри, мы получили бы разметку
   * на экране только после того, как кэш протухнет, — то есть спустя
   * полдня после прогона. Снаружи она действует сразу.
   */
  const titles = await withMarkup(value.titles);

  return { ...value, titles, enriched: false, cacheSource: source };
});

/** Накладывает разметку модели на пачку карточек. */
async function withMarkup(titles) {
  if (!titles?.length) return titles;
  const markup = await loadMarkup(titles.map((t) => t.id));
  if (!markup.size) return titles;
  return titles.map((title) => (markup.has(title.id)
    ? applyMarkup(title, markup.get(title.id))
    : title));
}
