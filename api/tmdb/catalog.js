/**
 * GET /api/tmdb/catalog
 * Список фильмов под фильтры пользователя. Отдаёт «лёгкие» тайтлы:
 * теги выведены из жанров, детальные keywords подтягивает /api/tmdb/enrich.
 * Так первая карточка появляется быстро, а точность тегов догоняет фоном.
 *
 * Параметры: list, genres, yearFrom, yearTo, minRating, maxRuntime,
 *            originalLanguage, page, sort
 */

import { withHandler, badRequest } from '../_lib/http.js';
import { assertNonEmpty, getImageBase, tmdbFetch } from '../_lib/tmdb.js';
import { cached, cacheKeyFor, storeTitles, loadOverlays, TTL } from '../_lib/cache.js';
import { normalizeTmdbMovie } from '../../shared/model/title.js';
import { applyMarkup } from '../../shared/ai/markup.js';
import { applyCurated } from '../../shared/model/curated.js';
import { MODULE } from '../../shared/telemetry/events.js';
import { clampInt, toFloat } from '../_lib/util.js';

const LISTS = {
  popular: '/movie/popular',
  top_rated: '/movie/top_rated',
  now_playing: '/movie/now_playing',
  upcoming: '/movie/upcoming',
};

/**
 * Списки, привязанные к конкретному фильму.
 *
 * Это готовый коллаборативный сигнал: TMDB считает их по поведению
 * миллионов людей — «кто смотрел это, смотрел и то». Своей такой
 * статистики у нас нет и не будет ещё долго, а здесь она бесплатна.
 *
 * Именно из них строится пул кандидатов «похоже на то, что вы
 * полюбили». До этого пул набирался мировой популярностью, то есть
 * признаком, не имеющим к человеку никакого отношения.
 */
const RELATED = {
  similar: 'similar',
  recommendations: 'recommendations',
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
  /*
   * Язык оригинала. Нужен для подборок вроде русского кино: без него
   * отобрать «наше» нечем — по стране производства TMDB отдаёт и
   * копродукции, где от нашего кино только деньги.
   */
  const originalLanguage = (query.get('originalLanguage') ?? '').trim().slice(0, 8) || null;
  const sort = SORTS[query.get('sort')] ?? SORTS.popularity;
  const language = query.get('language') ?? 'ru-RU';

  const relatedTo = RELATED[list] ? clampInt(query.get('id'), 1, 99999999, null) : null;
  if (RELATED[list] && !relatedTo) {
    // Список «похожих» без фильма — это не список, а ошибка вызова.
    throw badRequest('id_required', `Для списка «${list}» нужен id фильма`);
  }

  const isDiscover = !LISTS[list] && !relatedTo;
  const path = relatedTo
    ? `/movie/${relatedTo}/${RELATED[list]}`
    : (isDiscover ? '/discover/movie' : LISTS[list]);

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
        with_original_language: originalLanguage ?? undefined,
        /*
         * Порог голосов нужен против шума: без него discover вытаскивает
         * случайные записи с оценкой 10 и тремя голосами.
         *
         * Но шестьдесят — это много для старого и нишевого кино: у
         * «Кавказской пленницы» на TMDB двадцать девять голосов. Порог
         * снижен до двадцати пяти, и заодно поднят минимальный рейтинг,
         * когда человек его не задал: шум отсекается им, а не голосами.
         */
        'vote_count.gte': minRating ? 200 : 25,
      }
    : { page, language };

  /*
   * Идентификатор фильма обязан входить в ключ кэша. Списки «похожих»
   * получают одни и те же параметры (страница и язык), и без него
   * похожие на «Брата» и похожие на «Дюну» легли бы в одну ячейку —
   * второй запрос молча получил бы чужой ответ.
   */
  const key = `catalog/lists/${cacheKeyFor(relatedTo ? `${list}-${relatedTo}` : list, params)}`;

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

/**
 * Накладывает оба слоя. Порядок важен: ручной отбор идёт последним,
 * потому что решение человека главнее предположения модели.
 */
async function withMarkup(titles) {
  if (!titles?.length) return titles;
  const { markup, curated } = await loadOverlays(titles.map((t) => t.id));
  if (!markup.size && !curated.size) return titles;

  return titles.map((title) => {
    const withModel = markup.has(title.id) ? applyMarkup(title, markup.get(title.id)) : title;
    return curated.has(title.id) ? applyCurated(withModel, curated.get(title.id)) : withModel;
  });
}
