/**
 * MatchWatch — франшизы и авторы.
 *
 * Зачем отдельный слой поверх ключевых слов: keywords TMDB описывают
 * «про что» фильм, но ничего не говорят о том, что он часть чего-то
 * большего. Человек, лайкнувший «Человека-паука», хочет чаще видеть
 * не просто «супергероику», а именно других пауков, затем остальную
 * Marvel, и только потом супергероику вообще.
 *
 * Поэтому каждый фильм получает цепочку тегов убывающего веса:
 *
 *   spider-man (100) -> marvel (72) -> superhero (52) -> comic-adaptation (52)
 *
 * Косинусное сходство само расставит приоритет: другой «Человек-паук»
 * совпадёт по всем четырём, фильм Marvel — по трём, DC — по двум.
 *
 * Ключи — идентификаторы коллекций и персон TMDB. Они стабильны и не
 * зависят от языка, в отличие от названий: `belongs_to_collection.name`
 * приходит локализованным и для русского выглядит как
 * «Человек-паук [КВМ] (Коллекция)».
 */

/*
 * Веса понижены после разбора живой ленты.
 *
 * Франшиза стояла на потолке шкалы — сильнее любого другого признака
 * фильма. У человека, отметившего любимыми восемь «Человеков-пауков»
 * и четырёх «Мстителей», это давало ленту, состоящую из Marvel целиком:
 * принадлежность к вселенной перевешивала и темп, и тему, и настроение,
 * то есть всё, чем фильмы внутри одной франшизы как раз и различаются.
 *
 * Франшиза остаётся сильным сигналом — но теперь одним из сильных,
 * а не единственным. «Ещё такого же» человек получает по совокупности
 * признаков, а не по одной наклейке.
 *
 * Вся цепочка опущена пропорционально: порядок «франшиза сильнее
 * вселенной, вселенная сильнее темы» сохранён, потому что он верен —
 * другой «Человек-паук» человеку ближе, чем случайный фильм Marvel,
 * а тот ближе, чем супергероика вообще. Сменился не порядок,
 * а громкость всей группы относительно остальных признаков.
 */
/** Вес точного попадания во франшизу. */
export const FRANCHISE_WEIGHT = 70;
/** Вес «вселенной»: MCU, DC, Средиземье. */
export const UNIVERSE_WEIGHT = 40;
/** Вес широкой темы: супергерои, космоопера, слэшер. */
export const THEME_WEIGHT = 30;
/** Вес авторского почерка — сопоставим с франшизой: это тоже выбор «ещё такого». */
export const DIRECTOR_WEIGHT = 65;
/** Вес стилевых признаков автора. */
export const DIRECTOR_STYLE_WEIGHT = 38;

/* ────────────────────────────────────────────────────────────────
   Группы: франшиза -> вселенная -> тема
   ──────────────────────────────────────────────────────────────── */

/**
 * Вселенные: то, внутри чего франшизы делятся дальше.
 *
 * Нужен отдельным списком, потому что потолок «не больше двух фильмов
 * одной франшизы» вселенную не ловит: «Железный человек», «Тор»,
 * «Стражи Галактики» и «Дэдпул» — четыре разные коллекции TMDB
 * и одна и та же Marvel. Именно так лента и превращалась в Marvel
 * при формально соблюдённом лимите.
 */
export const UNIVERSE_SLUGS = Object.freeze(new Set([
  'mcu', 'marvel', 'dc', 'star-wars', 'middle-earth', 'wizarding-world', 'pixar',
]));

/** Вселенная фильма по его тегам — или null, если он сам по себе. */
export const universeOf = (tags) => {
  for (const slug of Object.keys(tags ?? {})) {
    if (UNIVERSE_SLUGS.has(slug)) return slug;
  }
  return null;
};

/**
 * Франшиза фильма по тегам — тег с весом точного попадания.
 *
 * Нужна там, где под рукой только вектор тегов, а не сырая карточка
 * TMDB с `belongs_to_collection`: например у опор вкуса, которые
 * хранятся компактно.
 */
export const franchiseOf = (tags) => {
  let best = null;
  for (const [slug, weight] of Object.entries(tags ?? {})) {
    if (weight < FRANCHISE_WEIGHT) continue;
    if (UNIVERSE_SLUGS.has(slug)) continue;
    if (!best || weight > best.weight) best = { slug, weight };
  }
  return best?.slug ?? null;
};

