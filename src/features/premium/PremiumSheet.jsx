import { useEffect } from 'react';
import { Check, Crown, Sparkles, Star } from '../../ui/icons.js';
import { Sheet } from '../../ui/Sheet.jsx';
import { trackMetric } from '../../lib/telemetry.js';
import { METRIC } from '../../../shared/telemetry/events.js';
import { PREMIUM_CONFIG } from '../../../shared/config/premium.js';

/**
 * Витрина премиума.
 *
 * Зачёркнутая цена здесь не приём из инфобизнеса, а единственный
 * способ сказать две вещи сразу: сколько подписка будет стоить и что
 * сейчас человек не платит. Без перечёркнутой суммы «бесплатно»
 * не сообщает ценности, а без нуля рядом — выглядит как счёт.
 *
 * Отдельное решение — показывать витрину даже тем, у кого премиум уже
 * есть. Сейчас он выдан всем, и спрятать окно значило бы не собрать
 * ровно тот сигнал, ради которого всё и делалось: сколько людей
 * доходят до кнопки и нажимают её.
 */
export function PremiumSheet({ open, onClose, premium, promoAvailable, daysLeft, busy, onActivate, onPurchase, toasts }) {
  const { price, promo, benefits } = PREMIUM_CONFIG;

  useEffect(() => {
    if (!open) return;
    trackMetric(METRIC.PREMIUM_VIEWED, {
      context: { premium, promoAvailable },
    });
  }, [open, premium, promoAvailable]);

  const activate = async () => {
    const result = await onActivate?.();
    if (result?.ok) {
      toasts?.success(`Премиум активирован на ${promo.days} дней`);
      onClose?.();
    } else if (result?.error) {
      toasts?.error(result.error.message ?? 'Не удалось активировать');
    }
  };

  const pay = async () => {
    const result = await onPurchase?.();
    if (result?.ok) {
      toasts?.success('Оплата прошла — премиум активен');
      onClose?.();
      return;
    }
    /*
     * Отмену молча проглатываем: человек сам закрыл окно оплаты,
     * и говорить ему об этом — сообщать о его собственном решении.
     */
    if (result?.status && result.status !== 'cancelled') {
      toasts?.error('Оплата не прошла. Деньги не списаны.');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="MatchWatch Премиум">
      <div className="stack gap-5">

        {premium && (
          <div className="premium-state">
            <Crown size={18} weight="fill" />
            <span className="stack gap-1">
              <b>Премиум активен</b>
              <span className="faint premium-state__note">
                {daysLeft > 0
                  ? `Осталось ${daysLeft} дн.`
                  : 'Открыт всем на время закрытого теста'}
              </span>
            </span>
          </div>
        )}

        <div className="premium-price">
          {promoAvailable ? (
            <>
              <span className="premium-price__was">{price.label}</span>
              <span className="premium-price__now">{promo.priceLabel}</span>
              <span className="premium-price__note">{promo.label}</span>
            </>
          ) : (
            <>
              <span className="premium-price__now">{price.label}</span>
              <span className="premium-price__note">{price.labelPeriod}</span>
            </>
          )}
        </div>

        <ul className="premium-benefits">
          {benefits.map((item) => (
            <li key={item}>
              <Check size={15} weight="bold" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="stack gap-2">
          {promoAvailable ? (
            <button
              type="button"
              className="btn btn--primary btn--block btn--lg"
              disabled={busy}
              onClick={activate}
            >
              <Sparkles size={16} /> {busy ? 'Активируем…' : 'Активировать бесплатно'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--gold btn--block btn--lg"
              disabled={busy}
              onClick={pay}
            >
              <Star size={16} weight="fill" />
              {busy ? 'Открываем оплату…' : `Оплатить — ${price.stars} звёзд`}
            </button>
          )}

          {promoAvailable && (
            <button
              type="button"
              className="btn btn--quiet btn--block"
              disabled={busy}
              onClick={pay}
            >
              Оплатить звёздами — {price.stars} ★
            </button>
          )}
        </div>

        <p className="faint premium-fineprint">
          Оплата проходит внутри Telegram звёздами. Подписка не продлевается
          автоматически — когда месяц кончится, мы просто спросим ещё раз.
          Оплата картой появится позже.
        </p>
      </div>
    </Sheet>
  );
}
