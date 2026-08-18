import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMovieRecord,
  validateMoviesDataset,
  validateActorsDataset,
  formatValidationReport,
} from '../scripts/validate_database.mjs';

// Helper to create a valid movie record template
function createValidMovie(overrides = {}) {
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

// Helper to create a valid actor record template
function createValidActor(overrides = {}) {
  return {
    name: 'Том Хэнкс',
    nameEn: 'Tom Hanks',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/5/51/TomHanks.jpg',
    facts: [
      'Получил две премии Оскар подряд.',
      'Коллекционирует винтажные пишущие машинки.',
      'В его честь назван астероид.',
    ],
    ...overrides,
  };
}

describe('validateMovieRecord Unit Tests', () => {
  it('passes on a 100% valid movie record', () => {
    const movie = createValidMovie();
    const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
    const res = validateMovieRecord(movie, 0, state);
    assert.equal(res.errors.length, 0, `Expected 0 errors, got: ${JSON.stringify(res.errors)}`);
  });

  describe('ID validations', () => {
    it('fails on non-number or non-integer ID', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res1 = validateMovieRecord(createValidMovie({ id: '1' }), 0, state);
      assert.ok(res1.errors.some((e) => e.includes('Invalid id')));

      const res2 = validateMovieRecord(createValidMovie({ id: 1.5 }), 0, state);
      assert.ok(res2.errors.some((e) => e.includes('Invalid id')));

      const res3 = validateMovieRecord(createValidMovie({ id: 0 }), 0, state);
      assert.ok(res3.errors.some((e) => e.includes('Invalid id')));

      const res4 = validateMovieRecord(createValidMovie({ id: -5 }), 0, state);
      assert.ok(res4.errors.some((e) => e.includes('Invalid id')));
    });

    it('fails when ID does not match index + 1 in strict mode', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res = validateMovieRecord(createValidMovie({ id: 5 }), 0, state);
      assert.ok(res.errors.some((e) => e.includes('Non-sequential ID')));
    });

    it('detects duplicate IDs', () => {
      const state = { seenIds: new Set([1]), seenKpIds: new Map(), seenTitles: new Map() };
      const res = validateMovieRecord(createValidMovie({ id: 1 }), 0, state);
      assert.ok(res.errors.some((e) => e.includes('Duplicate ID')));
    });
  });

  describe('Title validations', () => {
    it('fails on missing or empty title', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res1 = validateMovieRecord(createValidMovie({ title: '' }), 0, state);
      assert.ok(res1.errors.some((e) => e.includes('title')));

      const res2 = validateMovieRecord(createValidMovie({ title: '   ' }), 0, state);
      assert.ok(res2.errors.some((e) => e.includes('title')));

      const res3 = validateMovieRecord(createValidMovie({ titleRu: '' }), 0, state);
      assert.ok(res3.errors.some((e) => e.includes('titleRu')));
    });
  });

  describe('Year validations', () => {
    it('fails on years out of bounds or non-integers', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res1 = validateMovieRecord(createValidMovie({ year: 1899 }), 0, state);
      assert.ok(res1.errors.some((e) => e.includes('Invalid year')));

      const res2 = validateMovieRecord(createValidMovie({ year: 2035 }), 0, state);
      assert.ok(res2.errors.some((e) => e.includes('Invalid year')));

      const res3 = validateMovieRecord(createValidMovie({ year: '2020' }), 0, state);
      assert.ok(res3.errors.some((e) => e.includes('Invalid year')));
    });
  });

  describe('Rating validations', () => {
    it('fails on rating < 0 or > 10 or NaN', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res1 = validateMovieRecord(createValidMovie({ rating: -0.1 }), 0, state);
      assert.ok(res1.errors.some((e) => e.includes('Invalid rating')));

      const res2 = validateMovieRecord(createValidMovie({ rating: 10.1 }), 0, state);
      assert.ok(res2.errors.some((e) => e.includes('Invalid rating')));

      const res3 = validateMovieRecord(createValidMovie({ rating: NaN }), 0, state);
      assert.ok(res3.errors.some((e) => e.includes('Invalid rating')));
    });
  });

  describe('Poster validations', () => {
    it('fails on non-HTTPS, empty, or malformed poster URLs', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res1 = validateMovieRecord(createValidMovie({ poster: '' }), 0, state);
      assert.ok(res1.errors.some((e) => e.includes('poster')));

      const res2 = validateMovieRecord(createValidMovie({ poster: 'http://insecure.com/img.jpg' }), 0, state);
      assert.ok(res2.errors.some((e) => e.includes('https://')));

      const res3 = validateMovieRecord(createValidMovie({ poster: 'https://' }), 0, state);
      assert.ok(res3.errors.some((e) => e.includes('Malformed') || e.includes('poster')));
    });
  });

  describe('Kinopoisk ID validations', () => {
    it('allows null kinopoiskId', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res = validateMovieRecord(createValidMovie({ kinopoiskId: null }), 0, state);
      assert.equal(res.errors.length, 0);
    });

    it('fails on non-integer or negative kinopoiskId', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res1 = validateMovieRecord(createValidMovie({ kinopoiskId: -1 }), 0, state);
      assert.ok(res1.errors.some((e) => e.includes('kinopoiskId')));

      const res2 = validateMovieRecord(createValidMovie({ kinopoiskId: '326' }), 0, state);
      assert.ok(res2.errors.some((e) => e.includes('kinopoiskId')));
    });

    it('detects duplicate Kinopoisk ID collisions', () => {
      const state = {
        seenIds: new Set([1]),
        seenKpIds: new Map([[326, { id: 1, title: 'Побег из Шоушенка' }]]),
        seenTitles: new Map(),
      };
      const res = validateMovieRecord(createValidMovie({ id: 2, kinopoiskId: 326, title: 'Клон Шоушенка' }), 1, state);
      assert.ok(res.errors.some((e) => e.includes('Kinopoisk ID collision')));
    });
  });

  describe('5D Sensation Vector validations', () => {
    it('fails on missing vector or missing keys', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res1 = validateMovieRecord(createValidMovie({ sensationVector: null }), 0, state);
      assert.ok(res1.errors.some((e) => e.includes('sensationVector')));

      const res2 = validateMovieRecord(
        createValidMovie({ sensationVector: { energy: 5, darkness: 5, intellect: 5, emotion: 5 } }),
        0,
        state
      );
      assert.ok(res2.errors.some((e) => e.includes('dynamism')));
    });

    it('fails on vector values out of [0, 10] range', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res = validateMovieRecord(
        createValidMovie({
          sensationVector: { energy: 15, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 },
        }),
        0,
        state
      );
      assert.ok(res.errors.some((e) => e.includes('out of range')));
    });
  });

  describe('Vibe badges validations', () => {
    it('fails on empty or invalid vibeBadges array', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res1 = validateMovieRecord(createValidMovie({ vibeBadges: [] }), 0, state);
      assert.ok(res1.errors.some((e) => e.includes('vibeBadges')));

      const res2 = validateMovieRecord(createValidMovie({ vibeBadges: [''] }), 0, state);
      assert.ok(res2.errors.some((e) => e.includes('vibeBadges')));
    });
  });

  describe('Categorization and cross-contamination validations', () => {
    it('fails on invalid category', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res = validateMovieRecord(createValidMovie({ category: 'documentary' }), 0, state);
      assert.ok(res.errors.some((e) => e.includes('Invalid category')));
    });

    it('fails when type does not match category', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res = validateMovieRecord(createValidMovie({ category: 'movie', type: 'series' }), 0, state);
      assert.ok(res.errors.some((e) => e.includes('Inconsistent type property')));
    });

    it('detects cross-contamination: series keywords in movie genre', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res = validateMovieRecord(createValidMovie({ category: 'movie', genres: 'Драма, сериал' }), 0, state);
      assert.ok(res.errors.some((e) => e.includes('Cross-contamination')));
    });

    it('detects cross-contamination: anime keywords in movie genre', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res = validateMovieRecord(createValidMovie({ category: 'movie', genres: 'Мультфильм, аниме' }), 0, state);
      assert.ok(res.errors.some((e) => e.includes('Cross-contamination')));
    });

    it('detects cross-contamination: anime keywords in series genre', () => {
      const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
      const res = validateMovieRecord(createValidMovie({ category: 'series', type: 'series', genres: 'Боевик, аниме' }), 0, state);
      assert.ok(res.errors.some((e) => e.includes('Cross-contamination')));
    });
  });
});

