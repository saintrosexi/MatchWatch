/**
 * Уровень 2 — Boundary & Corner Cases.
 * Граничные значения, null-проверки, мусор на входе, офлайн.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { normalizeTmdbMovie, buildTags, deriveMoodVector, computeQuality, parseTitleId, makeTitleId, clamp } from '../shared/model/title.js';
import { normalizeRoomCode, roomPath, generateRoomCode, isValidRoomCode } from '../shared/model/roomCode.js';
import { slugifyTag } from '../shared/taxonomy/tagOntology.js';
import { RECOMMENDATION_CONFIG, mergeConfig, NEUTRAL_MOOD } from '../shared/config/recommendation.js';
import {
  createEmptyProfile, hydrateProfile, applySignal, decayProfile,
  pruneProfile, topTags, serializeProfile, profileBreadth, isWarm, ACTION,
} from '../src/engine/tasteProfile.js';
import { rankDeck, scoreTitle, buildConsensusProfile, matchedTags } from '../src/engine/ranking.js';
import { cacheKeyFor } from '../api/_lib/cache.js';
import { validateInitData, botToken as readBotToken, botIdFromToken } from '../api/_lib/telegram.js';
import { usernameFromTelegram } from '../api/_lib/identity.js';
import { describeError, ApiClientError } from '../src/lib/api.js';
import { LIBRARY, ALL_TITLES, makeTitle, seededRandom } from './helpers/fixtures.mjs';

test('B1 · невалидные коды комнат отклоняются, а не «почти проходят»', () => {
  for (const bad of [null, undefined, '', '   ', 'ABC', 'ABCDE', 'ЖЖЖЖ', '!!!!', 42, {}, [], '\n\t']) {
    assert.equal(normalizeRoomCode(bad), null, `код ${JSON.stringify(bad)} должен быть отклонён`);
    assert.equal(isValidRoomCode(bad), false);
  }
  assert.throws(() => roomPath('ABC'), /невалидный код/);
});

test('B2 · визуально спорные символы схлопываются детерминированно', () => {
  assert.equal(normalizeRoomCode('0O1L'), 'QQJJ');
  assert.equal(normalizeRoomCode('0o1l'), 'QQJJ');
  // Двойная нормализация не меняет результат.
  const once = normalizeRoomCode('ab12');
  assert.equal(normalizeRoomCode(once), once);
});

test('B3 · алфавит кода не содержит визуально спорных символов', () => {
  const codes = new Set();
  for (let i = 0; i < 3000; i += 1) codes.add(generateRoomCode());
  for (const code of codes) {
    assert.ok(!/[O0IL1]/.test(code), `код ${code} содержит спорный символ`);
  }
  // 3000 генераций из ~923k кодов не должны давать много коллизий.
  assert.ok(codes.size > 2900, `слишком много коллизий: ${codes.size}/3000`);
});

test('B4 · нормализация переживает мусорный ответ TMDB', () => {
  assert.equal(normalizeTmdbMovie(null), null);
  assert.equal(normalizeTmdbMovie({}), null);
  assert.equal(normalizeTmdbMovie({ id: 0 }), null);

  const minimal = normalizeTmdbMovie({ id: 7 });
  assert.equal(minimal.title, 'Без названия');
  assert.equal(minimal.year, null);
  assert.equal(minimal.poster, null);
  assert.deepEqual(minimal.genreIds, []);
  assert.deepEqual(minimal.cast, []);
  assert.deepEqual(minimal.moods, NEUTRAL_MOOD, 'без данных настроение нейтральное');

  const broken = normalizeTmdbMovie({ id: 8, release_date: 'не дата', vote_average: null, genres: null });
  assert.equal(broken.year, null);
  assert.equal(broken.rating, null);
});

test('B5 · экстремальные значения качества остаются в 0..1', () => {
  for (const input of [
    { voteAverage: 10, voteCount: 1_000_000, popularity: 99999 },
    { voteAverage: 0, voteCount: 0, popularity: 0 },
    { voteAverage: -5, voteCount: -10, popularity: -1 },
    {},
  ]) {
    const { score } = computeQuality(input);
    assert.ok(score >= 0 && score <= 1, `качество вне диапазона для ${JSON.stringify(input)}`);
    assert.ok(Number.isFinite(score));
  }
  assert.equal(computeQuality({ voteAverage: 9, voteCount: 5 }).reliable, false,
    'пять голосов — не статистика');
});

test('B6 · слаг тега устойчив к мусору', () => {
  for (const bad of [null, undefined, '', ' ', '-', '--', 1, {}]) {
    const result = slugifyTag(bad);
    assert.ok(result === null || typeof result === 'string');
  }
  assert.equal(slugifyTag('a'.repeat(200)).length, 48, 'слаг обрезается');
  assert.equal(slugifyTag('  Sword   Fight!!  '), 'sword-fight');
});

test('B7 · профиль вкуса чинится из любого мусора', () => {
  for (const bad of [null, undefined, 0, '', [], { tagWeights: null }, { foo: 'bar' }]) {
    const p = hydrateProfile(bad);
    assert.ok(p.tagWeights && typeof p.tagWeights === 'object');
    assert.ok(p.counts.like === 0 || typeof p.counts.like === 'number');
    assert.equal(Object.keys(p.moods).length, 5);
  }
});

test('B8 · неизвестное действие не портит профиль', () => {
  const base = applySignal(createEmptyProfile(), LIBRARY.inception, ACTION.LIKE);
  const after = applySignal(base, LIBRARY.inception, 'телепортация');
  assert.deepEqual(after.tagWeights, base.tagWeights, 'неизвестный сигнал игнорируется');
  assert.equal(applySignal(base, null, ACTION.LIKE).signals, base.signals);
});

test('B9 · словарь тегов не растёт бесконечно', () => {
  const config = RECOMMENDATION_CONFIG;
  const noisy = { tagWeights: {}, moods: { ...NEUTRAL_MOOD }, moodMass: 1, counts: {}, signals: 1 };
  for (let i = 0; i < 1000; i += 1) noisy.tagWeights[`tag-${i}`] = Math.random() * 10;

  const pruned = pruneProfile(hydrateProfile(noisy), config);
  assert.ok(Object.keys(pruned.tagWeights).length <= config.decay.maxTags,
    'профиль обязан быть ограничен по размеру');
});

test('B10 · старение профиля монотонно и не уходит в отрицательные веса', () => {
  let profile = applySignal(createEmptyProfile(), LIBRARY.sevenSamurai, ACTION.FAVORITE);
  const before = profile.tagWeights.samurai;

  const halfLife = RECOMMENDATION_CONFIG.decay.halfLifeDays;
  const aged = decayProfile(
    { ...profile, updatedAt: Date.now() - halfLife * 86_400_000 },
    { now: Date.now() },
  );
  assert.ok(aged.tagWeights.samurai < before * 0.6, 'за период полураспада вес падает примерно вдвое');
  assert.ok(aged.tagWeights.samurai > 0);

  const fresh = decayProfile(profile);
  assert.equal(fresh.tagWeights.samurai, before, 'свежий профиль не стареет');
});

test('B11 · пустая колода и пустой профиль не роняют ранжирование', () => {
  assert.deepEqual(rankDeck([], createEmptyProfile()), []);
  assert.deepEqual(rankDeck([null, undefined, {}], createEmptyProfile()), []);
  const deck = rankDeck(ALL_TITLES, createEmptyProfile(), { size: 5, random: seededRandom(1) });
  assert.equal(deck.length, 5, 'на холодном старте лента всё равно собирается');
});

test('B12 · история жёстко исключает то, что нельзя показывать', () => {
  const history = {
    [LIBRARY.inception.id]: 'dislike',
    [LIBRARY.ocean11.id]: 'watched',
    [LIBRARY.johnWick.id]: 'like',
  };
  const deck = rankDeck(ALL_TITLES, createEmptyProfile(), { history, size: 50, random: seededRandom(2) });
  const ids = deck.map((c) => c.id);
  assert.ok(!ids.includes(LIBRARY.inception.id), 'отклонённое не возвращается');
  assert.ok(!ids.includes(LIBRARY.ocean11.id), '«посмотрено» убрано из колоды');
  assert.ok(!ids.includes(LIBRARY.johnWick.id), 'уже лайкнутое не показывается повторно');

  assert.equal(scoreTitle(LIBRARY.inception, createEmptyProfile(), { history }).score, 0);
});

test('B13 · размер колоды не превышает доступное количество тайтлов', () => {
  const deck = rankDeck(ALL_TITLES.slice(0, 3), createEmptyProfile(), { size: 100, random: seededRandom(4) });
  assert.equal(deck.length, 3);
  assert.equal(new Set(deck.map((c) => c.id)).size, 3, 'дубликатов быть не должно');
});

test('B14 · компромисс комнаты работает при одном и при нулевом участнике', () => {
  assert.equal(buildConsensusProfile([]).signals, 0);
  assert.equal(buildConsensusProfile(null).signals, 0);

  const solo = applySignal(createEmptyProfile(), LIBRARY.drive, ACTION.LIKE);
  const consensus = buildConsensusProfile([solo]);
  assert.deepEqual(consensus.tagWeights, solo.tagWeights, 'один участник — его собственный профиль');
});

test('B15 · активный участник не задавливает пассивного в комнате', () => {
  let heavy = createEmptyProfile();
  for (let i = 0; i < 80; i += 1) heavy = applySignal(heavy, LIBRARY.johnWick, ACTION.LIKE);
  const light = applySignal(createEmptyProfile(), LIBRARY.notebook, ACTION.LIKE);

  const consensus = buildConsensusProfile([heavy, light]);
  assert.ok(consensus.tagWeights.romance > 0,
    'тема «тихого» участника обязана выжить после нормализации');
});

test('B16 · идентификатор тайтла пригоден как ключ Postgres', () => {
  // В Postgres title_id — обычная колонка text, экранирование не нужно,
  // но формат обязан оставаться стабильным: на него завязаны первичные
  // ключи room_swipes, room_matches и title_history.
  const id = makeTitleId(603);
  assert.equal(id, 'tmdb:movie:603');
  assert.deepEqual(parseTitleId(id), { source: 'tmdb', kind: 'movie', externalId: '603' });
  assert.ok(id.length <= 64, 'идентификатор должен оставаться коротким');
});

test('B17 · ключ кэша не выносит запрещённых символов и ограничен по длине', () => {
  const key = cacheKeyFor('discover', { 'primary_release_date.gte': '1970-01-01', page: 1, empty: '' });
  assert.ok(!/[.#$/[\]]/.test(key), `ключ содержит запрещённый символ: ${key}`);
  assert.ok(key.length <= 180);
  assert.ok(!key.includes('empty'), 'пустые параметры не попадают в ключ');
  assert.equal(cacheKeyFor('x', { a: 1, b: 2 }), cacheKeyFor('x', { b: 2, a: 1 }),
    'порядок параметров не должен менять ключ');
});

test('B18 · просроченный initData отклоняется', () => {
  const botToken = 'bot:token';
  const stale = Math.floor(Date.now() / 1000) - 60 * 60 * 48;
  const params = new URLSearchParams({
    auth_date: String(stale),
    user: JSON.stringify({ id: 5, first_name: 'Ян' }),
  });
  const dcs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));

  assert.throws(() => validateInitData(params.toString(), { botToken }), /устарела/i);
  // С расширенным окном тот же пакет проходит — проверка именно на возраст.
  const ok = validateInitData(params.toString(), { botToken, maxAgeSeconds: 60 * 60 * 72 });
  assert.equal(ok.telegramId, '5');
});

test('B19 · initData без пользователя и без подписи отклоняется', () => {
  assert.throws(() => validateInitData('', { botToken: 'x' }), /не передал/i);
  assert.throws(() => validateInitData('auth_date=1', { botToken: 'x' }), /подпись/i);
  assert.throws(() => validateInitData(null, { botToken: 'x' }), /не передал/i);
});

/**
 * Регрессия на реальный сбой: токен, скопированный в панель хостинга,
 * приезжает с переводом строки на конце. Секрет HMAC от этого меняется
 * целиком, подпись не сходится ни у кого, а по симптому это неотличимо
 * от «Telegram сломался».
 */
