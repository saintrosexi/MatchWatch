/**
 * Уровень 3 — Cross-Feature Interactions.
 * Связи между фильтрами, каталогом, комнатами, профилем и телеметрией.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { RECOMMENDATION_CONFIG, mergeConfig } from '../shared/config/recommendation.js';
import { createEmptyProfile, applySignal, ACTION } from '../src/engine/tasteProfile.js';
import { clearApiCache } from '../src/lib/api.js';
import { rankDeck, scoreTitle, buildConsensusProfile } from '../src/engine/ranking.js';
import { normalizeRoomCode, JOIN_SOURCE, roomPath } from '../shared/model/roomCode.js';
import { BIZ, MODULE } from '../shared/telemetry/events.js';
import { withHandler, ApiError, badRequest } from '../api/_lib/http.js';
import { tmdbFetch, assertNonEmpty } from '../api/_lib/tmdb.js';
import { LIBRARY, ALL_TITLES, makeTitle, seededRandom } from './helpers/fixtures.mjs';

/* ── Заглушки HTTP для проверки серверных хендлеров ───────────── */

function fakeReq({ method = 'GET', url = '/api/test', body, headers = {} } = {}) {
  return { method, url, headers: { host: 'localhost', ...headers }, body };
}

function fakeRes() {
  const res = {
    statusCode: 0, headers: {}, body: null, writableEnded: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(payload) { this.body = payload; this.writableEnded = true; },
  };
  return res;
}

const withMockedFetch = async (impl, fn) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  // Клиент API кэширует ответы — между сценариями кэш надо сбрасывать,
  // иначе второй тест увидит данные первого.
  clearApiCache();
  try { return await fn(); } finally { globalThis.fetch = original; clearApiCache(); }
};

/* ── Тесты ───────────────────────────────────────────────────── */

test('X1 · фильтры сужают колоду, но не ломают ранжирование', () => {
  let profile = createEmptyProfile();
  profile = applySignal(profile, LIBRARY.sevenSamurai, ACTION.FAVORITE);

  // Фильтр применяется до движка — эмулируем «только фильмы после 2000».
  const filtered = ALL_TITLES.filter((t) => t.year >= 2000);
  const deck = rankDeck(filtered, profile, { size: 10, random: seededRandom(11) });

  assert.ok(deck.length > 0);
  assert.ok(deck.every((c) => c.title.year >= 2000), 'фильтр не должен протекать');
  assert.equal(deck[0].title.title, '13 убийц', 'внутри фильтра порядок задаёт вкус');
});

test('X2 · пустой результат после фильтров даёт пустую колоду, а не мусор', () => {
  const impossible = ALL_TITLES.filter((t) => t.year > 2100);
  assert.deepEqual(rankDeck(impossible, createEmptyProfile()), []);
  assert.deepEqual(assertNonEmpty([], { path: '/discover/movie', params: {} }), [],
    'пустой ответ TMDB — это бизнес-сбой, а не исключение');
});

test('X3 · избранное двигает выдачу сильнее, чем «желаемое» того же фильма', () => {
  const wished = applySignal(createEmptyProfile(), LIBRARY.ocean11, ACTION.LATER);
  const favorited = applySignal(createEmptyProfile(), LIBRARY.ocean11, ACTION.FAVORITE);

  const rankOf = (profile) => rankDeck(ALL_TITLES, profile, {
    size: 15, explorationRate: 0, random: seededRandom(5),
  }).findIndex((c) => c.id === LIBRARY.inception.id);

  assert.ok(rankOf(favorited) <= rankOf(wished),
    'после избранного родственный по тегам фильм должен быть не ниже');
  assert.ok(favorited.tagWeights.heist > wished.tagWeights.heist,
    'избранное обязано весить больше отложенного');
});

