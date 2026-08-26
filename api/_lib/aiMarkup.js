/**
 * POST /api/ai/markup — разметка пачки фильмов.
 *
 * То же самое, что делает `scripts/markup.mjs`, но оттуда, где уже есть
 * ключи: локально их держать необязательно, а прогон всё равно идёт
 * пачками и переживает обрывы.
 *
 * Размер пачки ограничен временем серверлес-функции. Прогон целиком —
 * это много вызовов подряд, и так и задумано: каждая пачка помечает
 * взятое в базе, поэтому следующий вызов продолжает с того места,
 * а не начинает заново.
 */

import { withHandler, ApiError, requireSecret } from './http.js';
import { generateStructured, GeminiError, hasGemini } from './gemini.js';
import { sbRpc, hasServiceKey } from './supabaseAdmin.js';
import {
  MARKUP_SCHEMA, MARKUP_VERSION, MARKUP_VOCABULARY, normalizeMarkup,
} from '../../shared/ai/markup.js';
import { MOOD_AXES, MOOD_LABELS } from '../../shared/config/recommendation.js';
import { TAG_LABELS_RU } from '../../shared/taxonomy/tagOntology.js';
import { logMetric } from './telemetry.js';
import { MODULE } from '../../shared/telemetry/events.js';
import { mapWithConcurrency } from './util.js';

/**
 * Сколько фильмов за вызов.
 *
 * Потолок задан не аппетитом, а временем функции: шестьдесят секунд
 * на всё. Лучше десять пачек, каждая из которых дошла до базы, чем
 * одна большая, оборвавшаяся на середине.
 */
const MAX_BATCH = 12;
const CONCURRENCY = 4;

const SYSTEM = `Ты размечаешь фильм по заданному словарю тем и по пяти осям настроения.

САМОЕ ВАЖНОЕ: исходи ТОЛЬКО из описания и ключевых слов, которые тебе дали. Не вспоминай фильм по названию. Если описание скудное — ставь confidence: "low" и разметь осторожно, а не додумывай сюжет. Уверенная разметка фильма, которого ты не знаешь, — худшая ошибка здесь: проверить её будет нечем.

Правила:
1. Теги — ТОЛЬКО из словаря, дословно. Вес 0..100: 100 — это про фильм целиком, 30 — присутствует, но не главное.
2. От 5 до 12 тегов. Один-два тега бесполезны, тридцать — шум.
3. Оси настроения указывай все пять, каждую 0..100, где 50 — нейтрально. Именно они отличают медленный политический эпос от яркого блокбастера, поэтому не жмись к середине: если фильм мрачный, ставь мрак 80, а не 60.
4. Жанр — не разметка. «Фантастика» ничего не говорит о том, каково это смотреть. Ищи то, чем этот фильм отличается от соседей по жанру.

Примеры. Обратите внимание, как далеко расходятся оси у разного кино — именно это и есть смысл разметки.

Описание: «На далёкой планете наследник знатного дома оказывается втянут в войну за контроль над ресурсом, от которого зависит вся империя. Пророчества, предательство, медленно сжимающаяся петля политических интриг.»
Разметка: tags — epic-scale 95, political 90, power-corruption 85, moral-weight 75, slow-burn 70, bleak-world 55; moods — energy 45, darkness 75, intellect 85, emotion 60, dynamism 35.
Почему так: эпос про власть, а не боевик. Динамика низкая, интеллект высокий, мрак заметно выше середины.

Описание: «Компания зверят отправляется через лес спасать потерявшегося друга, попадая в смешные передряги и учась работать вместе.»
Разметка: tags — animation 95, family 90, friendship 85, feel-good 80, easy-watch 75, adventure 60, whimsical 55; moods — energy 70, darkness 15, intellect 25, emotion 60, dynamism 60.
Почему так: мрак почти на нуле, интеллект низкий — и это не упрёк, а точное описание. Жаться к пятидесяти здесь было бы враньём.

Описание: «Группа подростков приезжает в заброшенный дом на выходные. Кто-то начинает убивать их одного за другим.»
Разметка: tags — slasher 95, horror 90, dread 85, survival 80, tension 80, gore 65; moods — energy 75, darkness 90, intellect 20, emotion 55, dynamism 85.
Почему так: предельный мрак и предельная динамика, интеллект низкий. Крайние значения здесь уместны.

Описание: «После смерти матери две сестры впервые за двадцать лет проводят неделю в родительском доме, разбирая вещи и молчание между собой.»
Разметка: tags — character-study 90, grief 90, siblings 85, emotional-weight 85, melancholy 80, chamber-piece 70, slow-burn 65; moods — energy 25, darkness 65, intellect 60, emotion 95, dynamism 15.
Почему так: почти нет движения, эмоции на максимуме. Динамика 15, а не 45.
`;

