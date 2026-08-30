import { Crown, Sparkles, X } from '../../ui/icons.js';
import { NEWS_TAG } from '../../../shared/config/news.js';

/**
 * Разовое уведомление о новом.
 *
 * Показывается один раз на устройство и закрывается навсегда — отметка
 * о прочтении хранится в localStorage, а не в профиле. Это осознанно:
 * новость про интерфейс касается устройства, с которого человек смотрит,
 * и синхронизировать её между телефоном и десктопом незачем. Заодно
 * она не требует сети и не ждёт загрузки аккаунта.
 *
 * Стоит НАД лентой, а не поверх неё. Модальное окно на входе — способ
 * гарантированно испортить первую секунду: человек открыл приложение
 * выбрать кино, а не читать нас. Полоску он прочитает, если захочет,
 * и закроет одним движением, если нет.
 */
export function NewsBanner({ item, onOpen, onDismiss }) {
  if (!item) return null;

  const Icon = item.tag === NEWS_TAG.PREMIUM ? Crown : Sparkles;

  return (
    <div className="news-banner" role="status">
      <button
        type="button"
        className="news-banner__body"
        onClick={() => onOpen?.(item)}
      >
        <span className="news-banner__icon"><Icon size={18} weight="fill" /></span>
        <span className="stack gap-1" style={{ textAlign: 'left', minWidth: 0 }}>
          <b className="news-banner__title">{item.title}</b>
          <span className="news-banner__lead">{item.lead}</span>
        </span>
      </button>

      <button
        type="button"
        className="news-banner__close"
        aria-label="Скрыть уведомление"
        onClick={() => onDismiss?.(item)}
      >
        <X size={16} />
      </button>
    </div>
  );
}
