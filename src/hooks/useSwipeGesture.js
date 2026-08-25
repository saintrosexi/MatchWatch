/**
 * Физика свайпа карточки.
 *
 * Позиция карточки во время перетаскивания меняется напрямую в DOM, а не
 * через состояние React: 60 кадров в секунду с ре-рендером всего дерева
 * на каждое движение пальца мобильный браузер не тянет.
 *
 * Решение о свайпе принимается по двум критериям — пройденное расстояние
 * ИЛИ скорость броска. Только по расстоянию быстрый флик теряется.
 */

import { useCallback, useEffect, useRef } from 'react';

const DISTANCE_RATIO = 0.28;   // доля ширины карточки
const VELOCITY_THRESHOLD = 0.55; // px/ms
const MAX_ROTATION = 16;
const UP_THRESHOLD = 0.34;

/**
 * Порог тапа — по ПРОЙДЕННОМУ пути, а не по конечной точке.
 *
 * Палец при обычном нажатии смещается на 5–15 пикселей, поэтому жёсткие
 * 8 пикселей превращали половину тапов в неудавшийся свайп. И наоборот:
 * если тянуть карточку, раздумывая, и отпустить там же, где начал,
 * конечное смещение равно нулю — по конечной точке это выглядит тапом,
 * хотя пользователь явно перетаскивал.
 */
const TAP_SLOP = 14;

export function useSwipeGesture({ onDecision, onProgress, onTap, enabled = true } = {}) {
  const cardRef = useRef(null);
  const state = useRef({
    active: false, startX: 0, startY: 0, x: 0, y: 0,
    lastX: 0, lastT: 0, velocity: 0, pointerId: null, width: 320,
    /** Наибольшее удаление от точки нажатия за весь жест. */
    travel: 0,
  });

  const paint = useCallback((x, y, { animate = false } = {}) => {
    const node = cardRef.current;
    if (!node) return;
    const width = state.current.width || node.offsetWidth || 320;
    const progress = Math.max(-1, Math.min(1, x / (width * DISTANCE_RATIO)));
    const upProgress = Math.max(0, Math.min(1, -y / (node.offsetHeight * UP_THRESHOLD)));

    node.style.transition = animate ? 'transform var(--dur-base) var(--ease-out)' : 'none';
    node.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${progress * MAX_ROTATION}deg)`;

    node.style.setProperty('--yes-opacity', String(Math.max(0, progress)));
    node.style.setProperty('--no-opacity', String(Math.max(0, -progress)));
    node.style.setProperty('--up-opacity', String(upProgress));

    const yes = node.querySelector('.card__stamp--yes');
    const no = node.querySelector('.card__stamp--no');
    const info = node.querySelector('.card__stamp--info');
    if (yes) yes.style.opacity = String(Math.max(0, progress));
    if (no) no.style.opacity = String(Math.max(0, -progress));
    if (info) info.style.opacity = String(upProgress);

    onProgress?.({ progress, upProgress });
  }, [onProgress]);

  const reset = useCallback(({ animate = true } = {}) => {
    state.current.x = 0;
    state.current.y = 0;
    paint(0, 0, { animate });
  }, [paint]);

  /** Программный «бросок» — для кнопок под колодой и для клавиатуры. */
  const fling = useCallback((direction, decision) => {
    const node = cardRef.current;
    if (!node) { onDecision?.(decision); return; }

    const distance = (window.innerWidth || 400) * 1.35;
    const target = direction === 'up'
      ? { x: 0, y: -distance }
      : { x: direction === 'right' ? distance : -distance, y: state.current.y * 0.4 };

    node.classList.add('card--flying');
    node.style.transition = 'transform 420ms var(--ease-out), opacity 420ms var(--ease-out)';
    node.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) rotate(${direction === 'right' ? 22 : direction === 'left' ? -22 : 0}deg)`;
    node.style.opacity = '0';

    setTimeout(() => onDecision?.(decision), 190);
  }, [onDecision]);

  const onPointerDown = useCallback((event) => {
    if (!enabled) return;
    // Кнопки внутри карточки не должны запускать перетаскивание.
    if (event.target.closest('button, a, [data-no-drag]')) return;

    const node = cardRef.current;
    if (!node) return;

    state.current = {
      ...state.current,
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      x: 0, y: 0,
      travel: 0,
      lastX: event.clientX,
      lastT: event.timeStamp,
      velocity: 0,
      pointerId: event.pointerId,
      width: node.offsetWidth || 320,
    };

    /*
     * Захват указателя не критичен, но его вызов умеет бросать
     * NotFoundError — например, если браузер уже освободил указатель сам.
     * Непойманное исключение обрывало бы остаток обработчика.
     */
    try { node.setPointerCapture?.(event.pointerId); } catch { /* не мешает жесту */ }
    node.style.transition = 'none';
  }, [enabled]);

  const onPointerMove = useCallback((event) => {
    const s = state.current;
    if (!s.active || event.pointerId !== s.pointerId) return;

    const dx = event.clientX - s.startX;
    const dy = event.clientY - s.startY;
    const dt = Math.max(1, event.timeStamp - s.lastT);

    s.velocity = (event.clientX - s.lastX) / dt;
    s.lastX = event.clientX;
    s.lastT = event.timeStamp;
    s.x = dx;
    // Вертикаль демпфируем: карточка не должна «улетать» вниз при скролле.
    s.y = dy > 0 ? dy * 0.35 : dy * 0.7;
    s.travel = Math.max(s.travel, Math.hypot(dx, dy));

    paint(s.x, s.y);
  }, [paint]);

  const finish = useCallback((event) => {
    const s = state.current;
    if (!s.active || (event && event.pointerId !== s.pointerId)) return;
    s.active = false;

    const node = cardRef.current;
    /*
     * Здесь исключение опаснее всего: оно обрывало распознавание тапа,
     * и нажатие по карточке переставало открывать описание. На тачскрине
     * браузер освобождает указатель сам, и повторный вызов падает.
     */
    try { node?.releasePointerCapture?.(s.pointerId); } catch { /* уже освобождён */ }

    const threshold = s.width * DISTANCE_RATIO;
    const fastEnough = Math.abs(s.velocity) > VELOCITY_THRESHOLD;
    const farEnough = Math.abs(s.x) > threshold;
    const upEnough = -s.y > (node?.offsetHeight ?? 480) * UP_THRESHOLD;

    // Палец почти не двигался за весь жест — это тап, а не перетаскивание.
    if (s.travel < TAP_SLOP) {
      reset({ animate: false });
      onTap?.();
      return;
    }

    if (upEnough && Math.abs(s.x) < threshold) {
      fling('up', 'details');
      return;
    }
    if (farEnough || (fastEnough && Math.abs(s.x) > threshold * 0.4)) {
      const right = s.x > 0 || (fastEnough && s.velocity > 0);
      fling(right ? 'right' : 'left', right ? 'like' : 'pass');
      return;
    }

    reset();
  }, [fling, reset, onTap]);

  useEffect(() => reset({ animate: false }), [reset]);

  return {
    cardRef,
    fling,
    reset,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onLostPointerCapture: finish,
    },
  };
}
