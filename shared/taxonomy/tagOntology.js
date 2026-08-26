/**
 * MatchWatch — онтология тегов.
 *
 * Зачем: жанры TMDB слишком грубые. «Боевик» не отличает «Семь самураев»
 * от «Форсажа». Поэтому каждый тайтл получает `tags: { тег: вес 0..100 }`,
 * собранный из трёх источников:
 *
 *   1. TMDB `/movie/{id}/keywords` — основной источник (детальные темы,
 *      сеттинги, поджанры: samurai, heist, time-travel, sword-fight).
 *   2. Жанры TMDB — фоновый слой малого веса (грубый, но всегда есть).
 *   3. Правила обогащения ниже — доводят то, чего в TMDB нет:
 *      культурный контекст, эстетика, тематические связки.
 *
 * Правило расширения работает так: если у тайтла есть тег `samurai`,
 * он автоматически получает `feudal-japan`, `honor-duty`, `period-action`
 * с производными весами. Именно это даёт поведение из ТЗ: лайкая
 * самурайское кино, пользователь поднимает не жанр «боевик», а узкий кластер.
 */

import { FRANCHISE_LABELS_RU } from './franchises.js';

/** Базовый вес тега, пришедшего напрямую из TMDB keywords. */
export const KEYWORD_BASE_WEIGHT = 72;
/** Вес тега, выведенного из жанра TMDB (грубый сигнал — низкий вес). */
export const GENRE_BASE_WEIGHT = 34;
/** Максимальный вес тега у тайтла. */
export const MAX_TAG_WEIGHT = 100;

/** Жанр TMDB -> дополнительные семантические теги. */
export const GENRE_TAGS = {
  28: ['action'],
  12: ['adventure', 'journey'],
  16: ['animation'],
  35: ['comedy'],
  80: ['crime'],
  99: ['documentary'],
  18: ['drama', 'character-study'],
  10751: ['family'],
  14: ['fantasy'],
  36: ['historical'],
  27: ['horror'],
  10402: ['music'],
  9648: ['mystery', 'whodunit'],
  10749: ['romance'],
  878: ['sci-fi'],
  53: ['thriller', 'suspense'],
  10752: ['war'],
  37: ['western', 'frontier'],
};

/**
 * Нормализация сырого ключевого слова TMDB в канонический слаг.
 * TMDB отдаёт «Sword Fight», «sword fight», «swordfight» — это один тег.
 */
export function slugifyTag(raw) {
  if (!raw) return null;
  const slug = String(raw)
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (!slug || slug.length < 2) return null;
  return TAG_ALIASES[slug] ?? slug;
}

/** Синонимы TMDB, которые надо схлопнуть в один канонический тег. */
export const TAG_ALIASES = {
  'samurai': 'samurai',
  'ronin': 'samurai',
  'swordfight': 'sword-fight',
  'sword-fighting': 'sword-fight',
  'swordplay': 'sword-fight',
  'katana': 'sword-fight',
  'duel': 'sword-fight',
  'feudal-japan': 'feudal-japan',
  'edo-period': 'feudal-japan',
  'sengoku-period': 'feudal-japan',
  'japan': 'japan',
  'martial-arts': 'martial-arts',
  'kung-fu': 'martial-arts',
  'wuxia': 'martial-arts',
  'gun-fu': 'gun-fu',
  'gunfight': 'gunfight',
  'shootout': 'gunfight',
  'heist': 'heist',
  'bank-robbery': 'heist',
  'robbery': 'heist',
  'con-artist': 'con-artist',
  'time-travel': 'time-travel',
  'time-loop': 'time-loop',
  'space-travel': 'space',
  'outer-space': 'space',
  'spacecraft': 'space',
  'astronaut': 'space',
  'space-opera': 'space-opera',
  'dystopia': 'dystopia',
  'post-apocalyptic': 'post-apocalyptic',
  'post-apocalypse': 'post-apocalyptic',
  'artificial-intelligence': 'ai',
  'robot': 'robot',
  'android': 'robot',
  'cyberpunk': 'cyberpunk',
  'virtual-reality': 'virtual-reality',
  'serial-killer': 'serial-killer',
  'detective': 'detective',
  'private-investigator': 'detective',
  'police': 'police',
  'mafia': 'mafia',
  'organized-crime': 'mafia',
  'yakuza': 'yakuza',
  'gangster': 'mafia',
  'drug-cartel': 'drug-trade',
  'drug-dealer': 'drug-trade',
  'prison': 'prison',
  'courtroom': 'courtroom',
  'revenge': 'revenge',
  'vigilante': 'vigilante',
  'assassin': 'assassin',
  'hitman': 'assassin',
  'spy': 'spy',
  'espionage': 'spy',
  'cold-war': 'cold-war',
  'world-war-ii': 'wwii',
  'world-war-i': 'wwi',
  'vietnam-war': 'vietnam-war',
  'holocaust': 'holocaust',
  'zombie': 'zombie',
  'vampire': 'vampire',
  'werewolf': 'werewolf',
  'ghost': 'ghost',
  'haunted-house': 'haunted-house',
  'exorcism': 'occult',
  'demon': 'occult',
  'witch': 'occult',
  'slasher': 'slasher',
  'found-footage': 'found-footage',
  'body-horror': 'body-horror',
  'psychological-thriller': 'psychological',
  'psychological-horror': 'psychological',
  'mind-bending': 'mind-bending',
  'nonlinear-timeline': 'nonlinear',
  'unreliable-narrator': 'unreliable-narrator',
  'plot-twist': 'plot-twist',
  'coming-of-age': 'coming-of-age',
  'high-school': 'high-school',
  'college': 'coming-of-age',
  'friendship': 'friendship',
  'family-relationships': 'family-drama',
  'father-son-relationship': 'family-drama',
  'mother-daughter-relationship': 'family-drama',
  'dysfunctional-family': 'family-drama',
  'love-triangle': 'romance-drama',
  'romantic-comedy': 'romcom',
  'wedding': 'romance-drama',
  'divorce': 'family-drama',
  'grief': 'grief',
  'depression': 'melancholy',
  'mental-illness': 'mental-health',
  'addiction': 'addiction',
  'biography': 'biopic',
  'based-on-true-story': 'true-story',
  'based-on-novel-or-book': 'literary-adaptation',
  'based-on-comic': 'comic-adaptation',
  'based-on-graphic-novel': 'comic-adaptation',
  'superhero': 'superhero',
  'marvel-cinematic-universe': 'superhero',
  'dc-comics': 'superhero',
  'sequel': 'franchise',
  'remake': 'franchise',
  'road-movie': 'road-movie',
  'survival': 'survival',
  'wilderness': 'wilderness',
  'mountain': 'wilderness',
  'ocean': 'ocean',
  'shark': 'creature-feature',
  'monster': 'creature-feature',
  'kaiju': 'creature-feature',
  'giant-monster': 'creature-feature',
  'dinosaur': 'creature-feature',
  'heist-gone-wrong': 'heist',
  'one-night': 'single-night',
  'single-location': 'chamber-piece',
  'chamber-drama': 'chamber-piece',
  'satire': 'satire',
  'dark-comedy': 'dark-comedy',
  'black-comedy': 'dark-comedy',
  'parody': 'parody',
  'slapstick': 'slapstick',
  'silent-film': 'silent-film',
  'film-noir': 'noir',
  'neo-noir': 'noir',
  'neo-western': 'western',
  'spaghetti-western': 'western',
  'car-chase': 'car-chase',
  'street-racing': 'motorsport',
  'racing': 'motorsport',
  'boxing': 'sports',
  'sport': 'sports',
  'basketball': 'sports',
  'football': 'sports',
  'chess': 'intellectual-game',
  'music-band': 'music-scene',
  'rock-music': 'music-scene',
  'jazz': 'music-scene',
  'musical': 'musical',
  'dance': 'dance',
  'anime': 'anime-style',
  'stop-motion': 'stop-motion',
  'hand-drawn-animation': 'hand-drawn',
  'christmas': 'holiday',
  'new-year': 'holiday',
  'halloween': 'holiday',
  'small-town': 'small-town',
  'new-york-city': 'urban-usa',
  'los-angeles': 'urban-usa',
  'paris-france': 'europe',
  'london-england': 'europe',
  'italy': 'europe',
  'india': 'india',
  'korea': 'korea',
  'china': 'china',
  'hong-kong': 'hong-kong',
  'soviet-union': 'post-soviet',
  'russia': 'post-soviet',
  'dark-fantasy': 'dark-fantasy',
  'sword-and-sorcery': 'sword-and-sorcery',
  'medieval': 'medieval',
  'knight': 'medieval',
  'mythology': 'mythology',
  'religion': 'religion',
  'philosophy': 'philosophical',
  'existentialism': 'philosophical',
  'surrealism': 'surreal',
  'experimental': 'experimental',
  'slow-burn': 'slow-burn',
  'one-take': 'technical-showcase',
  'long-take': 'technical-showcase',
  'practical-effects': 'technical-showcase',
  'ensemble-cast': 'ensemble',
  'buddy-cop': 'buddy',
  'buddy-comedy': 'buddy',
  'mockumentary': 'mockumentary',
  'anthology': 'anthology',
  'heist-crew': 'heist',
  'apocalypse': 'apocalyptic',
  'pandemic': 'apocalyptic',
  'climate-change': 'apocalyptic',
  'political-thriller': 'political',
  'politics': 'political',
  'journalism': 'journalism',
  'whistleblower': 'political',
  'corporate': 'corporate',
  'wall-street': 'corporate',
  'heir': 'aristocracy',
  'aristocracy': 'aristocracy',
  'period-drama': 'period-drama',
  'costume-drama': 'period-drama',
  'western-frontier': 'frontier',
};

