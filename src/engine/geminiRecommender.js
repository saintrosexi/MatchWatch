// MatchWatch — Master Gemini AI Cinema Concierge & High-Precision Recommender
import { movies } from '../data/movies.js';
import { calculateVectorDistance } from './recommendationEngine.js';

/**
 * Rich Semantic Tropes & Keyword Dictionary
 */
const TROPES_DICTIONARY = [
  // Psychological / Twists / Intellect
  {
    keys: ['твист', 'концовк', 'неожидан', 'финал', 'развязк', 'головоломк', 'мозг', 'запутан', 'смысл'],
    vectorBias: { intellect: 10, darkness: 7, dynamism: 6 },
    genres: ['триллер', 'детектив', 'фантастика', 'драма'],
    badgeTemplate: (m) => `🧠 Закрученная головоломка (Интеллект ${m.sensationVector?.intellect || 9}/10) с непредсказуемым финалом`
  },
  // Noir / Cyberpunk / Gritty Atmospheric
  {
    keys: ['мрачн', 'нуар', 'дожд', 'киберпанк', 'неон', 'криминал', 'детектив', 'мафи', 'гангстер'],
    vectorBias: { darkness: 9, energy: 6, intellect: 8, dynamism: 7 },
    genres: ['криминал', 'детектив', 'триллер', 'фантастика'],
    badgeTemplate: (m) => `⚡ Густая нео-нуарная атмосфера (Мрачность ${m.sensationVector?.darkness || 8}/10) и высокий саспенс`
  },
  // High Octane / Adrenaline / Action
  {
    keys: ['адреналин', 'драйв', 'экшн', 'погон', 'перестрелк', 'скорост', 'динамик', 'боевик', 'крут'],
    vectorBias: { energy: 10, dynamism: 10, darkness: 5 },
    genres: ['боевик', 'триллер', 'приключения', 'криминал'],
    badgeTemplate: (m) => `🔥 Бешеный темпоритм (Динамика ${m.sensationVector?.dynamism || 9}/10) и адреналиновые сцены`
  },
  // Chill / Pizza with friends / Comedy
  {
    keys: ['пицц', 'друг', 'компани', 'вечер', 'смешн', 'комед', 'легк', 'расслаб', 'угар', 'весел'],
    vectorBias: { energy: 7, emotion: 8, darkness: 2, dynamism: 7 },
    genres: ['комедия', 'приключения', 'боевик'],
    badgeTemplate: (m) => `🍕 Идеально для отдыха с друзьями: искрометный юмор и рейтинг ★${Number(m.rating || 8.0).toFixed(1)}`
  },
  // Sci-Fi / Deep Space / Cosmic
  {
    keys: ['космос', 'вселенн', 'будущ', 'научн', 'фантастик', 'робот', 'ии', 'время', 'интерстеллар'],
    vectorBias: { intellect: 9, emotion: 8, dynamism: 7, energy: 7 },
    genres: ['фантастика', 'приключения', 'драма'],
    badgeTemplate: (m) => `🌌 Монументальная космическая эстетика и глубокие философские размышления`
  },
  // Tearjerker / Deep Emotional Drama / Romance
  {
    keys: ['слез', 'рыдат', 'плакат', 'любов', 'романтик', 'драм', 'душевн', 'трогательн', 'чувств', 'сердц'],
    vectorBias: { emotion: 10, darkness: 4, intellect: 7, energy: 4 },
    genres: ['драма', 'мелодрама', 'биография'],
    badgeTemplate: (m) => `💔 Пронзительная эмоциональная глубина (Эмоции ${m.sensationVector?.emotion || 9}/10) до мурашек`
  },
  // Directors
  {
    keys: ['нолан', 'кристофер нолан'],
    vectorBias: { intellect: 10, dynamism: 8, energy: 8 },
    genres: ['фантастика', 'триллер', 'боевик', 'детектив'],
    badgeTemplate: (m) => `⏳ Масштабный визуальный нарратив и филигранная режиссура в духе Кристофера Нолана`
  },
  {
    keys: ['финчер', 'дэвид финчер'],
    vectorBias: { intellect: 9, darkness: 9, dynamism: 7 },
    genres: ['триллер', 'детектив', 'криминал', 'драма'],
    badgeTemplate: (m) => `🔍 Безупречный психологический детектив с хирургически выверенной режиссурой Финчера`
  },
  {
    keys: ['тарантино', 'квентин тарантино'],
    vectorBias: { energy: 9, dynamism: 9, intellect: 8, darkness: 6 },
    genres: ['криминал', 'боевик', 'комедия', 'драма'],
    badgeTemplate: (m) => `🎬 Культовые диалоги, острый черный юмор и неподражаемый авторский стиль`
  }
];

/**
 * Highly Intelligent Semantic & 5D Vector Matcher (Guaranteed 25 Movies)
 */
