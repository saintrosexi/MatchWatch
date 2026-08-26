/**
 * Правила кино-рулетки.
 *
 * Рулетка снимает с человека необходимость выбирать. Но случайность
 * из всего каталога — это лотерея, где чаще всего выпадает то, что
 * смотреть не станут. Поэтому барабан набирается не из чего попало,
 * а из фильмов с самой любимой темой пользователя — и уже внутри этой
 * десятки случайность честная, включая победителя.
 *
 * Раньше победитель был предопределён: на последнее место всегда вставал
 * лучший по качеству. Это не рулетка, а рекомендация с барабаном —
 * и при повторных запусках она выдавала одно и то же.
 */

import { topTags } from './tasteProfile.js';

/** Сколько фильмов участвует в прокрутке. */
export const REEL_SIZE = 10;

/**
 * Во сколько раз шире отбираем по любимой теме, прежде чем тянуть жребий.
 * Ровно десять оставили бы рулетку без случайности: те же фильмы каждый
 * раз, просто в другом порядке.
 */
const POOL_FACTOR = 4;

/** Решения, после которых фильм в рулетке больше не участвует. */
const DECIDED = ['watched', 'dislike', 'later', 'favorite', 'like', 'match'];

/** Отбирает фильмы, про которые решение ещё не принято. */
export const rouletteCandidates = (pool, history = {}) =>
  (pool ?? []).filter((t) => t?.poster && !DECIDED.includes(history[t.id]));

/**
 * Честная перетасовка (Фишер — Йетс).
 *
 * `sort(() => random() - 0.5)` перемешивает неравномерно: компаратор
 * непоследователен, и распределение зависит от алгоритма сортировки.
 * Для рулетки, где случайность — весь смысл, это недопустимо.
 */
function shuffle(items, random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Самая тяжёлая тема профиля. Null, пока человек ничего не насвайпал. */
export function favouriteTag(taste) {
  return topTags(taste, 1)[0]?.tag ?? null;
}

/**
 * Собирает барабан.
 *
 * @param {Array} candidates фильмы, про которые решение ещё не принято
 * @param {object} options
 * @param {number} options.size сколько фильмов крутится
 * @param {object} options.taste профиль вкуса — из него берётся любимая тема
 * @param {() => number} options.random источник случайности, подменяемый в тестах
 */
export function pickReel(candidates, { size = REEL_SIZE, taste = null, random = Math.random } = {}) {
  if (!candidates?.length) return [];

  const tag = taste ? favouriteTag(taste) : null;

  /*
   * Отбор по любимой теме: чем сильнее она выражена в фильме, тем выше
   * он в очереди на барабан. Берём вчетверо больше нужного и уже оттуда
   * тянем жребий — иначе «случайность» сводилась бы к перестановке
   * одних и тех же десяти карточек.
   */
  let pool = candidates;
  if (tag) {
    const matching = candidates
      .filter((t) => (t.tags?.[tag] ?? 0) > 0)
      .sort((a, b) => (b.tags[tag] ?? 0) - (a.tags[tag] ?? 0))
      .slice(0, size * POOL_FACTOR);

    // Любимой темы может не оказаться ни у кого из доступных — тогда
    // крутим что есть, это лучше пустого барабана.
    if (matching.length >= size) pool = matching;
  }

  const reel = shuffle(pool, random).slice(0, size);
  if (reel.length < 2) return reel;

  // Победитель — последний в ленте, и он тоже случаен: барабан уже
  // перетасован честно, так что достаточно ничего не переставлять.
  return reel;
}