describe('validateMoviesDataset Suite', () => {
  it('validates a clean mock dataset of 3 items (movie, series, anime)', () => {
    const dataset = [
      createValidMovie({ id: 1, category: 'movie', type: 'movie', kinopoiskId: 101 }),
      createValidMovie({ id: 2, category: 'series', type: 'series', kinopoiskId: 102, genres: 'Драма, триллер' }),
      createValidMovie({ id: 3, category: 'anime', type: 'anime', kinopoiskId: 103, country: 'Япония', genres: 'Аниме, фантастика' }),
    ];

    const res = validateMoviesDataset(dataset, { expectedCount: 3 });
    assert.equal(res.errors.length, 0);
    assert.equal(res.total, 3);
    assert.equal(res.categories.movie, 1);
    assert.equal(res.categories.series, 1);
    assert.equal(res.categories.anime, 1);
    assert.equal(res.validPosters, 3);
    assert.equal(res.validVectors, 3);
    assert.equal(res.uniqueKpIds, 3);
    assert.equal(res.kpCollisions, 0);
  });

  it('aggregates multiple dataset defects cleanly', () => {
    const dataset = [
      createValidMovie({ id: 1, kinopoiskId: 999, poster: 'http://insecure' }),
      createValidMovie({ id: 1, kinopoiskId: 999, category: 'invalidCat' }),
    ];

    const res = validateMoviesDataset(dataset);
    assert.ok(res.errors.length >= 2);
    assert.equal(res.kpCollisions, 1);
  });
});

