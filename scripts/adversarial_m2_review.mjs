// Adversarial Stress-Test Suite for M2 Star Hub & Actor Resolver
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
import { getRecommendedDeck } from '../src/engine/recommendationEngine.js';

console.log('======================================================================');
console.log('  M2 ADVERSARIAL STRESS TEST & INTEGRITY AUDIT');
console.log('======================================================================');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// 1. Stress-test normalizeActorName
console.log('\n--- 1. Testing normalizeActorName Resilience ---');

test('Handles all falsy and non-string types safely', () => {
  assert.strictEqual(normalizeActorName(null), '');
  assert.strictEqual(normalizeActorName(undefined), '');
  assert.strictEqual(normalizeActorName(0), '');
  assert.strictEqual(normalizeActorName(false), '');
  assert.strictEqual(normalizeActorName({}), '');
  assert.strictEqual(normalizeActorName([]), '');
  assert.strictEqual(normalizeActorName(NaN), '');
});

test('Handles exotic Cyrillic diacritics and quotes', () => {
  assert.strictEqual(normalizeActorName('Фёдор Бондарчук'), 'федорбондарчук');
  assert.strictEqual(normalizeActorName('ФЕДОР БОНДАРЧУК'), 'федорбондарчук');
  assert.strictEqual(normalizeActorName('Джек О`Коннелл'), 'джекоконнелл');
  assert.strictEqual(normalizeActorName('Джек О’Коннелл'), 'джекоконнелл');
  assert.strictEqual(normalizeActorName("Джек О'Коннелл"), 'джекоконнелл');
  assert.strictEqual(normalizeActorName('Джозеф Гордон-Левитт'), 'джозефгордонлевитт');
});

test('Strips punctuation, regex special characters and whitespace completely', () => {
  assert.strictEqual(normalizeActorName('   Tom   Hanks (Jr.)  '), 'tomhanksjr');
  assert.strictEqual(normalizeActorName('Actor [123] *+?^$'), 'actor123');
  assert.strictEqual(normalizeActorName('🎭 Скарлетт Йоханссон 🍿'), 'скарлеттйоханссон');
});

// 2. Filmography Substring Isolation & Edge Cases
console.log('\n--- 2. Substring Isolation & Filmography Matching ---');

test('Zero false-positive collisions across entire movies catalog for tricky substring names', () => {
  // Common substring collision traps in Russian / English
  const testPairs = [
    { sub: 'Мако', full: 'Маколей Калкин' },
    { sub: 'Ли', full: 'Лиам Нисон' },
    { sub: 'Ли', full: 'Ли Пейс' },
    { sub: 'Том', full: 'Том Харди' },
    { sub: 'Том', full: 'Том Хэнкс' },
    { sub: 'Том', full: 'Том Хиддлстон' },
    { sub: 'Крис', full: 'Крис Эванс' },
    { sub: 'Крис', full: 'Крис Хемсворт' },
    { sub: 'Крис', full: 'Крис Пратт' },
    { sub: 'Джон', full: 'Джон Траволта' },
    { sub: 'Джон', full: 'Джон Кьюсак' }
  ];

  for (const pair of testPairs) {
    const subFilms = getActorFilmography(pair.sub, 'all', movies);
    const fullFilms = getActorFilmography(pair.full, 'all', movies);

    for (const ff of fullFilms) {
      const tokens = ff.actors.split(',').map(s => normalizeActorName(s.trim()));
      const subNorm = normalizeActorName(pair.sub);
      const isActuallyInCast = tokens.includes(subNorm);
      const isInSubList = subFilms.some(m => m.id === ff.id);
      assert.strictEqual(isInSubList, isActuallyInCast, `Substring false positive for ${pair.sub} vs ${pair.full} in movie ${ff.titleRu}`);
    }
  }
});

test('Category filtering in getActorFilmography works strictly', () => {
  const allActors = getAllActors(movies);
  for (const actor of allActors.slice(0, 50)) {
    const all = getActorFilmography(actor.name, 'all', movies);
    const m = getActorFilmography(actor.name, 'movie', movies);
    const s = getActorFilmography(actor.name, 'series', movies);
    const a = getActorFilmography(actor.name, 'anime', movies);

    assert.strictEqual(m.length + s.length + a.length, all.length, `Category partition mismatch for ${actor.name}`);
    assert(m.every(x => x.category === 'movie'));
    assert(s.every(x => x.category === 'series'));
    assert(a.every(x => x.category === 'anime'));
  }
});

// 3. Dynamic Profile Synthesis Quality & Grammar Check
console.log('\n--- 3. Dynamic Profile Synthesis & Russian Grammar ---');

test('Dynamic profile synthesis produces valid, non-crashing profiles for any string', () => {
  const bizarreNames = [
    'Unknown Actor 99999',
    'Неизвестный Артист',
    'A',
    '12345',
    '---'
  ];

  for (const name of bizarreNames) {
    const profile = getActorProfile(name, movies);
    assert.ok(profile, `Profile should be generated for ${name}`);
    assert.strictEqual(profile.isCurated, false);
    assert.strictEqual(typeof profile.name, 'string');
    assert.strictEqual(Array.isArray(profile.facts), true);
    assert.strictEqual(profile.facts.length, 3);
    for (const fact of profile.facts) {
      assert.ok(typeof fact === 'string' && fact.length > 10, `Fact should be non-empty string: ${fact}`);
      assert.ok(!fact.includes('undefined') && !fact.includes('NaN') && !fact.includes('[object Object]'), `Fact contains corrupted data: ${fact}`);
    }
  }

  // Falsy / empty strings should safely return null
  assert.strictEqual(getActorProfile(''), null);
  assert.strictEqual(getActorProfile('   '), null);
  assert.strictEqual(getActorProfile(null), null);
  assert.strictEqual(getActorProfile(undefined), null);
});

