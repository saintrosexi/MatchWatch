/**
 * Фильмы, которые не попадают в каталог никогда.
 *
 * Не «понижаются», а именно не попадают: понижение оставляет шанс,
 * а здесь шанс не нужен. Поэтому отсев стоит в самом каталоге, до
 * всякого ранжирования, — иначе исключённое всплывало бы там, где
 * подборке нечего показать.
 *
 * Отсев работает по трём признакам сразу, и это не перестраховка:
 * у TMDB ключевые слова проставлены неровно — у популярного фильма
 * их тридцать, у нишевого ни одного. По одному признаку половина
 * прошла бы насквозь.
 */

/** Наши теги, полученные из ключевых слов TMDB. */
const EXCLUDED_TAGS = Object.freeze(['queer']);

/**
 * Ключевые слова TMDB как есть — на случай, если наш словарь их
 * не подхватил. Список намеренно шире, чем синонимы в онтологии.
 */
const EXCLUDED_KEYWORDS = Object.freeze([
  'lgbt', 'lgbtq', 'gay', 'lesbian', 'bisexual', 'transgender', 'transsexual',
  'queer', 'gay-theme', 'gay-interest', 'lesbian-interest', 'gay-relationship',
  'lesbian-relationship', 'same-sex', 'homosexual', 'homosexuality',
  'drag-queen', 'coming-out', 'pride-parade', 'non-binary', 'genderqueer',
]);

/**
 * Слова в названии — последняя сеть.
 *
 * Ловит то, у чего разметки нет вовсе. Проверяется по границам слов:
 * без этого «gay» поймал бы «Gaya», а «pride» — «Pride & Prejudice»,
 * и отсев начал бы выбрасывать не то.
 */
const EXCLUDED_TITLE_WORDS = Object.freeze([
  'lgbt', 'lgbtq', 'gay', 'lesbian', 'queer', 'transgender',
  'гей', 'лесби', 'лгбт', 'квир', 'трансгендер',
]);

const wordRe = new RegExp(`(^|[^\\p{L}])(${EXCLUDED_TITLE_WORDS.join('|')})([^\\p{L}]|$)`, 'iu');

/**
 * Попадает ли карточка под постоянное исключение.
 *
 * @param {object} title нормализованная карточка
 * @param {string[]} [rawKeywords] ключевые слова TMDB до нормализации
 */
export function isExcluded(title, rawKeywords = null) {
  if (!title) return false;

  for (const tag of EXCLUDED_TAGS) {
    if (title.tags?.[tag]) return true;
  }

  const keywords = rawKeywords ?? Object.keys(title.tags ?? {});
  for (const keyword of keywords) {
    if (EXCLUDED_KEYWORDS.includes(String(keyword).toLowerCase())) return true;
  }

  for (const field of [title.title, title.originalTitle]) {
    if (field && wordRe.test(field)) return true;
  }

  return false;
}

/** Отсеивает пачку карточек. Возвращает новый массив. */
export const withoutExcluded = (titles) => (titles ?? []).filter((t) => !isExcluded(t));
