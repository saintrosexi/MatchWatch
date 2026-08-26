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
 * Подготовленный к сравнению фильм.
 *
 * Норма вектора тегов считается один раз, а не на каждую пару. Без этого
 * сравнение трёхсот кандидатов с сорока опорами пересчитывало одни и те
 * же нормы двенадцать тысяч раз: на телефоне это доходило до трети
 * секунды на каждую сборку колоды.
 */
export function prepare(title) {
  const tags = title?.tags ?? {};
  let norm = 0;
  for (const weight of Object.values(tags)) norm += weight * weight;

  /*
   * Карточка остаётся карточкой, к ней лишь добавляется норма.
   * Собирать урезанную копию значило бы терять качество, год и всё
   * остальное — а ими пользуется тот же расчёт двумя строками ниже.
   */
  return { ...title, tags, norm: Math.sqrt(norm) };
}

/**
 * Готовит список опор один раз на всю сборку колоды.
 *
 * Заодно строится обратный индекс «тег → какие опоры его несут».
 * Без него каждый кандидат сравнивался со всеми опорами подряд:
 * триста двадцать кандидатов против сотни опор — тридцать две тысячи
 * сравнений, и подавляющее большинство между фильмами, у которых нет
 * ни одного общего тега. По индексу кандидат видит только тех, с кем
 * ему вообще есть что делить.
 */
export function prepareAll(titles) {
  const list = (titles ?? []).filter(Boolean).map(prepare);
  const byTag = new Map();

  for (let i = 0; i < list.length; i += 1) {
    for (const tag in list[i].tags) {
      let bucket = byTag.get(tag);
      if (!bucket) { bucket = []; byTag.set(tag, bucket); }
      bucket.push(i);
    }
  }

  list.byTag = byTag;
  return list;
}

/**
 * Опоры, у которых есть хоть один общий тег с кандидатом.
 *
 * Когда общих нет ни с кем, возвращается весь список: сравнить всё
 * равно надо — по настроению, — а таких кандидатов единицы.
 */
function relevantAnchors(candidate, anchors) {
  const byTag = anchors.byTag;
  if (!byTag) return anchors;

  const seen = new Set();
  for (const tag in candidate.tags) {
    const bucket = byTag.get(tag);
    if (!bucket) continue;
    for (let i = 0; i < bucket.length; i += 1) seen.add(bucket[i]);
  }

  if (!seen.size) return anchors;

  const out = [];
  for (const index of seen) out.push(anchors[index]);
  return out;
}

/**
 * Косинусная близость двух подготовленных фильмов.
 *
 * Перебирается меньший из двух наборов тегов: у фильма их около
 * десятка, и лишний проход по большему ничего не добавляет.
 */
function cosineOf(a, b) {
  if (!a.norm || !b.norm) return 0;

  const [small, large] = Object.keys(a.tags).length <= Object.keys(b.tags).length
    ? [a.tags, b.tags]
    : [b.tags, a.tags];

  let dot = 0;
  for (const tag in small) {
    const other = large[tag];
    if (other) dot += small[tag] * other;
  }

  return dot ? dot / (a.norm * b.norm) : 0;
}

/** Косинусная близость двух наборов тегов. Для разовых сравнений. */
export function titleSimilarity(a, b) {
  return cosineOf(prepare({ tags: a }), prepare({ tags: b }));
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

  // Опоры принимаются как подготовленными, так и сырыми: вызывающий
  // из горячего пути готовит их один раз, разовому вызову это не нужно.
  const prepared = loved[0]?.norm === undefined ? prepareAll(loved) : loved;
  const candidate = title.norm === undefined ? prepare(title) : title;
  const anchors = relevantAnchors(candidate, prepared);

  /*
   * Один проход без массива и без сортировки.
   *
   * Раньше на каждого кандидата собирался массив из сорока объектов
   * и сортировался целиком — триста двадцать сортировок и двенадцать
   * тысяч аллокаций на одну сборку колоды. Нужны отсюда только первые
   * три значения, и они прекрасно находятся по ходу.
   */
  const moodShare = 1 - tagShare;
  let bestValue = -1;
  let bestAnchor = null;
  let second = -1;
  let secondAnchor = null;
  let third = -1;
  let thirdAnchor = null;

  for (let i = 0; i < anchors.length; i += 1) {
    const anchor = anchors[i];
    if (anchor.id === candidate.id) continue;

    const value = cosineOf(candidate, anchor) * tagShare
      + moodCloseness(candidate.moods, anchor.moods) * moodShare;

    if (value > bestValue) {
      third = second; thirdAnchor = secondAnchor;
      second = bestValue; secondAnchor = bestAnchor;
      bestValue = value; bestAnchor = anchor;
    } else if (value > second) {
      third = second; thirdAnchor = secondAnchor;
      second = value; secondAnchor = anchor;
    } else if (value > third) {
      third = value; thirdAnchor = anchor;
    }
  }

  if (!bestAnchor) return { score: 0, best: null, alsoLike: [] };

  /*
   * Поддержка считается от второго и ниже: первое совпадение — это уже
   * основная оценка, и складывать его с самим собой значило бы удваивать
   * вес одного случайного попадания.
   *
   * Считается она только среди опор, делящих с кандидатом хотя бы одну
   * тему. Это не упрощение ради скорости, а более точное определение:
   * «похож на несколько ваших любимых» — про темы, а два случайных
   * фильма и так сходятся по настроению на две трети просто потому,
   * что настроение — пять чисел из ста.
   */
  const supportPool = Math.max(1, supportCount - 1);
  const support = (Math.max(second, 0) + (supportCount > 2 ? Math.max(third, 0) : 0)) / supportPool;

  const alsoLike = [];
  const threshold = bestValue * 0.7;
  if (secondAnchor && second > threshold) alsoLike.push(secondAnchor);
  if (thirdAnchor && third > threshold) alsoLike.push(thirdAnchor);

  return {
    score: Math.min(1, bestValue + support * supportBonus),
    best: bestAnchor,
    alsoLike,
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
  const prepared = refused[0]?.norm === undefined ? prepareAll(refused) : refused;
  const candidate = title.norm === undefined ? prepare(title) : title;
  const anchors = relevantAnchors(candidate, prepared);
  let worst = 0;

  for (const anchor of anchors) {
    if (anchor.id === candidate.id) continue;
    const value = cosineOf(candidate, anchor) * tagShare
      + moodCloseness(candidate.moods, anchor.moods) * (1 - tagShare);
    if (value > worst) worst = value;
  }

  return worst;
}
