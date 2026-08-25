/**
 * MatchWatch — коды комнат.
 *
 * ЕДИНСТВЕННЫЙ источник правды о формате кода. Создание, ручной ввод,
 * прямая ссылка `?room=CODE` и Telegram `start_param` обязаны пройти
 * через `normalizeRoomCode` — расхождение форматов между записью и поиском
 * является классической причиной «комната не находится».
 *
 * Формат: ровно 4 символа из алфавита без визуально спорных знаков
 * (нет 0/O, 1/I/L), всегда верхний регистр, всегда строка.
 */

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 4;

/**
 * Схожие символы, которые пользователи путают при ручном вводе.
 * O/0 и I/1/L в алфавите отсутствуют, поэтому их однозначно схлопываем
 * в ближайший допустимый символ — один проход, без цепочек.
 */
const CONFUSABLES = { '0': 'Q', 'O': 'Q', '1': 'J', 'I': 'J', 'L': 'J' };

/**
 * Приводит любой пользовательский ввод к каноническому коду.
 * @returns {string|null} канонический код или null, если ввод невалиден.
 */
export function normalizeRoomCode(input) {
  if (input === null || input === undefined) return null;
  let s = String(input).trim().toUpperCase();

  // Пользователь мог вставить целую ссылку — вытащим код.
  const fromUrl = s.match(/[?&](?:ROOM|STARTAPP|TGWEBAPPSTARTPARAM)=([A-Z0-9]{4})/i);
  if (fromUrl) s = fromUrl[1].toUpperCase();

  s = s.replace(/[^A-Z0-9]/g, '');
  if (s.length !== ROOM_CODE_LENGTH) return null;

  // Мягкая коррекция визуально спорных символов — ровно один проход.
  s = s.split('').map((ch) => (ROOM_CODE_ALPHABET.includes(ch) ? ch : CONFUSABLES[ch] ?? ch)).join('');

  if (s.length !== ROOM_CODE_LENGTH) return null;
  if (![...s].every((ch) => ROOM_CODE_ALPHABET.includes(ch))) return null;
  return s;
}

export const isValidRoomCode = (input) => normalizeRoomCode(input) !== null;

/** Путь хранения — тоже единый, чтобы запись и чтение не разъехались. */
export const roomPath = (code, ...rest) => {
  const normalized = normalizeRoomCode(code);
  if (!normalized) throw new Error(`roomPath: невалидный код комнаты «${code}»`);
  return ['rooms', normalized, ...rest].join('/');
};

/** Генерация кода с криптостойким источником случайности, где он доступен. */
export function generateRoomCode(randomBytes) {
  const n = ROOM_CODE_ALPHABET.length;
  let out = '';
  const bytes = randomBytes ?? defaultRandomBytes(ROOM_CODE_LENGTH * 2);
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    out += ROOM_CODE_ALPHABET[bytes[i] % n];
  }
  return out;
}

function defaultRandomBytes(len) {
  const arr = new Uint8Array(len);
  const c = globalThis.crypto;
  if (c?.getRandomValues) c.getRandomValues(arr);
  else for (let i = 0; i < len; i += 1) arr[i] = Math.floor(Math.random() * 256);
  return arr;
}

/** Как пользователь попал в комнату — важно для разбора «не нашлось». */
export const JOIN_SOURCE = Object.freeze({
  MANUAL: 'manual',
  LINK: 'link',
  DEEP_LINK: 'telegram-deep-link',
  RECENT: 'recent-list',
  CREATE: 'create',
});
