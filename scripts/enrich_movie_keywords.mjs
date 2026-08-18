#!/usr/bin/env node
/**
 * MatchWatch — Deep Catalog Keyword & Thematic Metadata Enrichment Script
 * 
 * Automatically analyzes all 440 movies in src/data/movies.js and enriches each movie with:
 * - keywords: array of search tags, topics, plot concepts, synonyms, and transliterated tokens
 * - era: decade / era categorization ("советская классика", "золотой век", "60-е", "70-е", "80-е", "90-е", "2000-е", "2010-е", "2020-е")
 * - tropes: storytelling tropes, visual aesthetics, and cinematic styles
 * - isBW: boolean indicating classic black-and-white release
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const moviesFilePath = path.resolve(projectRoot, 'src/data/movies.js');

import { movies } from '../src/data/movies.js';

// Thematic Keyword Taxonomy Map with Strict Regexes and Word Boundaries
const THEMATIC_KEYWORD_PATTERNS = [
  // Samurai, Katana, Japan, Martial Arts
  {
    regex: /(^|[^а-яa-z0-9])(самура|катана|ронин|куросава|ниндзя|боевые искусства|кунг-фу|сёгун|японск.*воин)/iu,
    tags: ['самураи', 'самурайский экшен', 'катана', 'куросава', 'япония', 'боевые искусства', 'ронин', 'боевик', 'экшен']
  },

  // Space & Sci-Fi
  {
    regex: /(^|[^а-яa-z0-9])(космос|космическ|галактик|астронавт|гравитац|черн.*дыр|инопланет|пришельц|межзвездн|марсиан|скафандр|орбитальн|звездн.*войн|ксеноморф)/iu,
    tags: ['космос', 'научная фантастика', 'астронавты', 'будущее', 'вселенная', 'космический корабль', 'космическая одиссея']
  },
  {
    regex: /(^|[^а-яa-z0-9])(путешестви.*во времени|петл.*времен|машин.*времен|парадокс.*времен|петля времени)/iu,
    tags: ['время', 'путешествия во времени', 'временная петля', 'будущее']
  },
  {
    regex: /(^|[^а-яa-z0-9])(искусственн.*интеллект|робот|киборг|матриц|киберпанк|андроид|нейросет)/iu,
    tags: ['искусственный интеллект', 'роботы', 'киберпанк', 'технологии', 'будущее']
  },
  
  // Batman & DC & Superhero (Only for genuine superhero/comic titles)
  {
    regex: /(^|[^а-яa-z0-9])(бэтмен|бэтмэн|бетмен|готем|готэм|брюс уэйн|тёмн.*рыцар|темн.*рыцар|бэйн|харви дент)/iu,
    tags: ['бэтмен', 'джокер', 'готэм', 'тёмный рыцарь', 'комиксы', 'супергерои', 'dc', 'вигилант']
  },
  {
    regex: /(^|[^а-яa-z0-9])(человек-паук|питер паркер|майлз моралес)/iu,
    tags: ['человек-паук', 'марвел', 'супергерои', 'комиксы', 'паук']
  },
  {
    regex: /(^|[^а-яa-z0-9])(марвел|мстител|железн.*человек|тони старк|логан|дэдпул|росомах|капитан америка|танос)/iu,
    tags: ['марвел', 'мстители', 'супергерои', 'комиксы', 'блокбастер']
  },
  
  // Crime, Detective, Noir & Thriller
  {
    regex: /(^|[^а-яa-z0-9])(мафи|гангстер|крестн.*отец|корлеоне|итальянск.*мафи)/iu,
    tags: ['мафия', 'гангстеры', 'криминал', 'семья', 'босс']
  },
  {
    regex: /(^|[^а-яa-z0-9])(детектив|расследован|убийств|улик|маньяк|полицейск|следовател|шериф)/iu,
    tags: ['детектив', 'расследование', 'маньяк', 'полиция', 'тайны', 'убийство', 'триллер', 'мрачный']
  },
  {
    regex: /(^|[^а-яa-z0-9])(твист|неожидан.*поворот|иллюзи|фокус|двойник|амнези|памят)/iu,
    tags: ['твист', 'майндфак', 'неожиданный финал', 'головоломка', 'психологический триллер', 'мрачный']
  },
  {
    regex: /(^|[^а-яa-z0-9])(ограблен|афер|мошенник|куш)/iu,
    tags: ['ограбление', 'афера', 'деньги', 'криминал']
  },
  {
    regex: /(^|[^а-яa-z0-9])(тюрьм|заключен|побег из|шоушенк|надзирател)/iu,
    tags: ['тюрьма', 'побег', 'свобода', 'заключенные']
  },
  
  // War, History, Soviet
  {
    regex: /(^|[^а-яa-z0-9])(ссср|советск|мосфильм|ленфильм|шурик|гайдай|рязанов)/iu,
    tags: ['советское кино', 'ссср', 'мосфильм', 'золотой фонд', 'советская классика']
  },
  {
    regex: /(^|[^а-яa-z0-9])(великая отечественн|вторая миров|фашист|немецк.*оккупац|фронт|солдат|офицер|летчик|партизан)/iu,
    tags: ['война', 'великая отечественная', 'вторая мировая', 'подвиг', 'солдаты', 'история']
  },
  {
    regex: /(^|[^а-яa-z0-9])(средневеков|рыцар|древн)/iu,
    tags: ['история', 'средневековье', 'рыцари', 'эпоха']
  },
  
  // Fantasy & Magic
  {
    regex: /(^|[^а-яa-z0-9])(хогвартс|поттер|дамблдор|волан-де-морт)/iu,
    tags: ['магия', 'волшебство', 'гарри поттер', 'фэнтези']
  },
  {
    regex: /(^|[^а-яa-z0-9])(средиземь|хоббит|толкин|саурон|фродо|гэндальф)/iu,
    tags: ['властелин колец', 'средиземье', 'фэнтези', 'эпос']
  },
  
  // Comedy, Friendship, Pizza with Friends
  {
    regex: /(^|[^а-яa-z0-9])(смешн|комед|юмор|веселье|пицц)/iu,
    tags: ['комедия', 'друзья', 'юмор', 'под пиццу', 'для компании', 'отдых', 'легкий']
  },
  {
    regex: /(^|[^а-яa-z0-9])(романтик|любов.*истори|страст|влюблен)/iu,
    tags: ['любовь', 'романтика', 'отношения', 'мелодрама', 'чувства']
  },
  
  // Horror & Survival
  {
    regex: /(^|[^а-яa-z0-9])(ужас|страх|кошмар|призрак|демон|зомби|выживан|апокалипсис|монстр)/iu,
    tags: ['ужасы', 'хоррор', 'выживание', 'монстры', 'страх', 'саспенс']
  },
  {
    regex: /(^|[^а-яa-z0-9])(бокс|чемпион|тренер|матч)/iu,
    tags: ['спорт', 'победа', 'тренировки', 'мотивация']
  }
];

// Director Specific Keywords
const DIRECTOR_KEYWORDS = {
  'Кристофер Нолан': ['нолан', 'кристофер нолан', 'нелинейный сюжет', 'интеллектуальный триллер', 'твист', 'циммер'],
  'Дэвид Финчер': ['финчер', 'дэвид финчер', 'психологический триллер', 'нео-нуар', 'перфекционизм', 'твист', 'мрачный'],
  'Квентин Тарантино': ['тарантино', 'квентин тарантино', 'культовые диалоги', 'черный юмор', 'нелинейный сюжет', 'самурайский экшен', 'катана'],
  'Мартин Скорсезе': ['скорсезе', 'мартин скорсезе', 'криминальная драма', 'гангстеры', 'ди каприо', 'де ниро'],
  'Дени Вильнёв': ['вильнёв', 'дени вильнёв', 'монументальный сай-фай', 'визуальная эстетика', 'глубокая атмосфера', 'триллер'],
  'Стенли Кубрик': ['кубрик', 'стэнли кубрик', 'авторское кино', 'философия', 'культовая классика'],
  'Альфред Хичкок': ['хичкок', 'альфред хичкок', 'мастер саспенса', 'классический детектив', 'триллер', 'твист'],
  'Леонид Гайдай': ['гайдай', 'леонид гайдай', 'советская комедия', 'шурик', 'эксцентрика', 'юмор'],
  'Эльдар Рязанов': ['рязанов', 'эльдар рязанов', 'советская лирическая комедия', 'душевное кино'],
  'Хаяо Миядзаки': ['миядзаки', 'хаяо миядзаки', 'гибли', 'аниме', 'волшебство', 'душевность'],
  'Джеймс Кэмерон': ['кэмерон', 'джеймс кэмерон', 'масштабный блокбастер', 'революционный визуал'],
  'Стивен Спилберг': ['спилберг', 'стивен спилберг', 'приключения', 'культовое кино', 'эмоции'],
  'Акира Куросава': ['куросава', 'акира куросава', 'самураи', 'самурайский экшен', 'катана', 'япония', 'ронин']
};

function determineEra(year, country = '') {
  if (country.includes('СССР')) return 'советская классика';
  if (year < 1960) return 'золотой век кино';
  if (year >= 1960 && year < 1970) return '60-е';
  if (year >= 1970 && year < 1980) return '70-е';
  if (year >= 1980 && year < 1990) return '80-е';
  if (year >= 1990 && year < 2000) return '90-е';
  if (year >= 2000 && year < 2010) return '2000-е';
  if (year >= 2010 && year < 2020) return '2010-е';
  return '2020-е (современное)';
}

function determineIsBW(m) {
  const knownBWTitles = [
    '12 разгневанных мужчин', 'Эта прекрасная жизнь', 'Касабланка', 'Семь самураев', 'Психо',
    'Огни большого города', 'Сансет бульвар', 'Тропы славы', 'Доктор Стрейнджлав', 'Похитители велосипедов',
    'Свидетель обвинения', 'Метрополис', 'Двойная страховка', 'Гражданин Кейн', 'М убийца',
    'Убить пересмешника', 'В джазе только девушки', 'Расёмон', '8 с половиной', 'Печать зла',
    'Мальтийский сокол', 'Ребекка', 'Токийская история', 'Четыреста ударов', 'Седьмая печать',
    'Земляничная поляна', 'Золотая лихорадка', 'Телохранитель', 'Это случилось однажды ночью', 'Дьяволицы',
    'Летят журавли', 'Девчата', 'В бой идут одни «старики»', 'Собачье сердце'
  ];
  if (knownBWTitles.some(t => m.titleRu?.includes(t) || m.title?.includes(t))) return true;
  if (m.year <= 1960 && !m.genres?.toLowerCase().includes('мультфильм')) return true;
  return false;
}

function extractTropes(m) {
  const tropes = new Set();
  const text = `${m.titleRu} ${m.title} ${m.description} ${m.fullDescription || ''} ${m.genres}`.toLowerCase();

  if (text.includes('самура') || text.includes('катана') || text.includes('куросава')) tropes.add('самурайский экшен');
  if (text.includes('космос') || text.includes('галактик') || text.includes('астронавт') || text.includes('гравитац')) tropes.add('космическая одиссея');
  if (text.includes('твист') || text.includes('головоломк') || text.includes('амнези') || text.includes('двойник')) tropes.add('майндфак и твисты');
  if (text.includes('нуар') || text.includes('дожд') || text.includes('неон') || text.includes('триллер')) tropes.add('нео-нуар');
  if (text.includes('мафи') || text.includes('гангстер') || text.includes('крестн')) tropes.add('криминальная сага');
  if (text.includes('выживан') || text.includes('остров') || text.includes('один на')) tropes.add('борьба за выживание');
  if (text.includes('слез') || text.includes('пронзительн') || text.includes('драм')) tropes.add('пронзительная драма');
  if (text.includes('смешн') || text.includes('юмор') || text.includes('пицц') || text.includes('шурик')) tropes.add('убойная комедия');
  if (text.includes('супергеро') || text.includes('бэтмен') || text.includes('человек-паук') || text.includes('марвел')) tropes.add('супергеройский эпик');
  if (text.includes('великая отечественн') || text.includes('вторая миров') || text.includes('фронт')) tropes.add('военная драма');
  if (text.includes('ограблен') || text.includes('афер')) tropes.add('виртуозное ограбление');
  if (text.includes('время') || text.includes('будущ') || text.includes('искусственн')) tropes.add('футуристический сай-фай');
  if (determineIsBW(m)) tropes.add('черно-белая эстетика');
  if (m.country?.includes('СССР')) tropes.add('советская классика');

  return Array.from(tropes);
}

// Enrich each movie
const enrichedMovies = movies.map((m) => {
  const keywordSet = new Set();

  // Basic tokens from title, director, actors, country, genres
  if (m.titleRu) keywordSet.add(m.titleRu.toLowerCase());
  if (m.title) keywordSet.add(m.title.toLowerCase());
  if (m.director) keywordSet.add(m.director.toLowerCase());
  if (m.country) keywordSet.add(m.country.toLowerCase());

  if (m.genres) {
    m.genres.split(',').map(g => g.trim().toLowerCase()).forEach(g => {
      keywordSet.add(g);
      if (g.includes('триллер')) {
        keywordSet.add('триллер');
        keywordSet.add('саспенс');
        keywordSet.add('мрачный');
      }
      if (g.includes('детектив')) {
        keywordSet.add('детектив');
        keywordSet.add('расследование');
        keywordSet.add('тайны');
      }
      if (g.includes('боевик')) {
        keywordSet.add('боевик');
        keywordSet.add('экшен');
        keywordSet.add('драйв');
      }
    });
  }

  if (m.actors) {
    m.actors.split(',').map(a => a.trim().toLowerCase()).forEach(a => keywordSet.add(a));
  }

  // Explicit additions for Samurai, Katana, Kurosawa
  if ([33, 165, 128, 112, 138, 147].includes(m.id)) {
    keywordSet.add('самураи');
    keywordSet.add('самурай');
    keywordSet.add('самурайский');
    keywordSet.add('самурайский экшен');
    keywordSet.add('катана');
    keywordSet.add('куросава');
    keywordSet.add('ронин');
    keywordSet.add('япония');
    keywordSet.add('боевые искусства');
    keywordSet.add('боевик');
    keywordSet.add('экшен');
  }

  // Explicit additions for verified Batman movies
  if ([3, 86, 122].includes(m.id)) {
    keywordSet.add('бэтмен');
    keywordSet.add('бетмен');
    keywordSet.add('готэм');
    keywordSet.add('джокер');
    keywordSet.add('тёмный рыцарь');
    keywordSet.add('брюс уэйн');
    keywordSet.add('супергерои');
    keywordSet.add('dc');
  }

  // Explicit additions for verified space masterpieces
  if ([10, 316, 98, 204, 39, 45, 16, 20, 51, 211, 212, 248, 287, 317, 347, 809].includes(m.id)) {
    keywordSet.add('космос');
    keywordSet.add('космический');
    keywordSet.add('астронавты');
    keywordSet.add('космическая одиссея');
  }

  // Explicit additions for psychological thrillers with twists
  if ([7, 65, 345, 3, 36, 41, 53, 63, 80, 82, 101, 120, 123, 130, 134, 148, 151, 152, 181, 840].includes(m.id)) {
    keywordSet.add('твист');
    keywordSet.add('неожиданный финал');
    keywordSet.add('головоломка');
    keywordSet.add('психологический триллер');
    keywordSet.add('саспенс');
    keywordSet.add('мрачный');
  }

  // Add director specific tags
  for (const [dirName, dirTags] of Object.entries(DIRECTOR_KEYWORDS)) {
    if (m.director && m.director.includes(dirName)) {
      dirTags.forEach(t => keywordSet.add(t));
    }
  }

  // Scan plot text against thematic keyword patterns
  const plotCombined = `${m.titleRu} ${m.title} ${m.description || ''} ${m.fullDescription || ''} ${m.genres || ''}`;
  for (const pattern of THEMATIC_KEYWORD_PATTERNS) {
    if (pattern.regex.test(plotCombined)) {
      pattern.tags.forEach(t => keywordSet.add(t));
    }
  }

  const isBW = determineIsBW(m);
  if (isBW) {
    keywordSet.add('чб');
    keywordSet.add('черно-белый');
    keywordSet.add('черно-белое');
    keywordSet.add('монохром');
  }

  const era = determineEra(m.year, m.country || '');
  keywordSet.add(era.toLowerCase());

  const tropes = extractTropes(m);
  tropes.forEach(t => keywordSet.add(t.toLowerCase()));

  return {
    ...m,
    isBW,
    era,
    tropes,
    keywords: Array.from(keywordSet)
  };
});

// Format as clean JavaScript module
const fileContent = `// MatchWatch — Master Film Catalog (440 Verified Movies & TMDB High-Res Posters & Rich Thematic Keywords)
export const movies = ${JSON.stringify(enrichedMovies, null, 2)};
`;

fs.writeFileSync(moviesFilePath, fileContent, 'utf-8');
console.log(`✅ Successfully enriched all ${enrichedMovies.length} movies in src/data/movies.js with clean keywords, era, tropes & B/W tags!`);
