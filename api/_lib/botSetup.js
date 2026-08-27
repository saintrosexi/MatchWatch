/**
 * POST /api/telegram/setup — разовая настройка бота.
 *
 * Делает три вещи, каждую из которых иначе пришлось бы делать руками
 * через curl и не забыть ни одну:
 *   1. регистрирует вебхук с секретным заголовком;
 *   2. записывает в базу адрес и секрет обработчика очереди, чтобы
 *      pg_net знал, куда стучаться;
 *   3. проставляет список команд и кнопку меню.
 *
 * Закрыт тем же секретом, что и остальные служебные эндпоинты: он
 * меняет настройки живого бота.
 *
 * GET показывает текущее состояние, ничего не меняя, — этим удобно
 * проверять настройку, не переписывая её заново.
 */

import { withHandler, ApiError, requireSecret, publicBase } from './http.js';
import { sbRpc, hasServiceKey } from './supabaseAdmin.js';
import { callBot, miniAppUrl, appLink } from './botApi.js';
import { describeBot, hasBotToken } from './telegram.js';
import { MODULE } from '../../shared/telemetry/events.js';

export const setupHandler = withHandler({ methods: ['GET', 'POST'], module: MODULE.BOT }, async ({ req, query }) => {
  requireSecret(req, query, 'CRON_SECRET');

  const bot = await describeBot();
  const base = publicBase(req);

  if (req.method === 'GET') {
    const info = await callBot('getWebhookInfo', {});
    return {
      bot,
      miniAppUrl: miniAppUrl(),
      /*
       * Ссылка, которую бот кладёт под инлайн-карточки. Отдельной
       * переменной у неё нет — она склеивается из имени бота и короткого
       * имени приложения. Показываем собранной: если вместо `t.me/...`
       * здесь окажется адрес сайта, значит эти две переменные до функции
       * не доехали, и карточки будут открывать браузер вместо приложения.
       */
      appLink: appLink(),
      appLinkToRoom: appLink('23356'),
      expectedWebhook: `${base}/api/telegram/webhook`,
      webhook: info.ok ? info.result : { error: info.description },
      ready: readiness(),
    };
  }

  const missing = Object.entries(readiness())
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  if (missing.length) {
    throw new ApiError(503, 'bot_not_configured',
      `Не заданы переменные окружения: ${missing.join(', ')}`);
  }

  const webhookUrl = `${base}/api/telegram/webhook`;

  const webhook = await callBot('setWebhook', {
    url: webhookUrl,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET.trim(),
    // Только то, на что бот действительно отвечает: сообщения и
    // инлайн-карточки. Остальные типы обновлений жгли бы вызовы
    // функции впустую.
    allowed_updates: ['message', 'inline_query'],
    drop_pending_updates: true,
  });

  if (!webhook.ok) {
    throw new ApiError(502, 'webhook_failed', `Telegram отказал: ${webhook.description}`);
  }

  // Куда база зовёт обработчик очереди.
  await sbRpc('set_bot_config', { p_key: 'dispatch_url', p_value: `${base}/api/telegram/dispatch` });
  await sbRpc('set_bot_config', { p_key: 'dispatch_secret', p_value: process.env.BOT_DISPATCH_SECRET.trim() });

  const commands = await callBot('setMyCommands', {
    commands: [
      { command: 'start', description: 'Открыть MatchWatch' },
      { command: 'help', description: 'Что я умею' },
      { command: 'stop', description: 'Выключить уведомления' },
    ],
  });

  const menu = await callBot('setChatMenuButton', {
    menu_button: { type: 'web_app', text: 'MatchWatch', web_app: { url: miniAppUrl() } },
  });

  return {
    bot,
    webhookUrl,
    webhook: webhook.ok,
    commands: commands.ok,
    menuButton: menu.ok || menu.description,
  };
});

/** Что должно быть задано, чтобы бот заработал целиком. */
function readiness() {
  return {
    TELEGRAM_BOT_TOKEN: hasBotToken(),
    TELEGRAM_WEBHOOK_SECRET: Boolean((process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim()),
    BOT_DISPATCH_SECRET: Boolean((process.env.BOT_DISPATCH_SECRET ?? '').trim()),
    TELEGRAM_MINIAPP_URL: Boolean(miniAppUrl()),
    SUPABASE_SERVICE_ROLE_KEY: hasServiceKey(),
  };
}

/**
 * Публичный адрес этого деплоя.
 *
 * Берём из переменной окружения, а не из заголовка Host: заголовок
 * подставляет клиент, и вебхук уехал бы туда, куда попросил чужой
 * запрос. Host остаётся запасным вариантом для локальной отладки.
 */
