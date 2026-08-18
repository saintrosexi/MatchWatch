#!/usr/bin/env node
/**
 * MatchWatch Challenger Adversarial Verification Suite for Milestone M1
 * 
 * Tests:
 * 1. ID Continuity & Gap Detection (1..849)
 * 2. Kinopoisk ID Deduplication & Collision Testing
 * 3. Poster & Media URL HTTPS Integrity
 * 4. Western Animation vs Anime Boundary Isolation
 * 5. Series vs Movie vs Anime Cross-Contamination
 * 6. item.type vs item.category Strict Synchronization
 * 7. Sensation Vector (5D) Completeness, Bounds & Dimensions
 * 8. Vibe Badges Integrity
 * 9. Engine Deck Category Purity & Compromise Robustness
 * 10. Schema & Data Corruption Edge Cases
 */

import { movies } from '../src/data/movies.js';
import {
  calculateVectorDistance,
  calculateCompromiseVector,
  calculateUserTasteVector,
  getRecommendedDeck,
  generateRoomCompromiseDeck
} from '../src/engine/recommendationEngine.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  gray: '\x1b[90m'
};

let totalSuites = 0;
let passedSuites = 0;
let totalAssertions = 0;
let passedAssertions = 0;
const failureLog = [];

function assert(condition, testName, details = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
  } else {
    failureLog.push({ testName, details });
    console.error(`  ${colors.red}FAIL: ${testName}${details ? ` -> ${details}` : ''}${colors.reset}`);
  }
}

function runSuite(suiteName, fn) {
  totalSuites++;
  console.log(`\n${colors.bold}${colors.cyan}--- Running Suite: ${suiteName} ---${colors.reset}`);
  const prevFailures = failureLog.length;
  try {
    fn();
    if (failureLog.length === prevFailures) {
      passedSuites++;
      console.log(`  ${colors.green}PASS: ${suiteName}${colors.reset}`);
    } else {
      console.log(`  ${colors.red}SUITE HAD ${failureLog.length - prevFailures} FAILURE(S)${colors.reset}`);
    }
  } catch (err) {
    failureLog.push({ testName: suiteName, details: `Exception: ${err.message}\n${err.stack}` });
    console.error(`  ${colors.red}SUITE EXCEPTION: ${err.message}${colors.reset}`);
  }
}

