/**
 * Vercel Serverless Function: /api/gemini-recommend
 * 
 * MatchWatch 2-Stage AI Cinema Concierge
 * 
 * Stage 1: Strict format hard-filtering & dynamic multi-factor candidate retrieval over 440 enriched movies.
 *          - Hard constraints: cartoons, anime, B&W, Soviet cinema strictly enforced.
 *          - Dynamic scoring: Semantic plot matching + Vibe vector + Era/Nostalgia modifier.
 * Stage 2: Google Gemini 2.0 selects the best movies from candidate pool (up to 25), sorts in optimal order,
 *          and writes rich, personalized 1-2 sentence cinema critic blurbs for each film.
 * Fallback: If Gemini key is missing or network fails, returns the top relevant candidates directly with local badges.
 */

import { movies } from '../src/data/movies.js';

/**
 * Text normalizer for phonetic & Cyrillic/Latin comparison
 */
function normalizeText(text = '') {
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

function getQueryStem(token = '') {
  if (token.length <= 3) return token;
  return token
    .replace(/(ов|ев|ёв|ин|ий|ый|ая|ое|ые|ие|ям|ях|ями|ами|ом|ем|ам|ах|ой|ей|ую|юю|ого|его|ому|ему|ым|им|ых|их|ся|сь|е|и|у|а|о|ы|я|ю)$/gi, '')
    .trim();
}

/**
 * Stage 1: Strict Format Filtering & Multi-Factor Candidate Retrieval
 */
export function retrieveTop50Candidates(prompt = '', userTasteVector = null, catalog = movies) {
  const normPrompt = normalizeText(prompt);
  const rawTokens = normPrompt.split(/\s+/).filter((t) => t.length >= 2);
  const promptTokens = rawTokens.filter((t) => !STOP_WORDS.has(t));
  const stemmedTokens = promptTokens.map(getQueryStem);
  const allSearchTokens = Array.from(new Set([...promptTokens, ...stemmedTokens])).filter((t) => t.length >= 2);
  const targetVector = userTasteVector || { energy: 6, darkness: 5, intellect: 6, emotion: 7, dynamism: 6 };

  // 1. HARD FORMAT CONSTRAINTS
  let candidatePool = [...catalog];

  const isAnimationQuery = /(^|[^а-яa-z0-9])(мультик|мультфильм|мультсериал|анимац|мульт|пиксар|диснеи|дисней)/iu.test(normPrompt);
  const isAnimeQuery = /(^|[^а-яa-z0-9])(аниме|миязаки|миядзаки|гибли|макото синкай)/iu.test(normPrompt);
  const isBWQuery = /(^|[^а-яa-z0-9])(чб|черно бел|монохром)/iu.test(normPrompt);
  const isSovietQuery = /(^|[^а-яa-z0-9])(советск|ссср|мосфильм|ленфильм)/iu.test(normPrompt);

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

    const normTitleRu = normalizeText(m.titleRu);
    const normTitleOrig = normalizeText(m.title);
    const normDirector = normalizeText(m.director);
    const normActors = normalizeText(m.actors);
    const normCountry = normalizeText(m.country);
    const normGenres = normalizeText(m.genres);
    const normEra = normalizeText(m.era);
    const normPlot = normalizeText(`${m.description || ''} ${m.fullDescription || ''}`);
    const movieKeywords = (m.keywords || []).map(normalizeText);
    const movieTropes = (m.tropes || []).map(normalizeText);

    // 1. Full Query Exact Phrase in Title
    if (normTitleRu.includes(normPrompt) || normTitleOrig.includes(normPrompt)) {
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
      if (normPlot.includes(tok)) {
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
    if (normDirector && (normPrompt.includes(normDirector) || allSearchTokens.some((t) => t.length >= 4 && normDirector.includes(t)))) {
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
    if ((normPrompt.includes('детств') || normPrompt.includes('ностальги') || normPrompt.includes('классик')) && m.year <= 2010) {
      score += 30.0;
      matchHits++;
    }
    if ((normPrompt.includes('новинк') || normPrompt.includes('свеж') || normPrompt.includes('новый')) && m.year >= 2020) {
      score += 30.0;
      matchHits++;
    }

    // 7. Vibe / Mood alignment
    if (normPrompt.includes('приятн') || normPrompt.includes('добр') || normPrompt.includes('уютн') || normPrompt.includes('семейн') || normPrompt.includes('тепл')) {
      if ((m.sensationVector?.darkness || 5) <= 4 && (m.sensationVector?.emotion || 5) >= 6) {
        score += 25.0;
        matchHits++;
      }
    }
    if (normPrompt.includes('мрачн') || normPrompt.includes('тяжел') || normPrompt.includes('страшн') || normPrompt.includes('жесток')) {
      if ((m.sensationVector?.darkness || 5) >= 7) {
        score += 25.0;
        matchHits++;
      }
    }

    // 8. 5D Sensation Vector alignment
    if (m.sensationVector) {
      const dist =
        Math.abs((m.sensationVector.energy || 5) - targetVector.energy) +
        Math.abs((m.sensationVector.darkness || 5) - targetVector.darkness) +
        Math.abs((m.sensationVector.intellect || 5) - targetVector.intellect) +
        Math.abs((m.sensationVector.emotion || 5) - targetVector.emotion) +
        Math.abs((m.sensationVector.dynamism || 5) - targetVector.dynamism);
      score += Math.max(0, 10 - dist * 0.5);
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

  // Filter for genuine matches only if specific query tokens exist
  let candidates = scored;
  if (allSearchTokens.length > 0) {
    const relevant = scored.filter((s) => s.matchHits > 0);
    if (relevant.length > 0) {
      candidates = relevant;
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 50).map((s) => s.movie);
}

export default async function handler(req, res) {
  // CORS setup
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

  const cleanPrompt = prompt.trim();

  // Step 1: Extract genuine matching candidates with strict format filtering
  const topCandidates = retrieveTop50Candidates(cleanPrompt, userTasteVector, movies);

  // If no Gemini API key or offline, return relevant candidates directly (max 25, no filler padding)
  if (!apiKey || apiKey === 'your_gemini_api_key' || apiKey.includes('TODO')) {
    const fallbackDeck = topCandidates.slice(0, 25);
    return res.status(200).json({
      success: true,
      deck: fallbackDeck,
      aiSummary: `Подобрал для вас ${fallbackDeck.length} ${fallbackDeck.length === 1 ? 'фильм' : 'фильмов'} по запросу «${cleanPrompt}»`,
      fallback: true
    });
  }

  try {
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

    const userPayload = `ЗАПРОС ЗРИТЕЛЯ:
«${cleanPrompt}»

5D-ПРОФИЛЬ ВКУСА:
Энергия: ${userTasteVector?.energy ?? 6}/10, Мрачность: ${userTasteVector?.darkness ?? 5}/10, Интеллект: ${userTasteVector?.intellect ?? 6}/10, Эмоции: ${userTasteVector?.emotion ?? 7}/10, Динамика: ${userTasteVector?.dynamism ?? 6}/10

СПИСОК КАНДИДАТОВ ДЛЯ ВЫБОРА:
${candidatesText}`;

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
      console.warn('Gemini HTTP Error:', response.status);
      const fallbackDeck = topCandidates.slice(0, 25);
      return res.status(200).json({
        success: true,
        deck: fallbackDeck,
        aiSummary: `Коллекция из ${fallbackDeck.length} фильмов по запросу «${cleanPrompt}»`,
        fallback: true
      });
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      const fallbackDeck = topCandidates.slice(0, 25);
      return res.status(200).json({
        success: true,
        deck: fallbackDeck,
        fallback: true
      });
    }

    const parsed = JSON.parse(rawText);
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

    // If Gemini selected fewer but we have relevant candidates, use all genuinely relevant candidates
    if (finalDeck.length === 0) {
      for (const m of topCandidates.slice(0, 25)) {
        finalDeck.push(m);
      }
    }

    return res.status(200).json({
      success: true,
      deck: finalDeck,
      aiSummary: parsed.aiSummary || `Коллекция из ${finalDeck.length} фильмов по запросу «${cleanPrompt}»`,
      isAi: true
    });
  } catch (error) {
    console.error('Gemini Concierge exception:', error);
    const fallbackDeck = topCandidates.slice(0, 25);
    return res.status(200).json({
      success: true,
      deck: fallbackDeck,
      aiSummary: `Коллекция из ${fallbackDeck.length} фильмов по запросу «${cleanPrompt}»`,
      fallback: true
    });
  }
}