/**
 * Правила расширения: наличие тега-ключа добавляет производные теги
 * с весом `вес_источника * коэффициент`.
 *
 * Это то, что закрывает пробел TMDB: культурный контекст и близкие темы.
 */
export const TAG_EXPANSIONS = {
  'samurai': [['feudal-japan', 0.85], ['sword-fight', 0.7], ['honor-duty', 0.8], ['period-action', 0.7], ['japan', 0.6]],
  'yakuza': [['japan', 0.7], ['mafia', 0.65], ['honor-duty', 0.5], ['urban-crime', 0.6]],
  'feudal-japan': [['japan', 0.8], ['period-drama', 0.6], ['honor-duty', 0.5]],
  'sword-fight': [['period-action', 0.55], ['choreographed-combat', 0.7]],
  'martial-arts': [['choreographed-combat', 0.8], ['discipline', 0.5], ['action', 0.5]],
  'gun-fu': [['choreographed-combat', 0.75], ['gunfight', 0.8], ['stylized-violence', 0.8]],
  'assassin': [['stylized-violence', 0.5], ['loner', 0.6], ['underworld', 0.6]],
  'heist': [['crew-dynamics', 0.75], ['clockwork-plot', 0.7], ['underworld', 0.5]],
  'con-artist': [['clockwork-plot', 0.6], ['charisma-lead', 0.6], ['underworld', 0.4]],
  'mafia': [['underworld', 0.8], ['family-drama', 0.4], ['power-corruption', 0.7]],
  'drug-trade': [['underworld', 0.7], ['power-corruption', 0.6], ['moral-decay', 0.6]],
  'time-travel': [['mind-bending', 0.7], ['high-concept', 0.8], ['sci-fi', 0.6]],
  'time-loop': [['time-travel', 0.8], ['mind-bending', 0.85], ['high-concept', 0.8]],
  'cyberpunk': [['dystopia', 0.75], ['neon-aesthetic', 0.9], ['tech-anxiety', 0.7], ['sci-fi', 0.6]],
  'ai': [['tech-anxiety', 0.8], ['philosophical', 0.6], ['sci-fi', 0.6]],
  'robot': [['ai', 0.6], ['sci-fi', 0.6]],
  'space-opera': [['space', 0.9], ['epic-scale', 0.8], ['adventure', 0.6]],
  'space': [['sci-fi', 0.7], ['isolation', 0.4], ['awe', 0.6]],
  'post-apocalyptic': [['survival', 0.8], ['bleak-world', 0.85], ['apocalyptic', 0.9]],
  'dystopia': [['bleak-world', 0.7], ['political', 0.6], ['tech-anxiety', 0.5]],
  'zombie': [['creature-feature', 0.6], ['survival', 0.7], ['apocalyptic', 0.7], ['gore', 0.6]],
  'vampire': [['occult', 0.6], ['gothic', 0.8], ['creature-feature', 0.5]],
  'werewolf': [['creature-feature', 0.7], ['gothic', 0.6], ['body-horror', 0.5]],
  'ghost': [['occult', 0.6], ['gothic', 0.6], ['slow-burn', 0.4]],
  'haunted-house': [['ghost', 0.8], ['chamber-piece', 0.5], ['gothic', 0.7]],
  'occult': [['gothic', 0.5], ['religion', 0.4], ['dread', 0.7]],
  'slasher': [['gore', 0.8], ['creature-feature', 0.3], ['dread', 0.6]],
  'body-horror': [['gore', 0.7], ['dread', 0.7], ['surreal', 0.5]],
  'serial-killer': [['psychological', 0.75], ['detective', 0.6], ['dread', 0.6]],
  'detective': [['whodunit', 0.7], ['procedural', 0.7], ['mystery', 0.6]],
  'police': [['procedural', 0.7], ['urban-crime', 0.6]],
  'spy': [['espionage-craft', 0.85], ['political', 0.5], ['globetrotting', 0.6]],
  'cold-war': [['political', 0.7], ['espionage-craft', 0.5], ['period-drama', 0.5]],
  'wwii': [['war', 0.85], ['historical', 0.8], ['moral-weight', 0.7]],
  'wwi': [['war', 0.85], ['historical', 0.8], ['moral-weight', 0.6]],
  'vietnam-war': [['war', 0.85], ['moral-weight', 0.7], ['bleak-world', 0.5]],
  'holocaust': [['historical', 0.8], ['moral-weight', 0.9], ['grief', 0.7]],
  'war': [['epic-scale', 0.5], ['moral-weight', 0.6]],
  'coming-of-age': [['character-study', 0.6], ['nostalgia', 0.6], ['tenderness', 0.6]],
  'high-school': [['coming-of-age', 0.7], ['nostalgia', 0.4]],
  'romcom': [['romance', 0.85], ['comedy', 0.7], ['feel-good', 0.8]],
  'romance-drama': [['romance', 0.85], ['tenderness', 0.6], ['character-study', 0.4]],
  'family-drama': [['character-study', 0.7], ['emotional-weight', 0.7]],
  'grief': [['emotional-weight', 0.85], ['melancholy', 0.8], ['character-study', 0.5]],
  'melancholy': [['slow-burn', 0.5], ['emotional-weight', 0.6]],
  'mental-health': [['psychological', 0.6], ['character-study', 0.7], ['emotional-weight', 0.6]],
  'addiction': [['moral-decay', 0.6], ['character-study', 0.6], ['emotional-weight', 0.6]],
  'biopic': [['true-story', 0.85], ['character-study', 0.7], ['historical', 0.4]],
  'superhero': [['comic-adaptation', 0.7], ['epic-scale', 0.6], ['spectacle', 0.8]],
  'noir': [['moral-decay', 0.6], ['urban-crime', 0.6], ['stylized-visuals', 0.8], ['shadow-aesthetic', 0.9]],
  'western': [['frontier', 0.8], ['honor-duty', 0.5], ['landscape', 0.7]],
  'medieval': [['period-drama', 0.6], ['sword-fight', 0.5], ['epic-scale', 0.4]],
  'sword-and-sorcery': [['fantasy', 0.8], ['medieval', 0.6], ['epic-scale', 0.6]],
  'dark-fantasy': [['fantasy', 0.8], ['gothic', 0.6], ['bleak-world', 0.5]],
  'mythology': [['epic-scale', 0.6], ['fantasy', 0.5], ['religion', 0.4]],
  'car-chase': [['kinetic-action', 0.9], ['spectacle', 0.6]],
  'motorsport': [['kinetic-action', 0.8], ['spectacle', 0.5], ['sports', 0.7]],
  'sports': [['underdog', 0.7], ['discipline', 0.6], ['feel-good', 0.5]],
  'musical': [['music-scene', 0.7], ['spectacle', 0.6], ['feel-good', 0.6]],
  'dance': [['music-scene', 0.6], ['discipline', 0.5], ['spectacle', 0.5]],
  'satire': [['dark-comedy', 0.6], ['political', 0.5], ['intellectual-humour', 0.8]],
  'dark-comedy': [['intellectual-humour', 0.6], ['moral-decay', 0.4]],
  'mockumentary': [['satire', 0.7], ['intellectual-humour', 0.6]],
  'philosophical': [['slow-burn', 0.5], ['high-concept', 0.6], ['intellectual-humour', 0.2]],
  'surreal': [['experimental', 0.7], ['mind-bending', 0.7], ['stylized-visuals', 0.7]],
  'mind-bending': [['high-concept', 0.7], ['nonlinear', 0.5]],
  'nonlinear': [['clockwork-plot', 0.6], ['mind-bending', 0.5]],
  'anime-style': [['animation', 0.9], ['japan', 0.6], ['stylized-visuals', 0.6]],
  'stop-motion': [['animation', 0.9], ['craft-aesthetic', 0.9]],
  'hand-drawn': [['animation', 0.9], ['craft-aesthetic', 0.7]],
  'survival': [['tension', 0.7], ['wilderness', 0.4]],
  'wilderness': [['landscape', 0.8], ['isolation', 0.6]],
  'ocean': [['landscape', 0.6], ['isolation', 0.5]],
  'road-movie': [['journey', 0.85], ['landscape', 0.6], ['character-study', 0.5]],
  'chamber-piece': [['tension', 0.6], ['dialogue-driven', 0.8], ['character-study', 0.6]],
  'courtroom': [['dialogue-driven', 0.8], ['procedural', 0.7], ['moral-weight', 0.6]],
  'prison': [['confinement', 0.9], ['moral-weight', 0.5], ['underworld', 0.4]],
  'political': [['moral-weight', 0.5], ['dialogue-driven', 0.5]],
  'journalism': [['procedural', 0.7], ['political', 0.6], ['true-story', 0.5]],
  'corporate': [['power-corruption', 0.7], ['moral-decay', 0.5]],
  'revenge': [['moral-weight', 0.5], ['tension', 0.6], ['loner', 0.5]],
  'vigilante': [['revenge', 0.7], ['urban-crime', 0.6], ['moral-weight', 0.5]],
  'period-drama': [['historical', 0.7], ['craft-aesthetic', 0.5]],
  'true-story': [['historical', 0.4], ['moral-weight', 0.3]],
  'ensemble': [['crew-dynamics', 0.6], ['dialogue-driven', 0.4]],
  'buddy': [['friendship', 0.8], ['comedy', 0.4]],
  'silent-film': [['craft-aesthetic', 0.8], ['stylized-visuals', 0.6], ['slapstick', 0.3]],
  'slapstick': [['comedy', 0.8], ['feel-good', 0.5]],
  'holiday': [['feel-good', 0.7], ['family', 0.6], ['nostalgia', 0.6]],
  'small-town': [['character-study', 0.5], ['nostalgia', 0.5]],
  'post-soviet': [['melancholy', 0.4], ['historical', 0.4]],
  'korea': [['tension', 0.3]],
  'hong-kong': [['kinetic-action', 0.5], ['choreographed-combat', 0.5]],
};

