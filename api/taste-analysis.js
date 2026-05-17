export default async function handler(req, res) {
  // CORS Headers (in case of different origins in dev mode)
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { likedMovies } = req.body;

  if (!likedMovies || !Array.isArray(likedMovies) || likedMovies.length === 0) {
    return res.status(400).json({ error: "Список любимых фильмов пуст или некорректен." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY environment variable!");
    return res.status(500).json({
      error: "Сервер кинокритика временно недоступен: отсутствует API-ключ Gemini."
    });
  }

  try {
    // Group movies by category
    const moviesOnly = likedMovies.filter(m => m.type === "movie" || !m.type || m.type === "film");
    const seriesOnly = likedMovies.filter(m => m.type === "series");
    const animeOnly = likedMovies.filter(m => m.type === "anime");

    const formatMovie = m => {
      const ratingStr = m.personalRating ? ` (Оценка: ${m.personalRating}/10)` : "";
      const favStr = m.isFavorite ? " [В ИЗБРАННОМ/ЛЮБИМОЕ]" : "";
      return `* «${m.titleRu || m.title}» (${m.year}), жанры: ${m.genres || "разные"}, режиссер: ${m.director || "неизвестно"}${ratingStr}${favStr}`;
    };

    const moviesSummaryText = moviesOnly.length > 0 ? moviesOnly.map(formatMovie).join("\n") : "Список пуст.";
    const seriesSummaryText = seriesOnly.length > 0 ? seriesOnly.map(formatMovie).join("\n") : "Список пуст.";
    const animeSummaryText = animeOnly.length > 0 ? animeOnly.map(formatMovie).join("\n") : "Список пуст.";

    const prompt = `Ты — невероятно наблюдательный, близкий друг пользователя, который потрясающе разбирается в кино, видит скрытые смыслы и знает толк в хороших историях. Тебе нужно составить ОДИН цельный, глубокий, вдохновляющий и емкий кинематографический портрет-вердикт по его вкусам.
Анализ должен быть написан живым, разговорным, теплым и абсолютно оригинальным языком, БЕЗ сухих рецензионных клише, шаблонов и номеров разделов. 
Пиши это как единое, безупречное эссе-обращение к другу (без каких-либо заголовков типа "Раздел 1", "Вердикт" и т.д. — просто красивый, слитный текст из 2-3 абзацев).

Вот списки просмотренных пользователем картин, сгруппированные по категориям, с его оценками (1-10) и отметками "Любимое" (если есть):

🎬 **ФИЛЬМЫ**:
${moviesSummaryText}

📺 **СЕРИАЛЫ**:
${seriesSummaryText}

🌸 **АНИМЕ**:
${animeSummaryText}

ТРЕБОВАНИЯ К ВЕРДИКТУ:
1. **Суть и Стиль**: Сразу же, с первого предложения, дай глубокую, теплую характеристику его вкуса. Опиши его как человека, который ценит не просто поверхностные зрелища, а ищет в историях глубокий смысл, эмоциональный резонанс и интеллектуальное стимулирование.
2. **Персонализация**: Вплети в текст упоминание 1-2 его самых любимых картин с оценкой 10/10 или отметкой "Любимое" (например, шедевры Нолана, Тарантино или Скорсезе), подчеркнув, почему именно они отражают его характер. Тонко сбалансируй это с его интересом к сериалам или аниме из его списка (если они есть).
3. **Безопасность (КРИТИЧЕСКИ ВАЖНО)**: Категорически запрещено использовать слова: "убить", "смерть", "убийство", "криминал", "насилие", "наркотики", "оружие" и любые производные от них (даже если они есть в названиях фильмов — заменяй их на описательные синонимы, например "знаменитая дилогия Тарантино" или "история о восхождении к власти"). Используй только благородные, кинематографические синонимы: "динамичный сюжет", "противостояние характеров", "эмоциональная дуэль", "жизненный путь", "авторский стиль", "сложные выборы".
4. **Формат**: Никаких заголовков, никаких пунктов, никаких разделов. Только один слитный, невероятно красивый, емкий и вдохновляющий текст (около 150-220 слов), который читается на одном дыхании и оставляет сильное впечатление!`;

    // Fetch call to Gemini REST API endpoint using the high-speed gemini-2.5-flash model
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 8192
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE"
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", errText);
      throw new Error(`Google API returned status ${response.status}`);
    }

    const data = await response.json();
    
    if (
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts
    ) {
      const summaryText = data.candidates[0].content.parts
        .map(part => part.text || "")
        .join("")
        .trim();
      
      if (!summaryText) {
        throw new Error("Нейросеть вернула пустой результат.");
      }

      return res.status(200).json({ summary: summaryText });
    } else {
      console.error("Unexpected Gemini API response structure:", JSON.stringify(data));
      throw new Error("Не удалось разобрать ответ от Gemini API.");
    }
  } catch (error) {
    console.error("Taste analysis server error:", error);
    return res.status(500).json({
      error: "Произошла техническая ошибка при анализе вкусов нейросетью. Попробуйте еще раз позже."
    });
  }
}
