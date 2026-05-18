import { readFileSync } from 'fs';

const dataCode = readFileSync('./src/data.js', 'utf8').replace('export const movies', 'const movies');
const codeToEval = dataCode + `
  return movies;
`;
const getMovies = new Function(codeToEval);
const movies = getMovies();

console.log('Movies loaded:', movies.length);

const decs = {};
const favIds = [];
// generate some dummy data
for (let i = 1; i <= Math.min(movies.length, 500); i++) {
  decs[i] = "like";
  if (i % 10 === 0) favIds.push(String(i));
}

const start1 = performance.now();
for (let iter = 0; iter < 1000; iter++) {
  Object.keys(decs).forEach(id => {
    if (decs[id] === "like") {
      const m = movies.find(x => x.id === parseInt(id));
    }
  });
  const favoriteMoviesList = favIds.map(id => movies.find(m => m.id === parseInt(id))).filter(Boolean);
}
const end1 = performance.now();
console.log('Baseline (movies.find):', end1 - start1, 'ms');

const startDict = performance.now();
const moviesById = {};
movies.forEach(m => { moviesById[m.id] = m; });
const endDict = performance.now();
console.log('Dict creation time:', endDict - startDict, 'ms');

const start2 = performance.now();
for (let iter = 0; iter < 1000; iter++) {
  Object.keys(decs).forEach(id => {
    if (decs[id] === "like") {
      const m = moviesById[id];
    }
  });
  const favoriteMoviesList = favIds.map(id => moviesById[id]).filter(Boolean);
}
const end2 = performance.now();
console.log('Optimized (moviesById):', end2 - start2, 'ms');
