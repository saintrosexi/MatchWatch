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

export async function buildRoomDeck({ consensus, filters = {}, history = {}, signal } = {}) {
  const config = getConfig();
  const pool = new CatalogPool({ filters });

  await pool.fill(config.deck.candidatePool, { signal });

  // Точные теги важнее для компромисса, чем для личной ленты: тут ошибка
  // стоит времени двух человек, а не одного.
  await pool.enrich(pool.all.slice(0, 24).map((t) => t.id), { signal });

  const ranked = rankDeck(pool.all, consensus, {
    config,
    history,
    size: config.room.deckSize,
    explorationRate: config.room.explorationRate,
  });

  if (!ranked.length) {
    trackBusiness(BIZ.DECK_EMPTY_AFTER_FILTERS, {
      module: MODULE.ROOMS_SYNC, context: { poolSize: pool.size, ...filters },
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