console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}   MATCHWATCH M1 ADVERSARIAL STRESS TEST SUITE        ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}`);

// -------------------------------------------------------------
// SUITE 1: Catalog IDs & Sequence Continuity (1..849)
// -------------------------------------------------------------
runSuite('Catalog IDs & Sequence Continuity', () => {
  assert(Array.isArray(movies), 'movies export must be an array');
  assert(movies.length === 849, `Catalog must have exactly 849 items, found ${movies.length}`);

  const seenIds = new Set();
  const gaps = [];
  const duplicates = [];

  for (let i = 0; i < 849; i++) {
    const expectedId = i + 1;
    const movie = movies[i];

    if (!movie) {
      gaps.push(expectedId);
      continue;
    }

    if (seenIds.has(movie.id)) {
      duplicates.push(movie.id);
    }
    seenIds.add(movie.id);

    assert(typeof movie.id === 'number' && Number.isInteger(movie.id), `Movie at index ${i} has integer ID`, `Found ${typeof movie.id} (${movie.id})`);
    assert(movie.id === expectedId, `Sequential ID match at index ${i}`, `Expected ${expectedId}, got ${movie.id}`);
  }

  assert(duplicates.length === 0, 'No duplicate movie IDs', `Duplicates: ${duplicates.join(', ')}`);
  assert(gaps.length === 0, 'No gaps in 1..849 sequence', `Gaps: ${gaps.join(', ')}`);
  assert(seenIds.size === 849, 'Exactly 849 distinct IDs present', `Count: ${seenIds.size}`);

  // Specifically check the 8 restored IDs
  const restoredIds = [345, 361, 386, 579, 710, 712, 737, 806];
  for (const rid of restoredIds) {
    const item = movies.find(m => m.id === rid);
    assert(item !== undefined, `Restored ID ${rid} must exist in catalog`);
    if (item) {
      assert(item.title && item.title.trim().length > 0, `Restored ID ${rid} has valid title`, item.title);
      assert(item.poster && item.poster.startsWith('https://'), `Restored ID ${rid} has valid poster`, item.poster);
    }
  }
});

// -------------------------------------------------------------
// SUITE 2: Kinopoisk ID Deduplication & Collision Testing
// -------------------------------------------------------------
runSuite('Kinopoisk ID Deduplication & Collision Testing', () => {
  const kpMap = new Map();
  const collisions = [];
  let nullCount = 0;
  let nonNullCount = 0;

  for (const m of movies) {
    if (m.kinopoiskId === null || m.kinopoiskId === undefined) {
      nullCount++;
      continue;
    }

    nonNullCount++;
    assert(typeof m.kinopoiskId === 'number' && Number.isInteger(m.kinopoiskId) && m.kinopoiskId > 0,
      `Movie #${m.id} (${m.title}) has positive integer kinopoiskId`, `Got ${m.kinopoiskId}`);

    if (kpMap.has(m.kinopoiskId)) {
      const prev = kpMap.get(m.kinopoiskId);
      collisions.push({ kpId: m.kinopoiskId, movieA: prev, movieB: { id: m.id, title: m.title } });
    } else {
      kpMap.set(m.kinopoiskId, { id: m.id, title: m.title });
    }
  }

  assert(collisions.length === 0, 'Zero Kinopoisk ID collisions among non-null entries',
    collisions.map(c => `KP ${c.kpId} shared by #${c.movieA.id} (${c.movieA.title}) and #${c.movieB.id} (${c.movieB.title})`).join('; '));

  assert(nonNullCount + nullCount === 849, 'Sum of non-null and null KP IDs equals 849', `${nonNullCount} + ${nullCount} = ${nonNullCount + nullCount}`);
  assert(kpMap.size === nonNullCount, 'All non-null KP IDs are strictly unique', `Unique KP IDs: ${kpMap.size}`);

  // Test historical collision pairs
  const historicalCollisions = [
    { idA: 70, idB: 347, label: 'Lawrence of Arabia (#70) vs Sherlock Series (#347)' },
    { idA: 84, idB: 357, label: 'Cinema Paradiso (#84) vs Chernobyl Series (#357)' },
    { idA: 91, idB: 448, label: 'Singin in the Rain (#91) vs Fargo Series (#448)' },
    { idA: 134, idB: 370, label: 'Wages of Fear (#134) vs Westworld Series (#370)' },
    { idA: 173, idB: 401, label: 'Fargo Film (#173) vs Twin Peaks Series (#401)' }
  ];

  for (const pair of historicalCollisions) {
    const itemA = movies.find(m => m.id === pair.idA);
    const itemB = movies.find(m => m.id === pair.idB);
    assert(itemA && itemB, `Both items exist for pair ${pair.label}`);
    if (itemA && itemB) {
      assert(itemA.kinopoiskId !== itemB.kinopoiskId, `Pair ${pair.label} have distinct KP IDs`,
        `#${itemA.id} KP=${itemA.kinopoiskId}, #${itemB.id} KP=${itemB.kinopoiskId}`);
    }
  }
});

