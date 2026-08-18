#!/usr/bin/env node
/**
 * MatchWatch Database Integrity Validator
 * 
 * Exhaustive automated validation for `src/data/movies.js` and `src/data/actors.js`.
 * 
 * Requirements:
 * 1. Sequential unique IDs 1..N (and expected 849 catalog items).
 * 2. Strict categorization: 'movie' | 'series' | 'anime', synchronized 'type', zero cross-contamination.
 * 3. Schema validation: title, titleRu, year, rating, poster (HTTPS), descriptions, country, genres.
 * 4. Kinopoisk ID uniqueness (0 duplicate collisions across non-null entries).
 * 5. 5D Sensation Vector validation (energy, darkness, intellect, emotion, dynamism in [0, 10]).
 * 6. Vibe badges validation (non-empty string array).
 * 7. Actors dataset validation (Wikimedia photo URLs, 3-bullet facts, english names).
 * 
 * Exit codes:
 * - 0: All validations passed (100% integrity)
 * - 1: Validation errors detected
 */

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const VALID_CATEGORIES = new Set(['movie', 'series', 'anime']);
const VECTOR_KEYS = ['energy', 'darkness', 'intellect', 'emotion', 'dynamism'];
const EXPECTED_MOVIE_COUNT = 849;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  boldRed: '\x1b[1;31m',
  boldGreen: '\x1b[1;32m',
  boldYellow: '\x1b[1;33m',
  boldCyan: '\x1b[1;36m',
};

/**
 * Validate a single movie record against strict schema rules
 */