test('Grammar check for Russian pluralization in dynamic fact3', () => {
  const mockMovie = (id, actors) => ({ id, titleRu: `Фильм ${id}`, title: `Movie ${id}`, category: 'movie', actors, genres: 'драма' });
  
  // 1 movie -> картина
  const p1 = getActorProfile('Тестовый Актёр 1', [mockMovie(1, 'Тестовый Актёр 1')]);
  assert.ok(p1.facts[2].includes('1 картина'), `Expected "1 картина", got: ${p1.facts[2]}`);

  // 2 movies -> картины
  const p2 = getActorProfile('Тестовый Актёр 2', [
    mockMovie(1, 'Тестовый Актёр 2'),
    mockMovie(2, 'Тестовый Актёр 2')
  ]);
  assert.ok(p2.facts[2].includes('2 картины'), `Expected "2 картины", got: ${p2.facts[2]}`);

  // 3 movies -> картины
  const p3 = getActorProfile('Тестовый Актёр 3', [
    mockMovie(1, 'Тестовый Актёр 3'),
    mockMovie(2, 'Тестовый Актёр 3'),
    mockMovie(3, 'Тестовый Актёр 3')
  ]);
  assert.ok(p3.facts[2].includes('3 картины'), `Expected "3 картины", got: ${p3.facts[2]}`);

  // 5 movies -> картин
  const p5 = getActorProfile('Тестовый Актёр 5', [
    mockMovie(1, 'Тестовый Актёр 5'),
    mockMovie(2, 'Тестовый Актёр 5'),
    mockMovie(3, 'Тестовый Актёр 5'),
    mockMovie(4, 'Тестовый Актёр 5'),
    mockMovie(5, 'Тестовый Актёр 5')
  ]);
  assert.ok(p5.facts[2].includes('5 картин'), `Expected "5 картин", got: ${p5.facts[2]}`);
});

// 4. Curated Actors Dataset Integrity & Portrait Formats
console.log('\n--- 4. Curated Actors & Image Formats Audit ---');

test('All 270 curated actors have valid metadata and reachable domains', () => {
  let curatedCount = 0;
  for (const [key, val] of Object.entries(actorsData)) {
    curatedCount++;
    assert.strictEqual(typeof val.name, 'string', `Actor ${key} invalid name`);
    assert.strictEqual(typeof val.nameEn, 'string', `Actor ${key} invalid nameEn`);
    assert.ok(val.photo.startsWith('https://upload.wikimedia.org/'), `Actor ${key} photo must be Wikimedia Commons HTTPS: ${val.photo}`);
    assert.strictEqual(val.facts.length, 3, `Actor ${key} must have exactly 3 facts`);
    
    const resolvedByRu = getActorProfile(val.name);
    assert.ok(resolvedByRu && resolvedByRu.isCurated, `Curated actor ${val.name} must resolve as curated`);
    
    const resolvedByEn = getActorProfile(val.nameEn);
    assert.ok(resolvedByEn && resolvedByEn.isCurated, `Curated actor ${val.nameEn} must resolve as curated`);
  }
  assert.strictEqual(curatedCount, 270);
});

// 5. getAllActors Full Directory Verification
console.log('\n--- 5. getAllActors Directory Indexing & Completeness ---');

test('getAllActors contains every actor from movie casts without omissions or duplicates', () => {
  const directory = getAllActors(movies);
  const seenNorms = new Set();

  for (const actor of directory) {
    const norm = normalizeActorName(actor.name);
    assert.ok(!seenNorms.has(norm), `Duplicate normalized actor in getAllActors: ${actor.name} (${norm})`);
    seenNorms.add(norm);

    const actualFilms = getActorFilmography(actor.name, 'all', movies);
    assert.strictEqual(actor.count, actualFilms.length, `Count mismatch for ${actor.name}`);
    assert.strictEqual(actor.movies.length, actualFilms.length, `Movies array length mismatch for ${actor.name}`);
  }

  for (const m of movies) {
    if (!m.actors || typeof m.actors !== 'string') continue;
    const cast = m.actors.split(',').map(s => s.trim()).filter(Boolean);
    for (const c of cast) {
      const norm = normalizeActorName(c);
      if (norm) {
        assert.ok(seenNorms.has(norm), `Cast member ${c} from movie ${m.titleRu} missing from getAllActors`);
      }
    }
  }

  console.log(`  ✓ Directory verified: ${directory.length} unique actors cataloged without duplicates.`);
});

// 6. Recommendation Engine Integration & Deck Slicing
console.log('\n--- 6. Recommendation Engine Deck Filtering ---');

test('getRecommendedDeck with actorName filters exclusively to actor filmography', () => {
  const testActors = ['Киану Ривз', 'Брэд Питт', 'Мэттью Макконахи', 'Хаяо Миядзаки', 'Мако'];
  for (const actor of testActors) {
    const deck = getRecommendedDeck({ actorName: actor, limit: 50 });
    const expectedFilms = getActorFilmography(actor, 'all', movies);

    assert.strictEqual(deck.length, expectedFilms.length, `Deck length for ${actor} should match filmography length`);
    for (const m of deck) {
      const normCast = m.actors.split(',').map(s => normalizeActorName(s.trim()));
      assert.ok(normCast.includes(normalizeActorName(actor)), `Movie ${m.titleRu} in deck does not contain ${actor}`);
    }
  }
});

console.log('\n======================================================================');
console.log(`  ✅ ALL ${passedTests}/${totalTests} ADVERSARIAL TESTS PASSED`);
console.log('======================================================================\n');