// -------------------------------------------------------------
// SUITE 3: Poster & Media URL HTTPS Integrity
// -------------------------------------------------------------
runSuite('Poster & Media URL HTTPS Integrity', () => {
  let invalidPosters = 0;
  let emptyPosters = 0;
  let nonHttpsPosters = 0;
  let malformedUrls = 0;

  for (const m of movies) {
    if (!m.poster || typeof m.poster !== 'string' || m.poster.trim().length === 0) {
      emptyPosters++;
      invalidPosters++;
      continue;
    }

    if (!m.poster.startsWith('https://')) {
      nonHttpsPosters++;
      invalidPosters++;
    }

    try {
      const parsed = new URL(m.poster);
      assert(parsed.protocol === 'https:', `Movie #${m.id} poster protocol is https:`);
      assert(parsed.hostname.length > 3, `Movie #${m.id} poster hostname is valid`, parsed.hostname);
    } catch (e) {
      malformedUrls++;
      invalidPosters++;
    }

    // Check for dummy or placeholder domains
    assert(!m.poster.includes('example.com') && !m.poster.includes('placeholder'),
      `Movie #${m.id} does not use placeholder poster domain`, m.poster);

    // Backdrop check if present
    if (m.backdrop !== undefined && m.backdrop !== null) {
      assert(typeof m.backdrop === 'string' && (m.backdrop.startsWith('https://') || m.backdrop.startsWith('/')),
        `Movie #${m.id} backdrop URL valid format`, m.backdrop);
    }
  }

  assert(emptyPosters === 0, 'Zero empty poster strings', `Found ${emptyPosters}`);
  assert(nonHttpsPosters === 0, 'Zero non-HTTPS poster URLs', `Found ${nonHttpsPosters}`);
  assert(malformedUrls === 0, 'Zero malformed poster URLs', `Found ${malformedUrls}`);
  assert(invalidPosters === 0, '100% of 849 posters are valid HTTPS URLs', `Invalid: ${invalidPosters}`);

  // Specifically check IDs 441, 445, 806
  const formerlyEmpty = [441, 445, 806];
  for (const id of formerlyEmpty) {
    const item = movies.find(m => m.id === id);
    assert(item && item.poster && item.poster.startsWith('https://'),
      `Formerly empty poster ID #${id} now has valid HTTPS poster`, item?.poster);
  }
});

// -------------------------------------------------------------
// SUITE 4: Western Animation vs Anime Boundary Isolation
// -------------------------------------------------------------
runSuite('Western Animation vs Anime Boundary Isolation', () => {
  // Western animation studios / creators should NEVER be in anime
  const westernSeriesTitles = [
    { id: 377, title: 'Гравити Фолз', expectedCat: 'series' },
    { id: 392, title: 'Конь БоДжек', expectedCat: 'series' },
    { id: 393, title: 'Рик и Морти', expectedCat: 'series' },
    { id: 396, title: 'Любовь. Смерть. Роботы', expectedCat: 'series' },
    { id: 566, title: 'Юные титаны', expectedCat: 'series' },
    { id: 591, title: 'Аватар: Легенда об Аанге', expectedCat: 'series' },
    { id: 605, title: 'Аркейн', expectedCat: 'series' },
    { id: 644, title: 'Южный Парк', expectedCat: 'series' },
    { id: 646, title: 'По ту сторону изгороди', expectedCat: 'series' },
    { id: 657, title: 'Голубоглазый самурай', expectedCat: 'series' },
    { id: 674, title: 'Время приключений', expectedCat: 'series' }
  ];

  for (const wt of westernSeriesTitles) {
    const item = movies.find(m => m.id === wt.id);
    assert(item !== undefined, `Western series "${wt.title}" (#${wt.id}) exists`);
    if (item) {
      assert(item.category === wt.expectedCat,
        `Western series "${wt.title}" (#${wt.id}) is categorized as "${wt.expectedCat}"`, `Found: ${item.category}`);
      assert(item.category !== 'anime',
        `Western series "${wt.title}" (#${wt.id}) is NOT in 'anime'`);
    }
  }

  const westernMovieTitles = [
    { id: 25, title: 'Король Лев', expectedCat: 'movie' },
    { id: 144, title: 'В поисках Немо', expectedCat: 'movie' },
    { id: 211, title: 'Человек-паук: Через вселенные', expectedCat: 'movie' },
    { id: 248, title: 'ВАЛЛ-И', expectedCat: 'movie' },
    { id: 278, title: 'Человек-паук: Паутина вселенных', expectedCat: 'movie' },
    { id: 293, title: 'Клаус', expectedCat: 'movie' },
    { id: 340, title: 'Рапунцель: Запутанная история', expectedCat: 'movie' }
  ];

  for (const wm of westernMovieTitles) {
    const item = movies.find(m => m.id === wm.id);
    assert(item !== undefined, `Western film "${wm.title}" (#${wm.id}) exists`);
    if (item) {
      assert(item.category === wm.expectedCat,
        `Western film "${wm.title}" (#${wm.id}) is categorized as "${wm.expectedCat}"`, `Found: ${item.category}`);
      assert(item.category !== 'anime',
        `Western film "${wm.title}" (#${wm.id}) is NOT in 'anime'`);
    }
  }

  // Anime items audit: verify that all anime items have valid anime origins (Japan or Japanese anime studio)
  const animeItems = movies.filter(m => m.category === 'anime');
  assert(animeItems.length === 147, `Anime category count is exactly 147`, `Found ${animeItems.length}`);

  for (const a of animeItems) {
    const cLower = (a.country || '').toLowerCase();
    const gLower = (a.genres || '').toLowerCase();
    const tLower = (a.titleRu || a.title || '').toLowerCase();
    
    // Non-Japanese countries in anime check
    const isJapan = cLower.includes('япония') || cLower.includes('japan');
    assert(isJapan, `Anime item #${a.id} ("${a.titleRu}") originates from Japan`, `Country: "${a.country}"`);
  }
});