test('B19a · токен бота из окружения читается без окружающих пробелов', () => {
  const clean = '123456:AA-clean-token';
  const previous = process.env.TELEGRAM_BOT_TOKEN;
  try {
    process.env.TELEGRAM_BOT_TOKEN = `  ${clean}\n`;
    assert.equal(readBotToken(), clean);
    assert.equal(botIdFromToken(), '123456');

    const params = signedInitData(clean, { id: 42, first_name: 'Ким' });
    // Подпись сходится, хотя в окружении лежит замусоренное значение.
    assert.equal(validateInitData(params).telegramId, '42');

    process.env.TELEGRAM_BOT_TOKEN = '   ';
    assert.equal(readBotToken(), null);
    assert.equal(botIdFromToken(), null);
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previous;
  }
});

/**
 * Регрессия на боевой сбой: вход не работал ни у кого.
 *
 * Свежие клиенты добавляют в initData поле `signature` (Ed25519 для
 * сторонней проверки) и включают его в подписываемую строку — сервер же
 * его выбрасывал, и подпись не сходилась никогда. Часть SDK, наоборот,
 * signature исключает, так что проходить обязаны оба варианта.
 *
 * Тест намеренно строит подпись независимо от кода валидации: прошлый
 * вариант генерировал её тем же выражением, что и проверял, и потому
 * подтверждал сам себя, а не совместимость с Telegram.
 */