/**
 * Вклад тега в 5D-вектор настроения.
 * Значения — смещения от нейтральных 50 в диапазоне -50..+50.
 * Итог по тайтлу — взвешенное среднее вкладов всех его тегов.
 */
export const TAG_MOODS = {
  'action': { energy: 30, dynamism: 32 },
  'kinetic-action': { energy: 38, dynamism: 42 },
  'choreographed-combat': { energy: 30, dynamism: 35 },
  'gunfight': { energy: 28, dynamism: 30, darkness: 12 },
  'gun-fu': { energy: 34, dynamism: 38, darkness: 10 },
  'spectacle': { energy: 28, dynamism: 26 },
  'epic-scale': { energy: 22, dynamism: 18, emotion: 12 },
  'adventure': { energy: 24, dynamism: 22, emotion: 8 },
  'journey': { energy: 8, emotion: 16, dynamism: 6 },
  'comedy': { energy: 22, darkness: -26, emotion: 8 },
  'feel-good': { energy: 18, darkness: -34, emotion: 22 },
  'slapstick': { energy: 26, darkness: -30, intellect: -14 },
  'dark-comedy': { darkness: 18, intellect: 18, emotion: -6 },
  'satire': { intellect: 26, darkness: 10 },
  'intellectual-humour': { intellect: 28, energy: 6 },
  'parody': { energy: 14, intellect: 6, darkness: -20 },
  'horror': { darkness: 38, energy: 14, emotion: 10 },
  'dread': { darkness: 36, dynamism: -14, emotion: 12 },
  'gore': { darkness: 34, energy: 16 },
  'slasher': { darkness: 32, energy: 20, intellect: -12 },
  'body-horror': { darkness: 36, intellect: 10, emotion: 6 },
  'gothic': { darkness: 30, emotion: 14, intellect: 8 },
  'shadow-aesthetic': { darkness: 26, intellect: 12 },
  'occult': { darkness: 30, emotion: 8 },
  'bleak-world': { darkness: 38, emotion: 14, energy: -12 },
  'apocalyptic': { darkness: 32, energy: 10, emotion: 14 },
  'dystopia': { darkness: 30, intellect: 22 },
  'moral-decay': { darkness: 28, intellect: 14, emotion: 10 },
  'power-corruption': { darkness: 24, intellect: 20 },
  'psychological': { intellect: 30, darkness: 22, emotion: 16 },
  'mind-bending': { intellect: 38, darkness: 8 },
  'high-concept': { intellect: 34 },
  'philosophical': { intellect: 40, dynamism: -18, emotion: 8 },
  'experimental': { intellect: 32, dynamism: -12 },
  'surreal': { intellect: 28, darkness: 12, dynamism: -8 },
  'nonlinear': { intellect: 28, dynamism: 8 },
  'clockwork-plot': { intellect: 30, dynamism: 16 },
  'whodunit': { intellect: 28, dynamism: 4 },
  'procedural': { intellect: 24, dynamism: -4 },
  'dialogue-driven': { intellect: 26, dynamism: -22 },
  'slow-burn': { dynamism: -34, intellect: 18, emotion: 12 },
  'chamber-piece': { dynamism: -26, intellect: 20, emotion: 14 },
  'confinement': { dynamism: -20, darkness: 22, emotion: 14 },
  'tension': { darkness: 16, dynamism: 12, emotion: 10 },
  'suspense': { darkness: 18, dynamism: 10, intellect: 12 },
  'thriller': { darkness: 20, dynamism: 18, energy: 14 },
  'romance': { emotion: 36, darkness: -18, energy: 4 },
  'romcom': { emotion: 32, darkness: -28, energy: 16 },
  'tenderness': { emotion: 34, darkness: -20, dynamism: -10 },
  'emotional-weight': { emotion: 40, dynamism: -12 },
  'melancholy': { emotion: 30, darkness: 20, dynamism: -22, energy: -18 },
  'grief': { emotion: 42, darkness: 24, energy: -20 },
  'character-study': { emotion: 26, intellect: 22, dynamism: -18 },
  'coming-of-age': { emotion: 28, darkness: -10, intellect: 8 },
  'nostalgia': { emotion: 26, darkness: -12, dynamism: -12 },
  'family-drama': { emotion: 32, dynamism: -14 },
  'friendship': { emotion: 26, darkness: -16 },
  'moral-weight': { emotion: 26, intellect: 24, darkness: 16 },
  'historical': { intellect: 18, dynamism: -8 },
  'period-drama': { intellect: 16, dynamism: -16, emotion: 12 },
  'war': { darkness: 28, energy: 20, emotion: 20 },
  'sci-fi': { intellect: 26, energy: 10 },
  'tech-anxiety': { intellect: 26, darkness: 20 },
  'space': { intellect: 22, emotion: 12, energy: 8 },
  'awe': { emotion: 24, intellect: 16 },
  'isolation': { emotion: 20, darkness: 20, dynamism: -24 },
  'fantasy': { emotion: 20, intellect: 12, energy: 14 },
  'animation': { energy: 16, darkness: -14 },
  'craft-aesthetic': { intellect: 16, emotion: 12 },
  'stylized-visuals': { intellect: 14, energy: 12 },
  'neon-aesthetic': { energy: 20, darkness: 18, intellect: 10 },
  'landscape': { emotion: 16, dynamism: -10, intellect: 6 },
  'survival': { energy: 20, darkness: 20, dynamism: 14 },
  'underdog': { emotion: 26, energy: 18, darkness: -12 },
  'sports': { energy: 26, dynamism: 24, darkness: -10 },
  'discipline': { intellect: 16, energy: 12 },
  'music-scene': { energy: 22, emotion: 22 },
  'musical': { energy: 26, emotion: 24, darkness: -20 },
  'documentary': { intellect: 30, dynamism: -18 },
  'true-story': { intellect: 14, emotion: 12 },
  'crime': { darkness: 22, dynamism: 12 },
  'urban-crime': { darkness: 24, energy: 14 },
  'underworld': { darkness: 26, intellect: 8 },
  'heist': { intellect: 24, dynamism: 26, energy: 20 },
  'espionage-craft': { intellect: 28, dynamism: 14, darkness: 12 },
  'political': { intellect: 26, dynamism: -10 },
  'western': { darkness: 12, dynamism: -6, intellect: 10 },
  'frontier': { emotion: 12, dynamism: -8 },
  'loner': { emotion: 14, darkness: 18, dynamism: -10 },
  'revenge': { darkness: 24, energy: 20, emotion: 18 },
  'honor-duty': { emotion: 22, intellect: 18, darkness: 8 },
  'samurai': { intellect: 20, emotion: 18, darkness: 12, dynamism: 6 },
  'stylized-violence': { energy: 26, darkness: 18, dynamism: 22 },
  'creature-feature': { energy: 22, darkness: 22 },
  'superhero': { energy: 30, dynamism: 26, darkness: -6 },
  'family': { emotion: 22, darkness: -30, intellect: -6 },
  'holiday': { emotion: 24, darkness: -34 },
  'mystery': { intellect: 26, darkness: 14 },
  'noir': { darkness: 28, intellect: 24, dynamism: -8 },
};

