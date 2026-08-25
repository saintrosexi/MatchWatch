import { MOOD_AXES, MOOD_LABELS, MOOD_LABELS_SHORT } from '../../shared/config/recommendation.js';

/**
 * Паутинка 5D-настроения.
 *
 * Умеет накладывать несколько векторов сразу: мой профиль, профиль партнёра
 * и компромисс комнаты. Именно наложение делает график полезным — видно,
 * где вкусы расходятся, а не просто «какой я».
 */
export function Radar({ vectors = [], size = 280, showValues = true }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 38;
  // Подписи осей длиннее радиуса, поэтому viewBox шире квадрата сетки:
  // иначе «Динамика» и «Интеллект» обрезаются по краям.
  const pad = 52;
  const axes = MOOD_AXES;
  const step = (Math.PI * 2) / axes.length;

  const point = (index, value) => {
    const angle = index * step - Math.PI / 2;
    const r = (Math.max(0, Math.min(100, value)) / 100) * radius;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  };

  /** Точка для подписи — за пределами сетки, на фиксированном отступе. */
  const labelPoint = (index, offset = 16) => {
    const angle = index * step - Math.PI / 2;
    return [cx + Math.cos(angle) * (radius + offset), cy + Math.sin(angle) * (radius + offset)];
  };

  const polygon = (vector) => axes
    .map((axis, i) => point(i, vector?.[axis] ?? 50).join(','))
    .join(' ');

  return (
    <svg className="radar" viewBox={`${-pad} 0 ${size + pad * 2} ${size}`} role="img"
      aria-label="Профиль кинематографического настроения по пяти осям">
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <polygon
          key={ratio}
          className="radar__grid"
          points={axes.map((_, i) => point(i, ratio * 100).join(',')).join(' ')}
        />
      ))}

      {axes.map((axis, i) => {
        const [x, y] = point(i, 100);
        return <line key={axis} className="radar__axis" x1={cx} y1={cy} x2={x} y2={y} />;
      })}

      {vectors.map((entry) => (
        <polygon
          key={entry.key}
          className={`radar__shape ${entry.variant ? `radar__shape--${entry.variant}` : ''}`}
          points={polygon(entry.vector)}
        />
      ))}

      {axes.map((axis, i) => {
        const [x, y] = labelPoint(i);
        const anchor = Math.abs(x - cx) < 6 ? 'middle' : x > cx ? 'start' : 'end';
        return (
          <g key={`label-${axis}`}>
            <text className="radar__label" x={x} y={y} textAnchor={anchor} dominantBaseline="middle">
              {MOOD_LABELS_SHORT[axis]}
            </text>
            {showValues && vectors[0] && (
              <text className="radar__value" x={x} y={y + 13} textAnchor={anchor} dominantBaseline="middle">
                {Math.round(vectors[0].vector?.[axis] ?? 50)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

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
