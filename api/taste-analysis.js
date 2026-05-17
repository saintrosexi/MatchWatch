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

    const prompt = `Ты — невероятно наблюдательный, близкий друг пользователя, который отлично разбирается в кино и знает толк в хороших историях. Тебе нужно составить глубокий, детальный и честный кинематографический портрет по его вкусам.
Анализ должен быть написан живым, разговорным, человеческим и абсолютно оригинальным языком, БЕЗ сухих шаблонных фраз и рецензионных клише, чтобы полностью избежать сходства с опубликованными в интернете статьями (это критично для прохождения фильтров).
Начинай отчет сразу с сути, общайся тепло, дружески, но с огромным знанием дела!

Вот списки просмотренных пользователем картин, сгруппированные по категориям, с его оценками (1-10) и отметками "Любимое" (если есть):

🎬 **ФИЛЬМЫ**:
${moviesSummaryText}

📺 **СЕРИАЛЫ**:
${seriesSummaryText}

🌸 **АНИМЕ**:
${animeSummaryText}

КРИТИЧЕСКИ ВАЖНЫЕ ТРЕБОВАНИЯ К ОТЧЕТУ:
1. **Структура**: Отчет должен состоять строго из 5 подробных разделов. Каждый раздел должен быть детальным, содержать конкретный разбор названий и оценок из списков выше.
2. **Раздельный анализ категорий**:
   - Отдельно разбери категорию ФИЛЬМЫ: выдели яркие жанровые черты, проанализируй любимые картины (например, с оценками 9-10 или пометкой [В ИЗБРАННОМ]) и картины, оцененные ниже (например, на 6/10).
   - Отдельно разбери категорию СЕРИАЛЫ (если в списке есть сериалы): проанализируй, какие сюжеты привлекают пользователя в сериальном формате, упоминая конкретные тайтлы и их оценки. Если сериалов нет, кратко напиши, почему пользователь, вероятно, предпочитает емкий полный метр длинным сериальным аркам.
   - Отдельно разбери категорию АНИМЕ (если в списке есть аниме): проанализируй японскую анимацию в профиле, сравни аниме-тайтлы с обычным кино в его вкусах, упоминая конкретные названия и оценки. Если аниме нет, напиши остроумное замечание о том, почему пользователь пока обходит стороной этот формат.
3. **Разбор Оценок и Контраста**: Выдели целый раздел под анализ личных оценок пользователя. Сравни фильм/сериал/аниме, которому он поставил 10/10 (или добавил в Любимое), с картиной, которая получила 6/10 или 5/10. Детально опиши разницу: почему первый шедевр покорил его, а второй оказался провалом (например: плоские диалоги, клише, нераскрытые персонажи в картине с оценкой 6 по сравнению с глубиной картины на 10).
4. **Объем**: Текст должен быть большим, насыщенным фактами и терминами (не менее 350-500 слов), чтобы это ощущалось как солидный, экспертный разбор, а не банальная отписка в 2 строчки.
5. **Завершенность**: Не обрывай предложения, пиши грамотно, структурировано.

ОФОРМИ ОТЧЕТ СТРОГО ПО ЭТОМУ ШАБЛОНУ (заполни каждый раздел подробным контентом):

### 🎬 РАЗДЕЛ 1: Полнометражный кинематограф (Фильмы)
[Подробный анализ фильмов пользователя с названиями и оценками]

### 📺 РАЗДЕЛ 2: Многосерийные драмы и шоу (Сериалы)
[Подробный анализ сериалов пользователя с названиями и оценками]

### 🌸 РАЗДЕЛ 3: Мир рисованных историй (Аниме)
[Подробный анализ аниме пользователя с названиями и оценками]

### ⚖️ РАЗДЕЛ 4: Препарирование оценок (Контраст 10 против 6)
[Подробный контрастный разбор конкретных фильмов с высокими и низкими баллами]

### 🏆 РАЗДЕЛ 5: Итоговый кинокритический вердикт
[Экспертное резюме профиля пользователя]`;

    // Fetch call to Gemini REST API endpoint using the advanced gemini-2.5-pro model
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
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
