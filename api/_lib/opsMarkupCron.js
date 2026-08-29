/**
 * GET|POST /api/ops/markup-cron — настройка автопилота разметки.
 *
 * База зовёт разметку сама, по расписанию, — а значит ей нужно знать
 * адрес и секрет. Ни того, ни другого pg_net сам не выяснит: переменных
 * окружения Vercel он не видит.
 *
 * Написано отдельным эндпоинтом, а не вписано руками в базу, ровно по
 * одной причине: секрет так и остаётся в окружении сервера. Он читает
 * его у себя и передаёт дальше сам; человеку не приходится копировать
 * его в SQL, а значит и ронять в историю команд, в переписку и в логи.
 *
 * GET показывает, что настроено и сколько осталось работы, ничего
 * не меняя.
 */

import { withHandler, ApiError, requireSecret, publicBase } from './http.js';
import { sbRpc, hasServiceKey } from './supabaseAdmin.js';
import { MODULE } from '../../shared/telemetry/events.js';

/**
 * Сколько фильмов берётся за один заход.
 *
 * Шесть при заходе раз в четверть часа — около шестисот в сутки.
 * Столько выдерживают два ключа Gemini; на одном пришлось бы держать
 * четыре, иначе дневная квота выбивается за час и весь остаток суток
 * автопилот стучится в стену.
 *
 * Быстрее не нужно и при трёх ключах: очередь конечна, а каталог
 * пополняется десятками фильмов в день — догнав его, автопилот
 * работает вхолостую.
 */
const BATCH = 6;

export const markupCronHandler = withHandler(
  { methods: ['GET', 'POST'], module: MODULE.DECK },
  async ({ req, query }) => {
    requireSecret(req, query, 'CRON_SECRET');

    if (!hasServiceKey()) {
      throw new ApiError(503, 'not_configured', 'Не задан SUPABASE_SERVICE_ROLE_KEY');
    }

    const backlog = await sbRpc('markup_backlog', {});

    if (req.method === 'GET') {
      return { backlog, batch: BATCH, note: 'POST — записать адрес и секрет в базу' };
    }

    const base = publicBase(req);
    const url = `${base}/api/ai/markup?limit=${BATCH}`;

    await sbRpc('set_ops_config', { p_key: 'markup_url', p_value: url });
    await sbRpc('set_ops_config', {
      p_key: 'markup_secret',
      p_value: process.env.CRON_SECRET.trim(),
    });

    /*
     * Пауза снимается здесь же. Настройку зовут руками, то есть человек
     * сейчас смотрит на результат, — и застарелая пауза от вчерашней
     * кончившейся квоты выглядела бы как «настроил, а оно молчит».
     */
    await sbRpc('set_ops_config', {
      p_key: 'markup_paused_until',
      p_value: new Date(0).toISOString(),
    });

    return { url, batch: BATCH, backlog, schedule: 'каждые 15 минут' };
  },
);

