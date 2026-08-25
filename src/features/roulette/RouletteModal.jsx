import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dices, Play, Star } from 'lucide-react';
import { Sheet } from '../../ui/Sheet.jsx';
import { Poster } from '../../ui/Poster.jsx';
import { haptic } from '../../lib/telegram.js';
import { sfx, unlockAudio } from '../../lib/sound.js';
import { trackMetric } from '../../lib/telemetry.js';
import { METRIC } from '../../../shared/telemetry/events.js';
import { pickReel, rouletteCandidates } from '../../engine/roulette.js';

/** Сколько полных оборотов проходит лента до остановки. */
const LOOPS = 3;
const SPIN_MS = 2800;

/**
 * Кино-рулетка.
 *
 * Берёт десять фильмов из рекомендаций, прокручивает их и останавливается
 * на десятом — лучшем по качеству. Исход предрешён с самого начала, и это
 * намеренно: рулетка здесь не про случайность выбора, а про то, чтобы
 * снять с человека необходимость решать. Случаен состав, а не победитель.
 */
export function RouletteModal({ open, onClose, pool = [], onPick, history = {} }) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const timers = useRef([]);
  const stripRef = useRef(null);
  const animation = useRef(null);

  const candidates = useMemo(() => rouletteCandidates(pool, history), [pool, history]);

  /**
   * Барабан: девять случайных фильмов, а на последнем месте — лучший
   * по качеству из выбранной десятки. Он и выпадет.
   */
  const reel = useMemo(() => pickReel(candidates), [candidates, open]);

  const winner = reel[reel.length - 1] ?? null;

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const stopAnimation = () => { animation.current?.cancel(); animation.current = null; };

  useEffect(() => () => { clearTimers(); stopAnimation(); }, []);

  useEffect(() => {
    if (!open) { clearTimers(); stopAnimation(); setSpinning(false); setResult(null); }
  }, [open]);

  const spin = useCallback(() => {
    if (spinning || reel.length < 2) return;
    unlockAudio();
    clearTimers();
    stopAnimation();
    setResult(null);
    setSpinning(true);
    trackMetric(METRIC.ROULETTE_SPIN, { context: { poolSize: candidates.length } });

    /*
     * Анимируем ленту напрямую, а не через состояние React: перерисовка
     * между «сбросить в ноль» и «уехать в конец» происходит в неизвестный
     * момент, и переход то запускался, то нет. Web Animations API даёт
     * гарантию — кадры считает браузер, а не порядок рендеров.
     */
    const node = stripRef.current;
    const cellHeight = node?.firstElementChild?.getBoundingClientRect().height ?? 0;
    const target = reel.length * LOOPS + (reel.length - 1);

    if (node && cellHeight > 0) {
      animation.current = node.animate(
        [{ transform: 'translateY(0)' }, { transform: `translateY(-${target * cellHeight}px)` }],
        { duration: SPIN_MS, easing: 'cubic-bezier(0.12, 0.72, 0.12, 1)', fill: 'forwards' },
      );
    }

    const ticker = setInterval(() => { sfx.reel(); haptic('soft'); }, 170);
    timers.current.push(setTimeout(() => clearInterval(ticker), SPIN_MS - 250));

    timers.current.push(setTimeout(() => {
      setSpinning(false);
      setResult(winner);
      haptic('success');
      sfx.favorite();
    }, SPIN_MS));
  }, [spinning, reel, winner, candidates.length]);

  /*
   * Закрытие обязано быть безотказным. Здесь уже жила опечатка от прошлой
   * реализации — вызов исчезнувшего сеттера ронял обработчик до onClose(),
   * и крестик переставал работать. Поэтому уборка обёрнута в try, а
   * onClose() стоит так, чтобы выполниться при любом исходе.
   */
  const close = useCallback(() => {
    try {
      clearTimers();
      stopAnimation();
      setSpinning(false);
      setResult(null);
    } finally {
      onClose?.();
    }
  }, [onClose]);

  // Лента повторяется, чтобы прокрутка выглядела бесконечной.
  const strip = useMemo(
    () => Array.from({ length: LOOPS + 1 }, () => reel).flat(),
    [reel],
  );

  return (
    <Sheet open={open} onClose={close} title="Кино-рулетка" variant="center">
      <div className="roulette">
        <p className="state__text">
          {result
            ? 'Лучший из десяти — смотрим его.'
            : 'Возьмём десять фильмов из ваших рекомендаций и выберем за вас.'}
        </p>

        <div className="reel">
          <div className="reel__strip" ref={stripRef}>
            {strip.map((movie, i) => (
              <div className="reel__cell" key={`${movie.id}-${i}`}>
                <Poster src={movie.poster} alt={movie.title} size="w342" eager={i < 4} />
              </div>
            ))}
          </div>
          <div className="reel__frame" />
        </div>

        {result && (
          <div className="stack gap-2" style={{ textAlign: 'center', alignItems: 'center' }}>
            <h3 style={{ fontSize: 'var(--t-title)' }}>{result.title}</h3>
            <div className="row gap-2">
              {result.rating > 0 && (
                <span className="badge badge--rating">
                  <Star size={11} fill="currentColor" strokeWidth={0} /> {result.rating.toFixed(1)}
                </span>
              )}
              {result.year && <span className="chip">{result.year}</span>}
              {result.genres?.[0] && <span className="chip">{result.genres[0]}</span>}
            </div>
          </div>
        )}

        <div className="row gap-3">
          <button
            type="button"
            className="btn btn--gold btn--lg"
            onClick={spin}
            disabled={spinning || reel.length < 2}
          >
            <Dices size={18} /> {result ? 'Ещё раз' : 'Крутить'}
          </button>
          {result && (
            <button type="button" className="btn btn--primary btn--lg" onClick={() => { onPick?.(result); close(); }}>
              <Play size={18} /> Открыть
            </button>
          )}
        </div>

        {candidates.length < 2 && (
          <p className="faint" style={{ fontSize: 'var(--t-small)' }}>
            Нечего крутить: сначала откройте ленту, чтобы подтянулись рекомендации.
          </p>
        )}
      </div>
    </Sheet>
  );
}
