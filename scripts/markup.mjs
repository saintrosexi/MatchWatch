#!/usr/bin/env node
/**
 * Разметка каталога моделью.
 *
 *   node scripts/markup.mjs --limit 300
 *   node scripts/markup.mjs --check          проверка на обогащённых
 *   node scripts/markup.mjs --limit 50 --dry  без записи в базу
 *
 * Идёт пачками и помечает взятое сразу: два запуска не возьмут одни
 * и те же фильмы и не заплатят за одну работу дважды. Прерванный запуск
 * не теряет сделанного — брони протухают сами, и следующий продолжит
 * с того места.
 *
 * Ключей может быть несколько: при упоре в лимит скрипт переключается
 * на следующий и продолжает, а не падает на середине. Лимиты Google
 * считаются на проект, так что запасной ключ имеет смысл только
 * из другого проекта.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MARKUP_SCHEMA, MARKUP_VERSION, MARKUP_VOCABULARY, normalizeMarkup } from '../shared/ai/markup.js';
import { MOOD_AXES, MOOD_LABELS } from '../shared/config/recommendation.js';
import { TAG_LABELS_RU } from '../shared/taxonomy/tagOntology.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv();

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1]?.startsWith('--') ? true : args[i + 1]) : fallback;
};
const has = (name) => args.includes(`--${name}`);

const LIMIT = Number(flag('limit', 300));
const BATCH = Number(flag('batch', 25));
const CONCURRENCY = Number(flag('concurrency', 4));
const DRY = has('dry');
const CHECK = has('check');

const SYSTEM = `Ты размечаешь фильм по заданному словарю тем и по пяти осям настроения.

САМОЕ ВАЖНОЕ: исходи ТОЛЬКО из описания и ключевых слов, которые тебе дали. Не вспоминай фильм по названию. Если описание скудное — ставь confidence: "low" и разметь осторожно, а не додумывай сюжет. Уверенная разметка фильма, которого ты не знаешь, — худшая ошибка здесь: проверить её будет нечем.

Правила:
1. Теги — ТОЛЬКО из словаря, дословно. Вес 0..100: 100 — это про фильм целиком, 30 — присутствует, но не главное.
2. От 5 до 12 тегов. Один-два тега бесполезны, тридцать — шум.
3. Оси настроения указывай все пять, каждую 0..100, где 50 — нейтрально. Именно они отличают медленный политический эпос от яркого блокбастера, поэтому не жмись к середине: если фильм мрачный, ставь мрак 80, а не 60.
4. Жанр — не разметка. «Фантастика» ничего не говорит о том, каково это смотреть. Ищи то, чем этот фильм отличается от соседей по жанру.`;

async function main() {
  const keys = collectKeys();
  if (!keys.length) {
    fail('Не задан GEMINI_API_KEY. Добавьте его в .env или окружение.');
  }
  console.log(`Ключей доступно: ${keys.length}`);
  console.log(`Модель: ${model()}`);
  console.log(`Поколение словаря: ${MARKUP_VERSION}, тегов в словаре: ${MARKUP_VOCABULARY.length}`);
  if (DRY) console.log('Пробный прогон: в базу ничего не пишется.\n');

  if (CHECK) return runCheck(keys);

  let done = 0;
  let failed = 0;
  let processed = 0;

  while (processed < LIMIT) {
    const size = Math.min(BATCH, LIMIT - processed);
    const films = await rpc('claim_markup_batch', {
      p_limit: size,
      p_version: MARKUP_VERSION,
    });

    if (!films?.length) {
      console.log('\nНеразмеченного больше нет.');
      break;
    }

    const results = await mapWithConcurrency(films, CONCURRENCY, async (film) => {
      const title = film.data;
      try {
        const markup = await markupOne(title, keys);
        if (!markup) throw new Error('модель вернула неполную разметку');

        if (!DRY) {
          await rpc('save_markup', {
            p_id: film.id,
            p_markup: { ...markup, model: model() },
            p_model: model(),
            p_version: MARKUP_VERSION,
          });
        }
        return { ok: true, title: title.title, markup };
      } catch (error) {
        if (!DRY) {
          await rpc('fail_markup', { p_id: film.id, p_reason: String(error?.message).slice(0, 300) });
        }
        return { ok: false, title: title.title, error: error?.message };
      }
    });

    for (const r of results) {
      processed += 1;
      if (r.ok) {
        done += 1;
        const top = Object.entries(r.markup.tags).slice(0, 4)
          .map(([t]) => TAG_LABELS_RU[t] ?? t).join(', ');
        const m = r.markup.moods;
        console.log(`  ✓ ${String(r.title).slice(0, 34).padEnd(36)}${top}`
          + `  [мрак ${m.darkness}, динамика ${m.dynamism}]`
          + (r.markup.confidence === 'low' ? '  (описание скудное)' : ''));
        if (r.markup.dropped.length) {
          console.log(`      словаря не хватило: ${r.markup.dropped.join(', ')}`);
        }
      } else {
        failed += 1;
        console.log(`  ✗ ${String(r.title).slice(0, 34).padEnd(36)}${r.error}`);
      }
    }
    console.log(`— обработано ${processed}, успешно ${done}, неудач ${failed}`);
  }

  console.log(`\nИтог: ${done} размечено, ${failed} неудач.`);
}

/**
 * Проверка на тех, у кого есть настоящие ключевые слова TMDB.
 *
 * Единственный способ узнать, выдумывает ли модель, — сравнить её вывод
 * с фактами там, где факты есть. Обогащённых карточек немного, но это
 * ровно те, где известна правда, а не наше предположение.
 *
 * Ничего не пишет и брони не ставит: это измерение, а не работа.
 */
