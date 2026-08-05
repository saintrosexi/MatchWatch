// MatchWatch v2 — Poster Resolution & Recovery
// Deterministic poster URL selection + live API fallback

const KP_API_KEY = "8c8e1a50-6322-4135-8875-5d40a5420d86";

/**
 * Returns the single best, deterministic poster URL for a movie.
 * Uses Kinopoisk HD CDN as primary source when kinopoiskId is present.
 */
export const getBestPosterUrl = (movie) => {
  if (!movie) return "";

  // 1. Check direct poster URL
  if (movie.poster && typeof movie.poster === "string" && movie.poster.trim() !== "" && !movie.poster.includes("N/A") && !movie.poster.includes("w500null")) {
    return movie.poster.trim();
  }

  // 2. Check stills array
  if (Array.isArray(movie.stills) && movie.stills.length > 0 && movie.stills[0]) {
    return movie.stills[0];
  }

  // 3. Kinopoisk ID poster source
  if (movie.kinopoiskId) {
    return `https://kinopoiskapiunofficial.tech/images/posters/kp/${movie.kinopoiskId}.jpg`;
  }

  if (movie.posterPreview && typeof movie.posterPreview === "string" && movie.posterPreview.trim() !== "") {
    return movie.posterPreview.trim();
  }

  // 4. Generate visual backdrop with title at the top
  const title = encodeURIComponent(movie.titleRu || movie.title || "MatchWatch");
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231f1c2c"/><stop offset="100%" stop-color="%23928dab"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23bg)"/><rect x="12" y="12" width="276" height="426" rx="14" fill="none" stroke="%23ff8a50" stroke-width="2" opacity="0.4"/><text x="50%" y="80" fill="%23ffffff" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">${title}</text><text x="50%" y="220" fill="%23ffffff" font-family="sans-serif" font-size="48" opacity="0.3" text-anchor="middle">🎬</text><text x="50%" y="380" fill="%23ff8a50" font-family="sans-serif" font-size="14" font-weight="600" letter-spacing="2" text-anchor="middle">MATCHWATCH</text></svg>`;
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
