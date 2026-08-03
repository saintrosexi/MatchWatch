// MatchWatch v2 — Poster Resolution & Recovery
// Deterministic poster URL selection + live API fallback

const KP_API_KEY = "8c8e1a50-6322-4135-8875-5d40a5420d86";

/**
 * Returns the single best, deterministic poster URL for a movie.
 * Uses Kinopoisk HD CDN as primary source when kinopoiskId is present.
 */
export const getBestPosterUrl = (movie) => {
  if (!movie) return "";
  if (movie.kinopoiskId) {
    return `https://kinopoiskapiunofficial.tech/images/posters/kp/${movie.kinopoiskId}.jpg`;
  }
  if (movie.poster && typeof movie.poster === "string" && movie.poster.trim() !== "" && !movie.poster.includes("N/A")) {
    return movie.poster.trim();
  }
  if (movie.posterPreview && typeof movie.posterPreview === "string" && movie.posterPreview.trim() !== "") {
    return movie.posterPreview.trim();
  }
  return "";
};

/**
 * Returns an ordered array of candidate poster URLs for fallback.
 */
export const getPosterCandidates = (movie) => {
  if (!movie) return [];
  const candidates = [];
  const best = getBestPosterUrl(movie);
  if (best) candidates.push(best);

  if (movie.poster && typeof movie.poster === "string" && movie.poster.trim() !== "" && !movie.poster.includes("N/A")) {
    const trimmed = movie.poster.trim();
    if (!candidates.includes(trimmed)) candidates.push(trimmed);
  }

  if (movie.kinopoiskId) {
    const kpSmallUrl = `https://kinopoiskapiunofficial.tech/images/posters/kp_small/${movie.kinopoiskId}.jpg`;
    if (!candidates.includes(kpSmallUrl)) candidates.push(kpSmallUrl);
  }

  if (movie.posterPreview && typeof movie.posterPreview === "string" && movie.posterPreview.trim() !== "") {
    const trimmed = movie.posterPreview.trim();
    if (!candidates.includes(trimmed)) candidates.push(trimmed);
  }

  return candidates;
};

/**
 * Async live search: tries to find a poster via Kinopoisk API by keyword.
 */
export const fetchLivePosterFromApi = async (title, year) => {
  try {
    const query = `${title} ${year || ""}`.trim();
    const res = await fetch(
      `https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(query)}`,
      {
        headers: {
          "X-API-KEY": KP_API_KEY,
          accept: "application/json"
        }
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.films?.length > 0) {
      const match = data.films[0];
      return match.posterUrl || match.posterUrlPreview ||
        (match.filmId ? `https://kinopoiskapiunofficial.tech/images/posters/kp/${match.filmId}.jpg` : null);
    }
  } catch (e) {
    console.warn("Live poster fetch error:", e);
  }
  return null;
};
