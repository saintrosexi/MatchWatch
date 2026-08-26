/**
 * Ручной слой поверх карточки.
 *
 * Три слоя данных о фильме намеренно раздельны и различаются по тому,
 * откуда взялись:
 *
 *   TMDB      — факты чужого каталога;
 *   разметка  — предположение модели, которое можно перепроверить;
 *   этот слой — решение человека, и оно главнее обоих.
 *
 * Отсюда правило слияния: то, что здесь, побеждает всегда. Если человек
 * поставил фильму тег, никакая переразметка его не снимет.
 */

/** Границей служит распад СССР: до неё — одна эпоха кино, после — другая. */
export const SOVIET_ERA_END = 1991;

/**
 * @param {object} title карточка из каталога
 * @param {object} curated ручной слой
 */
export function applyCurated(title, curated) {
  if (!title || !curated) return title;

  const tags = { ...(title.tags ?? {}) };

  /*
   * Принудительные теги ставятся с полным весом и поверх всего.
   * Смысл их в том и состоит: «это наше кино» — не наблюдение модели
   * над описанием, а факт, который человек знает и без неё.
   */
  for (const tag of curated.forceTags ?? []) {
    tags[tag] = 100;
  }

  return {
    ...title,
    tags,
    /*
     * Рейтинг IMDB держим отдельным полем, а не подменяем им оценку
     * TMDB. Это разные шкалы с разной аудиторией, и подмена сделала бы
     * несравнимыми карточки, у которых он есть, и те, у которых нет.
     */
    ...(Number.isFinite(curated.imdbRating) ? { imdbRating: curated.imdbRating } : {}),
    ...(Number.isFinite(curated.imdbVotes) ? { imdbVotes: curated.imdbVotes } : {}),
    ...(curated.collection ? { collection: curated.collection } : {}),
  };
}

/** Подкатегория подборки по году: советское или российское. */
export const russianEra = (year) => (Number(year) <= SOVIET_ERA_END ? 'soviet' : 'modern');
