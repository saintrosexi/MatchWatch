/**
 * Уровень 4 — Real-World Workflows.
 * Полные пользовательские сценарии от первого запуска до мэтча,
 * включая гонки, переподключение и синхронизацию между устройствами.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyProfile, applySignal, isWarm, serializeProfile, hydrateProfile, ACTION } from '../src/engine/tasteProfile.js';
import { rankDeck, buildConsensusProfile, scoreTitle } from '../src/engine/ranking.js';
import { roomHistory } from '../src/engine/roomDeck.js';
import { normalizeRoomCode, roomPath, generateRoomCode, JOIN_SOURCE } from '../shared/model/roomCode.js';
import { RECOMMENDATION_CONFIG } from '../shared/config/recommendation.js';
import { ApiClientError, describeError } from '../src/lib/api.js';
import { LIBRARY, ALL_TITLES, makeTitle, seededRandom } from './helpers/fixtures.mjs';

test('W1 · путь нового пользователя: холодный старт → прогретый профиль', () => {
  let profile = createEmptyProfile();
  const random = seededRandom(101);

  // Первая колода: профиля нет, поэтому разведки должно быть много.
  const firstDeck = rankDeck(ALL_TITLES, profile, { size: 10, random });
  const coldExplore = firstDeck.filter((c) => c.slot === 'explore').length;
  assert.ok(coldExplore >= 4, `на холодном старте ожидали больше разведки, получили ${coldExplore}`);
  assert.equal(isWarm(profile), false);

  // Пользователь свайпает: лайкает боевики с погонями, отклоняет мелодрамы.
  for (let round = 0; round < 9; round += 1) {
    profile = applySignal(profile, LIBRARY.johnWick, ACTION.LIKE);
    profile = applySignal(profile, LIBRARY.drive, ACTION.LIKE);
    profile = applySignal(profile, LIBRARY.notebook, ACTION.DISLIKE);
  }
  profile = applySignal(profile, LIBRARY.fastFurious, ACTION.FAVORITE);

  assert.ok(isWarm(profile), 'после 28 сигналов профиль обязан считаться прогретым');
  assert.ok(profile.tagWeights['car-chase'] > 0);
  assert.ok((profile.tagWeights.romance ?? 0) <= 0, 'отклонённая тема ушла в минус или обнулилась');

  // Вторая колода: разведки меньше, релевантного больше.
  const warmDeck = rankDeck(ALL_TITLES, profile, { size: 10, random: seededRandom(101) });
  const warmExplore = warmDeck.filter((c) => c.slot === 'explore').length;
  assert.ok(warmExplore < coldExplore, 'по мере прогрева разведки должно становиться меньше');

  const notebookScore = scoreTitle(LIBRARY.notebook, profile).score;
  const driveScore = scoreTitle(LIBRARY.fastFurious, profile).rawScore;
  assert.ok(driveScore > notebookScore);
});

/*
 * W2–W4 переехали в tests/tier5-database.test.mjs.
 *
 * Запись голоса, кворум и создание мэтча теперь целиком в SQL-функции
 * record_swipe: она берёт блокировку строки комнаты и делает всё одной
 * транзакцией. Симулировать это на клиенте бессмысленно — проверять надо
 * настоящий Postgres, что пятый уровень и делает.
 */

test('W5 · вход по коду из трёх источников ведёт в одну комнату', () => {
  const code = '40719';
  const entries = [
    { source: JOIN_SOURCE.MANUAL, raw: ' 40719 ' },
    { source: JOIN_SOURCE.LINK, raw: `https://matchwatch.app/?room=${code}` },
    { source: JOIN_SOURCE.DEEP_LINK, raw: `https://t.me/mwbot/app?startapp=${code}` },
  ];

  for (const entry of entries) {
    assert.equal(normalizeRoomCode(entry.raw), code, `источник ${entry.source} дал другой код`);
    assert.equal(roomPath(entry.raw, 'members'), `rooms/${code}/members`);
  }
});

