// Poster resolution & recovery algorithm (NO placeholders allowed)

const KP_API_KEY = "8c8e1a50-6322-4135-8875-5d40a5420d86";

export const getPosterCandidates = (movie) => {
  if (!movie) return [];
  const candidates = [];

  // 1. Direct poster URL from data
  if (movie.poster && typeof movie.poster === "string" && movie.poster.trim() !== "" && !movie.poster.includes("N/A")) {
    candidates.push(movie.poster.trim());
  }

  // 2. Kinopoisk HD poster CDN URL using kinopoiskId
  if (movie.kinopoiskId) {
    const kpId = movie.kinopoiskId;
    const kpMainUrl = `https://kinopoiskapiunofficial.tech/images/posters/kp/${kpId}.jpg`;
    if (!candidates.includes(kpMainUrl)) candidates.push(kpMainUrl);
    
    const kpSmallUrl = `https://kinopoiskapiunofficial.tech/images/posters/kp_small/${kpId}.jpg`;
    if (!candidates.includes(kpSmallUrl)) candidates.push(kpSmallUrl);
  }

  // 3. Alternate posterPreview URL if provided
  if (movie.posterPreview && typeof movie.posterPreview === "string" && movie.posterPreview.trim() !== "") {
    if (!candidates.includes(movie.posterPreview.trim())) candidates.push(movie.posterPreview.trim());
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
