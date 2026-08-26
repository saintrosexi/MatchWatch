/**
 * Близость к любимому — вместо близости к среднему.
 *
 * Прежняя модель усредняла весь вкус в одну точку и искала фильмы рядом
 * с ней. Это математически обречено на серость: человек, любящий и
 * «Брата» (мрак 80), и «Кин-дза-дзу» (мрак 40), получал центр в районе
 * шестидесяти — и подборку из фильмов, не похожих ни на один из двух.
 * Чем шире вкус, тем ближе центр к середине шкалы, то есть тем усерднее
 * система награждает посредственность за то, что она посередине.
 *
 * Здесь усреднения нет вовсе. Профиль — это список конкретных фильмов,
 * которые человек полюбил, и каждый тянет к себе отдельно. «Брат»
 * притягивает своё, «Кин-дза-дза» своё, и ветки не смешиваются.
 *
 * Побочная выгода важнее, чем кажется: объяснение становится конкретным.
 * Не «совпало по вектору», а «похоже на "Брата", который вам зашёл».
 */

import { RECOMMENDATION_CONFIG } from '../../shared/config/recommendation.js';
import { MOOD_AXES } from '../../shared/config/recommendation.js';

/**
 * Косинусная близость двух наборов тегов.
 *
 * Отдельная от общей: здесь оба аргумента — веса тегов ФИЛЬМОВ
 * в одной шкале, а не фильм против накопленного профиля.
 */
export function titleSimilarity(a, b) {
  const left = a ?? {};
  const right = b ?? {};

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [tag, weight] of Object.entries(left)) {
    normA += weight * weight;
    const other = right[tag];
    if (other) dot += weight * other;
  }
  for (const weight of Object.values(right)) normB += weight * weight;

  if (!dot || !normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Насколько похожи вектора настроения двух фильмов, 0..1. */
export function moodCloseness(a, b) {
  if (!a || !b) return 0;
  let total = 0;
  for (const axis of MOOD_AXES) {
    const diff = Math.abs((a[axis] ?? 50) - (b[axis] ?? 50));
    total += 1 - Math.min(1, diff / 100);
  }
  return total / MOOD_AXES.length;
}

/**
 * Насколько кандидат близок к тому, что человек любит.
 *
 * Берётся МАКСИМУМ по любимым, а не среднее — в этом вся суть замены.
 * Среднее снова свело бы всё к центру; максимум говорит «этот фильм
 * похож вот на этот конкретный, который вам зашёл».
 *
 * Второе и третье совпадения учитываются слабой добавкой: фильм,
 * похожий сразу на нескольких любимых, надёжнее случайного попадания
 * в одного. Но добавка именно слабая, иначе она превратится в то же
 * усреднение с другого конца.
 *
 * @param {object} title кандидат
 * @param {Array} loved  любимые фильмы: [{ id, title, tags, moods }]
 * @returns {{score: number, best: object|null, alsoLike: Array}}
 */
export function affinityToLoved(title, loved, { config = RECOMMENDATION_CONFIG } = {}) {
  if (!loved?.length || !title) return { score: 0, best: null, alsoLike: [] };

  const tagShare = config.affinity?.tagShare ?? 0.75;
  const supportBonus = config.affinity?.supportBonus ?? 0.12;
  const supportCount = config.affinity?.supportCount ?? 3;

  const scored = [];
  for (const anchor of loved) {
    if (!anchor || anchor.id === title.id) continue;
    const byTags = titleSimilarity(title.tags, anchor.tags);
    const byMood = moodCloseness(title.moods, anchor.moods);
    scored.push({ anchor, value: byTags * tagShare + byMood * (1 - tagShare) });
  }

  if (!scored.length) return { score: 0, best: null, alsoLike: [] };

  scored.sort((a, b) => b.value - a.value);
  const [top, ...rest] = scored;

  /*
   * Поддержка считается от второго и ниже: первое совпадение — это уже
   * основная оценка, и складывать его с самим собой значило бы удваивать
   * вес одного случайного попадания.
   */
  const support = rest.slice(0, supportCount - 1)
    .reduce((acc, item) => acc + item.value, 0) / Math.max(1, supportCount - 1);

  return {
    score: Math.min(1, top.value + support * supportBonus),
    best: top.anchor,
    alsoLike: rest.slice(0, 2).filter((item) => item.value > top.value * 0.7).map((i) => i.anchor),
  };
}

/**
 * Насколько кандидат похож на отвергнутое.
 *
 * Отказов у людей в разы больше, чем любимого: четыреста тридцать два
 * против пятидесяти трёх у активного пользователя. Выбрасывать самый
 * обильный сигнал расточительно.
 *
 * Возвращается тем же способом — максимумом. И применяется мягко:
 * похожесть на отвергнутое понижает, но не запрещает. Человек листает
 * влево по десятку причин, и большинство из них про настроение,
 * а не про фильм.
 */
export function affinityToRefused(title, refused, { config = RECOMMENDATION_CONFIG } = {}) {
  if (!refused?.length || !title) return 0;

  const tagShare = config.affinity?.tagShare ?? 0.75;
  let worst = 0;

  for (const anchor of refused) {
    if (!anchor || anchor.id === title.id) continue;
    const value = titleSimilarity(title.tags, anchor.tags) * tagShare
      + moodCloseness(title.moods, anchor.moods) * (1 - tagShare);
    if (value > worst) worst = value;
  }

  return worst;
}