export function validateMovieRecord(movie, index, state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() }, options = {}) {
  const errors = [];
  const warnings = [];

  if (!movie || typeof movie !== 'object') {
    return {
      id: null,
      title: 'UNKNOWN',
      errors: [`Movie record at index ${index} is not an object`],
      warnings: [],
    };
  }

  const id = movie.id;
  const title = movie.title || movie.titleRu || `Movie#${index + 1}`;

  // 1. ID Validation
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    errors.push(`Invalid id "${id}": must be a positive integer`);
  } else {
    const expectedId = index + 1;
    if (options.strictSequential !== false && id !== expectedId) {
      errors.push(`Non-sequential ID: found id=${id} at index ${index}, expected id=${expectedId}`);
    }
    if (state.seenIds.has(id)) {
      errors.push(`Duplicate ID ${id} detected`);
    } else {
      state.seenIds.add(id);
    }
  }

  // 2. Titles
  if (typeof movie.title !== 'string' || movie.title.trim().length === 0) {
    errors.push('Missing or empty "title" string');
  }
  if (typeof movie.titleRu !== 'string' || movie.titleRu.trim().length === 0) {
    errors.push('Missing or empty "titleRu" string');
  }

  // Duplicate title & year check
  if (movie.title && movie.year) {
    const key = `${movie.title.trim().toLowerCase()}|${movie.year}`;
    if (state.seenTitles.has(key)) {
      warnings.push(`Potential duplicate entry with same title and year "${movie.title} (${movie.year})" (first seen at ID ${state.seenTitles.get(key)})`);
    } else {
      state.seenTitles.set(key, id);
    }
  }

  // 3. Year
  if (typeof movie.year !== 'number' || !Number.isInteger(movie.year) || movie.year < 1900 || movie.year > 2030) {
    errors.push(`Invalid year "${movie.year}": must be an integer between 1900 and 2030`);
  }

  // 4. Rating
  if (typeof movie.rating !== 'number' || Number.isNaN(movie.rating) || movie.rating < 0 || movie.rating > 10) {
    errors.push(`Invalid rating "${movie.rating}": must be a number between 0 and 10`);
  }

  // 5. Poster URL
  if (typeof movie.poster !== 'string' || movie.poster.trim().length === 0) {
    errors.push('Missing or empty "poster" URL');
  } else if (!movie.poster.startsWith('https://')) {
    errors.push(`Invalid poster URL "${movie.poster}": must start with "https://"`);
  } else {
    try {
      new URL(movie.poster);
    } catch {
      errors.push(`Malformed poster URL "${movie.poster}"`);
    }
  }

  // 6. Descriptions
  if (typeof movie.description !== 'string' || movie.description.trim().length === 0) {
    errors.push('Missing or empty "description"');
  }
  if (typeof movie.fullDescription !== 'string' || movie.fullDescription.trim().length === 0) {
    errors.push('Missing or empty "fullDescription"');
  }

  // 7. Country & Genres
  if (typeof movie.country !== 'string' || movie.country.trim().length === 0) {
    errors.push('Missing or empty "country"');
  }
  if (typeof movie.genres !== 'string' || movie.genres.trim().length === 0) {
    errors.push('Missing or empty "genres"');
  }

  // 8. Kinopoisk ID & Uniqueness
  if (movie.kinopoiskId !== null && movie.kinopoiskId !== undefined) {
    if (typeof movie.kinopoiskId !== 'number' || !Number.isInteger(movie.kinopoiskId) || movie.kinopoiskId <= 0) {
      errors.push(`Invalid kinopoiskId "${movie.kinopoiskId}": must be null or positive integer`);
    } else {
      if (state.seenKpIds.has(movie.kinopoiskId)) {
        const firstMovie = state.seenKpIds.get(movie.kinopoiskId);
        errors.push(`Kinopoisk ID collision: KP ID ${movie.kinopoiskId} is shared between Movie #${firstMovie.id} ("${firstMovie.title}") and Movie #${id} ("${title}")`);
      } else {
        state.seenKpIds.set(movie.kinopoiskId, { id, title });
      }
    }
  }

  // 9. Sensation Vector (5D: energy, darkness, intellect, emotion, dynamism in [0, 10])
  if (!movie.sensationVector || typeof movie.sensationVector !== 'object') {
    errors.push('Missing or invalid "sensationVector" object');
  } else {
    for (const key of VECTOR_KEYS) {
      const val = movie.sensationVector[key];
      if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
        errors.push(`sensationVector.${key} must be a valid number, got ${typeof val} (${val})`);
      } else if (val < 0 || val > 10) {
        errors.push(`sensationVector.${key} out of range [0, 10]: ${val}`);
      }
    }
  }

  // 10. Vibe Badges
  if (!Array.isArray(movie.vibeBadges) || movie.vibeBadges.length === 0) {
    errors.push('Missing or empty "vibeBadges" array');
  } else {
    for (let bIdx = 0; bIdx < movie.vibeBadges.length; bIdx++) {
      const badge = movie.vibeBadges[bIdx];
      if (typeof badge !== 'string' || badge.trim().length === 0) {
        errors.push(`vibeBadges[${bIdx}] is not a valid non-empty string`);
      }
    }
  }

  // 11. Categorization & Type
  if (!movie.category || typeof movie.category !== 'string') {
    errors.push('Missing or non-string "category"');
  } else if (!VALID_CATEGORIES.has(movie.category)) {
    errors.push(`Invalid category "${movie.category}": must be one of ["movie", "series", "anime"]`);
  }

  if (typeof movie.type !== 'string' || movie.type !== movie.category) {
    errors.push(`Inconsistent or missing "type" property ("${movie.type}"): must equal category ("${movie.category}")`);
  }

  // 12. Cross-Contamination Checks
  if (movie.category && movie.genres) {
    const genresLower = movie.genres.toLowerCase();
    
    // Check 1: movie category should not contain series or anime tags in genres
    if (movie.category === 'movie') {
      if (genresLower.includes('сериал') || genresLower.includes('телесериал') || genresLower.includes('мини-сериал') || genresLower.includes('минисериал')) {
        errors.push(`Cross-contamination: Category is "movie" but genres contains series keywords: "${movie.genres}"`);
      }
      if (genresLower.includes('аниме') || genresLower.includes('anime')) {
        errors.push(`Cross-contamination: Category is "movie" but genres contains anime keywords: "${movie.genres}" (should be category "anime")`);
      }
    }

    // Check 2: series category cross contamination
    if (movie.category === 'series') {
      if (genresLower.includes('аниме') || genresLower.includes('anime')) {
        errors.push(`Cross-contamination: Category is "series" but genres contains anime keywords: "${movie.genres}" (should be category "anime")`);
      }
    }

    // Check 3: anime category sanity
    if (movie.category === 'anime') {
      // anime should generally be from Japan or have anime/animation markers
      const isAnimation = genresLower.includes('мультфильм') || genresLower.includes('аниме') || genresLower.includes('animation') || genresLower.includes('anime');
      const isJapan = movie.country && movie.country.toLowerCase().includes('япония');
      if (!isAnimation && !isJapan) {
        warnings.push(`Anime title "${title}" has country "${movie.country}" and genres "${movie.genres}" without animation or Japan marker`);
      }
    }
  }

  // 13. Optional Fields Validation (when present)
  if (movie.actors !== undefined && typeof movie.actors !== 'string') {
    errors.push('"actors" must be a string if provided');
  }
  if (movie.director !== undefined && typeof movie.director !== 'string') {
    errors.push('"director" must be a string if provided');
  }
  if (movie.duration !== undefined && typeof movie.duration !== 'string') {
    errors.push('"duration" must be a string if provided');
  }
  if (movie.trailer !== undefined && typeof movie.trailer !== 'string') {
    errors.push('"trailer" must be a string if provided');
  }
  if (movie.backdrop !== undefined && movie.backdrop !== null) {
    if (typeof movie.backdrop !== 'string' || (!movie.backdrop.startsWith('https://') && !movie.backdrop.startsWith('/'))) {
      errors.push(`Invalid backdrop URL "${movie.backdrop}": must start with "https://" or "/"`);
    }
  }

  return {
    id,
    title,
    category: movie.category,
    errors,
    warnings,
  };
}

