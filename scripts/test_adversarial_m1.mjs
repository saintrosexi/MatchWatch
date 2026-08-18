/**
 * Adversarial Stress Test Suite for Milestone M1
 * Challenger 2: Recommendation Engine & UI Category Filtering Integrity
 */

import { movies } from '../src/data/movies.js';
import {
  calculateVectorDistance,
  calculateCompromiseVector,
  calculateUserTasteVector,
  getRecommendedDeck,
  generateRoomCompromiseDeck
} from '../src/engine/recommendationEngine.js';

console.log('══════════════════════════════════════════════════════════════════════');
console.log(' 🧪 ADVERSARIAL STRESS TEST SUITE — CHALLENGER 2 (M1) 🧪');
console.log('══════════════════════════════════════════════════════════════════════\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function assert(condition, message, details = {}) {
  totalTests++;
  if (condition) {
    passedTests++;
  } else {
    failedTests++;
    failureDetails.push({ message, details });
    console.error(`❌ FAIL: ${message}`, details);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: 1,000 Randomized Iterations for generateRoomCompromiseDeck
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ TEST SUITE 1: generateRoomCompromiseDeck Category Isolation (4,000 Iterations total)');

const categories = ['movie', 'series', 'anime', 'all'];
const allMovieIds = movies.map(m => m.id);

for (const category of categories) {
  let categoryContaminationCount = 0;
  let invalidDeckSizeCount = 0;
  let duplicateItemsCount = 0;
  const iterations = 1000;

  for (let i = 0; i < iterations; i++) {
    // Generate random user liked IDs (0 to 30 random IDs)
    const countA = Math.floor(Math.random() * 30);
    const countB = Math.floor(Math.random() * 30);

    const userLikesA = Array.from({ length: countA }, () => 
      allMovieIds[Math.floor(Math.random() * allMovieIds.length)]
    );
    const userLikesB = Array.from({ length: countB }, () => 
      allMovieIds[Math.floor(Math.random() * allMovieIds.length)]
    );

    // Occasional weird / extreme roomFilters
    const roomFilters = { category };
    if (Math.random() < 0.2) roomFilters.minRating = 7.0 + Math.random() * 1.5;
    if (Math.random() < 0.1) roomFilters.yearFrom = 1990 + Math.floor(Math.random() * 30);

    const deck = generateRoomCompromiseDeck(userLikesA, userLikesB, roomFilters);

    // 1. Check deck size (must be <= 25 and > 0 if available)
    if (deck.length === 0 || deck.length > 25) {
      invalidDeckSizeCount++;
    }

    // 2. Check for duplicates within deck
    const ids = deck.map(m => m.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      duplicateItemsCount++;
    }

    // 3. Check for category contamination
    if (category !== 'all') {
      const contaminated = deck.filter(m => m.category !== category || m.type !== category);
      if (contaminated.length > 0) {
        categoryContaminationCount++;
        if (categoryContaminationCount <= 3) {
          console.error(`Contamination in category ${category} on iteration ${i}:`, contaminated.map(c => ({ id: c.id, title: c.titleRu, cat: c.category, type: c.type })));
        }
      }
    }
  }

  assert(categoryContaminationCount === 0, 
    `generateRoomCompromiseDeck: 0% cross-category contamination in ${iterations} runs for category='${category}'`,
    { category, categoryContaminationCount, iterations }
  );

  assert(duplicateItemsCount === 0,
    `generateRoomCompromiseDeck: 0 duplicate items in decks across ${iterations} runs for category='${category}'`,
    { category, duplicateItemsCount }
  );

  assert(invalidDeckSizeCount === 0,
    `generateRoomCompromiseDeck: Deck sizes strictly valid across ${iterations} runs for category='${category}'`,
    { category, invalidDeckSizeCount }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Edge Cases & Adversarial Inputs for generateRoomCompromiseDeck
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n▶ TEST SUITE 2: generateRoomCompromiseDeck Extreme & Adversarial Edge Cases');

// Edge Case 2.1: Empty Member Likes
for (const cat of ['movie', 'series', 'anime']) {
  const deck = generateRoomCompromiseDeck([], [], { category: cat });
  assert(deck.length === 25, `Empty likes produces full 25-item deck for category='${cat}'`, { len: deck.length, cat });
  const badCat = deck.filter(m => m.category !== cat);
  assert(badCat.length === 0, `Empty likes produces 0% contamination for category='${cat}'`, { badCatLen: badCat.length });
}

// Edge Case 2.2: Corrupt / Non-existent / Extreme IDs
{
  const corruptLikesA = [-999, 0, 999999, 'corrupt', null, undefined, NaN, {}, []];
  const corruptLikesB = [Infinity, -Infinity, false, true, 849, 1];
  for (const cat of ['movie', 'series', 'anime']) {
    const deck = generateRoomCompromiseDeck(corruptLikesA, corruptLikesB, { category: cat });
    assert(deck.length === 25, `Corrupt likes gracefully handles and generates 25-item deck for cat='${cat}'`, { len: deck.length });
    const badCat = deck.filter(m => m.category !== cat);
    assert(badCat.length === 0, `Corrupt likes produces 0% contamination for cat='${cat}'`, { badCatLen: badCat.length });
  }
}

// Edge Case 2.3: Wildcard Category Integrity
{
  // Test that wildcards (inserted items) never leak other categories
  for (const cat of ['movie', 'series', 'anime']) {
    for (let testRun = 0; testRun < 200; testRun++) {
      const deck = generateRoomCompromiseDeck([1, 2, 3], [4, 5, 6], { category: cat });
      // In generateRoomCompromiseDeck, wildcards are inserted at indices 4, 9, 14, 19, 24
      const potentialWildcards = [deck[4], deck[9], deck[14], deck[19], deck[24]].filter(Boolean);
      const contaminatedWildcards = potentialWildcards.filter(m => m.category !== cat);
      assert(contaminatedWildcards.length === 0, `Wildcard positions in deck have 0% contamination for cat='${cat}'`, { testRun, contaminated: contaminatedWildcards.length });
      if (contaminatedWildcards.length > 0) break;
    }
  }
}

// Edge Case 2.4: Unsatisfiable Filter Constraints
{
  const impossibleFilter = { category: 'anime', minRating: 9.9, yearFrom: 2030 };
  const deck = generateRoomCompromiseDeck([], [], impossibleFilter);
  // Deck should be array, either empty or only containing matching items
  const nonMatching = deck.filter(m => m.category !== 'anime');
  assert(nonMatching.length === 0, 'Unsatisfiable filters never return cross-category items', { returned: deck.length, nonMatching: nonMatching.length });
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Adversarial Tests for getRecommendedDeck
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n▶ TEST SUITE 3: getRecommendedDeck Arbitrary & Complex Filters');

// Test 3.1: Category Filtering across all categories
for (const cat of ['movie', 'series', 'anime']) {
  const deck = getRecommendedDeck({ filters: { category: cat }, limit: 849 });
  const bad = deck.filter(m => m.category !== cat || m.type !== cat);
  assert(bad.length === 0, `getRecommendedDeck: 100% strict category isolation for category='${cat}'`, { total: deck.length, bad: bad.length });
  assert(deck.length > 0, `getRecommendedDeck: Found non-zero items for category='${cat}'`, { total: deck.length });
}

// Test 3.2: Seen Items Exclusion
{
  const likedIds = [1, 2, 3, 4, 5];
  const dislikedIds = [6, 7, 8, 9, 10];
  const deckWithoutSeen = getRecommendedDeck({
    likedIds,
    dislikedIds,
    filters: { includeSeen: false, category: 'all' },
    limit: 849
  });
  const leakedSeen = deckWithoutSeen.filter(m => likedIds.includes(m.id) || dislikedIds.includes(m.id));
  assert(leakedSeen.length === 0, 'getRecommendedDeck: Excludes 100% of seen items when includeSeen=false', { leaked: leakedSeen.length });

  const deckWithSeen = getRecommendedDeck({
    likedIds,
    dislikedIds,
    filters: { includeSeen: true, category: 'all' },
    limit: 849
  });
  const includedSeen = deckWithSeen.filter(m => likedIds.includes(m.id) || dislikedIds.includes(m.id));
  assert(includedSeen.length > 0, 'getRecommendedDeck: Includes seen items when includeSeen=true', { included: includedSeen.length });
}

// Test 3.3: Genre Inclusion and Exclusion
{
  const deckWithGenre = getRecommendedDeck({
    filters: { category: 'movie', genres: ['драма'] },
    limit: 849
  });
  const withoutDrama = deckWithGenre.filter(m => !(m.genres || '').toLowerCase().includes('драма'));
  assert(withoutDrama.length === 0, 'getRecommendedDeck: All returned items contain specified included genre', { total: deckWithGenre.length, bad: withoutDrama.length });

  const deckExcludedGenre = getRecommendedDeck({
    filters: { category: 'movie', excludedGenres: ['комедия'] },
    limit: 849
  });
  const withComedy = deckExcludedGenre.filter(m => (m.genres || '').toLowerCase().includes('комедия'));
  assert(withComedy.length === 0, 'getRecommendedDeck: Zero returned items contain excluded genre', { total: deckExcludedGenre.length, bad: withComedy.length });
}

// Test 3.4: Extreme Taste Vectors
{
  const extremeVectors = [
    { energy: 0, darkness: 0, intellect: 0, emotion: 0, dynamism: 0 },
    { energy: 10, darkness: 10, intellect: 10, emotion: 10, dynamism: 10 },
    { energy: -100, darkness: 1000, intellect: NaN, emotion: null },
    null,
    undefined,
    {}
  ];

  for (let i = 0; i < extremeVectors.length; i++) {
    const vec = extremeVectors[i];
    const deck = getRecommendedDeck({ userTasteVector: vec, limit: 10 });
    assert(deck.length === 10, `getRecommendedDeck: Handles extreme taste vector #${i} gracefully`, { vec, resultLength: deck.length });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: UI Filter Consistency (DiscoveryView vs DesktopDiscoveryView)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n▶ TEST SUITE 4: UI Filter Consistency between DiscoveryView & DesktopDiscoveryView');

// Emulate DiscoveryView filter logic:
function mobileDiscoveryFilter(category, genre = 'Все', search = '') {
  return movies.filter((m) => {
    const mGenres = (m.genres || '').toLowerCase();
    const itemCategory = m.category || m.type || 'movie';
    if (itemCategory !== category) return false;

    if (genre !== 'Все') {
      if (!mGenres.includes(genre.toLowerCase())) return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const titleMatch = (m.titleRu || m.title || '').toLowerCase().includes(q);
      const directorMatch = (m.director || '').toLowerCase().includes(q);
      const actorsMatch = (m.actors || '').toLowerCase().includes(q);
      return titleMatch || directorMatch || actorsMatch;
    }

    return true;
  });
}

// Emulate DesktopDiscoveryView filter logic:
function desktopDiscoveryFilter(category, genre = 'Все', minRating = 0, search = '') {
  return movies.filter((m) => {
    const itemCategory = m.category || 'movie';
    if (itemCategory !== category) return false;

    if (genre !== 'Все') {
      const mGenres = (m.genres || '').toLowerCase();
      if (!mGenres.includes(genre.toLowerCase())) return false;
    }

    if (m.rating < minRating) return false;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const titleMatch = (m.titleRu || m.title || '').toLowerCase().includes(q);
      const directorMatch = (m.director || '').toLowerCase().includes(q);
      const actorsMatch = (m.actors || '').toLowerCase().includes(q);
      return titleMatch || directorMatch || actorsMatch;
    }

    return true;
  });
}

// Test 4.1: Base Category Counts Parity
for (const cat of ['movie', 'series', 'anime']) {
  const mobileList = mobileDiscoveryFilter(cat);
  const desktopList = desktopDiscoveryFilter(cat, 'Все', 0);

  assert(mobileList.length === desktopList.length,
    `UI Category count parity for '${cat}': Mobile (${mobileList.length}) === Desktop (${desktopList.length})`,
    { cat, mobileCount: mobileList.length, desktopCount: desktopList.length }
  );

  // Check element-wise ID parity
  const mobileIds = new Set(mobileList.map(m => m.id));
  const desktopIds = new Set(desktopList.map(m => m.id));
  let mismatches = 0;
  for (const id of mobileIds) {
    if (!desktopIds.has(id)) mismatches++;
  }
  assert(mismatches === 0, `100% ID matching between mobile and desktop discovery for category='${cat}'`, { mismatches });
}

// Test 4.2: Genre Filter Consistency across categories
const testGenres = ['Боевик', 'Комедия', 'Драма', 'Триллер', 'Фантастика', 'Приключения', 'Криминал', 'Сёнэн', 'Фэнтези'];
for (const cat of ['movie', 'series', 'anime']) {
  for (const genre of testGenres) {
    const mobileList = mobileDiscoveryFilter(cat, genre);
    const desktopList = desktopDiscoveryFilter(cat, genre, 0);
    assert(mobileList.length === desktopList.length,
      `Genre filter '${genre}' parity in category '${cat}': Mobile (${mobileList.length}) === Desktop (${desktopList.length})`,
      { cat, genre, mobile: mobileList.length, desktop: desktopList.length }
    );
  }
}

// Test 4.3: Search Query Consistency
const testSearches = ['Нолан', 'Кристофер', 'Тарантино', 'Аниме', 'Миядзаки', 'Spider', 'Fargo', '199', '202'];
for (const cat of ['movie', 'series', 'anime']) {
  for (const q of testSearches) {
    const mobileList = mobileDiscoveryFilter(cat, 'Все', q);
    const desktopList = desktopDiscoveryFilter(cat, 'Все', 0, q);
    assert(mobileList.length === desktopList.length,
      `Search query '${q}' parity in category '${cat}': Mobile (${mobileList.length}) === Desktop (${desktopList.length})`,
      { cat, q, mobile: mobileList.length, desktop: desktopList.length }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Report
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════════════');
console.log(` 📊 ADVERSARIAL TEST RESULTS SUMMARY`);
console.log('══════════════════════════════════════════════════════════════════════');
console.log(`  Total Assertions: ${totalTests}`);
console.log(`  Passed:           ${passedTests} (\x1b[32m${((passedTests / totalTests) * 100).toFixed(2)}%\x1b[0m)`);
console.log(`  Failed:           ${failedTests} (${failedTests === 0 ? '\x1b[32m0\x1b[0m' : '\x1b[31m' + failedTests + '\x1b[0m'})`);

if (failedTests === 0) {
  console.log('\n \x1b[1;32m✅ ALL ADVERSARIAL STRESS TESTS PASSED WITH 0 DEFECTS\x1b[0m\n');
  process.exit(0);
} else {
  console.log('\n \x1b[1;31m❌ FAILURES DETECTED:\x1b[0m');
  console.log(JSON.stringify(failureDetails, null, 2));
  process.exit(1);
}
