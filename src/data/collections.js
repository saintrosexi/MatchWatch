// MatchWatch — Curated Entertainment Collections (Movies, TV Series, Anime)

export const curatedCollections = [
  // =================== MOVIES ===================
  {
    id: "twenty-first-century",
    category: "movie",
    title: "Главные шедевры XXI века",
    subtitle: "Фильмы, определившие современный кинематограф",
    cover: "https://kinopoiskapiunofficial.tech/images/posters/kp/326.jpg",
    accent: "#ff5e62",
    badge: "🔥 Топ кино",
    filter: (m) => m.year >= 2000 && m.rating >= 8.2 && (!m.genres?.includes('Аниме') && !m.genres?.includes('аниме') && !m.duration?.includes('сезон'))
  },
  {
    id: "neon-noir",
    category: "movie",
    title: "Неоновый нуар & Киберпанк",
    subtitle: "Дождь, синтезаторы, голограммы и мрачные тайны",
    cover: "https://kinopoiskapiunofficial.tech/images/posters/kp/589290.jpg",
    accent: "#ff9966",
    badge: "🌃 Стиль & Атмосфера",
    filter: (m) => (m.genres?.includes("Фантастика") || m.genres?.includes("Триллер") || m.genres?.includes("Криминал")) && (m.sensationVector?.darkness >= 6)
  },
  {
    id: "mind-twisters",
    category: "movie",
    title: "Фильмы с разрывом шаблона",
    subtitle: "Финал, который вы ни за что не угадаете",
    cover: "https://kinopoiskapiunofficial.tech/images/posters/kp/447301.jpg",
    accent: "#bf5af2",
    badge: "🧠 10/10 Интеллект",
    filter: (m) => (m.sensationVector?.intellect >= 8 || m.titleRu?.includes("Начало") || m.titleRu?.includes("Остров проклятых") || m.titleRu?.includes("Престиж"))
  },
  {
    id: "adrenaline-rush",
    category: "movie",
    title: "Чистый адреналин",
    subtitle: "Погони, драки и непрерывный драйв без пауз",
    cover: "https://kinopoiskapiunofficial.tech/images/posters/kp/450213.jpg",
    accent: "#ff5e62",
    badge: "⚡ 100% Энергия",
    filter: (m) => (m.sensationVector?.dynamism >= 8 || m.sensationVector?.energy >= 8) && m.genres?.includes("Боевик")
  },
  {
    id: "oscar-royale",
    category: "movie",
    title: "Лауреаты премии «Оскар»",
    subtitle: "Признанное мировое величие и актерский триумф",
    cover: "https://kinopoiskapiunofficial.tech/images/posters/kp/325.jpg",
    accent: "#ffd60a",
    badge: "🏆 Премиальная классика",
    filter: (m) => m.rating >= 8.3
  },

  // =================== TV SERIES ===================
  {
    id: "series-hall-of-fame",
    category: "series",
    title: "Зал славы сериалов",
    subtitle: "Шедевры, которые смотрят залпом сезон за сезоном",
    cover: "https://kinopoiskapiunofficial.tech/images/posters/kp/404900.jpg",
    accent: "#ff9966",
    badge: "📺 Культовые хиты",
    filter: (m) => (m.duration?.includes('сезон') || m.genres?.includes('сериал') || m.genres?.includes('Сериал') || m.year >= 2008) && m.rating >= 8.0
  },
  {
    id: "series-dark-thrillers",
    category: "series",
    title: "Мрачные детективные саги",
    subtitle: "Настоящий детектив, запутанные расследования и нуар",
    cover: "https://kinopoiskapiunofficial.tech/images/posters/kp/681849.jpg",
    accent: "#64d2ff",
    badge: "🕵️ Захватывающий сюжет",
    filter: (m) => (m.genres?.includes('Детектив') || m.genres?.includes('Криминал') || m.genres?.includes('Триллер')) && m.rating >= 7.8
  },
  {
    id: "series-weekend-binge",
    category: "series",
    title: "Мини-сериалы на выходные",
    subtitle: "Законченные истории с невероятным накалом страстей",
    cover: "https://kinopoiskapiunofficial.tech/images/posters/kp/1227967.jpg",
    accent: "#32d74b",
    badge: "⏱ Идеально на уикенд",
    filter: (m) => m.rating >= 8.1
  },

  // =================== ANIME ===================
  {
    id: "anime-miyazaki-magic",
    category: "anime",
    title: "Магия Хаяо Миядзаки & Ghibli",
    subtitle: "Унесенные призраками, Ходячий замок и вечные сказки",
    cover: "https://kinopoiskapiunofficial.tech/images/posters/kp/370.jpg",
    accent: "#ffd60a",
    badge: "⛩ Вечные шедевры",
    filter: (m) => (m.genres?.includes('аниме') || m.genres?.includes('Аниме') || (m.country?.includes('Япония') && m.genres?.includes('мультфильм')))
  },
  {
    id: "anime-shonen-drive",
    category: "anime",
    title: "Легендарный экшн & Сёнэн",
    subtitle: "Эпические битвы, сила воли и адреналин",
    cover: "https://kinopoiskapiunofficial.tech/images/posters/kp/748554.jpg",
    accent: "#ff5e62",
    badge: "⚔️ Драйв & Битвы",
    filter: (m) => (m.genres?.includes('аниме') || m.genres?.includes('Аниме') || m.country?.includes('Япония')) && (m.sensationVector?.energy >= 7 || m.genres?.includes('Боевик'))
  },
  {
    id: "anime-mindfuck-thrillers",
    category: "anime",
    title: "Психологический нуар & Тайны",
    subtitle: "Тетрадь смерти, Евангелион и игры разума",
    cover: "https://kinopoiskapiunofficial.tech/images/posters/kp/406148.jpg",
    accent: "#bf5af2",
    badge: "🧠 Игры разума",
    filter: (m) => (m.genres?.includes('аниме') || m.genres?.includes('Аниме') || m.country?.includes('Япония')) && (m.sensationVector?.intellect >= 7 || m.sensationVector?.darkness >= 6)
  }
];
