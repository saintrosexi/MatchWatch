/**
 * Правила кино-рулетки.
 *
 * Состав барабана случаен, победитель — нет: на последней позиции, там
 * где лента останавливается, всегда стоит лучший по качеству из выбранной
 * десятки. Рулетка здесь не про азарт, а про то, чтобы снять с человека
 * необходимость выбирать — и при этом не подсунуть ему что попало.
 */

/** Сколько фильмов участвует в прокрутке. */
export const REEL_SIZE = 10;

/** Решения, после которых фильм в рулетке больше не участвует. */
const DECIDED = ['watched', 'dislike', 'later', 'favorite', 'like', 'match'];

/** Отбирает фильмы, про которые решение ещё не принято. */
export const rouletteCandidates = (pool, history = {}) =>
  (pool ?? []).filter((t) => t?.poster && !DECIDED.includes(history[t.id]));

/**
 * Собирает барабан.
 * @param {Array} candidates
 * @param {number} size
 * @param {() => number} random  источник случайности, подменяемый в тестах
 */
export function pickReel(candidates, size = REEL_SIZE, random = Math.random) {
  if (!candidates?.length) return [];

  const shuffled = [...candidates].sort(() => random() - 0.5).slice(0, size);
  if (shuffled.length < 2) return shuffled;

  const best = shuffled.reduce((a, b) => ((b.quality ?? 0) > (a.quality ?? 0) ? b : a));
  return [...shuffled.filter((t) => t.id !== best.id), best];
}