/** Жанр TMDB -> базовое смещение настроения (когда тегов мало). */
export const GENRE_MOODS = {
  28: { energy: 28, dynamism: 30 },
  12: { energy: 22, dynamism: 20, emotion: 10 },
  16: { energy: 14, darkness: -16 },
  35: { energy: 20, darkness: -26 },
  80: { darkness: 24, dynamism: 10 },
  99: { intellect: 30, dynamism: -20 },
  18: { emotion: 30, dynamism: -16 },
  10751: { emotion: 20, darkness: -30 },
  14: { emotion: 18, intellect: 12, energy: 12 },
  36: { intellect: 20, dynamism: -12 },
  27: { darkness: 38, energy: 12 },
  10402: { emotion: 22, energy: 20 },
  9648: { intellect: 26, darkness: 14 },
  10749: { emotion: 34, darkness: -18 },
  878: { intellect: 26, energy: 10 },
  53: { darkness: 20, dynamism: 18, energy: 14 },
  10752: { darkness: 26, emotion: 20, energy: 18 },
  37: { darkness: 10, intellect: 8, dynamism: -6 },
};

/**
 * Досыпка вкладов тем тегам, которые их не имели.
 *
 * Без вклада в настроение тег работает только прямым совпадением,
 * а ниже жанрового слоя каталог почти пуст: `slow-burn` стоит у пяти
 * фильмов из тысячи восьмисот. Вклад в оси работает у всех — вектор
 * настроения есть у каждого тайтла без исключения.
 *
 * Поэтому сюда попали только те теги, которые настроение действительно
 * несут. Место действия и формат — `japan`, `europe`, `stop-motion`,
 * `franchise` — оставлены без вклада намеренно: японское кино бывает
 * и нежным, и беспросветным, и приписывать им общий тон значило бы
 * врать о половине каталога.
 */
