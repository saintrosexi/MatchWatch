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

/** Ключ читается только отсюда — как и токен бота. */
export const geminiKey = () => (process.env.GEMINI_API_KEY ?? '').trim() || null;

export const hasGemini = () => Boolean(geminiKey());

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
 * нажатие кнопки, и ждать его двадцать шесть секунд человек не станет.
 */
export const geminiFastModel = () => (process.env.GEMINI_MODEL_FAST ?? '').trim()
  || geminiModel();

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
  const key = geminiKey();
  if (!key) throw new GeminiError('no_key', 'GEMINI_API_KEY не задан', { status: 503 });

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

  const data = await res.json().catch(() => null);

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