// -------------------------------------------------------------
// SUITE 5: Series vs Movie Cross-Contamination
// -------------------------------------------------------------
runSuite('Series vs Movie Cross-Contamination', () => {
  const movieItems = movies.filter(m => m.category === 'movie');
  const seriesItems = movies.filter(m => m.category === 'series');

  assert(movieItems.length === 440, `Movie category count is exactly 440`, `Found ${movieItems.length}`);
  assert(seriesItems.length === 262, `Series category count is exactly 262`, `Found ${seriesItems.length}`);

  // Movie category must not contain serial markers
  for (const m of movieItems) {
    const gLower = (m.genres || '').toLowerCase();
    assert(!gLower.includes('сериал') && !gLower.includes('телесериал') && !gLower.includes('мини-сериал'),
      `Movie #${m.id} ("${m.titleRu}") does not contain series genre markers`, m.genres);
    assert(!gLower.includes('аниме'),
      `Movie #${m.id} ("${m.titleRu}") does not contain anime genre markers`, m.genres);
  }

  // Famous series must be in series category
  const famousSeries = [
    { title: 'Во все тяжкие', id: 346 },
    { title: 'Игра престолов', id: 348 },
    { title: 'Клан Сопрано', id: 350 },
    { title: 'Чернобыль', id: 357 },
    { title: 'Прослушка', id: 353 },
    { title: 'Настоящий детектив', id: 354 },
    { title: 'Фарго', id: 448 }
  ];

  for (const s of famousSeries) {
    const item = movies.find(m => m.id === s.id);
    assert(item !== undefined, `Famous series "${s.title}" (#${s.id}) exists`);
    if (item) {
      assert(item.category === 'series', `Series "${s.title}" (#${s.id}) has category 'series'`, item.category);
    }
  }

  // Famous movies must be in movie category
  const famousMovies = [
    { title: 'Побег из Шоушенка', id: 1 },
    { title: 'Крёстный отец', id: 2 },
    { title: 'Тёмный рыцарь', id: 3 },
    { title: 'Криминальное чтиво', id: 8 },
    { title: 'Бойцовский клуб', id: 10 },
    { title: 'Начало', id: 13 },
    { title: 'Матрица', id: 16 }
  ];

  for (const fm of famousMovies) {
    const item = movies.find(m => m.id === fm.id);
    assert(item !== undefined, `Famous movie "${fm.title}" (#${fm.id}) exists`);
    if (item) {
      assert(item.category === 'movie', `Movie "${fm.title}" (#${fm.id}) has category 'movie'`, item.category);
    }
  }
});

// -------------------------------------------------------------
// SUITE 6: item.type vs item.category Strict Synchronization
// -------------------------------------------------------------
runSuite('item.type vs item.category Strict Synchronization', () => {
  let mismatchedCount = 0;
  let missingTypeCount = 0;
  let missingCategoryCount = 0;

  for (const m of movies) {
    if (!m.category) missingCategoryCount++;
    if (!m.type) missingTypeCount++;

    if (m.type !== m.category) {
      mismatchedCount++;
      assert(false, `Movie #${m.id} has type !== category`, `type="${m.type}", category="${m.category}"`);
    }
  }

  assert(missingCategoryCount === 0, 'Zero items missing category', `Missing: ${missingCategoryCount}`);
  assert(missingTypeCount === 0, 'Zero items missing type', `Missing: ${missingTypeCount}`);
  assert(mismatchedCount === 0, '100% of 849 items have type === category', `Mismatches: ${mismatchedCount}`);
});