/**
 * Validate the entire movies dataset
 */
export function validateMoviesDataset(movies, options = {}) {
  const result = {
    total: Array.isArray(movies) ? movies.length : 0,
    categories: { movie: 0, series: 0, anime: 0, invalid: 0 },
    validPosters: 0,
    validVectors: 0,
    validVibeBadges: 0,
    uniqueKpIds: 0,
    nullKpIds: 0,
    kpCollisions: 0,
    errors: [],
    warnings: [],
  };

  if (!Array.isArray(movies)) {
    result.errors.push({
      id: null,
      title: 'DATASET',
      errors: ['Dataset is not an Array or failed to load'],
      warnings: [],
    });
    return result;
  }

  if (options.expectedCount !== undefined) {
    if (movies.length !== options.expectedCount) {
      result.errors.push({
        id: null,
        title: 'COUNT_CHECK',
        errors: [`Dataset item count mismatch: expected ${options.expectedCount}, found ${movies.length}`],
        warnings: [],
      });
    }
  } else if (options.strictCount && movies.length !== EXPECTED_MOVIE_COUNT) {
    result.errors.push({
      id: null,
      title: 'COUNT_CHECK',
      errors: [`Dataset item count mismatch: expected ${EXPECTED_MOVIE_COUNT}, found ${movies.length}`],
      warnings: [],
    });
  }

  const state = {
    seenIds: new Set(),
    seenKpIds: new Map(),
    seenTitles: new Map(),
  };

  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    const validation = validateMovieRecord(movie, i, state, options);

    // Track category counts
    if (movie && VALID_CATEGORIES.has(movie.category)) {
      result.categories[movie.category] = (result.categories[movie.category] || 0) + 1;
    } else {
      result.categories.invalid++;
    }

    // Track metrics
    if (movie && typeof movie.poster === 'string' && movie.poster.startsWith('https://')) {
      result.validPosters++;
    }

    if (movie && movie.sensationVector && typeof movie.sensationVector === 'object') {
      const allKeysValid = VECTOR_KEYS.every((k) => typeof movie.sensationVector[k] === 'number' && !Number.isNaN(movie.sensationVector[k]));
      if (allKeysValid) result.validVectors++;
    }

    if (movie && Array.isArray(movie.vibeBadges) && movie.vibeBadges.length > 0) {
      result.validVibeBadges++;
    }

    if (movie) {
      if (movie.kinopoiskId === null || movie.kinopoiskId === undefined) {
        result.nullKpIds++;
      }
    }

    if (validation.errors.length > 0) {
      result.errors.push(validation);
    }
    if (validation.warnings.length > 0) {
      result.warnings.push(validation);
    }
  }

  result.uniqueKpIds = state.seenKpIds.size;
  result.kpCollisions = (result.total - result.nullKpIds) - result.uniqueKpIds;

  return result;
}

