// MatchWatch — 5D Neural-Heuristic Recommendation Engine
import { movies } from "../data/movies.js";
import { normalizeActorName } from "./actorResolver.js";

const DEFAULT_VECTOR = { energy: 6, darkness: 5, intellect: 6, emotion: 7, dynamism: 6 };

/**
 * Calculates Euclidean distance between two 5D vectors
 */
export const calculateVectorDistance = (v1, v2) => {
  const a = v1 || DEFAULT_VECTOR;
  const b = v2 || DEFAULT_VECTOR;

  const de = (a.energy || 5) - (b.energy || 5);
  const dd = (a.darkness || 5) - (b.darkness || 5);
  const di = (a.intellect || 5) - (b.intellect || 5);
  const dm = (a.emotion || 5) - (b.emotion || 5);
  const dy = (a.dynamism || 5) - (b.dynamism || 5);

  return Math.sqrt(de * de + dd * dd + di * di + dm * dm + dy * dy);
};

/**
 * Calculates the midpoint compromise vector between two taste vectors
 */
export const calculateCompromiseVector = (vectorA, vectorB) => {
  const a = vectorA || DEFAULT_VECTOR;
  const b = vectorB || DEFAULT_VECTOR;

  return {
    energy: Math.round(((a.energy || 5) + (b.energy || 5)) / 2),
    darkness: Math.round(((a.darkness || 5) + (b.darkness || 5)) / 2),
    intellect: Math.round(((a.intellect || 5) + (b.intellect || 5)) / 2),
    emotion: Math.round(((a.emotion || 5) + (b.emotion || 5)) / 2),
    dynamism: Math.round(((a.dynamism || 5) + (b.dynamism || 5)) / 2)
  };
};

/**
 * Derives a user's 5D taste vector from their liked movie IDs
 */
export const calculateUserTasteVector = (likedMovieIds = []) => {
  if (!likedMovieIds || likedMovieIds.length === 0) {
    return { ...DEFAULT_VECTOR };
  }

  const likedMovies = movies.filter((m) => likedMovieIds.includes(m.id) && m.sensationVector);
  if (likedMovies.length === 0) return { ...DEFAULT_VECTOR };

  const sums = likedMovies.reduce(
    (acc, m) => {
      acc.energy += m.sensationVector.energy || 5;
      acc.darkness += m.sensationVector.darkness || 5;
      acc.intellect += m.sensationVector.intellect || 5;
      acc.emotion += m.sensationVector.emotion || 5;
      acc.dynamism += m.sensationVector.dynamism || 5;
      return acc;
    },
    { energy: 0, darkness: 0, intellect: 0, emotion: 0, dynamism: 0 }
  );

  const n = likedMovies.length;
  return {
    energy: Math.round(sums.energy / n),
    darkness: Math.round(sums.darkness / n),
    intellect: Math.round(sums.intellect / n),
    emotion: Math.round(sums.emotion / n),
    dynamism: Math.round(sums.dynamism / n)
  };
};

/**
 * Filter and rank items for a personalized solo feed or infinite deck
 */
export const getRecommendedDeck = ({
  userTasteVector = DEFAULT_VECTOR,
  likedIds = [],
  dislikedIds = [],
  mood = null,
  filters = {},
  actorName = null,
  limit = 50
}) => {
  const seenIds = new Set([...likedIds, ...dislikedIds]);

  let pool = movies.filter((m) => {
    // CRITICAL: Exclude already swiped items permanently unless explicitly requested
    if (!filters.includeSeen && seenIds.has(m.id)) return false;

    // Strict Category Match
    if (filters.category && filters.category !== 'all') {
      const itemCategory = m.category || 'movie';
      if (itemCategory !== filters.category) return false;
    }

    // Min Rating
    if (filters.minRating && m.rating < filters.minRating) return false;

    // Year Range
    if (filters.yearFrom && m.year < filters.yearFrom) return false;
    if (filters.yearTo && m.year > filters.yearTo) return false;

    // Included Genres
    if (filters.genres && filters.genres.length > 0) {
      const mGenres = (m.genres || '').toLowerCase();
      const hasGenre = filters.genres.some((g) => mGenres.includes(g.toLowerCase()));
      if (!hasGenre) return false;
    }

    // Excluded Genres
    if (filters.excludedGenres && filters.excludedGenres.length > 0) {
      const mGenres = (m.genres || '').toLowerCase();
      const hasExcluded = filters.excludedGenres.some((g) => mGenres.includes(g.toLowerCase()));
      if (hasExcluded) return false;
    }

    // Filter by Actor (substring-safe tokenized matching)
    if (actorName) {
      if (!m.actors || typeof m.actors !== 'string') return false;
      const targetNorm = normalizeActorName(actorName);
      const tokens = m.actors.split(',').map((a) => normalizeActorName(a.trim()));
      if (!tokens.includes(targetNorm)) return false;
    }

    return true;
  });

  const targetVector = mood?.sensationVector || userTasteVector || DEFAULT_VECTOR;

  // Rank by proximity to target vector + rating
  const scored = pool.map((movie) => {
    const dist = calculateVectorDistance(movie.sensationVector, targetVector);
    const ratingScore = (movie.rating || 7.0) * 0.4;
    const score = ratingScore - dist * 0.3 + (Math.random() * 0.4);
    return { movie, score, dist };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.movie);
};

/**
 * Generates the 25-movie compromise deck for a 2-player or party room
 */
export const generateRoomCompromiseDeck = (userLikesA = [], userLikesB = [], roomFilters = {}) => {
  const vectorA = calculateUserTasteVector(userLikesA);
  const vectorB = calculateUserTasteVector(userLikesB);
  const compromiseVector = calculateCompromiseVector(vectorA, vectorB);

  const topRanked = getRecommendedDeck({
    userTasteVector: compromiseVector,
    filters: { ...roomFilters, includeSeen: true },
    limit: 20
  });

  const wildcards = movies
    .filter((m) => {
      if (m.rating < 8.2) return false;
      if (topRanked.some((t) => t.id === m.id)) return false;
      if (roomFilters.category && roomFilters.category !== 'all') {
        const itemCategory = m.category || m.type || 'movie';
        if (itemCategory !== roomFilters.category) return false;
      }
      return true;
    })
    .sort(() => 0.5 - Math.random())
    .slice(0, 5);

  const finalDeck = [...topRanked];
  wildcards.forEach((w, i) => {
    finalDeck.splice((i + 1) * 4, 0, w);
  });

  return finalDeck.slice(0, 25);
};
