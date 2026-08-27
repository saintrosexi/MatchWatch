import { MOOD_AXES, MOOD_LABELS, MOOD_LABELS_SHORT } from '../../shared/config/recommendation.js';

/*
 * Паутинка вкуса убрана вместе с вектором настроения человека: она
 * рисовала середину между его любимыми фильмами, и человек в этой
 * картинке себя не узнавал. Осталось то, что честно описывает
 * КОНКРЕТНЫЙ фильм.
 */

/**
 * Паутинка 5D-настроения.
 *
 * Умеет накладывать несколько векторов сразу: мой профиль, профиль партнёра
 * и компромисс комнаты. Именно наложение делает график полезным — видно,
 * где вкусы расходятся, а не просто «какой я».
 */

/** Горизонтальные полосы — компактная альтернатива радару в узких местах. */
export function MoodBars({ vector, compact = false }) {
  return (
    <div className="taste-bars">
      {MOOD_AXES.map((axis) => {
        const value = Math.round(vector?.[axis] ?? 50);
        return (
          <div className="taste-bar" key={axis}>
            {!compact && <span className="taste-bar__label">{MOOD_LABELS[axis]}</span>}
            <div className="taste-bar__track">
              <div className="taste-bar__fill" style={{ width: `${value}%` }} />
            </div>
            <span className="taste-bar__value">{value}</span>
          </div>
        );
      })}
    </div>
  );
}
