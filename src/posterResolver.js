// Poster resolution & recovery algorithm (NO placeholders allowed)

const KP_API_KEY = "8c8e1a50-6322-4135-8875-5d40a5420d86";

/**
 * Returns the single best, deterministic poster URL for a movie.
 * Uses Kinopoisk HD CDN as primary source when kinopoiskId is present to guarantee 100% matching URLs across background & foreground card deck.
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

export const getPosterCandidates = (movie) => {
  if (!movie) return [];
  const candidates = [];
  const best = getBestPosterUrl(movie);
  if (best) candidates.push(best);

  // Fallbacks if best fails
  if (movie.poster && typeof movie.poster === "string" && movie.poster.trim() !== "" && !movie.poster.includes("N/A")) {
    const trimmed = movie.poster.trim();
    if (!candidates.includes(trimmed)) candidates.push(trimmed);
  }

  if (movie.kinopoiskId) {
    const kpId = movie.kinopoiskId;
    const kpSmallUrl = `https://kinopoiskapiunofficial.tech/images/posters/kp_small/${kpId}.jpg`;
    if (!candidates.includes(kpSmallUrl)) candidates.push(kpSmallUrl);
  }

  if (movie.posterPreview && typeof movie.posterPreview === "string" && movie.posterPreview.trim() !== "") {
    const trimmed = movie.posterPreview.trim();
    if (!candidates.includes(trimmed)) candidates.push(trimmed);
  }

  return candidates;
};

// Async live search lookup for a movie poster via Kinopoisk API by keyword (title + year)
export const fetchLivePosterFromApi = async (title, year) => {
  try {
    const query = `${title} ${year || ""}`.trim();
    const res = await fetch(
      `https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(query)}`,
      {
        headers: {
          "X-API-KEY": KP_API_KEY,
          accept: "application/json",
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.films && data.films.length > 0) {
      const match = data.films[0];
      return match.posterUrl || match.posterUrlPreview || (match.filmId ? `https://kinopoiskapiunofficial.tech/images/posters/kp/${match.filmId}.jpg` : null);
    }
  } catch (e) {
    console.warn("Live poster fetch error:", e);
  }
  return null;
};