test('X4 · «посмотрено» в комнате убирает фильм из следующей общей колоды', () => {
  const consensus = buildConsensusProfile([
    applySignal(createEmptyProfile(), LIBRARY.sevenSamurai, ACTION.LIKE),
    applySignal(createEmptyProfile(), LIBRARY.ran, ACTION.LIKE),
  ]);

  const before = rankDeck(ALL_TITLES, consensus, { size: 20, random: seededRandom(6) });
  assert.ok(before.some((c) => c.id === LIBRARY.thirteenAssassins.id));

  const after = rankDeck(ALL_TITLES, consensus, {
    size: 20,
    history: { [LIBRARY.thirteenAssassins.id]: 'watched' },
    random: seededRandom(6),
  });
  assert.ok(!after.some((c) => c.id === LIBRARY.thirteenAssassins.id));
});

test('X5 · колода актёра игнорирует разведку и слушает вкус', () => {
  const profile = applySignal(createEmptyProfile(), LIBRARY.sevenSamurai, ACTION.FAVORITE);
  const filmography = [LIBRARY.paddington, LIBRARY.ran, LIBRARY.notebook, LIBRARY.harakiri];

  const deck = rankDeck(filmography, profile, { size: 4, explorationRate: 0, random: seededRandom(8) });
  assert.equal(deck.length, 4);
  assert.ok(deck.every((c) => c.slot === 'profile'), 'в колоде актёра разведке не место');
  assert.ok(['Харакири', 'Ран'].includes(deck[0].title.title));
});

test('X6 · удалённый конфиг меняет поведение движка без правки кода', () => {
  const profile = (() => {
    let p = createEmptyProfile();
    for (let i = 0; i < 40; i += 1) p = applySignal(p, LIBRARY.sevenSamurai, ACTION.LIKE);
    return p;
  })();

  const noExplore = mergeConfig(RECOMMENDATION_CONFIG, { exploration: { rate: 0 } });
  const allExplore = mergeConfig(RECOMMENDATION_CONFIG, { exploration: { rate: 0.9, minQuality: 0 } });

  const a = rankDeck(ALL_TITLES, profile, { config: noExplore, size: 10, random: seededRandom(9) });
  const b = rankDeck(ALL_TITLES, profile, { config: allExplore, size: 10, random: seededRandom(9) });

  assert.equal(a.filter((c) => c.slot === 'explore').length, 0);
  assert.ok(b.filter((c) => c.slot === 'explore').length > a.filter((c) => c.slot === 'explore').length);
});

test('X7 · веса смешивания реально управляют вкладом сигналов', () => {
  const profile = applySignal(createEmptyProfile(), LIBRARY.sevenSamurai, ACTION.FAVORITE);

  const tagHeavy = mergeConfig(RECOMMENDATION_CONFIG, { blend: { tagWeight: 1, moodWeight: 0, qualityWeight: 0 } });
  const qualityHeavy = mergeConfig(RECOMMENDATION_CONFIG, { blend: { tagWeight: 0, moodWeight: 0, qualityWeight: 1 } });

  const byTags = scoreTitle(LIBRARY.ran, profile, { config: tagHeavy });
  const byQuality = scoreTitle(LIBRARY.ran, profile, { config: qualityHeavy });

  assert.equal(byTags.score, byTags.tagScore);
  assert.equal(byQuality.score, byQuality.qualityScore);
  assert.notEqual(byTags.score, byQuality.score);
});

test('X8 · антимонотонность разбавляет однородную ленту', () => {
  const clones = Array.from({ length: 8 }, (_, i) =>
    makeTitle(200 + i, `Самурай ${i}`, { genres: [28], keywords: ['samurai', 'sword fight'], rating: 8 - i * 0.1 }));
  const others = [LIBRARY.notebook, LIBRARY.inception, LIBRARY.parasite, LIBRARY.drive];

  const profile = applySignal(createEmptyProfile(), LIBRARY.sevenSamurai, ACTION.FAVORITE);
  const deck = rankDeck([...clones, ...others], profile, {
    size: 12, explorationRate: 0, random: seededRandom(12),
  });

  const dominant = deck.slice(0, 6).map((c) => Object.entries(c.title.tags)
    .sort(([, a], [, b]) => b - a)[0][0]);
  const longestRun = dominant.reduce((acc, tag, i) => {
    const run = tag === dominant[i - 1] ? acc.current + 1 : 1;
    return { current: run, max: Math.max(acc.max, run) };
  }, { current: 0, max: 0 }).max;

  assert.ok(longestRun <= 5, `слишком длинная серия одинаковых тем: ${longestRun}`);
});

