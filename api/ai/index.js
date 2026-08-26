/**
 * Единая точка входа для запросов к модели.
 *
 * Сведено в один файл по той же причине, что телеграмные и служебные
 * эндпоинты: на тарифе Hobby потолок — двенадцать серверлес-функций,
 * и каждый маршрут отдельным файлом расходовал бы его впустую.
 *
 * Адреса: /api/ai/interpret, /api/ai/explain, /api/ai/models —
 * доезжают сюда переписыванием из vercel.json.
 */

import { interpretHandler } from '../_lib/aiInterpret.js';
import { explainHandler } from '../_lib/aiExplain.js';
import { markupHandler } from '../_lib/aiMarkup.js';
import {
  listModels, geminiModel, geminiFastModel, hasGemini, GeminiError, generateStructured,
} from '../_lib/gemini.js';
import { requireSecret } from '../_lib/http.js';
import { withHandler, ApiError, sendJson } from '../_lib/http.js';
import { MODULE } from '../../shared/telemetry/events.js';

/**
 * Разбор запроса — единственное место в приложении, где человек ждёт
 * ответа модели. Ждать он должен честно: обрезать рассуждения на
 * полуслове ради красивого времени отклика значит отдать неполный
 * разбор и собрать подборку не по запросу.
 *
 * Шестьдесят секунд — потолок тарифа. На практике разбор занимает
 * секунды, но запас нужен для тяжёлых запросов и холодного старта.
 */
export const maxDuration = 60;

/**
 * Какие модели доступны ключу.
 *
 * Линейка Gemini обновляется быстрее, чем этот код, и угадывать имена
 * по памяти — верный способ получить «модель недоступна» без понимания
 * почему. Список приходит от Google.
 */
const modelsHandler = withHandler(
  { methods: ['GET'], module: MODULE.DECK },
  async () => {
    if (!hasGemini()) {
      throw new ApiError(503, 'ai_not_configured', 'Не задан GEMINI_API_KEY');
    }

    let models;
    try {
      models = await listModels();
    } catch (error) {
      /*
       * Без этого неверный ключ выходил наружу «внутренней ошибкой» —
       * то есть ровно тем сообщением, которое не подсказывает ничего.
       * А диагностика для того и написана, чтобы называть причину.
       */
      if (error instanceof GeminiError) {
        throw new ApiError(error.status === 400 ? 401 : (error.status ?? 502),
          `ai_${error.code}`, error.message);
      }
      throw error;
    }

    const configured = geminiModel();
    const fast = geminiFastModel();

    return {
      configured,
      fast,
      available: models.some((m) => m.name === configured),
      fastAvailable: models.some((m) => m.name === fast),
      models,
    };
  },
);

/**
 * Замер: сколько на самом деле думает каждая модель.
 *
 * Написано потому, что выбирать модель по названию — гадание. Разница
 * во времени ответа идёт от объёма рассуждений, а он не следует
 * ни из номера версии, ни из слова «lite»: цифры бывают неожиданными
 * в обе стороны. Одна и та же задача, одна и та же схема, замер на месте.
 *
 * Закрыт служебным секретом: каждый прогон — настоящие обращения
 * к модели, то есть чужие деньги.
 */
const benchHandler = withHandler(
  { methods: ['GET', 'POST'], module: MODULE.DECK },
  async ({ req, query }) => {
    requireSecret(req, query, 'CRON_SECRET');

    if (!hasGemini()) {
      throw new ApiError(503, 'ai_not_configured', 'Не задан GEMINI_API_KEY');
    }

    const candidates = (query.get('models') ?? '')
      .split(',').map((m) => m.trim()).filter(Boolean).slice(0, 8);

    if (!candidates.length) {
      throw new ApiError(400, 'no_models',
        'Укажите models=имя1,имя2 — что мерить, решает вызывающий, а не догадка');
    }

    const thinkingLevel = query.get('thinking');

    const results = [];
    for (const model of candidates) {
      const started = Date.now();
      try {
        const out = await generateStructured({
          model,
          system: 'Ты объясняешь выбор фильма одним предложением по-русски. Ничего не додумывай.',
          prompt: 'Темы фильма: фантастика, эпический масштаб, космос.\n'
            + 'Что человек любит: фантастика, эпический масштаб.\n'
            + 'Совпало: фантастика, эпический масштаб.\n'
            + 'Чего хотели сегодня: подумать.',
          schema: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] },
          maxTokens: 2048,
          ...(thinkingLevel ? { thinking: { thinkingLevel } } : {}),
        });
        results.push({
          model,
          ms: Date.now() - started,
          thoughtTokens: out.usage.thoughtTokens,
          outputTokens: out.usage.outputTokens,
          reason: out.data?.reason ?? null,
        });
      } catch (error) {
        results.push({
          model,
          ms: Date.now() - started,
          error: error instanceof GeminiError ? `${error.code}: ${error.message}` : String(error?.message),
        });
      }
    }

    return { thinkingLevel: thinkingLevel ?? null, results };
  },
);

const ROUTES = {
  interpret: interpretHandler,
  explain: explainHandler,
  models: modelsHandler,
  bench: benchHandler,
  markup: markupHandler,
};

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers?.host ?? 'localhost'}`);
  const action = url.searchParams.get('action')
    ?? url.pathname.replace(/\/$/, '').split('/').pop();

  const route = ROUTES[action];

  if (!route) {
    sendJson(res, 404, {
      ok: false,
      error: { code: 'not_found', message: `Неизвестное действие: ${action}` },
    });
    return;
  }

  await route(req, res);
}