Object.assign(TAG_MOODS, {
  'drama': { emotion: 24, intellect: 10, energy: -8 },
  'music': { emotion: 24, energy: 14 },

  // ── Криминал и его тон ──────────────────────────────────────────
  'yakuza': { darkness: 30, dynamism: 18, energy: 12 },
  'mafia': { darkness: 26, intellect: 14, emotion: 10 },
  'drug-trade': { darkness: 32, emotion: 8 },
  'serial-killer': { darkness: 42, intellect: 18, dynamism: -6 },
  'assassin': { darkness: 24, dynamism: 30, energy: 22 },
  'detective': { intellect: 30, darkness: 14, dynamism: -8 },
  'police': { dynamism: 14, darkness: 12 },
  'spy': { intellect: 26, dynamism: 20, darkness: 12 },
  'cold-war': { intellect: 24, darkness: 20, dynamism: -10 },
  'con-artist': { intellect: 28, energy: 18, darkness: 6 },
  'crew-dynamics': { energy: 16, emotion: 14 },
  'charisma-lead': { energy: 20, emotion: 12 },
  'vigilante': { darkness: 26, dynamism: 24, energy: 18 },
  'prison': { darkness: 34, emotion: 20, energy: -14 },
  'courtroom': { intellect: 32, emotion: 16, dynamism: -18 },
  'journalism': { intellect: 28, darkness: 12, dynamism: -8 },
  'corporate': { intellect: 22, darkness: 16, emotion: -8 },

  // ── Фантастика ──────────────────────────────────────────────────
  'time-travel': { intellect: 30, energy: 12 },
  'time-loop': { intellect: 34, darkness: 10 },
  'cyberpunk': { darkness: 30, intellect: 24, energy: 14 },
  'ai': { intellect: 32, darkness: 14 },
  'robot': { intellect: 22, energy: 10 },
  'space-opera': { energy: 24, dynamism: 24, emotion: 14 },
  'post-apocalyptic': { darkness: 38, emotion: 14, energy: -6 },
  'virtual-reality': { intellect: 28, darkness: 12 },

  // ── Ужасы ───────────────────────────────────────────────────────
  'zombie': { darkness: 36, dynamism: 26, energy: 20 },
  'vampire': { darkness: 32, emotion: 14 },
  'werewolf': { darkness: 30, dynamism: 22, energy: 16 },
  'ghost': { darkness: 28, emotion: 18, dynamism: -12 },
  'haunted-house': { darkness: 32, dynamism: -14 },
  'found-footage': { darkness: 26, dynamism: 14, intellect: -8 },

  // ── Люди и отношения ────────────────────────────────────────────
  'high-school': { energy: 18, emotion: 20, darkness: -10 },
  'romance-drama': { emotion: 36, darkness: 12, energy: -10 },
  'mental-health': { emotion: 34, darkness: 28, intellect: 16 },
  'addiction': { darkness: 36, emotion: 30, energy: -8 },
  'buddy': { emotion: 22, energy: 18, darkness: -14 },
  'ensemble': { emotion: 12, energy: 10 },

  // ── История и вера ──────────────────────────────────────────────
  'medieval': { darkness: 16, emotion: 10 },
  'sword-and-sorcery': { energy: 22, dynamism: 24 },
  'dark-fantasy': { darkness: 34, emotion: 14, intellect: 12 },
  'mythology': { intellect: 20, emotion: 16, dynamism: 8 },
  'religion': { intellect: 26, emotion: 20, dynamism: -14 },
  'aristocracy': { intellect: 16, emotion: 12, dynamism: -12 },
  'biopic': { emotion: 22, intellect: 18, dynamism: -10 },
  'holocaust': { darkness: 46, emotion: 40, dynamism: -16 },
  'wwii': { darkness: 30, emotion: 24, dynamism: 12 },
  'wwi': { darkness: 34, emotion: 26, dynamism: 6 },
  'vietnam-war': { darkness: 36, emotion: 26, dynamism: 10 },
  'post-soviet': { darkness: 26, emotion: 22, intellect: 14 },

  // ── Форма и приёмы ──────────────────────────────────────────────
  'silent-film': { intellect: 20, dynamism: -14, emotion: 16 },
  'mockumentary': { intellect: 22, darkness: -12 },
  'anthology': { intellect: 16 },
  'unreliable-narrator': { intellect: 34, darkness: 16 },
  'plot-twist': { intellect: 26, dynamism: 12 },
  'technical-showcase': { energy: 18, dynamism: 16, intellect: 12 },
  'intellectual-game': { intellect: 36, dynamism: -10 },
  'martial-arts': { energy: 30, dynamism: 34 },
  'sword-fight': { energy: 24, dynamism: 30 },
  'period-action': { energy: 20, dynamism: 22, darkness: 10 },
  'car-chase': { energy: 34, dynamism: 40 },
  'motorsport': { energy: 32, dynamism: 34 },
  'dance': { energy: 26, emotion: 24, darkness: -16 },
  'road-movie': { emotion: 22, energy: 8, intellect: 10 },
  'wilderness': { emotion: 14, intellect: 8, energy: -6 },
  'ocean': { emotion: 16, energy: 8 },
  'small-town': { emotion: 18, dynamism: -16, darkness: 8 },
  'globetrotting': { energy: 22, dynamism: 20 },
  'comic-adaptation': { energy: 24, dynamism: 24, darkness: -8 },
  'literary-adaptation': { intellect: 24, emotion: 18, dynamism: -12 },
});

