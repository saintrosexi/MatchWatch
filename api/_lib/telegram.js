/**
 * Валидация Telegram `initData`.
 *
 * Без проверки подписи любой может подставить произвольный telegram_id
 * и войти под чужим аккаунтом. Поэтому проверка обязательна и делается
 * ТОЛЬКО на сервере: secret = HMAC_SHA256("WebAppData", bot_token),
 * затем сверяем hash над data_check_string.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { BIZ, LEVEL, MODULE } from '../../shared/telemetry/events.js';
import { logBusinessEvent } from './telemetry.js';
import { ApiError } from './http.js';

/** Максимальный возраст initData: защита от переигрывания старого пакета. */
const MAX_AGE_SECONDS = Number(process.env.TELEGRAM_INITDATA_MAX_AGE ?? 24 * 3600);

export const hasBotToken = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);

export function validateInitData(initData, { botToken = process.env.TELEGRAM_BOT_TOKEN, maxAgeSeconds = MAX_AGE_SECONDS, now = Date.now() } = {}) {
  if (!botToken) {
    throw new ApiError(503, 'telegram_not_configured',
      'TELEGRAM_BOT_TOKEN не задан — вход через Telegram недоступен', { level: LEVEL.CRITICAL });
  }
  if (!initData || typeof initData !== 'string') {
    logBusinessEvent(BIZ.TELEGRAM_INITDATA_INVALID, {
      module: MODULE.AUTH_TELEGRAM, context: { reason: 'empty' },
    });
    throw new ApiError(401, 'initdata_missing', 'Telegram не передал данные авторизации');
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    logBusinessEvent(BIZ.TELEGRAM_INITDATA_INVALID, {
      module: MODULE.AUTH_TELEGRAM, context: { reason: 'no_hash' },
    });
    throw new ApiError(401, 'initdata_no_hash', 'Подпись Telegram отсутствует');
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash' && key !== 'signature')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(hash, 'utf8');
  const valid = a.length === b.length && timingSafeEqual(a, b);

  if (!valid) {
    logBusinessEvent(BIZ.TELEGRAM_INITDATA_INVALID, {
      module: MODULE.AUTH_TELEGRAM,
      level: LEVEL.ERROR,
      context: { reason: 'signature_mismatch', keys: [...params.keys()] },
    });
    throw new ApiError(401, 'initdata_invalid', 'Подпись Telegram не прошла проверку');
  }

  const authDate = Number(params.get('auth_date') ?? 0);
  const ageSeconds = Math.floor(now / 1000) - authDate;
  if (!authDate || ageSeconds > maxAgeSeconds) {
    logBusinessEvent(BIZ.TELEGRAM_INITDATA_EXPIRED, {
      module: MODULE.AUTH_TELEGRAM, context: { authDate, ageSeconds, maxAgeSeconds },
    });
    throw new ApiError(401, 'initdata_expired', 'Сессия Telegram устарела. Переоткройте приложение.');
  }

  let user = null;
  try {
    user = JSON.parse(params.get('user') ?? 'null');
  } catch {
    user = null;
  }
  if (!user?.id) {
    logBusinessEvent(BIZ.TELEGRAM_INITDATA_INVALID, {
      module: MODULE.AUTH_TELEGRAM, context: { reason: 'no_user' },
    });
    throw new ApiError(401, 'initdata_no_user', 'Telegram не передал профиль пользователя');
  }

  return {
    telegramId: String(user.id),
    user: {
      firstName: user.first_name ?? null,
      lastName: user.last_name ?? null,
      username: user.username ?? null,
      languageCode: user.language_code ?? 'ru',
      photoUrl: user.photo_url ?? null,
      isPremium: Boolean(user.is_premium),
    },
    authDate,
    /** Код комнаты из deep-link `t.me/bot/app?startapp=CODE`. */
    startParam: params.get('start_param') ?? null,
    chatInstance: params.get('chat_instance') ?? null,
  };
}
