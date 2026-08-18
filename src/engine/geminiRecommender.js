// MatchWatch — Gemini AI Cinema Concierge & Multi-Tier Recommender Engine
import { movies } from '../data/movies.js';
import { calculateVectorDistance, calculateUserTasteVector } from './recommendationEngine.js';

/**
 * Heuristic semantic fallback keyword map to 5D vector biases & genre matching
 */
const KEYWORD_VIBE_MAP = {
  // Atmospheric / Moody
  'мрачн': { darkness: 9, energy: 5, intellect: 7, genres: ['триллер', 'криминал', 'детектив', 'драма'] },
  'нуар': { darkness: 10, intellect: 8, energy: 4, genres: ['криминал', 'детектив', 'триллер'] },
  'киберпанк': { darkness: 8, energy: 8, intellect: 8, dynamism: 8, genres: ['фантастика', 'боевик', 'триллер'] },
  'неон': { darkness: 7, energy: 8, dynamism: 8, genres: ['фантастика', 'триллер'] },
  
  // Thought-provoking / Brain
  'твист': { intellect: 9, darkness: 7, genres: ['триллер', 'детектив', 'драма'] },
  'мозг': { intellect: 10, darkness: 6, genres: ['фантастика', 'триллер', 'драма'] },
  'запутан': { intellect: 9, darkness: 6, genres: ['детектив', 'триллер'] },
  'смысл': { intellect: 9, emotion: 8, genres: ['драма', 'фантастика'] },
  'нолан': { intellect: 9, dynamism: 8, genres: ['фантастика', 'боевик', 'триллер'] },
  
  // High Energy / Action
  'адреналин': { energy: 10, dynamism: 10, darkness: 5, genres: ['боевик', 'триллер', 'приключения'] },
  'драйв': { energy: 9, dynamism: 9, genres: ['боевик', 'криминал', 'триллер'] },
  'экшн': { energy: 9, dynamism: 9, genres: ['боевик', 'приключения'] },
  'погоня': { dynamism: 10, energy: 9, genres: ['боевик', 'криминал'] },
  
  // Chill / Fun / Comedy
  'смешн': { energy: 7, emotion: 9, darkness: 2, genres: ['комедия'] },
  'комед': { energy: 7, emotion: 8, darkness: 2, genres: ['комедия'] },
  'пицц': { energy: 6, emotion: 8, darkness: 3, genres: ['комедия', 'приключения', 'боевик'] },
  'друг': { emotion: 8, energy: 7, darkness: 3, genres: ['комедия', 'приключения'] },
  'легк': { darkness: 2, emotion: 8, energy: 6, genres: ['комедия', 'мелодрама'] },
  
  // Deep Emotion / Romance
  'слез': { emotion: 10, darkness: 6, energy: 4, genres: ['драма', 'мелодрама'] },
  'любов': { emotion: 10, darkness: 3, energy: 5, genres: ['мелодрама', 'драма'] },
  'романт': { emotion: 9, darkness: 3, energy: 5, genres: ['мелодрама', 'комедия'] },
  'душевн': { emotion: 9, darkness: 3, intellect: 6, genres: ['драма', 'комедия'] },
  
  // Sci-Fi & Cosmic
  'космос': { intellect: 8, emotion: 7, dynamism: 7, genres: ['фантастика', 'приключения'] },
  'будущ': { intellect: 8, energy: 7, genres: ['фантастика'] },
  'научн': { intellect: 9, genres: ['фантастика', 'документальный'] }
};

/**
 * Local Semantic & 5D Vector Fallback Engine (Zero Downtime)
 */