/**
 * Validate the actors dataset from `src/data/actors.js`
 */
export function validateActorsDataset(actorsData, options = {}) {
  const result = {
    total: 0,
    validPhotos: 0,
    validFacts: 0,
    errors: [],
    warnings: [],
  };

  if (!actorsData || typeof actorsData !== 'object' || Array.isArray(actorsData)) {
    result.errors.push({
      actor: 'ACTORS_DATASET',
      errors: ['Actors dataset is not an object dictionary'],
      warnings: [],
    });
    return result;
  }

  const entries = Object.entries(actorsData);
  result.total = entries.length;

  for (const [key, actor] of entries) {
    const actorErrors = [];
    const actorWarnings = [];

    if (!actor || typeof actor !== 'object') {
      actorErrors.push(`Actor entry "${key}" is not an object`);
      result.errors.push({ actor: key, errors: actorErrors, warnings: actorWarnings });
      continue;
    }

    const normKey = key.replace(/\s+/g, '').toLowerCase();
    const normName = typeof actor.name === 'string' ? actor.name.replace(/\s+/g, '').toLowerCase() : '';

    if (normKey !== normName) {
      actorErrors.push(`Dictionary key "${key}" does not match actor.name "${actor.name}"`);
    } else if (actor.name !== key) {
      actorWarnings.push(`Dictionary key "${key}" differs by casing/spacing from actor.name "${actor.name}"`);
    }

    if (typeof actor.name !== 'string' || actor.name.trim().length === 0) {
      actorErrors.push('Missing or empty "name" string');
    }

    if (typeof actor.nameEn !== 'string' || actor.nameEn.trim().length === 0) {
      actorErrors.push('Missing or empty "nameEn" string');
    }

    if (typeof actor.photo !== 'string' || !actor.photo.startsWith('https://')) {
      actorErrors.push(`Invalid photo URL "${actor.photo}": must start with "https://"`);
    } else {
      result.validPhotos++;
    }

    if (!Array.isArray(actor.facts) || actor.facts.length === 0) {
      actorErrors.push('Missing or empty "facts" array');
    } else {
      let factsOk = true;
      for (let fIdx = 0; fIdx < actor.facts.length; fIdx++) {
        const fact = actor.facts[fIdx];
        if (typeof fact !== 'string' || fact.trim().length === 0) {
          actorErrors.push(`facts[${fIdx}] must be a non-empty string`);
          factsOk = false;
        }
      }
      if (factsOk) result.validFacts++;
    }

    if (actorErrors.length > 0) {
      result.errors.push({ actor: key, errors: actorErrors, warnings: actorWarnings });
    }
    if (actorWarnings.length > 0) {
      result.warnings.push({ actor: key, errors: actorErrors, warnings: actorWarnings });
    }
  }

  return result;
}

/**
 * Format validation results into a clean, human-readable terminal report
 */
