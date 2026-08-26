/**
 * Ранжирование карточек.
 *
 * Итоговый score = взвешенная смесь трёх сигналов:
 *   1) косинусное сходство вектора тегов фильма и профиля пользователя;
 *   2) близость 5D-вектора настроения;
 *   3) внешнее качество (страховка на холодном старте).
 * Веса — в config.blend, а не в коде: их тюнят без правки логики.
 *
 * Поверх — штрафы (уже видел/отклонил/посмотрел), антимонотонность
 * и слоты разведки, чтобы лента не схлопнулась в один поджанр.
 */

import { MOOD_AXES, RECOMMENDATION_CONFIG } from '../../shared/config/recommendation.js';
import { affinityToLoved, affinityToRefused } from './affinity.js';
import { hydrateProfile, isWarm } from './tasteProfile.js';
import { isColdStartTitle } from '../../shared/config/coldStart.js';

/** Косинусное сходство разреженных векторов тегов. 0..1 (отрицательные веса гасятся). */
export function cosineSimilarity(titleTags, profileTags) {
  const keys = Object.keys(titleTags ?? {});
  if (!keys.length) return 0;

  let dot = 0;
  let titleNorm = 0;
  let profileNorm = 0;

  for (const [, w] of Object.entries(titleTags)) titleNorm += w * w;
  for (const [, w] of Object.entries(profileTags ?? {})) {
    if (w > 0) profileNorm += w * w;
  }
  if (!titleNorm || !profileNorm) return 0;

  for (const key of keys) {
    const pw = profileTags?.[key];
    if (pw > 0) dot += titleTags[key] * pw;
  }

  return dot / (Math.sqrt(titleNorm) * Math.sqrt(profileNorm));
}

/** Близость 5D-настроений: 1 — идентичны, 0 — противоположны. */
export function moodSimilarity(a, b) {
  if (!a || !b) return 0.5;
  let sum = 0;
  for (const axis of MOOD_AXES) {
    const d = ((a[axis] ?? 50) - (b[axis] ?? 50)) / 100;
    sum += d * d;
  }
  return Math.max(0, 1 - Math.sqrt(sum / MOOD_AXES.length));
}

/**
 * Штрафы за уже пережитое.
 *
 * Любое принятое решение — «мимо», «хочу посмотреть», «смотрел»,
 * «избранное» — исключает фильм из выбора навсегда. Промежуточный
 * случай ровно один: карточку показали, но решение не приняли.
 */
export const DECIDED_STATES = Object.freeze(
  new Set(['dislike', 'later', 'like', 'favorite', 'match', 'watched']),
);

/** Принято ли по тайтлу окончательное решение. */
export const isDecided = (state) => DECIDED_STATES.has(state);

const DECIDED = DECIDED_STATES;

function historyMultiplier(titleId, history, config) {
  const state = history?.[titleId];
  if (!state) return 1;
  const p = config.penalties;
  if (state === 'dislike') return p.disliked;
  /*
   * Отказ одного участника комнаты. Понижение сильное, но не запрет:
   * его «нет» весит много, а вычёркивать фильм для второго человека
   * оснований не даёт.
   */
  if (state === 'refused-by-some') return config.room?.refusedBySome ?? 0.15;
  if (state === 'watched') return p.watched;
  if (DECIDED.has(state)) return p.liked;
  if (state === 'seen') return p.recentlySeen;
  return 1;
}

/**
 * Оценивает один тайтл для конкретного профиля.
 * Возвращает не только число, но и разложение — оно нужно UI,
 * чтобы честно объяснить «почему эта карточка здесь».
 */
