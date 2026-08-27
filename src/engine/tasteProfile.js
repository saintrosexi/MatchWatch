/**
 * Профиль вкуса пользователя.
 *
 * Две независимые проекции одного вкуса:
 *   tagWeights — накопленные веса по тегам (узкие темы: samurai, heist…);
 *
 * Ключевое из ТЗ: сигналы неравноценны. Лайк даёт базовый вес, избранное —
 * заметно больше (это явное «хочу», а не «ладно, свайпну вправо»), дизлайк
 * слегка снижает. Все множители — в RECOMMENDATION_CONFIG.signals, не здесь.
 */

import { MOOD_AXES, NEUTRAL_MOOD, RECOMMENDATION_CONFIG } from '../../shared/config/recommendation.js';
import { isColdStartTitle } from '../../shared/config/coldStart.js';

export const ACTION = Object.freeze({
  /** Свайп вправо: «смотрел и понравилось». Это же и есть «просмотрено». */
  LIKE: 'like',
  DISLIKE: 'dislike',
  FAVORITE: 'favorite',
  /** Отложено на потом: интерес есть, но фильм ещё не смотрели. */
  LATER: 'later',
  WATCHED: 'watched',
  MATCH: 'match',
  INSPECT: 'inspect',
});

export function createEmptyProfile() {
  return {
    version: RECOMMENDATION_CONFIG.version,
    tagWeights: {},
    counts: { like: 0, dislike: 0, favorite: 0, later: 0, watched: 0, match: 0, inspect: 0, rated: 0 },
    signals: 0,
    updatedAt: Date.now(),
  };
}

const isProfile = (p) => p && typeof p === 'object' && p.tagWeights && typeof p.tagWeights === 'object';

/** Профиль из базы может быть частичным или устаревшей версии — чиним на чтении. */
export function hydrateProfile(raw) {
  if (!isProfile(raw)) return createEmptyProfile();
  const base = createEmptyProfile();
  return {
    ...base,
    ...raw,
    tagWeights: { ...raw.tagWeights },
    counts: { ...base.counts, ...(raw.counts ?? {}) },
  };
}

/**
 * Применяет сигнал пользователя к профилю. Возвращает НОВЫЙ профиль —
 * мутации ломают сравнение в React и делают историю неотслеживаемой.
 */
export function applySignal(profile, title, action, { config = RECOMMENDATION_CONFIG, now = Date.now() } = {}) {
  const current = hydrateProfile(profile);
  const base = config.signals[action];
  if (!Number.isFinite(base) || !title) return current;

  /*
   * Ответ на калибровочный фильм весит больше обычного.
   *
   * Пока профиль пуст, эти полтора десятка реакций — единственное, на чём
   * строится лента. Набор подобран по непохожести, поэтому «да» комедии
   * и «нет» космической драме говорят о вкусе больше, чем десяток
   * реакций на соседние боевики. После прогрева множитель снимается:
   * иначе первые ответы навсегда перевесили бы всё сказанное потом.
   */
  const calibrating = !isWarm(current, config) && isColdStartTitle(title);
  const weight = calibrating
    ? base * config.exploration.coldStartSignalBoost
    : base;

  const tagWeights = { ...current.tagWeights };
  const maxTagWeight = Math.max(1, ...Object.values(title.tags ?? {}));

  for (const [tag, titleWeight] of Object.entries(title.tags ?? {})) {
    // Вклад пропорционален тому, насколько тег характерен ДЛЯ ЭТОГО фильма:
    // случайный слабый keyword не должен весить как центральная тема.
    const relative = titleWeight / maxTagWeight;
    const delta = weight * relative;
    const next = (tagWeights[tag] ?? 0) * config.decay.perSignal + delta;
    tagWeights[tag] = Math.round(next * 1000) / 1000;
  }

  /*
   * Вектора настроения у человека больше нет.
   *
   * Он был усреднением всего вкуса в одну точку, а усреднение и есть
   * диагноз: любящий «Брата» и «Кин-дза-дзу» получал центр между ними
   * и подборку, не похожую ни на один из двух. Место этого сигнала
   * заняла близость к конкретным любимым фильмам.
   */

  const counts = { ...current.counts, [action]: (current.counts[action] ?? 0) + 1 };

  return pruneProfile({
    ...current,
    tagWeights,
    counts,
    signals: current.signals + 1,
    updatedAt: now,
  }, config);
}