/** Словарь один на все вызовы: собирать его заново на каждый — трата. */
const GLOSSARY = MARKUP_VOCABULARY.map((t) => `${t} — ${TAG_LABELS_RU[t]}`).join('\n');
const AXES = MOOD_AXES.map((a) => `  ${a} (${MOOD_LABELS[a]})`).join('\n');

export const markupHandler = withHandler(
  { methods: ['POST', 'GET'], module: MODULE.DECK },
  async ({ req, query }) => {
    // Прогон стоит денег и меняет каталог — закрыт служебным секретом.
    requireSecret(req, query, 'CRON_SECRET');

    if (!hasGemini()) throw new ApiError(503, 'ai_not_configured', 'Не задан GEMINI_API_KEY');
    if (!hasServiceKey()) {
      throw new ApiError(503, 'not_configured', 'Не задан SUPABASE_SERVICE_ROLE_KEY');
    }

    const limit = Math.min(Number(query.get('limit')) || MAX_BATCH, MAX_BATCH);
    const dry = query.get('dry') === '1';
    const model = (process.env.GEMINI_MODEL_MARKUP ?? '').trim() || 'gemini-3.5-flash-lite';

    const films = await sbRpc('claim_markup_batch', {
      p_limit: limit,
      p_version: MARKUP_VERSION,
    });

    if (!films?.length) {
      return { done: 0, failed: 0, remaining: 0, note: 'неразмеченного больше нет' };
    }

    const results = await mapWithConcurrency(films, CONCURRENCY, async (film) => {
      const title = film.data;
      try {
        const raw = await generateStructured({
          model,
          system: SYSTEM,
          prompt: buildPrompt(title),
          schema: MARKUP_SCHEMA,
          maxTokens: 4096,
          temperature: 0.3,
        });

        const markup = normalizeMarkup(raw.data);
        if (!markup) throw new Error('модель вернула неполную разметку');

        if (!dry) {
          await sbRpc('save_markup', {
            p_id: film.id,
            p_markup: { ...markup, model },
            p_model: model,
            p_version: MARKUP_VERSION,
          });
        }

        return {
          ok: true,
          title: title.title,
          tags: Object.keys(markup.tags).length,
          top: Object.keys(markup.tags).slice(0, 5).map((t) => TAG_LABELS_RU[t] ?? t),
          moods: markup.moods,
          confidence: markup.confidence,
          dropped: markup.dropped,
        };
      } catch (error) {
        const reason = error instanceof GeminiError
          ? `${error.code}: ${error.message}`
          : String(error?.message ?? error);

        if (!dry) {
          await sbRpc('fail_markup', { p_id: film.id, p_reason: reason.slice(0, 300) });
        }
        return { ok: false, title: title.title, error: reason };
      }
    });

    const done = results.filter((r) => r.ok).length;
    if (done) logMetric('ai_markup', { value: done, context: { model } });

    return {
      model,
      claimed: films.length,
      done,
      failed: results.length - done,
      /** Что модель просила, но словарь не знает: подсказка, чего дописать. */
      dropped: [...new Set(results.flatMap((r) => r.dropped ?? []))],
      results,
    };
  },
);

function buildPrompt(title) {
  const keywords = Object.keys(title.tags ?? {});

  return [
    `Фильм: ${title.title}${title.year ? ` (${title.year})` : ''}`,
    title.originalTitle && title.originalTitle !== title.title
      ? `Оригинальное название: ${title.originalTitle}` : null,
    title.runtime ? `Длительность: ${title.runtime} мин` : null,
    keywords.length ? `Что уже известно из TMDB: ${keywords.join(', ')}` : null,
    '',
    'Описание:',
    title.overview,
    '',
    'Оси настроения:',
    AXES,
    '',
    'Словарь тем (только отсюда, дословно):',
    GLOSSARY,
  ].filter((line) => line !== null).join('\n');
}
