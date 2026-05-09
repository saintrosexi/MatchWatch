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

async function searchKP(keyword) {
  const data = await fetchJSON({
    hostname: 'kinopoiskapiunofficial.tech',
    path: `/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(keyword)}`,
    headers: {
      'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
      'accept': 'application/json'
    }
  });
  return data;
}

const titles = [
  "Иван Васильевич меняет профессию",
  "Операция «Ы» и другие приключения Шурика",
  "Бриллиантовая рука",
  "Джентльмены удачи",
  "Кавказская пленница, или Новые приключения Шурика",
  "В бой идут одни «старики»",
  "Собачье сердце",
  "Москва слезам не верит",
  "Служебный роман",
  "Собака Баскервилей", // Приключения Шерлока Холмса и доктора Ватсона: Собака Баскервилей
  "Назад в будущее",
  "Назад в будущее 2",
  "Назад в будущее 3",
  "Достучаться до небес",
  "Терминатор",
  "Пятый элемент",
  "Шрэк 2"
];

async function run() {
  for (const t of titles) {
    const data = await searchKP(t);
    if (data && data.films && data.films.length > 0) {
      console.log(`Title: ${t} -> KP_ID: ${data.films[0].filmId}`);
    } else {
      console.log(`Title: ${t} -> NOT FOUND`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

run();
