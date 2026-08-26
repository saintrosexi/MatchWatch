import { useCallback, useEffect, useRef, useState } from 'react';
import { SwipeCard } from './SwipeCard.jsx';
import { ActionBar } from './ActionBar.jsx';
import { useSwipeGesture } from '../../hooks/useSwipeGesture.js';
import { EmptyState, ErrorState, LoadingState } from '../../ui/States.jsx';
import { prefetchPosters } from '../../ui/Poster.jsx';
import { haptic } from '../../lib/telegram.js';
import { sfx, unlockAudio } from '../../lib/sound.js';
import { ACTION } from '../../engine/tasteProfile.js';
import { getConfig } from '../../engine/recommendationConfig.js';
import { Compass, PartyPopper, SlidersHorizontal, Users } from '../../ui/icons.js';

/**
 * Стопка карточек: жест, кнопки, клавиатура и предзагрузка постеров.
 *
 * Управление с клавиатуры сделано не «на всякий случай»: на десктопе
 * стрелками листать быстрее, чем таскать мышью.
 */
export function SwipeDeck({
  deck, onDecision, onOpenDetails, onOpenFilters, onRestart, onUndo, canUndo,
  /** В комнате остаются только «нет» и «да» — личные пометки там лишние. */
  compact = false,
  /** Прогресс участников комнаты: { size, mine, slowest, byUser }. */
  roomProgress = null,
  roomMembers = null,
  emptyTitle = 'Колода закончилась',
  emptyText = 'Мы показали всё, что подходит под фильтры. Ослабьте их — и лента оживёт.',
  emptyArt = null,
}) {
  const { current, upcoming, loading, refilling, error, exhausted, progress, processed } = deck;
  const [busy, setBusy] = useState(false);
  const lastEntry = useRef(null);

  const commit = useCallback(async (action) => {
    if (!current || busy) return;
    setBusy(true);
    lastEntry.current = current;
    const decided = current;
    try {
      await onDecision(decided, action);
    } finally {
      // Снимаем именно ту карточку, по которой приняли решение.
      deck.advance(decided.id);
      setBusy(false);
    }
  }, [current, busy, onDecision, deck]);

  const { cardRef, fling, bind } = useSwipeGesture({
    enabled: Boolean(current) && !busy,
    // Тап по карточке открывает описание — отдельной кнопки для этого нет.
    onTap: () => onOpenDetails?.(current),
    onDecision: (decision) => {
      unlockAudio();
      if (decision === 'details') { onOpenDetails?.(current); return; }
      // Свайп вправо — «нравится»: главный жест несёт главный вес.
      if (decision === 'like') { haptic('success'); sfx.favorite(); commit(ACTION.FAVORITE); }
      else { haptic('light'); sfx.pass(); commit(ACTION.DISLIKE); }
    },
  });

  /* Постеры следующих карточек грузим заранее — иначе они «проявляются». */
  useEffect(() => {
    const count = getConfig().deck.posterPrefetch;
    prefetchPosters(upcoming.slice(0, count).map((e) => e.title.poster));
  }, [upcoming]);

  /* Клавиатура: стрелки — свайп, F — «нравится», пробел — детали. */
  useEffect(() => {
    if (!current) return undefined;
    const onKey = (e) => {
      // Цель события не обязана быть элементом: клавиатурные события
      // приходят и от document, у которого нет matches.
      const target = e.target;
      if (typeof target?.matches === 'function'
        && target.matches('input, textarea, [contenteditable]')) return;
      const wish = () => { haptic('medium'); sfx.like(); commit(ACTION.LATER); };
      const seen = () => { haptic('medium'); sfx.tick(); commit(ACTION.WATCHED); };
      const map = {
        ArrowLeft: () => { haptic('light'); sfx.pass(); fling('left', 'pass'); },
        ArrowRight: () => { haptic('success'); sfx.favorite(); fling('right', 'like'); },
        ArrowUp: () => onOpenDetails?.(current),
        ' ': () => onOpenDetails?.(current),
        s: wish, ы: wish,
        w: seen, ц: seen,
        z: () => onUndo?.(), я: () => onUndo?.(),
      };
      const handler = map[e.key];
      if (!handler) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, fling, commit, onOpenDetails, onUndo]);

  // Пока едет следующая пачка, финальный экран показывать нельзя:
  // колода не кончилась, просто очередь на секунду опустела.
  if ((loading || refilling) && !current) {
    return <LoadingState text={refilling ? 'Подбираем следующую пачку…' : 'Подбираем кино под ваш вкус…'} />;
  }

  if (error && !current) {
    return <ErrorState error={error} onRetry={deck.retry} module="deck.build" />;
  }

  if (!current) {
    /*
     * «Колода закончилась» имеет право появиться, только когда каталог
     * действительно кончился. Пустая очередь сама по себе означает лишь
     * то, что впереди идёт длинная полоса уже решённого: у человека
     * с сотнями отметок это обычное дело, и объявлять ему конец кино
     * посреди каталога — враньё.
     */
    /*
     * В комнате пустая очередь чаще всего значит «я закончил порцию,
     * остальные ещё нет». Показывать здесь загрузку было бы враньём:
     * ничего не грузится, идёт ожидание живых людей.
     */
    if (roomProgress?.size && roomProgress.slowest < roomProgress.size) {
      const waiting = Object.entries(roomProgress.byUser ?? {})
        .filter(([, done]) => done < roomProgress.size)
        .map(([uid, done]) => ({
          name: roomMembers?.find((m) => m.uid === uid)?.name ?? 'Участник',
          done,
        }));

      return (
        <EmptyState
          icon={Users}
          title="Свою пачку вы прошли"
          text="Ждём остальных — как только все закончат, добавим ещё карточек."
          action={(
            <div className="stack gap-2" style={{ minWidth: 220 }}>
              {waiting.map((person) => (
                <div className="row row--between" key={person.name}>
                  <span className="member__name">{person.name}</span>
                  <span className="mono faint">{person.done} из {roomProgress.size}</span>
                </div>
              ))}
            </div>
          )}
        />
      );
    }

    if (!exhausted) {
      return <LoadingState text="Листаем каталог дальше — вы много чего уже видели…" />;
    }

    return (
      <EmptyState
        icon={exhausted ? PartyPopper : Compass}
        art={emptyArt}
        title={emptyTitle}
        text={emptyText}
        action={(
          <div className="row gap-3">
            {onOpenFilters && (
              <button type="button" className="btn btn--primary" onClick={onOpenFilters}>
                <SlidersHorizontal size={16} /> Изменить фильтры
              </button>
            )}
            {onRestart && (
              <button type="button" className="btn btn--ghost" onClick={onRestart}>
                Начать заново
              </button>
            )}
          </div>
        )}
      />
    );
  }

  return (
    <>
      <div className="deck">
        <div className="deck__stage">
          {[...upcoming].reverse().map((entry, index) => (
            <SwipeCard
              key={entry.id}
              entry={entry}
              depth={upcoming.length - index}
            />
          ))}
          <SwipeCard
            key={current.id}
            ref={cardRef}
            entry={current}
            isTop
            bind={bind}
            onOpenDetails={() => onOpenDetails?.(current)}
          />
        </div>
      </div>

      <div className="deck-progress">
        <span className="mono">{processed}</span>
        <div className="deck-progress__bar">
          <div className="deck-progress__fill" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
        <span className="mono">{deck.queue.length}</span>
      </div>

      <ActionBar
        disabled={busy}
        canUndo={canUndo}
        compact={compact}
        onUndo={onUndo}
        onPass={() => { haptic('light'); sfx.pass(); fling('left', 'pass'); }}
        onWish={() => { haptic('medium'); sfx.like(); commit(ACTION.LATER); }}
        onWatched={() => { haptic('medium'); sfx.tick(); commit(ACTION.WATCHED); }}
        onLike={() => { haptic('success'); sfx.favorite(); fling('right', 'like'); }}
      />
    </>
  );
}
