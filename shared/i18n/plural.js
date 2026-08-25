/**
 * Русские числительные.
 *
 * «Ещё 4 свайпов» — сразу видно, что текст собран конкатенацией.
 * Форма выбирается по правилам языка, а не по `n === 1`.
 */
export function plural(count, [one, few, many]) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

/** `withPlural(4, ['свайп','свайпа','свайпов'])` -> «4 свайпа» */
export const withPlural = (count, forms) => `${count} ${plural(count, forms)}`;

export const FORMS = Object.freeze({
  SWIPE: ['свайп', 'свайпа', 'свайпов'],
  MATCH: ['мэтч', 'мэтча', 'мэтчей'],
  MOVIE: ['фильм', 'фильма', 'фильмов'],
  MEMBER: ['участник', 'участника', 'участников'],
  ROOM: ['комната', 'комнаты', 'комнат'],
  MINUTE: ['минуту', 'минуты', 'минут'],
  HOUR: ['час', 'часа', 'часов'],
  DAY: ['день', 'дня', 'дней'],
  RATING: ['оценка', 'оценки', 'оценок'],
  ROLE: ['роль', 'роли', 'ролей'],
  YEAR: ['год', 'года', 'лет'],
});
