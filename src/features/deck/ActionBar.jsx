import { Bookmark, Eye, Heart, RotateCcw, X } from '../../ui/icons.js';

/**
 * Кнопки под колодой.
 *
 * Четыре решения, которые человек принимает о фильме, и отмена пятой:
 *
 *   ↩  вернуть последнее решение
 *   ✕  пропуск (то же, что свайп влево)
 *   🔖 буду смотреть — крупная, по центру
 *   👁 просмотрено
 *   ♥  нравится (то же, что свайп вправо)
 *
 * В комнате остаются только «нет» и «да»: там решение принимают двое
 * и одновременно, а «просмотрено» и «буду смотреть» — личные пометки,
 * которые к общему выбору отношения не имеют и только сбивают темп.
 */
export function ActionBar({
  onUndo, onPass, onWish, onWatched, onLike, disabled, canUndo, compact = false,
}) {
  return (
    <div className="actions" role="group" aria-label="Действия с карточкой">
      {!compact && (
        <button
          type="button"
          className="action action--sm action--undo"
          onClick={onUndo}
          disabled={!canUndo || disabled}
          aria-label="Вернуть последнее решение"
          title="Вернуть последнее решение"
        >
          <RotateCcw size={20} />
        </button>
      )}

      <button
        type="button"
        className={`action ${compact ? 'action--lg' : 'action--md'} action--no`}
        onClick={onPass}
        disabled={disabled}
        aria-label={compact ? 'Нет' : 'Пропустить — больше не показывать'}
        title={compact ? 'Нет' : 'Пропустить — больше не показывать'}
      >
        <X size={compact ? 28 : 24} />
      </button>

      {!compact && (
        <>
          <button
            type="button"
            className="action action--lg action--wish"
            onClick={onWish}
            disabled={disabled}
            aria-label="Буду смотреть"
            title="Буду смотреть — отложить на вечер"
          >
            <Bookmark size={26} weight="fill" />
          </button>

          <button
            type="button"
            className="action action--md action--seen"
            onClick={onWatched}
            disabled={disabled}
            aria-label="Просмотрено"
            title="Просмотрено"
          >
            <Eye size={20} />
          </button>
        </>
      )}

      <button
        type="button"
        className={`action ${compact ? 'action--lg' : 'action--md'} action--fav`}
        onClick={onLike}
        disabled={disabled}
        aria-label={compact ? 'Да' : 'Нравится'}
        title={compact ? 'Да' : 'Нравится — то же, что свайп вправо'}
      >
        <Heart size={compact ? 28 : 22} weight="fill" />
      </button>
    </div>
  );
}
