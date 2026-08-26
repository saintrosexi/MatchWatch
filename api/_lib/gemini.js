/**
 * Клиент Gemini.
 *
 * Одно правило определяет здесь всё остальное: **обрезанного ответа
 * не бывает**. Модель либо вернула полный разбор, либо мы отдаём ошибку.
 * Половина ответа хуже отказа: подборка молча собралась бы не по тому,
 * что человек просил, и списать это было бы не на что.
 *
 * Отсюда три решения:
 *   1. Ответ запрашивается по схеме (`responseSchema`), а не свободным
 *      текстом. Разбирать JSON из прозы — значит рано или поздно поймать
 *      обрыв на середине объекта.
 *   2. Потолок токенов берётся с запасом, и в него входят рассуждения
 *      модели: у думающих моделей они тратят тот же бюджет, что и ответ.
 *   3. `finishReason: MAX_TOKENS` — это ошибка, а не «повезло, разберём
 *      что успело приехать».
 */

const API = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Ключи по порядку. Запасные нужны для одного: бесплатная квота
 * кончается посреди прогона, и без второго ключа работа встаёт.
 *
 * Лимиты Google считаются на проект, поэтому запасной имеет смысл
 * только из другого проекта — два ключа одного не дадут ничего.
 */
export const geminiKeys = () => ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3']
  .map((name) => (process.env[name] ?? '').trim())
  .filter(Boolean);

/** Ключ читается только отсюда — как и токен бота. */
export const geminiKey = () => geminiKeys()[0] ?? null;

export const hasGemini = () => Boolean(geminiKey());

/**
 * Следующий ключ по кругу.
 *
 * Счётчик живёт в экземпляре функции. Идеальной равномерности он не даёт —
 * экземпляров бывает несколько, и каждый считает своё, — но чередование
 * внутри экземпляра важнее: именно там идут запросы пачкой, и именно там
 * прежняя схема упиралась в лимит одного ключа.
 */
let keyCursor = 0;
const nextKeyIndex = (count) => {
  keyCursor = (keyCursor + 1) % Math.max(count, 1);
  return keyCursor;
};

/**
 * Исчерпана ли квота.
 *
 * Отличается от прочих отказов принципиально: это не про конкретный
 * запрос, а про то, что работать сейчас нечем вообще. Такую ошибку
 * нельзя записывать в неудачи фильма — он ни при чём, и три исчерпания
 * квоты подряд иначе вычеркнули бы его из разметки навсегда.
 */
export const isQuotaError = (error) => error?.code === 'quota'
  || /quota|rate limit|resource_exhausted/i.test(String(error?.message ?? ''));

/**
 * Имя модели вынесено в переменную окружения намеренно.
 *
 * Линейка Gemini обновляется чаще, чем этот код: зашитое имя означало бы
 * перекат ради строки. Значение по умолчанию — то, что заведомо доступно;
 * актуальное имя проверяется через `listModels`, а не угадывается.
 */
export const geminiModel = () => (process.env.GEMINI_MODEL ?? '').trim() || 'gemini-3.5-flash';

/**
 * Модель для коротких задач: объяснение в одну фразу.
 *
 * Разные задачи заслуживают разных моделей. Разбор запроса случается
 * раз за вечер и стоит того, чтобы над ним подумали; объяснение —
 * нажатие кнопки, и ждать его семь секунд человек не станет.
 *
 * Значение по умолчанию выбрано замером, а не по названию: на одной
 * и той же задаче `3.5-flash-lite` уложилась в 1,1 секунды и ноль
 * токенов размышлений против 7,6 секунды и почти пяти сотен у
 * `3.5-flash`. Разница идёт от объёма рассуждений, и из номера версии
 * она не выводится — `3.6-flash` посередине, а `3.1-flash-lite`
 * медленнее более новой лайт-версии втрое.
 */
export const geminiFastModel = () => (process.env.GEMINI_MODEL_FAST ?? '').trim()
  || 'gemini-3.5-flash-lite';

export class GeminiError extends Error {
  constructor(code, message, { status = 502, detail = null } = {}) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Какие модели доступны этому ключу.
 *
 * Нужна ровно для того, чтобы не гадать об именах: список приходит от
 * Google, а не из чьей-то памяти.
 */
export async function listModels() {
  const key = geminiKey();
  if (!key) throw new GeminiError('no_key', 'GEMINI_API_KEY не задан', { status: 503 });

  const res = await fetch(`${API}/models?key=${encodeURIComponent(key)}&pageSize=100`);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new GeminiError('list_failed',
      data?.error?.message ?? `Google ответил ${res.status}`, { status: res.status });
  }

