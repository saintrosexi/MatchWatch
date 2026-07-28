// Script to fetch official real photos and profile data for ALL actors from Kinopoisk API
const fs = require('fs');
const https = require('https');
const path = require('path');

const KP_API_KEY = '8c8e1a50-6322-4135-8875-5d40a5420d86';

function fetchJSON(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'X-API-KEY': KP_API_KEY,
        'accept': 'application/json'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
  });
}

async function searchActor(name) {
  const url = `https://kinopoiskapiunofficial.tech/api/v1/persons?name=${encodeURIComponent(name)}`;
  const res = await fetchJSON(url);
  if (res && res.items && res.items.length > 0) {
    const item = res.items[0];
    return {
      name: item.nameRu || item.nameEn || name,
      nameEn: item.nameEn || '',
      photo: item.posterUrl || (item.kinopoiskId ? `https://kinopoiskapiunofficial.tech/images/actor_posters/kp/${item.kinopoiskId}.jpg` : null)
    };
  }
  return null;
}

module.exports = { searchActor };
