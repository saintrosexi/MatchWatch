/**
 * Фирменный знак и связка со словом.
 *
 * Знак — статичный SVG, слово — живой HTML-текст: так градиент наследует
 * тему, шрифт остаётся тем же, что и в интерфейсе, а скринридер читает
 * название, а не «изображение».
 */

export function BrandMark({ size = 32, className = '' }) {
  return (
    <img
      className={className}
      src="/logo-mark.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

/**
 * @param {'sm'|'md'|'lg'|'xl'} size
 * @param {boolean} stacked  знак сверху, слово снизу
 */
export function BrandLockup({ size = 'md', stacked = false, className = '' }) {
  const marks = { sm: 22, md: 30, lg: 44, xl: 72 };
  return (
    <span className={`brand brand--${size} ${stacked ? 'brand--stacked' : ''} ${className}`}>
      <BrandMark size={marks[size]} className="brand__mark" />
      <span className="brand__word">
        <span className="brand__word-a">Match</span><span className="brand__word-b">Watch</span>
      </span>
    </span>
  );
}
