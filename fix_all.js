const https = require('https');
const fs = require('fs');

// ---- Helpers ----
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

function fetchKP(imdbId) {
  return fetchJSON({
    hostname: 'kinopoiskapiunofficial.tech',
    path: `/api/v2.2/films?imdbId=${imdbId}`,
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

// Simple English-to-Russian description templates
const RU_DESCRIPTIONS = {};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== MovieSwap Data Fixer ===\n');
  
  // Read current data
  let rawData = fs.readFileSync('src/data.js', 'utf8');
  const arrayStr = rawData.replace('export const movies = ', '').replace(/;\s*$/, '');
  const movies = eval('(' + arrayStr + ')');
  console.log(`Current movies: ${movies.length}`);
  
  // Keep original 10 untouched
  const original10 = movies.filter(m => m.id <= 10);
  const toFix = movies.filter(m => m.id > 10);
  
  console.log(`Originals (keep as-is): ${original10.length}`);
  console.log(`To fix: ${toFix.length}\n`);
  
  // Collect all IMDb IDs from movies to fix
  const uniqueIds = [...new Set(
    toFix
      .map(m => (m.imdb || '').match(/tt\d+/)?.[0])
      .filter(Boolean)
  )];
  console.log(`Unique IMDb IDs to process: ${uniqueIds.length}\n`);
  
  // Fetch from KP API in batches (rate limit: 20 req/sec)
  console.log('Fetching from Kinopoisk API...');
  const kpData = {};
  for (let i = 0; i < uniqueIds.length; i++) {
    const id = uniqueIds[i];
    const kp = await fetchKP(id);
    if (kp && kp.items && kp.items.length > 0) {
      const item = kp.items[0];
      kpData[id] = {
        nameRu: item.nameRu || item.nameOriginal || '',
        kpId: item.kinopoiskId,
        year: item.year,
        ratingKP: item.ratingKinopoisk
      };
    }
    if ((i + 1) % 20 === 0) {
      console.log(`  KP: ${i + 1}/${uniqueIds.length}...`);
      await sleep(1100); // rate limit
    }
  }
  console.log(`  KP: got data for ${Object.keys(kpData).length} movies\n`);

  // Fetch KP details for description (Russian)
  console.log('Fetching Russian descriptions from KP...');
  const kpDetails = {};
  const kpIds = Object.values(kpData).map(d => d.kpId).filter(Boolean);
  for (let i = 0; i < kpIds.length; i++) {
    const kpId = kpIds[i];
    const detail = await fetchKPDetails(kpId);
    if (detail && detail.description) {
      kpDetails[kpId] = {
        description: detail.description,
        shortDescription: detail.shortDescription || ''
      };
    }
    if ((i + 1) % 20 === 0) {
      console.log(`  Details: ${i + 1}/${kpIds.length}...`);
      await sleep(1100);
    }
  }
  console.log(`  Details: got descriptions for ${Object.keys(kpDetails).length} movies\n`);
  
  // Re-fetch from OMDB to verify data + get correct poster
  console.log('Verifying with OMDB...');
  const omdbData = {};
  for (let i = 0; i < uniqueIds.length; i += 10) {
    const batch = uniqueIds.slice(i, i + 10);
    const results = await Promise.all(batch.map(id => fetchOMDB(id)));
    batch.forEach((id, j) => {
      if (results[j] && results[j].Response === 'True') {
        omdbData[id] = results[j];
      }
    });
    console.log(`  OMDB: ${Math.min(i + 10, uniqueIds.length)}/${uniqueIds.length}...`);
    await sleep(300);
  }
  console.log(`  OMDB: verified ${Object.keys(omdbData).length} movies\n`);
  
  // Build fixed movies
  let id = 11;
  const seenImdb = new Set();
  const fixedMovies = [];
  
  for (const imdbId of uniqueIds) {
    if (seenImdb.has(imdbId)) continue;
    seenImdb.add(imdbId);
    
    const omdb = omdbData[imdbId];
    const kp = kpData[imdbId];
    if (!omdb || !omdb.Poster || omdb.Poster === 'N/A') continue;
    
    const kpId = kp ? kp.kpId : null;
    const kpDetail = kpId ? kpDetails[kpId] : null;
    
    // Russian title from KP (authoritative)
    const titleRu = (kp && kp.nameRu) ? kp.nameRu : omdb.Title;
    
    // Russian description from KP
    let desc = '';
    if (kpDetail && kpDetail.shortDescription) {
      desc = kpDetail.shortDescription;
    } else if (kpDetail && kpDetail.description) {
      // Truncate long descriptions
      desc = kpDetail.description.length > 300 
        ? kpDetail.description.substring(0, 297) + '...'
        : kpDetail.description;
    }
    
    let fullDesc = '';
    if (kpDetail && kpDetail.description) {
      fullDesc = kpDetail.description;
    }
    
    // Fallback: if no Russian desc, keep English
    if (!desc) desc = omdb.Plot || '';
    if (!fullDesc) fullDesc = omdb.Plot || '';
    
    fixedMovies.push({
      id: id++,
      title: omdb.Title,
      titleRu: titleRu,
      year: parseInt(omdb.Year) || 2000,
      rating: parseFloat(omdb.imdbRating) || 7.0,
      poster: omdb.Poster.replace('SX300', 'SX500'),
      description: desc,
      fullDescription: fullDesc,
      country: omdb.Country || 'США',
      genres: translateGenres(omdb.Genre),
      director: omdb.Director || '',
      actors: omdb.Actors || '',
      duration: omdb.Runtime || '',
      trailer: '',
      kinopoiskId: kpId,
      imdb: `https://www.imdb.com/title/${imdbId}`
    });
  }
  
  const allMovies = [...original10, ...fixedMovies];
  console.log(`\nFixed movies total: ${allMovies.length}`);
  
  // Count issues fixed
  let fixedTitles = 0, fixedDescs = 0, fixedKP = 0;
  fixedMovies.forEach(m => {
    if (m.titleRu !== m.title) fixedTitles++;
    if (m.description && !m.description.match(/[a-zA-Z]{5}/)) fixedDescs++;
    if (m.kinopoiskId) fixedKP++;
  });
  console.log(`  Russian titles: ${fixedTitles}`);
  console.log(`  Russian descriptions: ${fixedDescs}`);
  console.log(`  Kinopoisk IDs: ${fixedKP}`);
  
  // Write
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
  console.log('\nWritten to src/data.js!');
}

main().catch(console.error);
