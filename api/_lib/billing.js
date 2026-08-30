/**
 * Премиум: выписка счёта, промо-выдача и чтение текущего доступа.
 *
 * Оплата звёздами Telegram устроена не как обычный платёж: провайдера
 * нет, `provider_token` пустой, валюта — `XTR`, а деньги списываются
 * внутри клиента Telegram. Нам достаётся ссылка на счёт, которую
 * мини-приложение открывает своим `openInvoice`.
 *
 * Зачисление доступа живёт НЕ здесь, а в вебхуке бота: подтверждение
 * оплаты приходит от Telegram, а не от нашего клиента. Клиенту в этом
 * вопросе верить нельзя — иначе премиум выписывает себе любой, кто
 * умеет открыть консоль браузера.
 *
 * Карта сюда добавляется без переписывания: журнал `payments` уже
 * принимает `source = 'card'`, а зачисление идёт той же функцией
 * `creditPayment`. Отличаться будет только способ получения счёта.
 */

import { ApiError } from './http.js';
import { requireUser } from './session.js';
import { sbSelect, sbInsert, sbUpdate, sbRpc, hasServiceKey } from './supabaseAdmin.js';
import { callBot } from './botApi.js';
import { logError, logMetric } from './telemetry.js';
import { LEVEL, METRIC, MODULE } from '../../shared/telemetry/events.js';
import { PREMIUM_CONFIG, isPremiumActive, premiumDaysLeft } from '../../shared/config/premium.js';

/** Код ошибки PostgreSQL для нарушения уникальности. */
const UNIQUE_VIOLATION = '23505';

/* ── Чтение доступа ──────────────────────────────────────────────── */

export async function loadSubscription(userId) {
  const rows = await sbSelect('subscriptions', {
    user_id: `eq.${userId}`,
    select: 'plan,status,source,started_at,expires_at',
    limit: 1,
  });
  return rows?.[0] ?? null;
}

/** Промо уже выдавали? Один запрос вместо флага в профиле. */
async function promoUsed(userId) {
  const rows = await sbSelect('payments', {
    user_id: `eq.${userId}`,
    source: 'eq.promo',
    select: 'id',
    limit: 1,
  });
  return Boolean(rows?.length);
}

/**
 * Что клиент знает о премиуме.
 *
 * Отдаём и сам конфиг цены: окно оплаты не должно хранить свою копию
 * суммы. Две правды об одной цифре разъезжаются в первый же день,
 * когда цену поменяют.
 */
export async function describeAccess(userId) {
  const subscription = await loadSubscription(userId);
  return {
    premium: isPremiumActive(subscription),
    grantedToAll: PREMIUM_CONFIG.grantAllUsers,
    daysLeft: premiumDaysLeft(subscription),
    subscription,
    promoAvailable: !(await promoUsed(userId)),
    price: PREMIUM_CONFIG.price,
    promo: PREMIUM_CONFIG.promo,
    benefits: PREMIUM_CONFIG.benefits,
  };
}

/* ── Зачисление ──────────────────────────────────────────────────── */

/**
 * Записывает платёж и продлевает подписку.
 *
 * Порядок обязателен: сначала журнал, потом доступ. Уникальный индекс
 * по `charge_id` — единственный настоящий замок от повторной доставки
 * вебхука, и он должен сработать ДО того, как мы что-то продлим.
 * Telegram повторяет доставку, пока не получит 200, и «сначала продлим,
 * потом запишем» дало бы человеку три месяца за одну оплату.
 *
 * @returns {Promise<{credited: boolean, subscription: object|null}>}
 *   `credited: false` — этот платёж уже был зачтён раньше.
 */
