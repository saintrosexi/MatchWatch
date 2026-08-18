// MatchWatch Challenger 2 Empirical Stress Test Suite
// Validates:
// 1. React SSR / mock render of StarHubView, DesktopStarHubView, MovieDetailsSheet, DesktopMovieDetailsModal
// 2. Fuzzing and resilience on actorResolver engine with corrupt, empty, and adversarial data
// 3. Substring collision and boundary checks
// 4. HTTP/CDN Status of all 270 actor portrait URLs via live network fetch with 429 retry-after handling

import assert from 'node:assert';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

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

console.log('================================================================');
console.log('  CHALLENGER 2: EMPIRICAL STRESS & HEALTH TEST HARNESS (M2)    ');
console.log('================================================================');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runSuite() {
  let passedTests = 0;
  let totalTests = 0;

  // -------------------------------------------------------------
  // STAGE 1: UI Component Mock Rendering (Vite SSR / JSX Verification)
  // -------------------------------------------------------------
  console.log('\n[STAGE 1] Testing Component Imports and Mock Rendering via React SSR...');

  const viteServer = await createServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });

  const { StarHubView } = await viteServer.ssrLoadModule('./src/components/views/StarHubView.jsx');
  const { DesktopStarHubView } = await viteServer.ssrLoadModule('./src/components/desktop/DesktopStarHubView.jsx');
  const { MovieDetailsSheet } = await viteServer.ssrLoadModule('./src/components/modals/MovieDetailsSheet.jsx');
  const { DesktopMovieDetailsModal } = await viteServer.ssrLoadModule('./src/components/desktop/DesktopMovieDetailsModal.jsx');

  assert.strictEqual(typeof StarHubView, 'function', 'StarHubView must be a valid React component function');
  assert.strictEqual(typeof DesktopStarHubView, 'function', 'DesktopStarHubView must be a valid React component function');
  assert.strictEqual(typeof MovieDetailsSheet, 'function', 'MovieDetailsSheet must be a valid React component function');
  assert.strictEqual(typeof DesktopMovieDetailsModal, 'function', 'DesktopMovieDetailsModal must be a valid React component function');

  const sampleCuratedActor = 'Том Хэнкс';
  const sampleUncuratedActor = 'Мию Ирино';
  const nonExistentActor = 'Несуществующий Актёр 9999';
  const sampleMovie = movies[0];

  const renderCases = [
    // StarHubView scenarios
    {
      name: 'StarHubView (Default / Catalog root)',
      fn: () => renderToString(React.createElement(StarHubView, {}))
    },
    {
      name: 'StarHubView (Curated actor selected)',
      fn: () => renderToString(React.createElement(StarHubView, { selectedActorName: sampleCuratedActor }))
    },
    {
      name: 'StarHubView (Uncurated actor selected)',
      fn: () => renderToString(React.createElement(StarHubView, { selectedActorName: sampleUncuratedActor }))
    },
    {
      name: 'StarHubView (Non-existent actor selected)',
      fn: () => renderToString(React.createElement(StarHubView, { selectedActorName: nonExistentActor }))
    },
    {
      name: 'StarHubView (Null actor selected)',
      fn: () => renderToString(React.createElement(StarHubView, { selectedActorName: null }))
    },
    {
      name: 'StarHubView (Empty string actor selected)',
      fn: () => renderToString(React.createElement(StarHubView, { selectedActorName: '' }))
    },
    {
      name: 'StarHubView (All callbacks passed)',
      fn: () => renderToString(React.createElement(StarHubView, {
        selectedActorName: sampleCuratedActor,
        onSelectActor: () => {},
        onOpenDetails: () => {},
        onLaunchActorDeck: () => {}
      }))
    },

    // DesktopStarHubView scenarios
    {
      name: 'DesktopStarHubView (Default / Initial state)',
      fn: () => renderToString(React.createElement(DesktopStarHubView, {}))
    },
    {
      name: 'DesktopStarHubView (Curated actor selected)',
      fn: () => renderToString(React.createElement(DesktopStarHubView, { selectedActorName: sampleCuratedActor }))
    },
    {
      name: 'DesktopStarHubView (Uncurated actor selected)',
      fn: () => renderToString(React.createElement(DesktopStarHubView, { selectedActorName: sampleUncuratedActor }))
    },
    {
      name: 'DesktopStarHubView (Non-existent actor selected)',
      fn: () => renderToString(React.createElement(DesktopStarHubView, { selectedActorName: nonExistentActor }))
    },
    {
      name: 'DesktopStarHubView (Null actor selected)',
      fn: () => renderToString(React.createElement(DesktopStarHubView, { selectedActorName: null }))
    },
    {
      name: 'DesktopStarHubView (Empty string actor selected)',
      fn: () => renderToString(React.createElement(DesktopStarHubView, { selectedActorName: '' }))
    },
    {
      name: 'DesktopStarHubView (All callbacks provided)',
      fn: () => renderToString(React.createElement(DesktopStarHubView, {
        selectedActorName: sampleCuratedActor,
        onSelectActor: () => {},
        onOpenDetails: () => {},
        onLaunchActorDeck: () => {}
      }))
    },

    // MovieDetailsSheet scenarios
    {
      name: 'MovieDetailsSheet (Standard movie)',
      fn: () => renderToString(React.createElement(MovieDetailsSheet, { movie: sampleMovie, isLiked: true }))
    },
    {
      name: 'MovieDetailsSheet (Null movie prop)',
      fn: () => renderToString(React.createElement(MovieDetailsSheet, { movie: null }))
    },
    {
      name: 'MovieDetailsSheet (Empty movie object)',
      fn: () => renderToString(React.createElement(MovieDetailsSheet, { movie: {} }))
    },
    {
      name: 'MovieDetailsSheet (Movie with missing optional fields: no trailer, no director, no sensationVector)',
      fn: () => renderToString(React.createElement(MovieDetailsSheet, {
        movie: {
          id: 'test-sparse-movie',
          title: 'Sparse Movie',
          titleRu: 'Минимальный фильм',
          year: 2024,
          rating: 8.5,
          actors: 'Том Хэнкс, Мию Ирино, Неизвестный Актёр',
          genres: 'Драма, Триллер'
        }
      }))
    },
    {
      name: 'MovieDetailsSheet (Movie with empty actors string)',
      fn: () => renderToString(React.createElement(MovieDetailsSheet, {
        movie: { id: 'no-cast-movie', title: 'No Cast', actors: '' }
      }))
    },

    // DesktopMovieDetailsModal scenarios
    {
      name: 'DesktopMovieDetailsModal (Standard movie)',
      fn: () => renderToString(React.createElement(DesktopMovieDetailsModal, { movie: sampleMovie, isLiked: false }))
    },
    {
      name: 'DesktopMovieDetailsModal (Null movie prop)',
      fn: () => renderToString(React.createElement(DesktopMovieDetailsModal, { movie: null }))
    },
    {
      name: 'DesktopMovieDetailsModal (Empty movie object)',
      fn: () => renderToString(React.createElement(DesktopMovieDetailsModal, { movie: {} }))
    },
    {
      name: 'DesktopMovieDetailsModal (Sparse movie object)',
      fn: () => renderToString(React.createElement(DesktopMovieDetailsModal, {
        movie: {
          id: 'desktop-sparse-1',
          title: 'Desktop Test',
          actors: 'Роберт Де Ниро, Аль Пачино',
          genres: 'Криминал'
        }
      }))
    },
    {
      name: 'DesktopMovieDetailsModal (Movie with empty actors string)',
      fn: () => renderToString(React.createElement(DesktopMovieDetailsModal, {
        movie: { id: 'no-cast-desktop', title: 'No Cast Desktop', actors: '' }
      }))
    }
  ];

  for (const tc of renderCases) {
    totalTests++;
    try {
      const html = tc.fn();
      assert.ok(typeof html === 'string', `${tc.name} must return string html`);
      console.log(`  ✓ ${tc.name} rendered without exceptions (${html.length} chars output)`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ ${tc.name} CRASHED:`, err);
      await viteServer.close();
      throw err;
    }
  }

  await viteServer.close();

  // -------------------------------------------------------------
  // STAGE 2: Fuzzing & Resilience on actorResolver Engine
  // -------------------------------------------------------------
  console.log('\n[STAGE 2] Fuzzing and Resilience Testing on actorResolver Functions...');

  const corruptInputs = [
    null,
    undefined,
    '',
    '   ',
    '\n\t\r',
    12345,
    -1,
    0,
    true,
    false,
    NaN,
    Infinity,
    {},
    { name: 'Fake' },
    [],
    ['Actor'],
    () => {},
    Symbol('actor'),
    'A'.repeat(5000),
    '🎭✨🎬💥',
    '<script>alert("xss")</script>',
    'SELECT * FROM actors;',
    '../../../etc/passwd',
    '\\x00\\x01\\x02'
  ];

  // 2.1 normalizeActorName fuzzing
  for (const input of corruptInputs) {
    totalTests++;
    try {
      const res = normalizeActorName(input);
      assert.strictEqual(typeof res, 'string', `normalizeActorName must return string for ${typeof input}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ normalizeActorName failed on input:`, input, err);
      throw err;
    }
  }
  console.log(`  ✓ normalizeActorName passed ${corruptInputs.length} adversarial fuzzing inputs.`);

  // 2.2 getActorProfile / resolveActorProfile fuzzing
  for (const input of corruptInputs) {
    totalTests++;
    try {
      const res = getActorProfile(input);
      if (typeof input === 'string' && input.trim().length > 0) {
        assert.ok(res !== null && typeof res === 'object', `getActorProfile should return object for non-empty string`);
        assert.ok(Array.isArray(res.facts), `ActorProfile.facts must be an array`);
        assert.strictEqual(res.facts.length, 3, `ActorProfile.facts must contain 3 items`);
      } else {
        assert.strictEqual(res, null, `getActorProfile should return null for invalid/empty input`);
      }
      passedTests++;
    } catch (err) {
      console.error(`  ❌ getActorProfile failed on input:`, input, err);
      throw err;
    }
  }
  console.log(`  ✓ getActorProfile passed ${corruptInputs.length} adversarial fuzzing inputs.`);

  // 2.3 getActorFilmography fuzzing
  for (const input of corruptInputs) {
    totalTests++;
    try {
      const res = getActorFilmography(input);
      assert.ok(Array.isArray(res), `getActorFilmography must always return an array`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ getActorFilmography failed on input:`, input, err);
      throw err;
    }
  }
  console.log(`  ✓ getActorFilmography passed ${corruptInputs.length} adversarial fuzzing inputs.`);

  // 2.4 getActorFilmography with corrupt movie pool
  const corruptPools = [
    null,
    undefined,
    [],
    [null, undefined, {}, { actors: null }, { actors: 123 }, { actors: 'Том Хэнкс', category: null }],
    [{ id: '1', title: 'A', actors: 'Том Хэнкс' }, { id: '2', title: 'B' }]
  ];

  for (const pool of corruptPools) {
    totalTests++;
    try {
      const res = getActorFilmography('Том Хэнкс', 'all', pool);
      assert.ok(Array.isArray(res), `getActorFilmography with corrupt pool must return array`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ getActorFilmography failed with corrupt pool:`, pool, err);
      throw err;
    }
  }
  console.log(`  ✓ getActorFilmography survived ${corruptPools.length} corrupt movie dataset structures.`);

  // 2.5 getAllActors with corrupt pools
  for (const pool of corruptPools) {
    totalTests++;
    try {
      const res = getAllActors(pool);
      assert.ok(Array.isArray(res), `getAllActors must return array for corrupt pool`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ getAllActors failed with corrupt pool:`, pool, err);
      throw err;
    }
  }
  console.log(`  ✓ getAllActors survived ${corruptPools.length} corrupt movie dataset structures.`);

  // -------------------------------------------------------------
  // STAGE 3: Substring Collision and Boundary Checks
  // -------------------------------------------------------------
  console.log('\n[STAGE 3] Substring Isolation & Edge Case Boundary Tests...');

  const trickySubstrings = [
    { target: 'Ли', collision: 'Джет Ли' },
    { target: 'Джет Ли', collision: 'Ли' },
    { target: 'Крис Эванс', collision: 'Крис Эванс мл.' },
    { target: 'Том', collision: 'Том Хэнкс' },
    { target: 'Джон', collision: 'Джон Траволта' },
    { target: 'Эми Адамс', collision: 'Адам Сэндлер' },
    { target: 'Эмма Стоун', collision: 'Шэрон Стоун' }
  ];

  for (const pair of trickySubstrings) {
    totalTests++;
    const mockMovies = [
      { id: 'm1', title: 'Movie 1', actors: `${pair.collision}, Брэд Питт` },
      { id: 'm2', title: 'Movie 2', actors: `${pair.target}, Мэтт Дэймон` }
    ];

    const result = getActorFilmography(pair.target, 'all', mockMovies);
    assert.strictEqual(result.length, 1, `Must match exactly 1 movie for '${pair.target}'`);
    assert.strictEqual(result[0].id, 'm2', `Must match 'm2' and ignore '${pair.collision}'`);
    passedTests++;
  }
  console.log(`  ✓ Substring isolation correctly rejected all ${trickySubstrings.length} collision pairs.`);

  // -------------------------------------------------------------
  // STAGE 4: 270 Curated Actor Portrait HTTP/CDN Validation
  // -------------------------------------------------------------
  console.log('\n[STAGE 4] Testing HTTP/CDN Live Status for all 270 Curated Portraits...');
  const actorEntries = Object.entries(actorsData).map(([key, data]) => ({
    key,
    name: data.name,
    nameEn: data.nameEn,
    photo: data.photo
  }));

  assert.strictEqual(actorEntries.length, 270, 'Must have exactly 270 curated actors');

  async function checkSingleUrl(item, retry = 5) {
    const userAgent = 'MatchWatch/3.0 (https://matchwatch.app; dev@matchwatch.app)';
    try {
      const res = await fetch(item.photo, {
        method: 'HEAD',
        headers: { 'User-Agent': userAgent },
        signal: AbortSignal.timeout(10000)
      });

      if (res.status === 429 && retry > 0) {
        const retryAfter = Number(res.headers.get('retry-after')) || 6;
        console.log(`    [Rate Limit 429] Backing off for ${retryAfter}s on ${item.key}...`);
        await sleep((retryAfter + 1) * 1000);
        return checkSingleUrl(item, retry - 1);
      }

      const ok = res.status >= 200 && res.status < 400;
      return {
        ...item,
        status: res.status,
        contentType: res.headers.get('content-type') || '',
        ok
      };
    } catch (err) {
      if (retry > 0) {
        await sleep(2000);
        return checkSingleUrl(item, retry - 1);
      }
      return {
        ...item,
        status: 'NETWORK_ERROR',
        error: err.message,
        ok: false
      };
    }
  }

  const results = [];
  const startTime = Date.now();
  
  // Process in sequential chunks with 60ms delay to respect Wikimedia Varnish rate limits
  for (let i = 0; i < actorEntries.length; i++) {
    const item = actorEntries[i];
    const res = await checkSingleUrl(item);
    results.push(res);
    if (!res.ok) {
      console.error(`  ❌ Failed: [${i + 1}/270] ${item.key} (${item.photo}) -> HTTP ${res.status}`);
    }
    if ((i + 1) % 45 === 0 || i === actorEntries.length - 1) {
      console.log(`  -> Progress: ${i + 1}/270 portraits validated (${((i + 1) / 270 * 100).toFixed(0)}%)`);
    }
    await sleep(60);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const failed = results.filter(r => !r.ok);
  console.log(`  -> Checked ${results.length} URLs in ${duration}s.`);
  console.log(`  -> Valid HTTP 200/300: ${results.length - failed.length}, Failed: ${failed.length}`);

  assert.strictEqual(failed.length, 0, `All 270 URLs must be alive, but ${failed.length} failed`);
  passedTests++;
  totalTests++;

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`  ✅ CHALLENGER 2 SUITE COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');
}

runSuite().catch((err) => {
  console.error('\n❌ UNCAUGHT TEST ERROR:', err);
  process.exit(1);
});