export function formatValidationReport(movieResult, actorResult = null, options = {}) {
  const lines = [];
  const hr = `${colors.cyan}══════════════════════════════════════════════════════════════════════${colors.reset}`;
  const subHr = `${colors.gray}──────────────────────────────────────────────────────────────────────${colors.reset}`;

  lines.push('');
  lines.push(hr);
  lines.push(`${colors.boldCyan} 🎬  MATCHWATCH DATABASE INTEGRITY AUDIT REPORT  🎬${colors.reset}`);
  lines.push(hr);
  lines.push('');

  // 1. Movies Summary Section
  lines.push(`${colors.bright}📊 MOVIES CATALOG OVERVIEW${colors.reset}`);
  lines.push(subHr);
  lines.push(`  ${colors.bright}Total Records:${colors.reset}       ${movieResult.total} items`);
  lines.push(`  ${colors.bright}Categorization:${colors.reset}      🎬 Movies: ${colors.yellow}${movieResult.categories.movie}${colors.reset} | 📺 Series: ${colors.yellow}${movieResult.categories.series}${colors.reset} | ⛩️ Anime: ${colors.yellow}${movieResult.categories.anime}${colors.reset}${movieResult.categories.invalid > 0 ? ` | ${colors.boldRed}Invalid: ${movieResult.categories.invalid}${colors.reset}` : ''}`);
  
  const posterPct = movieResult.total > 0 ? ((movieResult.validPosters / movieResult.total) * 100).toFixed(1) : '0';
  const posterColor = movieResult.validPosters === movieResult.total ? colors.green : colors.boldRed;
  lines.push(`  ${colors.bright}HTTPS Posters:${colors.reset}       ${posterColor}${movieResult.validPosters} / ${movieResult.total} (${posterPct}%)${colors.reset}`);

  const vectorPct = movieResult.total > 0 ? ((movieResult.validVectors / movieResult.total) * 100).toFixed(1) : '0';
  const vectorColor = movieResult.validVectors === movieResult.total ? colors.green : colors.boldRed;
  lines.push(`  ${colors.bright}5D Sensation Vectors:${colors.reset} ${vectorColor}${movieResult.validVectors} / ${movieResult.total} (${vectorPct}%)${colors.reset}`);

  const kpColor = movieResult.kpCollisions === 0 ? colors.green : colors.boldRed;
  lines.push(`  ${colors.bright}Kinopoisk IDs:${colors.reset}       ${colors.cyan}${movieResult.uniqueKpIds} unique${colors.reset}, ${colors.gray}${movieResult.nullKpIds} null${colors.reset}, ${kpColor}${movieResult.kpCollisions} collisions${colors.reset}`);
  lines.push('');

  // 2. Actors Summary Section (if available)
  if (actorResult) {
    lines.push(`${colors.bright}🎭 ACTORS HUB DATASET${colors.reset}`);
    lines.push(subHr);
    lines.push(`  ${colors.bright}Total Curated Actors:${colors.reset} ${actorResult.total}`);
    const actorPhotoColor = actorResult.validPhotos === actorResult.total ? colors.green : colors.boldRed;
    lines.push(`  ${colors.bright}Verified Portraits:${colors.reset}  ${actorPhotoColor}${actorResult.validPhotos} / ${actorResult.total}${colors.reset}`);
    const actorFactsColor = actorResult.validFacts === actorResult.total ? colors.green : colors.boldRed;
    lines.push(`  ${colors.bright}3-Bullet Trivia Facts:${colors.reset}${actorFactsColor} ${actorResult.validFacts} / ${actorResult.total}${colors.reset}`);
    lines.push('');
  }

  // 3. Error Breakdown Section
  const totalErrors = movieResult.errors.length + (actorResult ? actorResult.errors.length : 0);
  const totalWarnings = movieResult.warnings.length + (actorResult ? actorResult.warnings.length : 0);

  if (totalErrors > 0) {
    lines.push(`${colors.boldRed}❌ VALIDATION DEFECTS DETECTED (${totalErrors} items)${colors.reset}`);
    lines.push(subHr);

    // Print movie errors
    for (const item of movieResult.errors) {
      lines.push(`  ${colors.boldRed}• [Movie #${item.id || 'N/A'}] "${item.title}"${colors.reset}`);
      for (const err of item.errors) {
        lines.push(`    ${colors.red}↳ ${err}${colors.reset}`);
      }
    }

    // Print actor errors
    if (actorResult && actorResult.errors.length > 0) {
      for (const item of actorResult.errors) {
        lines.push(`  ${colors.boldRed}• [Actor] "${item.actor}"${colors.reset}`);
        for (const err of item.errors) {
          lines.push(`    ${colors.red}↳ ${err}${colors.reset}`);
        }
      }
    }
    lines.push('');
  }

  // 4. Warnings Breakdown Section
  if (totalWarnings > 0 && options.showWarnings !== false) {
    lines.push(`${colors.boldYellow}⚠️  VALIDATION WARNINGS (${totalWarnings} items)${colors.reset}`);
    lines.push(subHr);
    for (const item of movieResult.warnings) {
      lines.push(`  ${colors.yellow}• [Movie #${item.id || 'N/A'}] "${item.title}"${colors.reset}`);
      for (const warn of item.warnings) {
        lines.push(`    ${colors.yellow}↳ ${warn}${colors.reset}`);
      }
    }
    lines.push('');
  }

  // 5. Final Verdict
  lines.push(hr);
  if (totalErrors === 0) {
    lines.push(`${colors.boldGreen} ✅ AUDIT PASSED: 100% Database & Schema Integrity Verified${colors.reset}`);
  } else {
    lines.push(`${colors.boldRed} ❌ AUDIT FAILED: ${totalErrors} defect(s) must be resolved${colors.reset}`);
  }
  lines.push(hr);
  lines.push('');

  return lines.join('\n');
}

