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
/*
 * Порог вертикального жеста — доля высоты карточки.
 *
 * Больше горизонтального намеренно: вертикаль конкурирует со скроллом
 * страницы, и случайное «посмотрел» стоит дороже случайного «мимо» —
 * его не видно в ленте, чтобы отменить.
 */
const UP_THRESHOLD = 0.34;

/**
 * Порог тапа — по ПРОЙДЕННОМУ пути, а не по конечной точке.
 *
 * Палец при обычном нажатии смещается на 5–15 пикселей, поэтому жёсткие
 * 8 пикселей превращали половину тапов в неудавшийся свайп. И наоборот:
 * если тянуть карточку, раздумывая, и отпустить там же, где начал,
 * конечное смещение равно нулю — по конечной точке это выглядит тапом,
 * хотя пользователь явно перетаскивал.
 *
 * 20 пикселей — с запасом на дрожание пальца на телефоне и всё ещё
 * вчетверо меньше порога свайпа, так что перепутать эти два жеста нельзя.
 */
const TAP_SLOP = 20;

/** Долгое удержание — это раздумье над свайпом, а не нажатие. */
const TAP_MAX_MS = 600;

/** Окно, в котором повторный тап считается тем же самым нажатием. */
const TAP_DEDUPE_MS = 350;

/** Элементы со своим поведением: жест их не трогает. */
const INERT = 'button, a, [data-no-drag]';

/** Цель события не обязана быть элементом — у текстового узла нет closest. */
const inInert = (target) => typeof target?.closest === 'function' && Boolean(target.closest(INERT));

