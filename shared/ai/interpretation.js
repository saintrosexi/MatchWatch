/**
 * Разбор фразы «чего хочется сегодня» в то, что понимает движок.
 *
 * Модель здесь ничего не рекомендует — она переводит. Ранжирование
 * остаётся за векторами тегов и настроения: они быстрые, повторяемые
 * и бесплатные, и языковая модель их не обыграет. А вот превратить
 * «лёгкое, но не тупое, и не длиннее двух часов» в оси, теги и фильтры
 * векторы не умеют — это работа для языка.
 *
 * Ключевое ограничение, определившее конструкцию: **ниже жанрового слоя
 * теги в каталоге почти пусты.** `slow-burn` стоит у пяти фильмов из
 * тысячи восьмисот, `stylized-visuals` — у шестнадцати. Зато вектор
 * настроения есть у каждого тайтла без исключения.
 *
 * Поэтому тег, выбранный моделью, работает двумя путями сразу:
 *   1. прямым совпадением — там, где карточка обогащена;
 *   2. вкладом в оси настроения — а это уже весь каталог.
 *
 * Второй путь и даёт обещанный результат на любой запрос: даже когда
 * тега нет ни на одном фильме, подборка всё равно сдвигается туда,
 * куда человек просил.
 */

import { TAG_MOODS, TAG_LABELS_RU } from '../taxonomy/tagOntology.js';
import { MOOD_AXES } from '../config/recommendation.js';

/**
 * Словарь, из которого модель обязана выбирать.
 *
 * Закрытый список, а не свободные слова: выдуманный тег не совпадёт
 * ни с чем и не даст вклада в оси — то есть тихо ничего не сделает.
 * Сюда попадают только теги, у которых есть вклад в настроение, —
 * ровно те, что гарантированно работают на всём каталоге.
 */
export const AI_TAG_VOCABULARY = Object.freeze(
  Object.keys(TAG_MOODS)
    .filter((tag) => TAG_LABELS_RU[tag])
    .sort(),
);

/** Тег → русская подпись: модели проще выбирать, когда видно значение. */
export const AI_TAG_GLOSSARY = Object.freeze(
  Object.fromEntries(AI_TAG_VOCABULARY.map((tag) => [tag, TAG_LABELS_RU[tag]])),
);

