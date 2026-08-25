/** Жанры TMDB (movie). Единый справочник для клиента и серверного прокси. */
export const TMDB_GENRES = {
  28: { slug: 'action', ru: 'Боевик' },
  12: { slug: 'adventure', ru: 'Приключения' },
  16: { slug: 'animation', ru: 'Анимация' },
  35: { slug: 'comedy', ru: 'Комедия' },
  80: { slug: 'crime', ru: 'Криминал' },
  99: { slug: 'documentary', ru: 'Документальный' },
  18: { slug: 'drama', ru: 'Драма' },
  10751: { slug: 'family', ru: 'Семейный' },
  14: { slug: 'fantasy', ru: 'Фэнтези' },
  36: { slug: 'history', ru: 'История' },
  27: { slug: 'horror', ru: 'Ужасы' },
  10402: { slug: 'music', ru: 'Музыка' },
  9648: { slug: 'mystery', ru: 'Детектив' },
  10749: { slug: 'romance', ru: 'Романтика' },
  878: { slug: 'sci-fi', ru: 'Фантастика' },
  10770: { slug: 'tv-movie', ru: 'ТВ-фильм' },
  53: { slug: 'thriller', ru: 'Триллер' },
  10752: { slug: 'war', ru: 'Военный' },
  37: { slug: 'western', ru: 'Вестерн' },
};

export const GENRE_LIST = Object.entries(TMDB_GENRES)
  .map(([id, g]) => ({ id: Number(id), ...g }))
  .filter((g) => g.slug !== 'tv-movie')
  .sort((a, b) => a.ru.localeCompare(b.ru, 'ru'));

export const genreName = (id) => TMDB_GENRES[id]?.ru ?? null;
export const genreSlug = (id) => TMDB_GENRES[id]?.slug ?? null;
