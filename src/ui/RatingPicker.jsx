import { useState } from 'react';
import { Star } from 'lucide-react';

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
            <Star size={13} fill="currentColor" strokeWidth={0} />
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
      <Star size={11} fill="currentColor" strokeWidth={0} /> {value}
    </span>
  );
}
