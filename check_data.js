const { movies } = require('./src/data.js');

console.log(`Successfully loaded ${movies.length} items from src/data.js.`);

const missingPosters = [];
const naPosters = [];
const missingTitles = [];
const missingDesc = [];

movies.forEach(m => {
  if (!m.id) return;
  
  if (!m.poster || m.poster.trim() === '') {
    missingPosters.push(m);
  } else if (m.poster.includes('N/A') || m.poster === 'null' || m.poster.includes('placeholder')) {
    naPosters.push(m);
  }

  if (!m.titleRu || m.titleRu.trim() === '') {
    missingTitles.push(m);
  }

  if (!m.description || m.description.trim() === '') {
    missingDesc.push(m);
  }
});

console.log(`\n--- Audit Results ---`);
console.log(`Total Movies: ${movies.length}`);
console.log(`Items with empty poster: ${missingPosters.length}`);
console.log(`Items with 'N/A' or placeholder poster: ${naPosters.length}`);
console.log(`Items with missing Russian title: ${missingTitles.length}`);
console.log(`Items with missing description: ${missingDesc.length}`);

if (missingPosters.length > 0) {
  console.log('\nEmpty Posters:', missingPosters.map(m => `[ID ${m.id}] ${m.title || m.titleRu}`));
}
if (naPosters.length > 0) {
  console.log('\nN/A or Invalid Posters:', naPosters.map(m => `[ID ${m.id}] ${m.title || m.titleRu}: ${m.poster}`));
}