test('B19b · подпись сходится и с signature внутри строки, и без него', () => {
  const token = '999:sig-token';
  const user = { id: 7, first_name: 'Лев' };

  const included = signedInitData(token, user, { signature: 'ed25519-payload' }, { signSignature: true });
  assert.equal(validateInitData(included, { botToken: token }).telegramId, '7',
    'клиент включил signature в подпись — так делает сам Telegram');

  const excluded = signedInitData(token, user, { signature: 'ed25519-payload' }, { signSignature: false });
  assert.equal(validateInitData(excluded, { botToken: token }).telegramId, '7',
    'клиент signature не подписывал — так делает часть SDK');

  // Подмена значения ломает подпись в обоих вариантах: перебор строк
  // не должен превращаться в дырку.
  const tampered = included.replace(/user=[^&]*/, `user=${encodeURIComponent(JSON.stringify({ id: 66 }))}`);
  assert.throws(() => validateInitData(tampered, { botToken: token }), /подпись/i);
});

/**
 * Подписанный initData, собранный вручную по спецификации Telegram.
 * @param {{signSignature?: boolean}} mode включать ли `signature` в data_check_string
 */
function signedInitData(token, user, extra = {}, { signSignature = true } = {}) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify(user),
    ...extra,
  });
  const dcs = [...params.entries()]
    .filter(([k]) => (signSignature ? true : k !== 'signature'))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return params.toString();
}