const MCU = ['mcu', 'marvel', 'superhero', 'comic-adaptation'];
const MARVEL = ['marvel', 'superhero', 'comic-adaptation'];
const DC = ['dc', 'superhero', 'comic-adaptation'];

/** @type {Record<number, {slug: string, parents: string[]}>} */
export const FRANCHISES = {
  // ── Marvel ────────────────────────────────────────────────────
  86311:  { slug: 'avengers',        parents: MCU },
  131292: { slug: 'iron-man',        parents: MCU },
  131295: { slug: 'captain-america', parents: MCU },
  131296: { slug: 'thor',            parents: MCU },
  284433: { slug: 'guardians',       parents: [...MCU, 'space-opera', 'ensemble'] },
  422834: { slug: 'ant-man',         parents: MCU },
  618529: { slug: 'doctor-strange',  parents: [...MCU, 'dark-fantasy'] },
  529892: { slug: 'black-panther',   parents: MCU },
  // У больших франшиз несколько коллекций: перезапуски и параллельные
  // вселенные. Все они ведут на один слаг — иначе «Человек-паук» Рэйми
  // и «Человек-паук» из MCU считались бы разными вещами.
  556:    { slug: 'spider-man',      parents: MARVEL },              // трилогия Рэйми
  225941: { slug: 'spider-man',      parents: MARVEL },              // «Новый Человек-паук»
  531241: { slug: 'spider-man',      parents: MCU },                 // Человек-паук в MCU
  573436: { slug: 'spider-man',      parents: [...MARVEL, 'animation', 'stylized-visuals'] }, // Паучьи вселенные
  558216: { slug: 'venom',           parents: [...MARVEL, 'creature-feature'] },
  748:    { slug: 'x-men',           parents: MARVEL },
  453993: { slug: 'wolverine',       parents: [...MARVEL, 'x-men'] },
  448150: { slug: 'deadpool',        parents: [...MARVEL, 'x-men', 'dark-comedy', 'stylized-violence'] },
  9744:   { slug: 'fantastic-four',  parents: MARVEL },

  // ── DC ────────────────────────────────────────────────────────
  263:    { slug: 'batman',          parents: [...DC, 'noir', 'vigilante'] },   // трилогия Нолана
  120794: { slug: 'batman',          parents: [...DC, 'vigilante'] },           // классические Бэтмены
  948485: { slug: 'batman',          parents: [...DC, 'noir', 'detective'] },   // «Бэтмен» Ривза
  8537:   { slug: 'superman',        parents: DC },
  468552: { slug: 'wonder-woman',    parents: DC },
  573693: { slug: 'aquaman',         parents: DC },
  702342: { slug: 'justice-league',  parents: [...DC, 'ensemble'] },
  987044: { slug: 'joker',           parents: [...DC, 'character-study', 'moral-decay'] },

  // ── Космос и фантастика ───────────────────────────────────────
  10:     { slug: 'star-wars',       parents: ['space-opera', 'epic-scale', 'sci-fi'] },
  302331: { slug: 'star-wars',       parents: ['space-opera', 'epic-scale', 'sci-fi'] },
  115575: { slug: 'star-trek',       parents: ['space-opera', 'sci-fi', 'ensemble'] },
  726871: { slug: 'dune',            parents: ['space-opera', 'epic-scale', 'sci-fi', 'philosophical'] },
  1709:   { slug: 'planet-of-apes',  parents: ['sci-fi', 'dystopia', 'epic-scale'] },
  173710: { slug: 'planet-of-apes',  parents: ['sci-fi', 'dystopia', 'epic-scale'] },
  2344:   { slug: 'matrix',          parents: ['cyberpunk', 'sci-fi', 'high-concept', 'choreographed-combat'] },
  528:    { slug: 'terminator',      parents: ['sci-fi', 'ai', 'kinetic-action', 'dystopia'] },
  324142: { slug: 'terminator',      parents: ['sci-fi', 'ai', 'kinetic-action', 'dystopia'] },
  422837: { slug: 'blade-runner',    parents: ['cyberpunk', 'sci-fi', 'philosophical', 'noir'] },

  // ── Фэнтези ───────────────────────────────────────────────────
  119:    { slug: 'middle-earth',    parents: ['epic-fantasy', 'epic-scale', 'journey'] },
  121938: { slug: 'middle-earth',    parents: ['epic-fantasy', 'epic-scale', 'journey'] },
  1241:   { slug: 'wizarding-world', parents: ['epic-fantasy', 'coming-of-age'] },
  435259: { slug: 'wizarding-world', parents: ['epic-fantasy'] },

  // ── Ужасы ─────────────────────────────────────────────────────
  91361:  { slug: 'halloween',       parents: ['slasher', 'horror'] },
  2602:   { slug: 'scream',          parents: ['slasher', 'horror', 'satire'] },
  9735:   { slug: 'friday-13th',     parents: ['slasher', 'horror'] },
  8581:   { slug: 'elm-street',      parents: ['slasher', 'horror', 'surreal'] },
  313086: { slug: 'conjuring',       parents: ['occult', 'horror', 'ghost'] },
  402074: { slug: 'conjuring',       parents: ['occult', 'horror', 'creature-feature'] },  // Аннабель
  228446: { slug: 'insidious',       parents: ['occult', 'horror', 'ghost'] },
  41437:  { slug: 'paranormal',      parents: ['found-footage', 'horror', 'ghost'] },
  477962: { slug: 'it',              parents: ['horror', 'coming-of-age', 'creature-feature'] },
  656:    { slug: 'saw',             parents: ['horror', 'gore', 'clockwork-plot'] },
  8864:   { slug: 'final-destination', parents: ['horror', 'gore'] },
  256322: { slug: 'purge',           parents: ['horror', 'dystopia', 'satire'] },
  17255:  { slug: 'resident-evil',   parents: ['zombie', 'horror', 'kinetic-action'] },
  2326:   { slug: 'underworld',      parents: ['vampire', 'werewolf', 'gothic'] },

  // ── Монстры и катастрофы ──────────────────────────────────────
  8091:   { slug: 'alien',           parents: ['creature-feature', 'sci-fi', 'dread', 'isolation'] },
  399:    { slug: 'predator',        parents: ['creature-feature', 'sci-fi', 'kinetic-action'] },
  827568: { slug: 'predator',        parents: ['creature-feature', 'sci-fi', 'survival'] },
  535313: { slug: 'monsterverse',    parents: ['creature-feature', 'spectacle'] },
  135498: { slug: 'king-kong',       parents: ['creature-feature', 'spectacle'] },
  363369: { slug: 'pacific-rim',     parents: ['creature-feature', 'spectacle', 'sci-fi'] },
  328:    { slug: 'jurassic',        parents: ['creature-feature', 'adventure', 'spectacle'] },
  752941: { slug: 'jurassic',        parents: ['creature-feature', 'adventure', 'spectacle'] },

  // ── Шпионы и боевики ──────────────────────────────────────────
  645:    { slug: 'james-bond',      parents: ['spy', 'globetrotting', 'kinetic-action'] },
  87359:  { slug: 'mission-impossible', parents: ['spy', 'kinetic-action', 'technical-showcase'] },
  31562:  { slug: 'bourne',          parents: ['spy', 'kinetic-action', 'procedural'] },
  391860: { slug: 'kingsman',        parents: ['spy', 'dark-comedy', 'stylized-violence'] },
  404609: { slug: 'john-wick',       parents: ['gun-fu', 'assassin', 'stylized-violence', 'revenge'] },
  523855: { slug: 'equalizer',       parents: ['vigilante', 'assassin', 'revenge'] },
  135483: { slug: 'taken',           parents: ['vigilante', 'kinetic-action', 'revenge'] },
  126125: { slug: 'expendables',     parents: ['ensemble', 'kinetic-action'] },
  1570:   { slug: 'die-hard',        parents: ['kinetic-action', 'confinement'] },
  5039:   { slug: 'rambo',           parents: ['kinetic-action', 'war', 'survival'] },
  125570: { slug: '300',             parents: ['stylized-visuals', 'war', 'epic-scale'] },
  179892: { slug: 'kick-ass',        parents: ['superhero', 'dark-comedy', 'stylized-violence'] },

  // ── Скорость и техника ────────────────────────────────────────
  9485:   { slug: 'fast-furious',    parents: ['car-chase', 'motorsport', 'crew-dynamics', 'kinetic-action'] },
  8945:   { slug: 'mad-max',         parents: ['post-apocalyptic', 'car-chase', 'kinetic-action'] },
  8650:   { slug: 'transformers',    parents: ['spectacle', 'sci-fi', 'kinetic-action'] },
  506229: { slug: 'gi-joe',          parents: ['spectacle', 'kinetic-action', 'ensemble'] },

  // ── Ограбления и авантюры ─────────────────────────────────────
  304:    { slug: 'oceans',          parents: ['heist', 'crew-dynamics', 'charisma-lead'] },
  382685: { slug: 'now-you-see-me',  parents: ['heist', 'clockwork-plot', 'plot-twist'] },
  84:     { slug: 'indiana-jones',   parents: ['adventure', 'journey', 'historical'] },
  1733:   { slug: 'mummy',           parents: ['adventure', 'creature-feature', 'occult'] },
  138965: { slug: 'mummy',           parents: ['adventure', 'creature-feature', 'occult'] },
  2467:   { slug: 'tomb-raider',     parents: ['adventure', 'kinetic-action'] },
  52984:  { slug: 'national-treasure', parents: ['adventure', 'clockwork-plot'] },
  295:    { slug: 'pirates',         parents: ['adventure', 'journey', 'fantasy'] },
  102322: { slug: 'sherlock',        parents: ['detective', 'whodunit', 'period-drama'] },

  // ── Боевые искусства и напарники ──────────────────────────────
  70068:  { slug: 'ip-man',          parents: ['martial-arts', 'biopic', 'honor-duty'] },
  90863:  { slug: 'rush-hour',       parents: ['buddy', 'martial-arts', 'comedy'] },
  945:    { slug: 'lethal-weapon',   parents: ['buddy', 'police', 'kinetic-action'] },
  14890:  { slug: 'bad-boys',        parents: ['buddy', 'police', 'kinetic-action'] },
  86055:  { slug: 'men-in-black',    parents: ['buddy', 'sci-fi', 'comedy'] },
  2883:   { slug: 'kill-bill',       parents: ['revenge', 'stylized-violence', 'martial-arts', 'samurai'] },

  // ── Криминал ──────────────────────────────────────────────────
  230:    { slug: 'godfather',       parents: ['mafia', 'epic-scale', 'family-drama', 'power-corruption'] },
  135179: { slug: 'sin-city',        parents: ['noir', 'stylized-visuals', 'comic-adaptation'] },
  496796: { slug: 'sicario',         parents: ['drug-trade', 'procedural', 'bleak-world'] },

  // ── Подростковые антиутопии ───────────────────────────────────
  131635: { slug: 'hunger-games',    parents: ['ya-dystopia', 'dystopia', 'survival'] },
  283579: { slug: 'divergent',       parents: ['ya-dystopia', 'dystopia'] },
  295130: { slug: 'maze-runner',     parents: ['ya-dystopia', 'dystopia', 'survival'] },
  33514:  { slug: 'twilight',        parents: ['ya-dystopia', 'vampire', 'romance-drama'] },

  // ── Анимация ──────────────────────────────────────────────────
  10194:  { slug: 'toy-story',       parents: ['pixar', 'animation', 'family', 'feel-good'] },
  137697: { slug: 'finding-nemo',    parents: ['pixar', 'animation', 'family', 'journey'] },
  137696: { slug: 'monsters-inc',    parents: ['pixar', 'animation', 'family'] },
  87118:  { slug: 'cars',            parents: ['pixar', 'animation', 'family'] },
  1022790:{ slug: 'inside-out',      parents: ['pixar', 'animation', 'family', 'emotional-weight'] },
  2150:   { slug: 'shrek',           parents: ['animation', 'family', 'parody', 'fantasy'] },
  86066:  { slug: 'despicable-me',   parents: ['animation', 'family', 'comedy'] },
  8354:   { slug: 'ice-age',         parents: ['animation', 'family', 'comedy'] },
  77816:  { slug: 'kung-fu-panda',   parents: ['animation', 'family', 'martial-arts'] },
  89137:  { slug: 'httyd',           parents: ['animation', 'family', 'fantasy', 'tenderness'] },
  386382: { slug: 'frozen',          parents: ['disney', 'animation', 'family', 'musical'] },
  94032:  { slug: 'lion-king',       parents: ['disney', 'animation', 'family', 'emotional-weight'] },

  // ── Комедии ───────────────────────────────────────────────────
  86119:  { slug: 'hangover',        parents: ['comedy', 'single-night', 'buddy'] },
  2806:   { slug: 'american-pie',    parents: ['comedy', 'coming-of-age'] },
  1006:   { slug: 'austin-powers',   parents: ['comedy', 'parody', 'spy'] },
  266672: { slug: 'ted',             parents: ['comedy', 'dark-comedy'] },
  352789: { slug: 'zoolander',       parents: ['comedy', 'parody', 'satire'] },
  212562: { slug: 'jump-street',     parents: ['comedy', 'buddy', 'police', 'parody'] },

  // ── Прочее ────────────────────────────────────────────────────
  264:    { slug: 'back-to-future',  parents: ['time-travel', 'comedy', 'sci-fi'] },
  1575:   { slug: 'rocky',           parents: ['sports', 'underdog', 'emotional-weight'] },
  694606: { slug: 'rocky',           parents: ['sports', 'underdog', 'emotional-weight'] },  // Крид
  2980:   { slug: 'ghostbusters',    parents: ['comedy', 'occult', 'ensemble'] },
  8580:   { slug: 'karate-kid',      parents: ['martial-arts', 'underdog', 'coming-of-age'] },
};

