/**
 * Настроение на сегодня.
 *
 * Отдельная вещь от накопленного вкуса. Вкус говорит, что человек любит
 * вообще; настроение — чего он хочет именно сейчас. Любитель триллеров
 * сегодня может хотеть комедию, и подборка обязана это услышать, не
 * забыв при этом, какие именно комедии ему заходят.
 *
 * Чип — мягкая цель, а не фильтр. Жёсткий отбор «только лёгкое» отрезает
 * каталог и приводит к пустой колоде: это мы уже проходили с фильтром
 * по рейтингу. Цель сдвигает оценку фильма, но ничего не выбрасывает.
 *
 * Каждый чип трогает только те оси, о которых он действительно говорит.
 * «Лёгкое» ничего не сообщает об эмоциональности, и приписывать ему
 * значение по этой оси значило бы придумать за человека требование,
 * которого он не выдвигал.
 */

/** Ключ особого режима: не настроение, а состав колоды. */
export const REWATCH = 'rewatch';

export const MOOD_PRESETS = Object.freeze([
  {
    key: 'light',
    label: 'Что-то лёгкое',
    hint: 'Не грузит, смотрится само',
    target: { energy: 65, darkness: 25, intellect: 35 },
  },
  {
    key: 'laugh',
    label: 'Посмеяться',
    hint: 'Комедия, и посмешнее',
    target: { energy: 72, darkness: 15, emotion: 60 },
  },
  {
    key: 'think',
    label: 'Подумать',
    hint: 'Есть о чём поговорить после',
    target: { intellect: 82, dynamism: 32 },
  },
  {
    key: 'action',
    label: 'Боевик',
    hint: 'Динамика и постановка',
    target: { dynamism: 85, energy: 80 },
  },
  {
    key: 'thrill',
    label: 'Пощекотать нервы',
    hint: 'Напряжение, тьма, саспенс',
    target: { darkness: 78, dynamism: 70 },
  },
  {
    key: 'cry',
    label: 'Поплакать',
    hint: 'Пробирает и остаётся',
    target: { emotion: 88, darkness: 62 },
  },
]);

const BY_KEY = new Map(MOOD_PRESETS.map((p) => [p.key, p]));

export const moodPreset = (key) => BY_KEY.get(key) ?? null;

/**
 * Складывает выбранные человеком чипы в один запрос.
 *
 * По каждой оси берётся среднее из тех чипов, что её упомянули. Оси,
 * которых не коснулся ни один чип, в запрос не попадают вовсе:
 * молчание — не требование, и притягивать его к нейтральным пятидесяти
 * значило бы отвергать всё яркое.
 *
 * @param {string[]} keys выбранные ключи чипов
 * @returns {{axes: Record<string, number>, rewatch: boolean, keys: string[]}}
 */
export function buildMoodRequest(input) {
  /*
   * На вход приходит либо массив ключей чипов, либо запрос целиком:
   * `{ keys, ai }`, где `ai` — разбор фразы, сказанной словами.
   * Массив поддерживается не ради совместимости, а потому что чипы
   * остаются самостоятельным способом сказать, чего хочешь, — и
   * работают, когда разбор недоступен или не настроен.
   */
  const keys = Array.isArray(input) ? input : (input?.keys ?? []);
  const ai = Array.isArray(input) ? null : (input?.ai ?? null);
  const chosen = (keys ?? []).filter((k) => BY_KEY.has(k));
  const sums = {};
  const counts = {};

  for (const key of chosen) {
    for (const [axis, value] of Object.entries(BY_KEY.get(key).target)) {
      sums[axis] = (sums[axis] ?? 0) + value;
      counts[axis] = (counts[axis] ?? 0) + 1;
    }
  }

  /*
   * Сказанное словами складывается с чипами, а не заменяет их.
   *
   * Это один и тот же человек, выразивший одно и то же желание двумя
   * способами: выбрал «Посмеяться» и дописал «но не тупое». Отдать
   * победу одному из них значило бы выбросить половину сказанного.
   * По каждой оси берётся среднее из всех источников, которые её
   * назвали, — ровно то же правило, что между самими чипами.
   */
  for (const [axis, value] of Object.entries(ai?.axes ?? {})) {
    if (!Number.isFinite(Number(value))) continue;
    sums[axis] = (sums[axis] ?? 0) + Number(value);
    counts[axis] = (counts[axis] ?? 0) + 1;
  }

  const axes = {};
  for (const axis of Object.keys(sums)) {
    axes[axis] = Math.round(sums[axis] / counts[axis]);
  }

  return {
    axes,
    /*
     * Пересмотр остаётся кнопкой и разбору не отдаётся. Это не
     * настроение, а состав колоды: «пересмотреть любимое» подмешивает
     * уже увиденное вместо того, чтобы его исключить. Такое решение
     * человек принимает сам, а не через угадывание по фразе.
     */
    rewatch: (keys ?? []).includes(REWATCH),
    keys: chosen,
    /** Теги из разбора — для прямого совпадения там, где карточка обогащена. */
    tags: (ai?.tags ?? []).filter((t) => t?.tag),
    /** Чего просили избежать. Просьбу одного уважают все. */
    avoid: (ai?.avoid ?? []).filter((t) => t?.tag),
    /** Что именно поняли из фразы. Показывается человеку. */
    summary: ai?.summary ?? null,
    text: ai?.text ?? null,
    filters: ai?.filters ?? {},
  };
}

/**
 * Насколько фильм отвечает запросу: 0 — мимо, 1 — точно в цель.
 *
 * Считается только по осям, которые человек назвал. Пустой запрос
 * возвращает null, а не единицу: «нет требований» и «всё подходит» —
 * разные вещи, и вызывающий код должен уметь их различать.
 */
export function moodRequestFit(moods, request) {
  const axes = Object.entries(request?.axes ?? {});
  if (!axes.length || !moods) return null;

  let total = 0;
  for (const [axis, target] of axes) {
    const actual = moods[axis] ?? 50;
    total += 1 - Math.min(1, Math.abs(actual - target) / 100);
  }
  return Math.round((total / axes.length) * 1000) / 1000;
}

/**
 * Оценка фильма для комнаты — по тому, кому он подходит хуже всего.
 *
 * Среднее здесь было бы ошибкой: если один хочет посмеяться, а другой —
 * пощекотать нервы, среднее выведет наверх серую середину, которая
 * не нравится никому. Минимум гарантирует, что фильм приемлем каждому.
 *
 * Согласие вознаграждается отдельно: когда фильм хорош сразу всем,
 * он поднимается выше вымученного компромисса.
 *
 * @param {object} moods вектор настроения фильма
 * @param {Array} requests запросы участников
 * @param {number} agreementBonus надбавка за то, что фильм устроил всех
 */
export function roomMoodFit(moods, requests, { agreementBonus = 0.15 } = {}) {
  const fits = (requests ?? [])
    .map((request) => moodRequestFit(moods, request))
    .filter((fit) => fit !== null);

  if (!fits.length) return null;

  const worst = Math.min(...fits);
  const everyoneHappy = fits.every((fit) => fit >= 0.7);
  const score = everyoneHappy ? worst + agreementBonus : worst;

  return Math.round(Math.min(1, score) * 1000) / 1000;
}
