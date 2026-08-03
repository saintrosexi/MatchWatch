// MatchWatch v2 — Movie Sensation & Smart Recommendation Engine
// Generates 5D Vibe Vectors & calculates personalized taste matching

import { movies, moviesById } from "./data.js";

/**
 * Calculates a 5D Sensation Vibe Vector for a movie:
 * [energy, darkness, intellect, emotion, dynamism] (values 1-10)
 */
export const getMovieVibeVector = (movie) => {
  if (!movie) return { energy: 5, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 };
  if (movie.sensationVector) return movie.sensationVector;

  const genres = (movie.genres || "").toLowerCase();
  const desc = ((movie.description || "") + " " + (movie.fullDescription || "")).toLowerCase();

  let energy = 5;
  let darkness = 5;
  let intellect = 5;
  let emotion = 5;
  let dynamism = 5;

  if (genres.includes("боевик") || genres.includes("приключения") || genres.includes("фантастика")) {
    energy += 3;
    dynamism += 4;
  }
  if (genres.includes("ужасы") || genres.includes("триллер") || genres.includes("детектив")) {
    darkness += 4;
    intellect += 2;
  }
  if (genres.includes("драма") || genres.includes("мелодрама")) {
    emotion += 4;
    intellect += 1;
    dynamism -= 1;
  }
  if (genres.includes("комедия")) {
    energy += 2;
    darkness -= 2;
    emotion += 1;
  }
  if (genres.includes("криминал")) {
    darkness += 3;
    dynamism += 2;
  }
  if (genres.includes("мультфильм") || genres.includes("семейный")) {
    energy += 2;
    darkness -= 3;
    emotion += 3;
  }

  if (desc.includes("космос") || desc.includes("время") || desc.includes("философ") || desc.includes("разум")) {
    intellect += 3;
  }
  if (desc.includes("убий") || desc.includes("смерть") || desc.includes("месть") || desc.includes("война")) {
    darkness += 2;
  }
  if (desc.includes("любовь") || desc.includes("семья") || desc.includes("дружба") || desc.includes("надежд")) {
    emotion += 2;
  }

  const hash = String(movie.id || 0).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  energy = Math.min(10, Math.max(1, energy + (hash % 3) - 1));
  darkness = Math.min(10, Math.max(1, darkness + ((hash >> 2) % 3) - 1));
  intellect = Math.min(10, Math.max(1, intellect + ((hash >> 3) % 3) - 1));
  emotion = Math.min(10, Math.max(1, emotion + ((hash >> 4) % 3) - 1));
  dynamism = Math.min(10, Math.max(1, dynamism + ((hash >> 5) % 3) - 1));

  return { energy, darkness, intellect, emotion, dynamism };
};

/**
 * Returns human-readable sensation badges based on the movie's vibe profile.
 */
export const getMovieVibeBadge = (movie) => {
  const vector = getMovieVibeVector(movie);
  const { energy, darkness, intellect, emotion, dynamism } = vector;

  if (intellect >= 8) return { label: "🧠 На подумать", color: "#af52de" };
  if (dynamism >= 8) return { label: "🔥 Экшен & Драйв", color: "#ff5e62" };
  if (darkness >= 8) return { label: "🌙 Мрачная атмосфера", color: "#8e8e93" };
  if (emotion >= 8) return { label: "💔 Эмоциональный шторм", color: "#ff2d55" };
  if (energy >= 8) return { label: "⚡ Заряжающий энергией", color: "#ff9966" };
  if (darkness <= 3 && energy >= 6) return { label: "🍿 Уютный & Легкий", color: "#32d74b" };

  return { label: "✨ Баланс & Атмосфера", color: "#007aff" };
};

/**
 * Computes User Taste Vector from a list of liked movies, IDs, or decisions map.
 * Returns default { energy: 5, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 } if empty.
 */
export const computeUserTasteVector = (likedMovies) => {
  const defaultVector = { energy: 5, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 };
  if (!likedMovies) {
    return defaultVector;
  }

  const movieObjects = [];

  const resolveMovie = (item) => {
    if (!item) return null;
    if (typeof item === 'number' || typeof item === 'string') {
      const num = Number(item);
      if (!isNaN(num)) {
        return moviesById[num] || movies.find(m => m.id === num);
      }
    } else if (typeof item === 'object') {
      if (item.sensationVector || item.title || item.genres) {
        return item;
      }
      if (item.id != null) {
        const num = Number(item.id);
        if (!isNaN(num)) {
          return moviesById[num] || movies.find(m => m.id === num);
        }
      }
    }
    return null;
  };

  if (Array.isArray(likedMovies)) {
    likedMovies.forEach(item => {
      const m = resolveMovie(item);
      if (m) movieObjects.push(m);
    });
  } else if (typeof likedMovies === 'object') {
    Object.entries(likedMovies).forEach(([key, val]) => {
      if (val === 'like' || val === 'liked' || val === true || val === 'favorite' || val === 'superlike') {
        const m = resolveMovie(key);
        if (m) movieObjects.push(m);
      } else if (val && typeof val === 'object') {
        const m = resolveMovie(val);
        if (m) movieObjects.push(m);
      }
    });
  }

  if (movieObjects.length === 0) {
    return defaultVector;
  }

  const sum = movieObjects.reduce(
    (acc, m) => {
      const v = getMovieVibeVector(m);
      return {
        energy: acc.energy + v.energy,
        darkness: acc.darkness + v.darkness,
        intellect: acc.intellect + v.intellect,
        emotion: acc.emotion + v.emotion,
        dynamism: acc.dynamism + v.dynamism,
      };
    },
    { energy: 0, darkness: 0, intellect: 0, emotion: 0, dynamism: 0 }
  );

  const len = movieObjects.length;
  return {
    energy: Math.round((sum.energy / len) * 10) / 10,
    darkness: Math.round((sum.darkness / len) * 10) / 10,
    intellect: Math.round((sum.intellect / len) * 10) / 10,
    emotion: Math.round((sum.emotion / len) * 10) / 10,
    dynamism: Math.round((sum.dynamism / len) * 10) / 10,
  };
};