async function runCheck(keys) {
  const films = await select('catalog_titles', {
    select: 'id,data',
    enriched: 'is.true',
    limit: String(Math.min(LIMIT, 40)),
  });

  if (!films?.length) {
    console.log('Обогащённых карточек нет — сравнивать не с чем.');
    return;
  }

  console.log(`Проверка на ${films.length} карточках с настоящими ключевыми словами TMDB.\n`);

  let overlapSum = 0;
  let counted = 0;
  let lowConfidence = 0;

  const results = await mapWithConcurrency(films, CONCURRENCY, async ({ data }) => {
    try {
      const markup = await markupOne(data, keys);
      if (!markup) return { title: data.title, error: 'неполная разметка' };
      return { title: data.title, markup, original: Object.keys(data.tags ?? {}) };
    } catch (error) {
      return { title: data.title, error: error?.message };
    }
  });

  for (const r of results) {
    if (r.error) { console.log(`  ✗ ${String(r.title).slice(0, 30).padEnd(32)}${r.error}`); continue; }

    const mine = new Set(Object.keys(r.markup.tags));
    /*
     * Сравниваем только по тегам, которые вообще есть в словаре.
     * У TMDB своих слов вроде `dublin-ireland` наш словарь не знает,
     * и ставить их модели в упрёк было бы нечестно: выбрать их она
     * не могла при всём желании.
     */
    const comparable = r.original.filter((t) => MARKUP_VOCABULARY.includes(t));
    if (comparable.length) {
      const hit = comparable.filter((t) => mine.has(t)).length;
      overlapSum += hit / comparable.length;
      counted += 1;
    }
    if (r.markup.confidence === 'low') lowConfidence += 1;

    const missed = comparable.filter((t) => !mine.has(t));
    console.log(`  ${String(r.title).slice(0, 30).padEnd(32)}`
      + `тегов ${String(Object.keys(r.markup.tags).length).padEnd(4)}`
      + (comparable.length ? `совпало ${comparable.filter((t) => mine.has(t)).length}/${comparable.length}` : 'сравнивать не с чем')
      + (missed.length ? `  пропустила: ${missed.join(', ')}` : ''));
  }

  console.log('\n─────────────────────────────────────────');
  if (counted) {
    console.log(`Совпадение с TMDB: ${Math.round((overlapSum / counted) * 100)}% в среднем по ${counted} фильмам.`);
    console.log('Это не оценка «правильности»: у TMDB свои теги, и не всё, что');
    console.log('нашла модель сверх них, — выдумка. Но резкое падение здесь');
    console.log('означает, что она разошлась с фактами, и это повод править подсказку.');
  }
  console.log(`Скудных описаний (confidence: low): ${lowConfidence} из ${results.length}.`);
}