/**
 * Новые теги под то, как люди говорят о кино.
 *
 * Онтология росла от жанров и ключевых слов TMDB, то есть от того, чем
 * кино **является**. Просьба звучит иначе — чем оно **будет для меня
 * сегодня вечером**: «лёгкое», «под фон», «чтобы поплакать», «доброе».
 * Без таких слов разбор сваливает всё в «драму».
 *
 * Каждый тег здесь несёт вклад в оси — иначе он не работал бы нигде,
 * кроме сотни обогащённых карточек.
 */
Object.assign(TAG_MOODS, {
  'cozy': { darkness: -34, emotion: 26, energy: -12, dynamism: -20 },
  'wholesome': { darkness: -38, emotion: 30, intellect: -6 },
  'hopeful': { darkness: -26, emotion: 28 },
  'bittersweet': { emotion: 34, darkness: 18, intellect: 12 },
  'tearjerker': { emotion: 46, darkness: 24, dynamism: -14 },
  'uplifting': { darkness: -32, emotion: 30, energy: 20 },
  'easy-watch': { intellect: -24, darkness: -20, energy: 12 },
  'demanding': { intellect: 38, dynamism: -18 },
  'background-watch': { intellect: -30, energy: -8, dynamism: -14 },
  'meditative': { dynamism: -34, intellect: 24, energy: -26 },
  'relentless': { energy: 34, dynamism: 38, darkness: 20 },
  'absurdist': { intellect: 24, darkness: -14, energy: 18 },
  'whimsical': { darkness: -28, emotion: 22, energy: 14 },
  'cringe-comedy': { darkness: 12, emotion: 16, intellect: 10 },
  'date-night': { emotion: 28, darkness: -22 },
  'crowd-pleaser': { darkness: -24, energy: 22, emotion: 18 },
  'thought-provoking': { intellect: 38, emotion: 14 },
  /*
   * Просила сама модель при разметке, а словарь такого слова не знал.
   * Отброшенные теги для того и перечисляются в ответе: они показывают,
   * чего словарю не хватает, — вместо того чтобы гадать об этом.
   */
  'investigation': { intellect: 32, dynamism: 10, darkness: 16 },
  /*
   * Просила сама модель при разметке трёхсот фильмов. Отброшенные теги
   * для того и перечисляются в ответе: они показывают, чего не хватает
   * словарю, — вместо того чтобы гадать об этом за людей.
   */
  'conspiracy': { intellect: 34, darkness: 30, dynamism: 14 },
  'nature': { emotion: 20, darkness: -18, dynamism: -22, intellect: 14 },
  'science': { intellect: 40, dynamism: -10 },
  'ecological': { intellect: 30, emotion: 24, darkness: 22 },
  'moral-corruption': { darkness: 38, intellect: 24, emotion: 12 },
  'cannibalism': { darkness: 46, emotion: 10 },
  'disaster': { energy: 28, dynamism: 30, darkness: 26 },
  'first-contact': { intellect: 30, emotion: 18 },
  'alien-invasion': { energy: 26, dynamism: 28, darkness: 22 },
  'hard-sci-fi': { intellect: 40, emotion: -8, dynamism: -12 },
  'multiverse': { intellect: 30, energy: 22, dynamism: 20 },
  'folk-horror': { darkness: 36, intellect: 18, dynamism: -16 },
  'home-invasion': { darkness: 34, dynamism: 26, energy: 22 },
  'possession': { darkness: 38, emotion: 20 },
  'class-conflict': { intellect: 28, darkness: 24, emotion: 18 },
  'immigration': { emotion: 32, darkness: 22, intellect: 16 },
  'poverty': { darkness: 30, emotion: 30 },
  'illness': { emotion: 40, darkness: 30, dynamism: -20 },
  'parenthood': { emotion: 34, darkness: 10 },
  'siblings': { emotion: 28 },
  'marriage': { emotion: 30, intellect: 12 },
  'infidelity': { emotion: 30, darkness: 22, intellect: 10 },
  'forbidden-love': { emotion: 38, darkness: 20 },
  'love-triangle': { emotion: 30, darkness: 8 },
  'queer': { emotion: 30, intellect: 14 },
  'female-lead': { emotion: 16 },
  'workplace': { intellect: 16, emotion: 12 },
  'medical': { emotion: 26, intellect: 22, darkness: 18 },
  'food': { darkness: -26, emotion: 24, dynamism: -14 },
  'art': { intellect: 30, emotion: 22, dynamism: -16 },
  'aviation': { energy: 24, dynamism: 26 },
  'submarine': { darkness: 26, dynamism: -12, intellect: 18 },
  'military': { darkness: 22, dynamism: 18, energy: 16 },
  'heist-comedy': { intellect: 22, energy: 24, darkness: -18 },
  'soviet-classic': { emotion: 26, intellect: 20, dynamism: -18 },
  /*
   * Один тег на всё наше кино, а не два.
   *
   * Советское и российское разделены годом, а не сутью: человек, который
   * ищет «наше кино», не выбирает между «Бриллиантовой рукой» и «Братом» —
   * ему нужно и то и другое. Разделение по эпохам остаётся подкатегориями
   * подборки, но в профиль вкуса идёт один общий сигнал: иначе любовь
   * к отечественному размазалась бы по двум тегам и оба весили бы вдвое
   * меньше, чем заслуживают.
   */
  'russian-soviet': { emotion: 24, intellect: 16 },
  'russian-cinema': { emotion: 22, intellect: 14 },
});

/**
 * Человекочитаемые подписи тегов.
 *
 * Покрывать нужно всё, что может доехать до карточки: и теги из жанров,
 * и производные из правил обогащения. Непереведённый тег вылезает на
 * экран сырым слагом — это сразу видно пользователю.
 */
