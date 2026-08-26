/**
 * GET /api/ops/rooms-gc  (Vercel Cron, ежечасно)
 *
 * TTL комнат. Кодов всего пять цифр — пространство конечное, и без уборки
 * мусорные комнаты начнут конфликтовать с новыми.
 *
 * Сама уборка живёт в SQL-функции gc_rooms: удаление каскадом снимает
 * участников, свайпы, мэтчи и списки одной транзакцией.
 */

import { withHandler, ApiError, requireSecret } from '../_lib/http.js';
import { sbRpc, hasServiceKey } from '../_lib/supabaseAdmin.js';
import { logMetric, telemetryEnv } from '../_lib/telemetry.js';
import { MODULE } from '../../shared/telemetry/events.js';
import { clampInt } from '../_lib/util.js';

export default withHandler({ methods: ['GET', 'POST'], module: MODULE.ROOMS_TTL }, async ({ req, query }) => {
  assertCronAuthorized(req, query);

  if (!hasServiceKey()) {
    throw new ApiError(503, 'ops_not_configured', 'Уборка недоступна: не задан SUPABASE_SERVICE_ROLE_KEY');
  }

  const idleHours = clampInt(query.get('idleHours'), 1, 168, 12);
  const removed = await sbRpc('gc_rooms', { p_idle_hours: idleHours });

  if (removed > 0) {
    logMetric('rooms_gc_removed', { value: removed, context: { env: telemetryEnv, idleHours } });
  }

  return { removed: Number(removed ?? 0), idleHours };
});

/**
 * Крон-эндпоинты меняют данные — уборка сносит комнаты вместе с историей.
 * Открытыми они быть не могут нигде, включая превью: адрес превью-деплоя
 * так же доступен из интернета, как и боевой.
 */
export function assertCronAuthorized(req, query) {
  requireSecret(req, query, 'CRON_SECRET');
}
