import { useState } from 'react';
import { Star } from './icons.js';

/**
 * Выбор личной оценки по десятибалльной шкале.
 *
 * Десять баллов, а не пять звёзд: шкала совпадает с TMDB, поэтому личная
 * оценка и оценка зрителей стоят рядом и читаются одинаково — «8,5 у всех,
 * 9 у меня» понятнее, чем «8,5 у всех, 4½ звезды у меня».
 */
export function RatingPicker({ value = null, onRate, size = 'md' }) {
  const [hover, setHover] = useState(null);
  const shown = hover ?? value;

  return (
    <div className={`rating rating--${size}`}>
      <div
        className="rating__scale"
        role="radiogroup"
        aria-label="Ваша оценка фильма"
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} из 10`}
            className={`rating__dot ${shown >= n ? 'rating__dot--on' : ''}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(null)}
            onClick={() => onRate(value === n ? null : n)}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="rating__caption">
        {shown ? (
          <>
            <Star size={12} weight="fill" />
            <b>{shown}</b>
            <span className="faint">{VERDICTS[shown]}</span>
          </>
        ) : (
          <span className="faint">Поставьте оценку — лента станет точнее</span>
        )}
      </div>
    </div>
  );
}

/**
 * Та же десятибалльная шкала, но звёздами.
 *
 * Нужна там, где человек ничего не просил, — в предложении оценить.
 * Ряд из десяти цифр читается как форма, которую заставляют заполнить,
 * и на него отвечают «потом»; ряд звёзд читается как приглашение,
 * и на него отвечают сразу. Шкала при этом не меняется: те же десять
 * баллов, что и везде, — иначе своя оценка перестала бы сравниваться
 * с оценкой зрителей.
 */
export function StarScale({ value = null, onRate, size = 26 }) {
  const [hover, setHover] = useState(null);
  const shown = hover ?? value;

  return (
    <div className="stack gap-2">
      <div
        className="star-scale"
        role="radiogroup"
        aria-label="Ваша оценка фильма"
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} из 10`}
            className={`star-scale__star ${shown >= n ? 'star-scale__star--on' : ''}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(null)}
            onClick={() => onRate(n)}
          >
            <Star size={size} weight={shown >= n ? 'fill' : 'regular'} />
          </button>
        ))}
      </div>

      <div className="rating__caption">
        {shown
          ? <><b>{shown}</b> <span className="faint">{VERDICTS[shown]}</span></>
          : <span className="faint">Нажмите на звезду</span>}
      </div>
    </div>
  );
}

/** Словесная расшифровка: цифра без слова мало что говорит. */
const VERDICTS = {
  1: 'ужасно', 2: 'очень плохо', 3: 'плохо', 4: 'слабо', 5: 'так себе',
  6: 'нормально', 7: 'хорошо', 8: 'очень хорошо', 9: 'отлично', 10: 'шедевр',
};

/** Компактный показ уже выставленной оценки. */
export function RatingBadge({ value, className = '' }) {
  if (!value) return null;
  return (
    <span className={`badge badge--rating ${className}`} title={`Ваша оценка: ${value} из 10`}>
      <Star size={12} weight="fill" /> {value}
    </span>
  );
}