test('X9 · код комнаты одинаков независимо от способа входа', () => {
  const inputs = {
    [JOIN_SOURCE.MANUAL]: ' 40719 ',
    [JOIN_SOURCE.LINK]: 'https://matchwatch.app/?room=40719',
    [JOIN_SOURCE.DEEP_LINK]: 'https://t.me/bot/app?startapp=40719',
    [JOIN_SOURCE.RECENT]: '40719',
  };
  const codes = new Set(Object.values(inputs).map(normalizeRoomCode));
  assert.equal(codes.size, 1, 'все способы входа обязаны сойтись в один код');
  assert.equal([...codes][0], '40719');

  const paths = new Set(Object.values(inputs).map((raw) => roomPath(raw, 'swipes')));
  assert.equal(paths.size, 1, 'а значит, и путь записи/чтения совпадает');
  assert.equal([...paths][0], 'rooms/40719/swipes');
});

test('X10 · обёртка хендлера отдаёт машиночитаемую ошибку вместо голого 500', async () => {
  const handler = withHandler({ methods: ['GET'], module: MODULE.TMDB_PROXY }, async () => {
    throw badRequest('bad_input', 'Параметр id обязателен');
  });

  const res = fakeRes();
  await handler(fakeReq(), res);

  assert.equal(res.statusCode, 400);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'bad_input');
  assert.equal(payload.error.retryable, false);
  assert.match(payload.error.message, /обязателен/);
});

test('X11 · внутренняя ошибка не утекает наружу подробностями', async () => {
  const handler = withHandler({ methods: ['GET'], module: MODULE.OPS }, async () => {
    throw new Error('SELECT * FROM secrets — стек с внутренностями');
  });

  const res = fakeRes();
  await handler(fakeReq(), res);

  assert.equal(res.statusCode, 500);
  const payload = JSON.parse(res.body);
  assert.equal(payload.error.code, 'internal_error');
  assert.ok(!payload.error.message.includes('SELECT'), 'внутренние детали не показываем пользователю');
  assert.equal(payload.error.retryable, true);
});

test('X12 · неподдерживаемый метод и preflight обрабатываются', async () => {
  const handler = withHandler({ methods: ['POST'], module: MODULE.OPS }, async () => ({ ok: true }));

  const preflight = fakeRes();
  await handler(fakeReq({ method: 'OPTIONS' }), preflight);
  assert.equal(preflight.statusCode, 204);
  assert.match(preflight.headers['access-control-allow-methods'], /POST/);

  const wrongMethod = fakeRes();
  await handler(fakeReq({ method: 'GET' }), wrongMethod);
  assert.equal(wrongMethod.statusCode, 405);
});

test('X13 · TMDB rate-limit приводит к повтору, а затем к внятной ошибке', async () => {
  process.env.TMDB_API_KEY = 'test-key';
  let calls = 0;

  await withMockedFetch(async () => {
    calls += 1;
    return { status: 429, ok: false, headers: new Map([['retry-after', '0']]), text: async () => '', json: async () => ({}) };
  }, async () => {
    await assert.rejects(
      () => tmdbFetch('/movie/popular', {}, { retries: 2 }),
      (error) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, 'tmdb_rate_limited');
        assert.equal(error.status, 429);
        return true;
      },
    );
  });

  assert.equal(calls, 3, 'должно быть три попытки: исходная + два повтора');
  delete process.env.TMDB_API_KEY;
});

test('X14 · 404 от TMDB — это «нет данных», а не сбой', async () => {
  process.env.TMDB_API_KEY = 'test-key';
  const result = await withMockedFetch(
    async () => ({ status: 404, ok: false, headers: new Map(), text: async () => '', json: async () => ({}) }),
    () => tmdbFetch('/movie/999999999'),
  );
  assert.equal(result, null);
  delete process.env.TMDB_API_KEY;
});

