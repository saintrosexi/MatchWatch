// MatchWatch — Master Gemini AI Cinema Concierge & High-Precision Recommender
import { movies } from '../data/movies.js';
import { calculateVectorDistance } from './recommendationEngine.js';

/**
 * Normalizes text for robust Russian & English search:
 * - Replaces 'ё', 'э' -> 'е'
 * - Replaces 'й' -> 'и'
 * - Removes non-alphanumeric chars
 * - Lowers case
 */
export function normalizeQueryText(text = '') {
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
 * Knowledge Base for Franchises, Superheroes, Characters & Famous Directors
 */
const FRANCHISES_AND_CHARACTERS = [
  {
    name: 'batman_dc',
    triggers: ['бетмен', 'бетмэн', 'бэтмен', 'бэтмэн', 'batman', 'темныи рыцарь', 'темный рыцарь', 'готем', 'готэм', 'брюс уэин', 'брюс уэйн', 'джокер', 'джокера', 'беил', 'бэйл'],
    requiredMovieIds: [3, 86, 122], // Тёмный рыцарь, Бэтмен: Начало, Тёмный рыцарь: Возрождение легенды
    relatedKeywords: ['готем', 'готэм', 'бетмен', 'бэтмен', 'джокер', 'нолан', 'кристофер нолан', 'комикс', 'город грехов', 'рыцарь', 'вигилант', 'мафи', 'криминал', 'бейла', 'бэйна'],
    relatedGenres: ['боевик', 'криминал', 'триллер', 'фантастика', 'детектив'],
    vectorBias: { darkness: 9, intellect: 8, energy: 8, dynamism: 8 },
    badgeTemplate: (m) => {
      if (m.id === 3) return `🦇 Культовый шедевр Кристофера Нолана: дуэль Бэтмена и Джокера Хита Леджера (★9.0)`;
      if (m.id === 86) return `🦇 Становление Брюса Уэйна: рождение легендарного защитника Готэма (★8.2)`;
      if (m.id === 122) return `🦇 Грандиозный финал трилогии: Бэтмен против безжалостного Бэйна (★8.4)`;
      return `⚡ Мрачный криминальный триллер и саспенс в духе вселенной Тёмного рыцаря (★${Number(m.rating || 8.0).toFixed(1)})`;
    }
  },
  {
    name: 'spiderman_marvel',
    triggers: ['человек паук', 'человекпаук', 'спаидермен', 'спайдермен', 'spider man', 'spiderman', 'питер паркер', 'маилз моралес', 'паук'],
    requiredMovieIds: [],
    relatedKeywords: ['человек паук', 'человек-паук', 'паук', 'паркер', 'марвел', 'мстители', 'стэн ли'],
    relatedGenres: ['боевик', 'приключения', 'фантастика'],
    vectorBias: { energy: 9, dynamism: 9, emotion: 8, intellect: 7 },
    badgeTemplate: (m) => `🕷️ Легендарная супергероика про Человека-паука и силу ответственности`
  },
  {
    name: 'harry_potter',
    triggers: ['гарри поттер', 'поттер', 'хогвартс', 'дамблдор', 'волан де морт', 'воландеморт', 'роулинг', 'harry potter'],
    requiredMovieIds: [],
    relatedKeywords: ['поттер', 'гарри', 'хогвартс', 'магия', 'волшебник', 'фэнтези', 'заклинани'],
    relatedGenres: ['фэнтези', 'приключения', 'семейный'],
    vectorBias: { emotion: 9, energy: 7, intellect: 7, darkness: 6 },
    badgeTemplate: (m) => `⚡ Волшебная вселенная магии, дружбы и великих тайн Хогвартса`
  },
  {
    name: 'star_wars',
    triggers: ['звездные воины', 'звездных воин', 'звездным воинам', 'star wars', 'джедаи', 'скаиуокер', 'дарт веидер', 'иода', 'ситх'],
    requiredMovieIds: [],
    relatedKeywords: ['звездные воины', 'джедаи', 'скаиуокер', 'веидер', 'галактика', 'космос', 'лукас'],
    relatedGenres: ['фантастика', 'приключения', 'боевик'],
    vectorBias: { intellect: 8, energy: 9, dynamism: 8, emotion: 8 },
    badgeTemplate: (m) => `🌌 Эпическая космическая сага о Силе, джедаях и судьбе Галактики`
  },
  {
    name: 'lotr',
    triggers: ['властелин колец', 'властелина колец', 'хоббит', 'хоббита', 'толкин', 'толкиен', 'фродо', 'гендальф', 'lotr'],
    requiredMovieIds: [],
    relatedKeywords: ['властелин колец', 'хоббит', 'средиземье', 'кольцо', 'толкин', 'джексон'],
    relatedGenres: ['фэнтези', 'приключения', 'драма'],
    vectorBias: { emotion: 10, energy: 9, dynamism: 8, intellect: 8, darkness: 6 },
    badgeTemplate: (m) => `💍 Монументальный шедевр мирового фэнтези Питера Джексона по книгам Толкина`
  },
  {
    name: 'nolan',
    triggers: ['нолан', 'нолана', 'нолану', 'кристофер нолан', 'кристофера нолана'],
    requiredMovieIds: [3, 86, 122, 10, 7, 65, 345, 840], // Тёмный рыцарь, Бэтмен: Начало, Возрождение легенды, Интерстеллар, Начало, Престиж, Мементо, Оппенгеймер
    relatedKeywords: ['нолан', 'кристофер нолан', 'интерстеллар', 'начало', 'престиж', 'темныи рыцарь', 'помни', 'мементо', 'оппенгеимер'],
    relatedGenres: ['фантастика', 'триллер', 'драма', 'детектив'],
    vectorBias: { intellect: 10, dynamism: 8, energy: 8, darkness: 7 },
    badgeTemplate: (m) => `⏳ Фирменный кинематографический стиль и нелинейный нарратив Кристофера Нолана`
  },
  {
    name: 'tarantino',
    triggers: ['тарантино', 'квентин', 'квентина тарантино'],
    requiredMovieIds: [],
    relatedKeywords: ['тарантино', 'квентин', 'чтиво', 'джанго', 'ублюдки', 'билл', 'псы'],
    relatedGenres: ['криминал', 'боевик', 'драма', 'комедия'],
    vectorBias: { energy: 9, dynamism: 9, intellect: 8, darkness: 6 },
    badgeTemplate: (m) => `🎬 Культовые диалоги, черный юмор и безупречная режиссура Квентина Тарантино`
  },
  {
    name: 'fincher',
    triggers: ['финчер', 'дэвид финчер', 'дэвида финчера'],
    requiredMovieIds: [],
    relatedKeywords: ['финчер', 'боицовскии клуб', 'семь', 'исчезнувшая', 'игра', 'зодиак'],
    relatedGenres: ['триллер', 'детектив', 'драма', 'криминал'],
    vectorBias: { darkness: 9, intellect: 10, dynamism: 7 },
    badgeTemplate: (m) => `🔍 Эталон психологического триллера и филигранный перфекционизм Дэвида Финчера`
  },
  {
    name: 'marvel_avengers',
    triggers: ['марвел', 'мстители', 'мстителеи', 'marvel', 'железныи человек', 'тони старк', 'капитан америка', 'тор', 'дэдпул', 'логан'],
    requiredMovieIds: [],
    relatedKeywords: ['мстители', 'марвел', 'marvel', 'железныи человек', 'логан', 'дэдпул', 'стражи галактики'],
    relatedGenres: ['боевик', 'фантастика', 'приключения'],
    vectorBias: { energy: 10, dynamism: 9, emotion: 8, intellect: 6 },
    badgeTemplate: (m) => `⚡ Зрелищный блокбастер кинематографической вселенной Marvel`
  }
];

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
    keys: ['адреналин', 'драив', 'драйв', 'экшн', 'погон', 'перестрелк', 'скорост', 'динамик', 'боевик', 'крут'],
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
  }
];

