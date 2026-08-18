// MatchWatch — Lightning-Fast Actor Profile & Filmography Resolver Engine
import { actorsData } from '../data/actors.js';
import { movies } from '../data/movies.js';

const KP_API_KEY = '8c8e1a50-6322-4135-8875-5d40a5420d86';
const actorCache = new Map();

/**
 * Normalizes an actor name for robust, diacritic-, punctuation-, and whitespace-agnostic matching.
 */
export const normalizeActorName = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/ё/g, 'е')
    .replace(/[^а-яa-z0-9]/g, '');
};

// Build fast normalized lookup tables for curated actors
const normalizedCuratedMap = new Map();
const normalizedCuratedEnMap = new Map();

for (const [key, data] of Object.entries(actorsData)) {
  const normKey = normalizeActorName(key);
  if (normKey) {
    normalizedCuratedMap.set(normKey, { key, data });
  }
  if (data.nameEn) {
    const normEn = normalizeActorName(data.nameEn);
    if (normEn) {
      normalizedCuratedEnMap.set(normEn, { key, data });
    }
  }
}

// Global cached actor-to-movies index for O(1) instant lookups
let cachedMoviePool = null;
let cachedActorIndex = null; // norm -> { rawName, movies: [] }
let cachedAllActorsList = null;

const buildActorIndex = (pool = movies) => {
  if (cachedMoviePool === pool && cachedActorIndex && cachedAllActorsList) {
    return { index: cachedActorIndex, list: cachedAllActorsList };
  }

  const index = new Map(); // norm -> { rawName, movies: [] }

  // 1. Single O(N) pass over all movies
  for (let i = 0; i < pool.length; i++) {
    const m = pool[i];
    if (!m || !m.actors || typeof m.actors !== 'string') continue;
    const cast = m.actors.split(',');
    for (let j = 0; j < cast.length; j++) {
      const raw = cast[j].trim();
      if (!raw) continue;
      const norm = normalizeActorName(raw);
      if (!norm) continue;

      let entry = index.get(norm);
      if (!entry) {
        entry = { rawName: raw, movies: [] };
        index.set(norm, entry);
      }
      entry.movies.push(m);
    }
  }

  // 2. Build full actors array
  const allActorsMap = new Map();

  // Curated actors first
  for (const [name, data] of Object.entries(actorsData)) {
    const norm = normalizeActorName(name);
    if (!norm) continue;

    const indexed = index.get(norm);
    const actorMovies = indexed ? indexed.movies : [];

    allActorsMap.set(norm, {
      name: data.name || name,
      nameEn: data.nameEn || '',
      photo: data.photo || null,
      facts: data.facts || [],
      kinopoiskId: data.kinopoiskId || null,
      isCurated: true,
      count: actorMovies.length,
      movies: actorMovies
    });
  }

  // Then uncurated actors discovered in movies
  for (const [norm, entry] of index.entries()) {
    if (!allActorsMap.has(norm)) {
      const sampleTitles = entry.movies
        .slice(0, 3)
        .map((m) => `«${(m && (m.titleRu || m.title)) || 'Проект'}»`)
        .join(', ');

      allActorsMap.set(norm, {
        name: entry.rawName,
        nameEn: '',
        photo: null,
        facts: [
          `Исполнитель ролей в известных проектах каталога MatchWatch: ${sampleTitles}.`,
          `Активно снимается в картинах ключевых жанров каталога MatchWatch.`,
          `В медиатеке MatchWatch представлено ${entry.movies.length} картин с участием артиста.`
        ],
        kinopoiskId: null,
        isCurated: false,
        count: entry.movies.length,
        movies: entry.movies
      });
    }
  }

  const list = Array.from(allActorsMap.values());
  // Sort descending by movie count, then alphabetically by name
  list.sort((a, b) => b.count - a.count || (a.name || '').localeCompare(b.name || ''));

  cachedMoviePool = pool;
  cachedActorIndex = index;
  cachedAllActorsList = list;

  return { index, list };
};

/**
 * Filters movies starring an actor using instant indexed lookup.
 */
export const getActorFilmography = (actorName, category = 'all', moviesList = movies) => {
  if (!actorName || typeof actorName !== 'string') return [];
  const targetNorm = normalizeActorName(actorName);
  if (!targetNorm) return [];

  const pool = Array.isArray(moviesList) ? moviesList : (moviesList || movies);
  const { index } = buildActorIndex(pool);

  const entry = index.get(targetNorm);
  const filmList = entry ? entry.movies : [];

  if (category && category !== 'all') {
    return filmList.filter((m) => m && m.category === category);
  }
  return filmList;
};