test('B19c · ник Telegram приводится к формату MatchWatch или отбрасывается', () => {
  assert.equal(usernameFromTelegram('@SaintRose'), 'saintrose');
  assert.equal(usernameFromTelegram('Ann_2000'), 'ann_2000');
  // Кириллица и знаки вырезаются, длина режется до 24.
  assert.equal(usernameFromTelegram('Аня'), null);
  assert.equal(usernameFromTelegram('a'.repeat(32)), 'a'.repeat(24));
  for (const bad of [null, undefined, '', '  ', '@@', 'ab']) {
    assert.equal(usernameFromTelegram(bad), null, `«${bad}» не годится как ник`);
  }
});

test('B20 · сериализация профиля не пропускает NaN и undefined в базу', () => {
  const dirty = hydrateProfile({
    tagWeights: { good: 1.5, bad: NaN, missing: undefined },
    moods: { energy: NaN, darkness: 70 },
    moodMass: NaN,
    signals: 3,
  });
  const serialized = serializeProfile(dirty);
  assert.equal(serialized.tagWeights.bad, undefined, 'NaN не должен уехать в базу');
  assert.equal(serialized.moods.energy, 50, 'сломанная ось чинится нейтральным значением');
  assert.equal(serialized.moods.darkness, 70);
  assert.equal(serialized.moodMass, 0);
  assert.ok(JSON.stringify(serialized).length > 0);
});

