import { useState } from 'react';
import { haptic } from '../../lib/telegram.js';
import { trackMetric } from '../../lib/telemetry.js';
import { METRIC } from '../../../shared/telemetry/events.js';

/**
 * Онбординг на три экрана.
 *
 * Задача ровно одна: за несколько секунд объяснить связку
 * «свайпай → зови друга в комнату → получай мэтч». Без неё новый
 * пользователь открывает ленту и не понимает, зачем ему код комнаты.
 */
const SLIDES = [
  {
    art: '/mascot/swipe.png',
    title: 'Свайпайте кино',
    text: 'Вправо — нравится, влево — мимо. Чем больше свайпов, тем точнее лента: мы запоминаем не жанры, а темы — самураев, ограбления, петли времени.',
  },
  {
    art: '/mascot/room.png',
    title: 'Позовите друга',
    text: 'Создайте комнату, отправьте четырёхзначный код. Колода соберётся из ваших вкусов сразу — не среднее арифметическое, а то, что вы оба любите.',
  },
  {
    art: '/mascot/match.png',
    title: 'Ловите мэтч',
    text: 'Свайпнули вправо оба — фильм попадает в общий список «к просмотру». Дальше только попкорн.',
  },
];

export function Onboarding({ onDone }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

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
      </div>

      <div className="onboarding__foot">
        <div className="onboarding__dots">
          {SLIDES.map((s, i) => (
            <span className="onboarding__dot" data-on={String(i === index)} key={s.title} />
          ))}
        </div>

        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={next}>
          {last ? 'Погнали' : 'Дальше'}
        </button>

        {!last && (
          <button type="button" className="btn btn--quiet" onClick={onDone}>
            Пропустить
          </button>
        )}
      </div>
    </div>
  );
}
