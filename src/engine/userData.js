/**
 * Персональные данные пользователя в Postgres.
 *
 * Таблицы (см. supabase/migrations):
 *   profiles        — имя, аватар, локаль, уровень доступа
 *   taste_profiles  — профиль вкуса (веса тегов + 5D-вектор)
 *   title_history   — title_id -> like|dislike|favorite|watched|match
 *   favorites       — избранное с компактной карточкой
 *   user_matches    — история мэтчей, личных и совместных
 *
 * Каждая таблица закрыта политикой «только владелец», поэтому клиент
 * физически не может прочитать чужой профиль вкуса.
 */

import { supabase, supabaseReady, guarded } from '../lib/supabase.js';
import { titleStub } from '../../shared/model/title.js';
import { serializeProfile, hydrateProfile, decayProfile, applySignal, applyRating, ACTION } from './tasteProfile.js';
import { loadLocal, saveLocal, STORAGE_KEYS } from '../lib/storage.js';
import { durableWrite, registerHandler } from '../lib/outbox.js';
import { trackMetric } from '../lib/telemetry.js';
import { METRIC, MODULE } from '../../shared/telemetry/events.js';
import { normalizeRoomCode } from '../../shared/model/roomCode.js';

/** Профиль вкуса из базы приезжает в snake_case — приводим к внутренней форме. */
const fromRow = (row) => (row ? hydrateProfile({
  version: row.version,
  tagWeights: row.tag_weights,
  moods: row.moods,
  moodMass: row.mood_mass,
  counts: row.counts,
  signals: row.signals,
  updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
}) : hydrateProfile(null));

const toRow = (userId, profile) => {
  const p = serializeProfile(profile);
  return {
    user_id: userId,
    version: p.version,
    tag_weights: p.tagWeights,
    moods: p.moods,
    mood_mass: p.moodMass,
    counts: p.counts,
    signals: p.signals,
    updated_at: new Date().toISOString(),
  };
};

/** Загружает всё состояние пользователя параллельными запросами. */
export async function loadUserState(uid) {
  if (!supabaseReady() || !uid) return localFallback();

  const [profile, taste, history, favorites, matches] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
    supabase.from('taste_profiles').select('*').eq('user_id', uid).maybeSingle(),
    supabase.from('title_history').select('title_id,action,title,rating,updated_at').eq('user_id', uid),
    supabase.from('favorites').select('*').eq('user_id', uid).order('added_at', { ascending: false }),
    supabase.from('user_matches').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(200),
  ]);

  return {
    profile: profile.data ?? {},
    access: {
      tier: profile.data?.access_tier ?? 'free',
      stars: profile.data?.access_stars ?? 0,
    },
    taste: decayProfile(fromRow(taste.data)),
    history: Object.fromEntries((history.data ?? []).map((r) => [r.title_id, r.action])),
    /**
     * Разрезы истории с карточками — питают вкладку «Моё».
     * Лайк и «посмотрено» это разные вещи, поэтому и списки разные:
     * лайкнутое остаётся в ленте рекомендаций, просмотренное — уходит.
     */
    /**
     * Три списка по трём решениям. Дизлайки списком не показываются
     * намеренно: единственное их назначение — исчезнуть из выбора.
     */
    wishlist: historySlice(history.data, actionsFor('wishlist')),
    watched: historySlice(history.data, actionsFor('watched')),
    /** Оценённое: показывается в профиле и заметно влияет на ленту. */
    ratings: Object.fromEntries((history.data ?? [])
      .filter((r) => r.rating && r.title)
      .sort((a, b) => (b.rating - a.rating) || (new Date(b.updated_at) - new Date(a.updated_at)))
      .map((r) => [r.title_id, {
        ...r.title, id: r.title_id, rating: r.rating, at: new Date(r.updated_at).getTime(),
      }])),
    favorites: Object.fromEntries((favorites.data ?? []).map((r) => [r.title_id, {
      ...r.title, id: r.title_id, addedAt: new Date(r.added_at).getTime(),
    }])),
    matches: Object.fromEntries((matches.data ?? []).map((r) => [`${r.title_id}_${r.room_code ?? 'solo'}`, {
      ...r.title,
      titleId: r.title_id,
      roomCode: r.room_code,
      partners: r.partners ?? [],
      at: new Date(r.created_at).getTime(),
    }])),
  };
}

