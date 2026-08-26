/**
 * Единая точка входа служебных эндпоинтов.
 *
 * Сведены по той же причине, что и телеграмные: на тарифе Hobby у Vercel
 * потолок в двенадцать серверлес-функций на выкладку. Каждый эндпоинт
 * отдельным файлом расходовал место в лимите, ничего не давая взамен —
 * работы в них на несколько строк.
 *
 * Адреса не изменились: `/api/ops/metrics`, `/api/ops/events`,
 * `/api/ops/digest` и `/api/ops/rooms-gc` доезжают сюда переписыванием
 * из vercel.json. Первые два зовёт приложение, последние два — крон,
 * и менять их значило бы чинить одно, ломая другое.
 */

import { digestHandler } from '../_lib/opsDigest.js';
import { eventsHandler } from '../_lib/opsEvents.js';
import { metricsHandler } from '../_lib/opsMetrics.js';
import { roomsGcHandler } from '../_lib/opsRoomsGc.js';
import { sendJson } from '../_lib/http.js';

const ROUTES = {
  digest: digestHandler,
  events: eventsHandler,
  metrics: metricsHandler,
  'rooms-gc': roomsGcHandler,
};

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers?.host ?? 'localhost'}`);

  // Последний сегмент пути — запасной вариант, когда переписывания нет.
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
