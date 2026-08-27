/**
 * Настроение сегодняшнего вечера — по свайпам последних минут.
 *
 * Профиль знает, что человек любит вообще. Но вечером он хочет чего-то
 * конкретного, и свайпы последних десяти минут говорят об этом лучше,
 * чем вся накопленная история: отклонил пять мрачных подряд — сегодня
 * не хочется мрачного, при любом профиле.
 *
 * До этого колода ранжировалась один раз и дальше просто листалась.
 * Человек мог двадцать раз сказать «нет» одному и тому же, и лента
 * не замечала.
 *
 * Ничего не сохраняется. Это состояние вечера, а не свойство человека:
 * завтра оно должно исчезнуть само, и записывать его в профиль значило
 * бы превратить сегодняшнее «не хочу» в вечное.
 */

import { RECOMMENDATION_CONFIG } from '../../shared/config/recommendation.js';
import { titleSimilarity, moodCloseness } from './affinity.js';

/** Сколько последних решений считаем «сегодняшним вечером». */
const WINDOW = 14;

/**
 * Копит решения сессии и говорит, куда сместилась лента.
 *
 * Хранит сами карточки, а не сводный вектор: усреднение — та самая
 * болезнь, от которой мы уходили, и заводить её заново на уровне
 * сессии было бы странно.
 */
export function createSessionMood({ window = WINDOW } = {}) {
  const liked = [];
  const passed = [];

  return {
    /** @param {object} title карточка @param {boolean} yes сказали ли «да» */
    record(title, yes) {
      if (!title?.tags) return;
      const list = yes ? liked : passed;
      list.push(title);
      if (list.length > window) list.shift();
    },

    get size() { return liked.length + passed.length; },

    /**
     * Множитель к оценке кандидата: выше единицы — сегодня в тему,
     * ниже — сегодня мимо.
     *
     * Возвращает единицу, пока решений мало: три свайпа — это не
     * настроение вечера, а случайность, и рулить по ним лентой значило
     * бы дёргать её на ровном месте.
     */
    weigh(title, { config = RECOMMENDATION_CONFIG } = {}) {
      const minimum = config.session?.minSignals ?? 6;
      if (liked.length + passed.length < minimum || !title?.tags) return 1;

      const pull = config.session?.pull ?? 0.35;
      const push = config.session?.push ?? 0.30;

      const near = (list) => {
        let best = 0;
        for (const other of list) {
          const value = titleSimilarity(title.tags, other.tags) * 0.75
            + moodCloseness(title.moods, other.moods) * 0.25;
          if (value > best) best = value;
        }
        return best;
      };

      /*
       * Притяжение к тому, что сегодня заходит, и отталкивание от того,
       * что сегодня не идёт. Отталкивание слабее притяжения намеренно:
       * «нет» человек говорит по десятку причин, а «да» — по одной.
       */
      const toLiked = liked.length ? near(liked) : 0;
      const toPassed = passed.length ? near(passed) : 0;

      const factor = 1 + toLiked * pull - toPassed * push;
      return Math.min(1 + pull, Math.max(1 - push, factor));
    },

    /** Новая сессия — новое настроение. */
    reset() {
      liked.length = 0;
      passed.length = 0;
    },
  };
}

/**
 * Пересортировывает хвост очереди под настроение вечера.
 *
 * Верхние карточки не трогаются: человек их уже видит, и подмена
 * картинки под рукой читается как сбой, а не как забота.
 */
export function resortQueue(queue, session, { keepTop = 2, config = RECOMMENDATION_CONFIG } = {}) {
  if (!queue?.length || session.size < (config.session?.minSignals ?? 6)) return queue;

  const head = queue.slice(0, keepTop);
  const tail = queue.slice(keepTop);
  if (tail.length < 2) return queue;

  const weighed = tail.map((entry) => ({
    entry,
    value: (entry.score ?? 0) * session.weigh(entry.title, { config }),
  }));

  weighed.sort((a, b) => b.value - a.value);
  return [...head, ...weighed.map((w) => w.entry)];
}