export function scoreTitle(title, profile, {
  config = RECOMMENDATION_CONFIG,
  history,
  /** Любимые фильмы как опоры. Без них работает по-старому, на векторе. */
  loved = null,
  /** Отвергнутые — второй полюс. */
  refused = null,
} = {}) {
  const p = hydrateProfile(profile);
  const tagScore = cosineSimilarity(title.tags, p.tagWeights);
  const moodScore = moodSimilarity(title.moods, p.moods);
  const qualityScore = title.quality ?? 0.5;

  /*
   * Близость к конкретному любимому фильму — главный сигнал.
   *
   * Накопленный вектор остаётся, но уходит на роль широты: он знает,
   * какие темы человеку вообще близки, и этим страхует случаи, когда
   * ни один любимый фильм не похож на кандидата.
   */
  const affinity = affinityToLoved(title, loved, { config });
  const refusedScore = affinityToRefused(title, refused, { config });

  const { affinityWeight, tagWeight, moodWeight, qualityWeight } = config.blend;

  /*
   * Когда опор нет — у новичка или пока любимые не догрузились — вес
   * близости выпадает из расчёта целиком, вместе со знаменателем.
   * Оставить его значило бы делить на гарантированный ноль и занижать
   * все оценки холодного профиля; переложить на другой сигнал —
   * сломать изоляцию весов, из-за которой конфиг и вынесен наружу:
   * выставив вес тегов в единицу, а остальные в ноль, обязано получиться
   * ровно совпадение по тегам, иначе настраивать нечего.
   *
   * Оставшиеся сигналы делят полный вес между собой сами: знаменатель
   * их и нормализует.
   */
  const effectiveAffinity = loved?.length ? affinityWeight : 0;

  const totalWeight = effectiveAffinity + tagWeight + moodWeight + qualityWeight;
  const base = totalWeight === 0 ? 0 : (
    affinity.score * effectiveAffinity
    + tagScore * tagWeight
    + moodScore * moodWeight
    + qualityScore * qualityWeight
  ) / totalWeight;

  /*
   * Похожесть на отвергнутое понижает мягко и пропорционально: фильм,
   * неотличимый от того, что человек листал влево, теряет треть оценки,
   * а отдалённо напоминающий — почти ничего.
   */
  const refusedDrag = 1 - refusedScore * (config.affinity?.refusedPenalty ?? 0.35);

  const penalty = historyMultiplier(title.id, history, config) * refusedDrag;

  /*
   * Пока профиль пуст, сравнивать фильмы по вкусу не с чем, и наверх
   * всплывает просто популярное. Стартовый набор поднимается выше не
   * потому, что он лучше, а потому, что по нему быстрее становится
   * понятно, что человеку вообще нравится.
   */
  const seedBoost = !isWarm(p, config) && isColdStartTitle(title)
    ? config.exploration.coldStartBoost
    : 1;

  return {
    id: title.id,
    score: Math.round(base * penalty * seedBoost * 10000) / 10000,
    rawScore: Math.round(base * 10000) / 10000,
    tagScore: Math.round(tagScore * 10000) / 10000,
    affinityScore: Math.round(affinity.score * 10000) / 10000,
    /** Тот самый любимый фильм, на который похож этот. Идёт в объяснение. */
    becauseOf: affinity.best ? { id: affinity.best.id, title: affinity.best.title } : null,
    refusedScore: Math.round(refusedScore * 10000) / 10000,
    moodScore: Math.round(moodScore * 10000) / 10000,
    qualityScore: Math.round(qualityScore * 10000) / 10000,
    penalty,
    matchedTags: matchedTags(title.tags, p.tagWeights),
    confidence: base >= config.confidence.strongMatch ? 'strong'
      : base >= config.confidence.weakMatch ? 'weak' : 'exploratory',
  };
}

/** Теги фильма, которые реально совпали с профилем — их подсвечивает карточка. */
export function matchedTags(titleTags, profileTags, limit = 4) {
  return Object.entries(titleTags ?? {})
    .map(([tag, w]) => ({ tag, weight: w, profileWeight: profileTags?.[tag] ?? 0 }))
    .filter((t) => t.profileWeight > 0)
    .sort((a, b) => b.weight * b.profileWeight - a.weight * a.profileWeight)
    .slice(0, limit)
    .map((t) => t.tag);
}

/** Теги фильма, которых в профиле нет вообще, — «новизна» для разведки. */
function noveltyScore(titleTags, profileTags) {
  const keys = Object.keys(titleTags ?? {});
  if (!keys.length) return 0;
  const unknown = keys.filter((tag) => !(profileTags?.[tag] > 0)).length;
  return unknown / keys.length;
}

/**
 * Собирает упорядоченную колоду.
 *
 * Порядок сборки важен: сначала отбрасываем запрещённое, затем считаем
 * score, затем перемежаем разведкой, и только в конце гасим монотонность.
 */
