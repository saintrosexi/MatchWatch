// MatchWatch — Resilient Kinopoisk CDN & Movie Frames Poster Pipeline

const cachedImages = new Set();

/**
 * Returns prioritized ordered list of poster and movie frame candidate URLs.
 */
export const getPosterCandidates = (movie, fallbackKpId = null) => {
  if (!movie && !fallbackKpId) return [];

  // Normalize input if passed as a string or object
  const kpId = (typeof movie === 'object' && movie?.kinopoiskId) || (typeof fallbackKpId === 'number' ? fallbackKpId : null);
  const rawPoster = typeof movie === 'object' ? (movie?.poster || '') : (typeof movie === 'string' ? movie : '');
  const posterPreview = typeof movie === 'object' ? (movie?.posterPreview || '') : '';

  const candidates = [];

  // 1. Primary Kinopoisk HD CDN (Fastest, cleanest resolution)
  if (kpId) {
    candidates.push(`https://kinopoiskapiunofficial.tech/images/posters/kp/${kpId}.jpg`);
    candidates.push(`https://st.kp.yandex.net/images/film_iphone/iphone360_${kpId}.jpg`);
    candidates.push(`https://st.kp.yandex.net/images/film_big/${kpId}.jpg`);
  }

  // 2. Direct movie.poster URL if valid and not a known rate-limited host
  if (rawPoster && typeof rawPoster === 'string' && rawPoster.trim() !== '' && !rawPoster.includes('N/A')) {
    const trimmed = rawPoster.trim();
    if (!candidates.includes(trimmed)) {
      // If it's a direct Amazon or CDN URL, add it
      candidates.push(trimmed);
    }
  }

  // 3. Movie Frames / Screenshots from Film (Кадры из фильма)
  if (kpId) {
    candidates.push(`https://kinopoiskapiunofficial.tech/images/frames/kp/${kpId}.jpg`);
    candidates.push(`https://st.kp.yandex.net/images/kadr/${kpId}.jpg`);
    candidates.push(`https://kinopoiskapiunofficial.tech/images/posters/kp_small/${kpId}.jpg`);
  }

  // 4. Poster Preview
  if (posterPreview && typeof posterPreview === 'string' && posterPreview.trim() !== '') {
    const preview = posterPreview.trim();
    if (!candidates.includes(preview)) {
      candidates.push(preview);
    }
  }

  return candidates;
};

/**
 * Polymorphic helper that supports:
 * - getPosterUrl(movie)
 * - getPosterUrl(posterUrl, size, kinopoiskId)
 * - getPosterUrl(posterUrl, kinopoiskId)
 */
export const getPosterUrl = (arg1, arg2, arg3) => {
  if (!arg1) return '';

  if (typeof arg1 === 'object') {
    const candidates = getPosterCandidates(arg1);
    return candidates[0] || arg1.poster || '';
  }

  if (typeof arg1 === 'string') {
    const kpId = typeof arg2 === 'number' ? arg2 : (typeof arg3 === 'number' ? arg3 : null);
    if (kpId) {
      return `https://kinopoiskapiunofficial.tech/images/posters/kp/${kpId}.jpg`;
    }
    return arg1;
  }

  return '';
};

export const getFallbackPosterUrls = (movie) => {
  return getPosterCandidates(movie);
};

/**
 * Universal error handler for <img> tags that cycles through fallback CDNs
 */
export const handlePosterError = (e, movie, kinopoiskId = null) => {
  const target = e.currentTarget || e.target;
  if (!target) return;

  const kpId = (movie && typeof movie === 'object' && movie.kinopoiskId) || (typeof movie === 'number' ? movie : kinopoiskId);
  const candidates = getPosterCandidates(typeof movie === 'object' ? movie : null, kpId);

  const currentSrc = target.src || '';
  const nextIdx = candidates.findIndex((c) => currentSrc.includes(c) || c === currentSrc);

  if (nextIdx >= 0 && nextIdx < candidates.length - 1) {
    target.src = candidates[nextIdx + 1];
  } else if (kpId) {
    target.src = `https://st.kp.yandex.net/images/film_iphone/iphone360_${kpId}.jpg`;
  }
};

export const prefetchPosters = (moviesList, count = 5) => {
  if (!Array.isArray(moviesList) || typeof window === 'undefined') return;

  const nextItems = moviesList.slice(0, count);
  nextItems.forEach((movie) => {
    const candidates = getPosterCandidates(movie);
    if (candidates.length > 0) {
      const primaryUrl = candidates[0];
      if (!cachedImages.has(primaryUrl)) {
        const img = new Image();
        img.src = primaryUrl;
        img.onload = () => cachedImages.add(primaryUrl);
        img.onerror = () => {
          if (candidates.length > 1) {
            const secondary = candidates[1];
            const img2 = new Image();
            img2.src = secondary;
            img2.onload = () => cachedImages.add(secondary);
          }
        };
      }
    }
  });
};
