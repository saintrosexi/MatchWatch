/**
 * Разметка фильма моделью.
 *
 * Зачем вообще: теги у большинства карточек выведены из жанров TMDB
 * и больше ни из чего. «Дюна» — это `sci-fi, journey, adventure`,
 * «Супермен» — `action, sci-fi, journey, adventure`. Векторы настроения
 * у них отличаются на восемь пунктов по одной оси, то есть на шум.
 * Медленный политический эпос и яркий блокбастер для движка — один
 * и тот же фильм, и полюбивший первое получает второе.
 *
 * Что делает модель: раскладывает фильм по нашему закрытому словарю,
 * исходя ИЗ ОПИСАНИЯ И КЛЮЧЕВЫХ СЛОВ, которые ей дали. Не вспоминает.
 * Разница принципиальная: вспоминая, модель уверенно навесит теги
 * на фильм, которого не знает, и проверить это будет нечем.
 *
 * Версия словаря живёт здесь же. Она меняется, когда меняется смысл
 * разметки, — и только тогда старое имеет смысл переделывать.
 */

import { TAG_MOODS, TAG_LABELS_RU } from '../taxonomy/tagOntology.js';
import { MOOD_AXES } from '../config/recommendation.js';

/**
 * Поколение разметки.
 *
 * Поднимать при изменении словаря или подсказки. Скрипт переразметит
 * только то, что размечено прошлым поколением, — не всё подряд.
 */
export const MARKUP_VERSION = 1;

/** Тот же закрытый словарь, что и у разбора запросов: два разных не свести. */
export const MARKUP_VOCABULARY = Object.freeze(
  Object.keys(TAG_MOODS).filter((tag) => TAG_LABELS_RU[tag]).sort(),
);

/** Сколько тегов имеет смысл держать: дальше идёт шум. */
const MAX_TAGS = 14;

export const MARKUP_SCHEMA = {
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      description: 'Темы фильма из словаря, с весом 0..100. Только то, что следует из описания.',
      items: {
        type: 'object',
        properties: {
          tag: { type: 'string' },
          weight: { type: 'integer' },
        },
        required: ['tag', 'weight'],
      },
    },
    moods: {
      type: 'object',
      description: 'Вектор настроения, каждая ось 0..100. Указывать все пять.',
      properties: Object.fromEntries(MOOD_AXES.map((axis) => [axis, { type: 'integer' }])),
      required: MOOD_AXES,
    },
    confidence: {
      type: 'string',
      description: 'high — описание подробное и всё ясно; low — описание скудное, разметка на грани догадки.',
    },
  },
  required: ['tags', 'moods', 'confidence'],
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Приводит ответ модели к тому, что можно хранить.
 *
 * Выдуманные теги отбрасываются и перечисляются отдельно: если модель
 * регулярно просит одно и то же слово, это повод дописать его в словарь,
 * а не гадать, чего ей не хватает.
 *
 * @returns {{tags: object, moods: object, confidence: string, dropped: string[]}|null}
 */
export function normalizeMarkup(raw) {
  const known = new Set(MARKUP_VOCABULARY);
  const dropped = [];
  const tags = {};

  for (const entry of Array.isArray(raw?.tags) ? raw.tags : []) {
    const tag = String(entry?.tag ?? '').trim();
    const weight = clamp(Math.round(Number(entry?.weight) || 0), 0, 100);
    if (!tag || weight <= 0) continue;
    if (!known.has(tag)) { dropped.push(tag); continue; }
    tags[tag] = Math.max(tags[tag] ?? 0, weight);
  }

  const moods = {};
  for (const axis of MOOD_AXES) {
    const value = Number(raw?.moods?.[axis]);
    if (!Number.isFinite(value)) continue;
    moods[axis] = clamp(Math.round(value), 0, 100);
  }

  /*
   * Неполный вектор не принимаем. Достроить недостающую ось до
   * нейтральных пятидесяти значило бы выдать догадку за измерение —
   * а именно на этих числах потом строится вся подборка.
   */
  if (Object.keys(moods).length !== MOOD_AXES.length) return null;
  if (!Object.keys(tags).length) return null;

  const trimmed = Object.fromEntries(
    Object.entries(tags).sort(([, a], [, b]) => b - a).slice(0, MAX_TAGS),
  );

  return {
    tags: trimmed,
    moods,
    confidence: raw?.confidence === 'low' ? 'low' : 'high',
    dropped,
  };
}

/**
 * Подмешивает разметку в карточку, идущую пользователю.
 *
 * Настоящие ключевые слова TMDB главнее: они факт, а разметка —
 * предположение. Поэтому вес из TMDB, если он есть, побеждает.
 * Разметка добавляет то, чего в TMDB не было вовсе, — а не было там,
 * по нашим данным, почти ничего.
 *
 * Вектор настроения заменяется целиком. Смешивать их бессмысленно:
 * прежний посчитан из тех же трёх жанровых тегов, что и так остаются
 * в наборе, и усреднение с ним просто вернуло бы серую середину,
 * ради ухода от которой всё и затевалось.
 */
export function applyMarkup(title, markup) {
  if (!title || !markup?.tags) return title;

  const tags = { ...markup.tags };
  for (const [tag, weight] of Object.entries(title.tags ?? {})) {
    tags[tag] = Math.max(tags[tag] ?? 0, weight);
  }

  return {
    ...title,
    tags,
    moods: markup.moods ?? title.moods,
    /** Видно снаружи, что теги не только из TMDB: без этого не отладить. */
    markup: { model: markup.model ?? null, confidence: markup.confidence ?? null },
  };
}
