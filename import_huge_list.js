const fs = require('fs');
const https = require('https');

// Список от пользователя
const seriesList = [
  { k: "Во все тяжкие", y: 2008, type: "series", id: 404900 },
  { k: "Игра престолов", y: 2011, type: "series", id: 464963 },
  { k: "Чернобыль", y: 2019, type: "series", id: 1227288 },
  { k: "Клан Сопрано", y: 1999, type: "series", id: 77271 },
  { k: "Прослушка", y: 2002, type: "series", id: 402937 },
  { k: "Братья по оружию", y: 2001, type: "series", id: 76084 },
  { k: "Настоящий детектив", y: 2014, type: "series", id: 681831 },
  { k: "Друзья", y: 1994, type: "series", id: 77044 },
  { k: "Офис", y: 2005, type: "series", id: 253245 },
  { k: "Шерлок", y: 2010, type: "series", id: 502838 },
  { k: "Лучше звоните Солу", y: 2015, type: "series", id: 804686 },
  { k: "Очень странные дела", y: 2016, type: "series", id: 915196 },
  { k: "Острые козырьки", y: 2013, type: "series", id: 737396 },
  { k: "Доктор Хаус", y: 2004, type: "series", id: 178710 },
  { k: "Фарго", y: 2014, type: "series", id: 767379 },
  { k: "Черное зеркало", y: 2011, type: "series", id: 651230 },
  { k: "Пацаны", y: 2019, type: "series", id: 1040306 },
  { k: "Твин Пикс", y: 1990, type: "series", id: 84227 },
  { k: "Декстер", y: 2006, type: "series", id: 277537 },
  { k: "Аркейн", y: 2021, type: "series", id: 1309707 },
  { k: "Наследники", y: 2018, type: "series" },
  { k: "Нарко", y: 2015, type: "series" },
  { k: "Светлячок", y: 2002, type: "series" },
  { k: "Рим", y: 2005, type: "series" },
  { k: "Охотник за разумом", y: 2017, type: "series" },
  { k: "Тьма", y: 2017, type: "series" },
  { k: "Дрянь", y: 2016, type: "series" },
  { k: "Безумцы", y: 2007, type: "series" },
  { k: "Остаться в живых", y: 2004, type: "series" },
  { k: "Дом Дракона", y: 2022, type: "series" },
  { k: "Одни из нас", y: 2023, type: "series" },
  { k: "Тед Лассо", y: 2020, type: "series" },
  { k: "Разделение", y: 2022, type: "series" },
  { k: "Гравити Фолз", y: 2012, type: "series" },
  { k: "Сверхъестественное", y: 2005, type: "series" },
  { k: "Теория большого взрыва", y: 2007, type: "series" },
  { k: "Как я встретил вашу маму", y: 2005, type: "series" },
  { k: "Бруклин 9-9", y: 2013, type: "series" },
  { k: "Ганнибал", y: 2013, type: "series" },
  { k: "Мир Дикого Запада", y: 2016, type: "series" },
  { k: "Викинги", y: 2013, type: "series" },
  { k: "Сыны анархии", y: 2008, type: "series" },
  { k: "Подпольная империя", y: 2010, type: "series" },
  { k: "Гордость и предубеждение", y: 1995, type: "series" },
  { k: "Секретные материалы", y: 1993, type: "series" },
  { k: "Блудливая Калифорния", y: 2007, type: "series" },
  { k: "Бесстыжие", y: 2011, type: "series" },
  { k: "Гоморра", y: 2014, type: "series" },
  { k: "Мандалорец", y: 2019, type: "series" },
  { k: "Конь БоДжек", y: 2014, type: "series" },
  { k: "Рик и Морти", y: 2013, type: "series" },
  { k: "Щит", y: 2002, type: "series" },
  { k: "Правосудие", y: 2010, type: "series" },
  { k: "Клиника", y: 2001, type: "series" },
  { k: "Дэдвуд", y: 2004, type: "series" },
  { k: "Аббатство Даунтон", y: 2010, type: "series" },
  { k: "Клиент всегда мертв", y: 2001, type: "series" },
  { k: "Корона", y: 2016, type: "series" },
  { k: "Удивительная миссис Мейзел", y: 2017, type: "series" },
  { k: "Утопия", y: 2013, type: "series" },
  { k: "Побег", y: 2005, type: "series" },
  { k: "Медведь", y: 2022, type: "series" },
  { k: "Оставленные", y: 2014, type: "series" },
  { k: "Карточный домик", y: 2013, type: "series" },
  { k: "Гранд Тур", y: 2016, type: "series" },
  { k: "Убийство", y: 2011, type: "series" },
  { k: "Барри", y: 2018, type: "series" },
  { k: "Большая маленькая ложь", y: 2017, type: "series" },
  { k: "Ходячие мертвецы", y: 2010, type: "series" },
  { k: "Миллиарды", y: 2016, type: "series" },
  { k: "Рэй Донован", y: 2013, type: "series" },
  { k: "Сёгун", y: 2024, type: "series" },
  { k: "Озарк", y: 2017, type: "series" },
  { k: "Менталист", y: 2008, type: "series" },
  { k: "Борджиа", y: 2011, type: "series" },
  { k: "Каратель", y: 2017, type: "series" },
  { k: "Сорвиголова", y: 2015, type: "series" },
  { k: "Спартак: Кровь и песок", y: 2010, type: "series" },
  { k: "Мост", y: 2011, type: "series" },
  { k: "Убийство на пляже", y: 2013, type: "series" },
  { k: "Двойник", y: 2017, type: "series" },
  { k: "Мистер Робот", y: 2015, type: "series" },
  { k: "Экспансия", y: 2015, type: "series" },
  { k: "Родина", y: 2011, type: "series" },
  { k: "Табу", y: 2017, type: "series" },
  { k: "Крах", y: 2013, type: "series" },
  { k: "Джентльмены", y: 2024, type: "series" },
  { k: "11.22.63", y: 2016, type: "series" },
  { k: "Рэйк", y: 2010, type: "series" },
  { k: "Половое воспитание", y: 2019, type: "series" },
  { k: "Американская история преступлений", y: 2016, type: "series" },
  { k: "Молодой Папа", y: 2016, type: "series" },
  { k: "Парки и зоны отдыха", y: 2009, type: "series" },
  { k: "Два с половиной человека", y: 2003, type: "series" },
  { k: "Люцифер", y: 2016, type: "series" },
  { k: "Касл", y: 2009, type: "series" },
  { k: "Компьютерщики", y: 2006, type: "series" },
  { k: "Белый воротничок", y: 2009, type: "series" },
  { k: "Форс-мажоры", y: 2011, type: "series" },
  { k: "Обмани меня", y: 2009, type: "series" },
];