export function useSwipeGesture({
  onDecision, onProgress, onTap, enabled = true,
  /*
   * Вертикальные жесты — личные пометки. В комнате их нет: там решают
   * вдвоём «смотрим ли это сегодня», а «я уже смотрел» к общему выбору
   * отношения не имеет.
   */
  verticalEnabled = true,
} = {}) {
  const cardRef = useRef(null);
  const state = useRef({
    active: false, startX: 0, startY: 0, x: 0, y: 0,
    lastX: 0, lastT: 0, velocity: 0, pointerId: null, width: 320,
    /** Наибольшее удаление от точки нажатия за весь жест. */
    travel: 0,
    /** Момент нажатия — короткий жест отличаем от долгого раздумья. */
    downT: 0,
    /** Предыдущий жест был перетаскиванием: следующий click — не тап. */
    dragged: false,
    /** Когда тап уже отдали наружу: страховка от двойного срабатывания. */
    lastTap: 0,
    /** Замеры и штампы текущей карточки: пересчитываются при её смене. */
    cache: null,
  });

  /*
   * Тап отдаётся наружу ровно один раз, откуда бы он ни пришёл —
   * из разбора жеста или из нативного click. Два независимых источника
   * нужны потому, что цепочка pointer-событий обрывается на некоторых
   * платформах (WebView Telegram, захват указателя), и тогда нажатие
   * по карточке просто пропадало. Нативный click в этих случаях доходит.
   */
  const fireTap = useCallback(() => {
    const now = performance.now();
    if (now - state.current.lastTap < TAP_DEDUPE_MS) return;
    state.current.lastTap = now;
    onTap?.();
  }, [onTap]);

  /*
   * Размеры и штампы карточки — раз на карточку, а не раз на кадр.
   *
   * offsetHeight внутри кадра заставляет браузер пересчитать раскладку,
   * а три querySelector дают три обхода дерева — и всё это шестьдесят
   * раз в секунду, пока палец на экране. На телефоне такой кадр
   * не укладывается в бюджет, и свайп идёт рывками.
   */
  const measure = useCallback((node) => {
    const cache = state.current.cache;
    if (cache?.node === node) return cache;
    const next = {
      node,
      width: node.offsetWidth || 320,
      height: node.offsetHeight || 480,
      yes: node.querySelector('.card__stamp--yes'),
      no: node.querySelector('.card__stamp--no'),
      seen: node.querySelector('.card__stamp--seen'),
      later: node.querySelector('.card__stamp--later'),
    };
    state.current.cache = next;
    return next;
  }, []);

  const paint = useCallback((x, y, { animate = false } = {}) => {
    const node = cardRef.current;
    if (!node) return;
    const box = measure(node);
    const width = state.current.width || box.width;
    const progress = Math.max(-1, Math.min(1, x / (width * DISTANCE_RATIO)));
    const vertical = y / (box.height * UP_THRESHOLD);
    const upProgress = Math.max(0, Math.min(1, -vertical));
    const downProgress = Math.max(0, Math.min(1, vertical));

    node.style.transition = animate ? 'transform var(--dur-base) var(--ease-out)' : 'none';
    node.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${progress * MAX_ROTATION}deg)`;

    /*
     * Штампы красим напрямую. Раньше рядом с этим писались ещё три
     * пользовательских свойства на саму карточку — их не читал ни один
     * стиль, а каждая такая запись помечала всё поддерево карточки
     * на пересчёт стилей.
     */
    if (box.yes) box.yes.style.opacity = String(Math.max(0, progress));
    if (box.no) box.no.style.opacity = String(Math.max(0, -progress));
    if (box.seen) box.seen.style.opacity = String(upProgress);
    if (box.later) box.later.style.opacity = String(downProgress);

    onProgress?.({ progress, upProgress, downProgress });
  }, [measure, onProgress]);

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
    const target = direction === 'up' ? { x: 0, y: -distance }
      : direction === 'down' ? { x: 0, y: distance }
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
    if (inInert(event.target)) return;

    const node = cardRef.current;
    if (!node) return;

    state.current = {
      ...state.current,
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      x: 0, y: 0,
      travel: 0,
      downT: event.timeStamp,
      dragged: false,
      lastX: event.clientX,
      lastT: event.timeStamp,
      velocity: 0,
      pointerId: event.pointerId,
      width: measure(node).width,
    };

    /*
     * Захват указателя не критичен, но его вызов умеет бросать
     * NotFoundError — например, если браузер уже освободил указатель сам.
     * Непойманное исключение обрывало бы остаток обработчика.
     */
    try { node.setPointerCapture?.(event.pointerId); } catch { /* не мешает жесту */ }
    node.style.transition = 'none';
  }, [enabled, measure]);

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
    /*
     * Вертикаль слегка придерживаем — палец на телефоне уезжает вниз
     * сам собой, — но одинаково в обе стороны: теперь это два
     * равноправных жеста, «посмотрел» вверх и «буду смотреть» вниз.
     */
    s.y = dy * 0.7;
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
    const height = s.cache?.height ?? 480;
    const vertical = verticalEnabled && Math.abs(s.y) > height * UP_THRESHOLD;

    /*
     * Палец почти не двигался и отпущен быстро — это нажатие. Иначе жест
     * считается перетаскиванием, и нативный click, который придёт следом,
     * тапом уже не станет: иначе описание открывалось бы каждый раз, когда
     * карточку подвигали, раздумывая, и вернули на место.
     */
    const quick = !event || (event.timeStamp - s.downT) < TAP_MAX_MS;
    if (s.travel < TAP_SLOP && quick) {
      s.dragged = false;
      reset({ animate: false });
      fireTap();
      return;
    }
    s.dragged = true;

    if (vertical && Math.abs(s.x) < threshold) {
      const up = s.y < 0;
      fling(up ? 'up' : 'down', up ? 'watched' : 'later');
      return;
    }
    if (farEnough || (fastEnough && Math.abs(s.x) > threshold * 0.4)) {
      const right = s.x > 0 || (fastEnough && s.velocity > 0);
      fling(right ? 'right' : 'left', right ? 'like' : 'pass');
      return;
    }

    reset();
  }, [fling, reset, fireTap, verticalEnabled]);

  /*
   * Отмена жеста — браузер забрал управление себе. Нажатием это уже не
   * является, поэтому click после неё игнорируем.
   */
  const cancel = useCallback((event) => {
    state.current.dragged = true;
    finish(event);
  }, [finish]);

  /*
   * Запасной путь распознавания нажатия. Срабатывает, когда разбор жеста
   * до тапа не дошёл — например, pointerup не доехал до карточки. Если
   * жест уже был признан перетаскиванием, click пропускаем.
   */
  const onClick = useCallback((event) => {
    if (!enabled) return;
    if (inInert(event.target)) return;
    if (state.current.dragged) { state.current.dragged = false; return; }
    fireTap();
  }, [enabled, fireTap]);

  useEffect(() => reset({ animate: false }), [reset]);

  /*
   * Замеры привязаны к узлу карточки, а он переживает поворот экрана
   * и смену размера окна. Сбрасываем кеш, иначе порог свайпа считался бы
   * по прежней ширине.
   */
  useEffect(() => {
    const drop = () => { state.current.cache = null; };
    window.addEventListener('resize', drop);
    window.addEventListener('orientationchange', drop);
    return () => {
      window.removeEventListener('resize', drop);
      window.removeEventListener('orientationchange', drop);
    };
  }, []);

  return {
    cardRef,
    fling,
    reset,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: cancel,
      onLostPointerCapture: finish,
      onClick,
    },
  };
}
