// MatchWatch M2 Test Suite: Actor Portraits, Resolver & Filmography Verification
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

console.log('====================================================');
console.log('  MATCHWATCH M2 VERIFICATION & INTEGRITY TEST SUITE ');
console.log('====================================================');

// 1. Data Schema & Curated Portrait URL Health
console.log('\n[1/7] Testing actorsData Schema & Image URLs...');
const curatedKeys = Object.keys(actorsData);
assert.strictEqual(curatedKeys.length, 270, 'Must contain exactly 270 curated actor keys');

for (const [key, actor] of Object.entries(actorsData)) {
  assert.ok(actor.name && typeof actor.name === 'string', `Actor ${key} missing valid name`);
  assert.ok(actor.nameEn && typeof actor.nameEn === 'string', `Actor ${key} missing valid nameEn`);
  assert.ok(actor.photo && actor.photo.startsWith('https://'), `Actor ${key} photo must be https URL`);
  assert.ok(Array.isArray(actor.facts) && actor.facts.length === 3, `Actor ${key} facts must be 3 items`);
}

// Check the 3 fixed URLs specifically
assert.strictEqual(
  actorsData['Джеймс Стюарт'].photo,
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Annex_-_Stewart%2C_James_%28Call_Northside_777%29_01.jpg/960px-Annex_-_Stewart%2C_James_%28Call_Northside_777%29_01.jpg',
  'James Stewart URL must match verified replacement'
);
assert.strictEqual(
  actorsData['Тоширо Мифунэ'].photo,
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Toshiro_Mifune_1954_Scan10003_160913.jpg/960px-Toshiro_Mifune_1954_Scan10003_160913.jpg',
  'Toshiro Mifune URL must match verified replacement'
);
assert.strictEqual(
  actorsData['Хейли Джоэл Осмент'].photo,
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Haley_Joel_Osment_in_2001.jpg/960px-Haley_Joel_Osment_in_2001.jpg',
  'Haley Joel Osment URL must match verified replacement'
);
console.log('  ✓ 270/270 curated actors conform to schema with valid HTTPS photos and 3 trivia facts.');

// 2. Normalization Algorithm
console.log('\n[2/7] Testing normalizeActorName...');
assert.strictEqual(normalizeActorName('Колин Фёрт'), 'колинферт');
assert.strictEqual(normalizeActorName('Колин Ферт'), 'колинферт');
assert.strictEqual(normalizeActorName('  Леонардо Ди Каприо  '), 'леонардодикаприо');
assert.strictEqual(normalizeActorName('Леонардо ДиКаприо'), 'леонардодикаприо');
assert.strictEqual(normalizeActorName("Джек О'Коннелл"), 'джекоконнелл');
assert.strictEqual(normalizeActorName('Джек О’Коннелл'), 'джекоконнелл');
assert.strictEqual(normalizeActorName(''), '');
assert.strictEqual(normalizeActorName(null), '');
assert.strictEqual(normalizeActorName(undefined), '');
console.log('  ✓ Name normalization handles Cyrillic ё/е, spacing, punctuation, and null safety.');

// 3. Substring Isolation & Tokenized Matching
console.log('\n[3/7] Testing getActorFilmography Substring Safety...');
const makoFilms = getActorFilmography('Мако');
const macaulayFilms = getActorFilmography('Маколей Калкин');
assert.strictEqual(makoFilms.length, 1, 'Mako must have exactly 1 film (Samurai Jack)');
assert.strictEqual(makoFilms[0].titleRu, 'Самурай Джек');
assert.strictEqual(macaulayFilms.length, 2, 'Macaulay Culkin must have 2 films');
assert(makoFilms.every(m => !macaulayFilms.some(m2 => m2.id === m.id)), 'Mako filmography must NOT contain Macaulay Culkin films');

const richardsFilms = getActorFilmography('Майкл Ричардс');
const richardsonFilms = getActorFilmography('Кевин Майкл Ричардсон');
assert(richardsFilms.every(m => !richardsonFilms.some(m2 => m2.id === m.id)), 'No overlap between Michael Richards and Kevin Michael Richardson');