/* ────────────────────────────────────────────────────────────────
   Авторы: почерк как повод показать «ещё такого»
   ──────────────────────────────────────────────────────────────── */

/** @type {Record<number, {slug: string, style: string[]}>} */
export const DIRECTORS = {
  525:    { slug: 'nolan',        style: ['mind-bending', 'high-concept', 'nonlinear', 'epic-scale'] },
  138:    { slug: 'tarantino',    style: ['nonlinear', 'stylized-violence', 'dialogue-driven', 'dark-comedy'] },
  137427: { slug: 'villeneuve',   style: ['slow-burn', 'awe', 'bleak-world', 'high-concept'] },
  7467:   { slug: 'fincher',      style: ['psychological', 'serial-killer', 'procedural', 'shadow-aesthetic'] },
  1032:   { slug: 'scorsese',     style: ['mafia', 'moral-decay', 'character-study', 'urban-crime'] },
  488:    { slug: 'spielberg',    style: ['spectacle', 'adventure', 'awe', 'family'] },
  240:    { slug: 'kubrick',      style: ['philosophical', 'stylized-visuals', 'dread', 'slow-burn'] },
  578:    { slug: 'ridley-scott', style: ['epic-scale', 'sci-fi', 'dread', 'historical'] },
  5655:   { slug: 'wes-anderson', style: ['craft-aesthetic', 'stylized-visuals', 'dark-comedy', 'ensemble'] },
  1223:   { slug: 'coen',         style: ['dark-comedy', 'moral-decay', 'crime', 'satire'] },
  4762:   { slug: 'pta',          style: ['character-study', 'dialogue-driven', 'emotional-weight'] },
  608:    { slug: 'miyazaki',     style: ['hand-drawn', 'awe', 'tenderness', 'fantasy'] },
  5026:   { slug: 'kurosawa',     style: ['samurai', 'honor-duty', 'epic-scale', 'feudal-japan'] },
  21183:  { slug: 'refn',         style: ['neon-aesthetic', 'stylized-violence', 'slow-burn'] },
  6431:   { slug: 'aronofsky',    style: ['psychological', 'body-horror', 'emotional-weight'] },
  291263: { slug: 'peele',        style: ['psychological', 'satire', 'dread'] },
  2710:   { slug: 'cameron',      style: ['spectacle', 'epic-scale', 'sci-fi'] },
  10828:  { slug: 'del-toro',     style: ['dark-fantasy', 'creature-feature', 'gothic', 'craft-aesthetic'] },
  956:    { slug: 'guy-ritchie',  style: ['crew-dynamics', 'dark-comedy', 'urban-crime', 'clockwork-plot'] },
  11090:  { slug: 'edgar-wright', style: ['kinetic-action', 'intellectual-humour', 'parody'] },
  15217:  { slug: 'snyder',       style: ['stylized-visuals', 'spectacle', 'superhero'] },
  865:    { slug: 'michael-bay',  style: ['spectacle', 'kinetic-action'] },
  1145520:{ slug: 'ari-aster',    style: ['dread', 'occult', 'psychological'] },
  138781: { slug: 'eggers',       style: ['gothic', 'dread', 'historical', 'craft-aesthetic'] },
  21684:  { slug: 'bong',         style: ['satire', 'korea', 'moral-decay', 'dark-comedy'] },
  10099:  { slug: 'park-chan-wook', style: ['revenge', 'korea', 'stylized-violence', 'psychological'] },
  5602:   { slug: 'lynch',        style: ['surreal', 'dread', 'experimental'] },
  30715:  { slug: 'malick',       style: ['landscape', 'philosophical', 'slow-burn'] },
  122423: { slug: 'lanthimos',    style: ['surreal', 'dark-comedy', 'dread'] },
  136495: { slug: 'chazelle',     style: ['music-scene', 'discipline', 'emotional-weight'] },
  45400:  { slug: 'gerwig',       style: ['coming-of-age', 'character-study', 'tenderness'] },
  67367:  { slug: 'rian-johnson', style: ['whodunit', 'clockwork-plot', 'plot-twist'] },
  55934:  { slug: 'waititi',      style: ['dark-comedy', 'feel-good', 'intellectual-humour'] },
  15218:  { slug: 'james-gunn',   style: ['ensemble', 'feel-good', 'superhero', 'music-scene'] },
  7623:   { slug: 'raimi',        style: ['horror', 'creature-feature', 'superhero'] },
  11770:  { slug: 'carpenter',    style: ['dread', 'creature-feature', 'neon-aesthetic'] },
  20629:  { slug: 'george-miller',style: ['kinetic-action', 'post-apocalyptic', 'spectacle'] },
  4385:   { slug: 'leone',        style: ['western', 'frontier', 'slow-burn'] },
  2636:   { slug: 'hitchcock',    style: ['suspense', 'psychological', 'whodunit'] },
  510:    { slug: 'burton',       style: ['gothic', 'dark-fantasy', 'craft-aesthetic'] },
  108:    { slug: 'jackson',      style: ['epic-scale', 'fantasy', 'spectacle'] },
  223:    { slug: 'inarritu',     style: ['emotional-weight', 'character-study', 'survival'] },
  11218:  { slug: 'cuaron',       style: ['technical-showcase', 'emotional-weight', 'isolation'] },
  5281:   { slug: 'spike-lee',    style: ['urban-usa', 'political', 'character-study'] },
  2034:   { slug: 'danny-boyle',  style: ['kinetic-action', 'survival', 'addiction'] },
  1614:   { slug: 'ang-lee',      style: ['emotional-weight', 'martial-arts', 'character-study'] },
  8452:   { slug: 'tarkovsky',    style: ['philosophical', 'slow-burn', 'surreal'] },
  42:     { slug: 'von-trier',    style: ['bleak-world', 'psychological', 'experimental'] },
  14597:  { slug: 'gaspar-noe',   style: ['experimental', 'dread', 'stylized-visuals'] },
  24:     { slug: 'zemeckis',     style: ['time-travel', 'spectacle', 'feel-good'] },
  190:    { slug: 'eastwood',     style: ['western', 'moral-weight', 'character-study'] },
  1776:   { slug: 'coppola',      style: ['mafia', 'epic-scale', 'moral-decay'] },
  1150:   { slug: 'de-palma',     style: ['suspense', 'stylized-visuals', 'urban-crime'] },
  10491:  { slug: 'verhoeven',    style: ['satire', 'stylized-violence', 'sci-fi'] },
  59:     { slug: 'besson',       style: ['kinetic-action', 'stylized-visuals', 'assassin'] },
  12453:  { slug: 'wong-kar-wai', style: ['melancholy', 'romance-drama', 'stylized-visuals'] },
  3317:   { slug: 'kitano',       style: ['yakuza', 'japan', 'stylized-violence'] },
  25236:  { slug: 'johnnie-to',   style: ['hong-kong', 'gunfight', 'underworld'] },
  32278:  { slug: 'matt-reeves',  style: ['noir', 'superhero', 'dread'] },
  57130:  { slug: 'todd-phillips',style: ['dark-comedy', 'character-study'] },
  40644:  { slug: 'stahelski',    style: ['gun-fu', 'choreographed-combat', 'assassin'] },
};

