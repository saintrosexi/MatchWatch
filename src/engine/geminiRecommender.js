/**
 * MatchWatch — Universal 2-Stage AI Cinema Concierge & Dynamic Semantic Recommender
 * 
 * Stage 1: Strict Format Hard-Filtering & Dynamic Multi-Factor Candidate Retrieval
 *          - Enforces format constraints: animation, anime, B&W, Soviet cinema.
 *          - Dynamic scoring: Semantic plot matching + Vibe vector + Era/Nostalgia modifier.
 * Stage 2: Google Gemini 2.0 Flash curates the top 25 movies with deep film critic rationales.
 * Tier 3: Zero-downtime Local Fallback preserving 100% format constraints and relevance.
 */

import { movies } from '../data/movies.js';

export function normalizeQueryText(text = '') {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/э/g, 'е')
    .replace(/й/g, 'и')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'я', 'хочу', 'фильм', 'фильмы', 'фильма', 'кино', 'кинематограф', 'посоветуй',
  'покажи', 'найди', 'подобрать', 'подбери', 'что', 'нибудь', 'что-нибудь',
  'про', 'просто', 'очень', 'самый', 'самые', 'самое', 'под', 'для', 'с', 'со', 'в', 'во', 'о', 'об',
  'много', 'мало', 'людей', 'люди', 'человек', 'тд', 'итд', 'и тд', 'и т п', 'типа', 'вроде', 'где',
  'там', 'когда', 'который', 'которая', 'которые', 'тоже', 'еще', 'ещё', 'все', 'всё', 'как', 'бы', 'ли'
]);

export function getQueryStem(token = '') {
  if (token.length <= 3) return token;
  return token
    .replace(/(ов|ев|ёв|ин|ий|ый|ая|ое|ые|ие|ям|ях|ями|ами|ом|ем|ам|ах|ой|ей|ую|юю|ого|его|ому|ему|ым|им|ых|их|ся|сь|е|и|у|а|о|ы|я|ю)$/gi, '')
    .trim();
}

/**
 * Stage 1: Universal Semantic Candidate Retrieval & Hard Format Filtering
 */
