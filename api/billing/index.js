/**
 * Единая точка входа платёжных эндпоинтов.
 *
 * Как и у телеграмных: на тарифе Hobby у Vercel потолок — двенадцать
 * серверлес-функций на выкладку, и три отдельных файла (`status`,
 * `promo`, `invoice`) съели бы четверть оставшегося запаса. Логика
 * живёт в `_lib/billing.js`, файлы оттуда функциями не считаются.
 *
 * Публичные адреса собираются переписыванием из vercel.json:
 * `/api/billing/status`, `/api/billing/promo`, `/api/billing/invoice`.
 */

import { withHandler, sendJson } from '../_lib/http.js';
import { statusAction, promoAction, invoiceAction } from '../_lib/billing.js';
import { MODULE } from '../../shared/telemetry/events.js';

const ROUTES = {
  status: withHandler({ methods: ['GET'], module: MODULE.BOT }, statusAction),
  promo: withHandler({ methods: ['POST'], module: MODULE.BOT }, promoAction),
  invoice: withHandler({ methods: ['POST'], module: MODULE.BOT }, invoiceAction),
};

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers?.host ?? 'localhost'}`);

  // Последний сегмент — запасной путь для локального запуска без переписывания.
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
