/**
 * POST /api/auth/telegram   { initData }
 *
 * Единственное место, где Telegram-пользователь превращается в аккаунт.
 *
 * Порядок такой:
 *   1. Проверяем подпись initData секретом бота. Без этой проверки любой
 *      может подставить чужой telegram_id — подделать тело запроса ничего
 *      не стоит.
 *   2. Выводим учётные данные детерминированно из telegram_id:
 *        email    = tg-<id>@telegram.matchwatch.invalid
 *        password = HMAC-SHA256(bot_token, "mw-auth:" + telegram_id)
 *      Пароль невозможно угадать, не зная токена бота, а токен живёт
 *      только на сервере.
 *   3. Отдаём их клиенту, и тот входит обычным способом.
 *
 * Почему так, а не через Admin API: этот путь не требует service_role.
 * Один секрет вместо двух, а гарантия та же — учётные данные выдаются
 * исключительно после успешной проверки подписи Telegram.
 */

import { createHmac } from 'node:crypto';
import { withHandler, badRequest, ApiError } from '../_lib/http.js';
import { validateInitData } from '../_lib/telegram.js';
import { logMetric } from '../_lib/telemetry.js';
import { METRIC, MODULE } from '../../shared/telemetry/events.js';
import { normalizeRoomCode } from '../../shared/model/roomCode.js';

/** Служебный домен: письма туда никогда не уходят, это просто ключ аккаунта. */
export const telegramEmail = (telegramId) => `tg-${telegramId}@telegram.matchwatch.invalid`;

function derivePassword(telegramId, botToken) {
  return createHmac('sha256', botToken)
    .update(`mw-auth:${telegramId}`)
    .digest('base64url')
    .slice(0, 40);
}

export default withHandler({ methods: ['POST'], module: MODULE.AUTH_TELEGRAM }, async ({ body }) => {
  const initData = body?.initData;
  if (!initData) throw badRequest('initdata_required', 'Не передан initData');

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new ApiError(503, 'telegram_not_configured',
      'Вход через Telegram не настроен: не задан TELEGRAM_BOT_TOKEN');
  }

  const verified = validateInitData(initData, { botToken });

  const displayName = [verified.user.firstName, verified.user.lastName].filter(Boolean).join(' ')
    || verified.user.username
    || 'Зритель';

  logMetric(METRIC.SIGN_IN, { context: { provider: 'telegram', telegramId: verified.telegramId } });

  return {
    email: telegramEmail(verified.telegramId),
    password: derivePassword(verified.telegramId, botToken),
    /** Уезжает в user_metadata: профиль и связку заполнит триггер в базе. */
    metadata: {
      display_name: displayName,
      photo_url: verified.user.photoUrl ?? null,
      provider: 'telegram',
      external_key: verified.telegramId,
      locale: verified.user.languageCode ?? 'ru',
    },
    telegram: verified.user,
    /** Комната из deep-link — клиент откроет её сразу после входа. */
    startRoom: normalizeRoomCode(verified.startParam),
  };
});