async function markupOne(title, keys) {
  const keywords = Object.keys(title.tags ?? {});
  const prompt = [
    `Фильм: ${title.title}${title.year ? ` (${title.year})` : ''}`,
    title.originalTitle && title.originalTitle !== title.title
      ? `Оригинальное название: ${title.originalTitle}` : null,
    title.runtime ? `Длительность: ${title.runtime} мин` : null,
    keywords.length ? `Что уже известно из TMDB: ${keywords.join(', ')}` : null,
    '',
    'Описание:',
    title.overview,
    '',
    'Оси настроения:',
    ...MOOD_AXES.map((a) => `  ${a} (${MOOD_LABELS[a]})`),
    '',
    'Словарь тем (только отсюда, дословно):',
    MARKUP_VOCABULARY.map((t) => `${t} — ${TAG_LABELS_RU[t]}`).join('\n'),
  ].filter((line) => line !== null).join('\n');

  const raw = await callModel({ system: SYSTEM, prompt, schema: MARKUP_SCHEMA }, keys);
  return normalizeMarkup(raw);
}

/* ── Обращение к модели с переключением ключей ─────────────────── */

const model = () => (process.env.GEMINI_MODEL_MARKUP ?? process.env.GEMINI_MODEL_FAST ?? '').trim()
  || 'gemini-3.5-flash-lite';

function collectKeys() {
  return ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3']
    .map((name) => (process.env[name] ?? '').trim())
    .filter(Boolean);
}

let keyIndex = 0;

async function callModel({ system, prompt, schema }, keys) {
  let lastError = null;

  // По кругу через все ключи: упор в лимит одного — не повод останавливать
  // весь прогон, если есть второй.
  for (let attempt = 0; attempt < keys.length * 2; attempt += 1) {
    const key = keys[keyIndex % keys.length];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model()}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: system }] },
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
            responseSchema: schema,
          },
        }),
      },
    ).catch((error) => ({ ok: false, status: 0, _network: error?.message }));

    if (res.ok) {
      const data = await res.json();
      const candidate = data?.candidates?.[0];
      if (candidate?.finishReason === 'MAX_TOKENS') {
        throw new Error('ответ оборван по лимиту токенов');
      }
      const text = (candidate?.content?.parts ?? []).map((p) => p.text).filter(Boolean).join('');
      if (!text.trim()) throw new Error('пустой ответ модели');
      return JSON.parse(text);
    }

    const body = res.json ? await res.json().catch(() => null) : null;
    const message = body?.error?.message ?? res._network ?? `HTTP ${res.status}`;
    lastError = message;

    // 429 — лимит, 503 — перегрузка. И то и другое лечится другим ключом
    // или паузой, а не отказом от фильма.
    if (res.status === 429 || res.status === 503) {
      keyIndex += 1;
      const pause = 2000 * (1 + Math.floor(attempt / Math.max(keys.length, 1)));
      console.log(`    лимит (${res.status}), ключ ${keyIndex % keys.length + 1}, пауза ${pause}мс`);
      await sleep(pause);
      continue;
    }

    throw new Error(message);
  }

  throw new Error(`лимиты исчерпаны на всех ключах: ${lastError}`);
}

/* ── База ───────────────────────────────────────────────────────── */

async function select(table, params) {
  const { url, key } = supabase();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${url}/rest/v1/${table}?${qs}`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!res.ok) fail(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

function supabase() {
  const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail('Нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
  return { url, key };
}

async function rpc(fn, params) {
  const { url, key } = supabase();

  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) fail(`${fn}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ── Мелочи ─────────────────────────────────────────────────────── */

function loadEnv() {
  for (const name of ['.env', '.env.local']) {
    const file = resolve(root, name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mapWithConcurrency(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next; next += 1;
      out[i] = await worker(items[i]);
    }
  }));
  return out;
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

main().catch((error) => fail(error?.stack ?? error?.message));