export function getSemanticAndVectorDeck(prompt = '', userTasteVector = null, limit = 25) {
  const q = prompt.toLowerCase().trim();
  const vector = userTasteVector || { energy: 6, darkness: 5, intellect: 6, emotion: 7, dynamism: 6 };

  // Find matching tropes
  const activeTropes = TROPES_DICTIONARY.filter((t) => t.keys.some((k) => q.includes(k)));

  // Build target sensation vector
  let targetVector = { ...vector };
  let targetGenres = new Set();

  if (activeTropes.length > 0) {
    let e = 0, d = 0, i = 0, em = 0, dy = 0;
    activeTropes.forEach((t) => {
      e += t.vectorBias.energy;
      d += t.vectorBias.darkness;
      i += t.vectorBias.intellect;
      em += t.vectorBias.emotion ?? vector.emotion;
      dy += t.vectorBias.dynamism ?? vector.dynamism;
      t.genres.forEach((g) => targetGenres.add(g));
    });
    const len = activeTropes.length;
    targetVector = {
      energy: Math.round((e / len + vector.energy) / 2),
      darkness: Math.round((d / len + vector.darkness) / 2),
      intellect: Math.round((i / len + vector.intellect) / 2),
      emotion: Math.round((em / len + vector.emotion) / 2),
      dynamism: Math.round((dy / len + vector.dynamism) / 2)
    };
  }

  // Score all 440 movies
  const scored = movies.map((m) => {
    let score = (m.rating || 7.5) * 0.5;

    const mTitle = (m.titleRu || m.title || '').toLowerCase();
    const mDirector = (m.director || '').toLowerCase();
    const mActors = (m.actors || '').toLowerCase();
    const mGenres = (m.genres || '').toLowerCase();
    const mDesc = (m.description || '').toLowerCase();

    // Query token hits
    const queryTokens = q.split(/\s+/).filter((t) => t.length >= 3);
    for (const tok of queryTokens) {
      if (mTitle.includes(tok)) score += 6.0;
      if (mDirector.includes(tok)) score += 5.0;
      if (mActors.includes(tok)) score += 3.0;
      if (mGenres.includes(tok)) score += 3.0;
      if (mDesc.includes(tok)) score += 2.0;
    }

    // Genre affinity
    if (targetGenres.size > 0) {
      let gHits = 0;
      targetGenres.forEach((g) => {
        if (mGenres.includes(g)) gHits++;
      });
      score += gHits * 2.0;
    }

    // 5D Vector alignment distance
    const dist = calculateVectorDistance(m.sensationVector, targetVector);
    score -= dist * 0.3;

    // Small variance to keep feed fresh
    score += Math.random() * 0.2;

    // Dynamic high-quality reason badge
    let reason = '';
    if (activeTropes.length > 0) {
      reason = activeTropes[0].badgeTemplate(m);
    } else {
      const matchPct = Math.min(99, Math.max(89, Math.round(100 - dist * 3.5)));
      reason = `✨ Совпадение ${matchPct}% по параметрам сюжета, режиссуры и 5D-вкусу`;
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

  // Return strictly top 25 unique movies
  return scored.slice(0, limit).map((s) => s.movie);
}

/**
 * Master Gemini AI Concierge Engine (25 Curated Movies)
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

  // Extract previously liked titles
  const likedTitles = movies
    .filter((m) => likedIds.includes(m.id))
    .map((m) => m.titleRu || m.title)
    .slice(0, 10);

  // Tier 1: Try Vercel Serverless Function Proxy (/api/gemini-recommend)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7500);

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
      if (data && data.success && Array.isArray(data.deck) && data.deck.length === 25) {
        return {
          success: true,
          deck: data.deck,
          aiSummary: data.aiSummary || `Коллекция из 25 фильмов по запросу «${cleanPrompt}»`,
          isAi: true,
          source: 'gemini_api_serverless'
        };
      }
    }
  } catch (err) {
    // Graceful progression to Tier 2
  }

  // Tier 2: Direct Client API key fallback (Dev environment)
  try {
    const clientKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY;
    if (clientKey && clientKey !== 'your_gemini_api_key' && !clientKey.includes('TODO')) {
      const catalogSummary = catalog.map((m) => `[ID: ${m.id}] "${m.titleRu}" (${m.year}, ${m.genres}) | Реж: ${m.director} | Рейтинг: ${m.rating}`).join('\n');
      
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
                  text: `Выбери РОВНО 25 фильмов из этого каталога под запрос: "${cleanPrompt}". Верни JSON: { "recommendations": [{ "id": number, "reason": "сочное синефильское описание 1-2 предложения" }], "aiSummary": "резюме" }.\nКаталог:\n${catalogSummary}`
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.35
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
          const seen = new Set();

          for (const r of parsed.recommendations || []) {
            const numId = Number(r.id);
            if (numId && map.has(numId) && !seen.has(numId)) {
              seen.add(numId);
              deck.push({
                ...map.get(numId),
                aiReason: r.reason || `Рекомендация MatchWatch AI`
              });
            }
            if (deck.length >= 25) break;
          }

          if (deck.length >= 25) {
            return {
              success: true,
              deck: deck.slice(0, 25),
              aiSummary: parsed.aiSummary || `Коллекция из 25 фильмов по запросу «${cleanPrompt}»`,
              isAi: true,
              source: 'gemini_api_client'
            };
          }
        }
      }
    }
  } catch (e) {}

  // Tier 3: High-Precision Semantic & 5D Vector Fallback (Zero Downtime, Exactly 25 Movies)
  const localDeck = getSemanticAndVectorDeck(cleanPrompt, userTasteVector, 25);
  return {
    success: true,
    deck: localDeck,
    aiSummary: `Кураторская 5D-подборка из 25 фильмов по запросу «${cleanPrompt}»`,
    isAi: false,
    isFallback: true,
    source: 'local_5d_engine'
  };
}