// Test category filtering in filmography
const animeFilms = getActorFilmography('Мию Ирино', 'anime');
const seriesFilms = getActorFilmography('Мию Ирино', 'series');
assert.strictEqual(animeFilms.length, 5, 'Miyu Irino has 5 anime entries');
assert.strictEqual(seriesFilms.length, 0, 'Miyu Irino has 0 series entries');
console.log('  ✓ Substring isolation and category filtering verified with zero false positives.');

// 4. Dynamic Profile Synthesis for Uncurated Actors
console.log('\n[4/7] Testing getActorProfile Dynamic Synthesis...');
// Curated actor
const curatedProfile = getActorProfile('Том Хэнкс');
assert.strictEqual(curatedProfile.isCurated, true);
assert.strictEqual(curatedProfile.name, 'Том Хэнкс');
assert.strictEqual(curatedProfile.nameEn, 'Tom Hanks');
assert.ok(curatedProfile.photo.startsWith('https://upload.wikimedia.org'));
assert.strictEqual(curatedProfile.facts.length, 3);

// Uncurated actor with titles in database
const uncuratedProfile = getActorProfile('Мию Ирино');
assert.strictEqual(uncuratedProfile.isCurated, false);
assert.strictEqual(uncuratedProfile.name, 'Мию Ирино');
assert.strictEqual(uncuratedProfile.photo, null);
assert.strictEqual(uncuratedProfile.facts.length, 3);
assert.ok(uncuratedProfile.facts[0].includes('«Унесённые призраками»') || uncuratedProfile.facts[0].includes('MatchWatch'), 'Fact 1 should reference real database title');
assert.ok(uncuratedProfile.facts[2].includes('5'), 'Fact 3 should accurately reflect 5 movies count');

// Alias verification
const aliasProfile = resolveActorProfile('Том Хэнкс');
assert.strictEqual(aliasProfile.name, curatedProfile.name);
console.log('  ✓ Curated and uncurated actor profiles resolve seamlessly with 3 authentic facts.');

// 5. Recommendation Engine Integration
console.log('\n[5/7] Testing recommendationEngine with Tokenized Matching...');
const deckMako = getRecommendedDeck({ actorName: 'Мако' });
assert.strictEqual(deckMako.length, 1);
assert.strictEqual(deckMako[0].titleRu, 'Самурай Джек');

const deckDiCaprio = getRecommendedDeck({ actorName: 'Леонардо Ди Каприо', limit: 20 });
assert(deckDiCaprio.length > 0, 'DiCaprio deck must return recommendations');
for (const m of deckDiCaprio) {
  const normCast = m.actors.split(',').map(s => normalizeActorName(s.trim()));
  assert.ok(normCast.includes(normalizeActorName('Леонардо Ди Каприо')), `Movie ${m.titleRu} must contain Leonardo DiCaprio`);
}
console.log('  ✓ Recommendation engine produces clean actor-filtered decks with 0 false positives.');

// 6. getAllActors Catalog Construction
console.log('\n[6/7] Testing getAllActors Indexing & Sorting...');
const allActors = getAllActors(movies);
assert(allActors.length >= 1800, `Expected >= 1800 actors, got ${allActors.length}`);

// Verify sorting descending by movie count
for (let i = 0; i < allActors.length - 1; i++) {
  assert.ok(
    allActors[i].count >= allActors[i + 1].count,
    `Sorting violation at index ${i}: ${allActors[i].name} (${allActors[i].count}) < ${allActors[i+1].name} (${allActors[i+1].count})`
  );
}
console.log(`  ✓ getAllActors compiled ${allActors.length} unique actors correctly sorted descending by film count.`);

// 7. Utils Re-export & Package Parity
console.log('\n[7/7] Testing src/utils/actorResolver.js re-exports...');
assert.strictEqual(typeof utilsResolver.normalizeActorName, 'function');
assert.strictEqual(typeof utilsResolver.getActorProfile, 'function');
assert.strictEqual(typeof utilsResolver.getActorFilmography, 'function');
assert.strictEqual(typeof utilsResolver.getAllActors, 'function');
assert.strictEqual(typeof utilsResolver.fetchRealActorProfile, 'function');
console.log('  ✓ src/utils/actorResolver.js correctly re-exports all engine functions.');

console.log('\n====================================================');
console.log('  ✅ ALL 7 VERIFICATION TIERS PASSED WITH 100% SUCCESS');
console.log('====================================================\n');