/**
 * Применяет оценку фильма к профилю вкуса.
 *
 * Оценка отличается от свайпа тем, что она двусторонняя и градуированная:
 * десятка тянет теги вверх сильнее любого лайка, единица — вниз. Центр
 * шкалы задан конфигом, а не жёстко: «шесть из десяти» у разных людей
 * означает разное, и это стоит уметь подкрутить.
 */
export function applyRating(profile, title, rating, { config = RECOMMENDATION_CONFIG, now = Date.now() } = {}) {
  const current = hydrateProfile(profile);
  const value = Number(rating);
  if (!Number.isFinite(value) || value < 1 || value > config.rating.max) return current;

  const weight = ((value - config.rating.neutral) / (config.rating.max - config.rating.neutral))
    * config.rating.scale;

  const tagWeights = { ...current.tagWeights };
  const maxTagWeight = Math.max(1, ...Object.values(title.tags ?? {}));

  for (const [tag, titleWeight] of Object.entries(title.tags ?? {})) {
    const relative = titleWeight / maxTagWeight;
    const next = (tagWeights[tag] ?? 0) * config.decay.perSignal + weight * relative;
    tagWeights[tag] = Math.round(next * 1000) / 1000;
  }


  return pruneProfile({
    ...current,
    tagWeights,
    counts: { ...current.counts, rated: (current.counts.rated ?? 0) + 1 },
    signals: current.signals + 1,
    updatedAt: now,
  }, config);
}

/** Убирает шум: слабые теги и переполнение словаря. */
export function pruneProfile(profile, config = RECOMMENDATION_CONFIG) {
  const entries = Object.entries(profile.tagWeights)
    .filter(([, w]) => Math.abs(w) >= config.decay.pruneBelow)
    .sort(([, a], [, b]) => b - a)
    .slice(0, config.decay.maxTags);
  return { ...profile, tagWeights: Object.fromEntries(entries) };
}

/**
 * Ленивое старение: прошлогодние вкусы не должны весить как вчерашние.
 * Применяется при чтении профиля, а не по таймеру, — так не нужен воркер.
 */
export function decayProfile(profile, { config = RECOMMENDATION_CONFIG, now = Date.now() } = {}) {
  const current = hydrateProfile(profile);
  const days = (now - (current.updatedAt ?? now)) / 86_400_000;
  if (days < 1) return current;

  const factor = 0.5 ** (days / config.decay.halfLifeDays);
  const tagWeights = {};
  for (const [tag, w] of Object.entries(current.tagWeights)) {
    const next = Math.round(w * factor * 1000) / 1000;
    if (Math.abs(next) >= config.decay.pruneBelow) tagWeights[tag] = next;
  }
  return { ...current, tagWeights, updatedAt: now };
}

/** Прогрет ли профиль настолько, чтобы ему доверять. */
export function isWarm(profile, config = RECOMMENDATION_CONFIG) {
  return hydrateProfile(profile).signals >= config.exploration.warmupSignals;
}

/** Топ-теги для показа в профиле и для объяснения «почему это в ленте». */
export function topTags(profile, limit = 12) {
  return Object.entries(hydrateProfile(profile).tagWeights)
    .filter(([, w]) => w > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([tag, weight]) => ({ tag, weight: Math.round(weight * 100) / 100 }));
}

/** Насколько профиль «разнообразен»: 0 — одна тема, 1 — широкий кругозор. */
export function profileBreadth(profile) {
  const weights = Object.values(hydrateProfile(profile).tagWeights).filter((w) => w > 0);
  if (weights.length < 2) return 0;
  const total = weights.reduce((a, b) => a + b, 0);
  const entropy = -weights.reduce((acc, w) => {
    const p = w / total;
    return acc + p * Math.log(p);
  }, 0);
  return Math.min(1, Math.round((entropy / Math.log(weights.length)) * 100) / 100);
}

/** Сериализация под запись в базу: без undefined и без NaN. */
export function serializeProfile(profile) {
  const p = hydrateProfile(profile);
  return {
    version: p.version,
    tagWeights: Object.fromEntries(
      Object.entries(p.tagWeights).filter(([, w]) => Number.isFinite(w)),
    ),
    counts: p.counts,
    signals: p.signals,
    updatedAt: p.updatedAt,
  };
}
