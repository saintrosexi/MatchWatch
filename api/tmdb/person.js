/**
 * GET /api/tmdb/person?id=<personId>  — профиль актёра для Star Hub
 * GET /api/tmdb/person?popular=1      — витрина популярных актёров
 *
 * Отдаёт фото высокого разрешения, факты биографии и фильмографию,
 * из которой мгновенно собирается колода свайпов только с этим актёром.
 */

import { withHandler, notFound } from '../_lib/http.js';
import { assertNonEmpty, getImageBase, tmdbFetch } from '../_lib/tmdb.js';
import { cached, TTL } from '../_lib/cache.js';
import { normalizeTmdbMovie, posterUrl } from '../../shared/model/title.js';
import { MODULE } from '../../shared/telemetry/events.js';
import { clampInt, mapWithConcurrency, toInt } from '../_lib/util.js';
import { withPlural, FORMS } from '../../shared/i18n/plural.js';

const DEPARTMENT_RU = {
  Acting: 'Актёр', Directing: 'Режиссёр', Writing: 'Сценарист',
  Production: 'Продюсер', Camera: 'Оператор', Sound: 'Композитор',
};

export default withHandler({ methods: ['GET'], module: MODULE.STARS, cacheSeconds: 3600 }, async ({ query }) => {
  const imageBase = await getImageBase();

  if (query.get('popular')) {
    const page = clampInt(query.get('page'), 1, 5, 1);
    const language = query.get('language') ?? 'ru-RU';

    const { value, source } = await cached(`people_showcase_${page}_${language}`, TTL.PERSON,
      () => buildStarShowcase({ page, language, imageBase }));

    return { ...value, cacheSource: source };
  }

  const id = toInt(query.get('id'));
  if (!id) throw notFound('person_id_required', 'Не указан id персоны');
  const language = query.get('language') ?? 'ru-RU';

  const { value, source } = await cached(`person_${id}_${language}`, TTL.PERSON, async () => {
    const raw = await tmdbFetch(`/person/${id}`, {
      language, append_to_response: 'movie_credits,external_ids',
    });
    if (!raw) return null;

    const filmography = (raw.movie_credits?.cast ?? [])
      .filter((m) => m.poster_path && (m.vote_count ?? 0) >= 25)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 40)
      .map((m) => normalizeTmdbMovie(m, { imageBase }))
      .filter(Boolean);

    return {
      person: {
        id: raw.id,
        name: raw.name,
        originalName: raw.also_known_as?.[0] ?? null,
        photo: raw.profile_path ? posterUrl(raw.profile_path, 'w342', imageBase) : null,
        photoLarge: raw.profile_path ? posterUrl(raw.profile_path, 'h632', imageBase) : null,
        biography: raw.biography?.trim() || null,
        birthday: raw.birthday ?? null,
        deathday: raw.deathday ?? null,
        placeOfBirth: raw.place_of_birth ?? null,
        department: DEPARTMENT_RU[raw.known_for_department] ?? raw.known_for_department ?? null,
        popularity: Math.round(raw.popularity ?? 0),
        homepage: raw.homepage ?? null,
        imdb: raw.external_ids?.imdb_id ?? null,
        /** Короткие факты для карточки — собираем из структурированных полей. */
        facts: buildFacts(raw, filmography),
      },
      filmography,
    };
  });

  if (!value) throw notFound('person_not_found', 'Актёр не найден', { personId: id });
  return { ...value, cacheSource: source };
});

/**
 * Витрина звёзд.
 *
 * Штатный `/person/popular` для этого не годится: он ранжирует по трафику
 * на TMDB, поэтому в выдачу попадают случайные люди, а имена приходят
 * в оригинальном написании — от иероглифов до кириллицы вперемешку.
 *
 * Собираем актёров из составов популярных фильмов: тот, кто снимается
 * в том, что смотрят, и есть кинозвезда. Заодно получаем осмысленный
 * порядок — по числу заметных фильмов, а не по кликам на сайте.
 */
async function buildStarShowcase({ page, language, imageBase }) {
  const today = new Date().toISOString().slice(0, 10);
  const list = await tmdbFetch('/movie/popular', { page, language });

  // Только вышедшее: анонсы собирают трафик, но звёзд по ним не считают —
  // состав ещё может поменяться, да и посмотреть их нельзя.
  const movies = (list?.results ?? [])
    .filter((m) => m.poster_path && m.release_date && m.release_date <= today)
    .slice(0, 12);

  const credits = await mapWithConcurrency(movies, 4, (movie) =>
    tmdbFetch(`/movie/${movie.id}/credits`, { language }));

  const byPerson = new Map();

  for (let i = 0; i < credits.length; i += 1) {
    const cast = credits[i]?.cast;
    if (!Array.isArray(cast)) continue;

    // Берём только первые роли: массовка звёздами не делает.
    for (const person of cast.slice(0, 8)) {
      if (!person.profile_path || person.known_for_department !== 'Acting') continue;

      const existing = byPerson.get(person.id);
      const title = movies[i]?.title;

      if (existing) {
        existing.appearances += 1;
        if (title && existing.knownFor.length < 3) existing.knownFor.push(title);
      } else {
        byPerson.set(person.id, {
          id: person.id,
          name: person.name,
          photo: posterUrl(person.profile_path, 'w342', imageBase),
          photoLarge: posterUrl(person.profile_path, 'h632', imageBase),
          knownFor: title ? [title] : [],
          popularity: Math.round(person.popularity ?? 0),
          appearances: 1,
        });
      }
    }
  }

  const people = [...byPerson.values()]
    .sort((a, b) => (b.appearances - a.appearances) || (b.popularity - a.popularity))
    .slice(0, 30);

  return { people: assertNonEmpty(people, { path: '/movie/popular', params: { page } }) };
}

function buildFacts(raw, filmography) {
  const facts = [];
  if (raw.birthday) {
    const born = new Date(raw.birthday);
    const end = raw.deathday ? new Date(raw.deathday) : new Date();
    const age = Math.floor((end - born) / (365.25 * 24 * 3600_000));
    facts.push(raw.deathday
      ? `${born.getFullYear()}–${new Date(raw.deathday).getFullYear()}, прожил(а) ${withPlural(age, FORMS.YEAR)}`
      : `${withPlural(age, FORMS.YEAR)}, родился(ась) ${born.toLocaleDateString('ru-RU')}`);
  }
  if (raw.place_of_birth) facts.push(`Место рождения: ${raw.place_of_birth}`);
  const count = raw.movie_credits?.cast?.length ?? 0;
  if (count) facts.push(`${withPlural(count, FORMS.ROLE)} в кино по данным TMDB`);
  const best = filmography.filter((f) => f.rating).sort((a, b) => b.rating - a.rating)[0];
  if (best) facts.push(`Высший рейтинг фильмографии — «${best.title}» (${best.rating})`);
  return facts.slice(0, 4);
}
