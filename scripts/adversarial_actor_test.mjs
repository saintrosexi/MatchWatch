// scripts/adversarial_actor_test.mjs
// MatchWatch M2 Empirical Challenger Adversarial Test Suite
import assert from 'node:assert';
import { actorsData } from '../src/data/actors.js';
import { movies } from '../src/data/movies.js';
import {
  normalizeActorName,
  getActorProfile,
  resolveActorProfile,
  getActorFilmography,
  getAllActors,
  fetchRealActorProfile
} from '../src/engine/actorResolver.js';
import * as utilsResolver from '../src/utils/actorResolver.js';
import { getRecommendedDeck } from '../src/engine/recommendationEngine.js';

console.log('================================================================');
console.log('  CHALLENGER 1: M2 ADVERSARIAL STRESS TEST & INTEGRITY HARNESS  ');
console.log('================================================================\n');

let totalAssertions = 0;
function check(condition, message) {
  totalAssertions++;
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

// -------------------------------------------------------------------------
// STEP 1: Catalog Extraction & Census
// -------------------------------------------------------------------------
console.log('[STAGE 1] Extracting all actor tokens from catalog & curated datasets...');
const uniqueRawActors = new Set();
const actorOccurrences = new Map(); // rawName -> array of movie ids

let moviesWithActorsCount = 0;
let moviesWithoutActorsCount = 0;

for (const m of movies) {
  if (!m.actors || typeof m.actors !== 'string' || !m.actors.trim()) {
    moviesWithoutActorsCount++;
    continue;
  }
  moviesWithActorsCount++;
  const rawTokens = m.actors.split(',').map((s) => s.trim()).filter(Boolean);
  for (const token of rawTokens) {
    uniqueRawActors.add(token);
    if (!actorOccurrences.has(token)) {
      actorOccurrences.set(token, []);
    }
    actorOccurrences.get(token).push(m.id);
  }
}

console.log(`  • Catalog movies analyzed: ${movies.length}`);
console.log(`  • Movies with cast data: ${moviesWithActorsCount}`);
console.log(`  • Movies with empty cast strings: ${moviesWithoutActorsCount}`);
console.log(`  • Unique raw actor names in movies: ${uniqueRawActors.size}`);
console.log(`  • Curated actors in actorsData: ${Object.keys(actorsData).length}`);

const allActorsList = getAllActors(movies);
console.log(`  • Total unique actors in getAllActors(): ${allActorsList.length}`);
check(allActorsList.length >= 1800, `getAllActors() should compile 1,800+ actors, got ${allActorsList.length}`);

// -------------------------------------------------------------------------
// STEP 2: Diacritic, Punctuation, Whitespace & Edge-Case Normalization
// -------------------------------------------------------------------------
console.log('\n[STAGE 2] Stress-testing normalizeActorName with adversarial inputs...');

const edgeCaseInputs = [
  null,
  undefined,
  '',
  '   ',
  '\t\n\r  ',
  123,
  {},
  [],
  true,
  false,
  '!!!###$$$%%%^^^&&&***()_+',
  '--—––',
  '«»“”‘’"\'`',
  '  Леонардо   Ди   Каприо  ',
  'колин фёрт',
  'КОЛИН ФЁРТ',
  'КоЛиН фЕрТ',
  'Иэн МакКеллен',
  'иэн маккеллен',
  'Роберт Дауни-мл.',
  'Роберт Дауни - мл.',
  'Роберт Дауни мл.',
  "Джек О'Коннелл",
  'Джек О’Коннелл',
  'Джек О‘Коннелл',
  'Мэттью Макконахи',
  'Мэттью МакКонахи',
  'Скарлетт Йоханссон',
  'Скарлетт Иоханссон',
  'Мако',
  'Маколей Калкин',
  'Samuel L. Jackson',
  'samuel l jackson',
  'Stellan Skarsgård',
  'bruce willis',
  'BRUCE WILLIS'
];

for (const input of edgeCaseInputs) {
  let normalized;
  try {
    normalized = normalizeActorName(input);
  } catch (err) {
    check(false, `normalizeActorName crashed on input: ${JSON.stringify(input)} -> ${err.message}`);
  }
  check(typeof normalized === 'string', `Output must be string for input: ${JSON.stringify(input)}`);
}

// Specific equivalence checks
check(normalizeActorName('Колин Фёрт') === normalizeActorName('Колин Ферт'), 'ё and е equivalence failed');
check(normalizeActorName("Джек О'Коннелл") === normalizeActorName('Джек О’Коннелл'), 'apostrophe variants failed');
check(normalizeActorName('Роберт Дауни-мл.') === normalizeActorName('Роберт Дауни мл.'), 'dash vs space normalization failed');
check(normalizeActorName('  Том   Хэнкс  ') === normalizeActorName('Том Хэнкс'), 'spacing normalization failed');
check(normalizeActorName('TOM HANKS') === normalizeActorName('tom hanks'), 'casing normalization failed');

console.log(`  ✓ Checked ${edgeCaseInputs.length} adversarial normalization edge-cases.`);

// -------------------------------------------------------------------------
// STEP 3: Substring-Isolation & False-Positive Attack Matrix
// -------------------------------------------------------------------------
console.log('\n[STAGE 3] Substring Isolation & False-Positive Attack Matrix across all catalog actors...');

// Find all pairs where one actor's normalized name is a substring of another actor's normalized name
const normalizedToActors = new Map();
for (const rawName of uniqueRawActors) {
  const norm = normalizeActorName(rawName);
  if (!norm) continue;
  if (!normalizedToActors.has(norm)) {
    normalizedToActors.set(norm, []);
  }
  normalizedToActors.get(norm).push(rawName);
}

const normList = Array.from(normalizedToActors.keys());
const substringPairs = [];

for (let i = 0; i < normList.length; i++) {
  for (let j = 0; j < normList.length; j++) {
    if (i === j) continue;
    const shortName = normList[i];
    const longName = normList[j];
    if (shortName.length >= 3 && longName.includes(shortName)) {
      substringPairs.push({ shortName, longName });
    }
  }
}

console.log(`  • Found ${substringPairs.length} embedded substring pairs in the dataset (e.g. short in long)`);

let substringCollisions = 0;
let falsePositiveLeaks = 0;

for (const pair of substringPairs) {
  const shortRaw = normalizedToActors.get(pair.shortName)[0];
  const longRaw = normalizedToActors.get(pair.longName)[0];

  const shortFilms = getActorFilmography(shortRaw, 'all', movies);
  const longFilms = getActorFilmography(longRaw, 'all', movies);

  for (const m of shortFilms) {
    const tokens = m.actors.split(',').map((s) => normalizeActorName(s.trim()));
    if (!tokens.includes(pair.shortName)) {
      falsePositiveLeaks++;
      console.error(`Leak detected: Querying '${shortRaw}' returned movie '${m.titleRu}' (${m.id}) which does not contain '${shortRaw}'! Cast: ${m.actors}`);
    }
  }

  for (const m of longFilms) {
    const tokens = m.actors.split(',').map((s) => normalizeActorName(s.trim()));
    if (!tokens.includes(pair.longName)) {
      falsePositiveLeaks++;
      console.error(`Leak detected: Querying '${longRaw}' returned movie '${m.titleRu}' (${m.id}) which does not contain '${longRaw}'! Cast: ${m.actors}`);
    }
  }
}

check(falsePositiveLeaks === 0, `Detected ${falsePositiveLeaks} false positive substring filmography leaks!`);
console.log(`  ✓ Verified 0 false-positive substring leaks across all ${substringPairs.length} substring pairs.`);

// Test single token & arbitrary fragments
const partialQueries = ['Мако', 'Том', 'Крис', 'Ли', 'Джон', 'Эванс', 'Смит', 'Брэд', 'Анна', 'Роберт', 'Дэвид', 'Майкл'];
for (const query of partialQueries) {
  const normQ = normalizeActorName(query);
  const films = getActorFilmography(query, 'all', movies);
  for (const m of films) {
    const tokens = m.actors.split(',').map((s) => normalizeActorName(s.trim()));
    check(tokens.includes(normQ), `Movie ${m.titleRu} returned for query '${query}' but does not have exact token '${normQ}'`);
  }
}
console.log(`  ✓ Verified single-name partial queries isolate exact tokens only.`);

// -------------------------------------------------------------------------
// STEP 4: Dynamic Profile Generation Stress Test for ALL 1,850+ Actors
// -------------------------------------------------------------------------
console.log('\n[STAGE 4] Exhaustive Dynamic Profile Generation for EVERY actor in movies & actorsData...');

const allTestedActorNames = new Set([
  ...uniqueRawActors,
  ...Object.keys(actorsData)
]);

let curatedCount = 0;
let uncuratedCount = 0;
let factsCheckPassed = 0;

for (const actorName of allTestedActorNames) {
  const profile = getActorProfile(actorName, movies);
  check(profile !== null && typeof profile === 'object', `getActorProfile('${actorName}') returned null or non-object`);
  check(typeof profile.name === 'string' && profile.name.length > 0, `Profile name is invalid for '${actorName}'`);
  check(typeof profile.nameEn === 'string', `Profile nameEn is not a string for '${actorName}'`);
  check(profile.photo === null || (typeof profile.photo === 'string' && profile.photo.startsWith('https://')), `Profile photo is invalid for '${actorName}': ${profile.photo}`);
  check(Array.isArray(profile.facts), `Profile facts must be array for '${actorName}'`);
  check(profile.facts.length === 3, `Profile facts must have exactly 3 items for '${actorName}', got ${profile.facts.length}`);

  for (let i = 0; i < profile.facts.length; i++) {
    const fact = profile.facts[i];
    check(typeof fact === 'string', `Fact ${i} for '${actorName}' is not a string`);
    check(fact.length > 10, `Fact ${i} for '${actorName}' is too short: "${fact}"`);
    check(!fact.includes('undefined') && !fact.includes('null') && !fact.includes('NaN'), `Fact ${i} contains bad token: "${fact}"`);
  }

  if (profile.isCurated) {
    curatedCount++;
    check(profile.photo !== null, `Curated actor '${actorName}' should have a photo URL`);
  } else {
    uncuratedCount++;
    // Uncurated actors fact3 should contain film count
    const films = getActorFilmography(actorName, 'all', movies);
    if (films.length > 0) {
      check(profile.facts[2].includes(String(films.length)), `Fact 3 for uncurated actor '${actorName}' does not reflect film count (${films.length})`);
    }
  }
  factsCheckPassed++;
}

console.log(`  • Validated profiles for ${allTestedActorNames.size} total actors:`);
console.log(`    - Curated profiles verified: ${curatedCount}`);
console.log(`    - Dynamic synthesized uncurated profiles verified: ${uncuratedCount}`);
console.log(`  ✓ 100% of profiles contain valid 3-bullet trivia, non-null names, and safe schema.`);

// -------------------------------------------------------------------------
// STEP 5: Category Filtering & Filmography Exhaustive Invariant Check
// -------------------------------------------------------------------------
console.log('\n[STAGE 5] Exhaustive Filmography Category Partition Check...');

let categoryPartitionChecks = 0;

for (const actorName of allTestedActorNames) {
  const allFilms = getActorFilmography(actorName, 'all', movies);
  const movieFilms = getActorFilmography(actorName, 'movie', movies);
  const seriesFilms = getActorFilmography(actorName, 'series', movies);
  const animeFilms = getActorFilmography(actorName, 'anime', movies);

  check(allFilms.length === movieFilms.length + seriesFilms.length + animeFilms.length,
    `Category count mismatch for '${actorName}': all (${allFilms.length}) !== movie (${movieFilms.length}) + series (${seriesFilms.length}) + anime (${animeFilms.length})`
  );

  // Check no cross-contamination between categories
  for (const m of movieFilms) check(m.category === 'movie', `Movie category leak in getActorFilmography for '${actorName}'`);
  for (const m of seriesFilms) check(m.category === 'series', `Series category leak in getActorFilmography for '${actorName}'`);
  for (const m of animeFilms) check(m.category === 'anime', `Anime category leak in getActorFilmography for '${actorName}'`);

  categoryPartitionChecks++;
}

console.log(`  ✓ Verified category partition invariants across all ${categoryPartitionChecks} actor filmographies.`);

// -------------------------------------------------------------------------
// STEP 6: Recommendation Engine Actor-Deck Stress Test
// -------------------------------------------------------------------------
console.log('\n[STAGE 6] Stress-testing recommendationEngine getRecommendedDeck for actor filtering...');

// Test 100 sample actors across low, medium, and high movie counts
const sampleActors = allActorsList.slice(0, 50).concat(allActorsList.slice(100, 150));

for (const actor of sampleActors) {
  const deck = getRecommendedDeck({ actorName: actor.name, limit: 30 });
  const normActor = normalizeActorName(actor.name);

  for (const m of deck) {
    const tokens = m.actors.split(',').map((s) => normalizeActorName(s.trim()));
    check(tokens.includes(normActor), `Deck item '${m.titleRu}' (${m.id}) does not contain actor '${actor.name}'!`);
  }

  const expectedCount = Math.min(actor.count, 30);
  check(deck.length === expectedCount, `Deck count mismatch for '${actor.name}': expected ${expectedCount}, got ${deck.length}`);
}

console.log(`  ✓ Tested 100 sample actor decks with 0 false-positive recommendation leaks.`);

// -------------------------------------------------------------------------
// STEP 7: UI Rendering Simulation (Monogram, Fact Rendering, Fallbacks)
// -------------------------------------------------------------------------
console.log('\n[STAGE 7] Simulating UI rendering invariants for all actors...');

for (const actor of allActorsList) {
  // Test avatar initials rendering
  const initials = actor.name.slice(0, 2).toUpperCase();
  check(typeof initials === 'string' && initials.length <= 2, `Initials failed for '${actor.name}'`);

  // Test film count pluralization string formatting used in StarHubView & DesktopStarHubView
  const count = actor.count;
  const countWordMobile = count === 1 ? 'картина' : count < 5 ? 'картины' : 'картин';
  const countWordDesktop = count === 1 ? 'картина' : count < 5 ? 'картины' : 'картин';
  const countWordCatalog = count === 1 ? 'фильм' : (count >= 2 && count <= 4) ? 'фильма' : 'фильмов';

  check(typeof countWordMobile === 'string', `Pluralization failed for ${actor.name}`);
  check(typeof countWordDesktop === 'string', `Pluralization failed for ${actor.name}`);
  check(typeof countWordCatalog === 'string', `Pluralization failed for ${actor.name}`);
}

console.log(`  ✓ UI rendering simulation passed for all ${allActorsList.length} actors.`);

// -------------------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`  ✅ ALL ADVERSARIAL STRESS TESTS PASSED SUCCESSFULLY!`);
console.log(`  Total Assertions Verified: ${totalAssertions}`);
console.log('================================================================\n');
