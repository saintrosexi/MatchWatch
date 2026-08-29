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
import {
  affinityToLoved, affinityToRefused, affinityAcrossGroups,
  prepare, prepareAll, titleSimilarity,
} from './affinity.js';
import { hydrateProfile, isWarm } from './tasteProfile.js';
import { isColdStartTitle } from '../../shared/config/coldStart.js';
import { universeOf } from '../../shared/taxonomy/franchises.js';

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
  /**
   * Опоры по участникам комнаты: [[его], [её]].
   *
   * Когда переданы — оценка идёт по вероятности двойного «да», а не по
   * «кому-нибудь понравится». Мэтч — это согласие обоих, и считать его
   * максимумом значит выводить наверх фильмы, которые мэтчем не станут.
   */
  lovedGroups = null,
} = {}) {
  const p = hydrateProfile(profile);
  const tagScore = cosineSimilarity(title.tags, p.tagWeights);
  const qualityScore = title.quality ?? 0.5;

  /*
   * Близость к конкретному любимому фильму — главный сигнал.
   *
   * Накопленный вектор остаётся, но уходит на роль широты: он знает,
   * какие темы человеку вообще близки, и этим страхует случаи, когда
   * ни один любимый фильм не похож на кандидата.
   */
  const affinity = lovedGroups?.length
    ? affinityAcrossGroups(title, lovedGroups, { config })
    : affinityToLoved(title, loved, { config });
  const refusedScore = affinityToRefused(title, refused, { config });

  const { affinityWeight, tagWeight, qualityWeight } = config.blend;

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
  const effectiveAffinity = (loved?.length || lovedGroups?.length) ? affinityWeight : 0;

  const totalWeight = effectiveAffinity + tagWeight + qualityWeight;
  const base = totalWeight === 0 ? 0 : (
    affinity.score * effectiveAffinity
    + tagScore * tagWeight
    + qualityScore * qualityWeight
  ) / totalWeight;

  /*
   * Похожесть на отвергнутое понижает мягко и пропорционально: фильм,
   * неотличимый от того, что человек листал влево, теряет треть оценки,
   * а отдалённо напоминающий — почти ничего.
   */
  const refusedDrag = 1 - refusedScore * (config.affinity?.refusedPenalty ?? 0.35);

  /*
   * Поправка на популярность.
   *
   * Популярность TMDB самоподдерживающаяся: популярное показывают чаще,
   * от этого оно популярнее. Без поправки лента у всех сходится к одному
   * и тому же набору блокбастеров, как бы хорошо ни работал вкус, —
   * и человек справедливо говорит «одни и те же фильмы».
   *
   * Малоизвестный фильм, который человеку подходит, ценнее ещё одного
   * блокбастера: блокбастер он и так видел или хотя бы про него слышал.
   *
   * Степень маленькая намеренно. Перекрутишь — получишь подборку
   * из безвестного шлака, и это будет хуже, чем повторы: там хотя бы
   * фильмы хорошие.
   */
  const damp = config.quality?.popularityDamping ?? 0;
  const popularityDrag = damp > 0 && title.popularity > 0
    ? 1 / (1 + damp * Math.log1p(title.popularity) / Math.log1p(config.quality.popularitySoftCap))
    : 1;

  const penalty = historyMultiplier(title.id, history, config) * refusedDrag * popularityDrag;

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
    /** Кому в комнате фильм подходит хуже всех — видно, где компромисс. */
    weakestFor: affinity.weakest ? { id: affinity.weakest.id, title: affinity.weakest.title } : null,
    refusedScore: Math.round(refusedScore * 10000) / 10000,
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
  /** Опоры по участникам комнаты — включают режим «вероятность мэтча». */
  lovedGroups = null,
} = {}) {
  const p = hydrateProfile(profile);
  const warm = isWarm(p, config);
  const rate = explorationRate ?? (warm ? config.exploration.rate : config.exploration.coldStartRate);

  /*
   * Опоры готовятся один раз на всю колоду, а не на каждого кандидата.
   * Триста кандидатов против сорока опор — это двенадцать тысяч пар,
   * и пересчёт норм внутри каждой доходил на телефоне до трети секунды.
   */
  const lovedReady = loved?.length ? prepareAll(loved) : null;
  const refusedReady = refused?.length ? prepareAll(refused) : null;
  const groupsReady = lovedGroups?.length
    ? lovedGroups.filter((g) => g?.length).map((g) => prepareAll(g))
    : null;

  const scored = [];
  for (const title of titles) {
    if (!title?.id) continue;
    const evaluation = scoreTitle(prepare(title), p, {
      config, history, loved: lovedReady, refused: refusedReady, lovedGroups: groupsReady,
    });
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
   * Учёт франшиз и вселенных.
   *
   * Считаем при наборе, а не штрафуем в оценке: штраф — это «поставим
   * пониже», а нужно именно «хватит». Человек, отметивший любимыми
   * восемь «Человеков-пауков», по оценке получит Marvel в любом случае,
   * потому что для движка это и есть самое похожее на его вкус.
   */
  const franchiseSeen = new Map();
  const universeSeen = new Map();
  const { maxPerFranchise = Infinity, maxPerUniverse = Infinity } = config.penalties;

  const keysOf = (title) => ({
    franchise: title?.collectionId ?? null,
    universe: universeOf(title?.tags),
  });

  const overCap = (title) => {
    const { franchise, universe } = keysOf(title);
    if (franchise !== null && (franchiseSeen.get(franchise) ?? 0) >= maxPerFranchise) return true;
    if (universe && (universeSeen.get(universe) ?? 0) >= maxPerUniverse) return true;
    return false;
  };

  const countIn = (title) => {
    const { franchise, universe } = keysOf(title);
    if (franchise !== null) franchiseSeen.set(franchise, (franchiseSeen.get(franchise) ?? 0) + 1);
    if (universe) universeSeen.set(universe, (universeSeen.get(universe) ?? 0) + 1);
  };

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
      countIn(candidate.title);
      deck.push({ ...candidate, slot: 'calibration' });
    }
  }
  /*
   * Противоположности: намеренно далёкое от вкуса, но не мусор.
   *
   * Сортируем по возрастанию близости при соблюдённом пороге качества.
   * Вкус нельзя расширить, показывая только то, что уже нравится, —
   * а лента из одного «ещё такого же» стареет вместе со своим профилем.
   */
  const farCandidates = [...scored]
    .filter((c) => c.qualityScore >= config.exploration.minQuality)
    .sort((a, b) => (a.rawScore - b.rawScore) || (b.qualityScore - a.qualityScore));

  /*
   * План колоды: сколько карточек какого рода в ней будет.
   *
   * Расписывается заранее и перемешивается, а не собирается по порядку
   * убывания оценки. Три блока подряд — «сначала всё похожее, потом всё
   * незнакомое» — человек бросает листать на середине первого же блока.
   */
  /*
   * Противоположности появляются только у прогретого профиля.
   *
   * Пока профиля нет, «далёкое от вкуса» посчитать не от чего: оценки
   * у всех кандидатов почти одинаковые, и в эту долю попадёт случайное.
   * Новичку вместо противоположностей нужна широта — её даёт разведка,
   * которой на холодном старте и так больше половины колоды.
   */
  const farSlots = warm ? Math.round(exploreSlots * (config.exploration.farShare ?? 0)) : 0;
  const probeSlots = exploreSlots - farSlots;

  const plan = [];
  for (let i = 0; i < probeSlots; i += 1) plan.push('explore');
  for (let i = 0; i < farSlots; i += 1) plan.push('far');
  while (plan.length < target - deck.length) plan.push('profile');

  // Тасуем сам план, а не результат: так доли соблюдены точно,
  // а порядок не выдаёт, по какому правилу карточка попала в колоду.
  for (let i = plan.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [plan[i], plan[j]] = [plan[j], plan[i]];
  }

  const cursors = { profile: 0, explore: 0, far: 0 };
  const pools = { profile: byScore, explore: exploreCandidates, far: farCandidates };

  /*
   * Берёт следующего доступного кандидата нужного рода.
   *
   * `soft` — проход без учёта потолков франшизы. Нужен как последнее
   * средство: если у человека в любимых одна вселенная и каталог
   * отфильтрован узко, лучше показать четвёртого «Мстителя», чем
   * оборвать колоду на середине.
   */
  const take = (kind, { soft = false } = {}) => {
    const pool = pools[kind];
    while (cursors[kind] < pool.length) {
      const candidate = pool[cursors[kind]++];
      if (used.has(candidate.id)) continue;
      if (!soft && overCap(candidate.title)) continue;
      return { ...candidate, slot: kind === 'profile' ? 'profile' : kind };
    }
    return null;
  };

  for (const kind of plan) {
    if (deck.length >= target) break;

    // Своя категория, затем соседние, и лишь потом — без потолков.
    const order = kind === 'profile' ? ['profile', 'explore', 'far']
      : kind === 'explore' ? ['explore', 'profile', 'far']
        : ['far', 'explore', 'profile'];

    let pick = null;
    for (const source of order) {
      pick = take(source);
      if (pick) break;
    }
    if (!pick) pick = take(kind, { soft: true }) ?? take('profile', { soft: true });
    if (!pick) break;

    used.add(pick.id);
    countIn(pick.title);
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

  /*
   * Похожесть считается по всему набору тем, а не по одному ведущему тегу.
   *
   * Прежняя версия сравнивала только доминирующий тег, и этого мало
   * в обе стороны: два фильма с общим «драма» могут быть совсем разными,
   * а «самурайский боевик» и «боевик про ниндзя» с разными ведущими
   * тегами — почти одинаковыми. Полная похожесть ловит и то и другое.
   */
  const prepared = deck.map((entry) => ({ entry, ready: prepare(entry.title) }));
  const result = [];
  const pending = [...prepared];

  while (pending.length) {
    const recent = result.slice(-repetitionWindow);
    let bestIndex = 0;
    let bestValue = -Infinity;

    // Смотрим на небольшое окно вперёд — полный ресорт всё равно бесполезен,
    // а стоимость O(n·k) остаётся линейной.
    const lookahead = Math.min(pending.length, repetitionWindow + 2);
    for (let i = 0; i < lookahead; i += 1) {
      const candidate = pending[i];

      /*
       * Штрафует САМОЕ похожее из недавних, а не сумма по всем.
       * Сумма наказывала бы карточку за то, что она немного напоминает
       * каждую из четырёх предыдущих, — а это и есть нормальный вкус.
       * Бьём по настоящим дублям.
       */
      let closest = 0;
      for (const seen of recent) {
        const value = titleSimilarity(candidate.ready.tags, seen.ready.tags);
        if (value > closest) closest = value;
      }

      const value = candidate.entry.score - closest * repetitionPenalty * 2 - i * 0.001;
      if (value > bestValue) { bestValue = value; bestIndex = i; }
    }

    const [chosen] = pending.splice(bestIndex, 1);
    result.push(chosen);
  }

  return result.map((item) => item.entry);
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

  /*
   * Усреднения настроения здесь больше нет, и это главное место, ради
   * которого его убирали.
   *
   * Двое разных людей давали комнате середину между собой: у него мрак
   * 80, у неё 40, комната искала шестьдесят — то есть то, что не нравится
   * ни одному. Вместо этого комната работает через опоры обоих: похожее
   * на его любимое и похожее на её любимое попадают в подборку оба,
   * каждое со своей стороны, не смешиваясь.
   */
  return {
    version: config.version,
    tagWeights,
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