export function rankDeck(titles, profile, {
  config = RECOMMENDATION_CONFIG,
  history = {},
  size = config.deck.soloSize,
  explorationRate,
  random = Math.random,
  /** Опоры вкуса: конкретные любимые фильмы вместо усреднённой точки. */
  loved = null,
  /** Отвергнутое — второй полюс, понижающий похожее. */
  refused = null,
} = {}) {
  const p = hydrateProfile(profile);
  const warm = isWarm(p, config);
  const rate = explorationRate ?? (warm ? config.exploration.rate : config.exploration.coldStartRate);

  const scored = [];
  for (const title of titles) {
    if (!title?.id) continue;
    const evaluation = scoreTitle(title, p, { config, history, loved, refused });
    if (evaluation.penalty === 0) continue; // жёстко исключено
    scored.push({
      title,
      ...evaluation,
      novelty: noveltyScore(title.tags, p.tagWeights),
    });
  }

  if (!scored.length) return [];

  const byScore = [...scored].sort((a, b) => b.score - a.score);

  // Кандидаты в разведку: не мусор (порог качества) и с высокой новизной.
  const exploreCandidates = [...scored]
    .filter((c) => c.qualityScore >= config.exploration.minQuality && c.novelty > 0.2)
    .sort((a, b) => (b.novelty * config.exploration.noveltyBonus + b.qualityScore)
      - (a.novelty * config.exploration.noveltyBonus + a.qualityScore));

  const target = Math.min(size, scored.length);
  const exploreSlots = Math.round(target * rate);

  const used = new Set();
  const deck = [];

  /*
   * Пока профиль пуст, колода начинается с калибровочного набора.
   *
   * Множителя к оценке для этого мало: очень качественная популярка
   * всё равно всплывала выше, и набор рассыпался по ленте вместо того,
   * чтобы отработать сразу. Порядок внутри набора — не по качеству,
   * а по непохожести: две подряд идущие карточки должны спрашивать
   * о разном, иначе полтора десятка ответов дадут одну и ту же грань.
   */
  if (!warm) {
    for (const candidate of spreadByMood(scored.filter((c) => isColdStartTitle(c.title)))) {
      if (deck.length >= target) break;
      used.add(candidate.id);
      deck.push({ ...candidate, slot: 'calibration' });
    }
  }
  let exploitCursor = 0;
  let exploreCursor = 0;

  // Разведочные карточки распределяем равномерно, а не сваливаем в хвост:
  // иначе пользователь до них не доскроллит.
  const explorePositions = new Set();
  if (exploreSlots > 0) {
    const step = target / exploreSlots;
    for (let i = 0; i < exploreSlots; i += 1) {
      explorePositions.add(Math.floor(i * step + step * 0.5 + (random() - 0.5) * step * 0.4));
    }
  }

  for (let position = deck.length; position < target; position += 1) {
    const wantExplore = explorePositions.has(position);
    let pick = null;

    if (wantExplore) {
      while (exploreCursor < exploreCandidates.length && !pick) {
        const candidate = exploreCandidates[exploreCursor++];
        if (!used.has(candidate.id)) pick = { ...candidate, slot: 'explore' };
      }
    }

    while (!pick && exploitCursor < byScore.length) {
      const candidate = byScore[exploitCursor++];
      if (!used.has(candidate.id)) pick = { ...candidate, slot: 'profile' };
    }

    if (!pick) break;
    used.add(pick.id);
    deck.push(pick);
  }

  return applyDiversity(deck, config);
}

/**
 * Раскладывает карточки так, чтобы соседние были максимально непохожи.
 *
 * Жадный проход: первой идёт самая качественная, каждая следующая — та,
 * что дальше всего по вектору настроения от уже показанной. Сортировка
 * по качеству дала бы подряд три драмы, и первые ответы рассказали бы
 * об одной и той же грани вкуса.
 */
function spreadByMood(candidates) {
  if (candidates.length < 3) return [...candidates];

  const pool = [...candidates].sort((a, b) => b.qualityScore - a.qualityScore);
  const out = [pool.shift()];

  while (pool.length) {
    let bestIndex = 0;
    let bestDistance = -Infinity;
    const previous = out[out.length - 1].title.moods ?? {};

    for (let i = 0; i < pool.length; i += 1) {
      const moods = pool[i].title.moods ?? {};
      let distance = 0;
      for (const axis of MOOD_AXES) {
        distance += Math.abs((moods[axis] ?? 50) - (previous[axis] ?? 50));
      }
      if (distance > bestDistance) { bestDistance = distance; bestIndex = i; }
    }

    out.push(pool.splice(bestIndex, 1)[0]);
  }

  return out;
}

