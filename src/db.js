// Встроенная база данных с фильмами (все фотки как base64 data URLs внутри проекта)
export const moviesDB = [
  {
    id: 1,
    title: "The Shawshank Redemption",
    year: 1994,
    rating: 9.2,
    poster: require('./images/shawshank.jpg').default,
    description: "Заключённый Энди Дюфрейн пытается сохранить надежду и человечность, сталкиваясь с жестокостью тюрьмы Шоушенк."
  },
  {
    id: 2,
    title: "The Godfather",
    year: 1972,
    rating: 9.1,
    poster: require('./images/godfather.jpg').default,
    description: "История семьи Корлеоне, которая сталкивается с предательством, властью и борьбой за влияние в криминальном мире."
  },
  {
    id: 3,
    title: "The Dark Knight",
    year: 2008,
    rating: 9.0,
    poster: require('./images/darkknight.jpg').default,
    description: "Бэтмен противостоит Джокеру, преступнику, который стремится разрушить Готэм, используя хаос как оружие."
  },
  {
    id: 4,
    title: "12 Angry Men",
    year: 1957,
    rating: 9.0,
    poster: require('./images/12angry.jpg').default,
    description: "Двенадцать присяжных обсуждают судьбу обвиняемого, и один человек пытается убедить остальных пересмотреть доказательства."
  },
  {
    id: 5,
    title: "Schindler's List",
    year: 1993,
    rating: 8.9,
    poster: require('./images/schindler.jpg').default,
    description: "Оскар Шиндлер спасает более тысячи евреев во время Холокоста, рискуя собственной жизнью."
  },
  {
    id: 6,
    title: "Pulp Fiction",
    year: 1994,
    rating: 8.9,
    poster: require('./images/pulpfiction.jpg').default,
    description: "Несколько историй о гангстерах, боксере, гангстерской жене и паре бандитов в городе Лос-Анджелесе."
  },
  {
    id: 7,
    title: "Inception",
    year: 2010,
    rating: 8.8,
    poster: require('./images/inception.jpg').default,
    description: "Вор, умеющий проникать в подсознание людей во время сна, получает возможность изменить будущее влиятельного человека."
  },
  {
    id: 8,
    title: "Forrest Gump",
    year: 1994,
    rating: 8.8,
    poster: require('./images/forrest.jpg').default,
    description: "История жизни человека с низким IQ, который волей судьбы становится участником важных событий американской истории."
  },
  {
    id: 9,
    title: "The Matrix",
    year: 1999,
    rating: 8.7,
    poster: require('./images/matrix.jpg').default,
    description: "Хакер обнаруживает, что его мир на самом деле развитая симуляция, созданная разумными машинами."
  },
  {
    id: 10,
    title: "Interstellar",
    year: 2014,
    rating: 8.6,
    poster: require('./images/interstellar.jpg').default,
    description: "Группа астронавтов путешествует через кротовую нору в попытке найти новую планету для человечества."
  }
];
