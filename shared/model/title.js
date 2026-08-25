/**
 * MatchWatch — единая внутренняя схема тайтла и нормализация ответа TMDB.
 *
 * MVP отдаёт только `kind: 'movie'`, но поле `kind` присутствует в схеме
 * с первого дня: добавить сериалы/аниме позже = добавить новый нормализатор,
 * а не переписывать хранилище, движок и UI.
 */

import { TMDB_GENRES } from '../taxonomy/genres.js';
import {
  GENRE_BASE_WEIGHT, GENRE_MOODS, GENRE_TAGS, KEYWORD_BASE_WEIGHT,
  MAX_TAG_WEIGHT, TAG_EXPANSIONS, TAG_MOODS, slugifyTag,
} from '../taxonomy/tagOntology.js';
import { MOOD_AXES, NEUTRAL_MOOD, RECOMMENDATION_CONFIG } from '../config/recommendation.js';
import { franchiseTags } from '../taxonomy/franchises.js';

export const TITLE_KINDS = Object.freeze({ MOVIE: 'movie' });
export const TITLE_SCHEMA_VERSION = 6;

/** Единый идентификатор тайтла: `<source>:<kind>:<externalId>`. */
export const makeTitleId = (externalId, kind = TITLE_KINDS.MOVIE, source = 'tmdb') =>
  `${source}:${kind}:${externalId}`;

export const parseTitleId = (id) => {
  const [source, kind, externalId] = String(id ?? '').split(':');
  if (!source || !kind || !externalId) return null;
  return { source, kind, externalId };
};

/**
 * Собирает вектор тегов тайтла.
 *
 * Слои по возрастанию точности: жанр -> ключевые слова -> правила
 * обогащения -> франшиза и автор. Последний слой самый весомый:
 * принадлежность к «Человеку-пауку» говорит о фильме больше, чем
 * десяток общих ключевых слов.
 */
export function buildTags({
  genreIds = [], keywords = [], extra = {},
  collectionId = null, directorIds = [],
} = {}) {
  const tags = Object.create(null);

  const push = (tag, weight) => {
    if (!tag || !Number.isFinite(weight) || weight <= 0) return;
    const next = Math.min(MAX_TAG_WEIGHT, Math.round((tags[tag] ?? 0) + weight));
    tags[tag] = next;
  };

  // Слой 1 — жанры (грубый фон).
  for (const gid of genreIds) {
    for (const tag of GENRE_TAGS[gid] ?? []) push(tag, GENRE_BASE_WEIGHT);
  }

  // Слой 2 — keywords TMDB (основной источник).
  const direct = [];
  for (const kw of keywords) {
    const tag = slugifyTag(typeof kw === 'string' ? kw : kw?.name);
    if (!tag) continue;
    push(tag, KEYWORD_BASE_WEIGHT);
    direct.push(tag);
  }

  // Слой 3 — обогащение: производные темы, которых в TMDB нет.
  // Один проход — рекурсия исключена намеренно, иначе веса «текут».
  for (const tag of new Set(direct.concat(Object.keys(tags)))) {
    const source = tags[tag];
    if (!source) continue;
    for (const [derived, factor] of TAG_EXPANSIONS[tag] ?? []) {
      push(derived, source * factor * 0.55);
    }
  }

  // Слой 4 — франшиза и автор. Идут после обогащения и с наибольшим
  // весом: это самый конкретный сигнал «хочу ещё такого».
  for (const [tag, weight] of Object.entries(franchiseTags({ collectionId, directorIds }))) {
    tags[tag] = Math.min(MAX_TAG_WEIGHT, Math.max(tags[tag] ?? 0, weight));
  }

  // Слой 5 — ручное обогащение (нишевые темы, эстетика).
  for (const [tag, weight] of Object.entries(extra)) push(tag, weight);

  return tags;
}

/** Выводит 5D-вектор настроения из тегов и жанров: взвешенное среднее вкладов. */
export function deriveMoodVector({ tags = {}, genreIds = [] } = {}) {
  const acc = Object.fromEntries(MOOD_AXES.map((a) => [a, 0]));
  let totalWeight = 0;

  for (const [tag, weight] of Object.entries(tags)) {
    const contribution = TAG_MOODS[tag];
    if (!contribution) continue;
    const w = weight / MAX_TAG_WEIGHT;
    for (const axis of MOOD_AXES) acc[axis] += (contribution[axis] ?? 0) * w;
    totalWeight += w;
  }

  for (const gid of genreIds) {
    const contribution = GENRE_MOODS[gid];
    if (!contribution) continue;
    const w = 0.45;
    for (const axis of MOOD_AXES) acc[axis] += (contribution[axis] ?? 0) * w;
    totalWeight += w;
  }

  if (totalWeight === 0) return { ...NEUTRAL_MOOD };

  const out = {};
  for (const axis of MOOD_AXES) {
    out[axis] = clamp(Math.round(50 + acc[axis] / totalWeight), 0, 100);
  }
  return out;
}