/**
 * Main validation executor
 */
export async function runValidation(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const moviesPath = options.moviesPath || path.resolve(projectRoot, 'src/data/movies.js');
  const actorsPath = options.actorsPath || path.resolve(projectRoot, 'src/data/actors.js');

  let movies = null;
  let actorsData = null;

  // 1. Load movies.js
  try {
    const moviesUrl = pathToFileURL(moviesPath).href;
    const moviesModule = await import(moviesUrl);
    movies = moviesModule.movies || moviesModule.default;
  } catch (err) {
    const errorResult = {
      valid: false,
      movieResult: {
        total: 0,
        categories: {},
        errors: [{ id: null, title: 'LOAD_ERROR', errors: [`Failed to import movies file at ${moviesPath}: ${err.message}`], warnings: [] }],
        warnings: [],
      },
      actorResult: null,
    };
    return errorResult;
  }

  // 2. Load actors.js if available
  if (!options.skipActors && fs.existsSync(actorsPath)) {
    try {
      const actorsUrl = pathToFileURL(actorsPath).href;
      const actorsModule = await import(actorsUrl);
      actorsData = actorsModule.actorsData || actorsModule.default;
    } catch (err) {
      console.warn(`${colors.yellow}Warning: Could not load actors file at ${actorsPath}: ${err.message}${colors.reset}`);
    }
  }

  // 3. Execute validations
  const movieResult = validateMoviesDataset(movies, options);
  const actorResult = actorsData ? validateActorsDataset(actorsData, options) : null;

  const totalErrors = movieResult.errors.length + (actorResult ? actorResult.errors.length : 0);
  const valid = totalErrors === 0;

  return {
    valid,
    movieResult,
    actorResult,
  };
}

// Direct CLI Execution
const isMain = process.argv[1] && (
  process.argv[1].endsWith('validate_database.mjs') ||
  process.argv[1].endsWith('validate_database.js')
);

if (isMain) {
  const args = process.argv.slice(2);
  const options = {
    strictCount: !args.includes('--no-strict'),
    showWarnings: !args.includes('--no-warnings'),
    json: args.includes('--json'),
    skipActors: args.includes('--skip-actors'),
  };

  // Optional custom path arguments
  const fileArgIdx = args.indexOf('--file');
  if (fileArgIdx !== -1 && args[fileArgIdx + 1]) {
    options.moviesPath = path.resolve(process.cwd(), args[fileArgIdx + 1]);
  }

  const actorsArgIdx = args.indexOf('--actors-file');
  if (actorsArgIdx !== -1 && args[actorsArgIdx + 1]) {
    options.actorsPath = path.resolve(process.cwd(), args[actorsArgIdx + 1]);
  }

  const result = await runValidation(options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatValidationReport(result.movieResult, result.actorResult, options));
  }

  process.exitCode = result.valid ? 0 : 1;
}
