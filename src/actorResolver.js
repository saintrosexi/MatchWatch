// Actor Resolver & Dynamic Fetching System
// Automatically fetches real official actor photos, English names, and facts from Kinopoisk & TMDB APIs

const KP_API_KEY = "8c8e1a50-6322-4135-8875-5d40a5420d86";
const actorCache = new Map();

/**
 * Searches for a real official actor photo and profile details by actor name using Kinopoisk API.
 * @param {string} actorName 
 * @returns {Promise<{ name: string, nameEn: string, photo: string|null, kinopoiskId: number|null }>}
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
          accept: "application/json",
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data && data.items && data.items.length > 0) {
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