test('X15 · без ключа TMDB прокси сообщает о неверной настройке, а не падает молча', async () => {
  delete process.env.TMDB_API_KEY;
  delete process.env.TMDB_ACCESS_TOKEN;
  await assert.rejects(() => tmdbFetch('/movie/popular'), (error) => {
    assert.equal(error.code, 'tmdb_not_configured');
    assert.equal(error.status, 503);
    return true;
  });
});

test('X16 · компромисс комнаты действительно меняет колоду по сравнению с личной', () => {
  let action = createEmptyProfile();
  for (const t of [LIBRARY.johnWick, LIBRARY.fastFurious, LIBRARY.drive]) action = applySignal(action, t, ACTION.LIKE);

  let drama = createEmptyProfile();
  for (const t of [LIBRARY.notebook, LIBRARY.parasite]) drama = applySignal(drama, t, ACTION.LIKE);

  const seed = () => seededRandom(21);
  const soloDeck = rankDeck(ALL_TITLES, action, { size: 8, explorationRate: 0, random: seed() });
  const roomDeck = rankDeck(ALL_TITLES, buildConsensusProfile([action, drama]), {
    size: 8, explorationRate: 0, random: seed(),
  });

  assert.notDeepEqual(soloDeck.map((c) => c.id), roomDeck.map((c) => c.id),
    'общая колода обязана отличаться от личной');
});

test('X17 · бизнес-события покрывают все точки отказа комнат', () => {
  const roomFailures = [BIZ.ROOM_NOT_FOUND, BIZ.ROOM_EXPIRED, BIZ.ROOM_FULL,
    BIZ.ROOM_CODE_INVALID, BIZ.ROOM_CODE_COLLISION, BIZ.SWIPE_RACE_RETRY];
  assert.equal(new Set(roomFailures).size, roomFailures.length, 'имена событий должны быть уникальны');
  for (const name of roomFailures) assert.match(name, /^[a-z_]+$/, `имя ${name} не в snake_case`);
});

test('X18 · каталог не подмешивает ещё не вышедшие фильмы', async () => {
  process.env.TMDB_API_KEY = 'test-key';
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = `${new Date().getFullYear() + 1}-06-01`;

  const { default: catalogHandler } = await import('../api/tmdb/catalog.js');

  const payload = await withMockedFetch(async (url) => {
    const href = String(url);
    if (href.includes('/configuration')) {
      return jsonResponse({ images: { secure_base_url: 'https://image.tmdb.org/t/p/' } });
    }
    return jsonResponse({
      page: 1,
      total_pages: 1,
      results: [
        { id: 1, title: 'Уже вышел', release_date: '2019-05-30', poster_path: '/a.jpg', vote_average: 8, vote_count: 900 },
        { id: 2, title: 'Только анонс', release_date: nextYear, poster_path: '/b.jpg', vote_average: 9, vote_count: 12 },
        { id: 3, title: 'Дата неизвестна', release_date: null, poster_path: '/c.jpg', vote_average: 7, vote_count: 400 },
      ],
    });
  }, async () => {
    const res = fakeRes();
    await catalogHandler(fakeReq({ url: '/api/tmdb/catalog?list=popular&page=1' }), res);
    return JSON.parse(res.body);
  });

  delete process.env.TMDB_API_KEY;

  assert.equal(payload.ok, true);
  const names = payload.titles.map((t) => t.title);
  assert.deepEqual(names, ['Уже вышел'],
    'в выборе должны остаться только фильмы, которые уже можно посмотреть');
  assert.ok(payload.titles.every((t) => t.releaseDate <= today));
});

/** Ответ, неотличимый от настоящего для нашего клиента TMDB. */
function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    headers: new Map([['content-type', 'application/json']]),
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

