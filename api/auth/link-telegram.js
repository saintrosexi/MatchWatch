/**
 * Привязка Telegram к уже существующему аккаунту.
 *
 *   GET    /api/auth/link-telegram              — какие входы привязаны
 *   POST   /api/auth/link-telegram { initData } — привязать Telegram
 *   DELETE /api/auth/link-telegram              — отвязать Telegram
 *
 * Во всех трёх нужен заголовок `Authorization: Bearer <access_token>`
 * текущей сессии: привязать чужой Telegram к своему аккаунту нельзя,
 * равно как и свой — к чужому. Владелец сессии определяется у Supabase,
 * а не по телу запроса.
 *
 * Почему это отдельный эндпоинт, а не часть входа: вход отвечает на вопрос
 * «кто ты», а привязка — «этот Telegram теперь мой». Второе требует уже
 * доказанной личности, и смешивать их в одном обработчике значит открыть
 * дорогу к перехвату аккаунта.
 */

import { withHandler, badRequest, ApiError, unauthorized } from '../_lib/http.js';
import { validateInitData, hasBotToken } from '../_lib/telegram.js';
import { authAdmin, hasServiceKey, sbSelect, sbInsert, sbDelete } from '../_lib/supabaseAdmin.js';
import { PROVIDER, emailKey, telegramEmail } from '../_lib/identity.js';
import { logBusinessEvent } from '../_lib/telemetry.js';
import { BIZ, LEVEL, MODULE } from '../../shared/telemetry/events.js';

const bearer = (req) => {
  const raw = req.headers?.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match?.[1] ?? null;
};

/** Служебный адрес Telegram-аккаунта — не настоящая почта пользователя. */
const isServiceEmail = (email) => !email || email.endsWith('.invalid');

async function requireSession(req) {
  const token = bearer(req);
  if (!token) throw unauthorized('session_required', 'Нужен вход в аккаунт');
  try {
    const user = await authAdmin.getUserByToken(token);
    if (!user?.id) throw new Error('empty user');
    return user;
  } catch {
    throw unauthorized('session_invalid', 'Сессия истекла — войдите заново');
  }
}

function requireServiceKey() {
  if (!hasServiceKey()) {
    throw new ApiError(503, 'linking_not_configured',
      'Привязка Telegram не настроена: на сервере не задан SUPABASE_SERVICE_ROLE_KEY');
  }
}

const listIdentities = (userId) =>
  sbSelect('identities', {
    select: 'provider,external_key,linked_at',
    user_id: `eq.${userId}`,
    order: 'linked_at.asc',
  });

/**
 * Отдаём внешний ключ в укороченном виде: telegram_id узнаваем владельцем,
 * но не годится для перебора чужих привязок, если ответ куда-то утечёт.
 */
const maskKey = (key) => (key.length <= 4 ? key : `…${key.slice(-4)}`);

async function status(userId, email) {
  const rows = (await listIdentities(userId)) ?? [];
  const byProvider = Object.fromEntries(rows.map((row) => [row.provider, row]));

  return {
    userId,
    email: isServiceEmail(email) ? null : email,
    /** Единственный вход отвязывать нельзя — иначе аккаунт станет недоступен. */
    canUnlinkTelegram: Boolean(byProvider.telegram) && !isServiceEmail(email),
    telegram: byProvider.telegram
      ? { linked: true, externalKey: maskKey(byProvider.telegram.external_key), linkedAt: byProvider.telegram.linked_at }
      : { linked: false },
    providers: rows.map((row) => ({
      provider: row.provider,
      externalKey: maskKey(row.external_key),
      linkedAt: row.linked_at,
    })),
  };
}

export default withHandler(
  { methods: ['GET', 'POST', 'DELETE'], module: MODULE.AUTH_TELEGRAM },
  async ({ req, body }) => {
    requireServiceKey();
    const me = await requireSession(req);

    if (req.method === 'GET') return status(me.id, me.email);
    if (req.method === 'DELETE') return unlink(me);
    return link(me, body);
  },
);

async function link(me, body) {
  if (!hasBotToken()) {
    throw new ApiError(503, 'telegram_not_configured',
      'Вход через Telegram не настроен: не задан TELEGRAM_BOT_TOKEN');
  }

  const initData = body?.initData;
  if (!initData) throw badRequest('initdata_required', 'Не передан initData');

  const verified = validateInitData(initData);
  const telegramId = verified.telegramId;

  const owner = await sbSelect('identities', {
    select: 'user_id',
    provider: `eq.${PROVIDER.TELEGRAM}`,
    external_key: `eq.${telegramId}`,
    limit: 1,
  });
  const ownerId = owner?.[0]?.user_id ?? null;

  if (ownerId && ownerId !== me.id) {
    /*
     * Перевесить привязку молча нельзя: у прежнего владельца Telegram —
     * возможно, единственный вход, и он потеряет аккаунт, ничего не заметив.
     */
    const previous = await authAdmin.getUser(ownerId);
    if (isServiceEmail(previous?.email)) {
      throw new ApiError(409, 'telegram_linked_elsewhere',
        'Этот Telegram уже заведён как отдельный аккаунт MatchWatch. '
        + 'Войдите в него через Telegram и привяжите там email — история сохранится.');
    }
    throw new ApiError(409, 'telegram_linked_elsewhere',
      'Этот Telegram уже привязан к другому аккаунту MatchWatch.');
  }

  if (ownerId === me.id) return { ...(await status(me.id, me.email)), alreadyLinked: true };

  // Прежняя привязка того же аккаунта к другому Telegram снимается:
  // один аккаунт — один Telegram, иначе непонятно, в чей входить.
  await sbDelete('identities', { provider: `eq.${PROVIDER.TELEGRAM}`, user_id: `eq.${me.id}` });

  await sbInsert('identities', {
    provider: PROVIDER.TELEGRAM, external_key: telegramId, user_id: me.id,
  }, { upsert: true, onConflict: 'provider,external_key' });

  // Заодно фиксируем email как второй вход — чтобы список привязок был полным.
  if (!isServiceEmail(me.email)) {
    await sbInsert('identities', {
      provider: PROVIDER.EMAIL, external_key: emailKey(me.email), user_id: me.id,
    }, { upsert: true, onConflict: 'provider,external_key' }).catch(() => {});
  }

  /*
   * Отдельный «телеграмный» аккаунт мог существовать до привязки. Мы его не
   * трогаем — удалять чужую историю нельзя, — но входить в него больше не
   * будут: вход идёт по identities, а строка теперь указывает сюда.
   */
  const orphan = await authAdmin.findByEmail(telegramEmail(telegramId));
  const orphanReplaced = Boolean(orphan && orphan.id !== me.id);

  logBusinessEvent(BIZ.TELEGRAM_LINKED, {
    module: MODULE.AUTH_TELEGRAM,
    level: LEVEL.INFO,
    context: { userId: me.id, telegramId, orphanReplaced },
  });

  return { ...(await status(me.id, me.email)), alreadyLinked: false, orphanReplaced };
}

async function unlink(me) {
  if (isServiceEmail(me.email)) {
    throw new ApiError(409, 'last_login_method',
      'Telegram — единственный вход в этот аккаунт. Сначала добавьте email и пароль.');
  }

  await sbDelete('identities', { provider: `eq.${PROVIDER.TELEGRAM}`, user_id: `eq.${me.id}` });

  logBusinessEvent(BIZ.TELEGRAM_UNLINKED, {
    module: MODULE.AUTH_TELEGRAM, level: LEVEL.INFO, context: { userId: me.id },
  });

  return status(me.id, me.email);
}
