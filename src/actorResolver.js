// MatchWatch v2 — Actor Resolver & Dynamic Fetching
// Fetches real actor photos and profiles from Kinopoisk API

const KP_API_KEY = "8c8e1a50-6322-4135-8875-5d40a5420d86";
const actorCache = new Map();

/**
 * Searches for a real actor photo and profile by name using Kinopoisk API.
 * Results are cached in-memory per session.
 */
export const fetchRealActorProfile = async (actorName) => {
  if (!actorName || typeof actorName !== "string") return null;

  const cacheKey = actorName.trim().toLowerCase();
  if (actorCache.has(cacheKey)) {
    return actorCache.get(cacheKey);
  }

  try {
    const res = await fetch(
      `https://kinopoiskapiunofficial.tech/api/v1/persons?name=${encodeURIComponent(actorName.trim())}`,
      {
        headers: {
          "X-API-KEY": KP_API_KEY,
          accept: "application/json"
        }
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data?.items?.length > 0) {
        const match = data.items[0];
        const profile = {
          name: match.nameRu || match.nameEn || actorName,
          nameEn: match.nameEn || "",
          photo: match.posterUrl || (match.kinopoiskId ? `https://kinopoiskapiunofficial.tech/images/actor_posters/kp/${match.kinopoiskId}.jpg` : null),
          kinopoiskId: match.kinopoiskId || match.personId || null
        };
        actorCache.set(cacheKey, profile);
        return profile;
      }
    }
  } catch (e) {
    console.warn("Actor live API fetch error:", e);
  }

  return null;
};

/**
 * Fetches real movie stills featuring the specific actor across their movies in MatchWatch.
 */
export const fetchActorMovieStills = async (actorName, actorMovies = []) => {
  if (!actorName || !actorMovies.length) return [];

  const collectedStills = [];
  const imageTypes = ["STILL", "SHOOTING", "PROMO"];

  try {
    for (const movie of actorMovies.slice(0, 5)) {
      if (collectedStills.length >= 10) break;
      const targetId = movie.kinopoiskId;
      if (!targetId) continue;

      for (const type of imageTypes) {
        const res = await fetch(
          `https://kinopoiskapiunofficial.tech/api/v2.2/films/${targetId}/images?type=${type}&page=1`,
          { headers: { "X-API-KEY": KP_API_KEY, accept: "application/json" } }
        );

        if (res.ok) {
          const data = await res.json();
          if (data?.items?.length > 0) {
            const urls = data.items.slice(0, 3).map(x => x.imageUrl || x.previewUrl);
            collectedStills.push(...urls);
            break; // Move to next movie
          }
        }
      }
    }
  } catch (e) {
    console.warn("Actor stills fetch error:", e);
  }

  return collectedStills.slice(0, 10);
};
