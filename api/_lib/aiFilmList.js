/**
 * POST /api/ai/filmlist — черновик списка фильмов для новой подборки.
 *
 * Нужно для категорий, которые каталог сам собрать не может. Русское
 * кино тому пример: на TMDB оно есть, но ранжирование там международное,
 * и по числу голосов наверх выходят Тарковский с Эйзенштейном, а
 * «Бриллиантовая рука» с её тремя сотнями голосов не выходит никогда.
 * Между тем вечером люди включают именно её.
 *
 * Модель здесь называет НАЗВАНИЯ И ГОДЫ, и только их. Ни описаний,
 * ни оценок, ни жанров: всё это есть в TMDB и берётся оттуда. Год
 * обязателен — по нему список сверяется с каталогом, и без него
 * поиск подсовывает ремейки вместо оригиналов.
 *
 * Результат — черновик, а не решение. Его смотрит человек.
 */

import { withHandler, ApiError, requireSecret } from './http.js';
import { generateStructured, GeminiError, hasGemini } from './gemini.js';
import { MODULE } from '../../shared/telemetry/events.js';

const SCHEMA = {
  type: 'object',
  properties: {
    films: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Название на русском, как его знают зрители.' },
          year: { type: 'integer', description: 'Точный год выхода. Обязателен.' },
          note: { type: 'string', description: 'Два-три слова: чем известен.' },
        },
        required: ['title', 'year', 'note'],
      },
    },
  },
  required: ['films'],
};

const SYSTEM = `Ты составляешь список фильмов для кинопоискового приложения.

Правила:
1. Только полнометражные игровые фильмы. Без сериалов, мультсериалов и короткого метра.
2. Год обязателен и точен. По нему список сверяется с каталогом, и ошибка в годе подсунет ремейк вместо оригинала.
3. Названия давай так, как их знают зрители, — без пояснений в скобках.
4. Не повторяйся. Разные части франшизы считаются разными фильмами, но не выдавай их подряд пачкой.
5. Если не уверен в годе — лучше не включай фильм вовсе, чем включить с неверным.`;

export const filmListHandler = withHandler(
  { methods: ['POST', 'GET'], module: MODULE.CATALOG },
  async ({ req, query, body }) => {
    // Обращение к модели стоит денег — закрыто служебным секретом.
    requireSecret(req, query, 'CRON_SECRET');

    if (!hasGemini()) throw new ApiError(503, 'ai_not_configured', 'Не задан GEMINI_API_KEY');

    const brief = String(body?.brief ?? query.get('brief') ?? '').trim();
    if (!brief) {
      throw new ApiError(400, 'no_brief',
        'Опишите, какой список нужен: состав, эпохи, чего поровну.');
    }

    const count = Math.min(Math.max(Number(body?.count ?? query.get('count')) || 100, 10), 150);

    let result;
    try {
      result = await generateStructured({
        system: SYSTEM,
        prompt: `Составь список из ${count} фильмов.\n\n${brief}`,
        schema: SCHEMA,
        /*
         * Сто с лишним названий с годами — это много строк. Потолок
         * взят с большим запасом: оборванный список молча потерял бы
         * хвост, и заметить это было бы нечем.
         */
        maxTokens: 16384,
        temperature: 0.4,
      });
    } catch (error) {
      throw new ApiError(
        error instanceof GeminiError ? (error.status ?? 502) : 502,
        'ai_failed',
        error?.message ?? 'Не удалось составить список',
      );
    }

    const seen = new Set();
    const films = (result.data?.films ?? [])
      .map((f) => ({
        title: String(f?.title ?? '').trim(),
        year: Number(f?.year),
        note: String(f?.note ?? '').trim().slice(0, 60),
      }))
      .filter((f) => {
        if (!f.title || !Number.isInteger(f.year) || f.year < 1900 || f.year > 2100) return false;
        // Повторы модель выдаёт регулярно; пропустить их дальше значит
        // потом искать один и тот же фильм в каталоге дважды.
        const key = `${f.title.toLowerCase()}|${f.year}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return {
      asked: count,
      films,
      model: result.model,
      usage: result.usage,
    };
  },
);
