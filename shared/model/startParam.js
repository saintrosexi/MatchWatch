/**
 * MatchWatch — куда вести человека, пришедшего из Telegram.
 *
 * ЕДИНСТВЕННЫЙ источник правды о разборе `start_param`. Через него
 * проходят и приглашение в комнату, и кнопки бота-навигатора: иначе
 * бот отправляет одно, а приложение понимает другое, и человек попадает
 * не туда, куда нажал.
 *
 * Разделение однозначное и не требует префиксов: код комнаты — ровно
 * пять цифр, назначение — слово. Пересечься они не могут.
 */

import { normalizeRoomCode } from './roomCode.js';

/**
 * Куда бот умеет отправить.
 *
 * Значения совпадают с ключами экранов в приложении намеренно: лишний
 * слой перевода между «что написал бот» и «какой экран открылся» —
 * это ещё одно место, где они разъезжаются.
 */
export const DESTINATION = Object.freeze({
  DECK: 'deck',
  COLLECTION: 'collection',
  ROOMS: 'rooms',
  MINE: 'mine',
  ME: 'me',
  NEWS: 'news',
  /** Не экран, а витрина подписки поверх ленты. */
  PREMIUM: 'premium',
});

const KNOWN = new Set(Object.values(DESTINATION));

/**
 * @param {string|null|undefined} raw значение `start_param`
 * @returns {{kind: 'room', code: string} | {kind: 'view', to: string} | null}
 */
export function parseStartParam(raw) {
  if (raw === null || raw === undefined) return null;

  const code = normalizeRoomCode(raw);
  if (code) return { kind: 'room', code };

  const value = String(raw).trim().toLowerCase();
  if (KNOWN.has(value)) return { kind: 'view', to: value };

  return null;
}