/** Подписи для интерфейса: тег франшизы должен читаться как название. */
export const FRANCHISE_LABELS_RU = {
  'mcu': 'киновселенная Marvel', 'marvel': 'Marvel', 'dc': 'DC',
  'superhero': 'супергерои', 'comic-adaptation': 'по комиксу',
  'spider-man': 'Человек-паук', 'avengers': 'Мстители', 'iron-man': 'Железный человек',
  'captain-america': 'Капитан Америка', 'thor': 'Тор', 'guardians': 'Стражи Галактики',
  'ant-man': 'Человек-муравей', 'doctor-strange': 'Доктор Стрэндж', 'black-panther': 'Чёрная Пантера',
  'x-men': 'Люди Икс', 'wolverine': 'Росомаха', 'deadpool': 'Дэдпул', 'fantastic-four': 'Фантастическая четвёрка',
  'batman': 'Бэтмен', 'superman': 'Супермен', 'wonder-woman': 'Чудо-женщина', 'aquaman': 'Аквамен',
  'justice-league': 'Лига справедливости', 'joker': 'Джокер',
  'star-wars': 'Звёздные войны', 'star-trek': 'Звёздный путь', 'dune': 'Дюна',
  'planet-of-apes': 'Планета обезьян', 'matrix': 'Матрица', 'terminator': 'Терминатор',
  'blade-runner': 'Бегущий по лезвию', 'middle-earth': 'Средиземье', 'wizarding-world': 'Волшебный мир',
  'epic-fantasy': 'эпическое фэнтези', 'space-opera': 'космоопера',
  'halloween': 'Хэллоуин', 'scream': 'Крик', 'friday-13th': 'Пятница 13-е', 'elm-street': 'Кошмар на улице Вязов',
  'conjuring': 'Заклятие', 'insidious': 'Астрал', 'paranormal': 'Паранормальное явление',
  'it': 'Оно', 'saw': 'Пила', 'final-destination': 'Пункт назначения', 'purge': 'Судная ночь',
  'resident-evil': 'Обитель зла', 'underworld': 'Другой мир',
  'alien': 'Чужой', 'predator': 'Хищник', 'monsterverse': 'Годзилла', 'king-kong': 'Кинг-Конг',
  'pacific-rim': 'Тихоокеанский рубеж', 'jurassic': 'Парк юрского периода',
  'james-bond': 'Джеймс Бонд', 'mission-impossible': 'Миссия невыполнима', 'bourne': 'Борн',
  'kingsman': 'Kingsman', 'john-wick': 'Джон Уик', 'equalizer': 'Великий уравнитель',
  'taken': 'Заложница', 'expendables': 'Неудержимые', 'die-hard': 'Крепкий орешек',
  'rambo': 'Рэмбо', '300': '300 спартанцев', 'kick-ass': 'Пипец',
  'fast-furious': 'Форсаж', 'mad-max': 'Безумный Макс', 'transformers': 'Трансформеры', 'gi-joe': 'G.I. Joe',
  'oceans': 'Друзья Оушена', 'now-you-see-me': 'Иллюзия обмана', 'indiana-jones': 'Индиана Джонс',
  'mummy': 'Мумия', 'tomb-raider': 'Лара Крофт', 'national-treasure': 'Сокровище нации',
  'pirates': 'Пираты Карибского моря', 'sherlock': 'Шерлок Холмс',
  'ip-man': 'Ип Ман', 'rush-hour': 'Час пик', 'lethal-weapon': 'Смертельное оружие',
  'bad-boys': 'Плохие парни', 'men-in-black': 'Люди в чёрном', 'kill-bill': 'Убить Билла',
  'godfather': 'Крёстный отец', 'sin-city': 'Город грехов', 'sicario': 'Убийца',
  'hunger-games': 'Голодные игры', 'divergent': 'Дивергент', 'maze-runner': 'Бегущий в лабиринте',
  'twilight': 'Сумерки', 'ya-dystopia': 'подростковая антиутопия',
  'toy-story': 'История игрушек', 'finding-nemo': 'В поисках Немо', 'monsters-inc': 'Корпорация монстров',
  'cars': 'Тачки', 'inside-out': 'Головоломка', 'shrek': 'Шрек', 'despicable-me': 'Гадкий я',
  'ice-age': 'Ледниковый период', 'kung-fu-panda': 'Кунг-фу Панда', 'httyd': 'Как приручить дракона',
  'frozen': 'Холодное сердце', 'lion-king': 'Король Лев', 'pixar': 'Pixar', 'disney': 'Disney',
  'hangover': 'Мальчишник', 'american-pie': 'Американский пирог', 'austin-powers': 'Остин Пауэрс',
  'ted': 'Тед', 'zoolander': 'Образцовый самец', 'jump-street': 'Мачо и ботан',
  'back-to-future': 'Назад в будущее', 'rocky': 'Рокки',
  'venom': 'Веном', 'ghostbusters': 'Охотники за привидениями', 'karate-kid': 'Карате-пацан',

  // Авторы
  'nolan': 'Кристофер Нолан', 'tarantino': 'Квентин Тарантино', 'villeneuve': 'Дени Вильнёв',
  'fincher': 'Дэвид Финчер', 'scorsese': 'Мартин Скорсезе', 'spielberg': 'Стивен Спилберг',
  'kubrick': 'Стэнли Кубрик', 'ridley-scott': 'Ридли Скотт', 'wes-anderson': 'Уэс Андерсон',
  'coen': 'братья Коэн', 'pta': 'Пол Томас Андерсон', 'miyazaki': 'Хаяо Миядзаки',
  'kurosawa': 'Акира Куросава', 'refn': 'Николас Виндинг Рефн', 'aronofsky': 'Даррен Аронофски',
  'peele': 'Джордан Пил', 'cameron': 'Джеймс Кэмерон', 'del-toro': 'Гильермо дель Торо',
  'guy-ritchie': 'Гай Ричи', 'edgar-wright': 'Эдгар Райт', 'snyder': 'Зак Снайдер',
  'michael-bay': 'Майкл Бэй', 'ari-aster': 'Ари Астер', 'eggers': 'Роберт Эггерс',
  'bong': 'Пон Чжун Хо', 'park-chan-wook': 'Пак Чхан Ук', 'lynch': 'Дэвид Линч',
  'malick': 'Терренс Малик', 'lanthimos': 'Йоргос Лантимос', 'chazelle': 'Дэмьен Шазелл',
  'gerwig': 'Грета Гервиг', 'rian-johnson': 'Райан Джонсон', 'waititi': 'Тайка Вайтити',
  'james-gunn': 'Джеймс Ганн', 'raimi': 'Сэм Рэйми', 'carpenter': 'Джон Карпентер',
  'george-miller': 'Джордж Миллер', 'leone': 'Серджо Леоне', 'hitchcock': 'Альфред Хичкок',
  'burton': 'Тим Бёртон', 'jackson': 'Питер Джексон', 'inarritu': 'Алехандро Иньярриту',
  'cuaron': 'Альфонсо Куарон', 'spike-lee': 'Спайк Ли', 'danny-boyle': 'Дэнни Бойл',
  'ang-lee': 'Энг Ли', 'tarkovsky': 'Андрей Тарковский', 'von-trier': 'Ларс фон Триер',
  'gaspar-noe': 'Гаспар Ноэ', 'zemeckis': 'Роберт Земекис', 'eastwood': 'Клинт Иствуд',
  'coppola': 'Фрэнсис Форд Коппола', 'de-palma': 'Брайан Де Пальма', 'verhoeven': 'Пол Верховен',
  'besson': 'Люк Бессон', 'wong-kar-wai': 'Вонг Карвай', 'kitano': 'Такэси Китано',
  'johnnie-to': 'Джонни То', 'matt-reeves': 'Мэтт Ривз', 'todd-phillips': 'Тодд Филлипс',
  'stahelski': 'Чад Стахелски',
};