/**
 * В какой список попадает то или иное решение.
 *
 * Единственный источник правды: по нему собираются списки при загрузке
 * и по нему же обновляется состояние сразу после действия, не дожидаясь
 * события из базы.
 */
export const LIST_BY_ACTION = Object.freeze({
  later: 'wishlist',
  like: 'wishlist',
  match: 'wishlist',
  watched: 'watched',
  favorite: 'favorites',
  dislike: null,
});

/** Компактная запись списка из полного тайтла. */
export function listEntry(title, action, at = Date.now()) {
  return { ...titleStub(title), id: title.id, action, at, addedAt: at };
}

/**
 * Локальное применение решения к состоянию пользователя.
 *
 * Запись в базу асинхронна, а список должен ожить в тот же кадр —
 * иначе кажется, что отметка никуда не сохранилась.
 */
export function applyLocalDecision(state, title, action, { rating } = {}) {
  if (!state) return state;

  const entry = { ...listEntry(title, action), ...(rating ? { rating } : {}) };
  const next = {
    ...state,
    history: { ...state.history, [title.id]: action },
    wishlist: { ...state.wishlist },
    watched: { ...state.watched },
    favorites: { ...state.favorites },
    ratings: { ...state.ratings },
  };

  if (rating) next.ratings[title.id] = entry;

  // Решение всегда одно: убираем тайтл отовсюду, затем кладём куда следует.
  delete next.wishlist[title.id];
  delete next.watched[title.id];
  delete next.favorites[title.id];

  const list = LIST_BY_ACTION[action];
  if (list) next[list][title.id] = entry;

  return next;
}

/** Снятие решения — убирает тайтл из всех списков. */
export function removeLocalDecision(state, titleId) {
  if (!state) return state;
  const next = {
    ...state,
    history: { ...state.history },
    wishlist: { ...state.wishlist },
    watched: { ...state.watched },
    favorites: { ...state.favorites },
    ratings: { ...state.ratings },
  };
  delete next.history[titleId];
  delete next.wishlist[titleId];
  delete next.watched[titleId];
  delete next.favorites[titleId];
  delete next.ratings[titleId];
  return next;
}

/** Отбирает из истории записи нужных действий и сортирует по свежести. */
const actionsFor = (list) => Object.entries(LIST_BY_ACTION)
  .filter(([, target]) => target === list)
  .map(([action]) => action);

function historySlice(rows, actions) {
  return Object.fromEntries((rows ?? [])
    .filter((r) => actions.includes(r.action) && r.title)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .map((r) => [r.title_id, {
      ...r.title,
      id: r.title_id,
      action: r.action,
      at: new Date(r.updated_at).getTime(),
      watchedAt: new Date(r.updated_at).getTime(),
    }]));
}

function localFallback() {
  return {
    profile: {},
    access: { tier: 'free', stars: 0 },
    taste: decayProfile(loadLocal(STORAGE_KEYS.GUEST_TASTE)),
    history: loadLocal('guest-history', {}),
    wishlist: {},
    watched: {},
    ratings: {},
    favorites: {},
    matches: {},
  };
}

/**
 * Живое обновление личных данных: второе устройство того же пользователя
 * должно видеть свежий профиль без перезагрузки.
 */
export function subscribeUserState(uid, onChange) {
  if (!supabaseReady() || !uid) return () => {};

  const channel = supabase.channel(`user:${uid}`);
  for (const table of ['taste_profiles', 'title_history', 'favorites', 'user_matches', 'profiles']) {
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table,
      filter: table === 'profiles' ? `id=eq.${uid}` : `user_id=eq.${uid}`,
    }, () => onChange());
  }
  channel.subscribe();

  return () => supabase.removeChannel(channel);
}

/* ────────────────────────────────────────────────────────────────
   Обработчики отложенной записи
   ────────────────────────────────────────────────────────────────
   Всё, что меняет данные пользователя, проходит через очередь: если
   запись не удалась, она повторится при возврате сети. Без этого
   отметка оставалась бы только на экране, а после перезагрузки
   исчезала — ровно то, что выглядит как потеря списка. */