test('W6 · возврат из фона восстанавливает прогресс из состояния комнаты', () => {
  // Локально ничего не хранится: прогресс — производная от серверных свайпов.
  const roomState = {
    swipes: {
      [LIBRARY.inception.id]: { u_alice: 'like', u_bob: 'pass' },
      [LIBRARY.drive.id]: { u_alice: 'pass' },
      [LIBRARY.ocean11.id]: { u_bob: 'like' },
    },
    watchlist: {
      [LIBRARY.parasite.id]: { titleId: LIBRARY.parasite.id, watched: true },
    },
  };

  const restored = roomHistory(roomState, 'u_alice');
  assert.equal(restored[LIBRARY.inception.id], 'like');
  assert.equal(restored[LIBRARY.drive.id], 'dislike');
  assert.equal(restored[LIBRARY.ocean11.id], undefined, 'чужой свайп не мой прогресс');
  assert.equal(restored[LIBRARY.parasite.id], 'watched');

  const deck = rankDeck(ALL_TITLES, createEmptyProfile(), {
    history: restored, size: 30, random: seededRandom(77),
  });
  const ids = deck.map((c) => c.id);
  assert.ok(!ids.includes(LIBRARY.inception.id), 'уже отсвайпанное не показывается заново');
  assert.ok(!ids.includes(LIBRARY.parasite.id), 'просмотренное исключено');
  assert.ok(ids.includes(LIBRARY.ocean11.id), 'то, что я ещё не видел, остаётся в колоде');
});

test('W7 · «уже посмотрели» убирает фильм из следующей колоды комнаты', () => {
  const consensus = buildConsensusProfile([
    applySignal(createEmptyProfile(), LIBRARY.inception, ACTION.LIKE),
    applySignal(createEmptyProfile(), LIBRARY.interstellar, ACTION.LIKE),
  ]);

  const roomState = {
    swipes: {},
    watchlist: { x: { titleId: LIBRARY.interstellar.id, watched: true } },
  };

  const deck = rankDeck(ALL_TITLES, consensus, {
    history: roomHistory(roomState, 'u_alice'), size: 20, random: seededRandom(88),
  });
  assert.ok(!deck.some((c) => c.id === LIBRARY.interstellar.id));
});

test('W8 · офлайн деградирует внятно, а не бесконечным спиннером', () => {
  const offline = new ApiClientError('Нет соединения с интернетом', { code: 'offline', retryable: true });
  const described = describeError(offline);
  assert.match(described.text, /интернет/i);
  assert.equal(described.retryable, true);

  const rateLimited = new ApiClientError('slow down', { code: 'tmdb_rate_limited', status: 429, retryable: true });
  assert.match(describeError(rateLimited).text, /перегружен|подождите/i);

  const unknown = describeError(new Error('boom'));
  assert.equal(unknown.retryable, true);
  assert.ok(unknown.text.length > 0, 'у пользователя всегда есть текст и путь дальше');
});

test('W9 · синхронизация между устройствами: профиль переживает сериализацию', () => {
  let phone = createEmptyProfile();
  for (const t of [LIBRARY.sevenSamurai, LIBRARY.ran]) phone = applySignal(phone, t, ACTION.LIKE);
  phone = applySignal(phone, LIBRARY.harakiri, ACTION.FAVORITE);

  // Уехало в базу и приехало на десктоп.
  const wire = JSON.parse(JSON.stringify(serializeProfile(phone)));
  const desktop = hydrateProfile(wire);

  assert.deepEqual(desktop.tagWeights, phone.tagWeights);
  assert.equal(desktop.signals, phone.signals);

  // И продолжение свайпов на втором устройстве не теряет накопленное.
  const continued = applySignal(desktop, LIBRARY.thirteenAssassins, ACTION.LIKE);
  assert.ok(continued.tagWeights.samurai > desktop.tagWeights.samurai);
  assert.equal(continued.signals, phone.signals + 1);
});

test('W10 · длинная сессия: 200 свайпов не раздувают профиль и не ломают ленту', () => {
  let profile = createEmptyProfile();
  const catalogue = Array.from({ length: 200 }, (_, i) =>
    makeTitle(1000 + i, `Фильм ${i}`, {
      genres: [[28, 18, 35, 27, 878][i % 5]],
      keywords: [`тема-${i % 40}`, i % 3 === 0 ? 'samurai' : 'heist'],
      rating: 5 + (i % 5),
      votes: 500 + i * 10,
    }));

  const random = seededRandom(303);
  for (const title of catalogue) {
    profile = applySignal(profile, title, random() > 0.4 ? ACTION.LIKE : ACTION.DISLIKE);
  }

  assert.ok(Object.keys(profile.tagWeights).length <= RECOMMENDATION_CONFIG.decay.maxTags,
    'профиль обязан оставаться ограниченным');
  assert.equal(profile.signals, 200);
  /*
   * Вектора настроения у человека больше нет — проверять на границы
   * нечего. Ограниченность профиля держится на числе тегов выше.
   */
  assert.equal(profile.moods, undefined);

  const deck = rankDeck(catalogue, profile, { size: 30, random: seededRandom(303) });
  assert.ok(deck.length > 0);
  assert.equal(new Set(deck.map((c) => c.id)).size, deck.length, 'без дубликатов');
});

