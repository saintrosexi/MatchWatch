/**
 * Уровень 1 — Feature Coverage.
 * Каждая заявленная возможность подтверждается хотя бы одной проверкой.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { normalizeTmdbMovie, buildTags, deriveMoodVector, makeTitleId, parseTitleId, titleStub, posterUrl } from '../shared/model/title.js';
import { normalizeRoomCode, generateRoomCode, roomPath, isValidRoomCode, ROOM_CODE_ALPHABET } from '../shared/model/roomCode.js';
import { TMDB_GENRES, GENRE_LIST } from '../shared/taxonomy/genres.js';
import { slugifyTag, TAG_EXPANSIONS, TAG_MOODS } from '../shared/taxonomy/tagOntology.js';
import { RECOMMENDATION_CONFIG, MOOD_AXES, NEUTRAL_MOOD } from '../shared/config/recommendation.js';
import { COLD_START_IDS, COLD_START_TITLES } from '../shared/config/coldStart.js';
import { BIZ, METRIC, MODULE, LEVEL, resolveEnvironment } from '../shared/telemetry/events.js';
import { parseDsn, createSentryTransport } from '../shared/telemetry/sentryTransport.js';
import { createEmptyProfile, applySignal, topTags, ACTION, isWarm } from '../src/engine/tasteProfile.js';
import { rankDeck, scoreTitle, buildConsensusProfile, cosineSimilarity, moodSimilarity } from '../src/engine/ranking.js';
import { validateInitData } from '../api/_lib/telegram.js';
import { createHmac } from 'node:crypto';
import { LIBRARY, ALL_TITLES, TMDB_RAW_MOVIE, makeTitle, seededRandom } from './helpers/fixtures.mjs';

test('F1 · каталог содержит только фильмы, но схема готова к другим категориям', () => {
  const title = normalizeTmdbMovie(TMDB_RAW_MOVIE);
  assert.equal(title.kind, 'movie');
  assert.ok(title.id.startsWith('tmdb:movie:'), 'id несёт источник и категорию');
  const parsed = parseTitleId(title.id);
  assert.deepEqual(parsed, { source: 'tmdb', kind: 'movie', externalId: '346' });
  // Добавление категории не требует смены формата id.
  assert.equal(makeTitleId(99, 'series'), 'tmdb:series:99');
});

test('F2 · нормализация TMDB заполняет всю внутреннюю схему', () => {
  const t = normalizeTmdbMovie(TMDB_RAW_MOVIE);
  assert.equal(t.title, 'Семь самураев');
  assert.equal(t.year, 1954);
  assert.equal(t.runtime, 207);
  assert.equal(t.rating, 8.5);
  assert.equal(t.language, 'ja');
  assert.deepEqual(t.countries, ['JP']);
  assert.equal(t.directors[0].name, 'Акира Куросава');
  assert.equal(t.cast[0].name, 'Тосиро Мифунэ');
  assert.equal(t.trailerKey, 'abc123');
  assert.ok(t.overview.length > 10);
});

test('F3 · постеры строятся от базового URL TMDB и имеют заглушку', () => {
  const t = normalizeTmdbMovie(TMDB_RAW_MOVIE);
  assert.match(t.poster, /^https:\/\/image\.tmdb\.org\/t\/p\/w500\//);
  assert.match(t.posterSmall, /w185/);
  assert.match(t.backdrop, /w780/);
  assert.equal(posterUrl(null), null, 'нет пути — нет URL, вызывающий покажет заглушку');
  const noPoster = normalizeTmdbMovie({ ...TMDB_RAW_MOVIE, poster_path: null, backdrop_path: null });
  assert.equal(noPoster.poster, null);
});

test('F4 · система тегов: keywords TMDB весят больше жанров', () => {
  const tags = buildTags({ genreIds: [28], keywords: ['samurai'] });
  assert.ok(tags.samurai > tags.action, 'узкий keyword должен перевешивать грубый жанр');
  assert.ok(tags.action > 0, 'жанр всё равно даёт фоновый вес');
});

test('F5 · обогащение тегов добавляет культурный контекст, которого нет в TMDB', () => {
  const tags = buildTags({ genreIds: [28], keywords: ['samurai'] });
  for (const derived of ['feudal-japan', 'honor-duty', 'period-action', 'sword-fight', 'japan']) {
    assert.ok(tags[derived] > 0, `ожидался производный тег ${derived}`);
  }
  assert.ok(tags['feudal-japan'] < tags.samurai, 'производный тег слабее исходного');
});

test('F6 · синонимы TMDB схлопываются в канонический тег', () => {
  assert.equal(slugifyTag('Sword Fight'), 'sword-fight');
  assert.equal(slugifyTag('swordplay'), 'sword-fight');
  assert.equal(slugifyTag('Ronin'), 'samurai');
  assert.equal(slugifyTag('World War II'), 'wwii');
  assert.equal(slugifyTag(''), null);
});

test('F7 · 5D-вектор настроения выводится из тегов и жанров', () => {
  const horror = deriveMoodVector({ tags: buildTags({ genreIds: [27], keywords: ['ghost', 'dread'] }), genreIds: [27] });
  const comedy = deriveMoodVector({ tags: buildTags({ genreIds: [35], keywords: ['slapstick'] }), genreIds: [35] });
  assert.ok(horror.darkness > comedy.darkness + 20, 'у хоррора мрак заметно выше');
  for (const axis of MOOD_AXES) {
    assert.ok(horror[axis] >= 0 && horror[axis] <= 100, `ось ${axis} в пределах 0..100`);
  }
});

test('F8 · шкала сигналов: избранное — единица, остальное относительно неё', () => {
  const base = createEmptyProfile();
  const { signals } = RECOMMENDATION_CONFIG;

  const favorited = applySignal(base, LIBRARY.sevenSamurai, ACTION.FAVORITE);
  const watched = applySignal(base, LIBRARY.sevenSamurai, ACTION.WATCHED);
  const wished = applySignal(base, LIBRARY.sevenSamurai, ACTION.LATER);

  const tag = 'samurai';
  const near = (a, b) => Math.abs(a - b) < 0.02;

  // Соотношения проверяем по конфигу, а не по числам в тесте: тюнинг весов
  // должен описываться проверкой, а не ломать её.
  assert.ok(near(favorited.tagWeights[tag] / watched.tagWeights[tag], signals.favorite / signals.watched),
    'избранное должно относиться к просмотру ровно как в конфиге');
  assert.ok(near(favorited.tagWeights[tag] / wished.tagWeights[tag], signals.favorite / signals.later),
    'избранное должно относиться к желаемому ровно как в конфиге');
  assert.ok(watched.tagWeights[tag] > wished.tagWeights[tag],
    'просмотр — более сильный сигнал, чем намерение посмотреть');

  const disliked = applySignal(watched, LIBRARY.sevenSamurai, ACTION.DISLIKE);
  assert.ok(disliked.tagWeights[tag] < watched.tagWeights[tag], '«мимо» снижает вес');
  assert.ok(disliked.tagWeights[tag] > 0, 'но не обнуляет его');
});

test('F8a · слабые сигналы переживают отсечение мелких весов', () => {
  // Вклад тега равен весу действия, умноженному на его долю в фильме.
  // Если порог отсечения окажется выше самого слабого сигнала, обучение
  // будет молча стираться в момент записи — именно так и было при
  // pruneBelow 0.08 и «желаемое ×0.1».
  const total = Object.keys(LIBRARY.sevenSamurai.tags).length;

  for (const action of [ACTION.FAVORITE, ACTION.WATCHED, ACTION.LATER]) {
    const profile = applySignal(createEmptyProfile(), LIBRARY.sevenSamurai, action);
    assert.equal(Object.keys(profile.tagWeights).length, total,
      `действие ${action} потеряло часть тегов на пороге отсечения`);
  }

  const weakest = Math.min(RECOMMENDATION_CONFIG.signals.later, RECOMMENDATION_CONFIG.signals.watched);
  assert.ok(RECOMMENDATION_CONFIG.decay.pruneBelow < weakest * 0.2,
    'порог отсечения должен быть заметно ниже самого слабого сигнала');
});

test('F9 · ранжирование поднимает узкую тему, а не общий жанр (кейс из ТЗ)', () => {
  let profile = createEmptyProfile();
  for (const t of [LIBRARY.sevenSamurai, LIBRARY.yojimbo, LIBRARY.harakiri]) {
    profile = applySignal(profile, t, ACTION.LIKE);
  }

  const samuraiScore = scoreTitle(LIBRARY.thirteenAssassins, profile).score;
  const genericAction = scoreTitle(LIBRARY.fastFurious, profile).score;
  const otherAction = scoreTitle(LIBRARY.johnWick, profile).score;

  assert.ok(samuraiScore > genericAction * 1.8,
    'самурайское кино должно резко обгонять «просто боевик»');
  assert.ok(samuraiScore > otherAction * 1.8);
  assert.ok(scoreTitle(LIBRARY.ran, profile).tagScore > 0.4, 'близкая тема тоже подхватывается');
});

test('F10 · exploration подмешивает разведочные карточки', () => {
  let profile = createEmptyProfile();
  for (let i = 0; i < 30; i += 1) profile = applySignal(profile, LIBRARY.sevenSamurai, ACTION.LIKE);

  const deck = rankDeck(ALL_TITLES, profile, { size: 12, random: seededRandom(7) });
  const explore = deck.filter((c) => c.slot === 'explore');
  assert.ok(explore.length >= 1, 'в прогретой колоде обязана быть разведка');
  assert.ok(explore.length <= deck.length * 0.5, 'но она не должна доминировать');
});

test('F11 · комнаты: единый формат кода для создания, ввода и ссылок', () => {
  for (let i = 0; i < 200; i += 1) {
    const code = generateRoomCode();
    assert.equal(code.length, 4);
    assert.equal(normalizeRoomCode(code), code, 'сгенерированный код должен быть каноничным');
    assert.ok([...code].every((c) => ROOM_CODE_ALPHABET.includes(c)));
  }
  assert.equal(normalizeRoomCode(' qw3r '), 'QW3R');
  assert.equal(normalizeRoomCode('https://t.me/bot/app?startapp=QW3R'), 'QW3R');
  assert.equal(normalizeRoomCode('https://mw.app/?room=qw3r'), 'QW3R');
  assert.equal(roomPath('qw3r', 'members'), 'rooms/QW3R/members');
});

test('F12 · компромиссный вектор комнаты бустит общие темы, а не усредняет', () => {
  let alice = createEmptyProfile();
  let bob = createEmptyProfile();
  for (const t of [LIBRARY.sevenSamurai, LIBRARY.harakiri]) alice = applySignal(alice, t, ACTION.LIKE);
  for (const t of [LIBRARY.ocean11, LIBRARY.inception]) bob = applySignal(bob, t, ACTION.LIKE);
  // Общая тема у обоих — ограбления.
  alice = applySignal(alice, LIBRARY.ocean11, ACTION.LIKE);

  const consensus = buildConsensusProfile([alice, bob]);
  assert.ok(consensus.tagWeights.heist > 0, 'общая тема сохранена');
  assert.ok(consensus.tagWeights.heist > consensus.tagWeights.samurai,
    'тема, важная обоим, должна перевешивать тему одного участника');
  assert.equal(consensus.consensusOf, 2);
});

test('F13 · Star Hub: фильмография ранжируется под личный вкус', () => {
  let profile = createEmptyProfile();
  profile = applySignal(profile, LIBRARY.sevenSamurai, ACTION.FAVORITE);
  const deck = rankDeck([LIBRARY.notebook, LIBRARY.ran, LIBRARY.paddington], profile, {
    size: 3, explorationRate: 0, random: seededRandom(3),
  });
  assert.equal(deck[0].title.title, 'Ран');
});

test('F14 · Telegram initData проверяется по подписи', () => {
  const botToken = '123456:TEST-TOKEN';
  const user = JSON.stringify({ id: 777, first_name: 'Аня', username: 'anya' });
  const authDate = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({ auth_date: String(authDate), user, start_param: 'QW3R' });

  const dataCheckString = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'));

  const result = validateInitData(params.toString(), { botToken });
  assert.equal(result.telegramId, '777');
  assert.equal(result.user.firstName, 'Аня');
  assert.equal(result.startParam, 'QW3R');
});

test('F15 · подделанный initData отклоняется', () => {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 1 }),
    hash: 'deadbeef'.repeat(8),
  });
  assert.throws(() => validateInitData(params.toString(), { botToken: '123:TOKEN' }), /подпись/i);
});

test('F14a · стартовый набор поднимается только пока профиль холодный', () => {
  const seed = makeTitle(COLD_START_IDS[0], 'Из набора');
  const other = makeTitle(999999, 'Обычный');

  const cold = createEmptyProfile();
  const seedCold = scoreTitle(seed, cold).score;
  const otherCold = scoreTitle(other, cold).score;
  assert.ok(seedCold > otherCold,
    'на холодном старте набор обязан обгонять равный по качеству фильм');

  // Прогретый профиль: набор больше не поднимается, иначе торчал бы вечно.
  let warm = createEmptyProfile();
  for (let i = 0; i < 60; i += 1) {
    warm = applySignal(warm, { tags: { drama: 1 }, moods: NEUTRAL_MOOD }, ACTION.FAVORITE);
  }
  assert.ok(isWarm(warm), 'профиль должен прогреться');
  assert.equal(scoreTitle(seed, warm).score, scoreTitle(other, warm).score,
    'после прогрева набор не должен иметь преимущества');
});

test('F14b · стартовый набор разводит по осям, а не повторяется', () => {
  assert.equal(COLD_START_IDS.length, new Set(COLD_START_IDS).size, 'дубликаты в наборе');
  assert.ok(COLD_START_IDS.length >= 12 && COLD_START_IDS.length <= 20,
    'набор должен оставаться коротким: это редакторский список, а не выборка');
  for (const item of COLD_START_TITLES) {
    assert.ok(item.note?.length > 3, `у ${item.id} нет пояснения, зачем он в наборе`);
  }
});

test('F16 · словарь телеметрии покрывает бизнес-сбои из ТЗ', () => {
  for (const required of ['ROOM_NOT_FOUND', 'SWIPE_RACE_RETRY', 'TMDB_EMPTY_RESULT',
    'TMDB_RATE_LIMITED', 'DB_POLICY_DENIED', 'TELEGRAM_INITDATA_INVALID']) {
    assert.ok(BIZ[required], `нет бизнес-события ${required}`);
  }
  for (const required of ['ROOM_CREATED', 'SWIPE', 'MATCH', 'ROOM_INVITE_SENT']) {
    assert.ok(METRIC[required], `нет метрики ${required}`);
  }
  assert.ok(Object.values(MODULE).includes('rooms.create'));
  assert.ok(Object.values(MODULE).includes('tmdb.proxy'));
  assert.ok(Object.values(MODULE).includes('auth.telegram-init-data'));
  assert.ok(Object.values(MODULE).includes('swipe.match-calc'));
  assert.ok(Object.values(MODULE).includes('db.rls-policy'));
  assert.deepEqual(Object.values(LEVEL).sort(), ['critical', 'error', 'info', 'warning']);
});

test('F17 · Sentry-транспорт разбирает DSN и молчит без него', async () => {
  const parsed = parseDsn('https://abc123@o1.ingest.sentry.io/42');
  assert.equal(parsed.projectId, '42');
  assert.match(parsed.envelopeUrl, /\/api\/42\/envelope\/\?sentry_key=abc123/);

  const disabled = createSentryTransport({ dsn: null });
  assert.equal(disabled.enabled, false);
  assert.equal(await disabled.capture({ message: 'x' }), false, 'без DSN отправка не падает');
});

test('F18 · окружения разделены', () => {
  assert.equal(resolveEnvironment('prod'), 'prod');
  assert.equal(resolveEnvironment(), 'dev', 'в node без хоста и NODE_ENV=production — dev');
});

test('F19 · конфиг рекомендаций вынесен целиком, без хардкода в логике', () => {
  const c = RECOMMENDATION_CONFIG;
  assert.ok(c.blend.tagWeight > 0 && c.blend.moodWeight > 0 && c.blend.qualityWeight > 0);
  assert.ok(c.signals.favorite > c.signals.watched, 'избранное весит больше просмотра');
  assert.ok(c.signals.dislike < 0);
  assert.ok(c.exploration.rate > 0 && c.exploration.rate < 0.5);
  assert.ok(c.room.sharedTagBoost > 1, 'общие темы бустятся, а не размываются');
  assert.equal(c.penalties.disliked, 0);
  assert.equal(c.penalties.watched, 0);

  // Ни один исходник продукта не должен хардкодить магические веса смешивания.
  const ranking = readFileSync(new URL('../src/engine/ranking.js', import.meta.url), 'utf8');
  assert.ok(!/0\.5\s*\*\s*tagScore/.test(ranking));
  assert.ok(ranking.includes('config.blend'), 'ранжирование читает веса из конфига');
});

test('F20 · сборка и обязательные артефакты на месте', () => {
  const root = new URL('../', import.meta.url);
  for (const file of ['package.json', 'vite.config.js', 'vercel.json',
    'index.html', '.env.example', 'api/tmdb/catalog.js', 'api/auth/telegram.js',
    'api/ops/events.js', 'api/ops/rooms-gc.js', 'api/ops/digest.js',
    'supabase/migrations', 'src/lib/supabase.js', 'api/_lib/supabaseAdmin.js']) {
    assert.ok(existsSync(new URL(file, root)), `нет файла ${file}`);
  }

  const vercel = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'));
  assert.ok(vercel.crons.some((c) => c.path === '/api/ops/rooms-gc'), 'TTL-уборка комнат по крону');
  assert.ok(vercel.crons.some((c) => c.path === '/api/ops/digest'), 'еженедельная сводка ошибок');

  // Ключ TMDB и service_role не должны просачиваться в клиентский код.
  const clientEnv = readFileSync(new URL('src/lib/env.js', root), 'utf8');
  assert.ok(!/TMDB/i.test(clientEnv), 'ключ TMDB не имеет права попасть в браузер');
  assert.ok(!/SERVICE_ROLE/i.test(clientEnv), 'service_role-ключ не имеет права попасть в браузер');

  // Серверный модуль с service_role не должен импортироваться клиентом.
  const clientFiles = execSync('find src -name "*.js" -o -name "*.jsx"', { cwd: fileURLToPath(root) })
    .toString().trim().split('\n');
  for (const file of clientFiles) {
    const source = readFileSync(new URL(file, root), 'utf8');
    assert.ok(!source.includes('supabaseAdmin'),
      `${file} импортирует серверный supabaseAdmin — это утечка service_role в браузер`);
  }
});

test('F21 · жанры TMDB замаплены и переведены', () => {
  assert.equal(TMDB_GENRES[28].ru, 'Боевик');
  assert.equal(TMDB_GENRES[878].ru, 'Фантастика');
  assert.ok(GENRE_LIST.length >= 18);
  assert.ok(!GENRE_LIST.some((g) => g.slug === 'tv-movie'), 'ТВ-фильмы скрыты из фильтра');
});

test('F22 · косинус и близость настроений ведут себя как метрики', () => {
  assert.equal(cosineSimilarity({}, { a: 1 }), 0);
  assert.equal(cosineSimilarity({ a: 1 }, {}), 0);
  const same = cosineSimilarity({ a: 10, b: 5 }, { a: 10, b: 5 });
  assert.ok(Math.abs(same - 1) < 1e-9, 'идентичные векторы дают 1');
  assert.equal(moodSimilarity(null, null), 0.5);
  const identical = moodSimilarity({ energy: 70 }, { energy: 70 });
  assert.ok(identical > 0.99);
});

test('F23 · titleStub отдаёт компактную карточку для комнат и списков', () => {
  const stub = titleStub(LIBRARY.inception);
  assert.deepEqual(Object.keys(stub).sort(), ['id', 'poster', 'rating', 'title', 'year']);
  assert.equal(titleStub(null), null);
});

test('F24 · онтология тегов согласована сама с собой', () => {
  for (const [source, expansions] of Object.entries(TAG_EXPANSIONS)) {
    assert.ok(Array.isArray(expansions) && expansions.length, `пустое расширение для ${source}`);
    for (const [tag, factor] of expansions) {
      assert.ok(typeof tag === 'string' && tag.length > 1, `плохой производный тег у ${source}`);
      assert.ok(factor > 0 && factor <= 1, `коэффициент ${source}->${tag} вне (0,1]`);
    }
  }
  for (const [tag, moods] of Object.entries(TAG_MOODS)) {
    for (const [axis, value] of Object.entries(moods)) {
      assert.ok(MOOD_AXES.includes(axis), `неизвестная ось ${axis} у тега ${tag}`);
      assert.ok(value >= -50 && value <= 50, `вклад ${tag}.${axis} вне -50..50`);
    }
  }
});

test('F25 · франшиза даёт цепочку тегов убывающего веса', async () => {
  const { franchiseTags, FRANCHISES, FRANCHISE_WEIGHT, UNIVERSE_WEIGHT, THEME_WEIGHT } =
    await import('../shared/taxonomy/franchises.js');

  // Пример из постановки задачи: «Человек-паук» обязан активировать
  // и других пауков, и Marvel, и супергероику — но с разным весом.
  const spider = franchiseTags({ collectionId: 531241 });
  assert.equal(spider['spider-man'], FRANCHISE_WEIGHT, 'сама франшиза — сильнейший сигнал');
  assert.equal(spider.mcu, UNIVERSE_WEIGHT);
  assert.equal(spider.marvel, UNIVERSE_WEIGHT);
  assert.equal(spider.superhero, THEME_WEIGHT, 'широкая тема слабее вселенной');
  assert.ok(spider['spider-man'] > spider.marvel && spider.marvel > spider.superhero,
    'вес должен убывать от конкретного к общему');

  // Разные экранизации одного героя ведут на один слаг: иначе трилогия
  // Рэйми и версия MCU считались бы разными вещами.
  for (const id of [556, 225941, 531241, 573436]) {
    assert.equal(FRANCHISES[id].slug, 'spider-man', `коллекция ${id} должна вести на spider-man`);
  }

  // Незнакомая франшиза всё равно связывает свои части между собой.
  const unknown = franchiseTags({ collectionId: 999999 });
  assert.equal(unknown['collection-999999'], FRANCHISE_WEIGHT);
});

test('F26 · режиссёр даёт собственный тег и стилевые признаки', async () => {
  const { franchiseTags, DIRECTOR_WEIGHT, DIRECTOR_STYLE_WEIGHT } =
    await import('../shared/taxonomy/franchises.js');

  const nolan = franchiseTags({ directorIds: [525] });
  assert.equal(nolan.nolan, DIRECTOR_WEIGHT);
  assert.equal(nolan['mind-bending'], DIRECTOR_STYLE_WEIGHT);
  assert.ok(nolan.nolan > nolan['mind-bending'],
    'сам автор — более точный сигнал, чем его приёмы');

  const tarantino = franchiseTags({ directorIds: [138] });
  assert.equal(tarantino.tarantino, DIRECTOR_WEIGHT);
  assert.ok(tarantino['nonlinear'] && tarantino['stylized-violence']);
});

test('F27 · лайк франшизы поднимает родственные фильмы в нужном порядке', async () => {
  const { buildTags, deriveMoodVector } = await import('../shared/model/title.js');
  const { createEmptyProfile, applySignal, ACTION } = await import('../src/engine/tasteProfile.js');
  const { scoreTitle } = await import('../src/engine/ranking.js');

  const mk = (id, title, collectionId, directorIds = [], genres = [28]) => {
    const tags = buildTags({ genreIds: genres, keywords: [], collectionId, directorIds });
    return { id: `tmdb:movie:${id}`, title, tags, moods: deriveMoodVector({ tags, genreIds: genres }), quality: 0.75 };
  };

  const spiderRaimi = mk(1, 'Человек-паук', 556);
  const spiderMcu = mk(2, 'Человек-паук: Нет пути домой', 531241);
  const avengers = mk(3, 'Мстители', 86311);
  const batman = mk(4, 'Бэтмен', 120794);
  const rocky = mk(5, 'Рокки', 1575);

  const profile = applySignal(createEmptyProfile(), spiderRaimi, ACTION.FAVORITE);
  const score = (t) => scoreTitle(t, profile).score;

  assert.ok(score(spiderMcu) > score(avengers), 'другой «паук» ближе, чем просто Marvel');
  assert.ok(score(avengers) > score(batman), 'Marvel ближе, чем DC');
  assert.ok(score(batman) > score(rocky), 'супергероика ближе, чем спорт');
});

test('F28 · рулетка крутит десятку, а побеждает лучший по качеству', async () => {
  const { pickReel } = await import('../src/engine/roulette.js');

  // Качество у всех разное: при ничьей «лучший» неоднозначен, и проверять
  // тогда нечего.
  const films = Array.from({ length: 40 }, (_, i) => ({
    id: `tmdb:movie:${i}`,
    title: `Фильм ${i}`,
    quality: i / 40,
  }));

  // Прогоняем несколько раз: состав случаен, инвариант — нет.
  for (let seed = 1; seed <= 5; seed += 1) {
    const reel = pickReel(films, 10, seededRandom(seed));

    assert.equal(reel.length, 10, 'в барабане ровно десять фильмов');
    assert.equal(new Set(reel.map((t) => t.id)).size, 10, 'без повторов');

    const maxQuality = Math.max(...reel.map((t) => t.quality));
    assert.equal(reel[reel.length - 1].quality, maxQuality,
      'на последней позиции — там, где останавливается лента, — должен стоять лучший');
  }

  // Меньше двух фильмов крутить нечего, но падать тоже нельзя.
  assert.deepEqual(pickReel([], 10), []);
  assert.equal(pickReel([films[0]], 10).length, 1);
});