/** Жанры TMDB — единственный фильтр, который каталог применяет жёстко. */
export const TMDB_GENRES = Object.freeze({
  28: 'боевик', 12: 'приключения', 16: 'анимация', 35: 'комедия',
  80: 'криминал', 99: 'документальное', 18: 'драма', 10751: 'семейное',
  14: 'фэнтези', 36: 'история', 27: 'ужасы', 10402: 'музыка',
  9648: 'детектив', 10749: 'мелодрама', 878: 'фантастика',
  10752: 'военное', 37: 'вестерн',
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Собирает вклад выбранных тегов в оси настроения.
 *
 * Вклад каждого тега взвешивается его же весом: «очень хочу посмеяться»
 * должно двигать сильнее, чем «ну и комедия сойдёт».
 */
function axesFromTags(tags) {
  const sums = {};
  const weights = {};

  for (const { tag, weight = 1 } of tags ?? []) {
    const offsets = TAG_MOODS[tag];
    if (!offsets) continue;
    const w = clamp(Number(weight) || 0, 0, 1);
    if (w <= 0) continue;

    for (const [axis, offset] of Object.entries(offsets)) {
      if (!MOOD_AXES.includes(axis)) continue;
      sums[axis] = (sums[axis] ?? 0) + offset * w;
      weights[axis] = (weights[axis] ?? 0) + w;
    }
  }

  const axes = {};
  for (const axis of Object.keys(sums)) {
    axes[axis] = clamp(Math.round(50 + sums[axis] / weights[axis]), 0, 100);
  }
  return axes;
}

/**
 * Приводит ответ модели к запросу, который понимает движок.
 *
 * Названная моделью ось побеждает выведенную из тегов: прямое
 * утверждение сильнее производного. Теги при этом не пропадают —
 * они заполняют оси, о которых модель промолчала, и остаются
 * в запросе для прямого совпадения.
 *
 * Всё, чего нет в словаре, отбрасывается молча: модель иногда
 * придумывает правдоподобные, но несуществующие теги, и пускать
 * их дальше значит копить мусор в запросах.
 *
 * @param {object} raw ответ модели
 * @returns {{axes: object, tags: Array, filters: object, summary: string, dropped: string[]}}
 */
export function requestFromInterpretation(raw) {
  const known = new Set(AI_TAG_VOCABULARY);
  const dropped = [];

  const tags = (Array.isArray(raw?.tags) ? raw.tags : [])
    .map((entry) => ({
      tag: String(entry?.tag ?? '').trim(),
      weight: clamp(Number(entry?.weight ?? 1) || 0, 0, 1),
    }))
    .filter(({ tag, weight }) => {
      if (!tag || weight <= 0) return false;
      if (!known.has(tag)) { dropped.push(tag); return false; }
      return true;
    })
    .slice(0, 12);

  const explicit = {};
  for (const axis of MOOD_AXES) {
    const value = raw?.axes?.[axis];
    if (value === null || value === undefined || Number.isNaN(Number(value))) continue;
    explicit[axis] = clamp(Math.round(Number(value)), 0, 100);
  }

  const derived = axesFromTags(tags);
  const axes = { ...derived, ...explicit };

  return {
    axes,
    tags,
    filters: normalizeFilters(raw?.filters),
    summary: String(raw?.summary ?? '').trim().slice(0, 200),
    dropped,
  };
}

/**
 * Жёсткие условия отсекают каталог, поэтому принимаются только те,
 * что человек называет прямо: год, длительность, рейтинг, жанр.
 * «Хорошее кино» жёстким фильтром не становится никогда — это
 * настроение, и место ему в осях.
 */
function normalizeFilters(raw) {
  const out = {};
  const year = (value) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n >= 1900 && n <= 2100 ? n : null;
  };

  const from = year(raw?.yearFrom);
  const to = year(raw?.yearTo);
  if (from) out.yearFrom = from;
  if (to) out.yearTo = to;
  // Перепутанные границы отдали бы пустой каталог вместо ошибки.
  if (out.yearFrom && out.yearTo && out.yearFrom > out.yearTo) {
    [out.yearFrom, out.yearTo] = [out.yearTo, out.yearFrom];
  }

  const runtime = Math.round(Number(raw?.maxRuntime));
  if (Number.isFinite(runtime) && runtime >= 40 && runtime <= 400) out.maxRuntime = runtime;

  const rating = Number(raw?.minRating);
  if (Number.isFinite(rating) && rating > 0 && rating <= 10) {
    out.minRating = Math.round(rating * 10) / 10;
  }

  const genres = (Array.isArray(raw?.genres) ? raw.genres : [])
    .map((g) => String(g).trim())
    .filter((g) => Object.prototype.hasOwnProperty.call(TMDB_GENRES, g))
    .slice(0, 6);
  if (genres.length) out.genres = genres;

  return out;
}

/** Схема ответа модели. Структура вместо прозы — чтобы нечему было оборваться. */
export const INTERPRETATION_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Одна фраза по-русски: что именно вы поняли из запроса. Без обещаний и без списка фильмов.',
    },
    axes: {
      type: 'object',
      description: 'Только те оси, о которых запрос действительно говорит. Остальные не указывать.',
      properties: Object.fromEntries(MOOD_AXES.map((axis) => [axis, { type: 'integer' }])),
    },
    tags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tag: { type: 'string' },
          weight: { type: 'number' },
        },
        required: ['tag', 'weight'],
      },
    },
    filters: {
      type: 'object',
      properties: {
        yearFrom: { type: 'integer' },
        yearTo: { type: 'integer' },
        maxRuntime: { type: 'integer' },
        minRating: { type: 'number' },
        genres: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  required: ['summary', 'axes', 'tags'],
};

/**
 * Складывает жёсткие условия всех участников комнаты.
 *
 * Правило разное для разных условий, и это не непоследовательность,
 * а разная цена ошибки.
 *
 * Длительность и рейтинг берутся по строгому: фильм длиннее того,
 * что один из двоих готов высидеть, — плохой выбор для обоих, и
 * «зато второй не против» тут не аргумент. Каталог от этого не пустеет:
 * два часа отсекают хвост, а не середину.
 *
 * Жанры складываются объединением. Пересечение «комедия» и «ужасы»
 * даёт пустоту, а пустая колода — худший исход из возможных: вечер
 * не состоится вовсе. Пусть каждому достанется часть того, что просил.
 *
 * Годы пересекаются, но только если пересечение не пустое — иначе
 * берётся объединяющий размах по той же причине.
 */
export function mergeRequestFilters(requests) {
  const all = (requests ?? []).map((r) => r?.filters ?? {}).filter((f) => Object.keys(f).length);
  if (!all.length) return {};

  const pick = (key) => all.map((f) => f[key]).filter((v) => Number.isFinite(v));
  const out = {};

  const runtimes = pick('maxRuntime');
  if (runtimes.length) out.maxRuntime = Math.min(...runtimes);

  const ratings = pick('minRating');
  if (ratings.length) out.minRating = Math.max(...ratings);

  const from = pick('yearFrom');
  const to = pick('yearTo');
  if (from.length) out.yearFrom = Math.max(...from);
  if (to.length) out.yearTo = Math.min(...to);

  if (out.yearFrom && out.yearTo && out.yearFrom > out.yearTo) {
    // Пересечения нет — расходимся на общий размах, а не в пустоту.
    out.yearFrom = Math.min(...from);
    out.yearTo = Math.max(...to);
  }

  const genres = [...new Set(all.flatMap((f) => f.genres ?? []))].slice(0, 6);
  if (genres.length) out.genres = genres;

  return out;
}
