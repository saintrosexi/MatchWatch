import { Bookmark, Eye, RotateCcw, Star, X } from 'lucide-react';

/**
 * Кнопки под колодой — расположение фиксированное:
 *
 *   ↩  вернуть последнее решение
 *   ✕  мимо (то же, что свайп влево)
 *   🔖 желаемое — крупная, по центру
 *   👁 смотрел
 *   ★  избранное (то же, что свайп вправо)
 */
export function ActionBar({
  onUndo, onPass, onWish, onWatched, onFavorite, disabled, canUndo,
}) {
  return (
    <div className="actions" role="group" aria-label="Действия с карточкой">
      <button
        type="button"
        className="action action--sm action--undo"
        onClick={onUndo}
        disabled={!canUndo || disabled}
        aria-label="Вернуть последнее решение"
        title="Вернуть последнее решение"
      >
        <RotateCcw size={18} />
      </button>

      <button
        type="button"
        className="action action--md action--no"
        onClick={onPass}
        disabled={disabled}
        aria-label="Мимо — больше не показывать"
        title="Мимо — больше не показывать"
      >
        <X size={24} strokeWidth={2.4} />
      </button>

      <button
        type="button"
        className="action action--lg action--wish"
        onClick={onWish}
        disabled={disabled}
        aria-label="В желаемое"
        title="Желаемое — отложить, не объявляя любимым"
      >
        <Bookmark size={27} fill="currentColor" strokeWidth={0} />
      </button>

      <button
        type="button"
        className="action action--md action--seen"
        onClick={onWatched}
        disabled={disabled}
        aria-label="Уже смотрел"
        title="Уже смотрел"
      >
        <Eye size={22} />
      </button>

      <button
        type="button"
        className="action action--md action--fav"
        onClick={onFavorite}
        disabled={disabled}
        aria-label="В избранное"
        title="В избранное — то же, что свайп вправо"
      >
        <Star size={22} fill="currentColor" strokeWidth={0} />
      </button>
    </div>
  );
}
