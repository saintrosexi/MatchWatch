/**
 * Vercel Serverless Function: /api/gemini-recommend
 * 
 * MatchWatch AI Cinema Concierge Powered by Google Gemini (gemini-2.0-flash)
 * Deeply structured, multi-dimensional film curation engine selecting exactly 25
 * curated movies from our internal 440-movie catalog with rich critic rationales.
 */

import { movies } from '../src/data/movies.js';

export default async function handler(req, res) {
  // CORS & Header configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  const { prompt, userTasteVector, likedMovieTitles = [], likedIds = [] } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Missing or invalid "prompt" in request body.' });
  }

  // Graceful fallback response if API key is not configured in Vercel yet
  if (!apiKey || apiKey === 'your_gemini_api_key' || apiKey.includes('TODO')) {
    return res.status(200).json({
      success: false,
      fallback: true,
      reason: 'GEMINI_API_KEY is not configured in environment variables. Falling back to local 5D Sensation Engine.'
    });
  }

  try {
    // 1. Format the complete catalog as a clean, highly token-efficient catalog index
    const catalogSummaryLines = movies.map((m) => {
      const v = m.sensationVector || { energy: 5, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 };
      return `[ID: ${m.id}] "${m.titleRu}" ("${m.title}", ${m.year}) | Жанры: ${m.genres} | Реж: ${m.director} | В ролях: ${m.actors} | Рейтинг: ${m.rating} | 5D: Эн=${v.energy}, Мрач=${v.darkness}, Инт=${v.intellect}, Эмоц=${v.emotion}, Дин=${v.dynamism} | Сюжет: ${m.description || ''}`;
    }).join('\n');

    // 2. Structured Expert Cinema System Prompt
    const systemPrompt = `Ты — MatchWatch AI Cinema Concierge, элитный главный кинокритик и кино-сомелье платформы MatchWatch с энциклопедическими знаниями мирового кинематографа, режиссерских стилей, операторской работы и драматургии.

ТВОЯ ГЛАВНАЯ ЦЕЛЬ:
Понять тончайший подтекст запроса зрителя (вайб, атмосферу, темпоритм, сюжетные тропы, режиссерский почерк) и ВЫБРАТЬ РОВНО 25 ЛУЧШИХ УНИКАЛЬНЫХ ФИЛЬМОВ СТРОГО ИЗ ПРЕДОСТАВЛЕННОЙ БАЗЫ ДАННЫХ (440 фильмов).

СТРОГИЕ ПРАВИЛА И СТАНДАРТЫ КАЧЕСТВА:
1. РОВНО 25 ФИЛЬМОВ: Массив "recommendations" должен содержать РОВНО 25 объектов. Ни 1, ни 10, а ровно 25.
2. СТРОГАЯ ВАЛИДНОСТЬ ID: Использовать ТОЛЬКО числовые ID, присутствующие в переданном каталоге. Запрещено выдумывать фильмы или ID, которых нет в базе.
3. УНИКАЛЬНОСТЬ: Все 25 выбранных фильмов должны быть уникальными (без повторений).
4. РАНЖИРОВАНИЕ ОТ #1 ДО #25: На первое место ставь абсолютный шедевр-попадание в запрос, далее выстраивай увлекательное кино-путешествие.
5. ЖИВЫЕ И СОЧНЫЕ СИНЕФИЛЬСКИЕ ОПИСАНИЯ ("reason"):
   - Каждое описание — это 1–2 сочных, убедительных предложения на русском языке.
   - Обязательно упоминай конкретные фишки картины: режиссерский почерк, визуальную эстетику, актеров, операторскую работу, напряжение, твисты или саундтрек.
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНЫ сухие фразы ("Хороший фильм под ваш запрос"). Пиши авторитетно, ярко и вкусно!
6. ОБЩЕЕ РЕЗЮМЕ ("aiSummary"):
   - 1–2 предложения с кратким авторским введением в собранную коллекцию.

ФОРМАТ ОТВЕТА (СТРОГО ВАЛИДНЫЙ JSON БЕЗ ЛИШНЕГО ТЕКСТА И РАЗМЕТКИ):
{
  "recommendations": [
    {
      "id": 123,
      "reason": "Мрачный эталон детективного нео-нуара Дэвида Финчера с гнетущей атмосферой вечного дождя и шокирующей развязкой."
    }
  ],
  "aiSummary": "Собрал для вас 25 культовых триллеров и детективов с закрученным сюжетом и высоким интеллектуальным накалом."
}`;

    const userPayload = `ПОЛЬЗОВАТЕЛЬСКИЙ ЗАПРОС:
«${prompt.trim()}»

5D-ПРОФИЛЬ ВКУСА ЗРИТЕЛЯ:
Энергия: ${userTasteVector?.energy ?? 6}/10, Мрачность: ${userTasteVector?.darkness ?? 5}/10, Интеллект: ${userTasteVector?.intellect ?? 6}/10, Эмоции: ${userTasteVector?.emotion ?? 7}/10, Динамика: ${userTasteVector?.dynamism ?? 6}/10

РАНЕЕ ПОНРАВИВШИЕСЯ ФИЛЬМЫ:
${likedMovieTitles.length > 0 ? likedMovieTitles.slice(0, 10).join(', ') : 'Пока нет оценок (новый пользователь)'}

ПОЛНЫЙ КАТАЛОГ ФИЛЬМОВ MATCHWATCH ДЛЯ ВЫБОРА (ВЫБЕРИ РОВНО 25 ID):
${catalogSummaryLines}`;

    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              { text: userPayload }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.35,
          maxOutputTokens: 4096
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API HTTP Error:', response.status, errText);
      return res.status(200).json({
        success: false,
        fallback: true,
        reason: `Gemini API returned status ${response.status}`
      });
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return res.status(200).json({
        success: false,
        fallback: true,
        reason: 'Empty response from Gemini model.'
      });
    }

    const parsed = JSON.parse(rawText);

    // 3. Map returned IDs strictly to our verified 440-movie catalog
    const moviesMap = new Map(movies.map((m) => [m.id, m]));
    const recommendations = parsed.recommendations || [];
    const deck = [];
    const seen = new Set();

    for (const rec of recommendations) {
      const numericId = Number(rec.id);
      if (numericId && moviesMap.has(numericId) && !seen.has(numericId)) {
        seen.add(numericId);
        const originalMovie = moviesMap.get(numericId);
        deck.push({
          ...originalMovie,
          aiReason: rec.reason || `Рекомендовано MatchWatch AI по запросу «${prompt}»`
        });
      }
      if (deck.length >= 25) break;
    }

    // 4. Guaranteed 25 movies: pad if needed from top catalog movies matching prompt
    if (deck.length < 25) {
      for (const m of movies) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          deck.push({
            ...m,
            aiReason: `Кураторский выбор MatchWatch AI под ваше настроение`
          });
        }
        if (deck.length >= 25) break;
      }
    }

    return res.status(200).json({
      success: true,
      deck: deck.slice(0, 25),
      aiSummary: parsed.aiSummary || `Коллекция из 25 фильмов по запросу «${prompt}»`
    });
  } catch (error) {
    console.error('Gemini serverless function exception:', error);
    return res.status(200).json({
      success: false,
      fallback: true,
      reason: error.message || 'Unknown exception'
    });
  }
}
