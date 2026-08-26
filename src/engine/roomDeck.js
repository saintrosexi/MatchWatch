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

export async function buildRoomDeck({ consensus, filters = {}, history = {}, signal } = {}) {
  const config = getConfig();
  const pool = new CatalogPool({ filters });

  await pool.fill(config.deck.candidatePool, { signal });

  // Точные теги важнее для компромисса, чем для личной ленты: тут ошибка
  // стоит времени двух человек, а не одного.
  await pool.enrich(pool.all.slice(0, 24).map((t) => t.id), { signal });

  const rank = () => rankDeck(pool.all, consensus, {
    config,
    history,
    size: config.room.deckSize,
    explorationRate: config.room.explorationRate,
  });

  let ranked = rank();

  /*
   * Колода комнаты собирается один раз и потом не пополняется: все
   * свайпают ровно один список в одном порядке. Значит она обязана быть
   * полной сразу. У хоста, отсмотревшего сотню фильмов, из первой
   * страницы каталога выпадает почти всё — и вдвоём кино кончалось через
   * пять карточек. Листаем каталог, пока колода не наберётся.
   */
  let pages = 0;
  while (ranked.length < config.room.deckSize && pages < MAX_REFILL_PAGES && !pool.exhausted) {
    pages += 1;
    const before = pool.size;
    await pool.loadMore({ signal });
    if (pool.size === before) break;
    ranked = rank();
  }

  if (ranked.length < config.room.deckSize) {
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