/**
 * Собирает теги франшизы и автора для одного фильма.
 * @returns {Record<string, number>} тег -> вес
 */
export function franchiseTags({ collectionId, directorIds = [] } = {}) {
  const tags = Object.create(null);
  const add = (tag, weight) => {
    if (!tag) return;
    tags[tag] = Math.max(tags[tag] ?? 0, weight);
  };

  const franchise = FRANCHISES[collectionId];
  if (franchise) {
    add(franchise.slug, FRANCHISE_WEIGHT);
    for (const parent of franchise.parents) {
      // Вселенная весит больше широкой темы: «ещё Marvel» ближе к запросу,
      // чем «ещё супергерои».
      const isUniverse = ['mcu', 'marvel', 'dc', 'pixar', 'disney'].includes(parent);
      add(parent, isUniverse ? UNIVERSE_WEIGHT : THEME_WEIGHT);
    }
  } else if (collectionId) {
    // Франшиза, которой нет в справочнике, всё равно должна связывать
    // свои части между собой — иерархии не будет, но это лучше, чем ничего.
    add(`collection-${collectionId}`, FRANCHISE_WEIGHT);
  }

  for (const personId of directorIds) {
    const director = DIRECTORS[personId];
    if (!director) continue;
    add(director.slug, DIRECTOR_WEIGHT);
    for (const style of director.style) add(style, DIRECTOR_STYLE_WEIGHT);
  }

  return tags;
}
