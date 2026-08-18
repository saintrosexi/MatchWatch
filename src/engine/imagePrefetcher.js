// MatchWatch — TMDB High-Resolution & Kinopoisk Cascading Poster Pipeline

const cachedImages = new Set();

/**
 * Returns prioritized ordered list of poster and movie frame candidate URLs.
 * Priority: TMDB High-Res CDN -> Kinopoisk HD CDN -> Yandex Kinopoisk -> Direct Poster -> Film Frames
 */
export const getPosterCandidates = (movie, fallbackKpId = null) => {
  if (!movie && !fallbackKpId) return [];

  // Normalize input if passed as a string or object
  const kpId = (typeof movie === 'object' && movie?.kinopoiskId) || (typeof fallbackKpId === 'number' ? fallbackKpId : null);
  const tmdbPoster = typeof movie === 'object' ? (movie?.tmdbPoster || '') : '';
  const tmdbPosterPath = typeof movie === 'object' ? (movie?.tmdbPosterPath || '') : '';
  const rawPoster = typeof movie === 'object' ? (movie?.poster || '') : (typeof movie === 'string' ? movie : '');
  const posterPreview = typeof movie === 'object' ? (movie?.posterPreview || '') : '';

  const candidates = [];

  // 1. Primary: TMDB High-Definition Poster CDN (Fastest, crisp quality)
  if (tmdbPoster && typeof tmdbPoster === 'string' && tmdbPoster.startsWith('http')) {
    candidates.push(tmdbPoster.trim());
  } else if (tmdbPosterPath && typeof tmdbPosterPath === 'string') {
    const cleanPath = tmdbPosterPath.startsWith('/') ? tmdbPosterPath : `/${tmdbPosterPath}`;
    candidates.push(`https://image.tmdb.org/t/p/w500${cleanPath}`);
  }

  // 2. Secondary: Kinopoisk HD CDN (Reliable fallback)
  if (kpId) {
    const kpMain = `https://kinopoiskapiunofficial.tech/images/posters/kp/${kpId}.jpg`;
    if (!candidates.includes(kpMain)) candidates.push(kpMain);

    const kpIphone = `https://st.kp.yandex.net/images/film_iphone/iphone360_${kpId}.jpg`;
    if (!candidates.includes(kpIphone)) candidates.push(kpIphone);

    const kpBig = `https://st.kp.yandex.net/images/film_big/${kpId}.jpg`;
    if (!candidates.includes(kpBig)) candidates.push(kpBig);
  }

  // 3. Direct movie.poster URL if valid and not a known rate-limited host
  if (rawPoster && typeof rawPoster === 'string' && rawPoster.trim() !== '' && !rawPoster.includes('N/A')) {
    const trimmed = rawPoster.trim();
    if (!candidates.includes(trimmed)) {
      candidates.push(trimmed);
    }
  }

  // 4. Movie Frames / Screenshots from Film (Кадры из фильма)
  if (kpId) {
    const kpFrame = `https://kinopoiskapiunofficial.tech/images/frames/kp/${kpId}.jpg`;
    if (!candidates.includes(kpFrame)) candidates.push(kpFrame);

    const kpKadr = `https://st.kp.yandex.net/images/kadr/${kpId}.jpg`;
    if (!candidates.includes(kpKadr)) candidates.push(kpKadr);

    const kpSmall = `https://kinopoiskapiunofficial.tech/images/posters/kp_small/${kpId}.jpg`;
    if (!candidates.includes(kpSmall)) candidates.push(kpSmall);
  }

  // 5. Poster Preview
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
    return candidates[0] || arg1.tmdbPoster || arg1.poster || '';
  }

  if (typeof arg1 === 'string') {
    if (arg1.startsWith('http')) return arg1;
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
