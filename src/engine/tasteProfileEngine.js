// MatchWatch 3 — Cinephile Taste DNA & Archetype Engine
import { movies } from "../data/movies.js";
import { calculateUserTasteVector, calculateVectorDistance } from "./recommendationEngine.js";

export const ARCHETYPES = [
  {
    id: "neon-visionary",
    name: "Неоновый визионер",
    subtitle: "Эстетика будущего, киберпанк и масштаб",
    icon: "🌃",
    match: (v) => v.energy >= 6 && v.darkness >= 6 && v.dynamism >= 7
  },
  {
    id: "intellectual-aesthete",
    name: "Эстет-интеллектуал",
    subtitle: "Сложные смыслы, режиссерский почерк и катарсис",
    icon: "🧠",
    match: (v) => v.intellect >= 7 && v.emotion >= 6
  },
  {
    id: "adrenaline-junkie",
    name: "Адреналиновый джанки",
    subtitle: "Взрывы, погони, драйв и чистый экшн",
    icon: "⚡",
    match: (v) => v.energy >= 8 && v.dynamism >= 8
  },
  {
    id: "warm-romantic",
    name: "Душевный романтик",
    subtitle: "Искренние эмоции, теплота и любовь к людям",
    icon: "🕯",
    match: (v) => v.emotion >= 8 && v.darkness <= 5
  },
  {
    id: "suspense-master",
    name: "Мастер саспенса",
    subtitle: "Тайны, леденящий триллер и темные секреты",
    icon: "🌑",
    match: (v) => v.darkness >= 8 && v.intellect >= 6
  },
  {
    id: "universal-cinephile",
    name: "Кино-эрудит",
    subtitle: "Гармоничный баланс всех жанров и эпох",
    icon: "🎬",
    match: () => true
  }
];

export const getTasteDNA = (likedMovieIds = []) => {
  const vector = calculateUserTasteVector(likedMovieIds);
  const likedMovies = movies.filter((m) => likedMovieIds.includes(m.id));

  // Determine Archetype
  const archetype = ARCHETYPES.find((a) => a.match(vector)) || ARCHETYPES[ARCHETYPES.length - 1];

  // Genre breakdown
  const genreCounts = {};
  likedMovies.forEach((m) => {
    if (m.genres) {
      m.genres.split(",").map((g) => g.trim()).forEach((g) => {
        if (g) genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
    }
  });

  const sortedGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([genre, count]) => ({
      genre,
      count,
      percent: likedMovies.length > 0 ? Math.round((count / likedMovies.length) * 100) : 0
    }));

  // Top Actors
  const actorCounts = {};
  likedMovies.forEach((m) => {
    if (m.actors) {
      m.actors.split(",").map((a) => a.trim()).forEach((a) => {
        if (a) actorCounts[a] = (actorCounts[a] || 0) + 1;
      });
    }
  });

  const topActors = Object.entries(actorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  // Cinephile Level calculation
  const count = likedMovieIds.length;
  let level = 1;
  let rankTitle = "Зритель первого ряда";
  let nextThreshold = 10;

  if (count >= 100) {
    level = 5;
    rankTitle = "Легендарный Режиссёр";
    nextThreshold = 200;
  } else if (count >= 50) {
    level = 4;
    rankTitle = "Кинокритик высшей гильдии";
    nextThreshold = 100;
  } else if (count >= 25) {
    level = 3;
    rankTitle = "Истинный Киноман";
    nextThreshold = 50;
  } else if (count >= 10) {
    level = 2;
    rankTitle = "Завсегдатай Кинозала";
    nextThreshold = 25;
  }

  return {
    vector,
    archetype,
    topGenres: sortedGenres,
    topActors,
    level,
    rankTitle,
    likesCount: count,
    nextThreshold
  };
};

/**
 * Calculates taste compatibility percentage (0 - 100%) between two users
 */
export const calculateTasteCompatibility = (userLikesA = [], userLikesB = []) => {
  const vectorA = calculateUserTasteVector(userLikesA);
  const vectorB = calculateUserTasteVector(userLikesB);

  const dist = calculateVectorDistance(vectorA, vectorB);
  // Max theoretical distance is ~15, so map to percentage
  const compatibility = Math.max(25, Math.min(99, Math.round(100 - (dist / 14) * 85)));

  return compatibility;
};
