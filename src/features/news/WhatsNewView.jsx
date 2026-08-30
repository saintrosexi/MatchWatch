import { ArrowLeft, Crown, Sparkles, Wrench } from '../../ui/icons.js';
import { NEWS, NEWS_TAG, NEWS_TAG_LABEL } from '../../../shared/config/news.js';
import { PREMIUM_CONFIG } from '../../../shared/config/premium.js';

/** Списки, на которые ссылаются записи. Один источник с витриной подписки. */
const LISTS = { premium: PREMIUM_CONFIG.benefits };

const ICONS = {
  [NEWS_TAG.PREMIUM]: Crown,
  [NEWS_TAG.FEATURE]: Sparkles,
  [NEWS_TAG.FIX]: Wrench,
};

/**
 * Что нового — история продукта.
 *
 * Записи идут в порядке файла, а не по убыванию даты: сортировка
 * по строке даты означала бы, что опечатка в ней молча перемешивает
 * историю. Порядок задаёт тот, кто пишет.
 *
 * Текст написан от пользы, а не от изменений: «оценка сразу после
 * просмотра», а не «добавлен компонент RateAsk». Список коммитов
 * человеку не говорит ничего, и читать его он не будет.
 */
export function WhatsNewView({ onBack, onOpenPremium }) {
  return (
    <div className="view">
      <header className="view__head">
        <div className="row gap-3" style={{ alignItems: 'center' }}>
          {onBack && (
            <button type="button" className="action action--sm" aria-label="Назад" onClick={onBack}>
              <ArrowLeft size={18} />
            </button>
          )}
          <h1 className="view__title">Что нового</h1>
        </div>
        <p className="view__sub">Мы дописываем сюда каждое заметное обновление.</p>
      </header>

      <div className="news-list">
        {NEWS.map((item) => {
          const Icon = ICONS[item.tag] ?? Sparkles;
          return (
            <article className="news-entry" key={item.id} data-tag={item.tag}>
              <div className="news-entry__head">
                <span className="news-entry__tag">
                  <Icon size={12} weight="fill" /> {NEWS_TAG_LABEL[item.tag] ?? 'Новое'}
                </span>
                <time className="news-entry__date" dateTime={item.date}>
                  {new Date(item.date).toLocaleDateString('ru-RU', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </time>
              </div>

              <h2 className="news-entry__title">{item.title}</h2>

              {item.body.map((paragraph) => (
                <p className="news-entry__text" key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}

              {LISTS[item.listFrom] && (
                <ul className="news-entry__list">
                  {LISTS[item.listFrom].map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
              )}

              {item.tail?.map((paragraph) => (
                <p className="news-entry__text" key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}

              {item.action === 'premium' && onOpenPremium && (
                <button type="button" className="btn btn--gold" onClick={onOpenPremium}>
                  <Crown size={15} weight="fill" /> Посмотреть премиум
                </button>
              )}
            </article>
          );
        })}
      </div>

      <p className="faint" style={{ fontSize: 'var(--t-micro)', textAlign: 'center' }}>
        Есть что сказать про обновление? Напишите нам — на этой стадии
        каждый отзыв меняет продукт заметно сильнее, чем потом.
      </p>
    </div>
  );
}
