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
import { listModels, geminiModel, hasGemini, GeminiError } from '../_lib/gemini.js';
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

    return {
      configured,
      available: models.some((m) => m.name === configured),
      models,
    };
  },
);

const ROUTES = {
  interpret: interpretHandler,
  explain: explainHandler,
  models: modelsHandler,
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
