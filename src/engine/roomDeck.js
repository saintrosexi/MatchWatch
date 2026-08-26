/**
 * Сборка совместной колоды.
 *
 * Колода комнаты строится по компромиссному профилю участников и
 * публикуется хостом — чтобы все свайпали ровно одни и те же карточки
 * в одном порядке. Иначе «мэтч» превращается в лотерею совпадения позиций.
 */

import { CatalogPool } from './catalog.js';
import { rankDeck } from './ranking.js';
import { buildMoodRequest, moodRequestFit, roomMoodFit } from '../../shared/config/moodPresets.js';
import { avoidancePenalty, mergeAvoided } from '../../shared/ai/interpretation.js';
import { getConfig } from './recommendationConfig.js';
import { trackBusiness } from '../lib/telemetry.js';
import { BIZ, MODULE } from '../../shared/telemetry/events.js';

/** Сколько страниц каталога готовы пролистать, добирая колоду. */
const MAX_REFILL_PAGES = 12;

/**
 * @param {object} options
 * @param {CatalogPool} [options.pool]
 *   Готовый пул от прошлой догрузки. Без него каждая следующая порция
 *   начиналась бы с нуля: новый пул, три сотни карточек, два десятка
 *   обогащений — и так на каждые двадцать пять фильмов. Переданный пул
 *   листается дальше с той страницы, где остановился, и порция стоит
 *   один-два запроса вместо двадцати.
 */
export async function buildRoomDeck({
  consensus, filters = {}, history = {}, excludeIds = [], size, signal, pool: reusablePool = null,
  /** Что участники выбрали на сегодня: массив массивов ключей чипов. */
  moodRequests = [],
  /**
   * Опоры всех участников, слитые в один список.
   *
   * Для комнаты это работает даже лучше, чем для одного человека: фильм,
   * похожий на любимое ЕГО, и фильм, похожий на любимое ЕЁ, оба попадают
   * наверх — вместо одного компромисса посередине, не похожего ни на что
   * из того, что любит хоть кто-то.
   */
  anchors = null,
} = {}) {
  const config = getConfig();
  const pool = reusablePool ?? new CatalogPool({ filters });

  if (!reusablePool) {
    await pool.fill(config.deck.candidatePool, { signal });

    // Точные теги важнее для компромисса, чем для личной ленты: тут ошибка
    // стоит времени двух человек, а не одного.
    await pool.enrich(pool.all.slice(0, 24).map((t) => t.id), { signal });
  }

  /*
   * Уже опубликованное в колоде исключается до ранжирования, а не после:
   * иначе следующая порция состоит из тех же карточек, что и предыдущая,
   * и колода «растёт», не прибавляя ни одного нового фильма.
   */
  const excluded = new Set(excludeIds);
  const target = size ?? config.room.deckSize;

  /*
   * Запрос на сегодня и накопленный вкус весят поровну.
   *
   * Человек, любящий триллеры, сегодня может хотеть комедию — подборка
   * обязана это услышать. Но и забыть, какие именно комедии ему заходят,
   * она не должна: одно настроение без вкуса выдаёт любую комедию подряд.
   */
  const requests = (moodRequests ?? []).map(buildMoodRequest).filter((r) => Object.keys(r.axes).length);
  const personal = requests.filter((r) => Object.keys(r.axes).length);

  const rank = () => {
    const candidates = pool.all.filter((t) => !excluded.has(t.id));
    const ranked = rankDeck(candidates, consensus, {
      loved: anchors?.loved,
      refused: anchors?.refused,
      config,
      history,
      size: requests.length ? Math.max(target * 3, target) : target,
      explorationRate: config.room.explorationRate,
    });

    if (!requests.length) return ranked.slice(0, target);
    return blendByMood(ranked, personal, target, config);
  };

  let ranked = rank();

  /*
   * Листаем каталог, пока порция не наберётся.
   *
   * У хоста, отсмотревшего сотню фильмов, из первой страницы выпадает
   * почти всё — и без добора вдвоём кино кончалось через пять карточек.
   * Потолок на число страниц за один заход нужен, чтобы одна догрузка
   * не выгребла полкаталога разом; следующая продолжит с того же места,
   * потому что пул переиспользуется.
   */
  let pages = 0;
  while (ranked.length < target && pages < MAX_REFILL_PAGES && !pool.exhausted) {
    pages += 1;
    const before = pool.size;
    await pool.loadMore({ signal });
    if (pool.size === before) break;
    ranked = rank();
  }

  if (ranked.length < target) {
    trackBusiness(BIZ.DECK_EMPTY_AFTER_FILTERS, {
      module: MODULE.ROOMS_SYNC,
      context: { poolSize: pool.size, deckSize: ranked.length, pages, ...filters },
    });
  }

  return { deck: ranked, pool };
}