export const TAG_LABELS_RU = {
  // ── Жанровый слой ───────────────────────────────────────────────
  'action': 'экшен', 'adventure': 'приключения', 'journey': 'путешествие',
  'animation': 'анимация', 'comedy': 'комедия', 'crime': 'криминал',
  'documentary': 'документальное', 'drama': 'драма', 'family': 'семейное',
  'fantasy': 'фэнтези', 'historical': 'история', 'horror': 'ужасы',
  'music': 'музыка', 'mystery': 'детектив', 'whodunit': 'расследование',
  'romance': 'романтика', 'sci-fi': 'фантастика', 'thriller': 'триллер',
  'suspense': 'саспенс', 'war': 'война', 'western': 'вестерн',
  'frontier': 'фронтир', 'character-study': 'портрет героя',

  // ── Темы и сеттинги ─────────────────────────────────────────────
  'samurai': 'самураи', 'feudal-japan': 'феодальная Япония', 'sword-fight': 'бой на мечах',
  'honor-duty': 'честь и долг', 'period-action': 'исторический экшен', 'japan': 'Япония',
  'yakuza': 'якудза', 'martial-arts': 'боевые искусства', 'choreographed-combat': 'постановочный бой',
  'gun-fu': 'ган-фу', 'gunfight': 'перестрелки', 'assassin': 'наёмный убийца',
  'heist': 'ограбление', 'con-artist': 'аферисты', 'crew-dynamics': 'команда',
  'clockwork-plot': 'выверенный сюжет', 'underworld': 'криминальный мир',
  'charisma-lead': 'харизматичный герой', 'globetrotting': 'по всему миру',
  'mafia': 'мафия', 'drug-trade': 'наркоторговля', 'police': 'полиция',
  'detective': 'детектив', 'procedural': 'процедурал', 'serial-killer': 'серийный убийца',
  'spy': 'шпионы', 'espionage-craft': 'шпионское ремесло', 'cold-war': 'холодная война',
  'political': 'политика', 'journalism': 'журналистика', 'corporate': 'корпорации',
  'power-corruption': 'власть и коррупция', 'moral-decay': 'моральное падение',
  'revenge': 'месть', 'vigilante': 'самосуд', 'prison': 'тюрьма', 'courtroom': 'зал суда',
  'urban-crime': 'город и преступность', 'loner': 'одиночка',

  // ── Фантастика и будущее ────────────────────────────────────────
  'time-travel': 'путешествия во времени', 'time-loop': 'петля времени',
  'cyberpunk': 'киберпанк', 'ai': 'искусственный интеллект', 'robot': 'роботы',
  'tech-anxiety': 'тревога перед технологиями', 'space': 'космос', 'space-opera': 'космоопера',
  'dystopia': 'антиутопия', 'post-apocalyptic': 'постапокалипсис', 'apocalyptic': 'конец света',
  'bleak-world': 'мрачный мир', 'survival': 'выживание', 'virtual-reality': 'виртуальная реальность',
  'high-concept': 'сильная идея', 'mind-bending': 'выносит мозг', 'nonlinear': 'нелинейный сюжет',
  'awe': 'благоговение', 'isolation': 'одиночество',

  // ── Ужасы и готика ──────────────────────────────────────────────
  'zombie': 'зомби', 'vampire': 'вампиры', 'werewolf': 'оборотни', 'ghost': 'призраки',
  'haunted-house': 'дом с привидениями', 'occult': 'оккультизм', 'slasher': 'слэшер',
  'body-horror': 'боди-хоррор', 'gore': 'кровь и мясо', 'dread': 'нарастающий ужас',
  'gothic': 'готика', 'creature-feature': 'монстры', 'psychological': 'психологическое',

  // ── Чувства и драма ─────────────────────────────────────────────
  'coming-of-age': 'взросление', 'high-school': 'школа', 'romcom': 'ромком',
  'romance-drama': 'любовная драма', 'family-drama': 'семейная драма', 'friendship': 'дружба',
  'grief': 'утрата', 'melancholy': 'меланхолия', 'mental-health': 'ментальное здоровье',
  'addiction': 'зависимость', 'tenderness': 'нежность', 'emotional-weight': 'эмоциональная тяжесть',
  'moral-weight': 'моральный вес', 'nostalgia': 'ностальгия', 'feel-good': 'доброе кино',
  'underdog': 'аутсайдер',

  // ── Форма и стиль ───────────────────────────────────────────────
  'noir': 'нуар', 'shadow-aesthetic': 'игра теней', 'neon-aesthetic': 'неоновая эстетика',
  'stylized-visuals': 'визуальный стиль', 'stylized-violence': 'стильное насилие',
  'craft-aesthetic': 'ручная работа', 'surreal': 'сюрреализм', 'experimental': 'эксперимент',
  'philosophical': 'философское', 'dialogue-driven': 'на диалогах', 'slow-burn': 'медленное горение',
  'chamber-piece': 'камерное кино', 'confinement': 'замкнутое пространство', 'tension': 'напряжение',
  'ensemble': 'ансамбль', 'buddy': 'напарники', 'anthology': 'альманах',
  'mockumentary': 'псевдодокументалка', 'silent-film': 'немое кино', 'slapstick': 'слэпстик',
  'satire': 'сатира', 'dark-comedy': 'чёрная комедия', 'parody': 'пародия',
  'intellectual-humour': 'умный юмор', 'epic-scale': 'эпический размах', 'spectacle': 'зрелище',
  'kinetic-action': 'кинетический экшен', 'technical-showcase': 'техническое мастерство',

  // ── Мир и контекст ──────────────────────────────────────────────
  'medieval': 'средневековье', 'sword-and-sorcery': 'меч и магия', 'dark-fantasy': 'тёмное фэнтези',
  'mythology': 'мифология', 'religion': 'религия', 'period-drama': 'костюмная драма',
  'aristocracy': 'аристократия', 'biopic': 'байопик', 'true-story': 'реальные события',
  'holocaust': 'холокост', 'wwii': 'Вторая мировая', 'wwi': 'Первая мировая',
  'vietnam-war': 'война во Вьетнаме', 'post-soviet': 'постсоветское', 'europe': 'Европа',
  'korea': 'Корея', 'china': 'Китай', 'hong-kong': 'Гонконг', 'india': 'Индия',
  'urban-usa': 'американский город', 'small-town': 'провинция', 'landscape': 'пейзаж',
  'wilderness': 'дикая природа', 'ocean': 'океан', 'road-movie': 'роуд-муви',
  'holiday': 'праздники', 'discipline': 'дисциплина',

  // ── Спорт, музыка, движение ─────────────────────────────────────
  'sports': 'спорт', 'motorsport': 'автоспорт', 'car-chase': 'погони',
  'musical': 'мюзикл', 'music-scene': 'музыкальная сцена', 'dance': 'танцы',
  'intellectual-game': 'интеллектуальная игра',

  // ── Анимация ────────────────────────────────────────────────────
  'anime-style': 'аниме-стилистика', 'stop-motion': 'кукольная анимация',
  'hand-drawn': 'рисованная анимация',

  // ── Франшизы и адаптации ────────────────────────────────────────
  'superhero': 'супергерои', 'comic-adaptation': 'по комиксу',
  'literary-adaptation': 'по книге', 'franchise': 'франшиза',
  'found-footage': 'найденная плёнка', 'unreliable-narrator': 'ненадёжный рассказчик',
  'plot-twist': 'поворот сюжета',
};