describe('validateActorsDataset Suite', () => {
  it('validates a clean actors dataset', () => {
    const actorsData = {
      'Том Хэнкс': createValidActor(),
      'Брэд Питт': createValidActor({ name: 'Брэд Питт', nameEn: 'Brad Pitt' }),
    };

    const res = validateActorsDataset(actorsData);
    assert.equal(res.errors.length, 0);
    assert.equal(res.total, 2);
    assert.equal(res.validPhotos, 2);
    assert.equal(res.validFacts, 2);
  });

  it('detects actor dataset violations', () => {
    const badActors = {
      'KeyMismatch': createValidActor({ name: 'Different Name' }),
      'NoPhoto': createValidActor({ name: 'NoPhoto', photo: '' }),
      'NoFacts': createValidActor({ name: 'NoFacts', facts: [] }),
    };

    const res = validateActorsDataset(badActors);
    assert.equal(res.errors.length, 3);
  });
});

describe('formatValidationReport Output', () => {
  it('formats clean report strings for pass and fail states', () => {
    const cleanMovieResult = {
      total: 10,
      categories: { movie: 5, series: 3, anime: 2, invalid: 0 },
      validPosters: 10,
      validVectors: 10,
      validVibeBadges: 10,
      uniqueKpIds: 10,
      nullKpIds: 0,
      kpCollisions: 0,
      errors: [],
      warnings: [],
    };
    const cleanActorResult = {
      total: 5,
      validPhotos: 5,
      validFacts: 5,
      errors: [],
      warnings: [],
    };

    const passOutput = formatValidationReport(cleanMovieResult, cleanActorResult);
    assert.ok(passOutput.includes('AUDIT PASSED'));
    assert.ok(passOutput.includes('10 items'));
    assert.ok(passOutput.includes('Movies:'));
    assert.ok(passOutput.includes('Series:'));
    assert.ok(passOutput.includes('Anime:'));

    const failMovieResult = {
      ...cleanMovieResult,
      errors: [{ id: 1, title: 'Bad Movie', errors: ['Broken poster URL'], warnings: [] }],
    };
    const failOutput = formatValidationReport(failMovieResult, cleanActorResult);
    assert.ok(failOutput.includes('AUDIT FAILED'));
    assert.ok(failOutput.includes('Broken poster URL'));
  });
});

