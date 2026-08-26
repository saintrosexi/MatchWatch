import { useState } from 'react';
import { haptic } from '../../lib/telegram.js';
import { trackMetric } from '../../lib/telemetry.js';
import { METRIC } from '../../../shared/telemetry/events.js';
import {
  ArrowLeft, Bookmark, Eye, Heart, ICON, Info, RotateCcw, Users, X,
} from '../../ui/icons.js';

/**
 * Онбординг.
 *
 * Показывает не «возможности», а маршрут каждого действия: какая иконка,
 * каким жестом вызывается и в какой список после этого попадёт фильм.
 * Без последнего человек отмечает кино и потом не может его найти —
 * а это единственная причина, по которой отметки перестают ставить.
 *
 * Про устройство подбора здесь молчим сознательно: пользователю нужно
 * знать, что отметки делают подборку точнее, а не как именно.
 */
const SLIDES = [
  {
    art: '/mascot/swipe.png',
    title: 'Два жеста',
    text: 'Основное решение принимается свайпом — карточку можно просто утащить пальцем.',
    rows: [
      {
        icon: Heart, tone: 'like', fill: true,
        action: 'Свайп вправо — нравится',
        target: 'Моё → Нравится',
      },
      {
        icon: X, tone: 'pass',
        action: 'Свайп влево — пропуск',
        target: 'Больше не покажем',
      },
    ],
  },
  {
    art: '/mascot/swipe.png',
    title: 'Кнопки под колодой',
    text: 'То же самое, если свайпать не хочется, плюс два решения, которых жестами нет.',
    rows: [
      {
        icon: Bookmark, tone: 'wish', fill: true,
        action: 'Буду смотреть',
        target: 'Моё → Буду смотреть',
      },
      {
        icon: Eye, tone: 'seen',
        action: 'Просмотрено',
        target: 'Моё → Просмотрено',
      },
      {
        icon: RotateCcw, tone: 'muted',
        action: 'Вернуть последнее решение',
        target: 'Карточка вернётся в ленту',
      },
    ],
  },
  {
    art: '/mascot/swipe.png',
    title: 'Карточка фильма',
    text: 'Тап по постеру открывает описание, актёров и трейлер. Отметить фильм можно прямо оттуда — возвращаться в ленту не нужно.',
    rows: [
      {
        icon: Info, tone: 'info',
        action: 'Тап по карточке',
        target: 'Описание, актёры, трейлер',
      },
    ],
  },
  {
    art: '/mascot/room.png',
    title: 'Смотрите вдвоём',
    text: 'Создайте комнату и отправьте другу пятизначный код. Когда все соберутся, нажмите «Собрать общую колоду» — подборка сложится по вкусам всех, кто внутри.',
    rows: [
      {
        icon: Users, tone: 'info',
        action: 'Комната на двоих',
        target: 'Вместе → Создать комнату',
      },
      {
        icon: Heart, tone: 'like', fill: true,
        action: 'В комнате только «да» и «нет»',
        target: 'Свайпаете одновременно',
      },
    ],
  },
  {
    art: '/mascot/match.png',
    title: 'Мэтч',
    text: 'Сказали «да» оба — это мэтч. Фильм сам ляжет в «Буду смотреть» вам обоим, искать его не придётся.',
    rows: [
      {
        icon: Bookmark, tone: 'wish', fill: true,
        action: 'Совпадение',
        target: 'Моё → Буду смотреть, у обоих',
      },
    ],
  },
  {
    art: '/mascot/match.png',
    title: 'Чем больше отметок — тем лучше подборка',
    text: 'Каждое «нравится», «просмотрено» и «буду смотреть» уточняет, что показывать дальше. Первые полтора десятка фильмов — общие для всех, дальше лента расходится под вас.',
    rows: [],
  },
];

export function Onboarding({ onDone }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  const go = (delta) => {
    haptic('light');
    setIndex((i) => Math.min(SLIDES.length - 1, Math.max(0, i + delta)));
  };

  const next = () => {
    haptic('light');
    if (last) {
      trackMetric(METRIC.ONBOARDING_DONE, { context: { slides: SLIDES.length } });
      onDone();
      return;
    }
    setIndex((i) => i + 1);
  };

  return (
    <div className="onboarding">
      <div className="onboarding__slides">
        <img className="onboarding__art" src={slide.art} alt="" key={slide.art} />
        <h1 className="onboarding__step">{slide.title}</h1>
        <p className="onboarding__text">{slide.text}</p>

        {slide.rows.length > 0 && (
          <ul className="legend">
            {slide.rows.map((row) => (
              <li className="legend__row" key={row.action}>
                <span className="legend__icon" data-tone={row.tone}>
                  <row.icon size={ICON.md} {...(row.fill ? { weight: 'fill' } : {})} />
                </span>
                <span className="legend__text">
                  <span className="legend__action">{row.action}</span>
                  <span className="legend__target">{row.target}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="onboarding__foot">
        <div className="onboarding__dots">
          {SLIDES.map((s, i) => (
            <span className="onboarding__dot" data-on={String(i === index)} key={s.title} />
          ))}
        </div>

        <div className="row gap-2">
          {index > 0 && (
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              onClick={() => go(-1)}
              aria-label="Назад"
            >
              <ArrowLeft size={ICON.sm} />
            </button>
          )}
          <button type="button" className="btn btn--primary grow" onClick={next}>
            {last ? 'Погнали' : 'Дальше'}
          </button>
        </div>

        {!last && (
          <button type="button" className="btn btn--quiet" onClick={onDone}>
            Пропустить
          </button>
        )}
      </div>
    </div>
  );
}
