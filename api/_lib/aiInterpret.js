/**
 * POST /api/ai/interpret — «чего хочется сегодня» словами.
 *
 * Шесть кнопок настроения покрывают шесть случаев, а люди формулируют
 * иначе: «лёгкое, но не тупое», «поплакать, но не про болезни»,
 * «что-нибудь как Достучаться до небес, только короче». Здесь фраза
 * превращается в оси настроения, теги и жёсткие фильтры — то есть
 * в то, что движок уже умеет применять.
 *
 * Модель не выбирает фильмы и не знает каталога. Она переводит.
 * Подборку по-прежнему собирают векторы — быстро, повторяемо и без
 * обращения к сети на каждую карточку.
 */

import { withHandler, ApiError } from './http.js';
import { generateStructured, GeminiError, hasGemini, geminiModel } from './gemini.js';
import {
  AI_TAG_GLOSSARY, INTERPRETATION_SCHEMA, TMDB_GENRES, requestFromInterpretation,
} from '../../shared/ai/interpretation.js';
import { MOOD_AXES, MOOD_LABELS } from '../../shared/config/recommendation.js';
import { logError, logMetric } from './telemetry.js';
import { LEVEL, MODULE } from '../../shared/telemetry/events.js';

/** Длиннее человек не формулирует, а длинный ввод — это уже вставленный текст. */
const MAX_INPUT = 400;

const SYSTEM = `Ты переводишь запрос человека о кино в структуру. Ты НЕ советуешь фильмы и НЕ знаешь каталога — названий фильмов в ответе быть не должно.

Правила:
1. Оси настроения указывай ТОЛЬКО те, о которых запрос действительно говорит. Молчание — не требование: если про мрачность ничего не сказано, ось darkness не указывай вовсе. Приписать человеку требование, которого он не выдвигал, — худшая ошибка здесь.
2. Теги выбирай ТОЛЬКО из предложенного словаря, дословно. Выдуманный тег будет отброшен.
3. Вес тега 0..1: насколько это важно в запросе.
4. Жёсткие фильтры ставь, только если человек назвал их прямо (год, длительность, рейтинг, жанр). «Хорошее кино» — это не minRating, а настроение.
5. Если человек назвал фильм как ориентир — разложи на теги и оси то, чем этот фильм является, а сам фильм не упоминай.
6. summary — одна короткая фраза по-русски о том, что ты понял. Она показывается человеку до сборки подборки, поэтому будь точен и не обещай лишнего.`;

export const interpretHandler = withHandler(
  { methods: ['POST'], module: MODULE.DECK },
  async ({ body, req }) => {
    if (!hasGemini()) {
      throw new ApiError(503, 'ai_not_configured',
        'Разбор запроса недоступен: не задан GEMINI_API_KEY');
    }

    const text = String(body?.text ?? '').trim();
    if (!text) {
      throw new ApiError(400, 'empty_request', 'Пустой запрос — нечего разбирать');
    }
    if (text.length > MAX_INPUT) {
      throw new ApiError(400, 'too_long',
        `Слишком длинно: ${text.length} символов при пределе ${MAX_INPUT}. Скажите короче.`);
    }

    const started = Date.now();

    let result;
    try {
      result = await generateStructured({
        system: SYSTEM,
        prompt: buildPrompt(text),
        schema: INTERPRETATION_SCHEMA,
        /*
         * Потолок с большим запасом. У думающих моделей рассуждения
         * тратят тот же бюджет, что и ответ, и скупость здесь оборвала бы
         * разбор на середине — а обрезанный разбор мы не принимаем.
         */
        maxTokens: 8192,
        temperature: 0.2,
        // Клиентский AbortSignal сюда не пробрасываем: человек ждёт
        // ответа честно, и обрывать модель на полуслове незачем.
      });
    } catch (error) {
      throw toApiError(error);
    }

    const request = requestFromInterpretation(result.data);

    if (!Object.keys(request.axes).length && !request.tags.length
        && !Object.keys(request.filters).length) {
      /*
       * Пустой разбор — не результат. Отдать его значило бы собрать
       * подборку «как обычно» и сделать вид, что запрос учтён.
       */
      throw new ApiError(422, 'nothing_understood',
        'Не удалось понять запрос. Попробуйте сказать иначе — например, '
        + '«лёгкое и смешное, не длиннее двух часов».');
    }

    if (request.dropped.length) {
      // Не ошибка — но если модель регулярно выдумывает одно и то же,
      // это повод дописать тег в словарь, а не гадать.
      logError({
        message: `ии: отброшены несуществующие теги: ${request.dropped.join(', ')}`,
        module: MODULE.DECK,
        level: LEVEL.INFO,
      });
    }

    logMetric('ai_interpret', {
      value: 1,
      context: {
        model: result.model,
        tookMs: Date.now() - started,
        axes: Object.keys(request.axes).length,
        tags: request.tags.length,
        dropped: request.dropped.length,
        ...result.usage,
      },
    });

    return {
      request: {
        axes: request.axes,
        tags: request.tags,
        filters: request.filters,
        summary: request.summary,
        text,
      },
      model: result.model,
      usage: result.usage,
    };
  },
);

function buildPrompt(text) {
  const axes = MOOD_AXES
    .map((axis) => `  ${axis} (${MOOD_LABELS[axis]}): 0 — минимум, 50 — нейтрально, 100 — максимум`)
    .join('\n');

  const glossary = Object.entries(AI_TAG_GLOSSARY)
    .map(([tag, label]) => `${tag} — ${label}`)
    .join('\n');

  const genres = Object.entries(TMDB_GENRES)
    .map(([id, label]) => `${id} — ${label}`)
    .join(', ');

  return `Оси настроения:
${axes}

Словарь тегов (выбирать только отсюда, дословно):
${glossary}

Жанры для жёсткого фильтра (id — название):
${genres}

Запрос человека:
"""
${text}
"""`;
}

/** Ошибки модели доезжают до человека объяснением, а не «что-то пошло не так». */
function toApiError(error) {
  if (!(error instanceof GeminiError)) {
    return new ApiError(502, 'ai_failed', error?.message ?? 'Не удалось разобрать запрос');
  }

  if (error.code === 'truncated') {
    return new ApiError(502, 'ai_truncated', error.message, { level: LEVEL.ERROR });
  }
  if (error.code === 'unknown_model') {
    return new ApiError(503, 'ai_model_unknown', error.message, { level: LEVEL.CRITICAL });
  }
  if (error.code === 'no_key') {
    return new ApiError(503, 'ai_not_configured',
      `Разбор недоступен: не задан GEMINI_API_KEY (модель ${geminiModel()})`);
  }

  return new ApiError(error.status ?? 502, `ai_${error.code}`, error.message);
}