registerHandler('reaction', async ({ uid, titleId, action, title, taste, addFavorite }) => {
  const writes = [
    supabase.from('taste_profiles').upsert(toRow(uid, taste), { onConflict: 'user_id' }),
  ];

  if (action) {
    writes.push(supabase.from('title_history').upsert({
      user_id: uid, title_id: titleId, action, title, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,title_id' }));
  }

  if (addFavorite) {
    writes.push(supabase.from('favorites').upsert({
      user_id: uid, title_id: titleId, title,
    }, { onConflict: 'user_id,title_id' }));
  }

  const results = await Promise.all(writes);
  const failed = results.find((r) => r.error);
  if (failed) throw Object.assign(new Error(failed.error.message), { code: failed.error.code });
});

registerHandler('undo', async ({ uid, titleId, taste }) => {
  const results = await Promise.all([
    supabase.from('title_history').delete().eq('user_id', uid).eq('title_id', titleId),
    supabase.from('favorites').delete().eq('user_id', uid).eq('title_id', titleId),
    taste
      ? supabase.from('taste_profiles').upsert(toRow(uid, taste), { onConflict: 'user_id' })
      : Promise.resolve({ error: null }),
  ]);
  const failed = results.find((r) => r.error);
  if (failed) throw Object.assign(new Error(failed.error.message), { code: failed.error.code });
});

registerHandler('rating', async ({ uid, titleId, title, rating, action, taste }) => {
  const results = await Promise.all([
    supabase.from('title_history').upsert({
      user_id: uid, title_id: titleId, title, rating, action,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,title_id' }),
    supabase.from('taste_profiles').upsert(toRow(uid, taste), { onConflict: 'user_id' }),
  ]);
  const failed = results.find((r) => r.error);
  if (failed) throw Object.assign(new Error(failed.error.message), { code: failed.error.code });
});

registerHandler('match', async ({ uid, titleId, roomCode, title, partners }) => {
  const { error } = await supabase.from('user_matches').upsert({
    user_id: uid, title_id: titleId, room_code: roomCode, title, partners,
  }, { onConflict: 'user_id,title_id,room_code', ignoreDuplicates: true });
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
});

/**
 * Записывает реакцию на тайтл: обновляет историю, профиль вкуса и,
 * если нужно, избранное.
 */
export async function recordReaction({ uid, title, action, taste, surface = 'solo' }) {
  const nextTaste = applySignal(taste, title, action);
  const historyValue = action === ACTION.INSPECT ? null : action;

  trackMetric(action === ACTION.FAVORITE ? METRIC.FAVORITE : METRIC.SWIPE, {
    context: { action, surface },
  });

  if (!supabaseReady() || !uid) {
    saveLocal(STORAGE_KEYS.GUEST_TASTE, serializeProfile(nextTaste));
    if (historyValue) {
      const history = loadLocal('guest-history', {});
      history[title.id] = historyValue;
      saveLocal('guest-history', history);
    }
    return nextTaste;
  }

  await durableWrite('reaction', {
    uid,
    titleId: title.id,
    action: historyValue,
    title: titleStub(title),
    taste: nextTaste,
    addFavorite: action === ACTION.FAVORITE,
  }, { key: `reaction:${uid}:${title.id}` });

  return nextTaste;
}

export async function toggleFavorite({ uid, title, isFavorite, taste }) {
  if (isFavorite) {
    if (supabaseReady() && uid) {
      await guarded(
        () => supabase.from('favorites').delete().eq('user_id', uid).eq('title_id', title.id),
        { module: MODULE.VAULT, description: 'remove favorite' },
      );
    }
    return taste;
  }
  return recordReaction({ uid, title, action: ACTION.FAVORITE, taste });
}

/** Отметка «уже посмотрел» — тайтл исчезает из будущих личных колод. */
export async function markWatchedPersonal({ uid, title, taste, watched = true }) {
  const nextTaste = watched ? applySignal(taste, title, ACTION.WATCHED) : taste;
  if (!supabaseReady() || !uid) return nextTaste;

  await (watched
    ? durableWrite('reaction', {
      uid,
      titleId: title.id,
      action: ACTION.WATCHED,
      title: titleStub(title),
      taste: nextTaste,
    }, { key: `reaction:${uid}:${title.id}` })
    : durableWrite('undo', { uid, titleId: title.id, taste: nextTaste },
      { key: `reaction:${uid}:${title.id}` }));

  if (watched) trackMetric(METRIC.WATCHED_MARK, {});
  return nextTaste;
}

/**
 * Отмена последнего решения.
 *
 * Возвращает фильм в выбор: убирает запись из истории и из избранного,
 * а профиль вкуса восстанавливает из снимка, снятого перед действием.
 * Пересчитать сигнал «в обратную сторону» нельзя — старение и масса
 * настроения делают applySignal необратимым, поэтому снимок честнее.
 */
export async function undoDecision({ uid, titleId, previousTaste }) {
  if (!supabaseReady() || !uid) {
    if (previousTaste) saveLocal(STORAGE_KEYS.GUEST_TASTE, serializeProfile(previousTaste));
    const history = loadLocal('guest-history', {});
    delete history[titleId];
    saveLocal('guest-history', history);
    return previousTaste;
  }

  await durableWrite('undo', { uid, titleId, taste: previousTaste },
    { key: `reaction:${uid}:${titleId}` });

  return previousTaste;
}

/**
 * Оценка фильма.
 *
 * Оценить можно только то, что посмотрел, поэтому оценка заодно помечает
 * фильм просмотренным: иначе он остался бы в ленте, и пользователю
 * предлагали бы решить про кино, о котором он только что высказался.
 */
export async function rateTitle({ uid, title, rating, taste }) {
  const nextTaste = applyRating(taste, title, rating);

  if (!supabaseReady() || !uid) {
    saveLocal(STORAGE_KEYS.GUEST_TASTE, serializeProfile(nextTaste));
    return nextTaste;
  }

  await durableWrite('rating', {
    uid,
    titleId: title.id,
    title: titleStub(title),
    rating,
    action: ACTION.WATCHED,
    taste: nextTaste,
  }, { key: `reaction:${uid}:${title.id}` });

  return nextTaste;
}

/** История мэтчей: и личных, и совместных. */
export async function saveMatch({ uid, title, roomCode = null, partners = [] }) {
  if (!supabaseReady() || !uid) return;
  await durableWrite('match', {
    uid, titleId: title.id, roomCode, title: titleStub(title), partners,
  }, { key: `match:${uid}:${title.id}:${roomCode ?? 'solo'}` });
}

/** Недавние комнаты — питают вкладку «Друзья». */
export async function rememberRoom({ code, role = 'member' }) {
  const normalized = normalizeRoomCode(code);
  if (!normalized) return;

  const recent = loadLocal(STORAGE_KEYS.LAST_ROOMS, []);
  const next = [{ code: normalized, at: Date.now(), role },
    ...recent.filter((r) => r.code !== normalized)].slice(0, 8);
  saveLocal(STORAGE_KEYS.LAST_ROOMS, next);
}

/**
 * Список недавних комнат.
 *
 * Локальная копия дополняется тем, что видно в базе: членство переживает
 * очистку браузера, а на новом устройстве список не окажется пустым.
 */
export async function loadRecentRooms(uid) {
  const local = loadLocal(STORAGE_KEYS.LAST_ROOMS, []);
  if (!supabaseReady() || !uid) return local;

  const { data } = await supabase
    .from('room_members')
    .select('room_code,is_host,last_seen')
    .eq('user_id', uid)
    .order('last_seen', { ascending: false })
    .limit(8);

  const merged = new Map(local.map((entry) => [entry.code, entry]));
  for (const row of data ?? []) {
    const existing = merged.get(row.room_code);
    merged.set(row.room_code, {
      code: row.room_code,
      role: row.is_host ? 'host' : 'member',
      at: Math.max(existing?.at ?? 0, new Date(row.last_seen).getTime()),
    });
  }

  return [...merged.values()].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 8);
}

export const localRecentRooms = () => loadLocal(STORAGE_KEYS.LAST_ROOMS, []);

export async function updateProfileFields(uid, fields) {
  if (!supabaseReady() || !uid) return;
  const patch = {};
  if (fields.displayName !== undefined) patch.display_name = fields.displayName;
  if (fields.photoURL !== undefined) patch.photo_url = fields.photoURL;
  if (fields.locale !== undefined) patch.locale = fields.locale;

  await guarded(
    () => supabase.from('profiles').update(patch).eq('id', uid),
    { module: MODULE.TASTE, description: 'update profile' },
  );
}