/**
 * Synchronously retrieves a curated actor profile or dynamically synthesizes one.
 */
export const getActorProfile = (actorName, moviesList = movies) => {
  if (!actorName || typeof actorName !== 'string') return null;

  const rawTrimmed = actorName.trim();
  if (!rawTrimmed) return null;
  const norm = normalizeActorName(rawTrimmed);

  // 1. Direct match in curated actorsData dictionary
  if (actorsData[rawTrimmed]) {
    const item = actorsData[rawTrimmed];
    return {
      name: item.name || rawTrimmed,
      nameEn: item.nameEn || '',
      photo: item.photo || null,
      facts: item.facts || [],
      kinopoiskId: item.kinopoiskId || null,
      isCurated: true
    };
  }

  // 2. Normalized Russian key match
  if (normalizedCuratedMap.has(norm)) {
    const { key, data } = normalizedCuratedMap.get(norm);
    return {
      name: data.name || key,
      nameEn: data.nameEn || '',
      photo: data.photo || null,
      facts: data.facts || [],
      kinopoiskId: data.kinopoiskId || null,
      isCurated: true
    };
  }

  // 3. Normalized English name match
  if (normalizedCuratedEnMap.has(norm)) {
    const { key, data } = normalizedCuratedEnMap.get(norm);
    return {
      name: data.name || key,
      nameEn: data.nameEn || '',
      photo: data.photo || null,
      facts: data.facts || [],
      kinopoiskId: data.kinopoiskId || null,
      isCurated: true
    };
  }

  // 4. Dynamic uncurated cast member synthesis via instant index
  const actorFilms = getActorFilmography(rawTrimmed, 'all', moviesList);
  const filmCount = actorFilms.length;

  const sampleTitles = actorFilms
    .slice(0, 3)
    .map((m) => `«${(m && (m.titleRu || m.title)) || 'Проект'}»`)
    .join(', ');

  const fact1 = filmCount > 0
    ? `Исполнитель ролей в известных проектах каталога MatchWatch: ${sampleTitles}.`
    : 'Талантливый артист, полюбившийся публике выразительной игрой и глубиной образов.';

  const fact2 = 'Признанный мастер перевоплощений, снискавший уважение коллег и признание зрителей.';
  const fact3 = `В медиатеке MatchWatch представлено ${filmCount} картин с участием артиста.`;

  return {
    name: rawTrimmed,
    nameEn: '',
    photo: null,
    facts: [fact1, fact2, fact3],
    kinopoiskId: null,
    isCurated: false
  };
};

export const resolveActorProfile = getActorProfile;

/**
 * Asynchronously searches for a real actor photo and profile by name using Kinopoisk Unofficial API.
 */
export const fetchRealActorProfile = async (actorName) => {
  if (!actorName || typeof actorName !== 'string') return null;

  const rawTrimmed = actorName.trim();
  const cacheKey = normalizeActorName(rawTrimmed);
  if (!cacheKey) return null;

  if (actorCache.has(cacheKey)) {
    return actorCache.get(cacheKey);
  }

  try {
    const res = await fetch(
      `https://kinopoiskapiunofficial.tech/api/v1/persons?name=${encodeURIComponent(rawTrimmed)}`,
      {
        headers: {
          'X-API-KEY': KP_API_KEY,
          accept: 'application/json'
        }
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data?.items?.length > 0) {
        const match = data.items[0];
        const profile = {
          name: match.nameRu || match.nameEn || rawTrimmed,
          nameEn: match.nameEn || '',
          photo: match.posterUrl || (match.kinopoiskId ? `https://kinopoiskapiunofficial.tech/images/actor_posters/kp/${match.kinopoiskId}.jpg` : null),
          kinopoiskId: match.kinopoiskId || match.personId || null
        };
        actorCache.set(cacheKey, profile);
        return profile;
      }
    }
  } catch (e) {
    console.warn('Actor live API fetch error:', e);
  }

  return null;
};

/**
 * Retrieves all unique actors in O(1) amortized time.
 */
export const getAllActors = (moviesList = movies) => {
  const pool = Array.isArray(moviesList) ? moviesList : (moviesList || movies);
  const { list } = buildActorIndex(pool);
  return list;
};