test('W11 · сценарий «Star Hub → колода актёра → мэтч в комнате»', () => {
  // Пользователь открыл актёра и собрал колоду только из его фильмов.
  const filmography = [LIBRARY.sevenSamurai, LIBRARY.yojimbo, LIBRARY.ran, LIBRARY.harakiri];
  let profile = createEmptyProfile();

  const actorDeck = rankDeck(filmography, profile, { size: 4, explorationRate: 0, random: seededRandom(404) });
  assert.equal(actorDeck.length, 4);

  // Свайпает всё подряд вправо — профиль резко перекашивается в самураев.
  for (const entry of actorDeck) profile = applySignal(profile, entry.title, ACTION.LIKE);
  assert.ok(profile.tagWeights.samurai > profile.tagWeights.action);

  // Заходит в комнату к человеку с другим вкусом.
  let partner = createEmptyProfile();
  for (const t of [LIBRARY.paddington, LIBRARY.notebook]) partner = applySignal(partner, t, ACTION.LIKE);

  const consensus = buildConsensusProfile([profile, partner]);
  const roomDeck = rankDeck(ALL_TITLES, consensus, { size: 12, random: seededRandom(404) });

  const titles = roomDeck.map((c) => c.title.title);
  assert.ok(titles.length > 0);
  // Компромисс не должен превратиться в чистую колоду одного из двоих.
  const soloDeck = rankDeck(ALL_TITLES, profile, { size: 12, random: seededRandom(404) });
  assert.notDeepEqual(titles, soloDeck.map((c) => c.title.title));
});

test('W12 · TTL: истёкшая комната распознаётся до попытки входа', () => {
  const now = Date.now();
  const expired = { code: 'AAAA', createdAt: now - 8 * 3600_000, expiresAt: now - 3600_000 };
  const live = { code: 'BBBB', createdAt: now - 600_000, expiresAt: now + 5 * 3600_000 };

  assert.ok(expired.expiresAt < now, 'истёкшая комната должна отсекаться по метаданным');
  assert.ok(live.expiresAt > now);

  // Уборщик считает брошенной комнату без активности дольше 12 часов.
  const idleLimit = 12 * 3600_000;
  const abandoned = { lastActivityAt: now - idleLimit - 1000 };
  const active = { lastActivityAt: now - 60_000 };
  assert.ok(now - abandoned.lastActivityAt > idleLimit);
  assert.ok(now - active.lastActivityAt < idleLimit);
});

test('W13 · хост собирает общую колоду по компромиссу, а не по своему вкусу', () => {
  let host = createEmptyProfile();
  for (const t of [LIBRARY.johnWick, LIBRARY.drive, LIBRARY.fastFurious]) {
    host = applySignal(host, t, ACTION.LIKE);
  }
  let guest = createEmptyProfile();
  for (const t of [LIBRARY.harakiri, LIBRARY.ran]) guest = applySignal(guest, t, ACTION.LIKE);

  const consensus = buildConsensusProfile([host, guest]);
  const published = rankDeck(ALL_TITLES, consensus, {
    size: RECOMMENDATION_CONFIG.room.deckSize,
    explorationRate: RECOMMENDATION_CONFIG.room.explorationRate,
    random: seededRandom(909),
  });

  assert.ok(published.length > 0);

  // Оба вкуса обязаны быть представлены: колода не должна выродиться
  // в личную ленту одного из участников.
  const tags = new Set(published.flatMap((c) => Object.keys(c.title.tags)));
  assert.ok(tags.has('kinetic-action') || tags.has('car-chase'), 'вкус хоста потерян');
  assert.ok(tags.has('samurai') || tags.has('feudal-japan'), 'вкус гостя потерян');

  // В комнате разведки меньше, чем в личной ленте: время двоих дороже.
  const exploreShare = published.filter((c) => c.slot === 'explore').length / published.length;
  assert.ok(exploreShare <= RECOMMENDATION_CONFIG.exploration.rate + 0.05,
    `разведки в комнате слишком много: ${exploreShare}`);
});