/** Байесовски сглаженная оценка «внешнего качества» 0..1. */
export function computeQuality({ voteAverage = 0, voteCount = 0, popularity = 0 } = {}) {
  const q = RECOMMENDATION_CONFIG.quality;
  const m = q.bayesianWeight;
  const smoothed = (voteCount * voteAverage + m * q.bayesianPrior) / (voteCount + m);
  const ratingPart = clamp(smoothed / 10, 0, 1);
  const popPart = clamp(Math.log1p(popularity) / Math.log1p(q.popularitySoftCap), 0, 1);
  const score = ratingPart * (1 - q.popularityWeight) + popPart * q.popularityWeight;
  const reliable = voteCount >= q.minVotes;
  return { score: clamp(score, 0, 1), reliable };
}

/**
 * Нормализует ответ TMDB (`/movie/{id}` c append_to_response, либо элемент списка)
 * во внутреннюю схему тайтла.
 */
export function normalizeTmdbMovie(raw, { imageBase, now = Date.now() } = {}) {
  if (!raw || !raw.id) return null;

  const genreIds = Array.isArray(raw.genres)
    ? raw.genres.map((g) => g.id).filter(Boolean)
    : Array.isArray(raw.genre_ids) ? raw.genre_ids.filter(Boolean) : [];

  const keywords = raw.keywords?.keywords ?? raw.keywords?.results ?? raw.keywords ?? [];

  const directorIds = (raw.credits?.crew ?? [])
    .filter((p) => p.job === 'Director')
    .map((p) => p.id);

  const tags = buildTags({
    genreIds,
    keywords,
    collectionId: raw.belongs_to_collection?.id ?? null,
    directorIds,
  });
  const moods = deriveMoodVector({ tags, genreIds });
  const quality = computeQuality({
    voteAverage: raw.vote_average, voteCount: raw.vote_count, popularity: raw.popularity,
  });

  const cast = (raw.credits?.cast ?? []).slice(0, 12).map((p) => ({
    id: p.id,
    name: p.name,
    character: p.character ?? null,
    photo: p.profile_path ? posterUrl(p.profile_path, 'w185', imageBase) : null,
  }));

  const directors = (raw.credits?.crew ?? [])
    .filter((p) => p.job === 'Director')
    .slice(0, 3)
    .map((p) => ({ id: p.id, name: p.name }));

  const year = raw.release_date ? Number(String(raw.release_date).slice(0, 4)) : null;

  return {
    id: makeTitleId(raw.id),
    schema: TITLE_SCHEMA_VERSION,
    kind: TITLE_KINDS.MOVIE,
    source: 'tmdb',
    externalId: raw.id,
    title: raw.title || raw.name || 'Без названия',
    originalTitle: raw.original_title ?? null,
    overview: raw.overview?.trim() || null,
    tagline: raw.tagline?.trim() || null,
    year: Number.isFinite(year) ? year : null,
    releaseDate: raw.release_date || null,
    runtime: raw.runtime ?? null,
    rating: typeof raw.vote_average === 'number' ? Math.round(raw.vote_average * 10) / 10 : null,
    votes: raw.vote_count ?? 0,
    popularity: raw.popularity ?? 0,
    quality: Math.round(quality.score * 1000) / 1000,
    qualityReliable: quality.reliable,
    adult: Boolean(raw.adult),
    language: raw.original_language ?? null,
    countries: (raw.production_countries ?? []).map((c) => c.iso_3166_1),
    genreIds,
    genres: genreIds.map((id) => TMDB_GENRES[id]?.ru).filter(Boolean),
    /** Франшиза: нужна интерфейсу, чтобы показать «часть чего» этот фильм. */
    collection: raw.belongs_to_collection
      ? { id: raw.belongs_to_collection.id, name: raw.belongs_to_collection.name }
      : null,
    tags,
    moods,
    poster: raw.poster_path ? posterUrl(raw.poster_path, 'w500', imageBase) : null,
    posterSmall: raw.poster_path ? posterUrl(raw.poster_path, 'w185', imageBase) : null,
    backdrop: raw.backdrop_path ? posterUrl(raw.backdrop_path, 'w780', imageBase) : null,
    cast,
    directors,
    trailerKey: pickTrailer(raw.videos?.results),
    cachedAt: now,
  };
}

/** Постер TMDB: детерминированный URL + заглушка на случай отсутствия. */
export function posterUrl(path, size = 'w500', base = 'https://image.tmdb.org/t/p/') {
  if (!path) return null;
  return `${base.replace(/\/$/, '')}/${size}${path}`;
}

function pickTrailer(videos) {
  if (!Array.isArray(videos)) return null;
  const best = videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
    ?? videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer')
    ?? videos.find((v) => v.site === 'YouTube');
  return best?.key ?? null;
}

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

/** Компактная проекция тайтла для мест, где не нужен весь объект (мэтчи, вотчлист). */
export function titleStub(title) {
  if (!title) return null;
  return {
    id: title.id,
    title: title.title,
    year: title.year ?? null,
    poster: title.posterSmall ?? title.poster ?? null,
    rating: title.rating ?? null,
  };
}
