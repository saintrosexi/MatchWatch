// MatchWatch 3 — Interactive Cine-Mood Matrix Presets
export const cineMoods = [
  {
    id: "popcorn-drive",
    title: "Попкорн & Драйв",
    subtitle: "Безумный экшн, адреналин и чистый кайф",
    icon: "🍿",
    gradient: "linear-gradient(135deg, #ff4757, #ff6b81)",
    accentColor: "#ff4757",
    sensationVector: { energy: 9, darkness: 4, intellect: 4, emotion: 6, dynamism: 10 },
    genres: ["Боевик", "Приключения", "Фантастика", "Комедия"],
    tags: ["Высокий темп", "Спецэффекты", "Аттракцион"]
  },
  {
    id: "mindfuck",
    title: "Мозговой штурм",
    subtitle: "Закрученный сюжет, твисты и головоломки",
    icon: "🧠",
    gradient: "linear-gradient(135deg, #8b5cf6, #6366f1)",
    accentColor: "#8b5cf6",
    sensationVector: { energy: 6, darkness: 7, intellect: 10, emotion: 7, dynamism: 6 },
    genres: ["Триллер", "Детектив", "Фантастика", "Драма"],
    tags: ["Непредсказуемый финал", "Философия", "Сложный сюжет"]
  },
  {
    id: "emotional-warmth",
    title: "Согреться и поплакать",
    subtitle: "Глубокие чувства, катарсис и искренность",
    icon: "😭",
    gradient: "linear-gradient(135deg, #ec4899, #f43f5e)",
    accentColor: "#ec4899",
    sensationVector: { energy: 4, darkness: 5, intellect: 6, emotion: 10, dynamism: 4 },
    genres: ["Драма", "Мелодрама", "Биография"],
    tags: ["До слёз", "Душевно", "Жизненно"]
  },
  {
    id: "cozy-evening",
    title: "Уютный ламповый вечер",
    subtitle: "Тёплая атмосфера, улыбки и ноль стресса",
    icon: "🕯",
    gradient: "linear-gradient(135deg, #f59e0b, #fbbf24)",
    accentColor: "#f59e0b",
    sensationVector: { energy: 4, darkness: 2, intellect: 5, emotion: 7, dynamism: 4 },
    genres: ["Комедия", "Семейный", "Мультфильм", "Приключения"],
    tags: ["Добрый юмор", "Эстетика", "Релакс"]
  },
  {
    id: "chilling-horror",
    title: "Леденящий хоррор",
    subtitle: "Тьма, саспенс и ледяной ужас до мурашек",
    icon: "😱",
    gradient: "linear-gradient(135deg, #dc2626, #7f1d1d)",
    accentColor: "#dc2626",
    sensationVector: { energy: 8, darkness: 10, intellect: 5, emotion: 8, dynamism: 7 },
    genres: ["Ужасы", "Триллер", "Мистика"],
    tags: ["Саспенс", "Мрачная атмосфера", "Монстры & Тайны"]
  },
  {
    id: "space-odyssey",
    title: "В другую галактику",
    subtitle: "Космос, будущее, киберпанк и масштабы",
    icon: "🚀",
    gradient: "linear-gradient(135deg, #06b6d4, #3b82f6)",
    accentColor: "#06b6d4",
    sensationVector: { energy: 7, darkness: 6, intellect: 8, emotion: 7, dynamism: 8 },
    genres: ["Фантастика", "Приключения", "Боевик"],
    tags: ["Космос", "AI & Будущее", "Масштаб"]
  },
  {
    id: "date-night",
    title: "Кино для свидания",
    subtitle: "Химия между героями, романтика и стиль",
    icon: "🍷",
    gradient: "linear-gradient(135deg, #f43f5e, #be185d)",
    accentColor: "#f43f5e",
    sensationVector: { energy: 5, darkness: 3, intellect: 6, emotion: 9, dynamism: 5 },
    genres: ["Мелодрама", "Комедия", "Драма"],
    tags: ["Романтика", "Диалоги", "Страсть"]
  }
];
