/**
 * POST /api/telegram/webhook — входящие сообщения бота.
 *
 * Telegram шлёт сюда каждое обновление. Проверка — по заголовку
 * `X-Telegram-Bot-Api-Secret-Token`, который задаётся при регистрации
 * вебхука: адрес эндпоинта публичный, и без сверки писать боту от имени
 * Telegram смог бы кто угодно.
 *
 * Обработчик почти всегда отвечает 200, даже когда внутри что-то
 * сломалось. Telegram повторяет неудачные доставки, и ошибка в разборе
 * одного сообщения иначе превращается в бесконечный поток одного и того
 * же обновления. Единственное исключение — неверный секрет: такому
 * запросу отвечать «принято» нельзя.
 */

import { withHandler, ApiError } from './http.js';
import { sbSelect, sbInsert, sbUpdate, hasServiceKey } from './supabaseAdmin.js';
import {
  sendMessage, openAppButton, answerInlineQuery, appLink, linkButton, miniAppUrl, TEXTS,
} from './botApi.js';
import { logError, logMetric } from './telemetry.js';
import { LEVEL, METRIC, MODULE } from '../../shared/telemetry/events.js';
import { timingSafeEqual } from 'node:crypto';

export const webhookHandler = withHandler({ methods: ['POST'], module: MODULE.BOT }, async ({ req, body }) => {
  assertFromTelegram(req);

  if (!hasServiceKey()) {
    throw new ApiError(503, 'bot_not_configured',
      'Бот недоступен: не задан SUPABASE_SERVICE_ROLE_KEY');
  }

  try {
    await handleUpdate(body ?? {});
  } catch (error) {
    // Разобрать не смогли — но подтверждаем приём, иначе Telegram
    // будет слать это же обновление по кругу.
    logError({
      message: 'bot: не удалось обработать обновление',
      module: MODULE.BOT,
      level: LEVEL.WARNING,
      error,
    });
  }

  return { handled: true };
});

/**
 * Секрет вебхука обязателен.
 *
 * Без переменной окружения эндпоинт закрывается, а не открывается:
 * забытая переменная не должна тихо превращать бота в открытый вход.
 */
function assertFromTelegram(req) {
  const expected = (process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();
  if (!expected) {
    throw new ApiError(503, 'secret_not_configured',
      'Вебхук закрыт: не задан TELEGRAM_WEBHOOK_SECRET', { level: LEVEL.CRITICAL });
  }

  const provided = req.headers?.['x-telegram-bot-api-secret-token'] ?? '';
  const a = Buffer.from(String(provided), 'utf8');
  const b = Buffer.from(expected, 'utf8');

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ApiError(401, 'unauthorized', 'Запрос не от Telegram', { level: LEVEL.WARNING });
  }
}

async function handleUpdate(update) {
  if (update.inline_query) {
    await onInlineQuery(update.inline_query);
    return;
  }

  const message = update.message ?? update.edited_message;
  if (!message?.chat || message.chat.type !== 'private') return;

  const from = message.from ?? {};
  const chatId = message.chat.id;
  const telegramId = String(from.id ?? chatId);
  const text = String(message.text ?? '').trim();

  const [command, ...rest] = text.split(/\s+/);
  const payload = rest.join(' ');

  if (command === '/start') {
    await onStart({ telegramId, chatId, from, payload });
    return;
  }

  if (command === '/stop' || command === '/mute') {
    await setNotify(telegramId, false);
    await sendMessage(chatId, TEXTS.muted);
    return;
  }

  if (command === '/help') {
    await sendMessage(chatId, TEXTS.help, { keyboard: openAppButton() });
    return;
  }

  await sendMessage(chatId, TEXTS.fallback, { keyboard: openAppButton() });
}

/**
 * `/start` — единственное место, где появляется право писать человеку.
 *
 * Telegram не даёт боту обратиться первым к тому, кто не нажимал Start,
 * поэтому строка в `telegram_chats` означает именно разрешение, а не
 * «мы его где-то видели». Повторный /start снимает и блокировку, и
 * прежний отказ от уведомлений: человек вернулся сам.
 */
