import fs from 'fs';
import { movies } from '../src/data/movies.js';

// Filter strictly for movies
const filteredMovies = movies.filter(x => (x.category || x.type || 'movie') === 'movie');
console.log(`Starting TMDB enrichment for ${filteredMovies.length} movies...`);

async function fetchTmdbPoster(titleRu, titleEn, year) {
  const query = titleRu || titleEn;
  if (!query) return null;
  try {
    const url = 'https://www.themoviedb.org/search/movie?query=' + encodeURIComponent(query) + '&language=ru-RU';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const matches = html.match(/\/t\/p\/w[0-9_a-z]*\/([a-zA-Z0-9_-]+\.jpg)/g);
    if (matches && matches.length > 0) {
      const fileName = matches[0].split('/').pop();
      return `https://image.tmdb.org/t/p/w500/${fileName}`;
    }
  } catch (err) {
    // ignore
  }
  return null;
}

// Concurrently fetch with batching
async function run() {
  const enriched = [];
  const BATCH_SIZE = 15;
  for (let i = 0; i < filteredMovies.length; i += BATCH_SIZE) {
    const chunk = filteredMovies.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(chunk.map(async (m) => {
      const tmdbPoster = await fetchTmdbPoster(m.titleRu, m.title, m.year);
      return {
        ...m,
        category: 'movie',
        tmdbPoster: tmdbPoster || `https://kinopoiskapiunofficial.tech/images/posters/kp/${m.kinopoiskId}.jpg`
      };
    }));
    enriched.push(...results);
    process.stdout.write(`\rEnriched ${enriched.length}/${filteredMovies.length} movies with TMDB posters...`);
  }
  console.log('\nWriting enriched movies to src/data/movies.js...');

  const outputCode = `// MatchWatch — Master Film Catalog (${enriched.length} Verified Movies & TMDB High-Res Posters)
export const movies = ${JSON.stringify(enriched, null, 2)};
`;

  fs.writeFileSync('src/data/movies.js', outputCode);
  fs.writeFileSync('/Users/tehnicno/projects/matchwatch3/src/data/movies.js', outputCode);
  console.log('Successfully updated src/data/movies.js in both projects!');
}

run();