describe('Adversarial & Edge Cases Suite', () => {
  it('handles titles with HTML tags, emojis, and special symbols safely', () => {
    const movie = createValidMovie({
      title: '<b>Alien vs Predator: Requiem & <Special></b> 🎬',
      titleRu: '«Чужой против Хищника: Реквием & <Спец>» 🍿',
    });
    const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
    const res = validateMovieRecord(movie, 0, state);
    assert.equal(res.errors.length, 0);
  });

  it('rejects infinite or NaN floating point numbers in sensation vectors', () => {
    const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
    const res1 = validateMovieRecord(
      createValidMovie({
        sensationVector: { energy: Infinity, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 },
      }),
      0,
      state
    );
    assert.ok(res1.errors.some((e) => e.includes('valid number')));

    const res2 = validateMovieRecord(
      createValidMovie({
        sensationVector: { energy: -Infinity, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 },
      }),
      0,
      state
    );
    assert.ok(res2.errors.some((e) => e.includes('valid number')));
  });

  it('validates sensation vector boundary values (0.0, 10.0, 5.5)', () => {
    const state = { seenIds: new Set(), seenKpIds: new Map(), seenTitles: new Map() };
    const res = validateMovieRecord(
      createValidMovie({
        sensationVector: { energy: 0, darkness: 10, intellect: 5.5, emotion: 0.1, dynamism: 9.9 },
      }),
      0,
      state
    );
    assert.equal(res.errors.length, 0);
  });

  it('handles completely empty or non-object movie records gracefully without crashing', () => {
    const res1 = validateMovieRecord(null, 0);
    assert.ok(res1.errors.length > 0);

    const res2 = validateMovieRecord(undefined, 0);
    assert.ok(res2.errors.length > 0);

    const res3 = validateMovieRecord('invalid string', 0);
    assert.ok(res3.errors.length > 0);
  });

  it('handles non-array dataset input in validateMoviesDataset gracefully', () => {
    const res = validateMoviesDataset(null);
    assert.equal(res.errors.length, 1);
    assert.equal(res.total, 0);
  });
});

describe('CLI Execution Suite', () => {
  it('executes validate_database.mjs as a CLI subprocess and outputs valid JSON with --json flag', async () => {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    try {
      await execAsync('node scripts/validate_database.mjs --json', { maxBuffer: 10 * 1024 * 1024 });
      assert.fail('Should have exited with non-zero on current dirty DB');
    } catch (err) {
      assert.equal(err.code, 1);
      assert.ok(err.stdout, 'Should have stdout JSON output');
      const parsed = JSON.parse(err.stdout);
      assert.equal(typeof parsed, 'object');
      assert.equal(parsed.valid, false);
      assert.ok(parsed.movieResult.total > 0);
      assert.ok(parsed.movieResult.errors.length > 0);
    }
  });

  it('executes validate_database.mjs with --file on a clean mock file and exits with code 0', async () => {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const execAsync = promisify(exec);

    const tempMockPath = path.resolve(process.cwd(), 'tests/_temp_clean_mock.js');
    const mockContent = `export const movies = [
  {
    id: 1,
    title: "Тестовый фильм",
    titleRu: "Тестовый фильм",
    year: 2020,
    rating: 8.5,
    poster: "https://example.com/poster1.jpg",
    description: "Описание фильма",
    fullDescription: "Полное подробное описание тестового фильма без спойлеров.",
    country: "Россия",
    genres: "Драма, комедия",
    kinopoiskId: 10001,
    sensationVector: { energy: 5, darkness: 3, intellect: 7, emotion: 8, dynamism: 6 },
    vibeBadges: ["✨ Вдохновляющий"],
    category: "movie",
    type: "movie"
  }
];`;
    try {
      await fs.writeFile(tempMockPath, mockContent, 'utf-8');
      const { stdout } = await execAsync(`node scripts/validate_database.mjs --file tests/_temp_clean_mock.js`);
      assert.ok(stdout.includes('AUDIT PASSED'));
      assert.ok(stdout.includes('Total Records:'));
      assert.ok(stdout.includes('1 items'));
    } finally {
      await fs.unlink(tempMockPath).catch(() => {});
    }
  });
});