export function getSemanticAndVectorDeck(prompt = '', userTasteVector = null, limit = 25) {
  const q = prompt.toLowerCase().trim();
  const vector = userTasteVector || { energy: 6, darkness: 5, intellect: 6, emotion: 7, dynamism: 6 };

  // Calculate matching keyword profiles
  const matchingVibes = [];
  for (const [key, vibe] of Object.entries(KEYWORD_VIBE_MAP)) {
    if (q.includes(key)) {
      matchingVibes.push(vibe);
    }
  }

  // Composite target vector based on user query + user taste
  let targetVector = { ...vector };
  let targetGenres = new Set();

  if (matchingVibes.length > 0) {
    let energySum = 0, darknessSum = 0, intellectSum = 0, emotionSum = 0, dynamismSum = 0;
    matchingVibes.forEach((v) => {
      energySum += v.energy ?? vector.energy;
      darknessSum += v.darkness ?? vector.darkness;
      intellectSum += v.intellect ?? vector.intellect;
      emotionSum += v.emotion ?? vector.emotion;
      dynamismSum += v.dynamism ?? vector.dynamism;
      if (v.genres) v.genres.forEach((g) => targetGenres.add(g));
    });

    const count = matchingVibes.length;
    targetVector = {
      energy: Math.round((energySum / count + vector.energy) / 2),
      darkness: Math.round((darknessSum / count + vector.darkness) / 2),
      intellect: Math.round((intellectSum / count + vector.intellect) / 2),
      emotion: Math.round((emotionSum / count + vector.emotion) / 2),
      dynamism: Math.round((dynamismSum / count + vector.dynamism) / 2)
    };
  }

  // Score movies based on query text match, genre affinity, and 5D vector proximity
  const scored = movies.map((m) => {
    let score = (m.rating || 7.0) * 0.4;
    const mTitle = (m.titleRu || m.title || '').toLowerCase();
    const mDirector = (m.director || '').toLowerCase();
    const mActors = (m.actors || '').toLowerCase();
    const mGenres = (m.genres || '').toLowerCase();
    const mDesc = (m.description || '').toLowerCase();

    // Direct text hit bonus
    if (q && (mTitle.includes(q) || mDirector.includes(q) || mActors.includes(q))) {
      score += 5.0;
    }
    if (q && mDesc.includes(q)) {
      score += 2.0;
    }

    // Genre affinity bonus
    if (targetGenres.size > 0) {
      let genreHits = 0;
      targetGenres.forEach((g) => {
        if (mGenres.includes(g)) genreHits++;
      });
      score += genreHits * 1.5;
    }

    // 5D Vector proximity
    const dist = calculateVectorDistance(m.sensationVector, targetVector);
    score -= dist * 0.25;

    // Small random noise to keep varied
    score += Math.random() * 0.3;

    // Generate personalized AI reason badge
    let reason = '';
    if (q.includes('твист') || q.includes('мозг')) {
      reason = `🧠 Высокий интеллект (${m.sensationVector?.intellect || 8}/10) и непредсказуемый сюжет`;
    } else if (q.includes('мрачн') || q.includes('нуар')) {
      reason = `⚡ Глубокая нуарная атмосфера (${m.sensationVector?.darkness || 8}/10) и высокое напряжение`;
    } else if (q.includes('комед') || q.includes('смешн') || q.includes('пицц')) {
      reason = `🍕 Идеально для отдыха и отличного настроения (Рейтинг ★${m.rating || 8.0})`;
    } else if (q.includes('космос')) {
      reason = `🌌 Масштабная космическая одиссея и глубокая визуальная эстетика`;
    } else if (q.includes('адреналин') || q.includes('экшн') || q.includes('драйв')) {
      reason = `🔥 Максимальный динамизм (${m.sensationVector?.dynamism || 8}/10) и мощный драйв`;
    } else {
      const matchPct = Math.min(99, Math.max(88, Math.round(100 - dist * 4)));
      reason = `✨ Совпадение ${matchPct}% с вашим запросом и 5D-вкусом`;
    }

    return {
      movie: {
        ...m,
        aiReason: reason
      },
      score
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.movie);
}

/**
 * Main Gemini AI Concierge Recommender with Multi-Tier Fallback
 */
export async function generateGeminiRecommendations({
  prompt,
  userTasteVector = null,
  likedIds = [],
  catalog = movies
}) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return {
      success: false,
      deck: [],
      error: 'Prompt is required'
    };
  }

  const cleanPrompt = prompt.trim();

  // Extract liked titles for context
  const likedTitles = movies
    .filter((m) => likedIds.includes(m.id))
    .map((m) => m.titleRu || m.title)
    .slice(0, 10);

  // 1. Try Vercel Serverless Function Proxy (/api/gemini-recommend)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const response = await fetch('/api/gemini-recommend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: cleanPrompt,
        userTasteVector,
        likedMovieTitles: likedTitles,
        likedIds
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.success && Array.isArray(data.deck) && data.deck.length > 0) {
        return {
          success: true,
          deck: data.deck,
          aiSummary: data.aiSummary || `Подборка от MatchWatch AI по запросу «${cleanPrompt}»`,
          isAi: true,
          source: 'gemini_api_serverless'
        };
      }
    }
  } catch (err) {
    // Network or timeout in browser/offline - gracefully fall through to Tier 2
  }

  // 2. Try Client-Side Direct Key (if configured in Vite .env during dev)
  try {
    const clientKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY;
    if (clientKey && clientKey !== 'your_gemini_api_key' && !clientKey.includes('TODO')) {
      const movieCatalogIndex = catalog.slice(0, 200).map((m) => ({
        id: m.id,
        title: m.titleRu || m.title,
        year: m.year,
        genres: m.genres,
        rating: m.rating
      }));

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${clientKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Select 25 movie IDs from this catalog for query: "${cleanPrompt}". Return JSON: { "recommendations": [{ "id": number, "reason": "short Russian rationale" }], "aiSummary": "Russian summary" }. Catalog:\n${JSON.stringify(movieCatalogIndex)}`
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3
          }
        })
      });

      if (res.ok) {
        const d = await res.json();
        const raw = d?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (raw) {
          const parsed = JSON.parse(raw);
          const map = new Map(catalog.map((m) => [m.id, m]));
          const deck = [];
          for (const r of parsed.recommendations || []) {
            if (r.id && map.has(r.id)) {
              deck.push({ ...map.get(r.id), aiReason: r.reason || 'Рекомендация MatchWatch AI' });
            }
          }
          if (deck.length >= 10) {
            return {
              success: true,
              deck,
              aiSummary: parsed.aiSummary || `Подборка от MatchWatch AI по запросу «${cleanPrompt}»`,
              isAi: true,
              source: 'gemini_api_client'
            };
          }
        }
      }
    }
  } catch (e) {}

  // 3. Guaranteed Tier 3: Local Semantic & 5D Vector Engine (Instant & 100% Reliable)
  const localDeck = getSemanticAndVectorDeck(cleanPrompt, userTasteVector, 25);
  return {
    success: true,
    deck: localDeck,
    aiSummary: `Умная 5D-подборка по запросу «${cleanPrompt}»`,
    isAi: false,
    isFallback: true,
    source: 'local_5d_engine'
  };
}