const animeList = [
  { k: "Атака титанов", y: 2013, type: "anime", id: 748226 },
  { k: "Тетрадь смерти", y: 2006, type: "anime", id: 406148 },
  { k: "Стальной алхимик: Братство", y: 2009, type: "anime", id: 461533 },
  { k: "Ковбой Бибоп", y: 1998, type: "anime", id: 79244 },
  { k: "Унесенные призраками", y: 2001, type: "anime", id: 370 },
  { k: "Ходячий замок", y: 2004, type: "anime", id: 49684 },
  { k: "Принцесса Мононоке", y: 1997, type: "anime", id: 8173 },
  { k: "Твоё имя", y: 2016, type: "anime", id: 958722 },
  { k: "Ванпанчмен", y: 2015, type: "anime", id: 896351 },
  { k: "Врата Штейна", y: 2011, type: "anime", id: 574229 },
  { k: "Хантер х Хантер", y: 2011, type: "anime", id: 614055 },
  { k: "Евангелион", y: 1995, type: "anime", id: 258525 },
  { k: "Клинок, рассекающий демонов", y: 2019, type: "anime", id: 1228271 },
  { k: "Магическая битва", y: 2020, type: "anime", id: 1386280 },
  { k: "Код Гиас", y: 2006, type: "anime", id: 403610 },
  { k: "Наруто", y: 2002, type: "anime", id: 161002 },
  { k: "Ван-Пис", y: 1999, type: "anime", id: 175140 },
  { k: "Сага о Винланде", y: 2019, type: "anime", id: 1146740 },
  { k: "Киберпанк: Бегущие по краю", y: 2022, type: "anime", id: 1391515 },
  { k: "Наруто: Ураганные хроники", y: 2007, type: "anime", id: 403635 },
  { k: "Блич: Тысячелетняя кровавая война", y: 2022, type: "anime" },
  { k: "Гинтама", y: 2006, type: "anime" },
  { k: "Монстр", y: 2004, type: "anime" },
  { k: "Первый шаг", y: 2000, type: "anime" },
  { k: "Самурай Чамплу", y: 2004, type: "anime" },
  { k: "Моб Психо 100", y: 2016, type: "anime" },
  { k: "Вайолет Эвергарден", y: 2018, type: "anime" },
  { k: "Человек-бензопила", y: 2022, type: "anime" },
  { k: "Созданный в Бездне", y: 2017, type: "anime" },
  { k: "Волейбол!!", y: 2014, type: "anime" },
  { k: "Твоя апрельская ложь", y: 2014, type: "anime" },
  { k: "Город, в котором меня нет", y: 2016, type: "anime" },
  { k: "Берсерк", y: 1997, type: "anime" },
  { k: "Мастер Муси", y: 2005, type: "anime" },
  { k: "Крутой учитель Онидзука", y: 1999, type: "anime" },
  { k: "Психопаспорт", y: 2012, type: "anime" },
  { k: "Тетрадь дружбы Нацумэ", y: 2008, type: "anime" },
  { k: "Семья шпиона", y: 2022, type: "anime" },
  { k: "Навсикая из Долины ветров", y: 1984, type: "anime" },
  { k: "Форма голоса", y: 2016, type: "anime" },
  { k: "Дороро", y: 2019, type: "anime" },
  { k: "Токийский гуль", y: 2014, type: "anime" },
  { k: "Семь смертных грехов", y: 2014, type: "anime" },
  { k: "Хвост Феи", y: 2009, type: "anime" },
  { k: "Паразит: Учение о жизни", y: 2014, type: "anime" },
  { k: "Добро пожаловать в класс превосходства", y: 2017, type: "anime" },
  { k: "Бездомный бог", y: 2014, type: "anime" },
  { k: "Класс убийц", y: 2015, type: "anime" },
  { k: "Баскетбол Куроко", y: 2012, type: "anime" },
  { k: "Синий экзорцист", y: 2011, type: "anime" },
  { k: "Мастера Меча Онлайн", y: 2012, type: "anime" },
  { k: "Госпожа Кагуя: в любви как на войне", y: 2019, type: "anime" },
  { k: "Горизонт посреди пустоты", y: 2011, type: "anime" },
  { k: "Этот замечательный мир!", y: 2016, type: "anime" },
  { k: "О моём перерождении в слизь", y: 2018, type: "anime" },
  { k: "Восхождение героя щита", y: 2019, type: "anime" },
  { k: "Re:Zero. Жизнь с нуля в альтернативном мире", y: 2016, type: "anime" },
  { k: "Повелитель", y: 2015, type: "anime" },
  { k: "Доктор Стоун", y: 2019, type: "anime" },
  { k: "Обещанный Неверленд", y: 2019, type: "anime" },
  { k: "Безумный азарт", y: 2017, type: "anime" },
  { k: "Черный клевер", y: 2017, type: "anime" },
  { k: "Адский рай", y: 2023, type: "anime" },
  { k: "Эхо террора", y: 2014, type: "anime" },
  { k: "91 день", y: 2016, type: "anime" },
  { k: "Пираты «Черной лагуны»", y: 2006, type: "anime" },
  { k: "Гуррен-Лаганн", y: 2007, type: "anime" },
  { k: "Милый во Франксе", y: 2018, type: "anime" },
  { k: "Корона грешника", y: 2011, type: "anime" },
  { k: "Альдноа.Зеро", y: 2014, type: "anime" },
  { k: "Стальной алхимик", y: 2003, type: "anime" },
  { k: "Токийские мстители", y: 2021, type: "anime" },
  { k: "Проза бродячих псов", y: 2016, type: "anime" },
  { k: "Темный дворецкий", y: 2008, type: "anime" },
  { k: "Сердца Пандоры", y: 2009, type: "anime" },
  { k: "D.Gray-man", y: 2006, type: "anime" },
  { k: "Пожиратель душ", y: 2008, type: "anime" },
  { k: "Шаман Кинг", y: 2001, type: "anime" },
  { k: "Блич", y: 2004, type: "anime" },
  { k: "Юри на льду", y: 2016, type: "anime" },
  { k: "Сквозь слезы я притворяюсь кошкой", y: 2020, type: "anime" },
  { k: "Дитя погоды", y: 2019, type: "anime" },
  { k: "Сад изящных слов", y: 2013, type: "anime" },
  { k: "5 сантиметров в секунду", y: 2007, type: "anime" },
  { k: "Ловцы забытых голосов", y: 2011, type: "anime" },
  { k: "За облаками", y: 2004, type: "anime" },
  { k: "Голос далекой звезды", y: 2002, type: "anime" },
  { k: "Она и её кот", y: 1999, type: "anime" },
  { k: "Судзуме, закрывающая двери", y: 2022, type: "anime" },
  { k: "Мой сосед Тоторо", y: 1988, type: "anime" },
  { k: "Ведьмина служба доставки", y: 1989, type: "anime" },
  { k: "Небесный замок Лапута", y: 1986, type: "anime" },
  { k: "Порко Россо", y: 1992, type: "anime" },
  { k: "Могила светлячков", y: 1988, type: "anime" },
  { k: "Шепот сердца", y: 1995, type: "anime" },
  { k: "Ветер крепчает", y: 2013, type: "anime" },
  { k: "Рыбка Поньо на утесе", y: 2008, type: "anime" },
  { k: "Ариэтти из страны лилипутов", y: 2010, type: "anime" },
  { k: "Сказание о принцессе Кагуя", y: 2013, type: "anime" },
  { k: "Воспоминания о Марни", y: 2014, type: "anime" },
];