/**
 * Антимонотонность: если подряд идут карточки с одним доминирующим тегом,
 * следующая такая же отодвигается. Лента без этого превращается
 * в один поджанр на 40 карточек.
 */
function applyDiversity(deck, config) {
  const { repetitionWindow, repetitionPenalty } = config.penalties;
  if (repetitionPenalty <= 0 || deck.length < 3) return deck;

  const result = [];
  const pending = [...deck];

  while (pending.length) {
    const recent = result.slice(-repetitionWindow).map((c) => dominantTag(c.title));
    let bestIndex = 0;
    let bestValue = -Infinity;

    // Смотрим на небольшое окно вперёд — полный ресорт всё равно бесполезен,
    // а стоимость O(n·k) остаётся линейной.
    const lookahead = Math.min(pending.length, repetitionWindow + 2);
    for (let i = 0; i < lookahead; i += 1) {
      const candidate = pending[i];
      const tag = dominantTag(candidate.title);
      const repeats = recent.filter((t) => t && t === tag).length;
      const value = candidate.score - repeats * repetitionPenalty - i * 0.001;
      if (value > bestValue) { bestValue = value; bestIndex = i; }
    }

    const [chosen] = pending.splice(bestIndex, 1);
    result.push(chosen);
  }

  return result;
}

function dominantTag(title) {
  let best = null;
  let bestWeight = -Infinity;
  for (const [tag, w] of Object.entries(title?.tags ?? {})) {
    if (w > bestWeight) { bestWeight = w; best = tag; }
  }
  return best;
}

/**
 * Компромиссный профиль комнаты — НЕ среднее арифметическое.
 *
 * Тема, важная для всех участников, получает мультипликативный буст:
 * если оба любят хайсты, хайсты должны выстрелить наверх, а не размыться
 * усреднением с чужими интересами. Тема, важная одному, сохраняется
 * с пониженным весом — чтобы у второго был шанс открыть для себя новое.
 */
export function buildConsensusProfile(profiles, { config = RECOMMENDATION_CONFIG } = {}) {
  const list = (profiles ?? []).map(hydrateProfile).filter((p) => p.signals > 0 || Object.keys(p.tagWeights).length);
  if (!list.length) return hydrateProfile(null);
  if (list.length === 1) return list[0];

  const room = config.room;
  const normalized = list.map((p) => normalizeTags(p.tagWeights));

  const allTags = new Set(normalized.flatMap((t) => Object.keys(t)));
  const tagWeights = {};

  for (const tag of allTags) {
    const values = normalized.map((t) => t[tag] ?? 0);
    const holders = values.filter((v) => v > 0);
    if (!holders.length) continue;

    const mean = holders.reduce((a, b) => a + b, 0) / holders.length;

    if (holders.length === normalized.length) {
      // Общая тема: геометрическое среднее (штрафует «сильно у одного,
      // еле-еле у другого») плюс явный буст.
      const geometric = holders.reduce((a, b) => a * b, 1) ** (1 / holders.length);
      tagWeights[tag] = Math.round(geometric * room.sharedTagBoost * 1000) / 1000;
    } else {
      tagWeights[tag] = Math.round(mean * room.soloTagWeight * 1000) / 1000;
    }
  }

  // Настроение усредняем по массе сигналов — у активного участника
  // вкус измерен точнее, и его вектор надёжнее.
  const moods = {};
  const totalMass = list.reduce((a, p) => a + Math.max(1, p.moodMass), 0);
  for (const axis of MOOD_AXES) {
    moods[axis] = Math.round(
      list.reduce((acc, p) => acc + (p.moods[axis] ?? 50) * Math.max(1, p.moodMass), 0) / totalMass,
    );
  }

  return {
    version: config.version,
    tagWeights,
    moods,
    moodMass: totalMass,
    counts: { like: 0, dislike: 0, favorite: 0, watched: 0, match: 0, inspect: 0 },
    signals: list.reduce((a, p) => a + p.signals, 0),
    updatedAt: Date.now(),
    consensusOf: list.length,
  };
}

/** Приводит веса тегов к единичной норме — иначе активный участник задавит остальных. */
function normalizeTags(tagWeights) {
  const positive = Object.entries(tagWeights ?? {}).filter(([, w]) => w > 0);
  if (!positive.length) return {};
  const norm = Math.sqrt(positive.reduce((acc, [, w]) => acc + w * w, 0));
  return Object.fromEntries(positive.map(([tag, w]) => [tag, w / norm]));
}
