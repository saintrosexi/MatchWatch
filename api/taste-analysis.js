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
    // Construct a highly detailed prompt summarizing the user's movie selection
    const moviesSummary = likedMovies
      .map(m => {
        const typeRu = m.type === "series" ? "сериал" : m.type === "anime" ? "аниме" : "фильм";
        return `- ${typeRu} «${m.titleRu || m.title}» (${m.year}г.), жанры: ${m.genres || "разные"}, режиссер/автор: ${m.director || "неизвестно"}`;
      })
      .join("\n");

    const prompt = `Ты — профессиональный, харизматичный и невероятно эрудированный кинокритик. 
Твоя задача — составить яркий, живой и глубокий психологический портрет киновкусов пользователя на основе списка фильмов, сериалов и аниме, которые ему понравились.

Вот список того, что лайкнул пользователь:
${moviesSummary}

Напиши сочный кинокритический анализ его вкусов (ровно от 3 до 5 предложений). 
Требования к тексту:
1. Пиши на русском языке, в дружелюбном, уважительном, но остроумном и авторитетном тоне.
2. Не используй скучные банальные фразы типа "вам нравятся разные жанры". Вместо этого ищи неочевидные связи (например, если есть Нолан — упомяни любовь к временным петлям; если есть аниме Гибли — упомяни эстетику японской анимации и сказочную теплоту; если есть классика драмы — упомяни верность сильным человеческим историям и эмоциональной глубине).
3. Начни текст с интригующего приветствия (например, "✨ Ваш киновкус — это настоящий манифест..." или "✨ Ваш профиль выдает в вас истинного...").
4. Избегай спойлеров. Сделай так, чтобы пользователь улыбнулся и почувствовал себя настоящим эстетом.`;

    // Fetch call to Gemini REST API endpoint
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
            maxOutputTokens: 500
          }
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
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
    ) {
      const summaryText = data.candidates[0].content.parts[0].text.trim();
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
