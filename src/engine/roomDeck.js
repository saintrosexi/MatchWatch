/**
 * Сборка совместной колоды.
 *
 * Колода комнаты строится по компромиссному профилю участников и
 * публикуется хостом — чтобы все свайпали ровно одни и те же карточки
 * в одном порядке. Иначе «мэтч» превращается в лотерею совпадения позиций.
 */

import { CatalogPool } from './catalog.js';
import { rankDeck } from './ranking.js';
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

  const rank = () => rankDeck(pool.all.filter((t) => !excluded.has(t.id)), consensus, {
    config,
    history,
    size: target,
    explorationRate: config.room.explorationRate,
  });

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