/**
 * Подпись тега для интерфейса.
 *
 * Франшизы и авторы живут в отдельном справочнике, но пользователю
 * это различие безразлично — здесь они склеиваются в один поиск.
 */
/**
 * Подписи новых тегов — тех, что описывают не устройство фильма,
 * а то, чем он станет для зрителя сегодня вечером.
 */
Object.assign(TAG_LABELS_RU, {
  'cozy': 'уютное', 'wholesome': 'доброе', 'hopeful': 'обнадёживающее',
  'bittersweet': 'горько-сладкое', 'tearjerker': 'до слёз', 'uplifting': 'воодушевляющее',
  'easy-watch': 'не грузит', 'demanding': 'требует внимания', 'background-watch': 'под фон',
  'meditative': 'медитативное', 'relentless': 'без передышки', 'absurdist': 'абсурд',
  'whimsical': 'причудливое', 'cringe-comedy': 'неловкий юмор', 'date-night': 'на свидание',
  'crowd-pleaser': 'зайдёт всем', 'thought-provoking': 'заставляет думать',
  'investigation': 'расследование', 'conspiracy': 'заговор', 'nature': 'природа',
  'science': 'наука', 'ecological': 'экология', 'moral-corruption': 'нравственное падение',
  'cannibalism': 'каннибализм',
  'disaster': 'катастрофа', 'first-contact': 'первый контакт',
  'alien-invasion': 'вторжение', 'hard-sci-fi': 'твёрдая фантастика',
  'multiverse': 'мультивселенная', 'folk-horror': 'фолк-хоррор',
  'home-invasion': 'вторжение в дом', 'possession': 'одержимость',
  'class-conflict': 'классовый конфликт', 'immigration': 'эмиграция',
  'poverty': 'бедность', 'illness': 'болезнь', 'parenthood': 'родительство',
  'siblings': 'братья и сёстры', 'marriage': 'брак', 'infidelity': 'измена',
  'forbidden-love': 'запретная любовь', 'love-triangle': 'любовный треугольник',
  'queer': 'квир', 'female-lead': 'женщина в центре', 'workplace': 'работа',
  'medical': 'медицина', 'food': 'еда', 'art': 'искусство',
  'aviation': 'авиация', 'submarine': 'подводная лодка', 'military': 'армия',
  'heist-comedy': 'весёлое ограбление', 'soviet-classic': 'советская классика',
  'russian-soviet': 'Русское/СССР',
  'russian-cinema': 'российское кино',
});

/**
 * Синонимы для новых тегов.
 *
 * Без них тег не появится ни на одном фильме: теги собираются из
 * ключевых слов TMDB, а те приходят на английском и в своей форме.
 */
Object.assign(TAG_ALIASES, {
  'natural-disaster': 'disaster', 'disaster': 'disaster', 'earthquake': 'disaster',
  'tsunami': 'disaster', 'volcano': 'disaster', 'shipwreck': 'disaster',
  'first-contact': 'first-contact', 'alien-invasion': 'alien-invasion',
  'alien-life-form': 'first-contact', 'extraterrestrial': 'first-contact',
  'hard-science-fiction': 'hard-sci-fi', 'parallel-universe': 'multiverse',
  'multiverse': 'multiverse', 'alternate-reality': 'multiverse',
  'folk-horror': 'folk-horror', 'home-invasion': 'home-invasion',
  'demonic-possession': 'possession', 'exorcism': 'possession', 'possession': 'possession',
  'class-differences': 'class-conflict', 'social-class': 'class-conflict',
  'class-conflict': 'class-conflict', 'immigrant': 'immigration',
  'immigration': 'immigration', 'refugee': 'immigration',
  'poverty': 'poverty', 'homelessness': 'poverty',
  'terminal-illness': 'illness', 'cancer': 'illness', 'disease': 'illness',
  'illness': 'illness', 'hospital': 'medical', 'doctor': 'medical',
  'surgeon': 'medical', 'nurse': 'medical', 'epidemic': 'medical', 'pandemic': 'medical',
  'parenthood': 'parenthood', 'motherhood': 'parenthood', 'fatherhood': 'parenthood',
  'father-son-relationship': 'parenthood', 'mother-daughter-relationship': 'parenthood',
  'single-parent': 'parenthood', 'adoption': 'parenthood',
  'sibling-relationship': 'siblings', 'brother-brother-relationship': 'siblings',
  'sister-sister-relationship': 'siblings', 'twins': 'siblings',
  'marriage': 'marriage', 'wedding': 'marriage', 'divorce': 'marriage',
  'marriage-crisis': 'marriage', 'infidelity': 'infidelity',
  'extramarital-affair': 'infidelity', 'adultery': 'infidelity',
  'forbidden-love': 'forbidden-love', 'love-triangle': 'love-triangle',
  'lgbt': 'queer', 'gay': 'queer', 'lesbian': 'queer', 'transgender': 'queer',
  'gay-theme': 'queer', 'female-protagonist': 'female-lead',
  'strong-female-lead': 'female-lead', 'woman-director': 'female-lead',
  'workplace': 'workplace', 'office': 'workplace', 'coworker': 'workplace',
  'food': 'food', 'cooking': 'food', 'chef': 'food', 'restaurant': 'food',
  'art': 'art', 'painter': 'art', 'artist': 'art', 'museum': 'art',
  'aviation': 'aviation', 'airplane': 'aviation', 'pilot': 'aviation',
  'air-force': 'aviation', 'submarine': 'submarine',
  'military': 'military', 'army': 'military', 'soldier': 'military',
  'feel-good-movie': 'feel-good', 'heartwarming': 'wholesome',
  'coming-of-age': 'coming-of-age', 'road-trip': 'road-movie',
  'soviet-union': 'soviet-classic', 'russia': 'russian-cinema',
  'moscow': 'russian-cinema', 'saint-petersburg': 'russian-cinema',
});

export const tagLabel = (tag) => TAG_LABELS_RU[tag]
  ?? FRANCHISE_LABELS_RU[tag]
  ?? tag.replace(/^collection-\d+$/, 'франшиза').replace(/-/g, ' ');