async function onStart({ telegramId, chatId, from, payload }) {
  const userId = await linkedUserId(telegramId);

  await sbInsert('telegram_chats', [{
    telegram_id: telegramId,
    chat_id: chatId,
    user_id: userId,
    username: from.username ?? null,
    blocked_at: null,
    notify: true,
  }], { upsert: true, onConflict: 'telegram_id' });

  logMetric(METRIC.BOT_STARTED, {
    userId,
    context: { linked: Boolean(userId), invitedToRoom: Boolean(payload) },
  });

  if (!miniAppUrl()) {
    // Кнопки не будет, и это видно снаружи — честнее сказать прямо.
    logError({
      message: 'bot: не задан TELEGRAM_MINIAPP_URL — кнопка «Открыть» не показывается',
      module: MODULE.BOT,
      level: LEVEL.CRITICAL,
    });
  }

  const roomCode = parseRoomPayload(payload);
  if (roomCode) {
    await sendMessage(chatId, TEXTS.startWithRoom(roomCode), {
      // Голый код, как в `?startapp=CODE`: приложение читает start_param
      // одной функцией, и второй формат ей знать незачем.
      keyboard: openAppButton(`Войти в комнату ${roomCode}`, { startParam: roomCode }),
    });
    return;
  }

  await sendMessage(chatId, TEXTS.start, { keyboard: openAppButton() });
}

/** `/start room_23356` — приглашение в конкретную комнату. */
export function parseRoomPayload(payload) {
  const match = /^room[_-]?(\d{5})$/i.exec(String(payload ?? '').trim());
  return match ? match[1] : null;
}

async function linkedUserId(telegramId) {
  const rows = await sbSelect('identities', {
    select: 'user_id',
    provider: 'eq.telegram',
    external_key: `eq.${telegramId}`,
    limit: 1,
  });
  return rows?.[0]?.user_id ?? null;
}

async function setNotify(telegramId, notify) {
  await sbUpdate('telegram_chats', { telegram_id: `eq.${telegramId}` }, { notify });
}

/* ────────────────────────────────────────────────────────────────
   Инлайн-режим: карточка, которую человек отправляет сам
   ──────────────────────────────────────────────────────────────── */

/**
 * Приложение зовёт `switchInlineQuery('match <titleId>')` или
 * `switchInlineQuery('room <code>')`, Telegram открывает список чатов,
 * и в выбранный чат уходит настоящая карточка с постером — а не голая
 * ссылка, из которой непонятно, о каком фильме речь.
 *
 * Отвечать обязательно, даже когда сказать нечего: без ответа Telegram
 * показывает бесконечную загрузку, и это выглядит как поломка.
 */
async function onInlineQuery(query) {
  const text = String(query.query ?? '').trim();
  const [kind, ...rest] = text.split(/\s+/);
  const argument = rest.join(' ').trim();

  let results = [];

  if (kind === 'match' && argument) {
    results = await matchResult(argument);
  } else if (kind === 'room') {
    const code = /^\d{5}$/.test(argument) ? argument : null;
    if (code) results = roomResult(code);
  }

  // Пустой запрос и всё непонятное сводятся к карточке приложения:
  // человек уже выбрал чат, и остаться ни с чем — худший исход.
  if (!results.length) results = appResult();

  await answerInlineQuery(query.id, results);
}

async function matchResult(titleId) {
  const rows = await sbSelect('catalog_titles', {
    select: 'id,data',
    id: `eq.${titleId}`,
    limit: 1,
  });

  const title = rows?.[0]?.data;
  // Постер обязателен: без него это не фотокарточка, а тот же голый текст.
  if (!title?.title || !title?.poster) return [];

  const link = appLink();

  return [{
    type: 'photo',
    id: `match:${titleId}`.slice(0, 64),
    photo_url: title.poster,
    thumbnail_url: title.posterSmall ?? title.poster,
    title: `Мэтч: ${title.title}`,
    description: 'Отправить карточку в чат',
    caption: TEXTS.inline.match(title.title, title.year),
    parse_mode: 'HTML',
    ...(linkButton('Открыть MatchWatch', link) ? { reply_markup: linkButton('Открыть MatchWatch', link) } : {}),
  }];
}

export function roomResult(code) {
  const link = appLink(code);

  return [{
    type: 'article',
    id: `room:${code}`,
    title: `Комната ${code}`,
    description: 'Позвать выбирать кино вместе',
    input_message_content: {
      message_text: TEXTS.inline.room(code),
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    },
    ...(linkButton(`Войти в комнату ${code}`, link)
      ? { reply_markup: linkButton(`Войти в комнату ${code}`, link) }
      : {}),
  }];
}

function appResult() {
  const link = appLink();

  return [{
    type: 'article',
    id: 'app',
    title: 'MatchWatch',
    description: 'Выбирать кино вдвоём',
    input_message_content: {
      message_text: TEXTS.inline.app,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    },
    ...(linkButton('Открыть MatchWatch', link)
      ? { reply_markup: linkButton('Открыть MatchWatch', link) }
      : {}),
  }];
}
