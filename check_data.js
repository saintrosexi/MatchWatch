const fs = require('fs');

try {
  let rawData = fs.readFileSync('src/data.js', 'utf8');
  // strip export
  const arrayStr = rawData.replace('export const movies = ', '').replace(/;\s*$/, '');
  const movies = eval('(' + arrayStr + ')');
  console.log(`Successfully loaded ${movies.length} items from data.js.`);
  
  const missingPosters = [];
  const missingTitles = [];
  const missingDesc = [];
  const naPosters = [];
  const invalidType = [];

  movies.forEach(m => {
    if (!m.id) {
      console.log(`Movie without ID: ${JSON.stringify(m)}`);
      return;
    }
    
    // Check type
    if (!m.type) {
      invalidType.push(m);
    }
    
    // Check poster
    if (!m.poster || m.poster.trim() === '') {
      missingPosters.push(m);
    } else if (m.poster.includes('N/A') || m.poster === 'null' || m.poster.includes('placeholder')) {
      naPosters.push(m);
    }
    
    // Check titles
    if (!m.titleRu || m.titleRu.trim() === '') {
      missingTitles.push(m);
    }
    
    // Check description
    if (!m.description || m.description.trim() === '') {
      missingDesc.push(m);
    }
  });

  console.log(`\n--- Audit Results ---`);
  console.log(`Total Movies: ${movies.length}`);
  console.log(`Items with missing type field: ${invalidType.length}`);
  console.log(`Items with empty poster: ${missingPosters.length}`);
  console.log(`Items with 'N/A' or invalid poster: ${naPosters.length}`);
  console.log(`Items with missing Russian title: ${missingTitles.length}`);
  console.log(`Items with missing description: ${missingDesc.length}`);

  if (invalidType.length > 0) {
    console.log('\nMissing Type:', invalidType.map(m => `[ID ${m.id}] ${m.title || m.titleRu}`));
  }
  if (missingPosters.length > 0) {
    console.log('\nEmpty Posters:', missingPosters.map(m => `[ID ${m.id}] ${m.title || m.titleRu}`));
  }
  if (naPosters.length > 0) {
    console.log('\nN/A or Invalid Posters:', naPosters.map(m => `[ID ${m.id}] ${m.title || m.titleRu}: ${m.poster}`));
  }
  if (missingTitles.length > 0) {
    console.log('\nMissing Russian Title:', missingTitles.map(m => `[ID ${m.id}] ${m.title}`));
  }
  if (missingDesc.length > 0) {
    console.log('\nMissing Description:', missingDesc.map(m => `[ID ${m.id}] ${m.title || m.titleRu}`));
  }

} catch (e) {
  console.error('Error reading or parsing data.js:', e);
}
