import { useCallback, useEffect, useState } from 'react';
import { api, describeError } from '../lib/api.js';
import { openInvoice } from '../lib/telegram.js';
import { trackMetric } from '../lib/telemetry.js';
import { METRIC } from '../../shared/telemetry/events.js';
import { PREMIUM_CONFIG } from '../../shared/config/premium.js';

/**
 * Состояние премиума и две операции над ним: промо и оплата.
 *
 * Доступ читается с сервера, а не выводится на клиенте. Соблазн был
 * посчитать `expires_at > now()` прямо здесь и не ходить в сеть — так
 * делать нельзя: часы на устройстве переводятся в два касания, и премиум
 * становится бесплатным для всех, кто это знает. Клиент показывает
 * ответ сервера, а не выносит решение.
 *
 * Пока `grantAllUsers` включён, сервер всё равно отвечает «премиум есть»
 * — экран это честно показывает, а витрина остаётся доступной: нам нужен
 * сигнал готовности платить, и он собирается именно сейчас.
 */
export function usePremium({ uid, enabled = true }) {
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!uid || !enabled) return null;
    setLoading(true);
    try {
      const { access: next } = await api.billingStatus();
      setAccess(next);
      setError(null);
      return next;
    } catch (e) {
      /*
       * Ошибку показываем, но доступ не сбрасываем.
       *
       * Сеть отвалилась — это не повод отобрать у человека премиум,
       * за который он заплатил. Прежнее состояние остаётся до тех пор,
       * пока сервер не скажет обратное.
       */
      setError(describeError(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [uid, enabled]);

  useEffect(() => { refresh(); }, [refresh]);

  /** Бесплатный месяц. Повтор отсекает база, а не эта проверка. */
  const activatePromo = useCallback(async () => {
    setBusy(true);
    try {
      const { access: next } = await api.billingPromo();
      setAccess(next);
      trackMetric(METRIC.PREMIUM_PROMO_ACTIVATED, {
        context: { days: PREMIUM_CONFIG.promo.days },
      });
      return { ok: true };
    } catch (e) {
      const described = describeError(e);
      setError(described);
      return { ok: false, error: described };
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * Оплата звёздами.
   *
   * Доступ здесь НЕ выдаётся — его выдаст вебхук, когда Telegram
   * подтвердит списание. Мы лишь перечитываем состояние: если оплата
   * прошла, сервер уже знает. Верить ответу окна оплаты на слово нельзя,
   * его присылает клиент.
   */
  const purchase = useCallback(async () => {
    setBusy(true);
    try {
      const { invoiceUrl } = await api.billingInvoice();
      const status = await openInvoice(invoiceUrl);

      if (status === 'paid') {
        /*
         * Секунда паузы перед перечитыванием — не украшение.
         * Вебхук с подтверждением идёт своим маршрутом, и запрос,
         * отправленный в тот же миг, застаёт подписку ещё не выданной.
         */
        await new Promise((resolve) => { setTimeout(resolve, 1200); });
        await refresh();
      }

      return { ok: status === 'paid', status };
    } catch (e) {
      const described = describeError(e);
      setError(described);
      return { ok: false, error: described };
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return {
    access,
    /** Премиум есть? Пока сервер не ответил — считаем, что нет. */
    premium: Boolean(access?.premium),
    /** Промо ещё не забирали. */
    promoAvailable: Boolean(access?.promoAvailable),
    daysLeft: access?.daysLeft ?? 0,
    loading,
    busy,
    error,
    refresh,
    activatePromo,
    purchase,
  };
}