test('B21 · тайтл без тегов не ломает подсветку совпадений', () => {
  assert.deepEqual(matchedTags(undefined, { a: 1 }), []);
  assert.deepEqual(matchedTags({ a: 1 }, undefined), []);
  const naked = makeTitle(900, 'Без тегов', { genres: [], keywords: [] });
  const evaluation = scoreTitle(naked, createEmptyProfile());
  assert.ok(Number.isFinite(evaluation.score));
  assert.deepEqual(evaluation.matchedTags, []);
});

test('B22 · слияние конфига переопределяет только заданное', () => {
  const merged = mergeConfig(RECOMMENDATION_CONFIG, { exploration: { rate: 0.5 }, blend: undefined });
  assert.equal(merged.exploration.rate, 0.5);
  assert.equal(merged.exploration.coldStartRate, RECOMMENDATION_CONFIG.exploration.coldStartRate,
    'соседние поля не должны потеряться');
  assert.equal(merged.blend.tagWeight, RECOMMENDATION_CONFIG.blend.tagWeight);
  assert.deepEqual(mergeConfig(RECOMMENDATION_CONFIG, null), RECOMMENDATION_CONFIG);
});

test('B23 · вспомогательные функции границ', () => {
  assert.equal(clamp(-5, 0, 100), 0);
  assert.equal(clamp(500, 0, 100), 100);
  assert.equal(clamp(50, 0, 100), 50);
  assert.equal(parseTitleId('битый-ид'), null);
  assert.equal(parseTitleId(null), null);
  assert.equal(profileBreadth(createEmptyProfile()), 0);
  assert.equal(isWarm(createEmptyProfile()), false);
  assert.deepEqual(topTags(null), []);
});

test('B24 · веса тегов у тайтла ограничены сверху', () => {
  // Фильм с двадцатью пересекающимися ключевыми словами не должен
  // получить тег весом 400 и утащить всю ленту.
  const tags = buildTags({
    genreIds: [28, 18, 36],
    keywords: Array.from({ length: 20 }, () => 'samurai'),
  });
  for (const weight of Object.values(tags)) {
    assert.ok(weight <= 100, `вес тега ${weight} превысил максимум`);
  }
});