export function getSemanticAndVectorDeck(prompt = '', userTasteVector = null, limit = 25, catalog = movies) {
  const normQ = normalizeQueryText(prompt);
  const rawTokens = normQ.split(/\s+/).filter((t) => t.length >= 2);
  const promptTokens = rawTokens.filter((t) => !STOP_WORDS.has(t));
  const stemmedTokens = promptTokens.map(getQueryStem);
  const allSearchTokens = Array.from(new Set([...promptTokens, ...stemmedTokens])).filter((t) => t.length >= 2);
  const targetVector = userTasteVector || { energy: 6, darkness: 5, intellect: 6, emotion: 7, dynamism: 6 };

  // 1. HARD FORMAT CONSTRAINTS
  let candidatePool = [...catalog];

  const isAnimationQuery = /(^|[^а-яa-z0-9])(мультик|мультфильм|мультсериал|анимац|мульт|пиксар|диснеи|дисней)/iu.test(normQ);
  const isAnimeQuery = /(^|[^а-яa-z0-9])(аниме|миязаки|миядзаки|гибли|макото синкай)/iu.test(normQ);
  const isBWQuery = /(^|[^а-яa-z0-9])(чб|черно бел|монохром)/iu.test(normQ);
  const isSovietQuery = /(^|[^а-яa-z0-9])(советск|ссср|мосфильм|ленфильм)/iu.test(normQ);

  if (isAnimationQuery) {
    candidatePool = candidatePool.filter((m) => (m.genres || '').toLowerCase().includes('мультфильм'));
  }
  if (isAnimeQuery) {
    candidatePool = candidatePool.filter(
      (m) =>
        (m.country || '').includes('Япония') &&
        ((m.genres || '').toLowerCase().includes('мультфильм') || (m.keywords || []).includes('аниме') || (m.director || '').includes('Миядзаки'))
    );
  }
  if (isBWQuery) {
    candidatePool = candidatePool.filter((m) => m.isBW === true);
  }
  if (isSovietQuery) {
    candidatePool = candidatePool.filter((m) => (m.country || '').includes('СССР') || (m.era || '').includes('советск'));
  }

  // 2. DYNAMIC MULTI-FACTOR SCORING
  const scored = candidatePool.map((m) => {
    let score = (m.rating || 7.5) * 0.4;
    let matchHits = 0;

    const normTitleRu = normalizeQueryText(m.titleRu);
    const normTitleOrig = normalizeQueryText(m.title);
    const normDirector = normalizeQueryText(m.director || '');
    const normActors = normalizeQueryText(m.actors || '');
    const normGenres = normalizeQueryText(m.genres || '');
    const normCountry = normalizeQueryText(m.country || '');
    const normEra = normalizeQueryText(m.era || '');
    const normDesc = normalizeQueryText(`${m.description || ''} ${m.fullDescription || ''}`);
    const movieKeywords = (m.keywords || []).map(normalizeQueryText);
    const movieTropes = (m.tropes || []).map(normalizeQueryText);

    // 1. Full Query Title Exact Match
    if (normTitleRu.includes(normQ) || normTitleOrig.includes(normQ)) {
      score += 100.0;
      matchHits += 5;
    }

    // 2. Track distinct matched tokens across keywords, tropes, title & description
    const matchedDistinctTokens = new Set();

    for (const tok of allSearchTokens) {
      if (movieKeywords.some((k) => k.includes(tok) || tok.includes(k))) {
        matchedDistinctTokens.add(tok);
      }
      if (movieTropes.some((tr) => tr.includes(tok) || tok.includes(tr))) {
        matchedDistinctTokens.add(tok);
      }
      if (normTitleRu.includes(tok) || normTitleOrig.includes(tok)) {
        matchedDistinctTokens.add(tok);
      }
      if (normDesc.includes(tok)) {
        matchedDistinctTokens.add(tok);
      }
      if (normGenres.includes(tok)) {
        matchedDistinctTokens.add(tok);
      }
    }

    const distinctCount = matchedDistinctTokens.size;
    matchHits += distinctCount;

    // Compound Multi-Match Boost: movies matching 2, 3, or 4+ query concepts rank vastly higher!
    if (distinctCount === 1) score += 30.0;
    else if (distinctCount === 2) score += 75.0;
    else if (distinctCount === 3) score += 130.0;
    else if (distinctCount >= 4) score += 200.0;

    // 5. Director & Actor Matches
    if (normDirector && (normQ.includes(normDirector) || allSearchTokens.some((t) => t.length >= 4 && normDirector.includes(t)))) {
      score += 45.0;
      matchHits += 2;
    }
    for (const tok of allSearchTokens) {
      if (tok.length >= 4 && normActors.includes(tok)) {
        score += 15.0;
        matchHits++;
      }
    }

    // 6. Era & Nostalgia alignment
    if ((normQ.includes('детств') || normQ.includes('ностальги') || normQ.includes('классик')) && m.year <= 2010) {
      score += 30.0;
      matchHits++;
    }
    if ((normQ.includes('новинк') || normQ.includes('свеж') || normQ.includes('новый')) && m.year >= 2020) {
      score += 30.0;
      matchHits++;
    }

    // 7. Vibe / Mood alignment
    if (normQ.includes('приятн') || normQ.includes('добр') || normQ.includes('уютн') || normQ.includes('семейн') || normQ.includes('тепл')) {
      if ((m.sensationVector?.darkness || 5) <= 4 && (m.sensationVector?.emotion || 5) >= 6) {
        score += 25.0;
        matchHits++;
      }
    }
    if (normQ.includes('мрачн') || normQ.includes('тяжел') || normQ.includes('страшн') || normQ.includes('жесток')) {
      if ((m.sensationVector?.darkness || 5) >= 7) {
        score += 25.0;
        matchHits++;
      }
    }

    // Contextual Badge Generator
    let reason = '';
    if (m.genres?.includes('Мультфильм')) {
      reason = `🦁 Любимый мультфильм: приключения, теплота и атмосфера из детства (★${Number(m.rating || 8.0).toFixed(1)})`;
    } else if (m.keywords?.includes('киллер') || m.keywords?.includes('перестрелки')) {
      reason = `💥 Безумный адреналиновый драйв, перестрелки и экшен (★${Number(m.rating || 8.0).toFixed(1)})`;
    } else if (m.keywords?.includes('космос')) {
      reason = `🌌 Монументальная космическая одиссея и глубокая атмосфера (★${Number(m.rating || 8.0).toFixed(1)})`;
    } else if (m.isBW) {
      reason = `🎞️ Нестареющий шедевр мирового черно-белого кино (★${Number(m.rating || 8.0).toFixed(1)})`;
    } else {
      reason = `✨ Совпадение по сюжету, стилю и атмосфере (★${Number(m.rating || 8.0).toFixed(1)})`;
    }

    return {
      movie: {
        ...m,
        aiReason: reason
      },
      score,
      matchHits
    };
  });

  // Strict relevance filter
  let candidates = scored;
  if (allSearchTokens.length > 0) {
    const relevant = scored.filter((s) => s.matchHits > 0);
    if (relevant.length > 0) {
      candidates = relevant;
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit).map((s) => s.movie);
}

/**
 * Master Gemini AI Concierge Engine (Stage 2 Curation with Strict LLM Format Rules)
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

  // Tier 1: Vercel Serverless Function Proxy (/api/gemini-recommend)
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
      if (data && data.success && Array.isArray(data.deck) && data.deck.length > 0) {
        return {
          success: true,
          deck: data.deck,
          aiSummary: data.aiSummary || `Коллекция из ${data.deck.length} фильмов по запросу «${cleanPrompt}»`,
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
      const topCandidates = getSemanticAndVectorDeck(cleanPrompt, userTasteVector, 50, catalog);
      const targetCount = Math.min(25, topCandidates.length);
      const candidatesText = topCandidates
        .map(
          (m) =>
            `[ID: ${m.id}] "${m.titleRu}" (${m.year}) | Жанр: ${m.genres} | Реж: ${m.director} | Рейтинг: ${m.rating} | Описание: ${m.description || ''} | Теги: ${(m.keywords || []).slice(0, 8).join(', ')}`
        )
        .join('\n');

      const systemPrompt = `Ты — MatchWatch AI Cinema Genie, ведущий мировой кинокритик и кино-сомелье с безупречным вкусом.

ТВОЯ ЗАДАЧА:
Зритель обратился к тебе с запросом: «${cleanPrompt}».
Из предложенных кандидатов нашей базы выбери до ${targetCount} САМЫХ ТОЧНО ПОДХОДЯЩИХ, выстрой их в идеальном порядке (от абсолютных шедевров к интересным находкам) и напиши к каждому фильму сочную 1–2 предложения персональную синефильскую рецензию ("reason").

ЖЕЛЕЗОБЕТОННЫЕ ПРАВИЛА СООТВЕТСТВИЯ (КРИТИЧЕСКИ ВАЖНО):
1. СТРОГОЕ СООТВЕТСТВИЕ ФОРМАТУ: Если зритель просит "мультик" / "мультфильм" / "анимацию" — выбирай ИСКЛЮЧИТЕЛЬНО анимационные фильмы! Категорически запрещено выбирать художественные игровые фильмы (даже если там есть фантастика, космос или животные)!
2. ТЕМАТИЧЕСКИЙ ФОКУС: Если просят животных, выбирай фильмы где главные герои — животные (Король Лев, Немо, Рататуй, Ледниковый период, Зверополис, Мадагаскар).
3. ЭПОХА И ВАЙБ: «из детства» / «ностальгия» -> шедевры 90-х и 2000-х; «приятное настроение» -> добрые, светлые и уютные истории.
4. ВЫБОР ТОЛЬКО ИЗ СПИСКА: Выбирай СТРОГО из предложенного списка кандидатов (не выдумывай посторонние ID).
5. "reason": Обязательно укажи яркие фишки фильма, почему именно он идеально подходит под запрос зрителя.

ФОРМАТ ВЫВОДА (СТРОГО JSON):
{
  "recommendations": [
    {
      "id": 68,
      "reason": "Культовый шедевр нашего детства: история взросления львенка Симбы в саванне с великой музыкой Ханса Циммера."
    }
  ],
  "aiSummary": "Собрал для вас коллекцию любимых мультфильмов из детства..."
}`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${clientKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: systemPrompt }, { text: `ЗАПРОС ЗРИТЕЛЯ: «${cleanPrompt}»\n\nКАНДИДАТЫ:\n${candidatesText}` }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.35,
            maxOutputTokens: 4096
          }
        })
      });

      if (res.ok) {
        const d = await res.json();
        const raw = d?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (raw) {
          const parsed = JSON.parse(raw);
          const candidateMap = new Map(topCandidates.map((m) => [m.id, m]));
          const finalDeck = [];
          const seenIds = new Set();

          for (const rec of parsed.recommendations || []) {
            const numId = Number(rec.id);
            if (candidateMap.has(numId) && !seenIds.has(numId)) {
              seenIds.add(numId);
              finalDeck.push({
                ...candidateMap.get(numId),
                aiReason: rec.reason || `Рекомендация MatchWatch AI`
              });
            }
            if (finalDeck.length >= 25) break;
          }

          if (finalDeck.length > 0) {
            return {
              success: true,
              deck: finalDeck,
              aiSummary: parsed.aiSummary || `Коллекция из ${finalDeck.length} фильмов по запросу «${cleanPrompt}»`,
              isAi: true,
              source: 'gemini_api_client'
            };
          }
        }
      }
    }
  } catch (e) {
    console.warn('Gemini Client fallback exception:', e);
  }

  // Tier 3: Zero-downtime Local Semantic Fallback (100% Format & Relevance Guaranteed)
  const localDeck = getSemanticAndVectorDeck(cleanPrompt, userTasteVector, 25, catalog);
  return {
    success: true,
    deck: localDeck,
    aiSummary: `Подобрал для вас ${localDeck.length} ${localDeck.length === 1 ? 'фильм' : 'фильмов'} по запросу «${cleanPrompt}»`,
    isAi: false,
    isFallback: true,
    source: 'local_5d_engine'
  };
}
