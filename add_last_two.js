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

// 1091 - Men in Black
// 276376 - Taken
const kpIds = [1091, 276376];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('Fetching MIB and Taken...');
  
  let rawData = fs.readFileSync('src/data.js', 'utf8');
  const arrayStr = rawData.replace('export const movies = ', '').replace(/;\s*$/, '');
  let movies = eval('(' + arrayStr + ')');
  
  // Remove bad movies
  const badTitles = ["Можешь рассчитывать на меня", "Хакеры", "Пещера колдунов", "Запомни это", "Беги, Лола, беги", "Шляпа с сюрпризами"];
  movies = movies.filter(m => !badTitles.includes(m.titleRu) && !badTitles.includes(m.title));
  
  let nextId = Math.max(...movies.map(m => m.id)) + 1;
  const newMovies = [];
  
  for (const kpId of kpIds) {
    const kp = await fetchKPDetails(kpId);
    if (!kp) continue;
    
    const imdbId = kp.imdbId;
    let omdb = null;
    if (imdbId) {
      omdb = await fetchOMDB(imdbId);
    }
    
    const title = omdb && omdb.Title && omdb.Title !== 'N/A' ? omdb.Title : kp.nameOriginal || kp.nameRu;
    const titleRu = kp.nameRu || title;
    const year = kp.year || (omdb && parseInt(omdb.Year)) || 2000;
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
    await sleep(600);
  }
  
  const finalMovies = movies.concat(newMovies);
  
  let out = 'export const movies = [\n';
  finalMovies.forEach((m, i) => {
    out += '  {\n';
    for (const [k, v] of Object.entries(m)) {
      if (v === null) out += `    ${k}: null,\n`;
      else if (typeof v === 'number') out += `    ${k}: ${v},\n`;
      else out += `    ${k}: ${JSON.stringify(v)},\n`;
    }
    out += '  }' + (i < finalMovies.length - 1 ? ',' : '') + '\n';
  });
  out += '];\n';
  
  fs.writeFileSync('src/data.js', out);
  console.log(`\nWritten ${finalMovies.length} movies total!`);
}

main().catch(console.error);