export async function creditPayment({
  userId, source, amount = 0, currency = 'XTR', chargeId, days = PREMIUM_CONFIG.periodDays, payload = {},
}) {
  if (!userId || !chargeId) {
    throw new ApiError(400, 'bad_payment', 'Платёж без пользователя или идентификатора');
  }

  try {
    await sbInsert('payments', {
      user_id: userId, source, amount, currency, charge_id: chargeId, days, payload,
    });
  } catch (error) {
    if (error?.code === UNIQUE_VIOLATION) {
      // Повторная доставка — доступ уже выдан, второй раз не продлеваем.
      return { credited: false, subscription: await loadSubscription(userId) };
    }
    throw error;
  }

  const rows = await sbRpc('extend_subscription', {
    p_user_id: userId, p_days: days, p_source: source,
  });

  /*
   * Поднимаем потолок закреплённых в визитке.
   *
   * Обратно он не опускается, и это намеренно: ограничение проверяется
   * в базе как `cardinality(pinned_ids) <= pin_limit`, и снижение
   * потолка сделало бы существующую строку профиля невалидной —
   * человек не смог бы сохранить вообще ничего, пока не удалит лишнее
   * руками. Оставить заработанное дешевле и честнее, чем ломать
   * профиль в день окончания подписки.
   */
  await sbUpdate('profiles', { id: `eq.${userId}` }, {
    pin_limit: PREMIUM_CONFIG.profile.pinLimit.premium,
  }).catch(() => { /* косметика: доступ уже выдан, ради неё платёж не валим */ });

  logMetric(METRIC.PREMIUM_CREDITED, {
    userId,
    value: amount,
    context: { source, currency, days },
  });

  return { credited: true, subscription: Array.isArray(rows) ? rows[0] : rows };
}

/* ── Эндпоинты ───────────────────────────────────────────────────── */

/** GET /api/billing/status — что у человека с премиумом. */
export async function statusAction({ req }) {
  const user = await requireUser(req);
  assertConfigured();
  return { access: await describeAccess(user.id) };
}

/**
 * POST /api/billing/promo — бесплатный месяц первой волне.
 *
 * Промо — обычная запись в журнале платежей на нулевую сумму. Отдельной
 * таблицы «кому мы дарили» не заводим: тогда пришлось бы синхронизировать
 * два источника правды о том, есть ли у человека доступ.
 */
export async function promoAction({ req }) {
  const user = await requireUser(req);
  assertConfigured();

  const result = await creditPayment({
    userId: user.id,
    source: 'promo',
    amount: 0,
    currency: 'NONE',
    // Идентификатор детерминированный: второй такой в таблицу не влезет.
    chargeId: `promo:${user.id}`,
    days: PREMIUM_CONFIG.promo.days,
    payload: { reason: 'first_wave' },
  });

  if (!result.credited) {
    throw new ApiError(409, 'promo_used', 'Бесплатный месяц уже активирован');
  }

  return { access: await describeAccess(user.id) };
}

/**
 * POST /api/billing/invoice — ссылка на счёт в звёздах.
 *
 * Возвращаем именно ссылку, а не открываем счёт сами: показать его
 * может только клиент Telegram, у которого есть контекст пользователя.
 */
export async function invoiceAction({ req }) {
  const user = await requireUser(req);
  assertConfigured();

  const { price, plan, periodDays } = PREMIUM_CONFIG;

  const { ok, result, description } = await callBot('createInvoiceLink', {
    title: 'MatchWatch Премиум',
    description: `Доступ на ${periodDays} дней. ${PREMIUM_CONFIG.benefits[0]}.`,
    /*
     * Payload вернётся к нам в `successful_payment` через вебхук, то есть
     * из рук Telegram, а не из рук клиента. Поэтому по нему можно
     * зачислять доступ: подделать его пользователь не может.
     */
    payload: JSON.stringify({ userId: user.id, plan, days: periodDays, v: 1 }),
    // У звёзд провайдера нет — токен обязан быть пустым.
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: 'Премиум на месяц', amount: price.stars }],
  });

  if (!ok) {
    logError({
      message: 'billing: Telegram не выдал ссылку на счёт',
      module: MODULE.BOT,
      level: LEVEL.WARNING,
      context: { description },
    });
    throw new ApiError(502, 'invoice_failed', 'Не удалось открыть оплату. Попробуйте позже.');
  }

  return { invoiceUrl: result, stars: price.stars };
}

function assertConfigured() {
  if (!hasServiceKey()) {
    throw new ApiError(503, 'billing_not_configured',
      'Платежи недоступны: не задан SUPABASE_SERVICE_ROLE_KEY');
  }
}
