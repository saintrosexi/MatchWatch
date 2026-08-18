/**
 * Vercel Serverless Function: /api/gemini-recommend
 * 
 * Proxies user natural language prompts to Google Gemini API (gemini-2.0-flash)
 * to curate a personalized 25-movie Smart Deck with custom rationale badges.
 */

import { movies } from '../src/data/movies.js';

export default async function handler(req, res) {
  // CORS & method verification
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
    // Generate lightweight movie index for Gemini context (ID, title, year, genres, vector)
    const movieCatalogIndex = movies.map((m) => ({
      id: m.id,
      title: m.titleRu || m.title,
      year: m.year,
      genres: m.genres,
      director: m.director,
      rating: m.rating,
      vector: m.sensationVector ? `${m.sensationVector.energy}/${m.sensationVector.darkness}/${m.sensationVector.intellect}/${m.sensationVector.emotion}/${m.sensationVector.dynamism}` : ''
    }));

    const systemPrompt = `You are MatchWatch AI Concierge, the world's most sophisticated film recommendation system.
You are given a user natural-language movie request, their 5D taste vector (Energy/Darkness/Intellect/Emotion/Dynamism on 1-10 scale), their previously liked movies, and a catalog of available movies with internal IDs.

YOUR TASK:
1. Understand the user's mood, story tropes, atmosphere, and pacing from their prompt.
2. Select exactly 25 best matching movies strictly from the provided catalog index by their exact numeric ID.
3. For each selected movie, provide a personalized 1-sentence rationale in Russian ("reason") explaining why this specific film fits their request and taste.
4. Provide a brief 1-2 sentence overall summary in Russian ("aiSummary").

OUTPUT FORMAT: Strict JSON only:
{
  "recommendations": [
    {
      "id": 1,
      "reason": "Культовая классика с невероятным эмоциональным катарсисом..."
    }
  ],
  "aiSummary": "Собрал для вас подборку из 25 захватывающих фильмов..."
}`;

    const userContent = JSON.stringify({
      userPrompt: prompt.trim(),
      userTasteVector: userTasteVector || { energy: 6, darkness: 5, intellect: 6, emotion: 7, dynamism: 6 },
      likedTitles: likedMovieTitles.slice(0, 10),
      catalog: movieCatalogIndex
    });

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
              { text: `USER REQUEST AND CATALOG DATA:\n${userContent}` }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 2048
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

    // Build the 25-movie deck with attached AI reasons
    const moviesMap = new Map(movies.map((m) => [m.id, m]));
    const recommendations = parsed.recommendations || [];
    const deck = [];
    const seen = new Set();

    for (const rec of recommendations) {
      if (rec.id && moviesMap.has(rec.id) && !seen.has(rec.id)) {
        seen.add(rec.id);
        const originalMovie = moviesMap.get(rec.id);
        deck.push({
          ...originalMovie,
          aiReason: rec.reason || 'Рекомендовано MatchWatch AI под ваш запрос'
        });
      }
      if (deck.length >= 25) break;
    }

    // If less than 25, pad with top rated movies from catalog
    if (deck.length < 25) {
      for (const m of movies) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          deck.push({
            ...m,
            aiReason: 'Рекомендация алгоритма MatchWatch'
          });
        }
        if (deck.length >= 25) break;
      }
    }

    return res.status(200).json({
      success: true,
      deck,
      aiSummary: parsed.aiSummary || `Подборка из 25 фильмов по запросу «${prompt}»`
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
