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
    // Construct a highly detailed prompt summarizing the user's movie selection with scores and favorites
    const moviesSummary = likedMovies
      .map(m => {
        const typeRu = m.type === "series" ? "сериал" : m.type === "anime" ? "аниме" : "фильм";
        const ratingStr = m.personalRating ? `, личная оценка пользователя: ${m.personalRating}/10` : "";
        const favStr = m.isFavorite ? " (ВЫБРАН ПОЛЬЗОВАТЕЛЕМ КАК САМЫЙ ЛЮБИМЫЙ)" : "";
        return `- ${typeRu} «${m.titleRu || m.title}» (${m.year}г.), жанры: ${m.genres || "разные"}, режиссер: ${m.director || "неизвестно"}${ratingStr}${favStr}`;
      })
      .join("\n");

    const prompt = `Ты — профессиональный, бескомпромиссный, невероятно наблюдательный и авторитетный кинокритик с глубоким пониманием психологии кино.
Твоя задача — составить подробный, психологически точный и глубокий критический разбор киновкусов пользователя на основе конкретных оценок и любимых фильмов, которые он выбрал.

Вот список того, что лайкнул пользователь (с указанием его личных оценок по шкале 1-10 и отметкой, если фильм добавлен в супер-избранное):
${moviesSummary}

КРИТИЧЕСКИ ВАЖНЫЕ ТРЕБОВАНИЯ:
1. ИСКЛЮЧИ ЛЮБУЮ ВОДЯНИСТУЮ И БАНАЛЬНУЮ ЛЕСТЬ. Никаких общих пафосных фраз в духе "какой дивный многогранный список", "целая панорама чувств", "эмоции и смыслы". Начни разбор сходу, строго и по делу, с профессионального тона матерого кинокритика.
2. БУДЬ МАКСИМАЛЬНО КОНКРЕТЕН. Называй конкретные фильмы из списка!
3. АНАЛИЗИРУЙ КОНТРАСТ ОЦЕНОК (ЭТО ГЛАВНОЕ!):
   - Обязательно выдели те картины, которые помечены как "ВЫБРАН ПОЛЬЗОВАТЕЛЕМ КАК САМЫЙ ЛЮБИМЫЙ" или которым он поставил 10/10 или 9/10. Объясни с точки зрения киноискусства, за какую именно художественную ценность (сценарий, саундтрек, психологизм, режиссуру) пользователь полюбил эти фильмы.
   - Обязательно найди в списке фильмы с оценками 6/10, 5/10 или просто самые низкие в списке. Остроумно предположи, почему эти картины не оправдали его ожиданий (например: "Вы дали фильму X всего 6 баллов, потому что его поверхностный экшен и дыры в сценарии не могут сравниться с интеллектуальной глубиной Y, которую вы оценили на 10").
4. Сделай текст развернутым и вдумчивым (3-4 полноценных абзаца, примерно 200-350 слов), разбитым на следующие разделы с эмодзи:

✨ **Ваш кинокритический профиль**:
Характеристика киновкуса пользователя без банальностей. Назови его кино-архетип (например: "Экзистенциальный эстет", "Аналитик структуры и психологизма" или "Искатель искренней визуальной поэзии").

🎬 **Анатомия ваших восторгов (Оценки 9-10 и Избранное)**:
Разбор его абсолютных фаворитов с детальным упоминанием названий фильмов, их режиссеров и тем. За что именно они получили высший балл?

🔎 **Где спотыкается ваш интерес (Оценки 6 и ниже)**:
Предельно конкретный разбор того, почему определенные фильмы из списка получили низкие оценки. Что именно оттолкнуло в них пользователя? (Плоский сюжет, дешевые клише, вторичность). Обязательно упомяни названия этих фильмов!

🏆 **Вердикт**:
Финальная емкая рекомендация или остроумный вывод.

Убедись, что текст абсолютно полный, завершенный, ни в коем случае не обрывается и не содержит недописанных слов. Заканчивай каждую мысль логической точкой.`;

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
            maxOutputTokens: 1200
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