const searchTerms = [...seriesList, ...animeList];

function fetchJSON(options) {
  return new Promise((resolve) => {
    https.get(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function fetchOMDB(imdbId) {
  return fetchJSON(`https://www.omdbapi.com/?i=${imdbId}&apikey=trilogy&plot=short`);
}

function searchKP(keyword, year) {
  return fetchJSON({
    hostname: 'kinopoiskapiunofficial.tech',
    path: `/api/v2.2/films?keyword=${encodeURIComponent(keyword)}&yearFrom=${year}&yearTo=${year}&page=1`,
    headers: {
      'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
      'accept': 'application/json'
    }
  });
}

function fetchKPDetails(kpId) {
  return fetchJSON({
    hostname: 'kinopoiskapiunofficial.tech',
    path: `/api/v2.2/films/${kpId}`,
    headers: {
      'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
      'accept': 'application/json'
    }
  });
}

const GENRE_MAP = {
  'Action': 'Боевик', 'Adventure': 'Приключения', 'Animation': 'Мультфильм',
  'Biography': 'Биография', 'Comedy': 'Комедия', 'Crime': 'Криминал',
  'Documentary': 'Документальный', 'Drama': 'Драма', 'Family': 'Семейный',
  'Fantasy': 'Фэнтези', 'Film-Noir': 'Нуар', 'History': 'История',
  'Horror': 'Ужасы', 'Music': 'Музыка', 'Musical': 'Мюзикл',
  'Mystery': 'Детектив', 'Romance': 'Мелодрама', 'Sci-Fi': 'Фантастика',
  'Short': 'Короткометражный', 'Sport': 'Спорт', 'Thriller': 'Триллер',
  'War': 'Военный', 'Western': 'Вестерн'
};

function translateGenres(genreStr) {
  if (!genreStr) return '';
  return genreStr.split(', ').map(g => GENRE_MAP[g.trim()] || g.trim()).join(', ');
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('Searching and fetching details for 200 items...');
  
  let rawData = fs.readFileSync('src/data.js', 'utf8');
  const arrayStr = rawData.replace('export const movies = ', '').replace(/;\s*$/, '');
  const movies = eval('(' + arrayStr + ')');
  let nextId = Math.max(...movies.map(m => m.id)) + 1;
  
  const newMovies = [];
  
  for (const t of searchTerms) {
    let kpId = t.id;
    
    if (!kpId) {
        const searchRes = await searchKP(t.k, t.y);
        if (!searchRes || !searchRes.items || searchRes.items.length === 0) {
          console.log(`NOT FOUND: ${t.k} (${t.y})`);
          continue;
        }
        kpId = searchRes.items[0].kinopoiskId;
        await sleep(300); // rate limit
    }
    
    const kp = await fetchKPDetails(kpId);
    if (!kp) {
      console.log(`NO DETAILS FOR: ${t.k}`);
      continue;
    }
    await sleep(300);
    
    const imdbId = kp.imdbId;
    let omdb = null;
    if (imdbId) {
      omdb = await fetchOMDB(imdbId);
    }
    
    // Check if already in DB
    if (movies.find(m => m.kinopoiskId === kpId)) {
      console.log(`ALREADY IN DB: ${kp.nameRu || t.k}`);
      continue;
    }
    
    const title = omdb && omdb.Title && omdb.Title !== 'N/A' ? omdb.Title : kp.nameOriginal || kp.nameRu;
    const titleRu = kp.nameRu || title;
    const year = kp.year || (omdb && parseInt(omdb.Year)) || t.y;
    const rating = kp.ratingKinopoisk || (omdb && parseFloat(omdb.imdbRating)) || 7.0;
    let poster = omdb && omdb.Poster && omdb.Poster !== 'N/A' ? omdb.Poster.replace('SX300', 'SX500') : kp.posterUrlPreview || kp.posterUrl;
    
    let fullDesc = kp.description || (omdb && omdb.Plot) || '';
    let shortDesc = kp.shortDescription || (fullDesc.length > 300 ? fullDesc.substring(0, 297) + '...' : fullDesc);
    
    let country = 'США';
    if (kp.countries && kp.countries.length > 0) {
        country = kp.countries.map(c => c.country).join(', ');
    } else if (omdb && omdb.Country) {
        country = omdb.Country;
    }
    
    let genres = '';
    if (kp.genres && kp.genres.length > 0) {
        genres = kp.genres.map(g => g.genre).map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(', ');
    } else if (omdb && omdb.Genre) {
        genres = translateGenres(omdb.Genre);
    }
    
    const director = omdb && omdb.Director !== 'N/A' ? omdb.Director : '';
    const actors = omdb && omdb.Actors !== 'N/A' ? omdb.Actors : '';
    const duration = omdb && omdb.Runtime !== 'N/A' ? omdb.Runtime : (kp.filmLength ? kp.filmLength + ' min' : '');
    const imdbLink = imdbId ? `https://www.imdb.com/title/${imdbId}` : null;
    
    newMovies.push({
      id: nextId++,
      title,
      titleRu,
      year,
      rating,
      poster,
      description: shortDesc,
      fullDescription: fullDesc,
      country,
      genres,
      director,
      actors,
      duration,
      trailer: '',
      kinopoiskId: kpId,
      imdb: imdbLink,
      type: t.type // Добавляем тип (series или anime)
    });
    
    console.log(`Added: ${titleRu} (${t.type})`);
  }
  
  const allMovies = [...movies, ...newMovies];
  
  let out = 'export const movies = [\n';
  allMovies.forEach((m, i) => {
    out += '  {\n';
    for (const [k, v] of Object.entries(m)) {
      if (v === null) out += `    ${k}: null,\n`;
      else if (typeof v === 'number') out += `    ${k}: ${v},\n`;
      else out += `    ${k}: ${JSON.stringify(v)},\n`;
    }
    out += '  }' + (i < allMovies.length - 1 ? ',' : '') + '\n';
  });
  out += '];\n';
  
  fs.writeFileSync('src/data.js', out);
  console.log(`\nWritten ${allMovies.length} items total!`);
}

main().catch(console.error);