// -------------------------------------------------------------
// SUITE 7: Sensation Vector (5D) Completeness & Dimensions
// -------------------------------------------------------------
runSuite('Sensation Vector (5D) Completeness & Dimensions', () => {
  const requiredKeys = ['energy', 'darkness', 'intellect', 'emotion', 'dynamism'];
  let invalidVectorCount = 0;

  const minVals = { energy: Infinity, darkness: Infinity, intellect: Infinity, emotion: Infinity, dynamism: Infinity };
  const maxVals = { energy: -Infinity, darkness: -Infinity, intellect: -Infinity, emotion: -Infinity, dynamism: -Infinity };

  for (const m of movies) {
    if (!m.sensationVector || typeof m.sensationVector !== 'object') {
      invalidVectorCount++;
      assert(false, `Movie #${m.id} missing sensationVector object`);
      continue;
    }

    for (const k of requiredKeys) {
      const val = m.sensationVector[k];
      assert(typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val),
        `Movie #${m.id} sensationVector.${k} is finite number`, `Got ${val}`);
      assert(val >= 0 && val <= 10, `Movie #${m.id} sensationVector.${k} is within [0, 10]`, `Got ${val}`);

      if (val < minVals[k]) minVals[k] = val;
      if (val > maxVals[k]) maxVals[k] = val;
    }
  }

  assert(invalidVectorCount === 0, '100% of items possess valid 5D sensation vectors', `Invalid: ${invalidVectorCount}`);
  console.log(`    Vector Value Ranges: ${JSON.stringify({ min: minVals, max: maxVals })}`);

  // Test vector mathematical operations from recommendationEngine
  const vA = { energy: 8, darkness: 2, intellect: 9, emotion: 7, dynamism: 8 };
  const vB = { energy: 4, darkness: 6, intellect: 5, emotion: 3, dynamism: 4 };

  const dist = calculateVectorDistance(vA, vB);
  assert(dist > 0 && Number.isFinite(dist), 'calculateVectorDistance returns valid positive float', dist);

  const comp = calculateCompromiseVector(vA, vB);
  assert(comp.energy === 6 && comp.darkness === 4 && comp.intellect === 7 && comp.emotion === 5 && comp.dynamism === 6,
    'calculateCompromiseVector produces accurate midpoint', JSON.stringify(comp));

  const userTaste = calculateUserTasteVector([1, 2, 3]);
  assert(userTaste && typeof userTaste.energy === 'number', 'calculateUserTasteVector returns valid 5D taste vector');
});

// -------------------------------------------------------------
// SUITE 8: Vibe Badges Validation
// -------------------------------------------------------------
runSuite('Vibe Badges Validation', () => {
  let emptyBadgesCount = 0;
  let nonStringBadgesCount = 0;

  for (const m of movies) {
    if (!Array.isArray(m.vibeBadges) || m.vibeBadges.length === 0) {
      emptyBadgesCount++;
      continue;
    }

    for (const b of m.vibeBadges) {
      if (typeof b !== 'string' || b.trim().length === 0) {
        nonStringBadgesCount++;
      }
    }
  }

  assert(emptyBadgesCount === 0, 'Zero movies with empty vibeBadges array', `Empty: ${emptyBadgesCount}`);
  assert(nonStringBadgesCount === 0, 'All vibe badges are non-empty strings', `Non-string: ${nonStringBadgesCount}`);
});