/**
 * История комнаты: тайтлы, которые уже отсвайпаны или отмечены
 * «посмотрели», не должны попадать в новую колоду.
 */
export function roomHistory(roomState, uid) {
  const history = {};
  for (const [titleId, votes] of Object.entries(roomState?.swipes ?? {})) {
    if (votes?.[uid]) history[titleId] = votes[uid] === 'like' ? 'like' : 'dislike';
  }
  for (const item of Object.values(roomState?.watchlist ?? {})) {
    if (item.watched) history[item.titleId] = 'watched';
  }
  return history;
}

/**
 * Смешивает колоду под запросы участников.
 *
 * Большая часть — то, что устраивает всех: оценка идёт по тому, кому
 * фильм подходит хуже всего, потому что среднее вывело бы наверх серую
 * середину, не нравящуюся никому.
 *
 * Но одной справедливостью вечер не спасти: колода из сплошных
 * компромиссов выходит пресной. Поэтому каждому участнику достаётся
 * несколько карточек точно под его запрос — ярких, пусть и не общих.
 */
function blendByMood(ranked, requests, target, config) {
  const requestWeight = config.room.requestWeight ?? 0.5;
  const personalShare = config.room.personalMoodShare ?? 0.2;

  /*
   * Просьба чего-то избежать — общая: если один сказал «только не про
   * болезни», такой фильм плох для вечера обоих, и «зато второй не
   * возражал» тут не довод.
   *
   * Понижение, а не отсев: ниже жанрового слоя каталог размечен редко,
   * и жёсткий отсев по тегу выбросил бы заодно всё неразмеченное.
   */
  const avoided = mergeAvoided(requests);

  const scored = ranked.map((entry) => {
    const penalty = avoidancePenalty(entry.title.tags, avoided);
    return {
      entry,
      shared: (roomMoodFit(entry.title.moods, requests) ?? 0) * penalty,
      personal: requests.map((r) => (moodRequestFit(entry.title.moods, r) ?? 0) * penalty),
    };
  });

  // Общая часть: вкус комнаты и общее настроение поровну.
  const common = [...scored]
    .sort((a, b) => (b.entry.score * (1 - requestWeight) + b.shared * requestWeight)
      - (a.entry.score * (1 - requestWeight) + a.shared * requestWeight));

  const perPersonSlots = requests.length > 1
    ? Math.max(1, Math.round((target * personalShare) / requests.length))
    : 0;

  const picked = [];
  const used = new Set();

  const take = (item, slot) => {
    if (!item || used.has(item.entry.id)) return false;
    used.add(item.entry.id);
    picked.push({ ...item.entry, slot });
    return true;
  };

  // Сначала яркие карточки под каждого — иначе их вытеснит общая часть.
  requests.forEach((_, index) => {
    const mine = [...scored].sort((a, b) => b.personal[index] - a.personal[index]);
    let taken = 0;
    for (const item of mine) {
      if (taken >= perPersonSlots) break;
      if (take(item, 'mood-personal')) taken += 1;
    }
  });

  for (const item of common) {
    if (picked.length >= target) break;
    take(item, 'mood-shared');
  }

  /*
   * Личные карточки распределяются по колоде, а не лежат в её начале:
   * иначе первые ходы каждый делает по чужому запросу и решает, что
   * подборка не про него.
   */
  const shared = picked.filter((e) => e.slot === 'mood-shared');
  const mine = picked.filter((e) => e.slot === 'mood-personal');
  if (!mine.length) return shared.slice(0, target);

  const out = [];
  const step = Math.max(2, Math.floor(shared.length / (mine.length + 1)));
  let mineCursor = 0;

  shared.forEach((entry, index) => {
    out.push(entry);
    if ((index + 1) % step === 0 && mineCursor < mine.length) {
      out.push(mine[mineCursor++]);
    }
  });
  while (mineCursor < mine.length) out.push(mine[mineCursor++]);

  return out.slice(0, target);
}
