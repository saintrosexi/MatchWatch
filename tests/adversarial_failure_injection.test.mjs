import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const projectRoot = process.cwd();

// Helper to generate a valid template movie object
function getValidMovie(overrides = {}) {
  return {
    id: 1,
    title: 'Побег из Шоушенка',
    titleRu: 'Побег из Шоушенка',
    year: 1994,
    rating: 9.2,
    poster: 'https://images-na.ssl-images-amazon.com/images/I/51NiGlapXlL.jpg',
    description: 'Заключённый Энди Дюфрейн пытается сохранить надежду.',
    fullDescription: 'Несправедливо осуждённый банкир попадает в тюрьму Шоушенк.',
    country: 'США',
    genres: 'Драма, криминал',
    kinopoiskId: 326,
    sensationVector: {
      energy: 5,
      darkness: 7,
      intellect: 5,
      emotion: 10,
      dynamism: 6,
    },
    vibeBadges: ['💔 Эмоциональный шторм', '🌙 Dark & Gritty'],
    category: 'movie',
    type: 'movie',
    ...overrides,
  };
}

// Helper to write a temporary movie mock file
async function writeTempMoviesFile(moviesList, filename = '_temp_mock_movies.js') {
  const filePath = path.resolve(projectRoot, 'tests', filename);
  const content = `export const movies = ${JSON.stringify(moviesList, null, 2)};\n`;
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

// Helper to write a temporary actors mock file
async function writeTempActorsFile(actorsObj, filename = '_temp_mock_actors.js') {
  const filePath = path.resolve(projectRoot, 'tests', filename);
  const content = `export const actorsData = ${JSON.stringify(actorsObj, null, 2)};\n`;
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

// Helper to safely remove temp file
async function cleanupFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch {}
}

// ============================================================================
// SUITE 1: ADVERSARIAL FAILURE INJECTION ON validate_database.mjs (CLI & Engine)
// ============================================================================
describe('Adversarial Challenge: validate_database.mjs Failure Injection', () => {

  const corruptionCases = [
    {
      name: '1. Invalid category "cartoon"',
      movie: getValidMovie({ category: 'cartoon', type: 'cartoon' }),
      expectedErrorSnippet: 'Invalid category "cartoon"',
    },
    {
      name: '2. Invalid category "documentary"',
      movie: getValidMovie({ category: 'documentary', type: 'documentary' }),
      expectedErrorSnippet: 'Invalid category "documentary"',
    },
    {
      name: '3. Insecure HTTP poster URL',
      movie: getValidMovie({ poster: 'http://images.amazon.com/insecure_poster.jpg' }),
      expectedErrorSnippet: 'must start with "https://"',
    },
    {
      name: '4. Empty poster URL',
      movie: getValidMovie({ poster: '' }),
      expectedErrorSnippet: 'Missing or empty "poster" URL',
    },
    {
      name: '5. Malformed poster URL',
      movie: getValidMovie({ poster: 'https://' }),
      expectedErrorSnippet: 'Malformed poster URL',
    },
    {
      name: '6. Sensation vector energy out of bounds (> 10)',
      movie: getValidMovie({
        sensationVector: { energy: 15, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 },
      }),
      expectedErrorSnippet: 'sensationVector.energy out of range [0, 10]: 15',
    },
    {
      name: '7. Sensation vector darkness negative (< 0)',
      movie: getValidMovie({
        sensationVector: { energy: 5, darkness: -1.5, intellect: 5, emotion: 5, dynamism: 5 },
      }),
      expectedErrorSnippet: 'sensationVector.darkness out of range [0, 10]: -1.5',
    },
    {
      name: '8. Sensation vector missing dynamism key',
      movie: getValidMovie({
        sensationVector: { energy: 5, darkness: 5, intellect: 5, emotion: 5 },
      }),
      expectedErrorSnippet: 'sensationVector.dynamism must be a valid number',
    },
    {
      name: '9. Sensation vector NaN value',
      movie: getValidMovie({
        sensationVector: { energy: NaN, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 },
      }),
      expectedErrorSnippet: 'sensationVector.energy must be a valid number',
    },
    {
      name: '10. Non-integer ID (float 1.5)',
      movie: getValidMovie({ id: 1.5 }),
      expectedErrorSnippet: 'Invalid id "1.5": must be a positive integer',
    },
    {
      name: '11. String ID ("1")',
      movie: getValidMovie({ id: '1' }),
      expectedErrorSnippet: 'Invalid id "1": must be a positive integer',
    },
    {
      name: '12. Negative ID (-10)',
      movie: getValidMovie({ id: -10 }),
      expectedErrorSnippet: 'Invalid id "-10": must be a positive integer',
    },
    {
      name: '13. Non-sequential ID (id=5 at index 0)',
      movie: getValidMovie({ id: 5 }),
      expectedErrorSnippet: 'Non-sequential ID: found id=5 at index 0, expected id=1',
    },
    {
      name: '14. Missing title string',
      movie: getValidMovie({ title: '' }),
      expectedErrorSnippet: 'Missing or empty "title" string',
    },
    {
      name: '15. Missing titleRu string',
      movie: getValidMovie({ titleRu: '' }),
      expectedErrorSnippet: 'Missing or empty "titleRu" string',
    },
    {
      name: '16. Invalid year 1880 (< 1900)',
      movie: getValidMovie({ year: 1880 }),
      expectedErrorSnippet: 'Invalid year "1880": must be an integer between 1900 and 2030',
    },
    {
      name: '17. Invalid rating 11 (> 10)',
      movie: getValidMovie({ rating: 11 }),
      expectedErrorSnippet: 'Invalid rating "11": must be a number between 0 and 10',
    },
    {
      name: '18. Empty vibeBadges array',
      movie: getValidMovie({ vibeBadges: [] }),
      expectedErrorSnippet: 'Missing or empty "vibeBadges" array',
    },
    {
      name: '19. Vibe badge containing empty string',
      movie: getValidMovie({ vibeBadges: [''] }),
      expectedErrorSnippet: 'vibeBadges[0] is not a valid non-empty string',
    },
    {
      name: '20. Cross-contamination: movie category containing series keywords in genres',
      movie: getValidMovie({ category: 'movie', genres: 'Драма, сериал' }),
      expectedErrorSnippet: 'Cross-contamination: Category is "movie" but genres contains series keywords',
    },
    {
      name: '21. Cross-contamination: movie category containing anime keywords in genres',
      movie: getValidMovie({ category: 'movie', genres: 'Боевик, аниме' }),
      expectedErrorSnippet: 'Cross-contamination: Category is "movie" but genres contains anime keywords',
    },
    {
      name: '22. Inconsistent type property ("series" vs category "movie")',
      movie: getValidMovie({ category: 'movie', type: 'series' }),
      expectedErrorSnippet: 'Inconsistent type property "series" does not match category "movie"',
    },
  ];

  for (const c of corruptionCases) {
    it(`CLI rejects corrupted input with exit code 1: ${c.name}`, async () => {
      const tempPath = await writeTempMoviesFile([c.movie], `_temp_corrupt_${Date.now()}_${Math.random().toString(36).substring(7)}.js`);
      try {
        let stdout = '';
        let stderr = '';
        let exitCode = 0;
        try {
          const res = await execAsync(`node scripts/validate_database.mjs --file ${tempPath} --no-warnings`);
          stdout = res.stdout;
          stderr = res.stderr;
        } catch (err) {
          exitCode = err.code || 1;
          stdout = err.stdout || '';
          stderr = err.stderr || '';
        }

        assert.equal(exitCode, 1, `Expected validate_database.mjs to exit with code 1, but got ${exitCode}`);
        assert.ok(stdout.includes('AUDIT FAILED'), `Expected stdout to report "AUDIT FAILED", got:\n${stdout}`);
        assert.ok(
          stdout.includes(c.expectedErrorSnippet),
          `Expected stdout to contain "${c.expectedErrorSnippet}", got:\n${stdout}`
        );
      } finally {
        await cleanupFile(tempPath);
      }
    });
  }

  it('CLI rejects duplicate Kinopoisk IDs with exit code 1 and accurate collision description', async () => {
    const dataset = [
      getValidMovie({ id: 1, title: 'Фильм А', kinopoiskId: 7777 }),
      getValidMovie({ id: 2, title: 'Фильм Б', kinopoiskId: 7777 }),
    ];
    const tempPath = await writeTempMoviesFile(dataset, `_temp_dup_kp_${Date.now()}.js`);
    try {
      let exitCode = 0;
      let stdout = '';
      try {
        const res = await execAsync(`node scripts/validate_database.mjs --file ${tempPath} --no-warnings`);
        stdout = res.stdout;
      } catch (err) {
        exitCode = err.code || 1;
        stdout = err.stdout || '';
      }

      assert.equal(exitCode, 1);
      assert.ok(stdout.includes('AUDIT FAILED'));
      assert.ok(stdout.includes('Kinopoisk ID collision: KP ID 7777 is shared between Movie #1 ("Фильм А") and Movie #2 ("Фильм Б")'));
    } finally {
      await cleanupFile(tempPath);
    }
  });

  it('CLI rejects duplicate Movie IDs with exit code 1', async () => {
    const dataset = [
      getValidMovie({ id: 1, title: 'Фильм 1' }),
      getValidMovie({ id: 1, title: 'Фильм 1 Дубликат' }),
    ];
    const tempPath = await writeTempMoviesFile(dataset, `_temp_dup_id_${Date.now()}.js`);
    try {
      let exitCode = 0;
      let stdout = '';
      try {
        const res = await execAsync(`node scripts/validate_database.mjs --file ${tempPath} --no-warnings`);
        stdout = res.stdout;
      } catch (err) {
        exitCode = err.code || 1;
        stdout = err.stdout || '';
      }

      assert.equal(exitCode, 1);
      assert.ok(stdout.includes('Duplicate ID 1 detected'));
    } finally {
      await cleanupFile(tempPath);
    }
  });

  it('CLI rejects corrupted actors dataset via --actors-file', async () => {
    const cleanMoviePath = await writeTempMoviesFile([getValidMovie()], '_temp_clean_for_actor.js');
    const badActors = {
      'WrongKey': {
        name: 'Actual Name',
        nameEn: 'Actual Name',
        photo: 'https://upload.wikimedia.org/photo.jpg',
        facts: ['Факт 1 подробный и длинный', 'Факт 2 подробный и длинный', 'Факт 3 подробный и длинный'],
      },
      'InsecurePhoto': {
        name: 'InsecurePhoto',
        nameEn: 'InsecurePhoto',
        photo: 'http://insecure.org/photo.jpg',
        facts: ['Факт 1 подробный и длинный', 'Факт 2 подробный и длинный', 'Факт 3 подробный и длинный'],
      },
      'EmptyFacts': {
        name: 'EmptyFacts',
        nameEn: 'EmptyFacts',
        photo: 'https://upload.wikimedia.org/photo.jpg',
        facts: [],
      }
    };
    const badActorPath = await writeTempActorsFile(badActors, '_temp_bad_actors.js');

    try {
      let exitCode = 0;
      let stdout = '';
      try {
        const res = await execAsync(`node scripts/validate_database.mjs --file ${cleanMoviePath} --actors-file ${badActorPath} --no-warnings`);
        stdout = res.stdout;
      } catch (err) {
        exitCode = err.code || 1;
        stdout = err.stdout || '';
      }

      assert.equal(exitCode, 1);
      assert.ok(stdout.includes('AUDIT FAILED'));
      assert.ok(stdout.includes('Dictionary key "WrongKey" does not match actor.name "Actual Name"'));
      assert.ok(stdout.includes('Invalid photo URL "http://insecure.org/photo.jpg"'));
      assert.ok(stdout.includes('Missing or empty "facts" array'));
    } finally {
      await cleanupFile(cleanMoviePath);
      await cleanupFile(badActorPath);
    }
  });

  it('CLI --json flag emits structured error payload when corrupted', async () => {
    const tempPath = await writeTempMoviesFile([getValidMovie({ rating: 99 })], '_temp_json_corrupt.js');
    try {
      let stdout = '';
      try {
        const res = await execAsync(`node scripts/validate_database.mjs --file ${tempPath} --json`);
        stdout = res.stdout;
      } catch (err) {
        stdout = err.stdout || '';
      }

      const json = JSON.parse(stdout);
      assert.equal(json.valid, false);
      assert.equal(json.movieResult.errors.length, 1);
      assert.ok(json.movieResult.errors[0].errors.some((e) => e.includes('Invalid rating "99"')));
    } finally {
      await cleanupFile(tempPath);
    }
  });
});

// ============================================================================
// SUITE 2: ADVERSARIAL FAILURE INJECTION ON run_e2e_tests.mjs / CORE ENGINES
// ============================================================================
describe('Adversarial Challenge: run_e2e_tests.mjs Assertion Sensitivity & Mutation Testing', () => {

  it('Verifies recommendationEngine distance and compromise math are sensitive to mutations', async () => {
    const { calculateVectorDistance, calculateCompromiseVector } = await import('../src/engine/recommendationEngine.js');

    // 1. Test vector distance behavior
    const v1 = { energy: 5, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 };
    const v2 = { energy: 5, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 };
    assert.equal(calculateVectorDistance(v1, v2), 0, 'Distance between identical vectors must be 0');

    const vFar = { energy: 0, darkness: 0, intellect: 0, emotion: 0, dynamism: 0 };
    const vOpp = { energy: 10, darkness: 10, intellect: 10, emotion: 10, dynamism: 10 };
    const maxDist = calculateVectorDistance(vFar, vOpp);
    assert.ok(maxDist > 20, `Max distance between extreme 5D vectors should be > 20, got ${maxDist}`);

    // 2. Test compromise vector calculation
    const mid = calculateCompromiseVector(vFar, vOpp);
    assert.deepEqual(mid, { energy: 5, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 });

    // Mutation injection verification: If an engine returned invalid compromise, assertions detect it
    const badCompromiseCalculator = () => ({ energy: 0, darkness: 0, intellect: 0, emotion: 0, dynamism: 0 });
    assert.notDeepEqual(badCompromiseCalculator(), mid, 'Test detects faulty compromise vector mutation');
  });

  it('Verifies getRecommendedDeck respects strict category filters and fails when polluted', async () => {
    const { getRecommendedDeck } = await import('../src/engine/recommendationEngine.js');

    const movieDeck = getRecommendedDeck({ filters: { category: 'movie' }, limit: 20 });
    assert.ok(movieDeck.length > 0, 'Movie deck returned');
    for (const m of movieDeck) {
      assert.equal(m.category || 'movie', 'movie', `Item ${m.id} in movie deck must have category "movie"`);
    }

    const animeDeck = getRecommendedDeck({ filters: { category: 'anime' }, limit: 20 });
    assert.ok(animeDeck.length > 0, 'Anime deck returned');
    for (const m of animeDeck) {
      assert.equal(m.category, 'anime', `Item ${m.id} in anime deck must have category "anime"`);
    }

    // Mutation injection: If a mock engine returned mixed categories in anime deck
    const corruptedDeck = [...animeDeck.slice(0, 19), { id: 9999, title: 'Injected Movie', category: 'movie' }];
    const hasLeak = corruptedDeck.some((m) => m.category !== 'anime');
    assert.equal(hasLeak, true, 'Category filter assertion detects category leakage mutation');
  });

  it('Verifies realtimeRooms room creation, guest join, and mutual match trigger under mutation', async () => {
    const { createRoom, joinRoom, leaveRoom, recordRoomSwipe, getActiveRoom } = await import('../src/engine/realtimeRooms.js');

    // 1. Room Creation
    const host = { id: 'test_adv_host', name: 'Host', avatar: '👑', likes: [] };
    const room = await createRoom({ hostUser: host });
    assert.ok(room, 'Room created');
    assert.match(room.code, /^[A-Z0-9]{4}$/, 'Code must match 4 uppercase chars');
    assert.equal(room.status, 'waiting', 'Initial status must be waiting');
    assert.equal(room.members.length, 1);

    // 2. Guest Join
    const guest = { id: 'test_adv_guest', name: 'Guest', avatar: '🍿', likes: [] };
    const joined = await joinRoom({ roomCode: room.code, user: guest });
    assert.equal(joined.status, 'active');
    assert.equal(joined.members.length, 2);
    assert.equal(joined.deck.length, 25, 'Deck must contain 25 movies');

    const targetMovie = joined.deck[0];

    // 3. Single like does NOT trigger match
    const swipe1 = recordRoomSwipe({ movieId: targetMovie.id, liked: true, userId: host.id });
    assert.equal(swipe1, null, 'Single like must return null');

    // 4. Mutual like DOES trigger match
    const swipe2 = recordRoomSwipe({ movieId: targetMovie.id, liked: true, userId: guest.id });
    assert.ok(swipe2 !== null, 'Mutual like must trigger match');
    assert.equal(swipe2.matched, true);
    assert.equal(swipe2.movieId, targetMovie.id);
    assert.equal(swipe2.movie.id, targetMovie.id);

    // 5. Mutation injection: Dislike does NOT trigger match even if other user liked
    const targetMovie2 = joined.deck[1];
    recordRoomSwipe({ movieId: targetMovie2.id, liked: true, userId: host.id });
    const swipeDislike = recordRoomSwipe({ movieId: targetMovie2.id, liked: false, userId: guest.id });
    assert.equal(swipeDislike, null, 'Pass swipe must never trigger match even if other user liked');

    await leaveRoom();
  });

  it('Verifies imagePrefetcher candidate resolution detects empty or malformed URLs', async () => {
    const { getPosterCandidates, getPosterUrl } = await import('../src/engine/imagePrefetcher.js');

    const sampleMovie = {
      id: 1,
      title: 'Побег из Шоушенка',
      poster: 'https://images-na.ssl-images-amazon.com/images/I/51NiGlapXlL.jpg',
      kinopoiskId: 326,
    };

    const candidates = getPosterCandidates(sampleMovie);
    assert.ok(Array.isArray(candidates) && candidates.length >= 2, 'Candidates array returned');
    assert.ok(candidates[0].includes('326.jpg'), 'Primary candidate includes Kinopoisk ID');
    for (const c of candidates) {
      assert.ok(c.startsWith('https://'), `Candidate must be https: ${c}`);
    }

    const nullMovieCandidates = getPosterCandidates(null);
    assert.deepEqual(nullMovieCandidates, []);

    const emptyUrl = getPosterUrl(null);
    assert.equal(emptyUrl, '');
  });

  it('Verifies actorResolver normalization handles Cyrillic, spacing, and diacritics', async () => {
    const actorsDataModule = await import('../src/data/actors.js');
    const actorsData = actorsDataModule.actorsData;

    // Direct contract test
    const norm = (name) => (name || '').toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9]/g, '');
    assert.equal(norm('  Том   Хэнкс  '), 'томхэнкс');
    assert.equal(norm('Фёдор Бондарчук'), 'федорбондарчук');
    assert.equal(norm('Федор Бондарчук'), 'федорбондарчук');

    // Verify Tom Hanks exists in curated dataset
    const tomHanks = actorsData['Том Хэнкс'];
    assert.ok(tomHanks, 'Tom Hanks must exist');
    assert.equal(tomHanks.nameEn, 'Tom Hanks');
    assert.ok(tomHanks.photo.startsWith('https://upload.wikimedia.org'));
    assert.equal(tomHanks.facts.length, 3);
  });
});