  return (data?.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => ({
      name: String(m.name ?? '').replace(/^models\//, ''),
      title: m.displayName ?? null,
      inputTokens: m.inputTokenLimit ?? null,
      outputTokens: m.outputTokenLimit ?? null,
    }));
}

/**
 * Запрос со структурированным ответом.
 *
 * @param {object}  options
 * @param {string}  options.system      системная инструкция
 * @param {string}  options.prompt      запрос
 * @param {object}  options.schema      схема ответа (OpenAPI-подмножество)
 * @param {number}  options.maxTokens   потолок, включающий рассуждения модели
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{data: object, model: string, usage: object}>}
 */
export async function generateStructured({
  system,
  prompt,
  schema,
  maxTokens = 8192,
  temperature = 0.2,
  signal,
  /** Имя модели. Без него берётся то, что задано в окружении. */
  model: requestedModel = null,
  /**
   * Глубина рассуждений, если модель их поддерживает.
   *
   * У думающих моделей это главный рычаг времени ответа: на объяснение
   * в одну фразу шестьсот токенов размышлений — трата, которую человек
   * ждёт кнопкой. Поле опциональное: модели, которая его не знает,
   * оно не отправляется вовсе.
   */
  thinking = null,
} = {}) {
  const keys = geminiKeys();
  if (!keys.length) throw new GeminiError('no_key', 'GEMINI_API_KEY не задан', { status: 503 });

  const model = requestedModel ?? geminiModel();

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
      responseSchema: schema,
      ...(thinking ? { thinkingConfig: thinking } : {}),
    },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  };

  let res;
  let data;

  /*
   * Ключи чередуются с самого начала, а не только после отказа.
   *
   * Лимиты Google считаются на проект: два ключа из разных проектов
   * дают вдвое больший темп, но только если нагрузку делить сразу.
   * Прежняя схема «жмём первый, пока не умрёт» оставляла второй
   * простаивать и упиралась в тот же потолок, что и один ключ.
   */
  const start = nextKeyIndex(keys.length);

  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[(start + i) % keys.length];
    try {
      res = await fetch(`${API}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new GeminiError('aborted', 'Запрос к модели прерван', { status: 499 });
      }
      throw new GeminiError('network', `Не удалось связаться с моделью: ${error?.message}`, { status: 502 });
    }

    data = await res.json().catch(() => null);

    const quota = res.status === 429
      || /quota|resource_exhausted/i.test(String(data?.error?.message ?? ''));

    if (!quota) break;

    if (i === keys.length - 1) {
      throw new GeminiError('quota',
        `Квота исчерпана на всех ключах (${keys.length}). `
        + 'Подождите сброса лимита или добавьте GEMINI_API_KEY_2 из другого проекта Google.',
        { status: 429, detail: data?.error?.message ?? null });
    }
  }

  if (!res.ok) {
    const message = data?.error?.message ?? `Google ответил ${res.status}`;
    /*
     * Неизвестное имя модели — самая вероятная ошибка настройки, и по
     * умолчанию она выглядит как «модель недоступна». Говорим прямо,
     * что проверять, иначе искать будут в коде.
     */
    const unknownModel = res.status === 404 || /not found|not supported/i.test(message);
    throw new GeminiError(
      unknownModel ? 'unknown_model' : 'upstream',
      unknownModel
        ? `Модель «${model}» недоступна этому ключу. Проверьте GEMINI_MODEL — список доступных отдаёт GET /api/ai/models.`
        : message,
      { status: res.status, detail: message },
    );
  }

  const candidate = data?.candidates?.[0];
  const blocked = data?.promptFeedback?.blockReason;

  if (blocked) {
    throw new GeminiError('blocked', `Модель отказалась отвечать: ${blocked}`, { status: 422 });
  }

  if (!candidate) {
    throw new GeminiError('empty', 'Модель вернула пустой ответ', { status: 502 });
  }

  /*
   * Главная проверка. MAX_TOKENS означает, что ответ оборван — вместе
   * с рассуждениями, которые у думающих моделей тратят тот же бюджет.
   * Разбирать такое нельзя: получится подборка не по запросу.
   */
  if (candidate.finishReason === 'MAX_TOKENS') {
    throw new GeminiError('truncated',
      'Модель не успела договорить в отведённый лимит. Результат был бы неполным, '
      + 'поэтому подборку не собираем.',
      { status: 502, detail: JSON.stringify(data?.usageMetadata ?? {}) });
  }

  if (candidate.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) {
    throw new GeminiError('stopped',
      `Модель остановилась досрочно: ${candidate.finishReason}`, { status: 502 });
  }

  const text = (candidate.content?.parts ?? [])
    .map((part) => part.text)
    .filter(Boolean)
    .join('');

  if (!text.trim()) {
    throw new GeminiError('empty', 'Модель вернула ответ без содержимого', { status: 502 });
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // При заданной схеме это почти невозможно — но «почти» не «никогда».
    throw new GeminiError('malformed',
      'Ответ модели не разобрался как JSON', { status: 502, detail: text.slice(0, 400) });
  }

  return {
    data: parsed,
    model,
    usage: {
      promptTokens: data?.usageMetadata?.promptTokenCount ?? null,
      outputTokens: data?.usageMetadata?.candidatesTokenCount ?? null,
      /** У думающих моделей рассуждения считаются отдельно — их полезно видеть. */
      thoughtTokens: data?.usageMetadata?.thoughtsTokenCount ?? null,
      totalTokens: data?.usageMetadata?.totalTokenCount ?? null,
    },
  };
}