// -------------------------------------------------------------
// SUITE 9: Engine Deck Category Purity & Compromise Robustness
// -------------------------------------------------------------
runSuite('Engine Deck Category Purity & Compromise Robustness', () => {
  const categories = ['movie', 'series', 'anime'];

  // Test solo recommendation deck category purity
  for (const cat of categories) {
    const deck = getRecommendedDeck({
      filters: { category: cat },
      limit: 30
    });

    assert(deck.length > 0, `getRecommendedDeck returns items for category "${cat}"`, `Count: ${deck.length}`);
    const impure = deck.filter(m => m.category !== cat);
    assert(impure.length === 0, `getRecommendedDeck for "${cat}" is 100% pure (0 cross-category items)`,
      `Impure count: ${impure.length}`);
  }

  // Test multiplayer compromise deck category purity across 50 randomized iterations
  for (let trial = 0; trial < 50; trial++) {
    const randCat = categories[trial % categories.length];
    const randLikesA = [Math.floor(Math.random() * 800) + 1, Math.floor(Math.random() * 800) + 1];
    const randLikesB = [Math.floor(Math.random() * 800) + 1, Math.floor(Math.random() * 800) + 1];

    const roomDeck = generateRoomCompromiseDeck(randLikesA, randLikesB, { category: randCat });
    assert(roomDeck.length === 25, `Trial ${trial}: Room compromise deck size is exactly 25`, `Got ${roomDeck.length}`);

    const impure = roomDeck.filter(m => m.category !== randCat);
    assert(impure.length === 0, `Trial ${trial}: Room deck for "${randCat}" has 0 impure items`,
      impure.map(m => `#${m.id} (${m.titleRu}: ${m.category})`).join(', '));

    // Check for internal duplicates within single compromise deck
    const deckIds = roomDeck.map(m => m.id);
    const uniqueDeckIds = new Set(deckIds);
    assert(uniqueDeckIds.size === roomDeck.length, `Trial ${trial}: Room deck contains no duplicate movies`,
      `Unique: ${uniqueDeckIds.size}/${roomDeck.length}`);
  }
});

// -------------------------------------------------------------
// SUITE 10: General Schema & Data Completeness
// -------------------------------------------------------------
runSuite('General Schema & Data Completeness', () => {
  for (const m of movies) {
    assert(typeof m.title === 'string' && m.title.trim().length > 0, `Movie #${m.id} has non-empty title`);
    assert(typeof m.titleRu === 'string' && m.titleRu.trim().length > 0, `Movie #${m.id} has non-empty titleRu`);
    assert(typeof m.year === 'number' && m.year >= 1900 && m.year <= 2030, `Movie #${m.id} has valid year`, m.year);
    assert(typeof m.rating === 'number' && m.rating >= 0 && m.rating <= 10, `Movie #${m.id} has valid rating`, m.rating);
    assert(typeof m.description === 'string' && m.description.trim().length > 0, `Movie #${m.id} has non-empty description`);
    assert(typeof m.fullDescription === 'string' && m.fullDescription.trim().length > 0, `Movie #${m.id} has non-empty fullDescription`);
    assert(typeof m.country === 'string' && m.country.trim().length > 0, `Movie #${m.id} has non-empty country`);
    assert(typeof m.genres === 'string' && m.genres.trim().length > 0, `Movie #${m.id} has non-empty genres`);
  }
});

// -------------------------------------------------------------
// SUMMARY & VERDICT
// -------------------------------------------------------------
console.log(`\n${colors.bold}${colors.cyan}======================================================${colors.reset}`);
console.log(`${colors.bold}ADVERSARIAL STRESS TEST SUMMARY:${colors.reset}`);
console.log(`  Total Test Suites:      ${totalSuites}`);
console.log(`  Passed Test Suites:     ${colors.green}${passedSuites} / ${totalSuites}${colors.reset}`);
console.log(`  Total Assertions Run:   ${totalAssertions}`);
console.log(`  Passed Assertions:      ${colors.green}${passedAssertions} / ${totalAssertions}${colors.reset}`);
console.log(`  Failed Assertions:      ${failureLog.length > 0 ? colors.red : colors.green}${failureLog.length}${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}`);

if (failureLog.length > 0) {
  console.log(`\n${colors.bold}${colors.red}CHALLENGER VERDICT: REQUEST_CHANGES${colors.reset}`);
  console.log(`Defects to address:`);
  for (const f of failureLog) {
    console.log(`  - [${f.testName}] ${f.details}`);
  }
  process.exit(1);
} else {
  console.log(`\n${colors.bold}${colors.green}CHALLENGER VERDICT: APPROVE${colors.reset}`);
  console.log(`All 10 adversarial suites passed with 100% integrity across 849 titles.`);
  process.exit(0);
}
