/** Общие фикстуры тестов: строим тайтлы ровно тем же кодом, что и продакшен. */

import { buildTags, computeQuality, deriveMoodVector, makeTitleId } from '../../shared/model/title.js';

export function makeTitle(id, title, { genres = [], keywords = [], rating = 7.4, votes = 1800, popularity = 40, year = 2015 } = {}) {
  const tags = buildTags({ genreIds: genres, keywords });
  return {
    id: makeTitleId(id),
    externalId: id,
    kind: 'movie',
    title,
    year,
    genreIds: genres,
    genres: [],
    tags,
    moods: deriveMoodVector({ tags, genreIds: genres }),
    rating,
    votes,
    popularity,
    quality: computeQuality({ voteAverage: rating, voteCount: votes, popularity }).score,
    poster: `https://image.tmdb.org/t/p/w500/${id}.jpg`,
    posterSmall: `https://image.tmdb.org/t/p/w185/${id}.jpg`,
  };
}

/** Небольшая, но разнородная библиотека — хватает на все четыре уровня. */
export const LIBRARY = {
  sevenSamurai: makeTitle(1, 'Семь самураев', { genres: [28, 18], keywords: ['samurai', 'feudal japan', 'sword fight', 'honor'], rating: 8.5, votes: 3500, year: 1954 }),
  yojimbo: makeTitle(2, 'Телохранитель', { genres: [28, 18], keywords: ['samurai', 'ronin', 'sword fight'], rating: 8.2, votes: 2100, year: 1961 }),
  harakiri: makeTitle(3, 'Харакири', { genres: [18, 36], keywords: ['samurai', 'feudal japan', 'honor'], rating: 8.6, votes: 1500, year: 1962 }),
  thirteenAssassins: makeTitle(4, '13 убийц', { genres: [28, 36], keywords: ['samurai', 'feudal japan', 'sword fight'], rating: 7.6, votes: 1200, year: 2010 }),
  johnWick: makeTitle(5, 'Джон Уик', { genres: [28, 53], keywords: ['assassin', 'gun fu', 'revenge'], rating: 7.4, votes: 18000, year: 2014 }),
  fastFurious: makeTitle(6, 'Форсаж', { genres: [28, 80], keywords: ['car chase', 'street racing'], rating: 6.8, votes: 9000, year: 2001 }),
  ocean11: makeTitle(7, '11 друзей Оушена', { genres: [80, 53], keywords: ['heist', 'con artist'], rating: 7.7, votes: 12000, year: 2001 }),
  inception: makeTitle(8, 'Начало', { genres: [28, 878], keywords: ['dream', 'heist', 'mind-bending'], rating: 8.4, votes: 34000, year: 2010 }),
  notebook: makeTitle(9, 'Дневник памяти', { genres: [10749, 18], keywords: ['romance', 'love triangle'], rating: 7.9, votes: 11000, year: 2004 }),
  paddington: makeTitle(10, 'Паддингтон', { genres: [35, 10751], keywords: ['bear', 'family'], rating: 7.3, votes: 4200, year: 2014 }),
  interstellar: makeTitle(11, 'Интерстеллар', { genres: [878, 18], keywords: ['space travel', 'time travel', 'astronaut'], rating: 8.4, votes: 33000, year: 2014 }),
  drive: makeTitle(12, 'Драйв', { genres: [80, 18], keywords: ['neo-noir', 'car chase', 'los angeles'], rating: 7.8, votes: 14000, year: 2011 }),
  ringu: makeTitle(13, 'Звонок', { genres: [27, 9648], keywords: ['ghost', 'japan', 'psychological horror'], rating: 7.2, votes: 3800, year: 1998 }),
  ran: makeTitle(14, 'Ран', { genres: [18, 10752], keywords: ['samurai', 'feudal japan', 'shakespeare'], rating: 8.2, votes: 1100, year: 1985 }),
  parasite: makeTitle(15, 'Паразиты', { genres: [18, 53], keywords: ['korea', 'social class', 'dark comedy'], rating: 8.5, votes: 17000, year: 2019 }),
};

export const ALL_TITLES = Object.values(LIBRARY);

/** Детерминированный ГПСЧ — тесты ранжирования не должны «мигать». */
export function seededRandom(seed = 42) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

/** Сырой ответ TMDB — чтобы проверять нормализацию на настоящей форме данных. */
export const TMDB_RAW_MOVIE = {
  id: 346,
  title: 'Семь самураев',
  original_title: '七人の侍',
  overview: 'Деревня нанимает семерых воинов для защиты от разбойников.',
  tagline: 'Великий бой',
  release_date: '1954-04-26',
  runtime: 207,
  vote_average: 8.5,
  vote_count: 3512,
  popularity: 28.4,
  adult: false,
  original_language: 'ja',
  poster_path: '/8OKmBV5BUFzmozIC3pPWKHy17kx.jpg',
  backdrop_path: '/fPfmYpQhLXjJ5U4hBhBjRl5BAdz.jpg',
  genres: [{ id: 28, name: 'Action' }, { id: 18, name: 'Drama' }],
  production_countries: [{ iso_3166_1: 'JP' }],
  keywords: { keywords: [{ id: 1, name: 'samurai' }, { id: 2, name: 'sword fight' }, { id: 3, name: 'feudal japan' }] },
  credits: {
    cast: [{ id: 5, name: 'Тосиро Мифунэ', character: 'Кикутиё', profile_path: '/a.jpg' }],
    crew: [{ id: 9, name: 'Акира Куросава', job: 'Director' }],
  },
  videos: { results: [{ site: 'YouTube', type: 'Trailer', official: true, key: 'abc123' }] },
};
