// MatchWatch — Curated Cinema Collections (100% Movies)

export const curatedCollections = [
  {
    id: "twenty-first-century",
    category: "movie",
    title: "Главные шедевры XXI века",
    subtitle: "Фильмы, определившие современный кинематограф",
    cover: "https://image.tmdb.org/t/p/w500/yvmKPlTIi0xdcFQIFcQKQJcI63W.jpg",
    accent: "#ff5e62",
    badge: "🔥 Топ кино",
    filter: (m) => m.year >= 2000 && m.rating >= 8.0
  },
  {
    id: "neon-noir",
    category: "movie",
    title: "Неоновый нуар & Киберпанк",
    subtitle: "Дождь, синтезаторы, голограммы и мрачные тайны",
    cover: "https://image.tmdb.org/t/p/w500/vReLRjDV9XPhiOSEW7QWow4DXwf.jpg",
    accent: "#ff9966",
    badge: "🌃 Стиль & Атмосфера",
    filter: (m) => (m.genres?.includes("Фантастика") || m.genres?.includes("Триллер") || m.genres?.includes("Криминал")) && (m.sensationVector?.darkness >= 6)
  },
  {
    id: "mind-twisters",
    category: "movie",
    title: "Фильмы с разрывом шаблона",
    subtitle: "Финал, который вы ни за что не угадаете",
    cover: "https://image.tmdb.org/t/p/w500/66RvLrRJTm4J8l3uHXWF09AICol.jpg",
    accent: "#bf5af2",
    badge: "🧠 10/10 Интеллект",
    filter: (m) => (m.sensationVector?.intellect >= 8 || m.titleRu?.includes("Начало") || m.titleRu?.includes("Остров проклятых") || m.titleRu?.includes("Престиж") || m.titleRu?.includes("Помни"))
  },
  {
    id: "adrenaline-rush",
    category: "movie",
    title: "Чистый адреналин & Драйв",
    subtitle: "Погони, перестрелки и непрерывный экшн без пауз",
    cover: "https://image.tmdb.org/t/p/w500/piQXcdOGgv1O9HQ07pI0tnjkGJw.jpg",
    accent: "#ff5e62",
    badge: "⚡ 100% Энергия",
    filter: (m) => (m.sensationVector?.dynamism >= 8 || m.sensationVector?.energy >= 8) && m.genres?.includes("Боевик")
  },
  {
    id: "oscar-royale",
    category: "movie",
    title: "Лауреаты премии «Оскар»",
    subtitle: "Признанное мировое величие и актерский триумф",
    cover: "https://image.tmdb.org/t/p/w500/8tABrG6z0jA4vd9q5d2a9k7.jpg",
    accent: "#ffd60a",
    badge: "🏆 Премиальная классика",
    filter: (m) => m.rating >= 8.2
  },
  {
    id: "crime-sagas",
    category: "movie",
    title: "Криминальные саги & Мафия",
    subtitle: "Крёстный отец, Славные парни, Лицо со шрамом",
    cover: "https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
    accent: "#ff453a",
    badge: "🎩 Культовая классика",
    filter: (m) => m.genres?.includes("Криминал") || m.genres?.includes("Драма") && m.sensationVector?.darkness >= 6
  },
  {
    id: "comedy-gold",
    category: "movie",
    title: "Комедии для отличного вечера",
    subtitle: "Лёгкий юмор, искренний смех и душевные истории",
    cover: "https://image.tmdb.org/t/p/w500/yF1xDaoirZ35bbt59SAymv9b4.jpg",
    accent: "#30d158",
    badge: "🍿 100% Позитив",
    filter: (m) => m.genres?.includes("Комедия")
  },
  {
    id: "sci-fi-odyssey",
    category: "movie",
    title: "Космическая одиссея & Научная фантастика",
    subtitle: "Путешествия сквозь время, пространство и измерения",
    cover: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    accent: "#64d2ff",
    badge: "🚀 Космос & Будущее",
    filter: (m) => m.genres?.includes("Фантастика") || m.genres?.includes("Приключения")
  }
];