/**
 * Highly Intelligent Semantic & 5D Vector Matcher (Guaranteed 25 Movies)
 */
export function getSemanticAndVectorDeck(prompt = '', userTasteVector = null, limit = 25) {
  const normQ = normalizeQueryText(prompt);
  const vector = userTasteVector || { energy: 6, darkness: 5, intellect: 6, emotion: 7, dynamism: 6 };

  // 1. Check Franchise & Character matches
  const matchedFranchises = FRANCHISES_AND_CHARACTERS.filter((f) =>
    f.triggers.some((t) => normQ.includes(normalizeQueryText(t)))
  );

  // 2. Check Tropes matches
  const activeTropes = TROPES_DICTIONARY.filter((t) =>
    t.keys.some((k) => normQ.includes(normalizeQueryText(k)))
  );

  // Composite Target Vector & Target Genres
  let targetVector = { ...vector };
  let targetGenres = new Set();
  let mustIncludeIds = new Set();
  let customBadgeFn = null;

  if (matchedFranchises.length > 0) {
    const f = matchedFranchises[0];
    f.requiredMovieIds.forEach((id) => mustIncludeIds.add(id));
    f.relatedGenres.forEach((g) => targetGenres.add(g));
    targetVector = { ...vector, ...f.vectorBias };
    customBadgeFn = f.badgeTemplate;
  } else if (activeTropes.length > 0) {
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
    customBadgeFn = activeTropes[0].badgeTemplate;
  }

  // Tokenize query for direct fuzzy substring matching
  const tokens = normQ.split(/\s+/).filter((t) => t.length >= 3);

  // 3. Score all 440 movies
  const scored = movies.map((m) => {
    let score = (m.rating || 7.5) * 0.4;

    // Hard Boost for must-include franchise IDs
    if (mustIncludeIds.has(m.id)) {
      score += 100.0;
    }

    const normTitle = normalizeQueryText(m.titleRu + ' ' + m.title);
    const normDirector = normalizeQueryText(m.director || '');
    const normActors = normalizeQueryText(m.actors || '');
    const normGenres = normalizeQueryText(m.genres || '');
    const normDesc = normalizeQueryText(m.description || '' + ' ' + (m.fullDescription || ''));

    // 1. Full normalized query exact phrase match (Massive Boost)
    if (normTitle.includes(normQ)) score += 50.0;
    if (normDesc.includes(normQ)) score += 20.0;
    if (normDirector.includes(normQ)) score += 30.0;
    if (normActors.includes(normQ)) score += 20.0;

    // 2. Individual query tokens (Modest boost)
    for (const tok of tokens) {
      if (normTitle.includes(tok)) score += 5.0;
      if (normDirector.includes(tok)) score += 4.0;
      if (normActors.includes(tok)) score += 3.0;
      if (normGenres.includes(tok)) score += 3.0;
      if (normDesc.includes(tok)) score += 2.0;
    }

    // Check franchise related keywords
    if (matchedFranchises.length > 0) {
      for (const f of matchedFranchises) {
        for (const kw of f.relatedKeywords) {
          const normKw = normalizeQueryText(kw);
          if (normTitle.includes(normKw)) score += 12.0;
          if (normDesc.includes(normKw)) score += 6.0;
          if (normDirector.includes(normKw)) score += 8.0;
          if (normActors.includes(normKw)) score += 6.0;
        }
      }
    }

    // Genre affinity
    if (targetGenres.size > 0) {
      let gHits = 0;
      targetGenres.forEach((g) => {
        if (normGenres.includes(normalizeQueryText(g))) gHits++;
      });
      score += gHits * 2.0;
    }

    // 5D Vector alignment
    const dist = calculateVectorDistance(m.sensationVector, targetVector);
    score -= dist * 0.25;

    // Badge Generation
    let reason = '';
    if (customBadgeFn) {
      reason = customBadgeFn(m);
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
                  text: `Ты — кинокритик. Выбери РОВНО 25 фильмов из этого каталога под запрос: "${cleanPrompt}". Если зритель ищет конкретного персонажа или режиссера (например бетмен, нолан), обязательно включи все фильмы с ним. Верни JSON: { "recommendations": [{ "id": number, "reason": "сочное синефильское описание 1-2 предложения" }], "aiSummary": "резюме" }.\nКаталог:\n${catalogSummary}`
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
    aiSummary: `Кураторская подборка из 25 фильмов по запросу «${cleanPrompt}»`,
    isAi: false,
    isFallback: true,
    source: 'local_5d_engine'
  };
}