test('B25 · HTML вместо JSON распознаётся как отсутствующий бэкенд', async () => {
  // Статический хостинг отдаёт SPA на /api/* с кодом 200. Раньше такой
  // ответ проходил как успешный и всплывал невнятным TypeError дальше.
  const { api } = await import('../src/lib/api.js');
  const original = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Map([['content-type', 'text/html; charset=utf-8']]),
    json: async () => { throw new SyntaxError('Unexpected token <'); },
  });

  try {
    await assert.rejects(() => api.catalog({ page: 99 }), (error) => {
      assert.equal(error.code, 'api_unavailable');
      assert.equal(error.retryable, false);
      assert.match(error.message, /вместо данных/);
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('B26 · отклонённый фильм не возвращается в колоду ни при каких условиях', async () => {
  const { rankDeck, isDecided, DECIDED_STATES } = await import('../src/engine/ranking.js');

  // Все состояния, означающие принятое решение, обязаны исключать тайтл.
  for (const state of DECIDED_STATES) {
    const deck = rankDeck(ALL_TITLES, createEmptyProfile(), {
      history: { [LIBRARY.inception.id]: state },
      size: ALL_TITLES.length,
      random: seededRandom(5),
    });
    assert.ok(!deck.some((c) => c.id === LIBRARY.inception.id),
      `состояние «${state}» обязано убирать фильм из выбора`);
    assert.equal(isDecided(state), true);
  }

  // А вот «показали, но решения не приняли» — не решение: фильм вернётся.
  const seenOnly = rankDeck(ALL_TITLES, createEmptyProfile(), {
    history: { [LIBRARY.inception.id]: 'seen' },
    size: ALL_TITLES.length,
    random: seededRandom(5),
  });
  assert.ok(seenOnly.some((c) => c.id === LIBRARY.inception.id),
    'просто показанная карточка должна иметь право появиться снова');
  assert.equal(isDecided('seen'), false);
});

test('B27 · пустая история означает «ещё не загружено», а не «решений нет»', async () => {
  const { rankDeck } = await import('../src/engine/ranking.js');

  // Именно здесь пряталась ошибка: колода собиралась до прихода истории,
  // и всё отклонённое возвращалось в ленту. Проверка фиксирует разницу
  // между «истории нет» и «история пуста».
  const withoutHistory = rankDeck(ALL_TITLES, createEmptyProfile(), {
    size: ALL_TITLES.length, random: seededRandom(9),
  });
  const withHistory = rankDeck(ALL_TITLES, createEmptyProfile(), {
    history: { [LIBRARY.inception.id]: 'dislike' },
    size: ALL_TITLES.length,
    random: seededRandom(9),
  });

  assert.equal(withoutHistory.length, ALL_TITLES.length,
    'без истории движок не может ничего исключить — потому её и нужно дождаться');
  assert.equal(withHistory.length, ALL_TITLES.length - 1);
});

test('B28 · свайп снимает ровно одну карточку, даже если её уже убрал фильтр', async () => {
  const { advanceQueue } = await import('../src/hooks/useDeck.js');
  const queue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  // Обычный случай: решение по верхней карточке.
  assert.deepEqual(advanceQueue(queue, 'a').map((e) => e.id), ['b', 'c', 'd']);

  /*
   * Гонка, из-за которой лента «мерцала»: решение записывается в историю
   * синхронно, фильтр решённых успевает убрать карточку, и только потом
   * приходит снятие. Слепой сдвиг съедал бы следующую — под верхней
   * карточкой подменялся фильм.
   */
  const alreadyPurged = queue.filter((e) => e.id !== 'a');
  assert.deepEqual(advanceQueue(alreadyPurged, 'a').map((e) => e.id), ['b', 'c', 'd'],
    'повторное снятие не должно трогать очередь');

  // Снятие не с начала очереди тоже не задевает соседей.
  assert.deepEqual(advanceQueue(queue, 'c').map((e) => e.id), ['a', 'b', 'd']);

  assert.deepEqual(advanceQueue([], 'a'), []);
  assert.deepEqual(advanceQueue(queue).map((e) => e.id), ['b', 'c', 'd'],
    'без идентификатора снимается первая — запасное поведение');
});

test('B29 · неудачная запись не теряется, а досылается при возврате сети', async () => {
  // Подменяем окружение браузера: очередь живёт в localStorage.
  const store = new Map();
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };

  const { registerHandler, durableWrite, flushOutbox, pendingCount, __resetOutbox } =
    await import('../src/lib/outbox.js');

  __resetOutbox();
  let networkDown = true;
  const delivered = [];
  registerHandler('probe', async (payload) => {
    if (networkDown) throw new Error('сеть недоступна');
    delivered.push(payload.value);
  });

  await durableWrite('probe', { value: 'первое' }, { key: 'title:1' });
  await durableWrite('probe', { value: 'другое' }, { key: 'title:2' });
  assert.equal(pendingCount(), 2, 'неудачные записи обязаны попасть в очередь');

  // Повторное решение по тому же фильму заменяет прежнее: в очереди
  // должно лежать последнее состояние, а не история изменений.
  await durableWrite('probe', { value: 'исправленное' }, { key: 'title:1' });
  assert.equal(pendingCount(), 2, 'повтор по тому же ключу не должен раздувать очередь');

  networkDown = false;
  const result = await flushOutbox();

  assert.equal(result.sent, 2);
  assert.equal(result.left, 0);
  assert.equal(pendingCount(), 0, 'после доставки очередь пуста');
  assert.ok(delivered.includes('исправленное'), 'доставлено должно быть последнее решение');
  assert.ok(!delivered.includes('первое'), 'устаревшее решение отправлять не нужно');
});
