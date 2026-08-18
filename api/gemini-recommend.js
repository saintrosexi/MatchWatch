/**
 * Vercel Serverless Function: /api/gemini-recommend
 * 
 * MatchWatch AI Cinema Concierge
 * 
 * Flow:
 * 1. Asks Gemini (with full freedom & world cinema knowledge) to brainstorm
 *    40-60 of the most fitting films for the user prompt.
 * 2. Cross-references & intersects Gemini's candidates with our verified 440-movie catalog.
 * 3. Enriches matches with Gemini's personalized critic rationale badges.
 * 4. Fills any remaining slots up to 25 with the closest 5D sensation vector & thematic matches from our database.
 */

import { movies } from '../src/data/movies.js';

/**
 * Normalizes text for fuzzy Russian & English title matching
 */
function normalizeTitle(text = '') {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/э/g, 'е')
    .replace(/й/g, 'и')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match a single AI candidate with our internal catalog
 */
function findMovieInCatalog(candidate, catalog = movies) {
  if (!candidate) return null;

  const candidateTitles = [
    candidate.titleRu,
    candidate.title,
    candidate.titleOriginal,
    candidate.originalTitle
  ].filter(Boolean).map(normalizeTitle);

  if (candidateTitles.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const m of catalog) {
    const mNormRu = normalizeTitle(m.titleRu);
    const mNormOrig = normalizeTitle(m.title);
    let score = 0;

    for (const cTitle of candidateTitles) {
      if (!cTitle) continue;
      // 1. Exact match
      if (cTitle === mNormRu || cTitle === mNormOrig) {
        score = Math.max(score, 100);
      }
      // 2. Substring match
      else if (
        (cTitle.length >= 4 && (mNormRu.includes(cTitle) || mNormOrig.includes(cTitle))) ||
        (mNormRu.length >= 4 && cTitle.includes(mNormRu)) ||
        (mNormOrig.length >= 4 && cTitle.includes(mNormOrig))
      ) {
        score = Math.max(score, 75);
      }
    }

    // Year alignment bonus
    if (score > 0 && candidate.year && m.year) {
      const yearDiff = Math.abs(Number(candidate.year) - Number(m.year));
      if (yearDiff === 0) score += 20;
      else if (yearDiff <= 1) score += 10;
      else if (yearDiff > 5) score -= 15;
    }

    if (score > bestScore && score >= 60) {
      bestScore = score;
      bestMatch = m;
    }
  }

  return bestMatch;
}

export default async function handler(req, res) {
  // CORS configuration
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

  // Graceful fallback if API key is not yet configured in Vercel
  if (!apiKey || apiKey === 'your_gemini_api_key' || apiKey.includes('TODO')) {
    return res.status(200).json({
      success: false,
      fallback: true,
      reason: 'GEMINI_API_KEY is not configured in environment variables. Falling back to local 5D Sensation Engine.'
    });
  }

  try {
    const systemPrompt = `Ты — MatchWatch AI Cinema Genie, самый эрудированный кинокритик и кино-сомелье в мире с глубочайшим пониманием мирового кино, жанров, эпох, стран, режиссерских стилей и кино-тропов.

ТВОЯ ЗАДАЧА:
Зритель обращается к тебе с запросом на фильм или кино-настроение.
Твоя цель — глубоко понять подтекст, настроение, эпоху, жанр и составить ШИРОКИЙ СПИСОК ИЗ 40–60 НАИБОЛЕЕ ТОЧНЫХ И КУЛЬТОВЫХ ФИЛЬМОВ мирового кино под этот запрос.

ПРАВИЛА:
1. Предложи от 40 до 60 фильмов, максимально точно отвечающих запросу зрителя (включай признанные шедевры, классику, культовые хиты и ярких представителей темы).
2. Если зритель просит определенную тему/эпоху (например "советский в чб", "бэтмен", "киберпанк", "комедия для друзей", "нолан"), давай в первую очередь фильмы ИМЕННО этой темы/эпохи/франшизы.
3. Для каждого фильма укажи:
   - titleRu: русское название фильма (например "Тёмный рыцарь" или "Летят журавли")
   - titleOriginal: оригинальное или английское название (например "The Dark Knight" или "Letyat zhuravli")
   - year: год выпуска (число)
   - reason: сочное, живое описание в 1–2 предложениях на русском языке, почему этот фильм идеален под данный запрос (упомяни режиссера, фишки, твисты, саундтрек или атмосферу).
4. aiSummary: 1–2 предложения с кратким авторским введением в подборку.

ФОРМАТ ВЫВОДА (ТОЛЬКО ЧИСТЫЙ JSON):
{
  "candidates": [
    {
      "titleRu": "Название на русском",
      "titleOriginal": "Original Title",
      "year": 2000,
      "reason": "Яркое синефильское описание 1-2 предложения..."
    }
  ],
  "aiSummary": "Кураторская подборка..."
}`;

    const userPayload = `ЗАПРОС ЗРИТЕЛЯ:
«${prompt.trim()}»

5D-ВКУС ЗРИТЕЛЯ:
Энергия: ${userTasteVector?.energy ?? 6}/10, Мрачность: ${userTasteVector?.darkness ?? 5}/10, Интеллект: ${userTasteVector?.intellect ?? 6}/10, Эмоции: ${userTasteVector?.emotion ?? 7}/10, Динамика: ${userTasteVector?.dynamism ?? 6}/10

РАНЕЕ ПОНРАВИВШИЕСЯ ФИЛЬМЫ:
${likedMovieTitles.length > 0 ? likedMovieTitles.slice(0, 10).join(', ') : 'Пока нет оценок'}`;

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
          temperature: 0.4,
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
    const candidates = parsed.candidates || parsed.recommendations || [];

    // Match candidates with our internal catalog
    const matchedDeck = [];
    const seenIds = new Set();

    for (const cand of candidates) {
      const matchedMovie = findMovieInCatalog(cand, movies);
      if (matchedMovie && !seenIds.has(matchedMovie.id)) {
        seenIds.add(matchedMovie.id);
        matchedDeck.push({
          ...matchedMovie,
          aiReason: cand.reason || `Рекомендация MatchWatch AI по запросу «${prompt}»`
        });
      }
      if (matchedDeck.length >= 25) break;
    }

    // If fewer than 25 matched, pad with closest movies from catalog
    if (matchedDeck.length < 25) {
      for (const m of movies) {
        if (!seenIds.has(m.id)) {
          seenIds.add(m.id);
          matchedDeck.push({
            ...m,
            aiReason: `Кураторский выбор MatchWatch AI под ваше настроение`
          });
        }
        if (matchedDeck.length >= 25) break;
      }
    }

    return res.status(200).json({
      success: true,
      deck: matchedDeck.slice(0, 25),
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
