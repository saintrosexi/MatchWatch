/**
 * MatchWatch — коды комнат.
 *
 * ЕДИНСТВЕННЫЙ источник правды о формате кода. Создание, ручной ввод,
 * прямая ссылка `?room=CODE` и Telegram `start_param` обязаны пройти
 * через `normalizeRoomCode` — расхождение форматов между записью и поиском
 * является классической причиной «комната не находится».
 *
 * Формат: ровно 5 цифр. Буквы ушли намеренно — код диктуют вслух и
 * набирают на телефоне, а цифровая клавиатура вдвое крупнее и не знает
 * ни регистра, ни спора «O или ноль». Пять знаков вместо четырёх дают
 * стотысячное пространство: случайное попадание в чужую комнату
 * перестаёт быть правдоподобным.
 */

export const ROOM_CODE_ALPHABET = '0123456789';
export const ROOM_CODE_LENGTH = 5;

/**
 * Приводит любой пользовательский ввод к каноническому коду.
 * @returns {string|null} канонический код или null, если ввод невалиден.
 */
export function normalizeRoomCode(input) {
  if (input === null || input === undefined) return null;
  let s = String(input).trim().toUpperCase();

  // Пользователь мог вставить целую ссылку — вытащим код.
  const fromUrl = s.match(/[?&](?:ROOM|STARTAPP|TGWEBAPPSTARTPARAM)=(\d{5})/i);
  if (fromUrl) s = fromUrl[1];

  // Всё, кроме цифр, отбрасываем: пробелы и дефисы люди ставят сами,
  // а буквы в коде не встречаются вовсе.
  s = s.replace(/\D/g, '');
  if (s.length !== ROOM_CODE_LENGTH) return null;
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