test('X19 · пул каталога дорастает до размера из конфига, а не до лимита страниц', async () => {
  const { CatalogPool } = await import('../src/engine/catalog.js');
  const { RECOMMENDATION_CONFIG } = await import('../shared/config/recommendation.js');

  let pagesServed = 0;

  const pool = await withMockedFetch(async (url) => {
    const page = Number(new URL(String(url), 'http://x').searchParams.get('page') ?? 1);
    pagesServed += 1;
    return jsonResponse({
      ok: true,
      page,
      totalPages: 500,
      // Каждая страница отдаёт свои двадцать фильмов.
      titles: Array.from({ length: 20 }, (_, i) => ({
        id: `tmdb:movie:${page * 100 + i}`,
        title: `Фильм ${page}-${i}`,
        poster: 'https://image.tmdb.org/t/p/w500/x.jpg',
        tags: { action: 60 },
        moods: { energy: 50, darkness: 50, intellect: 50, emotion: 50, dynamism: 50 },
        quality: 0.7,
      })),
    });
  }, async () => {
    const p = new CatalogPool({ filters: {} });
    await p.fill(RECOMMENDATION_CONFIG.deck.candidatePool);
    return p;
  });

  assert.ok(pool.size >= RECOMMENDATION_CONFIG.deck.candidatePool,
    `пул должен дорасти до ${RECOMMENDATION_CONFIG.deck.candidatePool}, получилось ${pool.size}`);
  assert.ok(pagesServed > 6, `лимит страниц не должен быть жёстким, запрошено ${pagesServed}`);
  assert.equal(pool.exhausted, false, 'при 500 доступных страницах пул не может быть исчерпан');
});

test('X20 · страница из уже решённых фильмов не останавливает ленту', async () => {
  const { CatalogPool } = await import('../src/engine/catalog.js');

  // Первая страница целиком просмотрена, вторая — свежая.
  const seen = Array.from({ length: 20 }, (_, i) => `tmdb:movie:seen-${i}`);
  const history = Object.fromEntries(seen.map((id) => [id, 'watched']));

  const pool = await withMockedFetch(async (url) => {
    const page = Number(new URL(String(url), 'http://x').searchParams.get('page') ?? 1);
    const ids = page === 1 ? seen : Array.from({ length: 20 }, (_, i) => `tmdb:movie:fresh-${page}-${i}`);
    return jsonResponse({
      ok: true,
      page,
      totalPages: 500,
      titles: ids.map((id) => ({
        id,
        title: id,
        poster: 'https://image.tmdb.org/t/p/w500/x.jpg',
        tags: { action: 60 },
        moods: { energy: 50, darkness: 50, intellect: 50, emotion: 50, dynamism: 50 },
        quality: 0.7,
      })),
    });
  }, async () => {
    const p = new CatalogPool({ filters: {} });
    await p.loadMore();
    return p;
  });

  // После первой страницы показывать нечего — но каталог не исчерпан,
  // и вторая попытка обязана дать карточки.
  const firstPass = rankDeck(pool.all, createEmptyProfile(), { history, size: 40, random: seededRandom(1) });
  assert.equal(firstPass.length, 0, 'все фильмы первой страницы уже решены');
  assert.equal(pool.exhausted, false, 'каталог при этом не исчерпан');

  await withMockedFetch(async (url) => {
    const page = Number(new URL(String(url), 'http://x').searchParams.get('page') ?? 1);
    return jsonResponse({
      ok: true,
      page,
      totalPages: 500,
      titles: Array.from({ length: 20 }, (_, i) => ({
        id: `tmdb:movie:fresh-${page}-${i}`,
        title: `Свежий ${page}-${i}`,
        poster: 'https://image.tmdb.org/t/p/w500/x.jpg',
        tags: { action: 60 },
        moods: { energy: 50, darkness: 50, intellect: 50, emotion: 50, dynamism: 50 },
        quality: 0.7,
      })),
    });
  }, () => pool.loadMore());

  const secondPass = rankDeck(pool.all, createEmptyProfile(), { history, size: 40, random: seededRandom(1) });
  assert.ok(secondPass.length > 0,
    'следующая страница обязана дать карточки — иначе лента встаёт навсегда');
});
