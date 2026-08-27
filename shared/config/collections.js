/**
 * Готовые подборки каталога и умолчания фильтров.
 *
 * Отдельного механизма под подборки нет намеренно: это те же фильтры,
 * просто выставленные за человека. Сто с лишним отобранных вручную
 * наших фильмов лежали в каталоге, и открыть их было неоткуда — не
 * потому, что не хватало кода, а потому что не хватало кнопки.
 *
 * Живёт в общем коде, а не рядом с разметкой: это данные, и их читает
 * не только экран фильтров, но и тесты.
 */

/** Верхняя граница года: дальше сегодняшнего выбирать нечего. */
export const CURRENT_YEAR = new Date().getFullYear();

/** Граница эпох — распад СССР. */
export const SOVIET_ERA_END = 1991;

export const DEFAULT_FILTERS = Object.freeze({
  genres: [],
  yearFrom: 1970,
  yearTo: CURRENT_YEAR,
  minRating: 0,
  sort: 'popularity',
  /** Язык оригинала: пусто — весь каталог, 'ru' — наше кино. */
  originalLanguage: null,
});

export const SORTS = Object.freeze([
  { key: 'popularity', label: 'Популярное' },
  { key: 'rating', label: 'По рейтингу' },
  { key: 'newest', label: 'Новинки' },
]);

/**
 * Отбор идёт по ЯЗЫКУ ОРИГИНАЛА, а не по стране производства.
 *
 * По стране TMDB отдаёт и копродукции, где от нашего кино только
 * деньги, — а человек, выбравший «Русское/СССР», ждёт не этого.
 */
export const COLLECTIONS = Object.freeze([
  {
    key: 'all',
    label: 'Всё кино',
    filters: { originalLanguage: null, yearFrom: 1970, yearTo: CURRENT_YEAR },
  },
  {
    key: 'ru',
    label: 'Русское/СССР',
    filters: { originalLanguage: 'ru', yearFrom: 1930, yearTo: CURRENT_YEAR },
  },
  {
    key: 'soviet',
    label: 'Советская классика',
    filters: { originalLanguage: 'ru', yearFrom: 1930, yearTo: SOVIET_ERA_END },
  },
  {
    key: 'modern',
    label: 'Российское',
    filters: { originalLanguage: 'ru', yearFrom: SOVIET_ERA_END + 1, yearTo: CURRENT_YEAR },
  },
]);

/**
 * Какая подборка выбрана — выводится из самих фильтров.
 *
 * Отдельного поля «выбранная подборка» нет специально: два источника
 * правды о том же самом рано или поздно разъезжаются, и тогда кнопка
 * подсвечена одна, а показывается другое.
 */
export function currentCollection(filters) {
  if (filters?.originalLanguage !== 'ru') return 'all';
  if (filters.yearTo <= SOVIET_ERA_END) return 'soviet';
  if (filters.yearFrom > SOVIET_ERA_END) return 'modern';
  return 'ru';
}
