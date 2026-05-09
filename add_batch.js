const searchTerms = [
  { k: "Девчата", y: 1961 },
  { k: "Любовь и голуби", y: 1984 },
  { k: "Летят журавли", y: 1957 },
  { k: "А зори здесь тихие", y: 1972 },
  { k: "Офицеры", y: 1971 },
  { k: "Покровские ворота", y: 1982 },
  { k: "Белый Бим Черное ухо", y: 1976 },
  { k: "Брат", y: 1997 },
  { k: "Брат 2", y: 2000 },
  { k: "Жмурки", y: 2005 },
  { k: "Бумер", y: 2003 },
  { k: "Особенности национальной охоты", y: 1995 },
  { k: "Дурак", y: 2014 },
  { k: "Легенда №17", y: 2012 },
  { k: "Движение вверх", y: 2017 },
  { k: "Титаник", y: 1997 },
  { k: "В погоне за счастьем", y: 2006 },
  { k: "Терминал", y: 2004 },
  { k: "Изгой", y: 2000 },
  { k: "Запах женщины", y: 1992 },
  { k: "Человек дождя", y: 1988 },
  { k: "Мальчик в полосатой пижаме", y: 2008 },
  { k: "Грязные танцы", y: 1987 },
  { k: "Привидение", y: 1990 },
  { k: "Гордость и предубеждение", y: 2005 },
  { k: "Искусственный разум", y: 2001 },
  { k: "Гарри Поттер и философский камень", y: 2001 },
  { k: "Марсианин", y: 2015 },
  { k: "Грань будущего", y: 2014 },
  { k: "Эффект бабочки", y: 2004 },
  { k: "Трасса 60", y: 2002 },
  { k: "Хищник", y: 1987 },
  { k: "Один дома", y: 1990 },
  { k: "Один дома 2", y: 1992 },
  { k: "Маска", y: 1994 },
  { k: "Всегда говори ДА", y: 2008 },
  { k: "Брюс Всемогущий", y: 2003 },
  { k: "Тупой и еще тупее", y: 1994 },
  { k: "Люди в черном", y: 1997 },
  { k: "Такси", y: 1998 },
  { k: "Мальчишник в Вегасе", y: 2009 },
  { k: "Евротур", y: 2004 },
  { k: "Укрощение строптивого", y: 1980 },
  { k: "Блеф", y: 1976 },
  { k: "Смертельное оружие", y: 1987 },
  { k: "Скала", y: 1996 },
  { k: "Без лица", y: 1997 },
  { k: "Джон Уик", y: 2014 },
  { k: "Заложница", y: 2008 },
  { k: "Пленницы", y: 2013 },
  { k: "Иллюзия обмана", y: 2013 },
  { k: "Помни", y: 2000 },
  { k: "Ледниковый период", y: 2002 },
  { k: "Мадагаскар", y: 2005 },
  { k: "Зверополис", y: 2016 },
  { k: "Головоломка", y: 2015 },
  { k: "Рапунцель: Запутанная история", y: 2010 },
  { k: "Человек-паук: Через вселенные", y: 2018 },
  { k: "Твое имя", y: 2016 },
  { k: "Форма голоса", y: 2016 }
];

const fs = require('fs');
const https = require('https');

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
  console.log('Searching and fetching details...');
  
  let rawData = fs.readFileSync('src/data.js', 'utf8');
  const arrayStr = rawData.replace('export const movies = ', '').replace(/;\s*$/, '');
  const movies = eval('(' + arrayStr + ')');
  let nextId = Math.max(...movies.map(m => m.id)) + 1;
  
  const newMovies = [];
  
  for (const t of searchTerms) {
    const searchRes = await searchKP(t.k, t.y);
    if (!searchRes || !searchRes.items || searchRes.items.length === 0) {
      console.log(`NOT FOUND: ${t.k} (${t.y})`);
      continue;
    }
    const kpId = searchRes.items[0].kinopoiskId;
    await sleep(600); // rate limit
    
    const kp = await fetchKPDetails(kpId);
    if (!kp) {
      console.log(`NO DETAILS FOR: ${t.k}`);
      continue;
    }
    await sleep(600);
    
    const imdbId = kp.imdbId;
    let omdb = null;
    if (imdbId) {
      omdb = await fetchOMDB(imdbId);
    }
    
    // Check if already in DB
    if (movies.find(m => m.kinopoiskId === kpId || (imdbId && m.imdb && m.imdb.includes(imdbId)))) {
      console.log(`ALREADY IN DB: ${kp.nameRu || t.k}`);
      continue;
    }
    
    // Fallbacks
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
      imdb: imdbLink
    });
    
    console.log(`Added: ${titleRu}`);
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
  console.log(`\nWritten ${allMovies.length} movies total!`);
}

main().catch(console.error);