/**
 * Calculates similarity score between a movie and a vibe vector (0-100%).
 */
export const calculateMatchScore = (movie, vibeVector) => {
  if (!vibeVector) return 85;
  const v = getMovieVibeVector(movie);

  const dist = Math.sqrt(
    Math.pow(v.energy - vibeVector.energy, 2) +
    Math.pow(v.darkness - vibeVector.darkness, 2) +
    Math.pow(v.intellect - vibeVector.intellect, 2) +
    Math.pow(v.emotion - vibeVector.emotion, 2) +
    Math.pow(v.dynamism - vibeVector.dynamism, 2)
  );

  return Math.max(60, Math.min(99, Math.round(100 - dist * 2.2)));
};

/**
 * Calculates Midpoint Vector between User 1 and User 2 taste profiles.
 */
export const calculateMidpointVector = (user1Likes = [], user2Likes = []) => {
  const vec1 = computeUserTasteVector(user1Likes);
  const vec2 = computeUserTasteVector(user2Likes);
  return {
    energy: Math.round(((vec1.energy + vec2.energy) / 2) * 100) / 100,
    darkness: Math.round(((vec1.darkness + vec2.darkness) / 2) * 100) / 100,
    intellect: Math.round(((vec1.intellect + vec2.intellect) / 2) * 100) / 100,
    emotion: Math.round(((vec1.emotion + vec2.emotion) / 2) * 100) / 100,
    dynamism: Math.round(((vec1.dynamism + vec2.dynamism) / 2) * 100) / 100,
  };
};

/**
 * Gets compromise movie objects sorted by proximity to midpoint taste vector.
 */
export const getCompromiseDeck = (user1Likes = [], user2Likes = [], moviesData = [], count = 25) => {
  let pool = (moviesData && moviesData.length > 0) ? moviesData : movies;
  pool = pool.map(item => {
    if (typeof item === 'number' || typeof item === 'string') {
      return moviesById[item] || movies.find(m => String(m.id) === String(item));
    }
    return item;
  }).filter(Boolean);

  if (pool.length === 0) pool = movies;

  const midpointVector = calculateMidpointVector(user1Likes, user2Likes);
  const ranked = [...pool].map(m => ({
    movie: m,
    score: calculateMatchScore(m, midpointVector) + (m.rating || 7)
  })).sort((a, b) => b.score - a.score);

  return ranked.slice(0, count).map(item => item.movie);
};

/**
 * Generates Compromise Movies for MatchWatch Multiplayer!
 * Calculates Midpoint Vector = (User1_Vector + User2_Vector) / 2
 * Selects top movies closest to this compromise vector.
 */
export const generateMatchWatchPairDeck = (allMovies, user1LikedMovies = [], user2LikedMovies = [], count = 25) => {
  return getCompromiseDeck(user1LikedMovies, user2LikedMovies, allMovies, count).map(m => m.id);
};

/**
 * Ranks candidate movies for a single user based on their taste vector derived from liked movies.
 */
export const rankMoviesForUser = (moviesInput = [], likedMovies = []) => {
  const pool = (moviesInput && moviesInput.length > 0) ? moviesInput : movies;
  if (!likedMovies || likedMovies.length === 0) return pool;
  const userTasteVector = computeUserTasteVector(likedMovies);
  const ranked = [...pool].map(m => ({
    movie: m,
    score: calculateMatchScore(m, userTasteVector) + (m.rating || 7)
  })).sort((a, b) => b.score - a.score);

  return ranked.map(item => item.movie);
};

/**
 * Calculates a realistic fallback compatibility score (75-98%) from two user tags.
 */
export const calculateCompatibilityFromTags = (tag1 = "", tag2 = "") => {
  const str = String(tag1).toLowerCase() + String(tag2).toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  return 75 + (positiveHash % 24); // range 75 - 98
};

/**
 * Calculates taste compatibility percentage (75-98%) between two users
 * based on their 5D sensation taste vectors Euclidean distance.
 * Uses calculateCompatibilityFromTags as a fallback.
 */
export const calculateUserCompatibility = (user1Likes = [], user2Likes = [], tag1 = "", tag2 = "") => {
  const hasUser1Likes = (Array.isArray(user1Likes) && user1Likes.length > 0) || (typeof user1Likes === 'object' && user1Likes && Object.keys(user1Likes).length > 0);
  const hasUser2Likes = (Array.isArray(user2Likes) && user2Likes.length > 0) || (typeof user2Likes === 'object' && user2Likes && Object.keys(user2Likes).length > 0);

  if (!hasUser1Likes && !hasUser2Likes) {
    return calculateCompatibilityFromTags(tag1, tag2);
  }

  const vec1 = computeUserTasteVector(user1Likes);
  const vec2 = computeUserTasteVector(user2Likes);

  const dist = Math.sqrt(
    Math.pow(vec1.energy - vec2.energy, 2) +
    Math.pow(vec1.darkness - vec2.darkness, 2) +
    Math.pow(vec1.intellect - vec2.intellect, 2) +
    Math.pow(vec1.emotion - vec2.emotion, 2) +
    Math.pow(vec1.dynamism - vec2.dynamism, 2)
  );

  let score = Math.round(98 - dist * 1.15);
  if (isNaN(score)) score = calculateCompatibilityFromTags(tag1, tag2);
  return Math.max(75, Math.min(98, score));
};


