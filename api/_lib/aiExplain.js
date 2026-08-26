/**
 * POST /api/ai/explain — почему именно этот фильм.
 *
 * Движок уже знает ответ: он считает, какие теги профиля совпали
 * с тегами фильма, и насколько уверен в подборе. Не хватает только
 * фразы по-русски — а это и есть работа для языка.
 *
 * Жёсткое правило: модели отдаётся **только** структура совпадения.
 * Про сюжет её не спрашивают никогда. Пересказ у TMDB уже есть, а
 * выдумка про фильм — самая заметная и самая позорная ошибка,
 * какую здесь можно допустить: человек видит постер и сразу поймёт,
 * что приложение сочиняет.
 */

import { withHandler, ApiError } from './http.js';
import { generateStructured, GeminiError, hasGemini } from './gemini.js';
import { logMetric } from './telemetry.js';
import { LEVEL, MODULE } from '../../shared/telemetry/events.js';

const SYSTEM = `Ты объясняешь, почему подборка предложила человеку конкретный фильм.

Тебе дают ТОЛЬКО данные о совпадении: какие темы человек любит, какие темы есть у фильма, что из этого совпало, и чего человек хотел сегодня. Сюжета фильма ты не знаешь.

Правила:
1. Одно предложение, по-русски, не длиннее 140 символов.
2. Опирайся ИСКЛЮЧИТЕЛЬНО на переданные совпадения. Ничего не додумывай про сюжет, актёров, режиссёра или события фильма — этих данных у тебя нет.
3. Не пересказывай фильм и не хвали его. Объясняй выбор, а не фильм.
4. Если совпадений мало, так и скажи честно: это разведка, попытка расширить вкус.
5. Без восклицаний и рекламных оборотов. Спокойно и по делу.

Хорошо: «Вы оба любите медленные детективы, а сегодня хотели подумать.»
Хорошо: «Совпадений мало — это попытка нащупать новое рядом с вашим интересом к фантастике.»
Плохо: «Захватывающий триллер с неожиданным финалом!» — это пересказ и реклама.`;

const SCHEMA = {
  type: 'object',
  properties: {
    reason: { type: 'string', description: 'Одно предложение по-русски, не длиннее 140 символов.' },
  },
  required: ['reason'],
};

export const explainHandler = withHandler(
  { methods: ['POST'], module: MODULE.DECK },
  async ({ body }) => {
    if (!hasGemini()) {
      throw new ApiError(503, 'ai_not_configured',
        'Объяснение недоступно: не задан GEMINI_API_KEY');
    }

    const payload = normalize(body);
    if (!payload.title) {
      throw new ApiError(400, 'no_title', 'Не указан фильм');
    }

    const started = Date.now();

    let result;
    try {
      result = await generateStructured({
        system: SYSTEM,
        prompt: buildPrompt(payload),
        schema: SCHEMA,
        maxTokens: 2048,
        temperature: 0.4,
      });
    } catch (error) {
      if (error instanceof GeminiError && error.code === 'truncated') {
        throw new ApiError(502, 'ai_truncated', error.message, { level: LEVEL.ERROR });
      }
      throw new ApiError(
        error instanceof GeminiError ? (error.status ?? 502) : 502,
        'ai_failed',
        error?.message ?? 'Не удалось объяснить выбор',
      );
    }

    const reason = String(result.data?.reason ?? '').trim();
    if (!reason) {
      throw new ApiError(502, 'ai_empty', 'Модель не вернула объяснение');
    }

    logMetric('ai_explain', {
      value: 1,
      context: { model: result.model, tookMs: Date.now() - started, ...result.usage },
    });

    return { reason, model: result.model, usage: result.usage };
  },
);

/**
 * Наружу уезжают только подписи тем — ни истории решений, ни профиля
 * целиком. Объяснение не стоит того, чтобы отдавать вкус человека
 * стороннему сервису.
 */
function normalize(body) {
  const list = (value, limit) => (Array.isArray(value) ? value : [])
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, limit);

  return {
    title: String(body?.title ?? '').trim().slice(0, 120),
    year: Number.isFinite(Number(body?.year)) ? Number(body.year) : null,
    sharedTags: list(body?.sharedTags, 8),
    titleTags: list(body?.titleTags, 8),
    tasteTags: list(body?.tasteTags, 8),
    wanted: String(body?.wanted ?? '').trim().slice(0, 200),
    partners: list(body?.partners, 5),
    confidence: ['strong', 'weak', 'explore'].includes(body?.confidence) ? body.confidence : null,
  };
}

function buildPrompt(p) {
  const lines = [
    `Фильм: ${p.title}${p.year ? ` (${p.year})` : ''}`,
    p.titleTags.length ? `Темы фильма: ${p.titleTags.join(', ')}` : null,
    p.tasteTags.length ? `Что человек любит: ${p.tasteTags.join(', ')}` : null,
    p.sharedTags.length
      ? `Совпало: ${p.sharedTags.join(', ')}`
      : 'Совпадений по темам нет — карточка предложена как разведка.',
    p.wanted ? `Чего хотели сегодня: ${p.wanted}` : null,
    p.partners.length ? `Смотрят вместе: ${p.partners.join(', ')}` : null,
    p.confidence ? `Уверенность подбора: ${p.confidence}` : null,
  ];

  return lines.filter(Boolean).join('\n');
}
