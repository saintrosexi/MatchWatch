// MatchWatch v2 — Poster Resolution & Recovery
// Deterministic poster URL selection + live API fallback

const KP_API_KEY = "8c8e1a50-6322-4135-8875-5d40a5420d86";

/**
 * Returns the single best, deterministic poster URL for a movie.
 * Uses Kinopoisk HD CDN as primary source when kinopoiskId is present.
 */
export const getBestPosterUrl = (movie) => {
  if (!movie) return "";

  // 1. Check direct poster URL if valid and not a missing placeholder
  if (
    movie.poster && 
    typeof movie.poster === "string" && 
    movie.poster.trim() !== "" && 
    !movie.poster.includes("N/A") && 
    !movie.poster.includes("w500null") &&
    !movie.poster.includes("no-poster")
  ) {
    return movie.poster.trim();
  }

  // 2. Check stills array
  if (Array.isArray(movie.stills) && movie.stills.length > 0 && movie.stills[0] && !movie.stills[0].includes("no-poster")) {
    return movie.stills[0];
  }

  // 3. Generate visual poster SVG with Title AT THE TOP
  const title = movie.titleRu || movie.title || "MatchWatch";
  const year = movie.year ? `(${movie.year})` : "";
  const escapeXml = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231a1a26"/><stop offset="100%" stop-color="%232d2b42"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23bg)"/><rect x="12" y="12" width="276" height="426" rx="16" fill="none" stroke="%23ff8a50" stroke-width="2" opacity="0.35"/><text x="50%" y="65" fill="%23ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">${escapeXml(title)}</text><text x="50%" y="95" fill="%23ff8a50" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" text-anchor="middle">${escapeXml(year)}</text><text x="50%" y="240" fill="%23ffffff" font-family="sans-serif" font-size="54" opacity="0.2" text-anchor="middle">🎬</text><rect x="40" y="370" width="220" height="36" rx="18" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)"/><text x="50%" y="393" fill="%23ff8a50" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" letter-spacing="2" text-anchor="middle">MATCHWATCH</text></svg>`;
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
      const match = data.films.find(f => f.posterUrl && !f.posterUrl.includes("no-poster"));
      if (match) {
        return match.posterUrl || match.posterUrlPreview ||
          (match.filmId ? `https://kinopoiskapiunofficial.tech/images/posters/kp/${match.filmId}.jpg` : null);
      }
    }
  } catch (e) {
    console.warn("Live poster fetch error:", e);
  }
  return null;
};

/**
 * Async live fetch: fetches 6-10 real movie stills from Kinopoisk API.
 */
export const fetchLiveStillsFromApi = async (kinopoiskId, title, year) => {
  try {
    let targetId = kinopoiskId;
    if (!targetId) {
      const query = `${title} ${year || ""}`.trim();
      const searchRes = await fetch(
        `https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(query)}`,
        { headers: { "X-API-KEY": KP_API_KEY, accept: "application/json" } }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData?.films?.length > 0) {
          targetId = searchData.films[0].filmId;
        }
      }
    }

    if (!targetId) return [];

    const imageTypes = ["STILL", "SHOOTING", "PROMO", "WALLPAPER", "FAN_ART", "POSTER"];
    
    for (const type of imageTypes) {
      const res = await fetch(
        `https://kinopoiskapiunofficial.tech/api/v2.2/films/${targetId}/images?type=${type}&page=1`,
        { headers: { "X-API-KEY": KP_API_KEY, accept: "application/json" } }
      );

      if (res.ok) {
        const data = await res.json();
        if (data?.items?.length > 0) {
          return data.items.slice(0, 10).map(item => item.imageUrl || item.previewUrl);
        }
      }
    }
  } catch (e) {
    console.warn("Live stills fetch error:", e);
  }
  return [];
};
